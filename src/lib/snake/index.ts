// ============================================================================
// Snake Game Library — Re-exports everything for convenience.
// NOTE: engine.ts (offline) and online game-server have INDEPENDENT game logic.
// No core.ts — that was removed to prevent offline↔online cross-contamination.
// ============================================================================

export * from './config';
export * from './types';
export * from './vec2';
export * from './pool';
export * from './spatial-hash';
export * from './camera';
export * from './bot-ai';
export * from './engine';
export * from './snapshot';
