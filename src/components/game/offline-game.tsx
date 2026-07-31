'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { Snake, Food, Particle, KillFeedEntry, Point } from '@/lib/game-types';
import { SNAKE_COLORS, BOT_NAMES } from '@/lib/game-types';
import { DEFAULT_CONFIG, DIFFICULTY_PRESETS, snakeRadius, bodySegmentCount } from '@/lib/game-config';

interface OfflineGameProps {
  difficulty: 'easy' | 'medium' | 'hard';
  onExit: (score: number, kills: number) => void;
}

// ─── Helpers ───────────────────────────────────────────────

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleTo(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function lerpAngle(from: number, to: number, t: number): number {
  const diff = normalizeAngle(to - from);
  return from + diff * t;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}

const WARM_FOOD_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#fb923c', '#fbbf24'];

let _foodId = 0;
function makeFoodId(): string {
  return `f${++_foodId}`;
}

let _snakeId = 0;
function makeSnakeId(): string {
  return `s${++_snakeId}`;
}

// ─── Component ─────────────────────────────────────────────

export default function OfflineGame({ difficulty, onExit }: OfflineGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hudScore, setHudScore] = useState(0);
  const [hudKills, setHudKills] = useState(0);
  const [hudRank, setHudRank] = useState(1);
  const [hudKillFeed, setHudKillFeed] = useState<KillFeedEntry[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalKills, setFinalKills] = useState(0);
  const [playerId, setPlayerId] = useState('');

  // All mutable game state in refs
  const gs = useRef({
    snakes: [] as Snake[],
    foods: [] as Food[],
    particles: [] as Particle[],
    killFeed: [] as KillFeedEntry[],
    camera: { x: 0, y: 0, zoom: 1 },
    mousePos: { x: 0, y: 0 },
    gameOver: false,
    score: 0,
    kills: 0,
    boosting: false,
    lastBotThink: 0,
    tick: 0,
    config: { ...DEFAULT_CONFIG, ...DIFFICULTY_PRESETS[difficulty] },
    playerId: '',
    worldSize: DEFAULT_CONFIG.worldSize,
    animFrame: 0,
    lastTime: 0,
    hudTimer: 0,
    killFeedTimer: 0,
    spawnTimes: new Map<string, number>(),
    deathShown: false,
  });

  // Stable ref for onExit
  const onExitRef = useRef(onExit);
  useEffect(() => { onExitRef.current = onExit; }, [onExit]);

  // ─── Event Handlers (declared first, no deps) ──────────

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      const g = gs.current;
      const player = g.snakes.find(s => s.id === g.playerId && !s.isDead);
      if (player) player.isBoosting = true;
      g.boosting = true;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      const g = gs.current;
      const player = g.snakes.find(s => s.id === g.playerId && !s.isDead);
      if (player) player.isBoosting = false;
      g.boosting = false;
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    gs.current.mousePos = { x, y };

    const g = gs.current;
    const player = g.snakes.find(s => s.id === g.playerId && !s.isDead);
    if (!player || player.points.length === 0) return;

    const head = player.points[0];
    const cam = g.camera;
    const cssW = rect.width;
    const cssH = rect.height;
    const worldX = (x - cssW / 2) / cam.zoom + cam.x;
    const worldY = (y - cssH / 2) / cam.zoom + cam.y;
    player.targetAngle = angleTo(head, { x: worldX, y: worldY });
  }, []);

  const handleMouseDown = useCallback(() => {
    const g = gs.current;
    const player = g.snakes.find(s => s.id === g.playerId && !s.isDead);
    if (player) player.isBoosting = true;
    g.boosting = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    const g = gs.current;
    const player = g.snakes.find(s => s.id === g.playerId && !s.isDead);
    if (player) player.isBoosting = false;
    g.boosting = false;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ─── Init helpers ───────────────────────────────────────

  const spawnFood = useCallback((foods: Food[], isStar: boolean, x?: number, y?: number, size?: number, value?: number, color?: string, glowColor?: string): Food => {
    const ws = gs.current.worldSize;
    const fx = x ?? randRange(50, ws - 50);
    const fy = y ?? randRange(50, ws - 50);
    if (isStar) {
      return {
        id: makeFoodId(), x: fx, y: fy,
        size: size ?? 8, value: value ?? 5,
        isStarChip: true,
        color: color ?? '#fbbf24',
        glowColor: glowColor ?? '#fde68a',
      };
    }
    return {
      id: makeFoodId(), x: fx, y: fy,
      size: size ?? randRange(4, 7), value: value ?? 1,
      isStarChip: false,
      color: color ?? WARM_FOOD_COLORS[randInt(0, WARM_FOOD_COLORS.length - 1)],
    };
  }, []);

  const spawnSnake = useCallback((name: string, color: string, isPlayer: boolean, isBot: boolean, x?: number, y?: number): Snake => {
    const cfg = gs.current.config;
    const ws = gs.current.worldSize;
    const sx = x ?? randRange(200, ws - 200);
    const sy = y ?? randRange(200, ws - 200);
    const angle = Math.random() * Math.PI * 2;
    const segCount = bodySegmentCount(cfg.initialScore);
    const points: Point[] = [];
    for (let i = 0; i < segCount; i++) {
      points.push({
        x: sx - Math.cos(angle) * i * cfg.segmentSpacing,
        y: sy - Math.sin(angle) * i * cfg.segmentSpacing,
      });
    }
    return {
      id: makeSnakeId(), name, points, angle, targetAngle: angle,
      size: snakeRadius(cfg.initialScore), color,
      isPlayer, isBot, isDead: false,
      score: cfg.initialScore, kills: 0, carriedChips: 0,
      isBoosting: false, isExtracting: false, extractionProgress: 0,
      spawnProtected: true,
      botState: 'wander', botTarget: null, deathTime: undefined,
    };
  }, []);

  const initGame = useCallback(() => {
    const g = gs.current;
    const cfg = g.config;
    const ws = cfg.worldSize;
    const player = spawnSnake('You', '#22c55e', true, false, ws / 2, ws / 2);
    player.spawnProtected = false;
    g.playerId = player.id;
    setPlayerId(player.id);

    const bots: Snake[] = [];
    const usedColors = new Set(['#22c55e']);
    for (let i = 0; i < cfg.botCount; i++) {
      const availableColors = SNAKE_COLORS.filter(c => !usedColors.has(c));
      const color = availableColors.length > 0
        ? availableColors[i % availableColors.length]
        : SNAKE_COLORS[i % SNAKE_COLORS.length];
      usedColors.add(color);
      bots.push(spawnSnake(BOT_NAMES[i % BOT_NAMES.length], color, false, true));
    }

    g.snakes = [player, ...bots];
    g.foods = [];
    for (let i = 0; i < cfg.foodCount; i++) g.foods.push(spawnFood(g.foods, false));
    for (let i = 0; i < cfg.starChipCount; i++) g.foods.push(spawnFood(g.foods, true));
    g.particles = [];
    g.killFeed = [];
    g.gameOver = false;
    g.score = 0;
    g.kills = 0;
    g.boosting = false;
    g.tick = 0;
    g.lastBotThink = 0;
    g.camera = { x: ws / 2, y: ws / 2, zoom: 1 };
    g.mousePos = { x: 0, y: 0 };
    g.spawnTimes = new Map<string, number>();
    g.deathShown = false;
    g.lastTime = 0;
    _foodId = 0;
    _snakeId = 0;
  }, [spawnFood, spawnSnake]);

  // ─── Bot AI ────────────────────────────────────────────

  const thinkBots = useCallback((now: number) => {
    const g = gs.current;
    const cfg = g.config;
    if (now - g.lastBotThink < cfg.botReactionTime) return;
    g.lastBotThink = now;

    const ws = g.worldSize;
    const aliveBots = g.snakes.filter(s => s.isBot && !s.isDead);

    for (const bot of aliveBots) {
      const head = bot.points[0];
      let nearestThreat: Snake | null = null;
      let nearestThreatDist = Infinity;
      let nearestPrey: Snake | null = null;
      let nearestPreyDist = Infinity;
      let nearestFood: Food | null = null;
      let nearestFoodDist = Infinity;

      for (const other of g.snakes) {
        if (other.id === bot.id || other.isDead) continue;
        const d = dist(head, other.points[0]);
        if (other.score > bot.score * 1.2) {
          if (d < 400 && d < nearestThreatDist) { nearestThreat = other; nearestThreatDist = d; }
        } else if (bot.score > other.score * 1.2) {
          if (d < 500 && d < nearestPreyDist) { nearestPrey = other; nearestPreyDist = d; }
        }
      }

      for (const food of g.foods) {
        const d = dist(head, { x: food.x, y: food.y });
        if (d < nearestFoodDist) { nearestFood = food; nearestFoodDist = d; }
      }

      const wallDist = Math.min(head.x, head.y, ws - head.x, ws - head.y);
      if (wallDist < 300) {
        bot.targetAngle = angleTo(head, { x: ws / 2, y: ws / 2 }) + randRange(-0.3, 0.3);
        bot.botState = 'flee';
        bot.isBoosting = wallDist < 150;
        continue;
      }

      if (nearestThreat && nearestThreatDist < 250) {
        bot.botState = 'flee';
        bot.botTarget = {
          x: head.x - Math.cos(angleTo(nearestThreat.points[0], head)) * 300,
          y: head.y - Math.sin(angleTo(nearestThreat.points[0], head)) * 300,
        };
        bot.isBoosting = nearestThreatDist < 150;
      } else if (nearestPrey && nearestPreyDist < 350 && Math.random() > 0.3) {
        bot.botState = 'chase';
        bot.botTarget = nearestPrey.points[0];
        bot.isBoosting = nearestPreyDist < 200;
      } else if (nearestFood && nearestFoodDist < 600) {
        bot.botState = 'harvest';
        bot.botTarget = { x: nearestFood.x, y: nearestFood.y };
        bot.isBoosting = false;
      } else {
        bot.botState = 'wander';
        if (!bot.botTarget || dist(head, bot.botTarget) < 50) {
          bot.botTarget = {
            x: Math.max(100, Math.min(ws - 100, head.x + randRange(-500, 500))),
            y: Math.max(100, Math.min(ws - 100, head.y + randRange(-500, 500))),
          };
        }
        bot.isBoosting = false;
      }

      if (bot.botTarget) {
        const targetAngle = angleTo(head, bot.botTarget);
        const wobble = difficulty === 'easy' ? 0.15 : difficulty === 'medium' ? 0.08 : 0.03;
        bot.targetAngle = targetAngle + randRange(-wobble, wobble);
      }
    }
  }, [difficulty]);

  // ─── Particles ─────────────────────────────────────────

  const spawnParticles = useCallback((x: number, y: number, color: string, count: number, speed: number) => {
    const g = gs.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = randRange(speed * 0.5, speed);
      g.particles.push({
        x, y,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        life: 1, maxLife: randRange(0.4, 0.8),
        color, size: randRange(2, 5),
      });
    }
  }, []);

  // ─── Kill a snake ─────────────────────────────────────

  const killSnake = useCallback((snake: Snake, killer: Snake | null, isWallDeath: boolean) => {
    const g = gs.current;
    const cfg = g.config;
    snake.isDead = true;
    snake.deathTime = g.tick;

    if (killer && killer.id !== snake.id) {
      killer.kills++;
      g.killFeed.push({
        killerId: killer.id, killerName: killer.name,
        victimId: snake.id, victimName: snake.name, tick: g.tick,
      });
      if (g.killFeed.length > 5) g.killFeed.shift();
    }

    if (!isWallDeath) {
      const foodDropCount = Math.floor(snake.score * cfg.deathFoodDropRate);
      if (foodDropCount > 0) {
        const step = Math.max(1, Math.floor(snake.points.length / foodDropCount));
        for (let i = 0; i < foodDropCount && i * step < snake.points.length; i++) {
          const p = snake.points[i * step];
          g.foods.push(spawnFood(
            g.foods, false,
            p.x + randRange(-10, 10), p.y + randRange(-10, 10),
            randRange(5, 8),
            Math.max(1, Math.floor(snake.score / foodDropCount)),
            snake.color,
          ));
        }
      }

      if (snake.carriedChips > 0) {
        const starCount = Math.min(snake.carriedChips, cfg.deathStarDropCount);
        for (let i = 0; i < starCount; i++) {
          g.foods.push(spawnFood(
            g.foods, true,
            snake.points[0].x + randRange(-30, 30),
            snake.points[0].y + randRange(-30, 30),
            8, 5, '#fbbf24', '#fde68a',
          ));
        }
      }
    }

    const burstPoints = Math.min(snake.points.length, 20);
    const bodyStep = Math.max(1, Math.floor(snake.points.length / burstPoints));
    for (let i = 0; i < burstPoints && i * bodyStep < snake.points.length; i++) {
      const p = snake.points[i * bodyStep];
      spawnParticles(p.x, p.y, snake.color, randInt(2, 4), 3);
    }

    if (snake.id === g.playerId) {
      g.gameOver = true;
      g.score = snake.score;
      g.kills = snake.kills;
    }

    if (snake.isBot) {
      setTimeout(() => {
        const currentG = gs.current;
        if (currentG.gameOver) return;
        const availableColors = SNAKE_COLORS.filter(c =>
          !currentG.snakes.some(s => !s.isDead && s.color === c)
        );
        const color = availableColors.length > 0
          ? availableColors[randInt(0, availableColors.length - 1)]
          : SNAKE_COLORS[randInt(0, SNAKE_COLORS.length - 1)];
        const newBot = spawnSnake(
          BOT_NAMES[randInt(0, BOT_NAMES.length - 1)], color, false, true
        );
        newBot.spawnProtected = true;
        currentG.spawnTimes.set(newBot.id, Date.now());
        currentG.snakes.push(newBot);
      }, 3000);
    }
  }, [spawnFood, spawnParticles, spawnSnake]);

  // ─── Game Update ───────────────────────────────────────

  const update = useCallback((dt: number, now: number) => {
    const g = gs.current;
    if (g.gameOver) return;

    const cfg = g.config;
    const ws = g.worldSize;
    g.tick++;

    thinkBots(now);

    const aliveSnakes = g.snakes.filter(s => !s.isDead);

    for (const snake of aliveSnakes) {
      snake.angle = lerpAngle(snake.angle, snake.targetAngle, cfg.turnSpeed);

      const speed = snake.isBoosting ? cfg.boostSpeed : cfg.snakeSpeed;
      if (snake.isBoosting && snake.score > 10) snake.score -= dt * 2;

      const head = snake.points[0];
      const newHead: Point = {
        x: head.x + Math.cos(snake.angle) * speed,
        y: head.y + Math.sin(snake.angle) * speed,
      };
      snake.points.unshift(newHead);

      const targetLen = bodySegmentCount(Math.max(0, snake.score));
      while (snake.points.length > targetLen) snake.points.pop();
      snake.size = snakeRadius(snake.score);

      if (newHead.x < 0 || newHead.x > ws || newHead.y < 0 || newHead.y > ws) {
        killSnake(snake, null, true);
        continue;
      }

      for (let fi = g.foods.length - 1; fi >= 0; fi--) {
        const food = g.foods[fi];
        if (dist(newHead, { x: food.x, y: food.y }) < snake.size + food.size) {
          snake.score += food.value;
          if (food.isStarChip) snake.carriedChips++;
          spawnParticles(food.x, food.y, food.color, 5, 2);
          g.foods.splice(fi, 1);
        }
      }

      if (snake.spawnProtected) {
        if (!g.spawnTimes.has(snake.id)) g.spawnTimes.set(snake.id, now);
        if (now - (g.spawnTimes.get(snake.id) ?? now) > cfg.spawnProtectionTime) {
          snake.spawnProtected = false;
        }
      }
    }

    // Snake-snake collision
    const stillAlive = g.snakes.filter(s => !s.isDead);
    for (const snake of stillAlive) {
      if (snake.isDead) continue;
      const head = snake.points[0];
      for (const other of stillAlive) {
        if (other.id === snake.id || other.isDead) continue;
        const startSeg = other.spawnProtected ? 0 : 5;
        for (let si = startSeg; si < other.points.length; si++) {
          if (dist(head, other.points[si]) < snake.size + other.size * 0.8) {
            killSnake(snake, other, false);
            break;
          }
        }
        if (snake.isDead) break;
      }
    }

    // Particles
    for (let i = g.particles.length - 1; i >= 0; i--) {
      const p = g.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= dt / p.maxLife;
      if (p.life <= 0) g.particles.splice(i, 1);
    }

    // Maintain food
    const fc = g.foods.filter(f => !f.isStarChip).length;
    const sc = g.foods.filter(f => f.isStarChip).length;
    for (let i = fc; i < cfg.foodCount; i++) g.foods.push(spawnFood(g.foods, false));
    for (let i = sc; i < cfg.starChipCount; i++) g.foods.push(spawnFood(g.foods, true));

    // Cleanup dead snakes
    g.snakes = g.snakes.filter(s => {
      if (s.isDead && s.deathTime !== undefined) return g.tick - s.deathTime < 60;
      return true;
    });

    // Camera
    const player = g.snakes.find(s => s.id === g.playerId && !s.isDead);
    if (player) {
      const head = player.points[0];
      g.camera.x += (head.x - g.camera.x) * 0.08;
      g.camera.y += (head.y - g.camera.y) * 0.08;
      const tz = Math.max(0.4, 1 - player.score * 0.002);
      g.camera.zoom += (tz - g.camera.zoom) * 0.02;
      g.score = Math.floor(player.score);
      g.kills = player.kills;
    }

    // HUD updates (throttled)
    g.hudTimer += dt;
    if (g.hudTimer > 0.1) {
      g.hudTimer = 0;
      setHudScore(g.score);
      setHudKills(g.kills);
      const allScores = g.snakes.filter(s => !s.isDead).map(s => s.score).sort((a, b) => b - a);
      const rank = allScores.indexOf(g.score) + 1;
      setHudRank(rank > 0 ? rank : allScores.length + 1);
    }

    g.killFeedTimer += dt;
    if (g.killFeedTimer > 0.5) {
      g.killFeedTimer = 0;
      setHudKillFeed([...g.killFeed]);
    }

    if (g.gameOver && !g.deathShown) {
      g.deathShown = true;
      setIsDead(true);
      setFinalScore(g.score);
      setFinalKills(g.kills);
    }
  }, [thinkBots, killSnake, spawnFood, spawnParticles]);

  // ─── Render ────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const minimapCanvas = minimapRef.current;
    if (!canvas || !minimapCanvas) return;
    const g = gs.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const mctx = minimapCanvas.getContext('2d');
    if (!mctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cam = g.camera;
    const ws = g.worldSize;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // Grid
    const gridSize = 100;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    const sx = Math.max(0, Math.floor((cam.x - W / 2 / cam.zoom) / gridSize) * gridSize);
    const ex = Math.min(ws, Math.ceil((cam.x + W / 2 / cam.zoom) / gridSize) * gridSize);
    const sy = Math.max(0, Math.floor((cam.y - H / 2 / cam.zoom) / gridSize) * gridSize);
    const ey = Math.min(ws, Math.ceil((cam.y + H / 2 / cam.zoom) / gridSize) * gridSize);
    ctx.beginPath();
    for (let x = sx; x <= ex; x += gridSize) { ctx.moveTo(x, sy); ctx.lineTo(x, ey); }
    for (let y = sy; y <= ey; y += gridSize) { ctx.moveTo(sx, y); ctx.lineTo(ex, y); }
    ctx.stroke();

    // World boundary
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, ws, ws);

    // Food
    const time = g.tick * 0.05;
    for (const food of g.foods) {
      const fscX = (food.x - cam.x) * cam.zoom + W / 2;
      const fscY = (food.y - cam.y) * cam.zoom + H / 2;
      if (fscX < -50 || fscX > W + 50 || fscY < -50 || fscY > H + 50) continue;

      if (food.isStarChip) {
        const pulse = 1 + Math.sin(time * 3 + food.x) * 0.3;
        const glowSize = food.size * 3 * pulse;
        const grad = ctx.createRadialGradient(food.x, food.y, 0, food.x, food.y, glowSize);
        grad.addColorStop(0, food.glowColor ?? '#fde68a');
        grad.addColorStop(0.5, 'rgba(251, 191, 36, 0.3)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(food.x, food.y, glowSize, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = food.color;
        drawStar(ctx, food.x, food.y, 5, food.size * pulse, food.size * 0.5 * pulse);
        ctx.fill();
      } else {
        const glowSize = food.size * 2.5;
        const grad = ctx.createRadialGradient(food.x, food.y, 0, food.x, food.y, glowSize);
        grad.addColorStop(0, food.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(food.x, food.y, glowSize, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = food.color;
        ctx.beginPath(); ctx.arc(food.x, food.y, food.size, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Snakes
    for (const snake of g.snakes) {
      if (snake.isDead || snake.points.length < 2) continue;
      const head = snake.points[0];
      const snkX = (head.x - cam.x) * cam.zoom + W / 2;
      const snkY = (head.y - cam.y) * cam.zoom + H / 2;
      const bodyLen = snake.points.length * g.config.segmentSpacing;
      if (snkX < -bodyLen || snkX > W + bodyLen || snkY < -bodyLen || snkY > H + bodyLen) continue;

      const segCount = snake.points.length;
      for (let i = segCount - 1; i >= 1; i--) {
        const p = snake.points[i];
        const t = 1 - i / segCount;
        const radius = snake.size * (0.4 + 0.6 * t);
        ctx.globalAlpha = 0.3 + 0.7 * t;
        ctx.fillStyle = snake.color;
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Head
      const hr = snake.size;
      ctx.fillStyle = snake.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Eyes
      const eo = hr * 0.4;
      const es = hr * 0.3;
      const perp = snake.angle + Math.PI / 2;
      for (const side of [-1, 1]) {
        const eX = head.x + Math.cos(snake.angle) * eo * 0.5 + Math.cos(perp) * eo * side;
        const eY = head.y + Math.sin(snake.angle) * eo * 0.5 + Math.sin(perp) * eo * side;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(eX, eY, es, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(eX + Math.cos(snake.angle) * es * 0.3, eY + Math.sin(snake.angle) * es * 0.3, es * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(snake.name, head.x, head.y - hr - 10);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(`[${Math.floor(snake.score)}]`, head.x, head.y - hr - 24);

      if (snake.spawnProtected) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(head.x, head.y, hr + 8, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Particles
    for (const p of g.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Minimap
    const mW = minimapCanvas.width;
    const mH = minimapCanvas.height;
    const ms = mW / ws;
    mctx.fillStyle = 'rgba(0,0,0,0.7)';
    mctx.fillRect(0, 0, mW, mH);
    mctx.strokeStyle = '#333'; mctx.lineWidth = 1;
    mctx.strokeRect(0, 0, mW, mH);
    mctx.fillStyle = 'rgba(255,200,50,0.3)';
    for (let i = 0; i < g.foods.length; i += 5) {
      const f = g.foods[i];
      mctx.fillRect(f.x * ms, f.y * ms, 1, 1);
    }
    for (const snake of g.snakes) {
      if (snake.isDead || snake.points.length === 0) continue;
      const sh = snake.points[0];
      mctx.fillStyle = snake.isPlayer ? '#22c55e' : snake.color;
      mctx.beginPath();
      mctx.arc(sh.x * ms, sh.y * ms, snake.isPlayer ? 4 : 2, 0, Math.PI * 2);
      mctx.fill();
    }
    const vpL = (cam.x - W / 2 / cam.zoom) * ms;
    const vpT = (cam.y - H / 2 / cam.zoom) * ms;
    mctx.strokeStyle = 'rgba(255,255,255,0.4)'; mctx.lineWidth = 1;
    mctx.strokeRect(vpL, vpT, (W / cam.zoom) * ms, (H / cam.zoom) * ms);
  }, []);

  // ─── Stable refs for game loop ────────────────────────

  const updateRef = useRef(update);
  const renderRef = useRef(render);
  useEffect(() => { updateRef.current = update; }, [update]);
  useEffect(() => { renderRef.current = render; }, [render]);

  // ─── Effects ───────────────────────────────────────────

  // Resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, []);

  // Game loop + init
  useEffect(() => {
    let running = true;
    let lastTime = 0;

    const loop = (timestamp: number) => {
      if (!running) return;
      if (lastTime === 0) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;
      updateRef.current(dt, timestamp);
      renderRef.current();
      gs.current.animFrame = requestAnimationFrame(loop);
    };

    initGame();
    gs.current.animFrame = requestAnimationFrame(loop);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      running = false;
      cancelAnimationFrame(gs.current.animFrame);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [initGame, handleKeyDown, handleKeyUp]);

  // ─── Play Again handler ────────────────────────────────

  const handlePlayAgain = useCallback(() => {
    cancelAnimationFrame(gs.current.animFrame);
    setIsDead(false);
    setHudScore(0);
    setHudKills(0);
    setHudRank(1);
    setHudKillFeed([]);
    initGame();
    gs.current.lastTime = 0;
    let running = true;
    const loop = (timestamp: number) => {
      if (!running) return;
      if (gs.current.lastTime === 0) gs.current.lastTime = timestamp;
      const dt = Math.min((timestamp - gs.current.lastTime) / 1000, 0.05);
      gs.current.lastTime = timestamp;
      updateRef.current(dt, timestamp);
      renderRef.current();
      gs.current.animFrame = requestAnimationFrame(loop);
    };
    gs.current.animFrame = requestAnimationFrame(loop);
  }, [initGame]);

  // ─── Render JSX ────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black select-none">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Venom Arena game canvas"
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onPointerLeave={handleMouseUp}
      />

      {/* HUD - Score / Kills / Rank */}
      <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
          <div className="text-white text-2xl font-bold">{hudScore}</div>
          <div className="text-gray-400 text-sm">Score</div>
        </div>
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
          <div className="text-white text-lg font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2L13 8H7L10 2Z" />
            </svg>
            {hudKills}
          </div>
          <div className="text-gray-400 text-sm">Kills</div>
        </div>
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
          <div className="text-white text-lg font-semibold">#{hudRank}</div>
          <div className="text-gray-400 text-sm">Rank</div>
        </div>
      </div>

      {/* Leave button */}
      <button
        onClick={() => onExitRef.current(hudScore, hudKills)}
        className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm hover:bg-red-600/80 text-white rounded-lg px-4 py-2 border border-white/10 transition-colors cursor-pointer pointer-events-auto"
      >
        ✕ Leave
      </button>

      {/* Boost hint */}
      <div className="absolute bottom-4 right-4 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 text-gray-300 text-xs">
          Boost: <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono">SPACE</kbd> or <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono">CLICK</kbd>
        </div>
      </div>

      {/* Quick Chat */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
        {['GG', 'Target', 'Flee', 'Ripped', 'Extracting'].map((msg) => (
          <button
            key={msg}
            className="bg-black/60 backdrop-blur-sm hover:bg-white/10 text-gray-300 hover:text-white rounded-lg px-3 py-1.5 border border-white/10 text-xs transition-colors cursor-pointer"
          >
            {msg}
          </button>
        ))}
      </div>

      {/* Kill Feed */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
        {hudKillFeed.map((entry) => (
          <div
            key={`${entry.killerId}-${entry.victimId}-${entry.tick}`}
            className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1 border border-white/10 text-sm text-white"
          >
            <span className={entry.killerId === playerId ? 'text-green-400 font-bold' : 'text-red-400'}>
              {entry.killerName}
            </span>
            <span className="text-gray-500 mx-1">killed</span>
            <span className={entry.victimId === playerId ? 'text-red-400 font-bold' : 'text-gray-300'}>
              {entry.victimName}
            </span>
          </div>
        ))}
      </div>

      {/* Minimap */}
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <canvas
          ref={minimapRef}
          width={150}
          height={150}
          className="rounded-lg border border-white/10"
          style={{ width: 150, height: 150 }}
        />
      </div>

      {/* Death Screen */}
      {isDead && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900/90 rounded-2xl p-8 border border-white/10 flex flex-col items-center gap-6 min-w-[320px]">
            <h2 className="text-3xl font-bold text-white">You Died!</h2>
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-400">{finalScore}</div>
                <div className="text-gray-400 text-sm mt-1">Score</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-red-400">{finalKills}</div>
                <div className="text-gray-400 text-sm mt-1">Kills</div>
              </div>
            </div>
            <button
              onClick={handlePlayAgain}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-xl transition-colors cursor-pointer text-lg"
            >
              Play Again
            </button>
            <button
              onClick={() => onExitRef.current(finalScore, finalKills)}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer text-sm"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Draw Star Shape Helper ───────────────────────────────

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    const x = cx + Math.cos(rot) * outerR;
    const y = cy + Math.sin(rot) * outerR;
    ctx.lineTo(x, y);
    rot += step;
    const ix = cx + Math.cos(rot) * innerR;
    const iy = cy + Math.sin(rot) * innerR;
    ctx.lineTo(ix, iy);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
}
