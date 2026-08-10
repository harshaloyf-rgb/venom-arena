// ============================================================================
// Camera — SHARED — used by both offline and online modes.
// ============================================================================
// Position: camera = exact head position (no lerp, no snap).
//   The head stays at dead screen center → zero relative motion → zero jitter.
//   Grid line crawl is handled by renderer.ts (own pixel-snapping).
//   Name labels use Math.round for integer-pixel rendering.
// Zoom: FULLY quantized target (score brackets, bodyRadius from quantized score)
//   + fast lerp + deadzone + 0.001 quantization after lerp.
//   The zoom target ONLY changes when score crosses a 200-point bracket.
//   All other objects use raw floating-point screen positions (no Math.round)
//   because 1px pops from rounding are far worse than sub-pixel AA.
// ============================================================================

import type { Camera, Snake, Viewport } from './types';
import {
  CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM,
  START_LENGTH, SNAKE_RADIUS_MIN, computeBodyLength, computeBodyRadius,
} from './config';

/** Camera position lerp — 0.5 → averages last 2 frames of head position.
 *  Smooths out variable-speed camera movement during boost turns (SHARP_TURN_BRAKE).
 *  At 60fps this adds ~16ms latency — imperceptible. During straight-line movement,
 *  the lerp converges instantly since head displacement is constant. */
const CAMERA_POS_LERP = 0.5;

/** Camera zoom lerp factor — 0.15 → 90% convergence in ~14 frames (0.23s at 60fps). */
const CAMERA_ZOOM_LERP = 0.15;

/** Score bracket size for zoom quantization — target only changes when score
 *  crosses a multiple of this value, preventing micro-oscillation. */
const ZOOM_SCORE_BRACKET = 200;

/** Deadzone for zoom snap — eliminates residual sub-pixel drift. */
const ZOOM_DEADZONE = 0.005;

/** Update camera to follow a snake. Camera locks directly to head position.
 *  No lerp, no snap — the head is always at exact screen center.
 *  This eliminates ALL relative jitter between snake, name, and camera. */
export function updateCamera(camera: Camera, snake: Snake, _canvasWidth: number, _canvasHeight: number): void {
  if (snake.path.length === 0) return;

  // Smoothed position lock — lerp toward head position.
  // Eliminates camera jitter from variable-speed head movement (SHARP_TURN_BRAKE during boost).
  // At 0.5 lerp the camera averages the last 2 frames, smoothing speed variation.
  const targetX = snake.path.headX;
  const targetY = snake.path.headY;
  camera.x += (targetX - camera.x) * CAMERA_POS_LERP;
  camera.y += (targetY - camera.y) * CAMERA_POS_LERP;

  // Quantize score to brackets so zoom target is stable between brackets.
  // CRITICAL: also compute bodyRadius from quantizedScore (not live snake.bodyRadius)
  // to prevent zoom target from shifting on every single food eaten.
  const quantizedScore = Math.floor(snake.score / ZOOM_SCORE_BRACKET) * ZOOM_SCORE_BRACKET;

  const targetLength = computeBodyLength(quantizedScore);
  const baseLength = START_LENGTH;

  const lengthFactor = Math.log2(Math.max(targetLength / baseLength, 1));
  // Use quantized bodyRadius — prevents zoom micro-shift on every food eaten.
  const quantizedBodyRadius = computeBodyRadius(quantizedScore);
  const bodyRatio = quantizedBodyRadius / SNAKE_RADIUS_MIN;
  const widthFactor = Math.log2(Math.max(bodyRatio, 1)) * 0.8;

  const totalGrowth = lengthFactor + widthFactor;
  const targetZoom = Math.max(CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM - totalGrowth * 0.16);

  // Fast lerp with deadzone + 0.001 quantization to eliminate floating-point drift.
  const zoomDelta = targetZoom - camera.zoom;
  if (Math.abs(zoomDelta) < ZOOM_DEADZONE) {
    camera.zoom = targetZoom;
  } else {
    camera.zoom += zoomDelta * CAMERA_ZOOM_LERP;
  }
  // Quantize zoom to 0.001 — prevents residual floating-point micro-oscillation
  // that would shift all screen positions by sub-pixel amounts every frame.
  camera.zoom = Math.round(camera.zoom * 1000) / 1000;
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
 *  Rounding caused 1px pops every frame as the camera moved by non-integer
 *  screen pixels (e.g., 4.05px/tick at zoom 1.35). With hundreds of food orbs
 *  and 13 bots, this created visible vibration across the entire viewport.
 *  Sub-pixel anti-aliasing on small circles (1.5–3px) is invisible;
 *  the 1px pop from Math.round is far worse and was the #1 jitter source. */
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
