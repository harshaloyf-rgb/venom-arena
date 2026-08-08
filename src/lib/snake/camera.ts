// ============================================================================
// Camera — Follows player head with smooth lerp. Zooms out as snake grows.
// Width-aware: accounts for both snake length AND body radius for zoom.
// ============================================================================

import type { Camera, Snake, Viewport } from './types';
import {
  CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM, CAMERA_ZOOM_LERP,
  START_LENGTH, SNAKE_RADIUS_MIN, computeBodyLength,
} from './config';

/** Fixed world-space snap precision for camera position.
 *  Using a FIXED value (not 1/zoom) means the snap grid never shifts when
 *  zoom changes. This eliminates the primary source of jitter: zoom changes
 *  causing the position snap grid to jump.
 *  0.5 world units = imperceptible offset, eliminates sub-pixel crawl. */
const POS_SNAP = 0.5;

/** Zoom snap precision — prevents continuous micro-rescaling that shifts
 *  grid line positions and causes visible crawling.
 *  50 = snap to 0.02 increments. Zoom only changes in visible steps,
 *  not continuously. Much less visual disturbance. */
const ZOOM_SNAP = 50;

/** Update camera to follow a snake. Snaps directly to head (no lag = no vibration). */
export function updateCamera(camera: Camera, snake: Snake, _canvasWidth: number, _canvasHeight: number): void {
  if (snake.path.length === 0) return;

  // Snap camera to head position using FIXED precision.
  // Critical: does NOT depend on zoom, so zoom changes don't shift the snap grid.
  camera.x = Math.round(snake.path.headX / POS_SNAP) * POS_SNAP;
  camera.y = Math.round(snake.path.headY / POS_SNAP) * POS_SNAP;

  // Dynamic zoom: zoom out as snake grows in BOTH length and width.
  // IMPORTANT: use computeBodyLength(score) instead of snake.path.length.
  // path.length changes every tick as head moves (new point prepended),
  // which caused the zoom target to shift every frame → constant jittering.
  // computeBodyLength only changes when score crosses a 5-point boundary.
  const targetLength = computeBodyLength(snake.score);
  const baseLength = START_LENGTH;

  const lengthFactor = Math.log2(Math.max(targetLength / baseLength, 1));
  const bodyRatio = snake.bodyRadius / SNAKE_RADIUS_MIN;
  const widthFactor = Math.log2(Math.max(bodyRatio, 1)) * 0.8;

  const totalGrowth = lengthFactor + widthFactor;
  const targetZoom = Math.max(CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM - totalGrowth * 0.11);

  // Lerp zoom toward target, snapped to coarse precision.
  // Coarse snap (0.02) means zoom changes are in visible steps,
  // not a constant stream of micro-shifts.
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
