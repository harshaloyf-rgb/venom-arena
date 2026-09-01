// ============================================================================
// ArenaRoom — Core Game Simulation for one arena shard.
// Self-contained server-side tick logic mirroring engine.ts.
// Supports 1000 players/bots per shard with all Phase A-D features.
// ============================================================================

import {
  // Types
  type FoodOrb, type StarChip, type SnakeSnapshot, type ArenaSnapshot,
  type TurnMetadata, type SkinRarity, type SpatialEntity, type FoodSize,
  type IPathBuffer,
  // Classes
  PathBuffer, SpatialHash,
  // Config
  ARENA_RADIUS, BASE_SPEED, BOOST_SPEED, MAX_TURN_RATE, SEGMENT_SPACING,
  GROWTH_RATE, START_LENGTH, MAX_SNAKE_LENGTH,
  FOOD_COUNT_TARGET, FOOD_SPAWN_WEIGHTS, FOOD_VALUES, FOOD_RADII,
  FOOD_COLORS, FOOD_GLOW_COLORS, FOOD_SPAWN_AREA_RADIUS, INITIAL_SPAWN_RADIUS,
  FOOD_RESPAWN_BATCH,
  SNAKE_RADIUS, NECK_PROTECTION, SPAWN_PROTECTION_MS, SPATIAL_CELL_SIZE,
  DEATH_FOOD_LARGE_DIVISOR, DEATH_FOOD_MEDIUM_DIVISOR, HEAD_ON_HEAD_BOOST_WINS,
  BOOST_DROP_INTERVAL, BOOST_MIN_BODY, BOOST_MIN_SCORE, BOOST_SHRINK_RATE,
  BOT_COUNT, BOT_MAX_TURN_RATE, BOT_START_SCORE_MIN, BOT_START_SCORE_MAX,
  BOT_FOOD_SCAN_RADIUS, BOT_EVADE_RADIUS, BOT_PREDICT_TICKS, BOT_WANDER_RATE,
  SAFE_SPAWN_DIST, SAFE_SPAWN_ATTEMPTS,
  TIGHT_TURN_THRESHOLD, SPIRAL_DETECT_WINDOW, MAX_SPIRAL_ANGLE_DELTA,
  SPIRAL_A, SPIRAL_B,
  STAR_CHIP_VALUE, STAR_CHIP_SPAWN_INTERVAL, STAR_CHIP_RADIUS,
  STAR_CHIP_GLOW, STAR_CHIP_COLORS,
  BODY_DOWNSAMPLE_INTERVAL, FOOD_DOWNSAMPLE_RADIUS, MAX_SNAKES_PER_SNAPSHOT,
  // Utilities
  distSq, angleDirect, getBotTarget,
} from './shared';

// ─── Constants ───────────────────────────────────────────────────────────────

const BOT_NAMES = [
  'Viper', 'Cobra', 'Mamba', 'Python', 'Anaconda', 'Rattler',
  'Sidewinder', 'Boa', 'Asp', 'Taipan', 'Krait', 'Copperhead',
  'KingSnake', 'Coral', 'Adder', 'Basilisk', 'Hydra', 'Ouroboros',
  'Naga', 'Serpent', 'Jormungandr', 'Apep', 'Quetzal', 'Coatl',
  'Wiggles', 'Slithers', 'Fang', 'Venom', 'Toxin', 'Striker',
];

const SNAKE_PALETTES: [string, string][] = [
  ['#ef4444', '#f87171'], ['#f97316', '#fb923c'],
  ['#eab308', '#facc15'], ['#22c55e', '#4ade80'],
  ['#06b6d4', '#22d3ee'], ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'], ['#f43f5e', '#fb7185'],
  ['#14b8a6', '#2dd4bf'], ['#a855f7', '#c084fc'],
];

const FOOD_SIZES: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

const COLLISION_DIST_SQ = SNAKE_RADIUS * 2 * SNAKE_RADIUS * 2;
const EAT_DIST_SQ = (SNAKE_RADIUS + 10) * (SNAKE_RADIUS + 10);
const STAR_CHIP_DIST_SQ = (SNAKE_RADIUS + STAR_CHIP_RADIUS) * (SNAKE_RADIUS + STAR_CHIP_RADIUS);

