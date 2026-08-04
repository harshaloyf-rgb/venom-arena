/**
 * Venom Arena — barrel export for all canvas render helpers.
 *
 * Pure functions, no React. Split into domain sub-modules under ./render/
 * for maintainability. All public symbols are re-exported here so existing
 * importers (game-canvas.tsx, offline-engine.ts, etc.) continue to work
 * without changes.
 */

// Types
export type { FrameRenderCtx, Particle, VisibleRect, OrbConfig, MinimapArgs, FullMapArgs } from './render/types';

// Grid + utilities
export { computeVisibleRect, rectContainsPoint, snakeIsVisible, getArenaRadius, formatChipDisplay, drawGrid, drawMapBoundary } from './render/render-grid';

// Food + stars + extraction ring
export { drawFoodOrb, drawStarShape, drawStarCollectible, drawExtractionRing, drawFood } from './render/render-food';

// Snakes
export { drawSnake, drawSnakeWithLayering } from './render/render-snakes';

// Overlays (chip labels, particles)
export { drawChipLabel, drawParticles } from './render/render-overlays';

// Minimap + full map
export { drawMinimap, drawFullMap } from './render/render-minimap';
