'use client';

import type {
  SnakeState, SnakeIdentity, FoodOrb, MapState,
  InputState, BotAIState, KillFeedEntry, DeathEvent, GamePhase,
  EndScreenState, KillCause, FoodSize,
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

// ── Constants ─────────────────────────────────────────────────────────────

const MAP_CENTER_X = 4000;
const MAP_CENTER_Y = 4000;
const MAP_SOFT_BOUNDARY = 5500; // Bots should stay within this radius
const MAP_HARD_BOUNDARY = 6000; // Absolute max before forced turn-back

// Food value weights per bot level (how much they prefer larger food)
const FOOD_VALUE_WEIGHT: number[] = [0, 0.2, 0.5, 0.8, 1.0];

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
      center: vec2(MAP_CENTER_X, MAP_CENTER_Y),
      currentRadius: Infinity,
      baseRadius: Infinity,
      breathingAmplitude: 0,
      breathingPeriod: 0,
      breathingPhase: 0,
    };

    // Spawn player
    const playerSnake = this.createSnake(playerIdentity, MAP_CENTER_X, MAP_CENTER_Y);
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
    // Spawn near player (infinite map)
    const player = this.snakes.find(s => s.identity.id === this.playerId);
    const cx = player?.head.x ?? MAP_CENTER_X;
    const cy = player?.head.y ?? MAP_CENTER_Y;
    const ang = Math.random() * Math.PI * 2;
    const dist = 800 + Math.random() * 2500;
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist;

    const snake = this.createSnake(identity, x, y);
    this.snakes.push(snake);

    // 5-level distribution: 40% rookie, 25% scout, 17% hunter, 12% predator, 6% apex
    const maxLevel = this.config.botLevelTurnMult.length - 1;
    let botLevel: number;
    const r = Math.random();
    if (r < 0.40) botLevel = 0;
    else if (r < 0.65) botLevel = 1;
    else if (r < 0.82) botLevel = 2;
    else if (r < 0.94) botLevel = 3;
    else botLevel = Math.min(maxLevel, 4);

    this.botAIStates.set(identity.id, {
      behavior: 'harvest',
      targetFoodId: null,
      targetSnakeId: null,
      dangerAngle: null,
      inDanger: false,
      decisionCooldown: 0,
      level: botLevel,
      wanderAngle: Math.random() * Math.PI * 2,
      boostCooldown: 0,
      orbitDir: Math.random() < 0.5 ? 1 : -1,
      encircleTicks: 0,
    });
  }

  // ── Food Management ──────────────────────────────────────────────────────

  private spawnInitialFood() {
    for (let i = 0; i < this.config.foodCount; i++) {
      this.spawnOneFood();
    }
  }

  private spawnOneFood() {
    // Spawn food near the player (infinite map — food follows player)
    const player = this.snakes.find(s => s.identity.id === this.playerId);
    const cx = player?.head.x ?? MAP_CENTER_X;
    const cy = player?.head.y ?? MAP_CENTER_Y;
    // Spawn within 2500px radius of player, mostly within 1500px
    const dist = 200 + Math.random() * 2300;
    const ang = Math.random() * Math.PI * 2;
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist;
    const id = `food-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.food.push(createFoodOrb(id, x, y, this.config));
  }

  // ── Main Tick ─────────────────────────────────────────────────────────────

  tick(input: InputState, deltaMs: number = 16.67): void {
    if (this.phase !== 'playing') return;

    const tickIntervalMs = 1000 / this.config.tickRateHz;
    this.tickAccumulator += deltaMs;

    const maxTicks = 3;
    let ticksThisFrame = 0;

    while (this.tickAccumulator >= tickIntervalMs && ticksThisFrame < maxTicks) {
      this.tickAccumulator -= tickIntervalMs;
      this.runOneTick(input);
      ticksThisFrame++;
      if (this.phase !== 'playing') break;
    }

    if (this.tickAccumulator > tickIntervalMs * 2) {
      this.tickAccumulator = 0;
    }
  }

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

    this.checkCollisions();
    this.checkFoodCollisions();

    while (this.food.length < this.config.foodCount) {
      this.spawnOneFood();
    }

    // Despawn food too far from player (keep world clean in infinite mode)
    {
      const player = this.snakes.find(s => s.identity.id === this.playerId);
      if (player) {
        const maxDist = 4000;
        const maxDistSq = maxDist * maxDist;
        this.food = this.food.filter(f => {
          const dx = f.x - player.head.x;
          const dy = f.y - player.head.y;
          return dx * dx + dy * dy < maxDistSq;
        });
      }
    }

    this.respawnBots();
    this.updateParticles();

    const now = Date.now();
    this.killFeed = this.killFeed.filter(e => now - e.timestamp < 5000);
  }

  // ── Player Update ────────────────────────────────────────────────────────

  private updatePlayer(snake: SnakeState, input: InputState) {
    const flags = tickSnakeMovement(snake, input, this.config, this.frameCount);

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

  // ══════════════════════════════════════════════════════════════════════════
  // 5-LEVEL BOT AI SYSTEM
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Level 0 — Rookie (40%): Slow turns, nearsighted, wanders blindly,
  //   poor danger sense, no boundary awareness, clumsy food finding.
  //
  // Level 1 — Scout (25%): Moderate turns, wider scan, basic danger
  //   avoidance, soft boundary awareness, prefers nearby food.
  //
  // Level 2 — Hunter (17%): Good turns, wide scan, predictive evasion,
  //   good boundary avoidance, targets valuable (large) food clusters.
  //
  // Level 3 — Predator (12%): Fast turns, large scan, deep prediction,
  //   excellent avoidance, actively hunts smaller snakes, boosts to chase.
  //
  // Level 4 — Apex (6%): Near-perfect turns, max scan, deepest prediction,
  //   perfect avoidance, encircles prey before striking, strategic boosting.
  // ══════════════════════════════════════════════════════════════════════════

  private updateBot(bot: SnakeState) {
    const ai = this.botAIStates.get(bot.identity.id);
    if (!ai) return;

    const lvl = ai.level;
    const turnMult = this.config.botLevelTurnMult[lvl] ?? 1;
    const scanRadius = this.config.botLevelScanRadius[lvl] ?? 300;
    const cdRange = this.config.botLevelCooldownRange[lvl] ?? [8, 18];

    // ── Decision cycle (varies by level) ────────────────────────────────
    if (ai.decisionCooldown > 0) {
      ai.decisionCooldown--;
    } else {
      ai.decisionCooldown = cdRange[0] + Math.floor(Math.random() * (cdRange[1] - cdRange[0]));
      this.botDecide(bot, ai, scanRadius);
    }

    // ── Determine target angle from AI state ───────────────────────────
    let targetAngle = bot.angle;
    let wantBoost = false;

    // Priority 1: Danger (all levels flee, higher = more precise)
    if (ai.inDanger && ai.dangerAngle !== null) {
      const fleeAngle = ai.dangerAngle + Math.PI;
      // Rookies flee with large jitter, apex flees precisely
      const jitter = (1 - lvl * 0.18) * (Math.random() - 0.5) * 0.7;
      targetAngle = fleeAngle + jitter;
      // Apex and predator boost while fleeing if they have score
      if (lvl >= 3 && bot.score > this.config.boostMinScore * 5 && ai.boostCooldown <= 0) {
        wantBoost = true;
      }
    }
    // Priority 2: Hunting behavior (predator L3, apex L4)
    else if (ai.behavior === 'hunt' && ai.targetSnakeId) {
      const target = this.snakes.find(s => s.identity.id === ai.targetSnakeId);
      if (target && target.alive) {
        targetAngle = this.botHuntAngle(bot, target, ai);
        // Boost when closing in (L3) or chasing (L4)
        const dist = vec2Dist(bot.head, target.head);
        if (dist < 300 && bot.score > this.config.boostMinScore * 3 && ai.boostCooldown <= 0) {
          wantBoost = lvl >= 3;
        }
      } else {
        ai.behavior = 'harvest';
        ai.targetSnakeId = null;
      }
    }
    // Priority 3: Encircle behavior (apex L4 only)
    else if (ai.behavior === 'encircle' && ai.targetSnakeId) {
      const target = this.snakes.find(s => s.identity.id === ai.targetSnakeId);
      if (target && target.alive) {
        targetAngle = this.botEncircleAngle(bot, target, ai);
        ai.encircleTicks++;
        // Strike after enough encircling (3-5 loops)
        if (ai.encircleTicks > 90 + Math.random() * 60) {
          ai.behavior = 'hunt';
          ai.encircleTicks = 0;
        }
      } else {
        ai.behavior = 'harvest';
        ai.targetSnakeId = null;
        ai.encircleTicks = 0;
      }
    }
    // Priority 4: Seek food
    else if (ai.targetFoodId) {
      const food = this.food.find(f => f.id === ai.targetFoodId);
      if (food) {
        targetAngle = angleBetween(bot.head, food);
      } else {
        ai.targetFoodId = null;
      }
    }
    // Priority 5: Wander (level-specific)
    else {
      targetAngle = this.botWander(bot, ai);
    }

    // ── Boundary avoidance (L1+, better at higher levels) ───────────────
    if (lvl >= 1) {
      const bndAngle = this.botBoundaryAvoidance(bot, lvl);
      if (bndAngle !== null) {
        // Blend boundary avoidance with target (higher level = stronger pull)
        const strength = 0.3 + lvl * 0.15;
        targetAngle = this.blendAngles(targetAngle, bndAngle, strength);
      }
    }

    // ── Turn toward target at level-appropriate rate ────────────────────
    let angleDiff = targetAngle - bot.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const maxTurn = this.config.turnThin * turnMult;
    const turn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
    const finalAngle = bot.angle + turn;

    // ── Boost cooldown management ───────────────────────────────────────
    if (ai.boostCooldown > 0) ai.boostCooldown--;
    if (wantBoost) ai.boostCooldown = 60 + Math.floor(Math.random() * 40);

    const botInput: InputState = {
      targetAngle: finalAngle,
      boosting: wantBoost,
      extracting: false,
      emoteKey: null,
    };
    tickSnakeMovement(bot, botInput, this.config, this.frameCount);

    // ── Danger scan (after movement so head is updated) ─────────────────
    this.botDangerScan(bot, ai);
  }

  // ── Bot Decision Trees (per level) ────────────────────────────────────

  private botDecide(bot: SnakeState, ai: BotAIState, scanRadius: number) {
    if (ai.inDanger) {
      ai.targetFoodId = null;
      ai.targetSnakeId = null;
      ai.behavior = 'harvest';
      return;
    }

    switch (ai.level) {
      case 0: this.botDecideRookie(bot, ai, scanRadius); break;
      case 1: this.botDecideScout(bot, ai, scanRadius); break;
      case 2: this.botDecideHunter(bot, ai, scanRadius); break;
      case 3: this.botDecidePredator(bot, ai, scanRadius); break;
      case 4: this.botDecideApex(bot, ai, scanRadius); break;
      default: this.botDecideRookie(bot, ai, scanRadius); break;
    }
  }

  /** L0 Rookie: Wanders a lot, grabs nearby food, doesn't plan ahead. */
  private botDecideRookie(bot: SnakeState, ai: BotAIState, scanRadius: number) {
    // Slowly drift wander angle for organic movement
    ai.wanderAngle += (Math.random() - 0.5) * 0.8;

    // Sometimes pick a random new direction entirely
    if (Math.random() < 0.15) {
      ai.wanderAngle = Math.random() * Math.PI * 2;
    }

    // Grab nearest food only if very close (half scan radius)
    const halfScan = scanRadius * 0.5;
    let nearestFood: FoodOrb | null = null;
    let nearestDist = halfScan;

    for (const food of this.food) {
      const dx = bot.head.x - food.x;
      const dy = bot.head.y - food.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDist * nearestDist) {
        nearestDist = Math.sqrt(distSq);
        nearestFood = food;
      }
    }

    ai.targetFoodId = nearestFood?.id ?? null;
  }

  /** L1 Scout: Moderate food seeking, basic awareness. */
  private botDecideScout(bot: SnakeState, ai: BotAIState, scanRadius: number) {
    ai.wanderAngle += (Math.random() - 0.5) * 0.4;

    // Find nearest food within scan radius
    let nearestFood: FoodOrb | null = null;
    let nearestDist = scanRadius;

    for (const food of this.food) {
      const dx = bot.head.x - food.x;
      const dy = bot.head.y - food.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDist * nearestDist) {
        nearestDist = Math.sqrt(distSq);
        nearestFood = food;
      }
    }

    // Scouts prefer medium food slightly
    if (nearestFood) {
      ai.targetFoodId = nearestFood.id;
    } else {
      ai.targetFoodId = null;
    }
  }

  /** L2 Hunter: Targets valuable food, avoids clusters of snakes. */
  private botDecideHunter(bot: SnakeState, ai: BotAIState, scanRadius: number) {
    // Find best food: value-weighted with distance penalty
    let bestFood: FoodOrb | null = null;
    let bestScore = -Infinity;

    const valueWeight = FOOD_VALUE_WEIGHT[2];

    for (const food of this.food) {
      const dx = bot.head.x - food.x;
      const dy = bot.head.y - food.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > scanRadius) continue;

      // Score: value * weight - distance_penalty
      const sizeValue = food.size === 'large' ? 5 : food.size === 'medium' ? 3 : 1;
      const score = sizeValue * (1 + valueWeight) - dist * 0.02;
      if (score > bestScore) {
        bestScore = score;
        bestFood = food;
      }
    }

    ai.targetFoodId = bestFood?.id ?? null;
  }

  /** L3 Predator: Hunts smaller snakes, eats food when no prey. */
  private botDecidePredator(bot: SnakeState, ai: BotAIState, scanRadius: number) {
    // Look for smaller snakes to hunt
    let prey: SnakeState | null = null;
    let preyDist = scanRadius;

    for (const other of this.snakes) {
      if (other.identity.id === bot.identity.id || !other.alive) continue;
      if (other.score >= bot.score * 0.9) continue; // Only hunt smaller

      const dist = vec2Dist(bot.head, other.head);
      if (dist < preyDist) {
        preyDist = dist;
        prey = other;
      }
    }

    if (prey && preyDist < scanRadius * 0.7) {
      ai.behavior = 'hunt';
      ai.targetSnakeId = prey.identity.id;
      ai.targetFoodId = null;
    } else {
      ai.behavior = 'harvest';
      ai.targetSnakeId = null;
      // Fall back to hunter food logic
      this.botDecideHunter(bot, ai, scanRadius);
    }
  }

  /** L4 Apex: Encircles prey, perfect food targeting, dominates. */
  private botDecideApex(bot: SnakeState, ai: BotAIState, scanRadius: number) {
    // Look for prey to encircle or hunt
    let prey: SnakeState | null = null;
    let preyDist = scanRadius;

    for (const other of this.snakes) {
      if (other.identity.id === bot.identity.id || !other.alive) continue;
      if (other.spawnProtected) continue;
      // Apex hunts anything smaller than 1.2x its size
      if (other.score >= bot.score * 1.2) continue;

      const dist = vec2Dist(bot.head, other.head);
      if (dist < preyDist) {
        preyDist = dist;
        prey = other;
      }
    }

    if (prey && preyDist < scanRadius * 0.8) {
      if (preyDist < 200 && ai.behavior !== 'encircle') {
        // Close enough to start encircling
        ai.behavior = 'encircle';
        ai.targetSnakeId = prey.identity.id;
        ai.encircleTicks = 0;
        ai.orbitDir = Math.random() < 0.5 ? 1 : -1;
        ai.targetFoodId = null;
      } else if (ai.behavior !== 'encircle') {
        // Approach prey
        ai.behavior = 'hunt';
        ai.targetSnakeId = prey.identity.id;
        ai.targetFoodId = null;
      }
    } else {
      if (ai.behavior === 'encircle') {
        ai.encircleTicks = 0;
      }
      ai.behavior = 'harvest';
      ai.targetSnakeId = null;
      // Apex food targeting: best value-per-distance
      let bestFood: FoodOrb | null = null;
      let bestScore = -Infinity;

      for (const food of this.food) {
        const dx = bot.head.x - food.x;
        const dy = bot.head.y - food.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > scanRadius) continue;

        const sizeValue = food.size === 'large' ? 5 : food.size === 'medium' ? 3 : 1;
        const score = sizeValue * 2 - dist * 0.01;
        if (score > bestScore) {
          bestScore = score;
          bestFood = food;
        }
      }

      ai.targetFoodId = bestFood?.id ?? null;
    }
  }

  // ── Bot Movement Behaviors ────────────────────────────────────────────

  /** Wander: level-specific drift. */
  private botWander(bot: SnakeState, ai: BotAIState): number {
    const lvl = ai.level;
    // Rookies drift a lot, apex barely drifts
    const wanderAmount = 0.5 - lvl * 0.08;
    ai.wanderAngle += (Math.random() - 0.5) * wanderAmount;

    if (lvl === 0) {
      // Rookies: occasionally make sharp random turns
      if (Math.random() < 0.08) {
        ai.wanderAngle = Math.random() * Math.PI * 2;
      }
      return ai.wanderAngle;
    }

    // Higher levels drift toward center gently
    const toCenter = Math.atan2(MAP_CENTER_Y - bot.head.y, MAP_CENTER_X - bot.head.x);
    const distFromCenter = Math.sqrt(
      (bot.head.x - MAP_CENTER_X) ** 2 + (bot.head.y - MAP_CENTER_Y) ** 2,
    );
    const centerPull = Math.min(0.3, distFromCenter * 0.00005 * (lvl + 1));

    return this.blendAngles(ai.wanderAngle, toCenter, centerPull);
  }

  /** Hunt angle: intercept course toward target snake. */
  private botHuntAngle(bot: SnakeState, target: SnakeState, ai: BotAIState): number {
    // Aim at the target's future position (predict ahead)
    const dist = vec2Dist(bot.head, target.head);
    const ticksAhead = Math.min(20, Math.max(2, dist / this.config.baseSpeed));
    const speed = target.boosting ? this.config.boostSpeed : this.config.baseSpeed;
    const fx = target.head.x + Math.cos(target.angle) * speed * ticksAhead;
    const fy = target.head.y + Math.sin(target.angle) * speed * ticksAhead;
    return Math.atan2(fy - bot.head.y, fx - bot.head.x);
  }

  /** Encircle angle: orbit around target to trap it. */
  private botEncircleAngle(bot: SnakeState, target: SnakeState, ai: BotAIState): number {
    const dist = vec2Dist(bot.head, target.head);
    const orbitRadius = 120 + bot.score * 0.3; // Wider orbit for bigger snakes

    // Angle from target to bot
    const angleToBot = Math.atan2(bot.head.y - target.head.y, bot.head.x - target.head.x);

    // Desired position: orbit around target
    const desiredAngle = angleToBot + ai.orbitDir * 0.08;
    const desiredX = target.head.x + Math.cos(desiredAngle) * orbitRadius;
    const desiredY = target.head.y + Math.sin(desiredAngle) * orbitRadius;

    // If too far, close in; if too close, expand orbit
    let targetX = desiredX;
    let targetY = desiredY;
    if (dist > orbitRadius * 1.5) {
      // Too far — move toward target
      targetX = target.head.x;
      targetY = target.head.y;
    } else if (dist < orbitRadius * 0.5) {
      // Too close — move away slightly
      targetX = bot.head.x + Math.cos(angleToBot) * 20;
      targetY = bot.head.y + Math.sin(angleToBot) * 20;
    }

    return Math.atan2(targetY - bot.head.y, targetX - bot.head.x);
  }

  /** Boundary avoidance: returns angle toward center if near edge, null otherwise. */
  private botBoundaryAvoidance(bot: SnakeState, level: number): number | null {
    const dx = bot.head.x - MAP_CENTER_X;
    const dy = bot.head.y - MAP_CENTER_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Soft boundary: start turning at MAP_SOFT_BOUNDARY
    const softBnd = MAP_SOFT_BOUNDARY - level * 200; // Higher levels react further out
    if (dist < softBnd) return null;

    const hardBnd = MAP_HARD_BOUNDARY - level * 100;
    if (dist > hardBnd) {
      // Emergency: full turn toward center
      return Math.atan2(MAP_CENTER_Y - bot.head.y, MAP_CENTER_X - bot.head.x);
    }

    // Gradual turn toward center (stronger as closer to edge)
    const urgency = (dist - softBnd) / (hardBnd - softBnd);
    return Math.atan2(MAP_CENTER_Y - bot.head.y, MAP_CENTER_X - bot.head.x);
  }

  /** Danger scan: detect nearby threats. Level-specific depth. */
  private botDangerScan(bot: SnakeState, ai: BotAIState) {
    const lvl = ai.level;
    const evadeTicks = this.config.botLevelEvadeTicks[lvl] ?? 8;
    const evadeRadius = this.config.botEvadeRadius;

    ai.inDanger = false;
    ai.dangerAngle = null;

    for (const other of this.snakes) {
      if (other.identity.id === bot.identity.id || !other.alive) continue;

      const dx = bot.head.x - other.head.x;
      const dy = bot.head.y - other.head.y;
      const distSq = dx * dx + dy * dy;

      // Quick reject
      if (distSq > evadeRadius * evadeRadius) continue;

      const dist = Math.sqrt(distSq);

      // Head-on prediction: where will the other snake be in N ticks?
      const speed = other.boosting ? this.config.boostSpeed : this.config.baseSpeed;
      const fx = other.head.x + Math.cos(other.angle) * speed * evadeTicks;
      const fy = other.head.y + Math.sin(other.angle) * speed * evadeTicks;
      const fdx = bot.head.x - fx;
      const fdy = bot.head.y - fy;
      const futureDist = Math.sqrt(fdx * fdx + fdy * fdy);

      if (futureDist < evadeRadius * 0.8) {
        ai.inDanger = true;
        ai.dangerAngle = Math.atan2(dy, dx); // angle FROM other TO bot
        // Rookies sometimes don't detect body threats (lower body avoid range)
        break;
      }

      // Body segment avoidance (higher levels check further ahead)
      const bodyAvoidRange = 100 + lvl * 40;
      if (dist < bodyAvoidRange) {
        const toOtherX = other.head.x - bot.head.x;
        const toOtherY = other.head.y - bot.head.y;
        const dot = toOtherX * Math.cos(bot.angle) + toOtherY * Math.sin(bot.angle);
        // Only if the other snake is roughly ahead
        if (dot > 0 && dist < bodyAvoidRange * 0.6) {
          ai.inDanger = true;
          ai.dangerAngle = Math.atan2(-toOtherY, -toOtherX);
          break;
        }
      }
    }
  }

  /** Blend two angles together with given strength (0=a, 1=b). */
  private blendAngles(a: number, b: number, strength: number): number {
    const ax = Math.cos(a);
    const ay = Math.sin(a);
    const bx = Math.cos(b);
    const by = Math.sin(b);
    const rx = ax * (1 - strength) + bx * strength;
    const ry = ay * (1 - strength) + by * strength;
    return Math.atan2(ry, rx);
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

        let cause: KillCause = 'head_on';
        if (result.type === 'boundary') cause = 'boundary';

        const deathEvent = createDeathEvent(snake, result.killerId, cause, this.config);
        this.deathEvent = snake.identity.id === this.playerId ? deathEvent : this.deathEvent;

        this.food.push(...deathEvent.droppedFood);

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

        if (killer && result.killerId !== snake.identity.id) {
          killer.kills++;
        }

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

        if (snake.identity.isBot) {
          this.botRespawnTimers.set(snake.identity.id, this.config.botRespawnDelay);
          // Clear AI state for dead bot
          this.botAIStates.delete(snake.identity.id);
        }
      }
    }
  }

  // ── Food Collision ───────────────────────────────────────────────────────

  private checkFoodCollisions() {
    const eatenIds: Set<string> = new Set();

    for (const snake of this.snakes) {
      if (!snake.alive) continue;

      const eatR = (snake._cachedVisualRadius > 0 ? snake._cachedVisualRadius : calcVisualRadius(snake.score, this.config))
        + this.config.eatRadius;
      const eatRSq = eatR * eatR;

      for (const food of this.food) {
        if (eatenIds.has(food.id)) continue;

        // Inline distance check (avoid vec2Dist alloc)
        const dx = snake.head.x - food.x;
        const dy = snake.head.y - food.y;
        if (dx * dx + dy * dy < eatRSq * eatRSq) {
          eatenIds.add(food.id);
          snake.score += food.value * this.config.growthMult;
        }
      }
    }

    if (eatenIds.size > 0) {
      this.food = this.food.filter(f => !eatenIds.has(f.id));
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
        const idx = this.snakes.findIndex(s => s.identity.id === botId);
        if (idx >= 0) {
          this.snakes.splice(idx, 1);
        }
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
    let rank = 1;
    for (const s of this.snakes) {
      if (!s.alive) continue;
      if (s.identity.id === this.playerId) continue;
      if (s.score > this.playerScore) rank++;
    }
    return rank;
  }

  getTotalAlive(): number {
    let count = 0;
    for (const s of this.snakes) {
      if (s.alive) count++;
    }
    return count;
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
