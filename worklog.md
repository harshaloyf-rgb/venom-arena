---
Task ID: 1
Agent: main
Task: Fix blank screen and login issue — restore dev server persistence

Work Log:
- Diagnosed blank screen: dev server was not running (killed when previous session ended)
- Found and used next-supervisor.py (double-fork daemon) to keep server alive persistently
- Created missing start-game-server.sh (placeholder) so `bun run dev` properly chains to supervisor
- Restored package.json dev script to original: `bash start-game-server.sh && python3 next-supervisor.py ...`
- Verified .env has correct JWT_SECRET
- Full browser E2E test: login page renders, "Play as Guest" works, full lobby loads, all panels functional
- Guest login API returns 200 with player profile (150 chips, VENOM-XXXX tag)
- Zero console errors throughout
- Server persists across tool calls via supervisor daemon

Stage Summary:
- Root cause: dev server died when previous session ended, and `start-game-server.sh` was missing so `bun run dev` couldn't start the supervisor
- Fix: created start-game-server.sh, verified supervisor daemon works (double-fork keeps process alive)
- Application verified working: login, guest access, full lobby, cosmetics shop, all 12 stations, challenges
- Version confirmed: 008b50e (with 6 bot AI types)

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


---
Task ID: 2
Agent: main + subagent-844a0a4d
Task: Full offline/online codebase split, remove bots, remove extraction zone

Work Log:
- Copied 7 shared files to offline/online versions (engine, camera, renderer, atlas, skin-registry, face-cosmetics, render-snake-atlas)
- Used subagent to clean engine-offline.ts: removed bot imports, BOT_NAMES, bot spawn/move/respawn logic, extraction zone speed bonus, extraction zone from MoveContext and initialState
- Copied cleaned engine-offline.ts to engine-online.ts with updated header
- Updated all file headers to mark OFFLINE/ONLINE mode only
- Removed drawExtractionZone from both renderer files
- Updated all imports in SnakeGame.tsx (→ *-offline), OnlineSnakeGame.tsx (→ *-online)
- Updated shop/lab preview components to use offline versions
- Deleted original shared files: engine.ts, camera.ts, atlas.ts, skin-registry.ts, face-cosmetics.ts, renderer.ts, render-snake-atlas.tsx, bot-ai.ts
- Removed dead BOT_* and EXTRACTION_* constants from config.ts
- Updated index.ts barrel to only export shared files (types, config, vec2, pool, spatial-hash, snapshot)
- Lint passes clean, browser verification successful (game loads with canvas, zero errors)

Stage Summary:
- 7 files × 2 modes = 14 independent mode-specific files created
- Shared files (Layer 1): types.ts, config.ts, vec2.ts, pool.ts, spatial-hash.ts, snapshot.ts, constants.ts
- Offline files: engine-offline.ts, camera-offline.ts, renderer-offline.ts, atlas-offline.ts, skin-registry-offline.ts, face-cosmetics-offline.ts, render-snake-atlas-offline.ts, SnakeGame.tsx
- Online files: engine-online.ts, camera-online.ts, renderer-online.ts, atlas-online.ts, skin-registry-online.ts, face-cosmetics-online.ts, render-snake-atlas-online.ts, OnlineSnakeGame.tsx
- Bots completely removed (bot-ai.ts deleted, all bot logic stripped from engines)
- Extraction zone removed from engines, renderers, and config
- Committed and pushed as 4581a8c

---
Task ID: 1
Agent: main
Task: Fix extraction not working in offline mode + move collision and extraction to shared files

