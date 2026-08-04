// ============================================================================
// Bot AI — Harvesting mode AI for offline bots.
// Never boosts, never collects stars, no self-destruct.
// ============================================================================

import type { Snake, FoodOrb } from './types';
import { distance, angleBetween } from './vec2';
import {
  BOT_FOOD_SCAN_RADIUS,
  BOT_EVADE_RADIUS,
  BOT_MAX_TURN_RATE,
  BOT_WANDER_RATE,
  NECK_PROTECTION,
  SNAKE_RADIUS,
  BOT_PREDICT_TICKS,
  BASE_SPEED,
} from './constants';

/**
 * Get the target angle for a bot.
 * Priority:
 * 1. Evade nearby player/non-bot snake bodies (predictive)
 * 2. Seek nearest food within scan radius
 * 3. Wander randomly
 */
export function getBotTarget(
  bot: Snake,
  allSnakes: Map<string, Snake>,
  foods: FoodOrb[],
): number {
  const head = bot.segments[0];
  if (!head) return bot.angle;

  // --- Phase 1: Check for nearby snake bodies to evade ---
  let evadeAngle: number | null = null;
  let closestBodyDist = BOT_EVADE_RADIUS + 1;

  for (const [, other] of allSnakes) {
    if (other.id === bot.id || !other.alive) continue;

    const otherHead = other.segments[0];
    if (!otherHead) continue;

    // Quick distance check to the other snake's head
    const headDist = distance(head, otherHead);
    if (headDist > BOT_EVADE_RADIUS * 1.5) continue;

    // Check body segments (skip neck protection)
    const segs = other.segments;
    for (let i = NECK_PROTECTION; i < segs.length; i++) {
      const seg = segs[i];
      const d = distance(head, seg);
      if (d < closestBodyDist) {
        closestBodyDist = d;
        // Steer AWAY from this segment
        evadeAngle = angleBetween(seg, head);
      }
    }

    // Predictive check: where will the other snake's head be in N ticks?
    if (headDist < BOT_EVADE_RADIUS) {
      const futureX = otherHead.x + Math.cos(other.angle) * BASE_SPEED * BOT_PREDICT_TICKS;
      const futureY = otherHead.y + Math.sin(other.angle) * BASE_SPEED * BOT_PREDICT_TICKS;
      const futureDist = distance(head, { x: futureX, y: futureY });
      if (futureDist < SNAKE_RADIUS * 4) {
        const futureEvade = angleBetween({ x: futureX, y: futureY }, head);
        // Override evade angle if this is more urgent
        evadeAngle = futureEvade;
      }
    }
  }

  if (evadeAngle !== null && closestBodyDist < BOT_EVADE_RADIUS) {
    return smoothTurn(bot.angle, evadeAngle, BOT_MAX_TURN_RATE * 1.5);
  }

  // --- Phase 2: Find nearest food ---
  let nearestFood: FoodOrb | null = null;
  let nearestFoodDist = BOT_FOOD_SCAN_RADIUS + 1;

  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    const d = distance(head, food);
    if (d < nearestFoodDist) {
      nearestFoodDist = d;
      nearestFood = food;
    }
  }

  if (nearestFood) {
    const foodAngle = angleBetween(head, nearestFood);
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
