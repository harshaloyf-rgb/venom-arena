'use client';

import type {
  SnakeState, SnakeIdentity, FoodOrb, MapState,
  InputState, BotAIState, KillFeedEntry, DeathEvent, GamePhase,
  EndScreenState, KillCause,
} from '@/lib/snake/types';
import { DEFAULT_SNAKE_CONFIG, type SnakeConfig } from '@/lib/snake/config';
import {
  vec2, vec2Dist, vec2Sub, angleBetween,
  tickSnakeMovement, updateCachedRadii,
  checkAllCollisions, checkFoodEat, createFoodOrb,
  createDeathEvent, calcVisualRadius, calcCollisionRadius,
  setEmote,
} from '@/lib/snake/engine';
import { PathBuffer } from '@/lib/snake/pool';

// ── Bot Name Generator ─────────────────────────────────────────────────────

const BOT_NAMES = [
  'Viper', 'Cobra', 'Mamba', 'Python', 'Rattler', 'Taipan', 'Krait', 'Adder',
  'Asp', 'Boa', 'Anaconda', 'Sidewinder', 'Basilisk', 'Hydra', 'Serpent',
  'Naga', 'Ouroboros', 'Jormungandr', 'Quetzal', 'Lamia', 'Apep', 'Wadjet',
  'Glycon', 'Nehebkau', 'Apophis', 'Meretseger', 'Renenutet', 'Denwen',
  'Venom', 'Toxin', 'Fang', 'Slither', 'Coil', 'Strike', 'Nestor',
];

let botNameIdx = 0;
function nextBotName(): string {
  const name = BOT_NAMES[botNameIdx % BOT_NAMES.length];
  botNameIdx++;
  return name;
}

function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  // Convert HSL to hex so atlas rendering doesn't break
  const s = 0.7, l = 0.55;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, c)));
  };
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return '#' + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}

// ── Offline Engine Class ─────────────────────────────────────────────────────

export class OfflineEngine {
  // State
  snakes: SnakeState[] = [];
  food: FoodOrb[] = [];
  killFeed: KillFeedEntry[] = [];
  map: MapState;
  config: SnakeConfig;

  // Player
  playerId: string;
  playerAlive: boolean = true;
  playerKills: number = 0;
  playerScore: number = 0;
  matchStartTime: number = 0;
  frameCount: number = 0;

  // Bots
  botAIStates: Map<string, BotAIState> = new Map();
  botRespawnTimers: Map<string, number> = new Map();

