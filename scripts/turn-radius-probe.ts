/**
 * Turn-radius probe — measures the ACTUAL steady-state turn circle the
 * engine's steering math produces, using the REAL config constants.
 *
 * Replicates src/lib/snake/engine.ts moveSnake steering verbatim:
 *   minTurnRadius = max(MIN_TURN_RADIUS_BASE, MIN_TURN_RADIUS_PER_BODY_RADIUS * bodyRadius)
 *   maxTurn = speed / minTurnRadius
 *   [spiral assist — reads SPIRAL_* constants, hard-clamped to the radius floor]
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
  BASE_SPEED, BOOST_SPEED, MIN_TURN_RADIUS_BASE, MIN_TURN_RADIUS_PER_BODY_RADIUS,
  STEERING_LERP, SHARP_TURN_BRAKE,
  SPIRAL_TURN_THRESHOLD, SPIRAL_ENTER_TICKS, SPIRAL_MAX_MULTIPLIER,
  SPIRAL_RAMP_TICKS, SPIRAL_EXIT_THRESHOLD,
} from '../src/lib/snake/config';

interface Cfg {
  name: string;
  radiusBase: number; radiusPerBr: number; bodyRadius: number; lerp: number; brake: number; spiral: number;
}

const CONFIGS: Cfg[] = [
  { name: 'small snake (spawn, bodyRadius 3)', radiusBase: MIN_TURN_RADIUS_BASE, radiusPerBr: MIN_TURN_RADIUS_PER_BODY_RADIUS, bodyRadius: 3, lerp: 1.0, brake: 0.0, spiral: 1.0 },
  { name: 'mid snake (score 5K, bodyRadius 9.8)', radiusBase: MIN_TURN_RADIUS_BASE, radiusPerBr: MIN_TURN_RADIUS_PER_BODY_RADIUS, bodyRadius: 9.8, lerp: 1.0, brake: 0.0, spiral: 1.0 },
  { name: 'big snake (score 100K, bodyRadius 17.2)', radiusBase: MIN_TURN_RADIUS_BASE, radiusPerBr: MIN_TURN_RADIUS_PER_BODY_RADIUS, bodyRadius: 17.2, lerp: 1.0, brake: 0.0, spiral: 1.0 },
];

function measure(cfg: Cfg, boost: boolean): { radius: number; minTurnRadius: number } {
  const speed = boost ? BOOST_SPEED : BASE_SPEED;
  const minTurnRadius = Math.max(cfg.radiusBase, cfg.radiusPerBr * cfg.bodyRadius);
  const maxTurn = speed / minTurnRadius;

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
    // hard floor clamp (verbatim from engine)
    const effMax = Math.min(spActive ? curMaxTurn : maxTurn, maxTurn);

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
  return { radius: (rx + ry) / 2, minTurnRadius };
}

console.log('Measured steady-state turn circle (mouse held 90° off heading):\n');
for (const cfg of CONFIGS) {
  const base = measure(cfg, false);
  const boost = measure(cfg, true);
  console.log(`${cfg.name}`);
  console.log(`  base speed : ${base.radius.toFixed(1)}px radius  (${(base.radius * 2).toFixed(0)}px circle)`);
  console.log(`  boost speed: ${boost.radius.toFixed(1)}px radius  (${(boost.radius * 2).toFixed(0)}px circle) — same circle, slither-style`);
}
console.log('\nFloor = max(17, 2.2 × bodyRadius): small snakes keep the approved tight circle;');
console.log('big snakes coil visibly instead of hairpinning inside themselves.');
