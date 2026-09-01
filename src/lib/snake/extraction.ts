// ============================================================================
// Extraction — SHARED extraction ring logic for both offline and online modes.
//
// The extraction ring is a 3-second hold-to-extract mechanic (press E / right click).
// It renders a progress ring on the snake head. Moving during extraction resets it.
// When complete (100%), it calls onExit to leave the arena.
//
// Editing this file changes extraction behavior for BOTH modes at once.
// ============================================================================

import type { Snake, Camera, Viewport } from './types';

// ─── Extraction State ──────────────────────────────────────────────────────

/** Mutable state for extraction progress tracking */
export interface ExtractionState {
  /** Whether extraction is currently active (E held, not dead) */
  active: boolean;
  /** Progress from 0.0 to 1.0 */
  progress: number;
  /** Last target angle when extraction started/last reset */
  lastAngle: number;
  /** Guard: once extraction completes, it can never restart */
  completed: boolean;
}

/** Create a fresh extraction state */
export function createExtractionState(): ExtractionState {
  return { active: false, progress: 0, lastAngle: 0, completed: false };
}

/** Duration of extraction in milliseconds */
const EXTRACTION_DURATION_MS = 3000;

/** Maximum angle delta (radians) before extraction progress resets */
const EXTRACTION_ANGLE_THRESHOLD = 0.05;

// ─── Extraction Progress Update ───────────────────────────────────────────

/**
 * Update extraction progress based on input state.
 * Returns true when extraction completes (progress reaches 100%).
 *
 * @param state   - Mutable extraction state (typically stored in a ref)
 * @param isExtracting - Whether E/right-click is held
 * @param isDead - Whether the player is dead
 * @param targetAngle - Current target movement angle
 * @param frameElapsed - Milliseconds since last frame
 * @param onExit  - Callback when extraction completes (100%)
 * @returns true if extraction just completed this frame
 */
export function updateExtractionProgress(
  state: ExtractionState,
  isExtracting: boolean,
  isDead: boolean,
  targetAngle: number,
  frameElapsed: number,
  onExit?: () => void,
): boolean {
  // Once extraction completes, never allow it to restart
  if (state.completed) return false;

  if (isExtracting && !isDead) {
    if (!state.active) {
      state.active = true;
      state.progress = 0;
      state.lastAngle = targetAngle;
    }
    const angleDelta = Math.abs(targetAngle - state.lastAngle);
    const wrappedDelta = Math.min(angleDelta, Math.PI * 2 - angleDelta);
    if (wrappedDelta > EXTRACTION_ANGLE_THRESHOLD) {
      // Player moved — reset progress
      state.progress = 0;
      state.lastAngle = targetAngle;
    } else {
      // Accumulate progress
      state.progress += frameElapsed / EXTRACTION_DURATION_MS;
      if (state.progress >= 1.0) {
        state.progress = 0;
        state.active = false;
        state.completed = true;
        if (onExit) onExit();
        return true;
      }
    }
  } else {
    // Not extracting — reset
    state.active = false;
    state.progress = 0;
  }
  return false;
}

// ─── Extraction Ring Renderer ─────────────────────────────────────────────

/**
 * Draw the extraction progress ring on the snake's head.
 * White → Green color transition as progress increases.
 */
export function drawExtractRing(
  ctx: CanvasRenderingContext2D,
  snake: Snake,
  camera: Camera,
  viewport: Viewport,
  progress: number,
): void {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  const sx = (hx - camera.x) * camera.zoom + viewport.width / 2;
  const sy = (hy - camera.y) * camera.zoom + viewport.height / 2;
  const zoom = camera.zoom;
  const ringRadius = (snake.bodyRadius + 10) * zoom;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  // Background ring
  ctx.beginPath();
  ctx.arc(sx, sy, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 3 * zoom;
  ctx.stroke();

  // Progress arc: white → green
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + clampedProgress * Math.PI * 2;
  const r = Math.round(255 - clampedProgress * 150);
  const g = Math.round(255 * clampedProgress + 200 * (1 - clampedProgress));
  const b = Math.round(255 * (1 - clampedProgress));

  ctx.beginPath();
  ctx.arc(sx, sy, ringRadius, startAngle, endAngle);
  ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.lineWidth = 3 * zoom;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineCap = 'butt';

  // Percentage text
  const pct = Math.floor(clampedProgress * 100);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = `bold ${Math.round(11 * zoom)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${pct}%`, sx, sy - ringRadius - 10 * zoom);
}