  // Particles
  particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }> = [];

  // Game phase
  phase: GamePhase = 'playing';
  endState: EndScreenState | null = null;
  deathEvent: DeathEvent | null = null;

  // Tick accumulator — decouples simulation from render rate
  private tickAccumulator: number = 0;
  private lastTickTime: number = 0;

  // Callbacks
  onDeath?: (endState: EndScreenState) => void;
  onKillFeed?: (entry: KillFeedEntry) => void;

  constructor(
    private playerIdentity: SnakeIdentity,
    config?: Partial<SnakeConfig>,
    botCount: number = 1000,
  ) {
    this.config = { ...DEFAULT_SNAKE_CONFIG, ...config };
    this.playerId = playerIdentity.id;
    this.map = {
      type: 'infinite',
      center: vec2(4000, 4000),
      currentRadius: Infinity,
      baseRadius: Infinity,
      breathingAmplitude: 0,
      breathingPeriod: 0,
      breathingPhase: 0,
    };

    // Spawn player
    const playerSnake = this.createSnake(playerIdentity, 4000, 4000);
    this.snakes.push(playerSnake);

    // Spawn bots
    for (let i = 0; i < botCount; i++) {
      this.spawnBot();
    }

    // Spawn food
    this.spawnInitialFood();

    this.matchStartTime = Date.now();
  }

  // ── Snake Creation ────────────────────────────────────────────────────────

  private createSnake(
    identity: SnakeIdentity,
    x: number,
    y: number,
    score?: number,
  ): SnakeState {
    const s = score ?? this.config.startLength;
    const angle = Math.random() * Math.PI * 2;

    const maxPts = PathBuffer.maxPathPoints(this.config.maxScore, this.config.ptsPerSegment, this.config.segSpacing);
    const path = new PathBuffer(maxPts);
    const initialCount = Math.ceil((s * this.config.ptsPerSegment) / this.config.segSpacing);
    path.fillInitial(x, y, angle, initialCount, this.config.segSpacing);

    const vr = calcVisualRadius(s, this.config);
    const cr = calcCollisionRadius(vr, this.config);

    return {
      identity,
      head: { x, y },
      angle,
      targetAngle: angle,
      path,
      score: s,
      boosting: false,
      alive: true,
      spawnProtected: true,
      spawnProtectionFrames: Math.floor(this.config.spawnProtectionSeconds * this.config.tickRateHz),
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
      _cachedVisualRadius: vr,
      _cachedCollisionRadius: cr,
    };
  }

  private createBotIdentity(): SnakeIdentity {
    const id = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const startLen = this.config.botMinStartLength +
      Math.random() * (this.config.botMaxStartLength - this.config.botMinStartLength);
    return {
      id,
      name: nextBotName(),
      tag: `#${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
      isBot: true,
      skinId: 'default',
      skinPattern: 'solid',
      bodyStyle: 'smooth',
      taperStyle: 'natural',
      hat: 'none',
      shape: 'circle',
      primaryColor: randomColor(),
      secondaryColor: randomColor(),
      trailId: '',
      deathBurstId: '',
      isPlayer: false,
    };
  }

  private spawnBot() {
    const identity = this.createBotIdentity();
    // Spawn in a ring around center, spread out
    const ang = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 3000;
    const x = 4000 + Math.cos(ang) * dist;
    const y = 4000 + Math.sin(ang) * dist;

    const snake = this.createSnake(identity, x, y);
    this.snakes.push(snake);
    // Assign bot level based on config difficulty
    // Easy: 0-1, Medium: 1-3, Hard: 2-4
    const maxLevel = this.config.botLevelTurnMult.length - 1;
    let botLevel: number;
    const r = Math.random();
    if (r < 0.4) botLevel = 0;        // rookie
    else if (r < 0.65) botLevel = 1;  // scout
    else if (r < 0.82) botLevel = 2;  // hunter
    else if (r < 0.94) botLevel = 3;  // predator
    else botLevel = Math.min(maxLevel, 4); // apex

    this.botAIStates.set(identity.id, {
      behavior: 'harvest',
      targetFoodId: null,
      dangerAngle: null,
      inDanger: false,
      decisionCooldown: 0,
      level: botLevel,
    });
  }

  // ── Food Management ──────────────────────────────────────────────────────

  private spawnInitialFood() {
    for (let i = 0; i < this.config.foodCount; i++) {
      this.spawnOneFood();
    }
  }

  private spawnOneFood() {
    // Spawn in a large area around center
    const x = 4000 + (Math.random() - 0.5) * 12000;
    const y = 4000 + (Math.random() - 0.5) * 12000;
    const id = `food-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.food.push(createFoodOrb(id, x, y, this.config));
  }

  // ── Main Tick ─────────────────────────────────────────────────────────────

  /**
   * Advance simulation by deltaMs milliseconds.
   * Uses a tick accumulator to run the simulation at config.tickRateHz,
   * decoupled from the render framerate (typically 60fps).
   */
  tick(input: InputState, deltaMs: number = 16.67): void {
    if (this.phase !== 'playing') return;

    const tickIntervalMs = 1000 / this.config.tickRateHz;
    this.tickAccumulator += deltaMs;

    // Cap to 3 ticks max per frame to avoid spiral-of-death
    const maxTicks = 3;
    let ticksThisFrame = 0;

    while (this.tickAccumulator >= tickIntervalMs && ticksThisFrame < maxTicks) {
      this.tickAccumulator -= tickIntervalMs;
      this.runOneTick(input);
      ticksThisFrame++;
      if (this.phase !== 'playing') break;
    }

    // Prevent accumulator from growing unbounded
    if (this.tickAccumulator > tickIntervalMs * 2) {
      this.tickAccumulator = 0;
    }
  }

  /** Single simulation tick (called by tick accumulator) */
  private runOneTick(input: InputState): void {
    this.frameCount++;

    // Update player
    const player = this.snakes.find(s => s.identity.id === this.playerId);
    if (player && player.alive) {
      this.updatePlayer(player, input);
    }

    // Update bots
    for (const snake of this.snakes) {
      if (snake.identity.isBot && snake.alive) {
        this.updateBot(snake);
      }
    }

    // Check collisions (all snakes)
    this.checkCollisions();

    // Check food eating (all snakes)
    this.checkFoodCollisions();

    // Replenish food
    while (this.food.length < this.config.foodCount) {
      this.spawnOneFood();
    }

    // Respawn dead bots
    this.respawnBots();

    // Update particles
    this.updateParticles();

    // Clean old kill feed entries (older than 5s)
    const now = Date.now();
    this.killFeed = this.killFeed.filter(e => now - e.timestamp < 5000);
  }

  // ── Player Update ────────────────────────────────────────────────────────

  private updatePlayer(snake: SnakeState, input: InputState) {
    // Single zero-alloc call: turn, move, path, boost drain, spawn protection, emote, radii
    const flags = tickSnakeMovement(snake, input, this.config, this.frameCount);

    // Boost food drop from tail (flag bit 0)
    if ((flags & 1) !== 0 && snake.path.length > 2) {
      const tailX = snake.path.tailX();
      const tailY = snake.path.tailY();
      this.food.push(createFoodOrb(
        `boost-${this.frameCount}`, tailX, tailY, this.config,
      ));
    }

    this.playerScore = snake.score;
    this.playerKills = snake.kills;
  }

  // ── Bot AI ────────────────────────────────────────────────────────────────

  private updateBot(bot: SnakeState) {
    const ai = this.botAIStates.get(bot.identity.id);
    if (!ai) return;

    const lvl = ai.level;
    const turnMult = this.config.botLevelTurnMult[lvl] ?? 1;
    const scanRadius = this.config.botLevelScanRadius[lvl] ?? 300;
    const evadeTicks = this.config.botLevelEvadeTicks[lvl] ?? 8;
    const cdRange = this.config.botLevelCooldownRange[lvl] ?? [8, 18];

    // Decision cooldown — varies by level (rookie=slow, apex=fast)
    if (ai.decisionCooldown > 0) {
      ai.decisionCooldown--;
    } else {
      ai.decisionCooldown = cdRange[0] + Math.floor(Math.random() * (cdRange[1] - cdRange[0]));
      this.botDecide(bot, ai, scanRadius);
    }

    // Determine target angle from AI state
    let targetAngle = bot.angle;

    if (ai.inDanger && ai.dangerAngle !== null) {
      // Flee away from danger — higher levels flee more precisely
      const fleeAngle = ai.dangerAngle + Math.PI;
      const jitter = (1 - lvl * 0.15) * (Math.random() - 0.5) * 0.6;
      targetAngle = fleeAngle + jitter;
    } else if (ai.targetFoodId) {
      // Seek food
      const food = this.food.find(f => f.id === ai.targetFoodId);
      if (food) {
        targetAngle = angleBetween(bot.head, food);
      } else {
        ai.targetFoodId = null;
        targetAngle = bot.angle + (Math.random() - 0.5) * 0.5;
      }
    } else {
      // Wander — rookies wander more randomly, apex drifts less
      const wanderAmount = 0.4 - lvl * 0.06;
      targetAngle = bot.angle + (Math.random() - 0.5) * wanderAmount;
    }

    // Turn toward target at level-appropriate rate
    let angleDiff = targetAngle - bot.angle;
    // Normalize to -PI..PI
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const maxTurn = this.config.turnThin * turnMult;
    const turn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
    const finalAngle = bot.angle + turn;

    // Single zero-alloc call for bot movement (bots never boost)
    const botInput: InputState = {
      targetAngle: finalAngle,
      boosting: false,
      extracting: false,
      emoteKey: null,
    };
    tickSnakeMovement(bot, botInput, this.config, this.frameCount);

    // Check danger from nearby snakes (after movement so bot.head is updated)
    ai.inDanger = false;
    ai.dangerAngle = null;

    // Higher levels check more snakes for danger
    const evadeRadius = this.config.botEvadeRadius;

    for (const other of this.snakes) {
      if (other.identity.id === bot.identity.id) continue;
      if (!other.alive) continue;

      const dist = vec2Dist(bot.head, other.head);

      // Danger detection: N ticks ahead prediction (varies by level)
      if (dist < evadeRadius) {
        const speed = other.boosting ? this.config.boostSpeed * evadeTicks : this.config.baseSpeed * evadeTicks;
        const fx = other.head.x + Math.cos(other.angle) * speed;
        const fy = other.head.y + Math.sin(other.angle) * speed;
        const fdx = bot.head.x - fx;
        const fdy = bot.head.y - fy;
        const futureDist = Math.sqrt(fdx * fdx + fdy * fdy);
        if (futureDist < evadeRadius * 0.8) {
          ai.inDanger = true;
          ai.dangerAngle = angleBetween(other.head, bot.head);
          break;
        }
      }

      // Avoid body segments (higher levels have larger range)
      const bodyAvoidRange = 120 + lvl * 30;
      if (dist < bodyAvoidRange) {
        const toOther = vec2Sub(other.head, bot.head);
        const dot = toOther.x * Math.cos(bot.angle) + toOther.y * Math.sin(bot.angle);
        if (dot > 0) {
          ai.inDanger = true;
          ai.dangerAngle = angleBetween(other.head, bot.head);
          break;
        }
      }
    }
  }

  private botDecide(bot: SnakeState, ai: BotAIState, scanRadius: number) {
    if (ai.inDanger) {
      ai.targetFoodId = null;
      return;
    }

    // Find nearest food within scan radius (varies by level)
    let nearestFood: FoodOrb | null = null;
    let nearestDist = scanRadius;

    for (const food of this.food) {
      const dist = vec2Dist(bot.head, food);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestFood = food;
      }
    }

    ai.targetFoodId = nearestFood?.id ?? null;
  }

  // ── Collision Detection ──────────────────────────────────────────────────

  private checkCollisions() {
    const deadIds: string[] = [];

    for (const snake of this.snakes) {
      if (!snake.alive || snake.spawnProtected) continue;

      const result = checkAllCollisions(snake, this.snakes, this.config, this.map);

      if (result.type !== 'none' && result.victimId) {
        snake.alive = false;
        deadIds.push(result.victimId);

        // Determine cause
        let cause: KillCause = 'head_on';
        if (result.type === 'boundary') cause = 'boundary';

        // Process death
        const deathEvent = createDeathEvent(snake, result.killerId, cause, this.config);
        this.deathEvent = snake.identity.id === this.playerId ? deathEvent : this.deathEvent;

        // Drop food from body
        this.food.push(...deathEvent.droppedFood);

        // Add kill feed entry
        const killer = result.killerId ? this.snakes.find(s => s.identity.id === result.killerId) : null;
        const entry: KillFeedEntry = {
          id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          victimId: snake.identity.id,
          victimName: snake.identity.name,
          victimIsBot: snake.identity.isBot,
          killerId: result.killerId,
          killerName: killer?.identity.name ?? null,
          killerIsBot: killer?.identity.isBot ?? false,
          cause,
          timestamp: Date.now(),
        };
        this.killFeed.push(entry);

        // Credit kill
        if (killer && result.killerId !== snake.identity.id) {
          killer.kills++;
        }

        // Player death
        if (snake.identity.id === this.playerId) {
          this.playerAlive = false;
          this.endState = {
            outcome: 'death',
            killerName: killer?.identity.name,
            killerTag: killer?.identity.tag,
            killerIsBot: killer?.identity.isBot,
            kills: snake.kills,
            score: snake.score,
            xpGained: 0,
            durationSeconds: Math.floor((Date.now() - this.matchStartTime) / 1000),
            isOffline: true,
            arenaName: 'Practice Arena',
          };
          this.phase = 'ended';
          this.onDeath?.(this.endState);
        }

        // Bot respawn timer
        if (snake.identity.isBot) {
          this.botRespawnTimers.set(snake.identity.id, this.config.botRespawnDelay);
        }
      }
    }
  }

  // ── Food Collision ───────────────────────────────────────────────────────

  private checkFoodCollisions() {
    const eatenIds: Set<string> = new Set();

    for (const snake of this.snakes) {
      if (!snake.alive) continue;

      for (const food of this.food) {
        if (eatenIds.has(food.id)) continue;

        if (checkFoodEat(snake, food, this.config)) {
          eatenIds.add(food.id);
          snake.score += food.value * this.config.growthMult;
        }
      }
    }

    if (eatenIds.size > 0) {
      this.food = this.food.filter(f => !eatenIds.has(f.id));
      // Update cached radii for snakes whose score changed
      for (const snake of this.snakes) {
        if (!snake.alive) continue;
        updateCachedRadii(snake, this.config);
      }
    }
  }

  // ── Bot Respawn ──────────────────────────────────────────────────────────

  private respawnBots() {
    for (const [botId, timer] of this.botRespawnTimers) {
      if (timer <= 1) {
        this.botRespawnTimers.delete(botId);
        // Remove dead bot
        const idx = this.snakes.findIndex(s => s.identity.id === botId);
        if (idx >= 0) {
          this.snakes.splice(idx, 1);
          this.botAIStates.delete(botId);
        }
        // Spawn new bot
        this.spawnBot();
      } else {
        this.botRespawnTimers.set(botId, timer - 1);
      }
    }
  }

  // ── Particles ────────────────────────────────────────────────────────────

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  addParticle(x: number, y: number, color: string, count: number = 3) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 30 + Math.random() * 30,
        maxLife: 60,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  // ── Leaderboard ──────────────────────────────────────────────────────────

  getLeaderboard() {
    return this.snakes
      .filter(s => s.alive)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(s => ({
        id: s.identity.id,
        name: s.identity.name,
        tag: s.identity.tag,
        isBot: s.identity.isBot,
        score: s.score,
        kills: s.kills,
        isPlayer: s.identity.id === this.playerId,
      }));
  }

  getPlayerRank(): number {
    const sorted = this.snakes.filter(s => s.alive).sort((a, b) => b.score - a.score);
    const idx = sorted.findIndex(s => s.identity.id === this.playerId);
    return idx >= 0 ? idx + 1 : sorted.length;
  }

  // ── Emote (called from input) ────────────────────────────────────────────

  triggerPlayerEmote(emoteKey: number) {
    const player = this.snakes.find(s => s.identity.id === this.playerId);
    if (!player || !player.alive) return;

    const emoteMap: Record<number, import('@/lib/snake/types').EmoteType> = {
      1: 'gg', 2: 'target', 3: 'flee', 4: 'ripped', 5: 'extracting',
    };
    const emote = emoteMap[emoteKey];
    if (emote) {
      setEmote(player, emote, 120);
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  destroy() {
    this.snakes = [];
    this.food = [];
    this.killFeed = [];
    this.botAIStates.clear();
    this.botRespawnTimers.clear();
    this.particles = [];
    this.tickAccumulator = 0;
    this.phase = 'ended';
  }
}
