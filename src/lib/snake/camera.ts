// ============================================================================
// Camera — Locks to player head position. Zooms out as snake grows.
// ============================================================================
// Position: camera = exact head position (no lerp, no snap).
//   The head stays at dead screen center → zero relative motion → zero jitter.
//   Grid line crawl is handled by renderer.ts (own pixel-snapping).
//   Name labels use Math.round for integer-pixel rendering.
// Zoom: smooth lerp with coarse snap. Only changes on score growth.
// ============================================================================

import type { Camera, Snake, Viewport } from './types';
import {
  CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM, CAMERA_ZOOM_LERP,
  START_LENGTH, SNAKE_RADIUS_MIN, computeBodyLength,
} from './config';

/** Zoom snap precision — 50 = 0.02 increments.
 *  Coarse enough that zoom changes are rare and deliberate. */
const ZOOM_SNAP = 50;

/** Update camera to follow a snake. Camera locks directly to head position.
 *  No lerp, no snap — the head is always at exact screen center.
 *  This eliminates ALL relative jitter between snake, name, and camera. */
export function updateCamera(camera: Camera, snake: Snake, _canvasWidth: number, _canvasHeight: number): void {
  if (snake.path.length === 0) return;

  // Direct lock — head stays at dead center of screen.
  camera.x = snake.path.headX;
  camera.y = snake.path.headY;

  // Dynamic zoom: zoom out as snake grows in BOTH length and width.
  // computeBodyLength uses logarithmic curve — smooth, no sudden jumps.
  const targetLength = computeBodyLength(snake.score);
  const baseLength = START_LENGTH;

  const lengthFactor = Math.log2(Math.max(targetLength / baseLength, 1));
  const bodyRatio = snake.bodyRadius / SNAKE_RADIUS_MIN;
  const widthFactor = Math.log2(Math.max(bodyRatio, 1)) * 0.8;

  const totalGrowth = lengthFactor + widthFactor;
  const targetZoom = Math.max(CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM - totalGrowth * 0.16);

  // Lerp zoom toward target, snapped to coarse precision.
  const rawZoom = camera.zoom + (targetZoom - camera.zoom) * CAMERA_ZOOM_LERP;
  camera.zoom = Math.round(rawZoom * ZOOM_SNAP) / ZOOM_SNAP;
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
