// ---- Venom Arena — Game Configuration ----
import type { GameConfig } from './game-types';

export const DEFAULT_CONFIG: GameConfig = {
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
  extractionTime: 5000, // ms
  spawnProtectionTime: 3000, // ms
  deathFoodDropRate: 0.4,
  deathStarDropCount: 10,
  botReactionTime: 200, // ms between AI decisions
};

// Offline difficulty presets
export const DIFFICULTY_PRESETS = {
  easy: {
    botCount: 10,
    snakeSpeed: 2.5,
    boostSpeed: 4.5,
    turnSpeed: 0.1,
  },
  medium: {
    botCount: 20,
    snakeSpeed: 3,
    boostSpeed: 5.5,
    turnSpeed: 0.08,
  },
  hard: {
    botCount: 30,
    snakeSpeed: 3.5,
    boostSpeed: 6,
    turnSpeed: 0.07,
  },
} as const;

// Calculate snake radius from score (body length)
export function snakeRadius(score: number): number {
  return Math.min(6 + score * 0.04, 20);
}

// Calculate body segment count from score
export function bodySegmentCount(score: number): number {
  return Math.floor(score / 1); // 1 point = 1 segment
}