Work Log:
- Diagnosed extraction bug: `gameState.extractionZone?.active` was always `false` because extraction ZONE was removed previously, but extraction RING (press E, 3-sec progress) was still gated on it
- Created `src/lib/snake/extraction.ts` (shared): ExtractionState interface, createExtractionState(), updateExtractionProgress(), drawExtractRing()
- Created `src/lib/snake/collision.ts` (shared): KillEvent interface, CollisionResult interface, checkCollisions() with spatial hashing
- Updated `src/lib/snake/index.ts` to export collision and extraction modules
- Updated `src/lib/snake/engine-offline.ts`: removed ~110 lines of duplicated collision code, imports from shared collision.ts, re-exports KillEvent for backward compat
- Updated `src/lib/snake/engine-online.ts`: same changes as offline engine
- Rewrote `src/components/game/SnakeGame.tsx`: removed extractionZone gate, uses shared extraction module, removed duplicated drawExtractRing function
- Rewrote `src/components/game/OnlineSnakeGame.tsx`: same changes as offline component
- Removed unused `getPlayerSkinId` import from both components
- Verified: lint clean, dev server no errors, browser test passes (game loads, extraction button visible, E key triggers extraction ring, no console errors)

Stage Summary:
- Extraction now works in both offline and online modes (press E / right click / Extract button)
- Collision detection is in shared `collision.ts` — edit once, affects both modes
- Extraction logic is in shared `extraction.ts` — edit once, affects both modes
- Architecture: Layer 1 shared now includes collision.ts and extraction.ts alongside types, config, vec2, pool, spatial-hash, snapshot

---
Task ID: 1-a
Agent: sub
Task: Share lib files (camera, atlas, skin-registry, face-cosmetics)

Work Log:
- Copied camera-offline.ts → camera.ts; updated header from "OFFLINE mode ONLY" to "SHARED — used by both offline and online modes"; changed renderer-offline.ts reference to renderer.ts
- Copied atlas-offline.ts → atlas.ts; updated header to shared format (3 lines)
- Copied skin-registry-offline.ts → skin-registry.ts; updated header to shared format (3 lines)
- Copied face-cosmetics-offline.ts → face-cosmetics.ts; updated header to shared format (3 lines)
- Verified all 4 files: body code byte-for-byte identical to offline originals (only header comment lines changed)
- Old offline/online duplicates NOT deleted (reserved for later phase)

Stage Summary:
- 4 new shared files created: camera.ts, atlas.ts, skin-registry.ts, face-cosmetics.ts
- Each is an exact copy of the offline version with only the header comment updated
- camera.ts: line 7 changed from "renderer-offline.ts" to "renderer.ts"
- Other 3 files: header reduced from 4 lines to 3 lines (removed "Editing this file does NOT affect online mode.")
- Old *-offline.ts and *-online.ts duplicates remain untouched

---
Task ID: 1-b
Agent: sub
Task: Share engine.ts and renderer.ts

Work Log:
- Copied engine-offline.ts → engine.ts (shared version)
- Updated engine.ts header from "OFFLINE mode ONLY" to "SHARED — used by both offline and online modes."
- Changed all OFFLINE section header comments: "OFFLINE Snake Creation" → "Snake Creation", "OFFLINE Safe Spawn" → "Safe Spawn", "OFFLINE Snake Movement" → "Snake Movement", "OFFLINE Food Creation" → "Food Creation", "OFFLINE Food Eating (Magnet + Vacuum)" → "Food Eating (Magnet + Vacuum)", "OFFLINE Death & Food Distribution" → "Death & Food Distribution", "Main Game Tick (OFFLINE ONLY)" → "Main Game Tick", "Offline-Specific Food Management" → "Food Management (density-based, slither.io style)", "Player Respawn (OFFLINE)" → "Player Respawn", "Debug Score (OFFLINE)" → "Debug Score"
- Removed "// OFFLINE-SPECIFIC" comment from config import block
- Removed "(OFFLINE-SPECIFIC)" from inline food spawning comment
- Changed PlayerSkinOverride JSDoc from "offline-specific" to "Optional skin override for the player snake"
- Added `playerName?: string` parameter to `createInitialState`
- Updated `createInitialState` to use `playerName || 'You'` in createSnake call
- Updated `respawnPlayer` to use `old.name` instead of hardcoded `'You'`
- Copied renderer-offline.ts → renderer.ts (shared version)
- Updated renderer.ts header from "OFFLINE mode ONLY" to "SHARED — used by both offline and online modes."
- Changed renderer.ts import from `@/lib/snake/camera-offline` to `@/lib/snake/camera`
- Verified zero remaining "OFFLINE" references in both shared files
- Old *-offline.ts and *-online.ts duplicates NOT deleted

