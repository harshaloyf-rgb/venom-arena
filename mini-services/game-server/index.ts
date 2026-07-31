// ============================================================
// Venom Arena — Complete Online Game Server (Socket.IO, port 3001)
// Single-file, server-authoritative, 30-tick game loop
// ============================================================

import { Server, Socket } from 'socket.io';

// ---- Inline Type Definitions (copied from game-types.ts) ----

interface Point {
  x: number;
  y: number;
}

interface Snake {
  id: string;
  name: string;
  userTag?: string;
  points: Point[];
  angle: number;
  targetAngle: number;
  size: number;
  color: string;
  isPlayer: boolean;
  isBot: boolean;
  isDead: boolean;
  score: number;
  kills: number;
  carriedChips: number;
  isBoosting: boolean;
  isExtracting: boolean;
  extractionProgress: number;
  spawnProtected: boolean;
  botTarget?: Point | null;
  botState?: 'wander' | 'chase' | 'flee' | 'harvest';
  deathTime?: number;
}

interface Food {
  id: string;
  x: number;
  y: number;
  size: number;
  value: number;
  isStarChip: boolean;
  color: string;
  glowColor?: string;
}

interface GameSnapshot {
  tick: number;
  snakes: Snake[];
  foods: Food[];
  worldSize: number;
  killFeed: KillFeedEntry[];
}

interface KillFeedEntry {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  tick: number;
}

interface PlayerInput {
  targetAngle: number;
  boosting: boolean;
  extracting: boolean;
}

// ---- Constants ----

const SNAKE_COLORS = [
  '#ef4444', '#f59e0b', '#06b6d4', '#a855f7', '#ec4899',
  '#f97316', '#14b8a6', '#6366f1', '#84cc16',
];

const BOT_NAMES = [
  'Viper', 'Cobra', 'Mamba', 'Asp', 'Python',
  'Rattler', 'Taipan', 'Krait', 'Adder', 'Boa',
  'Sidewinder', 'Copperhead', 'Kingsnake', 'Coral', 'Cottonmouth',
  'Diamondback', 'Bushmaster', 'Ferdelance', 'BlackMamba', 'Basilisk',
];

const PLAYER_COLOR = '#22c55e';

const CFG = {
  worldSize: 5000,
  foodCount: 300,
  starChipCount: 15,
  botCount: 20,
  snakeSpeed: 3,
  boostSpeed: 5.5,
  turnSpeed: 0.08,
  initialScore: 20,
  segmentSpacing: 8,
  collisionRadius: 10,
  foodRadius: 5,
  starRadius: 8,
  extractionTime: 5000,
  spawnProtectionTime: 3000,
  deathFoodDropRate: 0.4,
  deathStarDropCount: 10,
  botReactionTime: 200,
  tickRate: 33, // ~30fps
};

const FOOD_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#60a5fa', '#c084fc', '#f472b6'];