// ─── ServerSnake ─────────────────────────────────────────────────────────────

export interface ServerSnake {
  id: string;
  name: string;
  path: IPathBuffer;
  angle: number;
  prevAngle: number;
  speed: number;
  score: number;
  boosting: boolean;
  alive: boolean;
  isBot: boolean;
  isPlayer: boolean;
  spawnTime: number;
  color: string;
  headColor: string;
  lastBoostDrop: number;
  targetAngle: number;
  spiral: {
    active: boolean;
    startAngle: number;
    theta: number;
    ticksElapsed: number;
    a: number;
    b: number;
    direction: 1 | -1;
  };
  bodyRadius: number;
  skinId: string;
  rarity: SkinRarity;
  /** Server-specific: socket ID for networked players */
  socketId: string;
  /** Server-specific: queued player input */
  input: { targetAngle: number; boosting: boolean };
  /** Server-specific: cached snapshot */
  lastSnapshot: SnakeSnapshot | null;
}

// ─── Kill Event ─────────────────────────────────────────────────────────────

export interface KillEvent {
  killer: string;
  killerName: string;
  victim: string;
  victimName: string;
  score: number;
  timestamp: number;
}

// ─── ArenaRoom ───────────────────────────────────────────────────────────────

export class ArenaRoom {
  id: string;
  snakes: Map<string, ServerSnake> = new Map();
  foods: FoodOrb[] = [];
  starChips: StarChip[] = [];
  tickCount = 0;
  nextFoodId = 0;
  nextStarChipId = 0;
  pendingKills: KillEvent[] = [];
  /** Spatial hashes reused each tick */
  private foodHash: SpatialHash = new SpatialHash(SPATIAL_CELL_SIZE);
  private bodyHash: SpatialHash = new SpatialHash(SPATIAL_CELL_SIZE);

  constructor(id: string) {
    this.id = id;
    this.initArena();
  }

  // ── Initialization ────────────────────────────────────────────────────

  private initArena(): void {
    const now = Date.now();

    // Spawn bots
    for (let i = 0; i < BOT_COUNT; i++) {
      const score = Math.floor(BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN));
      const nameIdx = i % BOT_NAMES.length;
      const nameSuffix = i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : '';
      const pos = this.findSafeSpawn(0, 0);
      const bot = this.createSnake(
        `bot-${i}`, BOT_NAMES[nameIdx] + nameSuffix,
        score, pos.x, pos.y, true, now
      );
      bot.socketId = '';
      bot.input = { targetAngle: bot.angle, boosting: false };
      bot.lastSnapshot = null;
      this.snakes.set(bot.id, bot);
    }