Stage Summary:
- 2 new shared files created: engine.ts, renderer.ts
- engine.ts: 17 edits (header, 10 section comments, import comment, JSDoc, playerName param, respawn name preservation)
- renderer.ts: 2 edits (header, camera import path)
- Both files are functionally identical to offline originals except for: header text, OFFLINE-stripped comments, playerName parameter, camera import path
- Old mode-specific duplicates remain untouched for later cleanup

---
Task ID: 1-c
Agent: sub
Task: Share render-snake-atlas and create hud.ts

Work Log:
- Copied render-snake-atlas-offline.tsx → render-snake-atlas.tsx (shared version)
- Updated render-snake-atlas.tsx header from "OFFLINE mode ONLY" to "SHARED — used by both offline and online modes" (3-line header)
- Changed 5 imports in render-snake-atlas.tsx from offline-specific to shared:
  - `@/lib/snake/camera-offline` → `@/lib/snake/camera`
  - `@/lib/snake/atlas-offline` → `@/lib/snake/atlas` (2 lines: type import and LEGENDARY_EMITTER_CONFIG import)
  - `@/lib/snake/skin-registry-offline` → `@/lib/snake/skin-registry`
  - `@/lib/snake/face-cosmetics-offline` → `@/lib/snake/face-cosmetics`
- Old render-snake-atlas-offline.tsx NOT deleted
- Created `src/components/game/hud.ts` with 5 exported functions extracted from SnakeGame.tsx:
  - `cleanupDeadSnakeParticles(snakeId)` — calls cleanupSnakeParticles + clearSmoothedSegs from render-snake-atlas
  - `renderBackground(ctx, state, camera, viewport, _fps, _now)` — clears canvas, draws grid, draws food
  - `renderHUD(ctx, state, camera, viewport, _fps, _now, kills, _highScore)` — draws minimap, rank, score, kills
  - `drawMinimapTopLeft(ctx, snakes, player, cw, _ch)` — draws minimap in top-left
  - `drawMouseCursor(ctx, input)` — draws crosshair cursor
- Moved MAP_SIZE (120) and MAP_PAD (12) constants into hud.ts
- hud.ts imports from: `@/lib/snake/types`, `./renderer` (drawGrid, drawFood), `./render-snake-atlas` (cleanupSnakeParticles, clearSmoothedSegs), `./input` (InputHandler)

Stage Summary:
- 2 new shared files created: render-snake-atlas.tsx, hud.ts
- render-snake-atlas.tsx: exact copy of offline version with header + 5 import paths updated
- hud.ts: 188 lines, contains all duplicated HUD drawing logic ready for both SnakeGame.tsx and OnlineSnakeGame.tsx to import
- Old offline/online duplicates remain untouched for later phase

---
Task ID: 2
Agent: sub
Task: Create GameCanvas + rewrite components + update all imports + delete old files

Work Log:
- Created `src/components/game/GameCanvas.tsx` — shared game component replacing duplicated code in SnakeGame.tsx and OnlineSnakeGame.tsx
  - Props: `onExit`, `arenaId`, `mode: 'offline' | 'online'`, `playerName`
  - Imports all shared modules: engine, camera, atlas, skin-registry, extraction, renderer, render-snake-atlas, hud, input
  - Uses `mode` prop to construct mode-specific localStorage high score key: `venom-high-score${mode === 'online' ? '-online' : ''}-${arenaId || 'default'}`
  - Passes `playerName` to `createInitialState` (with `undefined` for `initialScore`)
  - All game loop logic, HUD rendering, death overlay, extraction ring preserved exactly
  - No local helper functions (renderBackground, renderHUD, drawMinimapTopLeft, drawMouseCursor, cleanupDeadSnakeParticles) — imported from `./hud`
