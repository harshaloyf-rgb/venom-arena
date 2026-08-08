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

---
Task ID: 2
Agent: sub
Task: Clean engine-offline.ts of all bot and extraction zone code

Work Log:
- Updated file header to new concise 3-line format: "Game Engine — OFFLINE mode ONLY. Editing this file does NOT affect online mode."
- Removed bot-ai imports: `BotSnakeInput` type import, `getBotTarget` function import
- Removed BOT_ config imports: `BOT_MAX_TURN_RATE`, `BOT_START_SCORE_MIN`, `BOT_START_SCORE_MAX`, `BOT_COUNT`
- Removed EXTRACTION_ config imports: `EXTRACTION_SCORE_THRESHOLD`, `EXTRACTION_SPEED_BONUS`, `EXTRACTION_ZONE_RADIUS`
- Removed `BOT_NAMES` array (30 snake name strings)
- Removed `extractionZone` field from `MoveContext` interface
- Removed `isBot` parameter from `createSnake` function signature; hardcoded `isBot: false, isPlayer: true` in returned object
- Updated both call sites (`createInitialState` and `respawnPlayer`) to match new 7-param signature (removed the `isBot` boolean arg)
- In `moveSnake`: replaced ternary `snake.isBot ? BOT_MAX_TURN_RATE : BASE_TURN_RATE...` with just `BASE_TURN_RATE...`
- In `moveSnake`: removed `!snake.isBot` guard on spiral assist block (now always runs); dedented inner code to maintain consistent indentation
- In `moveSnake`: removed entire extraction zone speed bonus block (the `if (ctx.extractionZone?.active ...)` block)
- Removed entire `respawnBots` function (19 lines)
- In `createInitialState`: set `extractionZone` to dead value `{ x: 0, y: 0, radius: 0, active: false }` (keeps GameState type happy, ring never activates)
- In `createInitialState`: removed bot spawn loop (`for (let i = 0; i < BOT_COUNT; i++)...`)
- In `createInitialState`: updated JSDoc from "player + bots + 3000 initial food" to "player + 3000 initial food"
- In `gameTick`: removed `extractionZone` from `moveCtx` construction
- In `gameTick`: removed `botInputMap` variable (was `state.snakes as unknown as Map<string, BotSnakeInput>`)
- In `gameTick`: removed entire bot move loop (step 2: "Move bots")
- In `gameTick`: removed bot respawn call (step 8: `respawnBots(...)`)
- Renumbered gameTick step comments: 1→Move player, 2→Check food eating, 3→Food spawning, 4→Check collisions
- Cleaned up extra blank lines in gameTick
- Kept `findSafeSpawn` function intact (used for player spawn)
- Verified: zero dangling references to removed symbols via grep

Stage Summary:
- engine-offline.ts reduced from 792 lines to ~713 lines (~79 lines removed)
- All bot-related code completely removed (imports, config, names, creation, AI targeting, movement, respawn)
- All extraction zone code completely removed from engine logic (imports, speed bonus, moveCtx)
- extractionZone retained as dead value `{ x: 0, y: 0, radius: 0, active: false }` in initial state so component files don't break (extraction ring check `gameState.extractionZone?.active` will be false)
- Spiral assist now runs unconditionally (no bot guard)
- createSnake always produces player snakes (isBot: false, isPlayer: true)
- Pre-existing unused imports (SPATIAL_CELL_SIZE, IPathBuffer) left untouched — out of scope

