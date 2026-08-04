'use client';

import type {
  Vec2, SnakeState, SnakeIdentity, FoodOrb, MapState,
  InputState, BotAIState, KillFeedEntry, DeathEvent, GamePhase,
  EndScreenState, KillCause,
} from '@/lib/snake/types';
import { EMOTE_DISPLAY } from '@/lib/snake/types';
import { DEFAULT_SNAKE_CONFIG, type SnakeConfig } from '@/lib/snake/config';
import {
  vec2, vec2Dist, vec2Sub, angleBetween, normalizeAngle, angleDelta,
  moveHead, turnToward, buildInitialPath, extendPath,
  calcVisualRadius, calcCollisionRadius, calcSegmentCount,
  checkAllCollisions, circlesOverlap,
  createFoodOrb, checkFoodEat, calcDeathFood,
  createDeathEvent, tickSpawnProtection, tickEmote,
  setEmote, processBoostDrain,
} from '@/lib/snake/engine';
import { resolveSkin } from '@/lib/snake/skin-resolver';

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
  return `hsl(${hue}, 70%, 55%)`;
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
    // isPlayer is already set in playerIdentity
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
    const path = buildInitialPath(x, y, angle, s * this.config.ptsPerSegment, this.config.segSpacing);

    return {
      identity,
      head: vec2(x, y),
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
    const angle = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 3000;
    const x = 4000 + Math.cos(angle) * dist;
    const y = 4000 + Math.sin(angle) * dist;

    const snake = this.createSnake(identity, x, y);
    this.snakes.push(snake);
    this.botAIStates.set(identity.id, {
      behavior: 'harvest',
      targetFoodId: null,
      dangerAngle: null,
      inDanger: false,
      decisionCooldown: 0,
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

  tick(input: InputState) {
    if (this.phase !== 'playing') return;

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
    const visualRadius = calcVisualRadius(snake.score, this.config);

    // Turn toward target
    snake.angle = turnToward(snake.angle, input.targetAngle, this.config, visualRadius, snake.boosting);
    snake.targetAngle = input.targetAngle;

    // Move
    const newHead = moveHead(snake, this.config, 1.0);
    snake.head = newHead;
    snake.path = extendPath(snake.path, newHead, snake.angle, snake.score, this.config);

    // Boost
    snake.boosting = input.boosting && snake.score > this.config.boostMinScore;
    const { newScore, shouldDropFood } = processBoostDrain(snake, this.config, this.frameCount);
    snake.score = newScore;

    if (shouldDropFood && snake.path.length > 2) {
      const tail = snake.path[snake.path.length - 1];
      this.food.push(createFoodOrb(
        `boost-${this.frameCount}`, tail.x, tail.y, this.config,
      ));
    }

    // Spawn protection
    tickSpawnProtection(snake);

    // Emote
    tickEmote(snake);

    this.playerScore = snake.score;
    this.playerKills = snake.kills;
  }

  // ── Bot AI ────────────────────────────────────────────────────────────────

  private updateBot(bot: SnakeState) {
 const ai = this.botAIStates.get(bot.identity.id);
    if (!ai) return;

    const visualRadius = calcVisualRadius(bot.score, this.config);

    // Decision cooldown
    if (ai.decisionCooldown > 0) {
      ai.decisionCooldown--;
    } else {
      ai.decisionCooldown = 8 + Math.floor(Math.random() * 16);
      this.botDecide(bot, ai);
    }

    // Determine target angle from AI state
    let targetAngle = bot.angle;

    if (ai.inDanger && ai.dangerAngle !== null) {
      // Flee away from danger
      targetAngle = ai.dangerAngle + Math.PI;
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
      // Wander
      targetAngle = bot.angle + (Math.random() - 0.5) * 0.3;
    }

    // Turn (bots don't boost)
    bot.angle = turnToward(bot.angle, targetAngle, this.config, visualRadius, false);

    // Move
    const newHead = moveHead(bot, this.config, 1.0);
    bot.head = newHead;
    bot.path = extendPath(bot.path, newHead, bot.angle, bot.score, this.config);

    // Spawn protection
    tickSpawnProtection(bot);

    // Emote
    tickEmote(bot);

    // Check danger from nearby snakes
    ai.inDanger = false;
    ai.dangerAngle = null;

    for (const other of this.snakes) {
      if (other.identity.id === bot.identity.id) continue;
      if (!other.alive) continue;

      const dist = vec2Dist(bot.head, other.head);

      // Danger detection: 8 ticks ahead prediction
      if (dist < this.config.botEvadeRadius) {
        const futureHead = moveHead(other, this.config, 8);
        const futureDist = vec2Dist(bot.head, futureHead);
        if (futureDist < this.config.botEvadeRadius * 0.8) {
          ai.inDanger = true;
          ai.dangerAngle = angleBetween(other.head, bot.head);
          break;
        }
      }

      // Avoid body segments
      if (dist < 150) {
        // Check if we're heading toward the body
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

  private botDecide(bot: SnakeState, ai: BotAIState) {
    if (ai.inDanger) {
      ai.targetFoodId = null;
      return;
    }

    // Find nearest food within scan radius
    let nearestFood: FoodOrb | null = null;
    let nearestDist = this.config.botFoodScanRadius;

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
    this.phase = 'ended';
  }
}