- Rewrote `src/components/game/SnakeGame.tsx` as thin wrapper (13 lines): passes `mode="offline"` to GameCanvas
- Rewrote `src/components/game/OnlineSnakeGame.tsx` as thin wrapper (13 lines): passes `mode="online"` to GameCanvas
- Updated `src/lib/snake/index.ts` barrel: added 5 new re-exports (`camera`, `engine`, `atlas`, `skin-registry`, `face-cosmetics`)
- Fixed imports in 4 external files:
  - `cosmetics-section.tsx`: `face-cosmetics-offline` → `face-cosmetics`
  - `skin-preview-game.tsx`: `atlas-offline` → `atlas`, `skin-registry-offline` → `skin-registry`, `face-cosmetics-offline` → `face-cosmetics`
  - `game-snake-preview.tsx`: `skin-registry-offline` → `skin-registry`, `face-cosmetics-offline` → `face-cosmetics`
  - `snake-face-tester.tsx`: `skin-registry-offline` → `skin-registry`
- Deleted 14 old duplicated files:
  - `src/lib/snake/`: camera-offline.ts, camera-online.ts, engine-offline.ts, engine-online.ts, atlas-offline.ts, atlas-online.ts, skin-registry-offline.ts, skin-registry-online.ts, face-cosmetics-offline.ts, face-cosmetics-online.ts
  - `src/components/game/`: renderer-offline.ts, renderer-online.ts, render-snake-atlas-offline.tsx, render-snake-atlas-online.tsx
- TypeScript type-check: zero errors in any of our changed files
- grep confirms zero remaining references to any *-offline or *-online import paths

Stage Summary:
- Complete deduplication: SnakeGame.tsx and OnlineSnakeGame.tsx are now thin wrappers (~13 lines each) around shared GameCanvas.tsx (~340 lines)
- GameCanvas uses `mode` prop only for localStorage high score key separation
- All 14 mode-specific -offline/-online duplicated files deleted
- Barrel file (index.ts) now re-exports all shared modules
- All external consumers updated to use shared import paths
- No game logic changed — purely a structural refactor

---
Task ID: 2
Agent: main
Task: Share all duplicated snake game code (P0-P3 priorities)

Work Log:
- Analyzed all 53 features across SnakeGame.tsx and OnlineSnakeGame.tsx
- Found 14 file-pairs that were 100% identical except for header comments
- Phase 1: Created shared lib files (camera.ts, atlas.ts, skin-registry.ts, face-cosmetics.ts, engine.ts)
- Phase 2: Created shared component files (renderer.ts, render-snake-atlas.tsx, hud.ts)
- Phase 3: Created GameCanvas.tsx — single shared component with `mode` prop
- Phase 4: Rewrote SnakeGame.tsx (11 lines) and OnlineSnakeGame.tsx (11 lines) as thin wrappers
- Phase 5: Updated index.ts barrel, fixed 4 external files (cosmetics panels), deleted 14 old files
- Phase 6: Lint clean, browser verified — game renders, no console errors
- Fixed engine.ts: added playerName param to createInitialState, fixed respawnPlayer null safety, added SpatialEntity import

Stage Summary:
- ~4,900 lines of duplicated code consolidated into single shared files
- 14 duplicated files deleted, 11 new shared files created
- SnakeGame.tsx: 630 lines → 11 lines (98% reduction)
- OnlineSnakeGame.tsx: 641 lines → 11 lines (98% reduction)
- Player name is now shared via `playerName` prop on GameCanvas
- All 53 features now edit-once (shared), except the `mode` prop controls high score key prefix
- External files (cosmetics-section, skin-preview-game, game-snake-preview, snake-face-tester) updated to shared imports

---
Task ID: 3
Agent: main
Task: Implement 3 HUD text changes (Best Ever label, font sizes, score label)

Work Log:
- Changed Best Ever section in GameCanvas.tsx: font 9px→8px label, 10px→9px number, appended 'score' word after the number (dimmed opacity)
- Reduced leaderboard title font from text-xs (12px) to text-[10px], entry text from text-xs to text-[10px]
- Reduced canvas HUD fonts in hud.ts: rank 11px→9px, score 13px→10px, kills label 11px→9px, kills number 13px→10px
- Center-bottom score already showed 'Score xxxxx' — confirmed correct
- Lint clean, dev server no errors

