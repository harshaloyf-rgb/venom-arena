// ============================================================================
// Camera — Follows player head with smooth lerp. Zooms out as snake grows.
// Width-aware: accounts for both snake length AND body radius for zoom.
// ============================================================================

import type { Camera, Snake, Viewport } from './types';
import { lerp } from './vec2';
import {
  CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM, CAMERA_ZOOM_LERP,
  START_LENGTH, SNAKE_RADIUS_MIN, SEGMENT_SPACING, BASE_SPEED,
} from './config';

/** Update camera to follow a snake. Snaps directly to head (no lag = no vibration). */
export function updateCamera(camera: Camera, snake: Snake, _canvasWidth: number, _canvasHeight: number): void {
  if (snake.path.length === 0) return;

  // Snap camera directly to head — eliminates head vibration caused by
  // lerp lag with variable ticks-per-frame. The snake head is always
  // exactly at screen center, just like slither.io.
  camera.x = snake.path.headX;
  camera.y = snake.path.headY;

  // Dynamic zoom: zoom out as snake grows in BOTH length and width.
  // Uses separate factors so wider snakes zoom out more (they need more
  // navigation space) while longer snakes get a gentler zoom effect.
  const targetLength = snake.path.length;
  const baseLength = Math.ceil(START_LENGTH * (SEGMENT_SPACING / BASE_SPEED)); // ~36

  // Length factor: log2 for gradual scaling (0 at start, ~7.5 at max snake)
  const lengthFactor = Math.log2(Math.max(targetLength / baseLength, 1));

  // Width factor: log2 of radius ratio, weighted at 0.8× (secondary to length)
  // At start: bodyRadius=12, ratio=1, factor=0
  // At max:  bodyRadius=28, ratio=2.33, factor=0.89
  const bodyRatio = snake.bodyRadius / SNAKE_RADIUS_MIN;
  const widthFactor = Math.log2(Math.max(bodyRatio, 1)) * 0.8;

  // Combined growth drives zoom-out. Coefficient 0.11 gives a ~2.4× zoom
  // range over the full score spectrum (1.35 → ~0.55 at max snake).
  const totalGrowth = lengthFactor + widthFactor;
  const targetZoom = Math.max(CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM - totalGrowth * 0.11);

  // Very smooth lerp — 0.015 means 90% convergence in ~153 frames (2.5s at 60fps).
  // Combined with the gradual target changes, the player barely notices zoom shifting.
  camera.zoom = lerp(camera.zoom, targetZoom, CAMERA_ZOOM_LERP);
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

/** Convert screen coordinates to world coordinates */
export function screenToWorld(
  sx: number,
  sy: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (sx - canvasWidth / 2) / camera.zoom + camera.x,
    y: (sy - canvasHeight / 2) / camera.zoom + camera.y,
  };
}
