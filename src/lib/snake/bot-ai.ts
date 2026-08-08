// ============================================================================
// Bot AI — Harvesting mode AI for offline bots.
// Never boosts, never collects stars, no self-destruct.
// Phase A: Updated to use PathBuffer direct access.
// ============================================================================

import type { IPathBuffer } from './pool';
import type { FoodOrb } from './types';
import { distSq, angleDirect } from './vec2';
import {
  BOT_FOOD_SCAN_RADIUS,
  BOT_EVADE_RADIUS,
  BOT_MAX_TURN_RATE,
  BOT_WANDER_RATE,
  NECK_PROTECTION,
  SNAKE_RADIUS,
  BOT_PREDICT_TICKS,
  BASE_SPEED,
} from './config';

/**
 * Get the target angle for a bot.
 * Priority:
 * 1. Evade nearby player/non-bot snake bodies (predictive)
 * 2. Seek nearest food within scan radius
 * 3. Wander randomly
 */
/** Minimal snake interface for bot AI — both offline Snake and online ServerSnake satisfy this */
export interface BotSnakeInput {
  id: string;
  path: IPathBuffer;
  angle: number;
  score: number;
  alive: boolean;
  isBot: boolean;
}

export function getBotTarget(
  bot: BotSnakeInput,
  allSnakes: Map<string, BotSnakeInput>,
  foods: FoodOrb[],
): number {
  const hx = bot.path.headX;
  const hy = bot.path.headY;
  if (bot.path.length === 0) return bot.angle;

  // --- Phase 1: Check for nearby snake bodies to evade ---
  let evadeAngle: number | null = null;
  let closestBodyDist = BOT_EVADE_RADIUS + 1;
  const evadeRsq = BOT_EVADE_RADIUS * BOT_EVADE_RADIUS;
  const evadeR1_5sq = (BOT_EVADE_RADIUS * 1.5) * (BOT_EVADE_RADIUS * 1.5);

  for (const [, other] of allSnakes) {
    if (other.id === bot.id || !other.alive) continue;

    const ohx = other.path.headX;
    const ohy = other.path.headY;

    // Quick distance check to the other snake's head
    const headDistSq = distSq(hx, hy, ohx, ohy);
    if (headDistSq > evadeR1_5sq) continue;

    // Check body segments (skip neck protection)
    const segLen = other.path.length;
    for (let i = NECK_PROTECTION; i < segLen; i++) {
      const sx = other.path.getX(i);
      const sy = other.path.getY(i);
      const dSq = distSq(hx, hy, sx, sy);
      if (dSq < closestBodyDist * closestBodyDist) {
        closestBodyDist = Math.sqrt(dSq);
        // Steer AWAY from this segment
        evadeAngle = angleDirect(sx, sy, hx, hy);
      }
    }

    // Predictive check: where will the other snake's head be in N ticks?
    if (headDistSq < evadeRsq) {
      const futureX = ohx + Math.cos(other.angle) * BASE_SPEED * BOT_PREDICT_TICKS;
      const futureY = ohy + Math.sin(other.angle) * BASE_SPEED * BOT_PREDICT_TICKS;
      const futureDistSq = distSq(hx, hy, futureX, futureY);
      const killRadiusSq = (SNAKE_RADIUS * 4) * (SNAKE_RADIUS * 4);
      if (futureDistSq < killRadiusSq) {
        const futureEvade = angleDirect(futureX, futureY, hx, hy);
        evadeAngle = futureEvade;
      }
    }
  }

  if (evadeAngle !== null && closestBodyDist < BOT_EVADE_RADIUS) {
    return smoothTurn(bot.angle, evadeAngle, BOT_MAX_TURN_RATE * 1.5);
  }

  // --- Phase 2: Find nearest food ---
  let nearestFood: FoodOrb | null = null;
  let nearestFoodDistSq = (BOT_FOOD_SCAN_RADIUS + 1) * (BOT_FOOD_SCAN_RADIUS + 1);
  const scanSq = BOT_FOOD_SCAN_RADIUS * BOT_FOOD_SCAN_RADIUS;

  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    const dSq = distSq(hx, hy, food.x, food.y);
    if (dSq < nearestFoodDistSq) {
      nearestFoodDistSq = dSq;
      nearestFood = food;
    }
  }

  if (nearestFood && nearestFoodDistSq < scanSq) {
    const foodAngle = angleDirect(hx, hy, nearestFood.x, nearestFood.y);
    return smoothTurn(bot.angle, foodAngle, BOT_MAX_TURN_RATE);
  }

  // --- Phase 3: Wander ---
  return smoothTurn(bot.angle, bot.angle + (Math.random() - 0.5) * BOT_WANDER_RATE, BOT_MAX_TURN_RATE * 0.5);
}

/** Smoothly turn from currentAngle toward targetAngle by at most maxRate radians */
function smoothTurn(currentAngle: number, targetAngle: number, maxRate: number): number {
  let diff = targetAngle - currentAngle;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  if (Math.abs(diff) <= maxRate) {
    return targetAngle;
  }
  return currentAngle + Math.sign(diff) * maxRate;
}