Stage Summary:
- Best Ever now shows: 'Best Ever' label + '1,234 score' underneath
- All HUD fonts reduced by 2-3px for smaller, cleaner look
- Center bottom score displays 'Score xxxxx' as before

---
Task ID: 4
Agent: main
Task: Create 6 bot AI types with distinct behaviors

Work Log:
- Created src/lib/snake/bot-ai.ts (~430 lines) with 6 bot types:
  - Hunter: chases prey, predicts movement, circles to cut off, flees larger threats
  - Gatherer: seeks food clusters, avoids all combat, never boosts
  - Ambusher: waits near food clusters, strikes when prey enters range, retreats after
  - Kamikaze: always boosts toward nearest snake, aggressive straight-line charges
  - Wanderer: random gentle movement with slight food attraction, no combat
  - Opportunist: targets only smaller snakes, flees larger ones, seeks death drop food
- Each type has unique color palette, name pool (10 names each), and AI behavior
- Module-level Map stores per-bot AI state (target, boost, timers, type-specific data)
- Performance: retarget timers (15-30 ticks), distance-squared checks (no sqrt), 1 bot respawn/tick
- Modified engine.ts: added bot AI update step, bot movement step, dead bot cleanup, auto-respawn
- Added createBotSnakeFactory (avoids exposing private createSnake), initBots export
- Bot colors: type-specific via BOT_TYPE_COLORS lookup in createSnake
- Wired initBots() call in GameCanvas.tsx after createInitialState
- Default mix: 2 Hunters, 3 Gatherers, 1 Ambusher, 2 Kamikazes, 3 Wanderers, 2 Opportunists (13 total)
- Wall avoidance for all bot types (steer away from arena boundary)
- Lint clean, browser verified via VLM: 13 bots spawned, leaderboard shows bot names (Taipan, Wisp, Sprout, Harvest, Dash), bots actively eating food (scores 95-148)

Stage Summary:
- New file: src/lib/snake/bot-ai.ts (6 bot AI types, spawning, respawning)
- Modified: engine.ts (bot integration in gameTick, initBots export)
- Modified: GameCanvas.tsx (initBots call)
- Shared code — works for both offline and online modes
- Bot population self-maintains: dead bots respawn 1/tick to maintain target count
---
Task ID: 5
Agent: main
Task: Re-apply 6 lost bug fixes after git reset

Work Log:
- Bug 1 (GameCanvas.tsx): Changed `if (accumulator >= tickMs)` to `while (accumulator >= tickMs && maxTicks-- > 0)` with maxTicks=5 cap. Removed the accumulator discard cap (`if > tickMs, reset to 0.5`). Game now properly drains accumulated time, running multiple ticks per frame when needed.
- Bug 2 (spatial-hash.ts): Changed `clear()` from only resetting counts to also pruning empty cells from the Map. Uses `for (const [key, cell] of this.cellMap)` to delete cells with count 0 and reset cells with count > 0. Prevents unbounded memory growth in long game sessions.
- Bug 3 (collision.ts): Imported NECK_PROTECTION from config. Changed body hash loop from `for (let i = 0; ...)` to `for (let i = NECK_PROTECTION; ...)` skipping first 5 segments. Prevents phantom kills near snake necks.
- Bug 4 (bot-ai.ts): Removed duplicate `data.wanderChangeTimer--` from `updateWanderer()` (line 363). The generic `updateAllBotAI` dispatcher already decrements it for all bots. Wanderers now turn at the intended frequency.
- Bug 5 (collision.ts): By starting body hash at `i = NECK_PROTECTION` (5), the head segment (i=0) is no longer inserted into the body hash. Head-on-head collisions now correctly fall through to the dedicated head-on-head handler instead of being caught by the head-to-body check.
- Bug 6 (collision.ts): Imported HEAD_ON_HEAD_BOOST_WINS from config. Added boost-wins check before size comparison: if one snake is boosting and the other isn't, the boosting snake wins. Falls through to size-based rule only when both or neither are boosting.
- Verified login/register: tested register + login with new credentials — both work. Old accounts lost because git replaced db/custom.db (only guest accounts were in git).
- Lint clean, zero compilation errors.

