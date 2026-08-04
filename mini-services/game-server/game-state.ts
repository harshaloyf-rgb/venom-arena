// ============================================================================
// Venom Arena — Arena Room (Game State Management)
// Manages snakes, bots, food, stars, extraction, and the main tick loop.
// ============================================================================

import type {
  SnakeState, SnakeIdentity, InputState, FoodOrb, StarChip,
  KillFeedEntry, KillCause, BotAIState, GameSnapshot, SnakeSnapshot,
  MapState, DeathEvent, EmoteType, Vec2,
} from '../../src/lib/snake/types';
import type { SnakeConfig } from '../../src/lib/snake/config';
import { DEFAULT_SNAKE_CONFIG } from '../../src/lib/snake/config';
import { PathBuffer, SnapshotBufferPool } from '../../src/lib/snake/pool';
import {
  tickSnakeMovement, checkAllCollisions, createFoodOrb, calcDeathFood,
  createDeathStars, checkFoodEat, checkStarCollect, createDeathEvent,
  updateMapState, calcBaseMapRadius, calcCommissionRate, calcBankedAmount,
  calcXP, calcNewLevel, normalizeAngle, angleDelta, angleBetween,
  updateCachedRadii, calcVisualRadius, buildTurnMetadata,
  vec2Dist, vec2DistSq,
} from '../../src/lib/snake/engine';
import { SpatialGrid } from './spatial-grid';

// ── Bot name pool ────────────────────────────────────────────────────────────

const BOT_NAMES = [
  'Viper', 'Cobra', 'Mamba', 'Asp', 'Taipan', 'Krait', 'Adder',
  'Boa', 'Python', 'Anaconda', 'Rattler', 'Sidewinder', 'Copperhead',
  'Cottonmouth', 'Kingsnake', 'Racer', 'Garter', 'Corn', 'Milk',
  'Bullsnake', 'Hognose', 'Ribbon', 'GreenSnake', 'Worm', 'Serpent',
];
const BOT_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#9b59b6', '#e91e63', '#ff5722', '#795548', '#607d8b',
];

