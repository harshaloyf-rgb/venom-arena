/**
 * Turn-radius probe — measures the ACTUAL steady-state turn circle the
 * engine's steering math produces, using the REAL config constants.
 *
 * Replicates src/lib/snake/engine.ts moveSnake steering verbatim:
 *   maxTurn = BASE_TURN_RATE + (MIN_TURN_RATE - BASE_TURN_RATE) * speedT
 *   [spiral assist — reads SPIRAL_* constants]
 *   sharpness = min(|diff * STEERING_LERP| / maxTurn, 1)
 *   effMaxTurn = maxTurn * (1 - SHARP_TURN_BRAKE * smoothstep(sharpness))
 *   angle += clamp(diff * STEERING_LERP, -effMaxTurn, +effMaxTurn)
 *   head moves speed px per tick along angle
 *
 * Sustained hard turn: mouse held at 90° to the heading (typical circling).
 * Radius = half the bounding box of ticks 120..400 (past all transients).
 * Run: bun scripts/turn-radius-probe.ts
 */

import {
  BASE_SPEED, BOOST_SPEED, BASE_TURN_RATE, MIN_TURN_RATE,
  STEERING_LERP, SHARP_TURN_BRAKE,
  SPIRAL_TURN_THRESHOLD, SPIRAL_ENTER_TICKS, SPIRAL_MAX_MULTIPLIER,
  SPIRAL_RAMP_TICKS, SPIRAL_EXIT_THRESHOLD,
} from '../src/lib/snake/config';

interface Cfg {
  name: string;
  base: number; min: number; lerp: number; brake: number; spiral: number;
}

const CONFIGS: Cfg[] = [
  { name: 'ORIGINAL (before all my work)', base: 0.050, min: 0.100, lerp: 0.12, brake: 0.30, spiral: 1.8 },
  { name: 'raise #1-#3 (what you tested)', base: 0.090, min: 0.180, lerp: 0.45, brake: 0.30, spiral: 1.8 },
  { name: 'NEW (brake off + direct steering)', base: 0.180, min: 0.360, lerp: 1.0, brake: 0.0, spiral: 1.0 },
];

function measure(cfg: Cfg, boost: boolean): { radius: number; effMaxTurn: number } {
  const speed = boost ? BOOST_SPEED : BASE_SPEED;
  const speedT = Math.min(1, Math.max(0, (speed - BASE_SPEED) / (BOOST_SPEED - BASE_SPEED)));
  let maxTurn = cfg.base + (cfg.min - cfg.base) * speedT;

  let angle = 0;
  let x = 0, y = 0;
  const diff = Math.PI / 2; // mouse held perpendicular — hard sustained turn

  // spiral state (verbatim from engine)
  let spActive = false, spConsec = 0, spTicks = 0;
  const spDir: 1 | -1 = 1;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let curMaxTurn = maxTurn;

  for (let tick = 0; tick < 400; tick++) {
    // spiral assist (verbatim)
    const absDiff = Math.abs(diff);
    if (!spActive) {
      if (absDiff >= SPIRAL_TURN_THRESHOLD) spConsec++; else spConsec = 0;
      if (spConsec >= SPIRAL_ENTER_TICKS) { spActive = true; spTicks = 0; }
    } else {
      if (absDiff < SPIRAL_EXIT_THRESHOLD) { spActive = false; spConsec = 0; }
      else {
        spTicks++;
        const t = Math.min(1, spTicks / SPIRAL_RAMP_TICKS);
        const mult = 1 + (cfg.spiral - 1) * t;
        curMaxTurn = maxTurn * mult;
      }
    }
    const effMax = spActive ? curMaxTurn : maxTurn;

    // steering (verbatim)
    const turnAmount = diff * cfg.lerp;
    const sharpness = effMax > 0 ? Math.min(Math.abs(turnAmount) / effMax, 1.0) : 0;
    const smoothT = sharpness * sharpness * (3 - 2 * sharpness);
    const effMaxTurn = effMax * (1 - cfg.brake * smoothT);
    const clamped = Math.max(-effMaxTurn, Math.min(effMaxTurn, turnAmount));
    angle += clamped;

    x += Math.cos(angle) * speed;
    y += Math.sin(angle) * speed;

    if (tick >= 120) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
  return { radius: (rx + ry) / 2, effMaxTurn: maxTurn };
}

console.log('Measured steady-state turn circle (mouse held 90° off heading):\n');
for (const cfg of CONFIGS) {
  const base = measure(cfg, false);
  const boost = measure(cfg, true);
  console.log(`${cfg.name}`);
  console.log(`  base speed : ${base.radius.toFixed(1)}px radius  (${(base.radius * 2).toFixed(0)}px circle)`);
  console.log(`  boost speed: ${boost.radius.toFixed(1)}px radius  (${(boost.radius * 2).toFixed(0)}px circle)`);
}
console.log('\nSpawn snake body radius ≈ 13px → NEW circle ≈ 1.3 body widths (slither.io-tight).');