Stage Summary:
- All 6 bugs fixed in 4 files: GameCanvas.tsx, spatial-hash.ts, collision.ts, bot-ai.ts
- Game loop now runs at correct speed (while loop instead of if)
- Memory leak in spatial hash fixed (empty cells pruned on clear)
- Neck protection actually enforced (NECK_PROTECTION=5 segments skipped in body hash)
- Head-on-head collision rules now reachable (head not in body hash)
- Boost-wins rule correctly applied (boosting snake always wins head-on)
- Wanderer bots turn at designed frequency (no more double decrement)
- Login works: user must register a new account (old accounts lost with database)

---
Task ID: 1
Agent: sub
Task: Clean dead code in snake library (10 files)

Work Log:
- config.ts: Removed 18 dead constants (ARENA_BG_COLOR, ARENA_GRID_COLOR, BOOST_SHRINK_RATE, DEATH_FOOD_LARGE_DIVISOR, DEATH_FOOD_MEDIUM_DIVISOR, SACRIFICE_SET_COUNT, RARITY_UPGRADE_CHANCE, CHEST_WEIGHTS, SET_PIECE_COUNTS, SERVER_TICK_RATE, CLIENT_RENDER_FPS, MAX_EXTRAPOLATION_MS, ANGLE_LERP_SPEED, CAMERA_LERP, POSITION_PREDICT_FACTOR, BOOST_SPEED_MULTIPLIER, RESPAWN_DELAY, SPAWN_INVULN_BLINK_RATE)
- vec2.ts: Reduced from 106 lines to 10 lines — kept only distSq function, removed 12 unused functions (dist, angleDirect, distance, distanceSq, normalize, angleBetween, lerp, lerpVec2, rotate, fromAngle, add, sub, scale, magnitude) and the unused Vec2 import
- pool.ts: Removed 5 dead PathBuffer methods (getXY, tailX getter, tailY getter, setLength, toVec2Array, initFromArray), deleted ObjectPool class, scratchVec2 export, and SnapshotPool class entirely. Reduced from 288 to 160 lines.
- skin-registry.ts: Removed 4 dead exports (getDefaultSkinAsset, getPlayerSkinId, getAllSkinIds, getSkinColors) and 2 dead internal functions (darkenHex, hexToRgb)
- bot-ai.ts: Removed 3 dead exports (BOT_TYPE_LABELS, getBotType, getTotalBotCount)
- engine.ts: Removed setDebugScore function export (34 lines including section header)
- camera.ts: Removed screenToWorld function export (13 lines)
- renderer.ts: Removed drawMinimap function (47 lines), also removed unused Snake import
- hud.ts: Changed `export function drawMinimapTopLeft` to `function drawMinimapTopLeft` (un-exported, only called internally by renderHUD)
- types.ts: Removed 6 dead interfaces (CellCoord, RarityWeights, SpiralTurnState, SkinPiece, CollectionSet, CraftingTransaction). Inlined SpiralTurnState shape into Snake.spiral field to preserve the spiral feature.
- Verified: zero importers remain for all removed symbols across src/
- Verified: ESLint passes clean on all 10 changed files
- Verified: TypeScript has no new errors (only pre-existing ones in unrelated files)

Stage Summary:
- Removed ~220 lines of dead code across 10 files in src/lib/snake/ and src/components/game/
- No logic or behavior changes — purely dead code removal
- All retained exports verified to have at least one importer in src/
- SpiralTurnState type was inlined into Snake interface since the field must remain

---
Task ID: spiral-coil-fix
Agent: main
Task: Fix snake coiling physics — make coils tighten like slither.io python grip

