---
Task ID: 1
Agent: main
Task: Remove star chips from offline mode + delete all online game code

Work Log:
- Removed star chip spawning, collection, and all references from engine.ts
- Removed StarChip interface, starChips/nextStarChipId from GameState in types.ts
- Removed STAR_CHIP_* constants from config.ts
- Removed drawStarChips function and StarChip import from renderer.ts
- Rewrote SnakeGame.tsx as clean offline-only component (removed all online engine code: socket connections, server snapshots, interpolation, online state/refs, online JSX overlays)
- Deleted online-engine.ts
- Deleted extrapolation.ts
- Deleted mini-services/game-server/ directory
- Cleaned up unused imports (SnakeSnapshot, ArenaSnapshot, TurnMetadata, BODY_DOWNSAMPLE_*, etc.) from engine.ts
- Removed snapshot re-exports from engine.ts
- Fixed snapshot.ts to remove starChips from buildSnapshot
- Removed extrapolation export from index.ts
- RESTORED arena-selector.tsx to original (with Online/Offline toggle, difficulty filters, live player counts, buy-in display)
- RESTORED page.tsx gameMode state and isOnline parameter in handlePlayArena

Stage Summary:
- Star chips completely removed from offline game (engine, renderer, types, config)
- All online multiplayer game code deleted (online-engine.ts, extrapolation.ts, game-server/)
- SnakeGame.tsx is now a clean ~430 line offline-only component
- Arena selector HUD fully preserved — Online/Offline toggle, difficulty filters, live stats, buy-in UI all intact
- Lint passes clean, no runtime errors, game launches correctly from arena selector