    // Spawn initial food
    this.spawnFoodBatch(FOOD_COUNT_TARGET, 0, 0, INITIAL_SPAWN_RADIUS);
  }

  private createSnake(
    id: string, name: string, startScore: number,
    posX: number, posY: number, isBot: boolean, now: number,
  ): ServerSnake {
    const targetLength = Math.min(Math.floor(START_LENGTH + startScore * GROWTH_RATE), MAX_SNAKE_LENGTH);
    const palette = SNAKE_PALETTES[Math.floor(Math.random() * SNAKE_PALETTES.length)];
    const angle = Math.random() * Math.PI * 2;

    const path = new PathBuffer(Math.max(targetLength * 2, 100));
    for (let i = 0; i < targetLength; i++) {
      const x = posX - Math.cos(angle) * i * SEGMENT_SPACING;
      const y = posY - Math.sin(angle) * i * SEGMENT_SPACING;
      path.prepend(x, y);
    }

    return {
      id, name, path, angle, prevAngle: angle,
      speed: BASE_SPEED, score: startScore,
      boosting: false, alive: true, isBot, isPlayer: !isBot,
      spawnTime: now,
      color: palette[0], headColor: palette[1],
      lastBoostDrop: 0, targetAngle: angle,
      spiral: { active: false, startAngle: 0, theta: 0, ticksElapsed: 0, a: SPIRAL_A, b: SPIRAL_B, direction: 1 },
      bodyRadius: SNAKE_RADIUS,
      skinId: 'skin-default', rarity: 'common' as SkinRarity,
      socketId: '', input: { targetAngle: angle, boosting: false }, lastSnapshot: null,
    };
  }

  private findSafeSpawn(nearX: number, nearY: number): { x: number; y: number } {
    const spawnRadius = INITIAL_SPAWN_RADIUS;
    for (let attempt = 0; attempt < SAFE_SPAWN_ATTEMPTS; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const d = 200 + Math.random() * (spawnRadius - 200);
      const x = nearX + Math.cos(a) * d;
      const y = nearY + Math.sin(a) * d;

      let safe = true;
      const safeDistSq = SAFE_SPAWN_DIST * SAFE_SPAWN_DIST;
      for (const [, snake] of this.snakes) {
        if (!snake.alive) continue;
        const dx = snake.path.headX - x;
        const dy = snake.path.headY - y;
        if (dx * dx + dy * dy < safeDistSq) {
          safe = false;
          break;
        }
      }
      if (safe) return { x, y };
    }
    const a = Math.random() * Math.PI * 2;
    return { x: nearX + Math.cos(a) * spawnRadius, y: nearY + Math.sin(a) * spawnRadius };
  }

  // ── Player Management ─────────────────────────────────────────────────

  addPlayer(socketId: string, name: string, skinId: string = 'skin-default', rarity: SkinRarity = 'common'): ServerSnake {
    const now = Date.now();
    const pos = this.findSafeSpawn(0, 0);
    const snake = this.createSnake(socketId, name, 0, pos.x, pos.y, false, now);
    snake.socketId = socketId;
    snake.skinId = skinId;
    snake.rarity = rarity;
    snake.isPlayer = true;
    snake.input = { targetAngle: snake.angle, boosting: false };
    snake.lastSnapshot = null;
    this.snakes.set(snake.id, snake);
    return snake;
  }

  removePlayer(socketId: string): KillEvent | null {
    const snake = this.snakes.get(socketId);
    if (!snake) return null;
    if (snake.alive) {
      this.killSnake(snake, 'arena', 'Arena');
    }
    this.snakes.delete(socketId);
    return this.pendingKills.length > 0 ? this.pendingKills.pop() ?? null : null;
  }

  handleInput(socketId: string, targetAngle: number, boosting: boolean): void {
    const snake = this.snakes.get(socketId);
    if (!snake || !snake.alive) return;
    snake.input.targetAngle = targetAngle;
    snake.input.boosting = boosting;
  }

  // ── Main Game Tick ────────────────────────────────────────────────────

  tick(): void {
    this.tickCount++;
    const now = Date.now();
    this.pendingKills = [];

    // 1. Move all snakes (bots + players)
    for (const [, snake] of this.snakes) {
      if (!snake.alive) continue;
      if (snake.isBot) {
        const botAngle = getBotTarget(snake, this.snakes, this.foods);
        this.moveSnake(snake, botAngle, false, now);
      } else {
        // Players use their queued input
        this.moveSnake(snake, snake.input.targetAngle, snake.input.boosting, now);
      }
    }

    // 2. Food eating
    this.checkFoodEating(now);

    // 3. Star chip collection
    this.checkStarChips(now);

    // 4. Spawn food to maintain target
    if (this.foods.length < FOOD_COUNT_TARGET) {
      const deficit = FOOD_COUNT_TARGET - this.foods.length;
      let cx = 0, cy = 0;
      const alive: ServerSnake[] = [];
      for (const [, s] of this.snakes) {
        if (s.alive && s.path.length > 0) alive.push(s);
      }
      if (alive.length > 0) {
        const rs = alive[Math.floor(Math.random() * alive.length)];
        cx = rs.path.headX;
        cy = rs.path.headY;
      }
      this.spawnFoodBatch(Math.min(deficit, FOOD_RESPAWN_BATCH), cx, cy, FOOD_SPAWN_AREA_RADIUS);
    }

    // 5. Collisions
    this.checkCollisions(now);

    // 8. Respawn dead bots
    this.respawnBots(now);

    // 9. Arena boundary enforcement
    this.enforceArenaBounds(now);
  }

  // ── Snake Movement ────────────────────────────────────────────────────

  private moveSnake(snake: ServerSnake, targetAngle: number, wantBoost: boolean, now: number): void {
    snake.prevAngle = snake.angle;

    // Angle computation
    let diff = targetAngle - snake.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    if (snake.spiral.active) {
      // Spiral movement
      const spiral = snake.spiral;
      const r = spiral.a * Math.exp(spiral.b * spiral.theta);
      const safeR = Math.max(r, 0.1);

      let dTheta = snake.speed / safeR;
      dTheta = Math.max(0.01, Math.min(dTheta, MAX_TURN_RATE * 2));

      spiral.theta += dTheta;
      snake.angle = spiral.startAngle + spiral.direction * spiral.theta;

      if (snake.angle > Math.PI) snake.angle -= 2 * Math.PI;
      else if (snake.angle < -Math.PI) snake.angle += 2 * Math.PI;

      diff = snake.angle - snake.prevAngle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      spiral.ticksElapsed++;
      if (Math.abs(diff) < MAX_SPIRAL_ANGLE_DELTA && spiral.ticksElapsed > SPIRAL_DETECT_WINDOW) {
        spiral.active = false;
      }
    } else {
      // Normal linear turning
      const maxTurn = snake.isBot ? BOT_MAX_TURN_RATE : MAX_TURN_RATE;
      if (Math.abs(diff) <= maxTurn) {
        snake.angle = targetAngle;
      } else {
        snake.angle += Math.sign(diff) * maxTurn;
      }

      if (snake.angle > Math.PI) snake.angle -= 2 * Math.PI;
      else if (snake.angle < -Math.PI) snake.angle += 2 * Math.PI;

      // Spiral turn detection
      this.updateSpiralTurn(snake, diff);
    }

    // Boost eligibility
    const canBoost = wantBoost &&
      snake.score > BOOST_MIN_SCORE &&
      snake.path.length > BOOST_MIN_BODY;

    snake.boosting = canBoost;
    snake.speed = canBoost ? BOOST_SPEED : BASE_SPEED;

    // Move head forward
    const headX = snake.path.headX + Math.cos(snake.angle) * snake.speed;
    const headY = snake.path.headY + Math.sin(snake.angle) * snake.speed;
    snake.path.prepend(headX, headY);

    // Target length from score
    const targetLength = Math.min(Math.floor(START_LENGTH + snake.score * GROWTH_RATE), MAX_SNAKE_LENGTH);

    // Boost: drop food from tail
    if (canBoost && now - snake.lastBoostDrop >= BOOST_DROP_INTERVAL) {
      snake.lastBoostDrop = now;
      const tailX = snake.path.tailX;
      const tailY = snake.path.tailY;
      this.foods.push({
        id: this.nextFoodId++, x: tailX, y: tailY,
        size: 'small', value: 1, radius: FOOD_RADII[0],
        color: FOOD_COLORS[0], glowColor: FOOD_GLOW_COLORS[0],
      });
      if (snake.path.length > 1) snake.path.pop();
    }

    // Trim segments to target length
    while (snake.path.length > targetLength) {
      snake.path.pop();
    }

    snake.bodyRadius = SNAKE_RADIUS;
  }

  private updateSpiralTurn(snake: ServerSnake, angleDelta: number): void {
    const absDelta = Math.abs(angleDelta);
    const spiral = snake.spiral;

    if (!spiral.active) {
      if (absDelta > TIGHT_TURN_THRESHOLD) {
        spiral.active = true;
        spiral.startAngle = snake.prevAngle;
        spiral.theta = 0;
        spiral.ticksElapsed = 0;
        spiral.direction = angleDelta > 0 ? 1 : -1;
      }
    } else {
      spiral.ticksElapsed++;
      spiral.theta += absDelta;
      if (absDelta < MAX_SPIRAL_ANGLE_DELTA && spiral.ticksElapsed > SPIRAL_DETECT_WINDOW) {
        spiral.active = false;
      }
    }
  }

  // ── Star Chips ────────────────────────────────────────────────────────

  // Star chips no longer spawned via extraction zone

  private checkStarChips(_now: number): void {
    if (this.starChips.length === 0) return;

    const collected = new Set<number>();

    for (const [, snake] of this.snakes) {
      if (!snake.alive) continue;
      const hx = snake.path.headX;
      const hy = snake.path.headY;

      for (let i = 0; i < this.starChips.length; i++) {
        const chip = this.starChips[i];
        if (collected.has(chip.id)) continue;
        if (distSq(hx, hy, chip.x, chip.y) <= STAR_CHIP_DIST_SQ) {
          collected.add(chip.id);
          snake.score += chip.value;
        }
      }
    }

    if (collected.size > 0) {
      this.starChips = this.starChips.filter(c => !collected.has(c.id));
    }
  }

  // ── Food ───────────────────────────────────────────────────────────────

  private makeFood(x: number, y: number, forceSize?: number): FoodOrb {
    let sizeIndex = 0;
    if (forceSize !== undefined) {
      sizeIndex = forceSize;
    } else {
      const roll = Math.random();
      let cumulative = 0;
      for (let i = 0; i < 3; i++) {
        cumulative += FOOD_SPAWN_WEIGHTS[i];
        if (roll <= cumulative) { sizeIndex = i; break; }
      }
    }

    return {
      id: this.nextFoodId++,
      x, y,
      size: FOOD_SIZES[sizeIndex],
      value: FOOD_VALUES[sizeIndex],
      radius: FOOD_RADII[sizeIndex],
      color: FOOD_COLORS[sizeIndex],
      glowColor: FOOD_GLOW_COLORS[sizeIndex],
    };
  }

  private spawnFoodBatch(count: number, cx: number, cy: number, radius: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * radius;
      this.foods.push(this.makeFood(cx + Math.cos(a) * d, cy + Math.sin(a) * d));
    }
  }

  // ── Food Eating ───────────────────────────────────────────────────────

  private checkFoodEating(now: number): void {
    // Build food spatial hash
    this.foodHash.clear();
    for (let i = 0; i < this.foods.length; i++) {
      const f = this.foods[i];
      this.foodHash.insert({ x: f.x, y: f.y, radius: f.radius, id: f.id } as SpatialEntity);
    }

    const eatenIds = new Set<number>();

    for (const [, snake] of this.snakes) {
      if (!snake.alive) continue;
      const hx = snake.path.headX;
      const hy = snake.path.headY;

      // Spawn protection: players can't eat food for first 4s
      if (!snake.isBot && now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

      const nearby = this.foodHash.query(hx, hy, SNAKE_RADIUS + 10);
      for (let i = 0; i < nearby.length; i++) {
        const entity = nearby[i];
        const fid = entity.id as number;
        if (eatenIds.has(fid)) continue;

        if (distSq(hx, hy, entity.x, entity.y) <= EAT_DIST_SQ) {
          eatenIds.add(fid);
          snake.score += (this.foods.find(f => f.id === fid))?.value ?? 1;
        }
      }
    }

    if (eatenIds.size > 0) {
      this.foods = this.foods.filter(f => !eatenIds.has(f.id));
    }
  }

  // ── Collisions ───────────────────────────────────────────────────────

  private checkCollisions(now: number): void {
    // Build body segment spatial hash
    this.bodyHash.clear();
    const bodySegMap = new Map<string, string>();

    for (const [, snake] of this.snakes) {
      if (!snake.alive) continue;
      const len = snake.path.length;
      for (let i = NECK_PROTECTION; i < len; i++) {
        const sx = snake.path.getX(i);
        const sy = snake.path.getY(i);
        const key = `${snake.id}:${i}`;
        bodySegMap.set(key, snake.id);
        this.bodyHash.insert({ x: sx, y: sy, radius: SNAKE_RADIUS, id: key } as SpatialEntity);
      }
    }

    const deadSnakes = new Set<string>();

    // Head-to-body collision
    for (const [, snake] of this.snakes) {
      if (!snake.alive || deadSnakes.has(snake.id)) continue;
      const hx = snake.path.headX;
      const hy = snake.path.headY;

      // Spawn protection
      if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

      const nearby = this.bodyHash.query(hx, hy, SNAKE_RADIUS * 2);
      for (let i = 0; i < nearby.length; i++) {
        const entity = nearby[i];
        const key = entity.id as string;
        const otherSnakeId = bodySegMap.get(key);
        if (!otherSnakeId || otherSnakeId === snake.id) continue;

        const otherSnake = this.snakes.get(otherSnakeId);
        if (!otherSnake || !otherSnake.alive) continue;

        if (distSq(hx, hy, entity.x, entity.y) <= COLLISION_DIST_SQ) {
          deadSnakes.add(snake.id);
          // Record who killed whom
          this.killSnake(snake, otherSnakeId, otherSnake.name);
          break;
        }
      }
    }

    // Head-on-head collision
    const aliveArr: ServerSnake[] = [];
    for (const [, s] of this.snakes) {
      if (s.alive && !deadSnakes.has(s.id) && s.path.length > 0) {
        aliveArr.push(s);
      }
    }

    for (let i = 0; i < aliveArr.length; i++) {
      const a = aliveArr[i];
      if (deadSnakes.has(a.id)) continue;

      for (let j = i + 1; j < aliveArr.length; j++) {
        const b = aliveArr[j];
        if (deadSnakes.has(b.id)) continue;

        // Spawn protection
        if (now - a.spawnTime < SPAWN_PROTECTION_MS) continue;
        if (now - b.spawnTime < SPAWN_PROTECTION_MS) continue;

        const dx = a.path.headX - b.path.headX;
        const dy = a.path.headY - b.path.headY;
        if (dx * dx + dy * dy > COLLISION_DIST_SQ) continue;

        // Head-on-head: resolve by length + boost
        const lenA = a.path.length;
        const lenB = b.path.length;

        if (lenA > lenB) {
          if (HEAD_ON_HEAD_BOOST_WINS && b.boosting && !a.boosting) {
            deadSnakes.add(a.id);
            this.killSnake(a, b.id, b.name);
          } else {
            deadSnakes.add(b.id);
            this.killSnake(b, a.id, a.name);
          }
        } else if (lenB > lenA) {
          if (HEAD_ON_HEAD_BOOST_WINS && a.boosting && !b.boosting) {
            deadSnakes.add(b.id);
            this.killSnake(b, a.id, a.name);
          } else {
            deadSnakes.add(a.id);
            this.killSnake(a, b.id, b.name);
          }
        } else {
          deadSnakes.add(a.id);
          deadSnakes.add(b.id);
          this.killSnake(a, b.id, b.name);
          this.killSnake(b, a.id, a.name);
        }
      }
    }
  }

  // ── Death & Food Distribution ─────────────────────────────────────────

  private killSnake(snake: ServerSnake, killerId: string, killerName: string): void {
    snake.alive = false;

    const score = snake.score;
    const largeCount = Math.floor(score / DEATH_FOOD_LARGE_DIVISOR);
    let remainder = score - largeCount * DEATH_FOOD_LARGE_DIVISOR;
    const medCount = Math.floor(remainder / DEATH_FOOD_MEDIUM_DIVISOR);
    const smallCount = remainder - medCount * DEATH_FOOD_MEDIUM_DIVISOR;

    const totalFood = largeCount + medCount + smallCount;

    // Record kill event
    this.pendingKills.push({
      killer: killerId,
      killerName,
      victim: snake.id,
      victimName: snake.name,
      score,
      timestamp: Date.now(),
    });

    if (totalFood === 0) {
      if (snake.isBot) this.snakes.delete(snake.id);
      return;
    }

    // Distribute food along body path
    const segLen = snake.path.length;
    const step = Math.max(1, Math.floor(segLen / totalFood));
    let foodIdx = 0;

    for (let i = 0; i < largeCount; i++) {
      const si = Math.min(foodIdx * step, segLen - 1);
      const ox = (Math.random() - 0.5) * 20;
      const oy = (Math.random() - 0.5) * 20;
      this.foods.push({
        id: this.nextFoodId++,
        x: snake.path.getX(si) + ox, y: snake.path.getY(si) + oy,
        size: 'large', value: FOOD_VALUES[2], radius: FOOD_RADII[2],
        color: FOOD_COLORS[2], glowColor: FOOD_GLOW_COLORS[2],
      });
      foodIdx++;
    }
    for (let i = 0; i < medCount; i++) {
      const si = Math.min(foodIdx * step, segLen - 1);
      const ox = (Math.random() - 0.5) * 20;
      const oy = (Math.random() - 0.5) * 20;
      this.foods.push({
        id: this.nextFoodId++,
        x: snake.path.getX(si) + ox, y: snake.path.getY(si) + oy,
        size: 'medium', value: FOOD_VALUES[1], radius: FOOD_RADII[1],
        color: FOOD_COLORS[1], glowColor: FOOD_GLOW_COLORS[1],
      });
      foodIdx++;
    }
    for (let i = 0; i < smallCount; i++) {
      const si = Math.min(foodIdx * step, segLen - 1);
      const ox = (Math.random() - 0.5) * 20;
      const oy = (Math.random() - 0.5) * 20;
      this.foods.push({
        id: this.nextFoodId++,
        x: snake.path.getX(si) + ox, y: snake.path.getY(si) + oy,
        size: 'small', value: FOOD_VALUES[0], radius: FOOD_RADII[0],
        color: FOOD_COLORS[0], glowColor: FOOD_GLOW_COLORS[0],
      });
      foodIdx++;
    }

    if (snake.isBot) this.snakes.delete(snake.id);
  }

  // ── Bot Respawn ───────────────────────────────────────────────────────

  private respawnBots(now: number): void {
    let aliveBots = 0;
    for (const [, s] of this.snakes) {
      if (s.alive && s.isBot) aliveBots++;
    }

    const deficit = BOT_COUNT - aliveBots;
    const toRespawn = Math.min(deficit, 3);

    for (let i = 0; i < toRespawn; i++) {
      const score = Math.floor(BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN));
      const nameIdx = (this.tickCount + i) % BOT_NAMES.length;
      const pos = this.findSafeSpawn(0, 0);
      const bot = this.createSnake(
        `bot-${now}-${i}`, BOT_NAMES[nameIdx],
        score, pos.x, pos.y, true, now
      );
      bot.socketId = '';
      bot.input = { targetAngle: bot.angle, boosting: false };
      bot.lastSnapshot = null;
      this.snakes.set(bot.id, bot);
    }
  }

  // ── Arena Boundary Enforcement ────────────────────────────────────────

  private enforceArenaBounds(now: number): void {
    const radiusSq = ARENA_RADIUS * ARENA_RADIUS;
    for (const [, snake] of this.snakes) {
      if (!snake.alive || snake.path.length === 0) continue;
      const hx = snake.path.headX;
      const hy = snake.path.headY;
      const distFromCenter = hx * hx + hy * hy;

      if (distFromCenter > radiusSq) {
        // Snake hit the arena boundary — kill it
        if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;
        this.killSnake(snake, 'boundary', 'Boundary');
      }
    }
  }

  // ── Snapshot Builder ──────────────────────────────────────────────────

  buildSnapshot(): ArenaSnapshot {
    // Collect all alive snakes and sort: player snakes first, then by score desc.
    const aliveSnakes: ServerSnake[] = [];
    for (const [, snake] of this.snakes) {
      if (snake.alive) aliveSnakes.push(snake);
    }
    aliveSnakes.sort((a, b) => {
      // Player snakes always first
      if (a.isPlayer && !b.isPlayer) return -1;
      if (!a.isPlayer && b.isPlayer) return 1;
      return b.score - a.score;
    });

    const cappedSnakes = aliveSnakes.slice(0, MAX_SNAKES_PER_SNAPSHOT);

    // Collect player positions for food downsampling
    const playerPositions: Array<{ x: number; y: number }> = [];
    for (const snake of aliveSnakes) {
      if (snake.isPlayer && snake.path.length > 0) {
        playerPositions.push({ x: snake.path.headX, y: snake.path.headY });
      }
    }

    // Build snake snapshots
    const snakeSnapshots: SnakeSnapshot[] = [];
    for (const snake of cappedSnakes) {
      const snap = this.buildSnakeSnapshot(snake);
      snake.lastSnapshot = snap;
      snakeSnapshots.push(snap);
    }

    // Filter food near players
    const foodRadiusSq = FOOD_DOWNSAMPLE_RADIUS * FOOD_DOWNSAMPLE_RADIUS;
    const filteredFoods: Array<{ id: number; x: number; y: number; size: FoodSize; value: number }> = [];
    for (let i = 0; i < this.foods.length; i++) {
      const f = this.foods[i];
      if (playerPositions.length === 0 || this.nearAnyPlayer(f.x, f.y, playerPositions, foodRadiusSq)) {
        filteredFoods.push({ id: f.id, x: f.x, y: f.y, size: f.size, value: f.value });
      }
    }

    // Star chips
    const starChips = this.starChips.map(c => ({
      id: c.id, x: c.x, y: c.y, value: c.value,
    }));

    return {
      tick: this.tickCount,
      timestamp: Date.now(),
      snakes: snakeSnapshots,
      foods: filteredFoods,
      starChips,
    };
  }

  private buildSnakeSnapshot(snake: ServerSnake): SnakeSnapshot {
    const pathLen = snake.path.length;

    // Downsample body: every BODY_DOWNSAMPLE_INTERVAL-th segment
    const bodyCount = Math.ceil((pathLen - 1) / BODY_DOWNSAMPLE_INTERVAL);
    const bodyX = new Float32Array(bodyCount);
    const bodyY = new Float32Array(bodyCount);

    let bodyIdx = 0;
    for (let i = 1; i < pathLen; i += BODY_DOWNSAMPLE_INTERVAL) {
      bodyX[bodyIdx] = snake.path.getX(i);
      bodyY[bodyIdx] = snake.path.getY(i);
      bodyIdx++;
    }

    // Turn metadata
    let turn: TurnMetadata | undefined;
    if (snake.spiral.active) {
      turn = {
        tick: this.tickCount,
        snakeId: snake.id,
        isSpiral: true,
        startAngle: snake.spiral.startAngle,
        direction: snake.spiral.direction,
        theta: snake.spiral.theta,
        expectedDuration: 0,
      };
    }

    return {
      id: snake.id,
      name: snake.name,
      hx: snake.path.headX,
      hy: snake.path.headY,
      angle: snake.angle,
      length: pathLen,
      score: snake.score,
      alive: snake.alive,
      color: snake.color,
      headColor: snake.headColor,
      bodyRadius: snake.bodyRadius,
      boosting: snake.boosting,
      skinId: snake.skinId,
      rarity: snake.rarity,
      bodyX,
      bodyY,
      bodyLen: bodyIdx,
      turn,
    };
  }

  private nearAnyPlayer(
    x: number, y: number,
    players: ReadonlyArray<{ x: number; y: number }>,
    radiusSq: number,
  ): boolean {
    for (let i = 0; i < players.length; i++) {
      const dx = players[i].x - x;
      const dy = players[i].y - y;
      if (dx * dx + dy * dy <= radiusSq) return true;
    }
    return false;
  }

  // ── Respawn Player ────────────────────────────────────────────────────

  respawnPlayer(socketId: string): ServerSnake | null {
    const old = this.snakes.get(socketId);
    if (old) {
      old.alive = false;
      this.snakes.delete(socketId);
    }

    const now = Date.now();
    const pos = this.findSafeSpawn(0, 0);
    const snake = this.createSnake(socketId, old?.name ?? 'Player', 0, pos.x, pos.y, false, now);
    snake.socketId = socketId;
    snake.isPlayer = true;
    snake.input = { targetAngle: snake.angle, boosting: false };
    snake.lastSnapshot = null;
    if (old) {
      snake.skinId = old.skinId;
      snake.rarity = old.rarity;
    }
    this.snakes.set(snake.id, snake);
    return snake;
  }

  // ── Utility ──────────────────────────────────────────────────────────

  /** Get player count (non-bot alive snakes) */
  get playerCount(): number {
    let count = 0;
    for (const [, s] of this.snakes) {
      if (s.alive && s.isPlayer) count++;
    }
    return count;
  }

  /** Get total alive count */
  get aliveCount(): number {
    let count = 0;
    for (const [, s] of this.snakes) {
      if (s.alive) count++;
    }
    return count;
  }

  /** Check if arena is empty (no players) */
  get isEmpty(): boolean {
    for (const [, s] of this.snakes) {
      if (s.isPlayer) return false;
    }
    return true;
  }
}