Work Log:
- Diagnosed root cause: STEERING_LERP (0.12) bottlenecks actual turn rate, making the old SPIRAL_MAX_MULTIPLIER (1.8x) on maxTurn completely ineffective
- The old spiral system increased maxTurn but the actual turn = diff * 0.12 never exceeded maxTurn, so the multiplier had zero effect
- Fixed config.ts: replaced SPIRAL_MAX_MULTIPLIER/SPIRAL_RAMP_TICKS with new constants:
  - SPIRAL_TIGHTEN_TICKS=300 (5s continuous tightening, no plateau)
  - SPIRAL_TURN_MULTIPLIER=4.0 (max turn rate boost)
  - SPIRAL_LERP_BOOST=0.35 (critical: boosts steering lerp from 0.12 to 0.47)
  - SPIRAL_PATH_CONTRACT=0.12 (path-level body contraction)
- Fixed engine.ts moveSnake(): now boosts BOTH maxTurn AND effectiveLerp during spiral
  - Continuous quadratic ease-out tightening over 300 ticks (5 seconds)
  - Circle radius shrinks from 25px → ~6px as spiral progresses
- Added contractPathCurvature() function: modifies actual path data to simulate slither.io rope-constraint body following
  - Computes curvature via cross-product at each path entry
  - Shifts entries perpendicular to movement direction, toward curve center
  - Only active during spiral mode, processes every 3rd entry for performance
  - Fade factor: strongest at 30-70% of body length, zero at head and tail
- Kept render-only coil-path.ts as subtle visual enhancement on top of physical tightening
- Verified: lint passes, game loads in browser with zero console errors

Stage Summary:
- Root cause of invisible coil: STEERING_LERP bottlenecked turn rate, making spiral multiplier useless
- Fix: boost both maxTurn and lerp with continuous tightening (no plateau)
- Added path-level curvature contraction for extra body tightening effect
- Circle radius goes from 25px (normal) → 6.25px (full spiral) over 5 seconds of continuous turning
- Files changed: config.ts, engine.ts
---
Task ID: 2
Agent: main
Task: Collision bug fixes

Work Log:
- Commented out drawCollisionChain in both renderers (hidden from players)
- Removed GameCanvas debug dots + unused imports
- Bug 1: Added missing break in head-on-head loop (collision.ts)
- Bug 2: Changed bodyRadius to SNAKE_RADIUS in all 4 collision dot offsets
- Bug 5: Extended spawn protection food block to bots
- Death drops: Removed +15 bonus, capped food count to path length

Stage Summary:
- collision.ts: 4 bodyRadius fixes, 1 break added
- engine.ts: spawn protection for bots, death drops fixed
- render-snake-atlas.tsx: drawCollisionChain re-commented
- GameCanvas.tsx: old debug dots removed

---
Task ID: 2-a
Agent: main
Task: Reduce head size 30%→5%, fix bot preset skins, fix collision neck protection

Work Log:
- Changed head size multiplier from 1.3 (30%) to 1.05 (5%) in 3 places in render-snake-atlas.tsx:
  - Atlas renderer: atlasHeadR and headDrawSize
  - Fallback renderer: headScale
- Added getPresetVisualProps() to cosmetics-utils.ts that maps preset IDs (preset-fish, preset-lion, etc.) to SkinVisualProps (colors, bodyStyle, taperStyle, glow)
- Added presetVis check in renderSnakeFallback so bots with preset skins render with proper shapes/taper/glow instead of plain circles
- Added presetVisuals check in renderSnakeAtlas so players with preset skins also route to fallback with full visual rendering
- Fixed head color to use preset's primary color via patternVis || presetVis
- Fixed isUniformTaper to also check presetVis.taperStyle
- Applied NECK_PROTECTION (5 segments) in collision.ts:
  - Body hash insert now starts from i = 1 + NECK_PROTECTION (skips neck points in broad phase)
  - Narrow phase loop now starts from j = NECK_PROTECTION (skips neck segments)
  - This prevents false deaths when snakes pass near each other's heads
- Verified: lint clean, dev server compiles, game loads with zero console errors

Stage Summary:
- Head visual size reduced from 30% to 5% larger than body
- Bots now render with full preset skin visuals (dragon scales, crystal shards, armor plates, etc.)
- Collision false-positive bug fixed: neck segments no longer cause phantom deaths
- Files changed: render-snake-atlas.tsx, cosmetics-utils.ts, collision.ts
---
Task ID: 2
Agent: main
Task: Remove bots from online mode — fix respawnDeadBots spawning bots every tick

