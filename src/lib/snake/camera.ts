// ============================================================================
// Camera — Follows player head with smooth lerp. Zooms out as snake grows.
// Width-aware: accounts for both snake length AND body radius for zoom.
// ============================================================================

import type { Camera, Snake, Viewport } from './types';
import {
  CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM, CAMERA_ZOOM_LERP,
  START_LENGTH, SNAKE_RADIUS_MIN, SEGMENT_SPACING, BASE_SPEED,
} from './config';

/** Sub-pixel precision for camera position snapping.
 *  1/zoom ensures world-space snapping maps to exactly 1 screen pixel.
 *  This eliminates sub-pixel crawling of ALL rendered elements (grid,
 *  food, snake body) while keeping movement perfectly smooth.
 *  At zoom 1.35, precision = 0.741 world units. */
const SNAP_INV = 1.0;

/** Zoom snap precision — prevents continuous micro-rescaling that shifts
 *  grid line positions and causes visible crawling. */
const ZOOM_SNAP = 1000; // snap to 0.001 precision

/** Update camera to follow a snake. Snaps directly to head (no lag = no vibration). */
export function updateCamera(camera: Camera, snake: Snake, _canvasWidth: number, _canvasHeight: number): void {
  if (snake.path.length === 0) return;

  // Snap camera to head position quantized to sub-pixel precision.
  // This eliminates sub-pixel crawling while keeping motion smooth.
  // The head stays visually centered (sub-pixel offset is imperceptible).
  const precision = SNAP_INV / camera.zoom;
  camera.x = Math.round(snake.path.headX / precision) * precision;
  camera.y = Math.round(snake.path.headY / precision) * precision;

  // Dynamic zoom: zoom out as snake grows in BOTH length and width.
  const targetLength = snake.path.length;
  const baseLength = Math.ceil(START_LENGTH * (SEGMENT_SPACING / BASE_SPEED));

  const lengthFactor = Math.log2(Math.max(targetLength / baseLength, 1));
  const bodyRatio = snake.bodyRadius / SNAKE_RADIUS_MIN;
  const widthFactor = Math.log2(Math.max(bodyRatio, 1)) * 0.8;

  const totalGrowth = lengthFactor + widthFactor;
  const targetZoom = Math.max(CAMERA_ZOOM_MIN, CAMERA_BASE_ZOOM - totalGrowth * 0.11);

  // Lerp zoom toward target, snapped to fixed precision to prevent
  // continuous micro-rescaling that shifts grid lines each frame.
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
