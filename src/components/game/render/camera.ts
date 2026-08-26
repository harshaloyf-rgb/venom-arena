// ============================================================================
// Venom Arena — Camera System
// Follow, zoom, lerp, and world↔screen conversion.
// ============================================================================

import type { CameraState } from '@/lib/snake/types';

/**
 * Smoothly follow a target position.
 * Returns a new CameraState with interpolated position.
 */
export function followTarget(
  camera: CameraState,
  targetX: number,
  targetY: number,
  speed: number,
): CameraState {
  return {
    ...camera,
    x: camera.x + (targetX - camera.x) * speed,
    y: camera.y + (targetY - camera.y) * speed,
  };
}

/**
 * Smoothly zoom toward a target zoom level.
 */
export function zoomToward(
  camera: CameraState,
  targetZoom: number,
  smooth: number,
): CameraState {
  return {
    ...camera,
    zoom: camera.zoom + (targetZoom - camera.zoom) * smooth,
    targetZoom,
  };
}

/**
 * Convert world coordinates to screen (canvas) coordinates.
 */
export function worldToScreen(
  wx: number,
  wy: number,
  camera: CameraState,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  return {
    x: (wx - camera.x) * camera.zoom + canvasW / 2,
    y: (wy - camera.y) * camera.zoom + canvasH / 2,
  };
}

/**
 * Check if a world-space circle is visible on screen.
 */
export function isOnScreen(
  wx: number,
  wy: number,
  radius: number,
  camera: CameraState,
  canvasW: number,
  canvasH: number,
): boolean {
  const screen = worldToScreen(wx, wy, camera, canvasW, canvasH);
  const screenRadius = radius * camera.zoom;
  const margin = screenRadius + 20;
  return (
    screen.x + margin > 0 &&
    screen.x - margin < canvasW &&
    screen.y + margin > 0 &&
    screen.y - margin < canvasH
  );
}

/**
 * Create a default camera state centered at origin.
 */
export function createDefaultCamera(): CameraState {
  return {
    x: 0,
    y: 0,
    zoom: 1,
    targetZoom: 1,
  };
}