Work Log:
- Investigated why bots still appeared in online mode despite initBots() guard
- Found root cause: respawnDeadBots() in bot-ai.ts runs every tick in gameTick() — sees 0 alive bots vs target 13, spawns 1 bot per tick to fill deficit
- Added `botsEnabled: boolean` field to GameState (types.ts)
- Set default to `false` in createInitialState() (engine.ts)
- Set `botsEnabled = true` in GameCanvas.tsx only for offline mode before initBots()
- Wrapped updateAllBotAI, bot movement loop, and respawnDeadBots in `if (state.botsEnabled)` guards in gameTick()
- Verified collision.ts has no NECK_PROTECTION changes (already clean)
- Lint passes clean

Stage Summary:
- Root cause: respawnDeadBots() was unconditionally spawning bots to fill the target count (13) regardless of game mode
- Fix: Added botsEnabled flag to GameState, guards all bot logic in gameTick
- Files changed: types.ts, engine.ts, GameCanvas.tsx
- Online mode now has zero bots; offline mode unaffected
---
Task ID: dead-code-cleanup
Agent: main
Task: Remove all dead code from snake lib, commit with timestamp

Work Log:
- Scanned entire src/ for dead code using Explore agent
- Found 10 dead code items across 7 files
- Removed unused imports: SNAKE_RADIUS, BOOST_MIN_SCORE from bot-ai.ts (kept SPAWN_RADIUS, used on line 67)
- Removed unused import: IPathBuffer type from engine.ts
- Removed unused import: worldToScreen from GameCanvas.tsx
- Removed dead re-export: KillEvent from engine.ts (still imported internally)
- Deleted dead file: vec2.ts (unused, distSq duplicated in bot-ai.ts)
- Deleted dead file: constants.ts (unused re-export shim for config.ts)
- Removed unused Vec2 interface from types.ts
- Removed vec2 export from index.ts barrel
- Ran lint: zero errors
- Browser verified: page loads clean, no console errors
- Caught SPAWN_RADIUS regression during browser test (removed it then immediately restored it)
- Committed and pushed with name/date/timestamp as requested

Stage Summary:
- 8 files changed, 2 insertions, 31 deletions
- Deleted files: vec2.ts, constants.ts
- Commit: 86599e0 — "refactor: remove dead code — Z.ai — 2026-08-10 04:41 IST"
- All changes pushed to main
---
Task ID: bot-steering-smooth + head-on-fix
Agent: main
Task: Fix 5 bot steering jitter issues + head-on-head both-die collision bug

Work Log:
- Diagnosed 5 causes of bot jitter: dual-lerp, flat wall blend, over-sensitive body scanner, aggressive wander, no forward momentum
- Fix 1: Removed STEER_LERP per-type lerp. steerToward() now blends 60/40 forward bias instead of lerping. Engine STEERING_LERP handles all smoothing.
- Fix 2: wallAvoidAngle() now distance-proportional: 5% at 600px margin → 90% at wall edge
- Fix 3: Body scanner only reacts when severity > 0.3 (body within 126px). Distant bodies no longer cause micro-swerves.
- Fix 4: Wander drift reduced from ±0.6 rad (±34°) to ±0.15 rad (±8.6°). Interval increased to 120-240 ticks.
- Fix 5: steerToward() uses 0.6/0.4 forward bias by default. Added steerToFoodBias() with per-type food aggression.
- Investigated head-on-head collision: root cause was neck segments (index 1-3, only 3-9px behind head) triggering false head-to-body kills on BOTH snakes
- Fix: Added NECK_SKIP=4 constant, narrow phase now starts at j=4 instead of j=0
- Lint clean, browser verified no errors

Stage Summary:
- Bots should now move smoothly with natural forward momentum
- Head-on-head collisions: longer snake wins, equal = both die (no more false double-kill from neck)
- Commit: 8a73bbf pushed to main
