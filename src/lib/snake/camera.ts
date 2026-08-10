// ============================================================================
// Camera — SHARED — used by both offline and online modes.
// ============================================================================
// Position: INTERPOLATED between physics ticks using tick fraction (alpha).
//   P0: camera.x = prevHead + (currentHead - prevHead) * alpha
//   This makes the camera move smoothly on EVERY render frame, regardless of
//   display refresh rate (60/120/144Hz) or frame timing jitter.
//   Combined with P1 (smoothed SHARP_TURN_BRAKE), speed variation is eliminated.
//
// Zoom: FULLY quantized target (score brackets, bodyRadius from quantized score)
//   + fast lerp + deadzone + 0.001 quantization after lerp.
// ============================================================================

import type { Camera, Snake, Viewport } from './types';
import {
  CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM,
  START_LENGTH, SNAKE_RADIUS_MIN, computeBodyLength, computeBodyRadius,
} from './config';

/** Camera zoom lerp factor — 0.15 → 90% convergence in ~14 frames (0.23s at 60fps). */
const CAMERA_ZOOM_LERP = 0.15;

/** Score bracket size for zoom quantization — target only changes when score
 *  crosses a multiple of this value, preventing micro-oscillation. */
const ZOOM_SCORE_BRACKET = 200;

/** Deadzone for zoom snap — eliminates residual sub-pixel drift. */
const ZOOM_DEADZONE = 0.005;

/** P0 + P2: Update camera using interpolated head position.
 *  camera.x/y = prevHead + (currentHead - prevHead) * alpha
 *  This is DIRECT (no lerp) — the interpolation IS the smoothing.
 *  alpha = accumulator / tickMs = how far we are toward the next tick.
 *  Result: camera moves smoothly on every render frame. */
export function updateCameraInterpolated(
  camera: Camera, snake: Snake, _canvasWidth: number, _canvasHeight: number, alpha: number,
): void {
  if (snake.path.length === 0) return;

  // P0: Interpolated position — smooth on every render frame
  const curX = snake.path.headX;
  const curY = snake.path.headY;
  camera.x = snake.prevHeadX + (curX - snake.prevHeadX) * alpha;
  camera.y = snake.prevHeadY + (curY - snake.prevHeadY) * alpha;

  // Zoom: quantized + lerped (unchanged — zoom changes are rare)
  const quantizedScore = Math.floor(snake.score / ZOOM_SCORE_BRACKET) * ZOOM_SCORE_BRACKET;
  const targetLength = computeBodyLength(quantizedScore);
  const baseLength = START_LENGTH;
  const lengthFactor = Math.log2(Math.max(targetLength / baseLength, 1));
  const quantizedBodyRadius = computeBodyRadius(quantizedScore);
  const bodyRatio = quantizedBodyRadius / SNAKE_RADIUS_MIN;
  const widthFactor = Math.log2(Math.max(bodyRatio, 1)) * 0.8;
  const totalGrowth = lengthFactor + widthFactor;
  const targetZoom = Math.max(CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM - totalGrowth * 0.16);

  const zoomDelta = targetZoom - camera.zoom;
  if (Math.abs(zoomDelta) < ZOOM_DEADZONE) {
    camera.zoom = targetZoom;
  } else {
    camera.zoom += zoomDelta * CAMERA_ZOOM_LERP;
  }
  camera.zoom = Math.round(camera.zoom * 1000) / 1000;
}

/** Legacy camera update (no interpolation) — kept for online mode compatibility. */
export function updateCamera(camera: Camera, snake: Snake, _canvasWidth: number, _canvasHeight: number): void {
  updateCameraInterpolated(camera, snake, _canvasWidth, _canvasHeight, 1.0);
}

/** Compute the viewport bounds in world coordinates for culling */
export function getViewport(camera: Camera, canvasWidth: number, canvasHeight: number): Viewport {
  const halfW = (canvasWidth / 2) / camera.zoom;
  const halfH = (canvasHeight / 2) / camera.zoom;

  return {
    left: camera.x - halfW,
    top: camera.y - halfH,
    right: camera.x + halfW,
    bottom: camera.y + halfH,
    width: canvasWidth,
    height: canvasHeight,
  };
}

/** Create a new camera at a given position */
export function createCamera(x: number, y: number): Camera {
  return { x, y, zoom: CAMERA_BASE_ZOOM };
}

/** Convert world coordinates to screen coordinates */
export function worldToScreen(
  wx: number,
  wy: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (wx - camera.x) * camera.zoom + canvasWidth / 2,
    y: (wy - camera.y) * camera.zoom + canvasHeight / 2,
  };
}

/** World-to-screen for food, bot snakes, and other non-player elements.
 *  Uses raw floating-point positions — NO Math.round.
 *  Sub-pixel anti-aliasing on small circles (1.5–3px) is invisible;
 *  the 1px pop from Math.round is far worse. */
export function worldToScreenSnapped(
  wx: number,
  wy: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (wx - camera.x) * camera.zoom + canvasWidth / 2,
    y: (wy - camera.y) * camera.zoom + canvasHeight / 2,
  };
}