let botNameIdx = 0;
function nextBotName(): string {
  const name = BOT_NAMES[botNameIdx % BOT_NAMES.length];
  botNameIdx++;
  return name;
}
function randomBotColor(): string {
  return BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomInCircle(cx: number, cy: number, maxR: number, minR: number = 0): Vec2 {
  const angle = Math.random() * Math.PI * 2;
  const r = minR + Math.random() * (maxR - minR);
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

function makeBotIdentity(botId: string): SnakeIdentity {
  const primary = randomBotColor();
  return {
    id: botId,
    name: nextBotName(),
    tag: 'BOT',
    isBot: true,
    skinId: 'default',
    skinPattern: 'solid',
    bodyStyle: 'smooth',
    taperStyle: 'natural',
    hat: 'none',
    shape: 'circle',
    primaryColor: primary,
    secondaryColor: primary,
    trailId: '',
    deathBurstId: '',
    isPlayer: false,
  };
}

function createSnakeState(identity: SnakeIdentity, config: SnakeConfig, map: MapState): SnakeState {
  const spawnRadius = map.baseRadius - 500;
  const pos = randomInCircle(map.center.x, map.center.y, spawnRadius);
  const angle = Math.random() * Math.PI * 2;
  const maxPts = PathBuffer.maxPathPoints(config.maxScore, config.ptsPerSegment, config.segSpacing);
  const path = new PathBuffer(maxPts);
  const startPts = Math.ceil((config.startLength * config.ptsPerSegment) / config.segSpacing);
  path.fillInitial(pos.x, pos.y, angle, startPts, config.segSpacing);

  const snake: SnakeState = {
    identity,
    head: { x: pos.x, y: pos.y },
    angle,
    targetAngle: angle,
    path,
    score: config.startLength,
    boosting: false,
    alive: true,
    spawnProtected: true,
    spawnProtectionFrames: Math.ceil(config.spawnProtectionSeconds * config.tickRateHz),
    carriedChips: 0,
    starsCollected: 0,
    kills: 0,
    extractProgress: 0,
    isExtracting: false,
    extractFramesLeft: 0,
    extractStartAngle: 0,
    activeEmote: null,
    emoteFramesLeft: 0,
    ping: 0,
    commissionRate: 0,
    spiral: null,
    _cachedVisualRadius: 0,
    _cachedCollisionRadius: 0,
  };
  updateCachedRadii(snake, config);
  return snake;
}

// ── Arena Room ───────────────────────────────────────────────────────────────

export class ArenaRoom {
  id: string;
  shardId: number;
  name: string;
  isPractice: boolean;
  rewardMultiplier: number;
  commissionRate: number;
  config: SnakeConfig;

  // State
  snakes: Map<string, SnakeState> = new Map();
  botAIs: Map<string, BotAIState> = new Map();
  food: FoodOrb[] = [];
  stars: StarChip[] = [];
  killFeed: KillFeedEntry[] = [];
  map: MapState;
  spatialGrid: SpatialGrid;

  // Tick
  tickCount = 0;
  realPlayerCount = 0;

  // Socket → snake ID mapping
  socketSnakeMap: Map<string, string> = new Map();
  snakeSocketMap: Map<string, string> = new Map();

  // Player join times (for extraction duration calc)
  playerJoinTimes: Map<string, number> = new Map();

  // Callbacks (set by index.ts)
  onKillFeed?: (entry: KillFeedEntry) => void;
  onPlayerDied?: (socketId: string, data: any) => void;
  onExtractionComplete?: (socketId: string, data: any) => void;

  // Snapshot buffer pool (reuse Float32Arrays across broadcasts)
 private snapshotPool: SnapshotBufferPool;
 private startTime: number;

  constructor(id: string, shardId: number, name: string, isPractice: boolean, rewardMultiplier: number, config?: Partial<SnakeConfig>) {
    this.id = id;
    this.shardId = shardId;
    this.name = name;
    this.isPractice = isPractice;
    this.rewardMultiplier = rewardMultiplier;
    this.config = { ...DEFAULT_SNAKE_CONFIG, ...config };
    this.startTime = Date.now();

    const center = { x: this.config.mapRadius, y: this.config.mapRadius };
    this.map = {
      type: isPractice ? 'infinite' : 'circular_breathing',
      center,
      currentRadius: this.config.mapRadius,
      baseRadius: this.config.mapRadius,
      breathingAmplitude: this.config.breathingAmplitude,
      breathingPeriod: this.config.breathingPeriodSeconds,
      breathingPhase: 0,
    };

    // Spatial grid cell size = max possible collision distance
    const maxCollisionDist = this.config.maxThick * 2 + 20;
    this.spatialGrid = new SpatialGrid(maxCollisionDist, this.config.mapRadius, center.x, center.y);

    // Snapshot buffer pool for ~1000 snakes
    this.snapshotPool = new SnapshotBufferPool(1100, this.config.snapshotMaxPathPoints + 10);

    // Initial food
    this.spawnFood(this.config.foodCount);

    // Spawn bots
    const botCount = isPractice ? Math.min(1000, this.config.botCount) : this.config.botCount;
    this.spawnBots(botCount);
  }

  // ── Bot Management ─────────────────────────────────────────────────────────

  private spawnBots(count: number): void {
    for (let i = 0; i < count; i++) {
      const botId = `bot-${this.id}-${i}`;
      const identity = makeBotIdentity(botId);
      const snake = createSnakeState(identity, this.config, this.map);
      this.snakes.set(botId, snake);
      this.botAIs.set(botId, {
        behavior: 'harvest',
        targetFoodId: null,
        targetSnakeId: null,
        dangerAngle: null,
        inDanger: false,
        decisionCooldown: Math.floor(8 + Math.random() * 8),
        level: 0,
        wanderAngle: Math.random() * Math.PI * 2,
        boostCooldown: 0,
        orbitDir: Math.random() < 0.5 ? 1 : -1,
        encircleTicks: 0,
      });
    }
  }

  private respawnBot(botId: string): void {
 const existing = this.snakes.get(botId);
    if (existing && existing.alive) return;

    const identity = existing ? existing.identity : makeBotIdentity(botId);
 const snake = createSnakeState(identity, this.config, this.map);
    this.snakes.set(botId, snake);

    if (!this.botAIs.has(botId)) {
      this.botAIs.set(botId, {
        behavior: 'harvest',
        targetFoodId: null,
        targetSnakeId: null,
        dangerAngle: null,
        inDanger: false,
        decisionCooldown: Math.floor(8 + Math.random() * 8),
      });
    } else {
      const ai = this.botAIs.get(botId)!;
      ai.behavior = 'harvest';
      ai.targetFoodId = null;
      ai.targetSnakeId = null;
      ai.inDanger = false;
      ai.decisionCooldown = Math.floor(8 + Math.random() * 8);
    }
  }

  // ── Food Management ────────────────────────────────────────────────────────

  private foodIdCounter = 0;

  private spawnFood(count: number): void {
    const r = this.map.baseRadius - 50;
    for (let i = 0; i < count; i++) {
      const pos = randomInCircle(this.map.center.x, this.map.center.y, r);
      const orb = createFoodOrb(`food-${this.id}-${this.foodIdCounter++}`, pos.x, pos.y, this.config);
      this.food.push(orb);
    }
  }

  // ── Player Management ──────────────────────────────────────────────────────

  addPlayer(socketId: string, identity: SnakeIdentity): void {
    const snake = createSnakeState(identity, this.config, this.map);
    this.snakes.set(identity.id, snake);
    this.socketSnakeMap.set(socketId, identity.id);
    this.snakeSocketMap.set(identity.id, socketId);
    this.playerJoinTimes.set(socketId, Date.now());
    this.recountRealPlayers();
  }

  removePlayer(socketId: string): void {
    const snakeId = this.socketSnakeMap.get(socketId);
    if (!snakeId) return;

    const snake = this.snakes.get(snakeId);
    if (snake && snake.alive) {
      // Drop food and stars on disconnect
      const deathEvent = createDeathEvent(snake, null, 'wall', this.config);
      this.food.push(...deathEvent.droppedFood);
      this.stars.push(...deathEvent.droppedStars);
    }

    this.snakes.delete(snakeId);
    this.socketSnakeMap.delete(socketId);
    this.snakeSocketMap.delete(snakeId);
    this.playerJoinTimes.delete(socketId);
    this.recountRealPlayers();
  }

  handleInput(socketId: string, input: InputState): void {
    const snakeId = this.socketSnakeMap.get(socketId);
    if (!snakeId) return;
    // Store input for next tick — handled in tick() via stored target
    const snake = this.snakes.get(snakeId);
    if (!snake || !snake.alive) return;
    snake.targetAngle = input.targetAngle;
    snake.boosting = input.boosting;
  }

  handleEmote(socketId: string, emoteKey: number): void {
    const snakeId = this.socketSnakeMap.get(socketId);
    if (!snakeId) return;
    const snake = this.snakes.get(snakeId);
    if (!snake || !snake.alive) return;
    const emoteMap: Record<number, EmoteType> = { 1: 'gg', 2: 'target', 3: 'flee', 4: 'ripped', 5: 'extracting' };
    const emote = emoteMap[emoteKey];
    if (emote) {
      snake.activeEmote = emote;
      snake.emoteFramesLeft = 120;
    }
  }

  private recountRealPlayers(): void {
    let count = 0;
    for (const [, snake] of this.snakes) {
      if (!snake.identity.isBot && snake.alive) count++;
    }
    this.realPlayerCount = count;
    this.commissionRate = this.isPractice ? 0 : calcCommissionRate(count);

    // Update commission on all snakes
    for (const [, snake] of this.snakes) {
      snake.commissionRate = this.commissionRate;
    }
  }

  // ── Bot AI ─────────────────────────────────────────────────────────────────

  private tickBotAI(snake: SnakeState, ai: BotAIState): InputState {
    if (ai.decisionCooldown > 0) {
      ai.decisionCooldown--;
      return { targetAngle: snake.targetAngle, boosting: false, extracting: false, emoteKey: null };
    }

    ai.decisionCooldown = Math.floor(8 + Math.random() * 8);

    // Self-destruct mode
    if (snake.score >= this.config.botSelfDestructThreshold) {
      ai.behavior = 'self_destruct';
    }

    let targetAngle = snake.angle;
    let boosting = false;

    if (ai.behavior === 'self_destruct') {
      // Navigate toward wall, never boost
      const dx = this.map.center.x - snake.head.x;
      const dy = this.map.center.y - snake.head.y;
      // Go AWAY from center → toward wall
      targetAngle = Math.atan2(-dy, -dx);
      return { targetAngle, boosting: false, extracting: false, emoteKey: null };
    }

    // ── Harvest mode ──

    // 1. Check for danger from nearby snakes (predictive 8 ticks ahead)
    let inDanger = false;
    let dangerAngle: number | null = null;
    const nearIds = this.spatialGrid.queryNearby(snake.head.x, snake.head.y, this.config.botEvadeRadius);

    for (const id of nearIds) {
      if (id === snake.identity.id) continue;
      const other = this.snakes.get(id);
      if (!other || !other.alive || other.spawnProtected) continue;

      // Predict other head position 8 ticks ahead
      const speed = other.boosting ? this.config.boostSpeed : this.config.baseSpeed;
      const predX = other.head.x + Math.cos(other.angle) * speed * 8;
      const predY = other.head.y + Math.sin(other.angle) * speed * 8;

      const dist = vec2Dist(snake.head, { x: predX, y: predY });
      if (dist < this.config.botEvadeRadius * 0.6) {
        inDanger = true;
        dangerAngle = angleBetween(snake.head, { x: predX, y: predY });
        break;
      }
    }

    // 2. Check for body segments (150px range)
    if (!inDanger) {
      for (const id of nearIds) {
        if (id === snake.identity.id) continue;
        const other = this.snakes.get(id);
        if (!other || !other.alive) continue;

        for (let i = 0; i < other.path.length; i += 4) {
          const bx = other.path.getX(i);
          const by = other.path.getY(i);
          const dSq = (snake.head.x - bx) ** 2 + (snake.head.y - by) ** 2;
          if (dSq < 150 * 150) {
            inDanger = true;
            dangerAngle = Math.atan2(by - snake.head.y, bx - snake.head.x);
            break;
          }
        }
        if (inDanger) break;
      }
    }

    // 3. Boundary avoidance
    let boundaryDanger = false;
    if (this.map.type === 'circular_breathing') {
      const dx = snake.head.x - this.map.center.x;
      const dy = snake.head.y - this.map.center.y;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      if (distFromCenter > this.map.currentRadius - 200) {
        boundaryDanger = true;
        // Turn toward center
        targetAngle = Math.atan2(-dy, -dx);
      }
    }

    if (inDanger && dangerAngle !== null) {
      // Turn away from danger
      targetAngle = dangerAngle + Math.PI;
    } else if (!boundaryDanger) {
      // 4. Seek nearest food
      let bestDist = Infinity;
      let bestAngle = snake.angle;
      for (let i = 0; i < this.food.length; i++) {
        const f = this.food[i];
        const dSq = (snake.head.x - f.x) ** 2 + (snake.head.y - f.y) ** 2;
        if (dSq < bestDist && dSq < this.config.botFoodScanRadius ** 2) {
          bestDist = dSq;
          bestAngle = Math.atan2(f.y - snake.head.y, f.x - snake.head.x);
        }
      }
      targetAngle = bestAngle;
    }

    ai.inDanger = inDanger;
    ai.dangerAngle = dangerAngle;

    return { targetAngle, boosting, extracting: false, emoteKey: null };
  }

  // ── Main Tick ──────────────────────────────────────────────────────────────

  tick(): void {
    this.tickCount++;
    const cfg = this.config;
    const now = Date.now();
    const elapsedSec = (now - this.startTime) / 1000;

    // 1. Update map breathing
    if (this.map.type === 'circular_breathing') {
      const phase = (elapsedSec / cfg.breathingPeriodSeconds) * Math.PI * 2;
      this.map.currentRadius = this.map.baseRadius + Math.sin(phase) * cfg.breathingAmplitude;
      this.map.breathingPhase = phase;
    }

    // 2. Move all snakes
    const allSnakeArr = Array.from(this.snakes.values());
    const deadThisTick: { snake: SnakeState; cause: KillCause; killerId: string | null }[] = [];

    for (const snake of allSnakeArr) {
      if (!snake.alive) continue;

      let input: InputState;
      if (snake.identity.isBot) {
        const ai = this.botAIs.get(snake.identity.id);
        input = ai ? this.tickBotAI(snake, ai) : { targetAngle: snake.angle, boosting: false, extracting: false, emoteKey: null };
      } else {
        input = {
          targetAngle: snake.targetAngle,
          boosting: snake.boosting,
          extracting: snake.isExtracting,
          emoteKey: null,
        };
      }

      tickSnakeMovement(snake, input, cfg, this.tickCount);
    }

    // 3. Rebuild spatial grid
    this.spatialGrid.rebuild(this.snakes);

    // 4. Collision detection (using spatial grid for optimization)
    for (const snake of allSnakeArr) {
      if (!snake.alive) continue;

      // Use spatial grid to get nearby candidates, then check
      const nearIds = this.spatialGrid.queryNearby(
        snake.head.x, snake.head.y,
        cfg.maxThick * 2 + 20,
      );

      // Build candidate array (only nearby alive snakes)
      const candidates: SnakeState[] = [];
      for (const id of nearIds) {
        if (id === snake.identity.id) continue;
        const other = this.snakes.get(id);
        if (other && other.alive) candidates.push(other);
      }

      const result = checkAllCollisions(snake, candidates, cfg, this.map);
      if (result.type !== 'none') {
        const cause: KillCause = result.type === 'boundary' ? 'boundary'
          : result.type === 'head_on_head' ? 'head_on' : 'head_on';
        deadThisTick.push({ snake, cause, killerId: result.killerId });
      }
    }

    // 5. Process deaths
    for (const { snake, cause, killerId } of deadThisTick) {
      snake.alive = false;

      const deathEvent = createDeathEvent(snake, killerId, cause, cfg);

      // Drop food and stars
      this.food.push(...deathEvent.droppedFood);
      this.stars.push(...deathEvent.droppedStars);

      // Kill feed
      const killerSnake = killerId ? this.snakes.get(killerId) : null;
      const entry: KillFeedEntry = {
        id: `kf-${this.tickCount}-${snake.identity.id}`,
        victimId: snake.identity.id,
        victimName: snake.identity.name,
        victimIsBot: snake.identity.isBot,
        killerId: killerId,
        killerName: killerSnake?.identity.name ?? null,
        killerIsBot: killerSnake?.identity.isBot ?? false,
        cause,
        timestamp: now,
      };
      this.killFeed.push(entry);
      this.onKillFeed?.(entry);

      // Credit kill to killer
      if (killerSnake && killerId !== snake.identity.id) {
        killerSnake.kills++;
      }

      // Emit player_died for real players
      if (!snake.identity.isBot) {
        const socketId = this.snakeSocketMap.get(snake.identity.id);
        if (socketId) {
          this.onPlayerDied?.(socketId, {
            killerId,
            killerName: killerSnake?.identity.name ?? null,
            killerTag: killerSnake?.identity.tag ?? null,
            killerIsBot: killerSnake?.identity.isBot ?? false,
            cause,
            score: snake.score,
            kills: snake.kills,
            carriedChips: snake.carriedChips,
          });
        }
      }

      // Mark bot for respawn
      if (snake.identity.isBot) {
        const ai = this.botAIs.get(snake.identity.id);
        if (ai) ai.decisionCooldown = cfg.botRespawnDelay;
      }
    }

    // 6. Food eating
    for (const snake of allSnakeArr) {
      if (!snake.alive) continue;
      for (let i = this.food.length - 1; i >= 0; i--) {
        if (checkFoodEat(snake, this.food[i], cfg)) {
          snake.score = Math.min(cfg.maxScore, snake.score + this.food[i].value * cfg.scorePerPt);
          updateCachedRadii(snake, cfg);
          this.food.splice(i, 1);
        }
      }
    }

    // 7. Star collection (real players only)
    if (!this.isPractice) {
      for (const snake of allSnakeArr) {
        if (!snake.alive || snake.identity.isBot) continue;
        for (let i = this.stars.length - 1; i >= 0; i--) {
          if (checkStarCollect(snake, this.stars[i], cfg)) {
            snake.carriedChips += this.stars[i].value;
            snake.starsCollected++;
            this.stars.splice(i, 1);
          }
        }
      }
    }

    // 8. Extraction (real players only, online only)
    if (!this.isPractice) {
      for (const [socketId, snakeId] of this.socketSnakeMap) {
        const snake = this.snakes.get(snakeId);
        if (!snake || !snake.alive) continue;

        if (snake.isExtracting) {
          // Check if direction changed
          if (Math.abs(angleDelta(snake.angle, snake.extractStartAngle)) > 0.3) {
            // Direction changed — cancel extraction
            snake.isExtracting = false;
            snake.extractProgress = 0;
            snake.extractFramesLeft = 0;
            continue;
          }

          snake.extractFramesLeft--;
          snake.extractProgress = 1 - (snake.extractFramesLeft / (cfg.extractSeconds * cfg.tickRateHz));

          if (snake.extractFramesLeft <= 0) {
            // Extraction complete!
            const chipsExtracted = snake.carriedChips;
            const commission = Math.floor(chipsExtracted * this.commissionRate);
            const bankedAmount = calcBankedAmount(chipsExtracted, this.commissionRate);
            const joinTime = this.playerJoinTimes.get(socketId) ?? now;
            const durationSeconds = Math.floor((now - joinTime) / 1000);
            const xpGained = calcXP(snake.score, snake.kills, this.rewardMultiplier, false);
            const newLevel = calcNewLevel(xpGained); // server doesn't know total XP, approximate

            snake.alive = false;
            snake.isExtracting = false;

            this.onExtractionComplete?.(socketId, {
              chipsExtracted,
              commission,
              bankedAmount,
              xpGained,
              newLevel,
              newBankedChips: bankedAmount,
              score: snake.score,
              kills: snake.kills,
              durationSeconds,
            });
          }
        }
      }
    }

    // 9. Respawn dead bots
    for (const [botId, ai] of this.botAIs) {
      const snake = this.snakes.get(botId);
      if (!snake || snake.alive) continue;
      if (ai.decisionCooldown > 0) {
        ai.decisionCooldown--;
        continue;
      }
      this.respawnBot(botId);
    }

    // 10. Replenish food
    const targetFood = cfg.foodCount;
    if (this.food.length < targetFood) {
      this.spawnFood(Math.min(20, targetFood - this.food.length));
    }

    // 11. Clean old kill feed (>10s)
    const cutoff = now - 10000;
    while (this.killFeed.length > 0 && this.killFeed[0].timestamp < cutoff) {
      this.killFeed.shift();
    }
  }

  /** Handle extraction toggle from client */
  handleExtractionToggle(socketId: string, extracting: boolean): void {
    if (this.isPractice) return;
    const snakeId = this.socketSnakeMap.get(socketId);
    if (!snakeId) return;
    const snake = this.snakes.get(snakeId);
    if (!snake || !snake.alive) return;

    if (extracting && !snake.isExtracting && snake.carriedChips > 0) {
      snake.isExtracting = true;
      snake.extractStartAngle = snake.angle;
      snake.extractFramesLeft = Math.ceil(this.config.extractSeconds * this.config.tickRateHz);
      snake.extractProgress = 0;
      snake.activeEmote = 'extracting';
      snake.emoteFramesLeft = Math.ceil(this.config.extractSeconds * this.config.tickRateHz);
    } else if (!extracting && snake.isExtracting) {
      snake.isExtracting = false;
      snake.extractProgress = 0;
      snake.extractFramesLeft = 0;
    }
  }

  // ── Snapshot Generation ────────────────────────────────────────────────────

  getSnapshot(playerId: string): GameSnapshot {
    this.snapshotPool.resetIndex();
    const cfg = this.config;
    const maxPts = cfg.snapshotMaxPathPoints;

    const snakeSnaps: SnakeSnapshot[] = [];
    const allSnakes = Array.from(this.snakes.values());

    // Sort: player first, then by score descending
    allSnakes.sort((a, b) => {
      if (a.identity.id === playerId) return -1;
      if (b.identity.id === playerId) return 1;
      return b.score - a.score;
    });

    let playerRank = 1;
    let realIdx = 0;
    for (const snake of allSnakes) {
      if (!snake.identity.isBot && snake.alive) realIdx++;
      if (snake.identity.id === playerId) {
        playerRank = realIdx;
        break;
      }
    }

    for (const snake of allSnakes) {
      if (!snake.alive && snake.identity.isBot) continue;

      // Downsample path
      const buf = this.snapshotPool.acquire();
      const count = snake.path.downsample(buf.x, buf.y, maxPts);
      const path: Vec2[] = [];
      for (let i = 0; i < count; i++) {
        path.push({ x: buf.x[i], y: buf.y[i] });
      }

      const snap: SnakeSnapshot = {
        id: snake.identity.id,
        name: snake.identity.name,
        tag: snake.identity.tag,
        isBot: snake.identity.isBot,
        isPlayer: snake.identity.id === playerId,
        path,
        score: snake.score,
        alive: snake.alive,
        boosting: snake.boosting,
        angle: snake.angle,
        skinId: snake.identity.skinId,
        skinPattern: snake.identity.skinPattern,
        bodyStyle: snake.identity.bodyStyle,
        taperStyle: snake.identity.taperStyle,
        hat: snake.identity.hat,
        shape: snake.identity.shape,
        primaryColor: snake.identity.primaryColor,
        secondaryColor: snake.identity.secondaryColor,
        carriedChips: snake.carriedChips,
        kills: snake.kills,
        activeEmote: snake.activeEmote,
        emoteFramesLeft: snake.emoteFramesLeft,
        spawnProtected: snake.spawnProtected,
        commissionRate: snake.commissionRate,
        turnMeta: snake.identity.id === playerId
          ? buildTurnMetadata(snake, this.tickCount)
          : null,
        skinRarity: snake.identity.skinRarity,
        visualRadius: snake._cachedVisualRadius,
      };
      snakeSnaps.push(snap);
    }

    // Only include food near the player (within viewport + margin)
    const playerSnake = this.snakes.get(playerId);
    const viewRange = playerSnake ? 2000 : this.config.mapRadius;
    const px = playerSnake?.head.x ?? this.map.center.x;
    const py = playerSnake?.head.y ?? this.map.center.y;
    const viewRangeSq = viewRange * viewRange;

    const nearbyFood = this.food.filter(f => {
      const dSq = (f.x - px) ** 2 + (f.y - py) ** 2;
      return dSq < viewRangeSq;
    });

    const nearbyStars = this.isPractice ? [] : this.stars.filter(s => {
      const dSq = (s.x - px) ** 2 + (s.y - py) ** 2;
      return dSq < viewRangeSq;
    });

    // Count bots alive
    let botCount = 0;
    for (const [, s] of this.snakes) {
      if (s.alive && s.identity.isBot) botCount++;
    }

    return {
      snakes: snakeSnaps,
      food: nearbyFood,
      stars: nearbyStars,
      killFeed: this.killFeed.slice(-10),
      map: {
        center: this.map.center,
        currentRadius: this.map.currentRadius,
      },
      playerExtractProgress: playerSnake?.isExtracting ? playerSnake.extractProgress : null,
      tick: this.tickCount,
      playerRank,
      realPlayerCount: this.realPlayerCount,
      botCount,
      starsInArena: this.stars.length,
    };
  }
}
