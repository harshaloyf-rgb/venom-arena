// ============================================================================
// Camera — Follows player head with smooth lerp. Zooms out as snake grows.
// Phase A: Updated to use PathBuffer direct access.
// ============================================================================

import type { Camera, Snake, Viewport } from './types';
import { lerp } from './vec2';
import { CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM, START_LENGTH } from './config';

/** Update camera to follow a snake. Snaps directly to head (no lag = no vibration). */
export function updateCamera(camera: Camera, snake: Snake, _canvasWidth: number, _canvasHeight: number): void {
  if (snake.path.length === 0) return;

  // Snap camera directly to head — eliminates head vibration caused by
  // lerp lag with variable ticks-per-frame. The snake head is always
  // exactly at screen center, just like slither.io.
  camera.x = snake.path.headX;
  camera.y = snake.path.headY;

  // Dynamic zoom: zoom out as snake grows
  const targetLength = snake.path.length;
  const baseLength = START_LENGTH;
  const growthFactor = Math.log2(Math.max(targetLength / baseLength, 1));
  const targetZoom = Math.max(CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM - growthFactor * 0.1);
  camera.zoom = lerp(camera.zoom, targetZoom, 0.02);
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