// ---- Helpers ----

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}_${++idCounter}`;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalizeAngle(a: number): number {
 while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function lerpAngle(from: number, to: number, t: number): number {
  const diff = normalizeAngle(to - from);
  return from + diff * t;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function snakeRadius(score: number): number {
  return Math.min(6 + score * 0.04, 20);
}

function bodySegmentCount(score: number): number {
  return Math.max(Math.floor(score), 1);
}

// ---- Game State ----

const snakes: Snake[] = [];
const foods: Food[] = [];
const killFeed: KillFeedEntry[] = [];
let tick = 0;

const playerInputs = new Map<string, PlayerInput>();
const socketSnakeMap = new Map<string, string>(); // socketId -> snakeId
const snakeSocketMap = new Map<string, string>(); // snakeId -> socketId
const spawnTimes = new Map<string, number>();

// ---- Snake Factory ----

function findSafeSpawnPoint(): Point {
  const margin = 300;
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = randRange(margin, CFG.worldSize - margin);
    const y = randRange(margin, CFG.worldSize - margin);
    let safe = true;
    for (const snake of snakes) {
      if (snake.isDead) continue;
      if (dist(x, y, snake.points[0].x, snake.points[0].y) < 150) {
        safe = false;
        break;
      }
    }
    if (safe) return { x, y };
  }
  return { x: CFG.worldSize / 2 + randRange(-200, 200), y: CFG.worldSize / 2 + randRange(-200, 200) };
}

function createSnake(name: string, color: string, isPlayer: boolean, isBot: boolean): Snake {
  const spawn = findSafeSpawnPoint();
  const angle = Math.random() * Math.PI * 2;
  const segCount = bodySegmentCount(CFG.initialScore);
  const points: Point[] = [];
  for (let i = 0; i < segCount; i++) {
    points.push({
      x: spawn.x - Math.cos(angle) * i * CFG.segmentSpacing,
      y: spawn.y - Math.sin(angle) * i * CFG.segmentSpacing,
    });
  }

  const snake: Snake = {
    id: nextId('snake'),
    name,
    points,
    angle,
    targetAngle: angle,
    size: snakeRadius(CFG.initialScore),
    color,
    isPlayer,
    isBot,
    isDead: false,
    score: CFG.initialScore,
    kills: 0,
    carriedChips: 0,
    isBoosting: false,
    isExtracting: false,
    extractionProgress: 0,
    spawnProtected: true,
    botState: isBot ? 'wander' : undefined,
    botTarget: isBot ? null : undefined,
  };

  // Register spawn time for protection tracking
  spawnTimes.set(snake.id, Date.now());
  return snake;
}

// ---- Food Factory ----

function createFood(isStarChip: boolean): Food {
  const margin = 50;
  return {
    id: nextId('food'),
    x: randRange(margin, CFG.worldSize - margin),
    y: randRange(margin, CFG.worldSize - margin),
    size: isStarChip ? CFG.starRadius : CFG.foodRadius,
    value: isStarChip ? 5 : 1,
    isStarChip,
    color: isStarChip ? '#fbbf24' : pickRandom(FOOD_COLORS),
    glowColor: isStarChip ? '#fde68a' : undefined,
  };
}

function initFoods(): void {
  for (let i = 0; i < CFG.foodCount; i++) foods.push(createFood(false));
  for (let i = 0; i < CFG.starChipCount; i++) foods.push(createFood(true));
}

function maintainFoodCount(): void {
  let regularCount = 0;
  let starCount = 0;
  for (const f of foods) {
    if (f.isStarChip) starCount++;
    else regularCount++;
  }

  const regularToSpawn = CFG.foodCount - regularCount;
  for (let i = 0; i < regularToSpawn; i++) foods.push(createFood(false));

  const starToSpawn = CFG.starChipCount - starCount;
  for (let i = 0; i < starToSpawn; i++) foods.push(createFood(true));
}

// ---- Movement ----

function moveSnake(snake: Snake): void {
  if (snake.isDead) return;

  const speed = snake.isBoosting ? CFG.boostSpeed : CFG.snakeSpeed;

  // Smooth angle interpolation
  snake.angle = lerpAngle(snake.angle, snake.targetAngle, CFG.turnSpeed);

  // Move head
  const head = snake.points[0];
  const newHead: Point = {
    x: head.x + Math.cos(snake.angle) * speed,
    y: head.y + Math.sin(snake.angle) * speed,
  };
  snake.points.unshift(newHead);

  // Trim tail to correct length
  const targetLen = bodySegmentCount(snake.score);
  while (snake.points.length > targetLen) {
    snake.points.pop();
  }

  // Update visual size
  snake.size = snakeRadius(snake.score);

  // Boost cost: lose 0.15 score per tick
  if (snake.isBoosting && snake.score > CFG.initialScore) {
    snake.score = Math.max(CFG.initialScore, snake.score - 0.15);
  }
}

// ---- Food Collision ----

function tickFoodCollision(snake: Snake): void {
  if (snake.isDead) return;

  const head = snake.points[0];
  const eatRadius = snake.size + CFG.foodRadius;

  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    if (dist(head.x, head.y, food.x, food.y) < eatRadius) {
      if (food.isStarChip) {
        snake.carriedChips += food.value;
      } else {
        snake.score += food.value;
      }
      foods.splice(i, 1);
    }
  }
}

// ---- Snake-Snake Collision ----

function tickSnakeCollision(): void {
  // Collect deaths to process after iteration to avoid mutation during loop
  const deaths: Array<{ victim: Snake; killer: Snake | null; dropLoot: boolean }> = [];

  for (let i = 0; i < snakes.length; i++) {
    const victim = snakes[i];
    if (victim.isDead || victim.spawnProtected) continue;

    const vHead = victim.points[0];

    // Wall death
    if (vHead.x < 0 || vHead.x > CFG.worldSize || vHead.y < 0 || vHead.y > CFG.worldSize) {
      deaths.push({ victim, killer: null, dropLoot: false });
      continue;
    }

    // Check against other snakes' bodies
    for (let j = 0; j < snakes.length; j++) {
      if (i === j) continue;
      const other = snakes[j];
      if (other.isDead) continue;

      const oRadius = CFG.collisionRadius;
      const combinedRadius = CFG.collisionRadius + oRadius;
      const oHead = other.points[0];

      // Quick bounding check: if victim head is farther than the entire body extent, skip
      const quickDist = dist(vHead.x, vHead.y, oHead.x, oHead.y);
      const bodyExtent = Math.min((other.points.length - 1) * CFG.segmentSpacing, 800);
      if (quickDist > bodyExtent + combinedRadius) continue;

      // Check head against body segments (skip first 5 for neck protection)
      let collided = false;
      for (let k = 5; k < other.points.length; k++) {
        const seg = other.points[k];
        if (dist(vHead.x, vHead.y, seg.x, seg.y) < combinedRadius) {
          collided = true;
          break;
        }
      }

      if (collided) {
        // Head-on: if heads are very close, it's a head-to-head collision
        if (quickDist < combinedRadius * 2) {
          if (victim.score < other.score) {
            deaths.push({ victim, killer: other, dropLoot: true });
          } else if (victim.score > other.score) {
            deaths.push({ victim: other, killer: victim, dropLoot: true });
          } else {
            // Equal: both die
            deaths.push({ victim, killer: other, dropLoot: true });
            deaths.push({ victim: other, killer: victim, dropLoot: true });
          }
        } else {
          // Body collision: victim ran into other's body
          deaths.push({ victim, killer: other, dropLoot: true });
        }
        break; // victim can only die once per tick
      }
    }
  }

  // Process all collected deaths
  for (const d of deaths) {
    killSnake(d.victim, d.killer, d.dropLoot);
  }
}

// ---- Death Handling ----

function killSnake(victim: Snake, killer: Snake | null, dropLoot: boolean): void {
  if (victim.isDead) return;
  victim.isDead = true;
  victim.deathTime = Date.now();
  victim.isBoosting = false;
  victim.isExtracting = false;

  if (dropLoot) {
    // Drop food orbs along body
    const orbCount = Math.max(1, Math.floor(victim.score * CFG.deathFoodDropRate));
    const step = Math.max(1, Math.floor(victim.points.length / orbCount));
    for (let i = 0; i < victim.points.length; i += step) {
      const p = victim.points[i];
      foods.push({
        id: nextId('food'),
        x: p.x + randRange(-10, 10),
        y: p.y + randRange(-10, 10),
        size: CFG.foodRadius + 1,
        value: 1,
        isStarChip: false,
        color: victim.color,
      });
    }

    // Drop star chips at head if snake had any
    if (victim.carriedChips > 0) {
      const starCount = Math.min(victim.carriedChips, CFG.deathStarDropCount);
      const head = victim.points[0];
      for (let i = 0; i < starCount; i++) {
        foods.push({
          id: nextId('food'),
          x: head.x + randRange(-30, 30),
          y: head.y + randRange(-30, 30),
          size: CFG.starRadius,
          value: 5,
          isStarChip: true,
          color: '#fbbf24',
          glowColor: '#fde68a',
        });
      }
    }
  }

  // Award kill to killer
  if (killer && !killer.isDead) {
    killer.kills += 1;
    killer.score += Math.floor(victim.score * 0.1);
  }

  // Kill feed
  const killerName = killer ? killer.name : 'Wall';
  killFeed.push({
    killerId: killer?.id || 'wall',
    killerName,
    victimId: victim.id,
    victimName: victim.name,
    tick,
  });
  while (killFeed.length > 10) killFeed.shift();

  // Send you_died to player
  const socketId = snakeSocketMap.get(victim.id);
  if (socketId) {
    io.to(socketId).emit('you_died', {
      killerName,
      score: victim.score,
      kills: victim.kills,
      chips: victim.carriedChips,
    });
  }

  console.log(
    `[Death] ${victim.name} killed by ${killerName} | score: ${Math.floor(victim.score)} | drops: ${dropLoot ? 'yes' : 'no (wall)'}`
  );
}

// ---- Bot AI ----

function tickBotAI(snake: Snake): void {
  if (snake.isDead || !snake.isBot) return;

  const head = snake.points[0];
  const wallMargin = 200;

  // Wall avoidance (highest priority)
  if (
    head.x < wallMargin || head.x > CFG.worldSize - wallMargin ||
    head.y < wallMargin || head.y > CFG.worldSize - wallMargin
  ) {
    const cx = CFG.worldSize / 2;
    const cy = CFG.worldSize / 2;
    snake.targetAngle = Math.atan2(cy - head.y, cx - head.x);
    snake.botState = 'wander';
    snake.isBoosting = false;
    return;
  }

  // Re-evaluate decision periodically (~2% chance per tick = ~every 1.5s at 30fps)
  if (!snake.botTarget || Math.random() < 0.02) {
    updateBotDecision(snake, head);
  }

  // Steer towards target
  if (snake.botTarget) {
    snake.targetAngle = Math.atan2(
      snake.botTarget.y - head.y,
      snake.botTarget.x - head.x,
    );
    // Add slight wobble for natural movement
    snake.targetAngle += (Math.random() - 0.5) * 0.1;
  }

  // Boost when chasing and close to prey
  snake.isBoosting =
    snake.botState === 'chase' && snake.botTarget
      ? dist(head.x, head.y, snake.botTarget.x, snake.botTarget.y) < 200
      : false;
}

function updateBotDecision(snake: Snake, head: Point): void {
  let nearestThreat: Snake | null = null;
  let nearestThreatDist = 300;
  let nearestPrey: Snake | null = null;
  let nearestPreyDist = 400;
  let nearestFood: Food | null = null;
  let nearestFoodDist = 500;

  for (const other of snakes) {
    if (other.id === snake.id || other.isDead) continue;
    const d = dist(head.x, head.y, other.points[0].x, other.points[0].y);

    if (other.score > snake.score * 1.2 && d < nearestThreatDist) {
      nearestThreat = other;
      nearestThreatDist = d;
    }
    if (other.score < snake.score * 0.7 && d < nearestPreyDist && !other.spawnProtected) {
      nearestPrey = other;
      nearestPreyDist = d;
    }
  }

  for (const food of foods) {
    const d = dist(head.x, head.y, food.x, food.y);
    if (d < nearestFoodDist) {
      nearestFood = food;
      nearestFoodDist = d;
    }
  }

  // Priority: flee > chase > harvest > wander
  if (nearestThreat && nearestThreatDist < 200) {
    snake.botState = 'flee';
    const tHead = nearestThreat.points[0];
    snake.botTarget = {
      x: head.x + (head.x - tHead.x) * 2,
      y: head.y + (head.y - tHead.y) * 2,
    };
    snake.isBoosting = true;
  } else if (nearestPrey && nearestPreyDist < 300 && snake.score > 30) {
    snake.botState = 'chase';
    snake.botTarget = nearestPrey.points[0];
  } else if (nearestFood) {
    snake.botState = 'harvest';
    snake.botTarget = { x: nearestFood.x, y: nearestFood.y };
    snake.isBoosting = false;
  } else {
    snake.botState = 'wander';
    snake.botTarget = {
      x: clamp(head.x + randRange(-300, 300), 100, CFG.worldSize - 100),
      y: clamp(head.y + randRange(-300, 300), 100, CFG.worldSize - 100),
    };
    snake.isBoosting = false;
  }
}

// ---- Extraction (star chips → score conversion) ----

function tickExtraction(snake: Snake): void {
  if (snake.isDead || !snake.isExtracting || snake.carriedChips <= 0) {
    snake.isExtracting = false;
    snake.extractionProgress = 0;
    return;
  }

  snake.extractionProgress += CFG.tickRate;
  if (snake.extractionProgress >= CFG.extractionTime) {
    const bonus = snake.carriedChips * 10;
    snake.score += bonus;
    console.log(`[Extract] ${snake.name} extracted ${snake.carriedChips} chips → +${bonus} score`);
    snake.carriedChips = 0;
    snake.extractionProgress = 0;
    snake.isExtracting = false;
  }
}

// ---- Spawn Protection ----

function tickSpawnProtection(): void {
  const now = Date.now();
  for (const snake of snakes) {
    if (snake.spawnProtected) {
      const st = spawnTimes.get(snake.id);
      if (st && now - st > CFG.spawnProtectionTime) {
        snake.spawnProtected = false;
      }
    }
  }
}

// ---- Bot Management ----

let botNameIndex = 0;

function spawnBot(): Snake {
  const name = BOT_NAMES[botNameIndex % BOT_NAMES.length];
  botNameIndex++;
  const color = SNAKE_COLORS[botNameIndex % SNAKE_COLORS.length];
  const bot = createSnake(name, color, false, true);
  snakes.push(bot);
  return bot;
}

function maintainBots(): void {
  const now = Date.now();

  // 1. Collect dead bots that should respawn (3s cooldown)
  const toRemove: number[] = [];
  for (let i = 0; i < snakes.length; i++) {
    const snake = snakes[i];
    if (snake.isBot && snake.isDead && snake.deathTime && now - snake.deathTime > 3000) {
      toRemove.push(i);
    }
  }

  // 2. Remove dead bots (iterate in reverse to preserve indices)
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const idx = toRemove[i];
    spawnTimes.delete(snakes[idx].id);
    snakes.splice(idx, 1);
  }

  // 3. Count alive bots after cleanup
  let aliveBots = 0;
  for (const snake of snakes) {
    if (snake.isBot && !snake.isDead) aliveBots++;
  }

  // 4. Spawn deficit bots
  const deficit = CFG.botCount - aliveBots;
  for (let i = 0; i < deficit; i++) {
    spawnBot();
  }
}

// ---- Main Game Tick ----

function gameTick(): void {
  tick++;

  // 1. Process player inputs
  for (const snake of snakes) {
    if (snake.isDead || !snake.isPlayer) continue;
    const input = playerInputs.get(snake.id);
    if (input) {
      snake.targetAngle = input.targetAngle;
      snake.isBoosting = input.boosting;
      snake.isExtracting = input.extracting;
    }
  }

  // 2. Bot AI
  for (const snake of snakes) {
    if (snake.isBot && !snake.isDead) {
      tickBotAI(snake);
    }
  }

  // 3. Move all snakes
  for (const snake of snakes) {
    moveSnake(snake);
  }

  // 4. Food collision
  for (const snake of snakes) {
    tickFoodCollision(snake);
  }

  // 5. Snake collision
  tickSnakeCollision();

  // 6. Extraction
  for (const snake of snakes) {
    tickExtraction(snake);
  }

  // 7. Spawn protection
  tickSpawnProtection();

  // 8. Maintain food count
  maintainFoodCount();

  // 9. Bot management
  maintainBots();

  // 10. Build and broadcast snapshot (include ALL foods, including death drops)
  const snapshot: GameSnapshot = {
    tick,
    snakes: snakes.filter(s => !s.isDead),
    foods,
    worldSize: CFG.worldSize,
    killFeed,
  };

  io.emit('snapshot', snapshot);
}

// ---- Socket.IO Server ----

const io = new Server(3001, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket: Socket) => {
  console.log(`[Connect] socket=${socket.id}`);

  socket.on('join', (data: { name: string; userTag?: string }) => {
    const name = (data.name || 'Player').slice(0, 20);
    const snake = createSnake(name, PLAYER_COLOR, true, false);
    if (data.userTag) snake.userTag = data.userTag;

    snakes.push(snake);
    socketSnakeMap.set(socket.id, snake.id);
    snakeSocketMap.set(snake.id, socket.id);

    console.log(`[Join] ${name} (${snake.id}) | players: ${snakes.filter(s => s.isPlayer && !s.isDead).length}`);
  });

  socket.on('input', (data: PlayerInput) => {
    const snakeId = socketSnakeMap.get(socket.id);
    if (snakeId) {
      playerInputs.set(snakeId, data);
    }
  });

  socket.on('disconnect', () => {
    const snakeId = socketSnakeMap.get(socket.id);
    if (!snakeId) return;

    const idx = snakes.findIndex(s => s.id === snakeId);
    if (idx !== -1) {
      const snake = snakes[idx];
      if (!snake.isDead) {
        // Drop loot on disconnect (treat as kill, not wall death)
        killSnake(snake, null, true);
      }
      snakes.splice(idx, 1);
    }

    playerInputs.delete(snakeId);
    socketSnakeMap.delete(socket.id);
    snakeSocketMap.delete(snakeId);
    spawnTimes.delete(snakeId);
    console.log(`[Disconnect] socket=${socket.id} snake=${snakeId}`);
  });
});

// ---- Initialization ----

console.log('================================================');
console.log('  Venom Arena Game Server — Starting on port 3001');
console.log('================================================');

initFoods();

for (let i = 0; i < CFG.botCount; i++) {
  spawnBot();
}

console.log(`[Init] Spawned ${CFG.foodCount} food, ${CFG.starChipCount} stars, ${CFG.botCount} bots`);
console.log(`[Init] Game tick: ${CFG.tickRate}ms (~${Math.round(1000 / CFG.tickRate)} fps)`);
console.log(`[Init] World size: ${CFG.worldSize}x${CFG.worldSize}`);

// Start game loop
setInterval(gameTick, CFG.tickRate);

console.log('[Init] Game loop started — server ready');
