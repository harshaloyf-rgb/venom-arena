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

---
Task ID: 1
Agent: main
Task: Create separate OnlineSnakeGame.tsx with fully independent codebase from SnakeGame.tsx

Work Log:
- Read current SnakeGame.tsx (offline-only, ~430 lines), page.tsx (gameMode state, handlePlayArena), arena-selector.tsx (isOnline toggle, onPlay prop)
- Created `/home/z/my-project/src/components/game/OnlineSnakeGame.tsx` — a 100% independent copy of SnakeGame.tsx with its own component name, props interface, and all helper functions duplicated. Uses a separate localStorage key prefix (`venom-high-score-online-`) to keep high scores independent.
- Updated `page.tsx` to import OnlineSnakeGame and conditionally render it when `gameMode === online`, otherwise render SnakeGame (offline).
- Ran lint — 0 errors.
- Browser verified: Offline arena launches SnakeGame with full canvas/HUD. Online arena path compiles clean (GUEST user lacks chips so the buy-in gate blocks entry — expected behavior).

Stage Summary:
- Two completely independent game components now exist:
  - `SnakeGame.tsx` → offline mode only
  - `OnlineSnakeGame.tsx` → online mode only (currently uses same local engine as placeholder)
- Editing either file will NEVER touch the other.
- `page.tsx` routes correctly: `gameMode === online` → OnlineSnakeGame, else → SnakeGame.
- Arena selector HUD unchanged — Online/Offline toggle, difficulty filters, live player counts, buy-in UI all preserved.

