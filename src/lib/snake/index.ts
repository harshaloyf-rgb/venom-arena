// ============================================================================
// Snake Game Library — Re-exports SHARED files only.
//
// Mode-specific files (engine, camera, renderer, atlas, skin-registry,
// face-cosmetics, render-snake-atlas) are imported directly by their respective
// component (SnakeGame.tsx → *-offline, OnlineSnakeGame.tsx → *-online).
//
// This barrel only exports types, config constants, and pure utility modules
// that both modes share.
// ============================================================================

export * from './config';
export * from './types';
export * from './vec2';
export * from './pool';
export * from './spatial-hash';
export * from './snapshot';
export * from './collision';
export * from './extraction';
