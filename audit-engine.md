# AUDIT: Game Engine, Server & Renderer — Venom Arena

**Audit ID:** audit-1
**Scope:** 15 files across `src/lib/`, `src/components/game/`, `mini-services/game-server/`
**Date:** 2025-01-24

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 7 |
| Medium | 8 |
| Low | 4 |

---

## CRITICAL Findings

### E-C01: Duplicate GameSnapshot Interface — Wrong One Used in online-game.tsx
- **SEVERITY:** Critical
- **FILE:** `src/lib/game-types.ts` (lines 76-82) vs `src/lib/types.ts` (lines 122-141)
- **WHAT:** Two completely different `GameSnapshot` interfaces exist:
  - `game-types.ts` has: `tick`, `snakes: Snake[]`, `foods: Food[]`, `worldSize`, `killFeed: KillFeedEntry[]`
  - `types.ts` has: `arenaId`, `tick`, `snakes: SnakeSnapshot[]`, `foods: FoodSnapshot[]`, `worldSize`, `mapRadius`, `mapCenterX/Y`, `leaderId`, `leaderChips`, `realPlayerCount`, `yourRank`, `arenaLeaderboard`, `commissionRate`
  
  The game server (`game-state.ts` line 1085) builds snapshots using the `types.ts` interface. The real game canvas (`game-canvas.tsx` line 100) imports from `types.ts`. But `online-game.tsx` (line 5) imports from `game-types.ts` and expects a completely different shape. The `Snake` type in `game-types.ts` has `targetAngle`, `botTarget`, `botState: 'wander'|'chase'|'flee'|'harvest'` which doesn't match the server at all.
- **WHY:** If anyone tries to use `online-game.tsx` (it imports `DEFAULT_CONFIG` which doesn't even exist — see E-C02), it would crash on snapshot receipt. It's dead code that creates confusion about which types are authoritative.
- **FIX:** Delete `src/lib/game-types.ts` entirely. It's a vestige of an earlier iteration. The only files importing from it are `online-game.tsx` and `offline-game.tsx` — both are dead/legacy wrappers.

### E-C02: online-game.tsx Imports Non-Existent `DEFAULT_CONFIG`
- **SEVERITY:** Critical
- **FILE:** `src/components/game/online-game.tsx` line 6
- **WHAT:** `import { DEFAULT_CONFIG } from '@/lib/game-config'` — `DEFAULT_CONFIG` does not exist in `game-config.ts`. The file exports `ARENA_TIERS`, `WORLD_SIZE`, `INITIAL_SPAWN_SCORE`, etc. but no `DEFAULT_CONFIG` object.
- **WHY:** This file would fail to compile if imported. It's dead code that uses the wrong event names (`joined`, `you_died`) and wrong snapshot type. The actual online game is rendered by `game-canvas.tsx`.
- **FIX:** Delete `online-game.tsx` — it's a legacy prototype replaced by `game-canvas.tsx`.

### E-C03: online-game.tsx Uses Wrong Socket Events — Incompatible with Game Server
- **SEVERITY:** Critical
- **FILE:** `src/components/game/online-game.tsx` lines 323-373
- **WHAT:** This component listens for:
  - `joined` → server emits `join_arena` response, not a `joined` event
  - `you_died` → server emits `death` event with different payload shape
  - `snapshot` with `GameSnapshot` from `game-types.ts` → server sends snapshot matching `types.ts`
  - No `death_food_drop`, no `kill_feed`, no `extract_progress` handling
  - `snake.kills` referenced (line 354) — the `Snake` type in `game-types.ts` has no `kills` field
- **WHY:** If this component were ever wired into the actual game flow, it would silently receive no data, never track the player, and never show death.
- **FIX:** Delete `online-game.tsx`.

### E-C04: snake-engine.ts Path-Based Body System Is NEVER Used
- **SEVERITY:** Critical
- **FILE:** `src/lib/snake-engine.ts` lines 295-379
- **WHAT:** The engine defines `buildInitialPath()`, `extendPath()`, and `sampleSegments()` — a pixel-level path interpolation system designed for smooth curves with sub-stepping. **Neither the online server nor the offline engine uses any of these functions.** Both use simple `points.unshift(newHead)` / `points.pop()` on a segment array with no sub-stepping.
  
  The snake-engine comments explicitly state:
  > "CRITICAL: We store the FULL path history (not just segment positions). Segments are then sampled from this path at `spacing` intervals. This gives smooth curves and enables gap navigation."
  
  But both implementations ignore this entirely and use the old approach of directly storing segment positions.
- **WHY:** The claimed benefit of gap navigation (spacing=16, collisionRadius=6 → 4px passable gaps) doesn't work because segments are not evenly spaced. After `unshift(newHead)`, consecutive segments are `speed` pixels apart (4.5-8px depending on boost), not `segmentSpacing` (16px) apart. The actual gap between collision circles varies wildly.
- **FIX:** Either (a) implement the path-based system in both online and offline engines, or (b) remove the dead code from snake-engine.ts and accept the simpler segment array approach (adjusting collision math accordingly).

---

## HIGH Findings

### E-H01: Online Death Food Drops ARE Working — But Rendering Has a Subtle Issue
- **SEVERITY:** High (finding, not a bug)
- **FILE:** `mini-services/game-server/index.ts` lines 514-525, `game-state.ts` lines 399-442, `game-canvas.tsx` line 1441
- **WHAT:** The death food drop chain for **online mode** is intact:
  1. ✅ Death trigger (line 501: `dead.isDead = true`)
  2. ✅ Drop function (line 518: `dropScoreOrbsAtBody(room, dead.points, dead.score, dead.color)`)
  3. ✅ Foods added to `room.foods` array (inside `dropScoreOrbsAtBody`)
  4. ✅ Grid rebuilt next tick (line 410: `room.grid.clear()` then lines 431-443 re-insert all foods)
  5. ✅ Snapshot includes foods (line 1128: `room.foods.map(...)`) 
  6. ✅ Client renders foods (line 1441: `drawFood(rc, snap.foods)`)
  7. ✅ `death_food_drop` event also sends body points for particle effects (lines 547-558)
  
  **HOWEVER**: There's a timing issue. Death drops happen during the tick (step 7), but the grid was already rebuilt at the start of that same tick (step 1). The newly dropped foods won't be in the spatial grid until the NEXT tick. This means:
  - Other snakes cannot eat the death-dropped food for 1 tick (~33ms)
  - The food IS visible in the snapshot (foods are read directly from `room.foods`)
  - The food IS collidable next tick
  
  This is actually fine — it's a standard game loop pattern. The food appears visually immediately.
- **WHY:** Not a visible bug to players — just noting the 1-tick delay for completeness.
- **FIX:** No fix needed. The visual appears immediately; collision is 1 tick later which is imperceptible.

### E-H02: Offline Death Food Drops ARE Working — Verified
- **SEVERITY:** High (finding)
- **FILE:** `src/components/game/offline-engine.ts` lines 1222-1254
- **WHAT:** The offline death food drop chain:
  1. ✅ Deaths detected (line 1219)
  2. ✅ `computeDeathFoodDrop()` creates food orbs along body (line 1232)
  3. ✅ Foods pushed to `this.foods` (line 1252)
  4. ✅ Food burst particles spawned for visual effect (line 1236)
  5. ✅ Foods rendered by `drawFoodOrbs()` (line 2057-2064) using `orbSize` field
  
  The offline engine renders food directly from `this.foods[]` (not from a snapshot), so the chain is even simpler.
- **WHY:** Death food drops work in offline mode.
- **FIX:** No fix needed.

### E-H03: `SEGMENT_SPACING = 6` in game-config.ts Is Dead Code
- **SEVERITY:** High
- **FILE:** `src/lib/game-config.ts` line 189
- **WHAT:** `export const SEGMENT_SPACING = 6` is defined but never imported by any file. Both the online server and offline engine use `cfg.segmentSpacing` from `DEFAULT_SNAKE_CONFIG` which is `16`. The value `6` is a stale leftover.
- **WHY:** Confusing for developers. If someone imported `SEGMENT_SPACING` thinking it's the active value, they'd get wrong physics (segments 2.6× closer together than intended).
- **FIX:** Delete the `SEGMENT_SPACING` export from `game-config.ts`. Also audit for other unused constants: `INITIAL_BODY_LENGTH`, `BASE_SPEED`, `BOOST_SPEED`, `MAX_BODY_LENGTH`, `TURN_BASE` — these are all duplicated in `DEFAULT_SNAKE_CONFIG` and may or may not be imported elsewhere.

### E-H04: Segment Spacing Not Maintained During Movement
- **SEVERITY:** High
- **FILE:** `mini-services/game-server/game-state.ts` lines 542-549, `src/components/game/offline-engine.ts` lines 1326-1336
- **WHAT:** Both engines create the initial body with segments `segmentSpacing` (16) pixels apart. But during movement, `moveHead()` returns a new position that's `speed` (4.5-8px) pixels from the old head, then `points.unshift(newHead)` is called. This means consecutive points are only `speed` pixels apart, not `segmentSpacing` apart.
  
  The body gets trimmed to `calcBodyLength()` target, but the actual spacing between consecutive points varies from 4.5px (normal speed) to 8px (boost). This means:
  - A 20-segment snake at normal speed is only ~90px long (20 × 4.5), not 320px (20 × 16) as the spacing implies
  - The "gap navigation" design (collisionRadius 6 + spacing 16 = 4px passable gap) doesn't work
  - Collision detection checks `dist < headColR + segColR` for every segment, but segments are densely packed
- **WHY:** Snakes appear shorter and denser than intended. The gap navigation feature doesn't work.
- **FIX:** Either (a) implement the path-based system from snake-engine.ts which properly maintains spacing, or (b) use a fixed-step body where every Nth movement tick extends the body one segment.

### E-H05: online-game.tsx Is Dead Code — Should Be Deleted
- **SEVERITY:** High
- **FILE:** `src/components/game/online-game.tsx` (entire 676-line file)
- **WHAT:** This is a legacy online game component that:
  - Imports non-existent `DEFAULT_CONFIG`
  - Uses wrong `GameSnapshot` type from `game-types.ts`
  - Listens for wrong socket events (`joined`, `you_died` instead of `join_arena`, `death`)
  - Has its own primitive canvas renderer (no glow, no minimap, no skins, no proper food rendering)
  - References `snake.kills` which doesn't exist on the type
  
  The actual online game is played through `game-canvas.tsx` (3182 lines, professional renderer).
- **WHY:** Dead code that confuses anyone auditing the codebase. If imported by accident, it would cause compilation errors.
- **FIX:** Delete `src/components/game/online-game.tsx`.

### E-H06: Hardcoded Constants in game-config.ts Duplicate SnakeConfig
- **SEVERITY:** High
- **FILE:** `src/lib/game-config.ts` lines 185-206
- **WHAT:** These constants are defined but many are duplicates of `DEFAULT_SNAKE_CONFIG` values with DIFFERENT values:
  | Constant | game-config.ts | DEFAULT_SNAKE_CONFIG | Match? |
  |----------|---------------|---------------------|--------|
  | INITIAL_BODY_LENGTH | 20 | initialBodyLength: 20 | ✅ |
  | SEGMENT_SPACING | 6 | segmentSpacing: 16 | ❌ **MISMATCH** |
  | BASE_SPEED | 4.5 | baseSpeed: 4.5 | ✅ |
  | BOOST_SPEED | 8.0 | boostSpeed: 8.0 | ✅ |
  | MAX_BODY_LENGTH | 200 | maxSegments: 200 | ✅ |
  | BOOST_MIN_LENGTH | 8 | boostMinLength: 8 | ✅ |
  | BOOST_DROP_INTERVAL | 10 | boostDropInterval: 10 | ✅ |
  | TURN_BASE | 0.35 | turnBase: 0.35 | ✅ |
  
  The `SEGMENT_SPACING = 6` mismatch is the most dangerous. All other values match.
- **WHY:** If any file imports `SEGMENT_SPACING` instead of using the config system, it gets wrong physics.
- **FIX:** Delete all duplicated constants from `game-config.ts` that are now in `SnakeConfig`. Keep only constants that are NOT in SnakeConfig (TICK_MS, WORLD_SIZE, etc.).

### E-H07: Offline Engine Spatial Grid Doesn't Include Death-Dropped Food Until Next Tick
- **SEVERITY:** High
- **FILE:** `src/components/game/offline-engine.ts` lines 1197-1213, 1222-1254
- **WHAT:** The spatial grid is rebuilt at step 4 (line 1197), but death food drops are added at step 7 (line 1252). The new foods are NOT in the grid until the next tick. Between death and next tick, snakes can't eat the dropped food via grid queries.
  
  However, the offline `eatFood()` (called at step 5, BEFORE deaths) also directly iterates `this.foods[]`. And the grid is only used for collision detection, not food eating. So this is actually fine — the food is visible and will be eaten next tick.
- **WHY:** No player-visible impact.
- **FIX:** No fix needed.

---

## MEDIUM Findings

### E-M01: game-types.ts Is Entirely Dead Code
- **SEVERITY:** Medium
- **FILE:** `src/lib/game-types.ts` (entire 119-line file)
- **WHAT:** Defines `Point`, `Snake`, `Food`, `Particle`, `GameConfig`, `GameSnapshot`, `KillFeedEntry`, `PlayerInput`, `SNAKE_COLORS`, `BOT_NAMES` — all of which have equivalent or better versions elsewhere:
  - `GameSnapshot` → `types.ts` version is the real one
  - `Snake` → `game-state.ts` `SnakeBase` is the real one
  - `Food` → `game-state.ts` `Food` is the real one (has `orbSize`)
  - `BOT_NAMES` → duplicated in `game-config.ts`
  - `SNAKE_COLORS` → unused anywhere
  - `GameConfig` → replaced by `SnakeConfig` from snake-engine.ts
- **WHY:** Dead code that creates confusion about which types are authoritative.
- **FIX:** Delete `src/lib/game-types.ts`. Update `offline-game.tsx` to import from `types.ts` instead (if it's even used).

### E-M02: Offline Engine Defines Its Own Vec2, SnakeBase, BotSession, Food Types
- **SEVERITY:** Medium
- **FILE:** `src/components/game/offline-engine.ts` lines 72-168
- **WHAT:** The offline engine re-defines `Vec2`, `SnakeBase`, `BotSession`, `Food`, `Particle` interfaces locally instead of importing from shared types. These are similar but not identical to the server's versions (e.g., offline `Food` has no `isStarChip` field by default, offline `SnakeBase` has `collisionRadius` which the server's doesn't).
- **WHY:** Type drift between online and offline. A field added to one won't be added to the other.
- **FIX:** Extract shared interfaces into `types.ts` and import in both places.

### E-M03: Offline Engine Score Handling Differs From Server
- **SEVERITY:** Medium
- **FILE:** `src/components/game/offline-engine.ts` line 1231
- **WHAT:** Offline death food calculation: `const totalScore = this.cfg.initialSpawnScore + deadSnake.score` (line 1231). This ADDS `initialSpawnScore` (20) to `deadSnake.score`. But in the server, `snake.score` already INCLUDES the initial spawn score (set at spawn: `score: cfg.initialSpawnScore` on line 331 of game-state.ts). So the offline engine is DOUBLE-COUNTING the initial 20 points.
  
  Example: A snake that ate 30 food (score = 50 in server, 30 in offline) would drop:
  - Server: `dropScoreOrbsAtBody(room, points, 50, color)` → 50 points of food
  - Offline: `computeDeathFoodDrop(20 + 30, points, ...)` → 50 points of food ✅ same result
  
  Wait — let me re-check. In the offline engine, what's `snake.score`? Let me trace:
  - Line 700: `score: this.cfg.initialSpawnScore` — so `snake.score` starts at 20
  - When eating food (line 1466 area): `snake.score += f.value`
  - So `snake.score` in offline = initialSpawnScore + food eaten = 20 + food eaten
  - Line 1231: `totalScore = this.cfg.initialSpawnScore + deadSnake.score = 20 + (20 + foodEaten) = 40 + foodEaten`
  - Server: `snake.score` = 20 + foodEaten, `dropScoreOrbsAtBody(room, points, snake.score, color)` drops `20 + foodEaten`
  - **OFFLINE DROPS 20 EXTRA POINTS** on every death!
- **WHY:** Dead snakes in offline mode drop more food than they should, creating an economic advantage.
- **FIX:** Change line 1231 to: `const totalScore = deadSnake.score;` (remove the `+ this.cfg.initialSpawnScore`).

### E-M04: render-helpers.ts Imports MAP_BASE_RADIUS/MAP_BREATH_* From game-config.ts
- **SEVERITY:** Medium
- **FILE:** `src/components/game/render-helpers.ts` lines 20-25
- **WHAT:** Imports `MAP_BASE_RADIUS`, `MAP_BREATH_AMPLITUDE`, `MAP_BREATH_CYCLE_MS` from `@/lib/game-config`. These are rendering constants used for the offline engine's map boundary. Let me check if they exist...
- **WHY:** If these constants were removed during the config migration, the renderer would crash.
- **FIX:** Verify these constants still exist in `game-config.ts`. If not, add them back or use the SnakeConfig values.

### E-M05: Offline Boost Drop Uses Hardcoded Value 1 Instead of food.value
- **SEVERITY:** Medium
- **FILE:** `src/components/game/offline-engine.ts` line 1321
- **WHAT:** `snake.score = Math.max(0, snake.score - 1)` — always drops score by 1 when boosting. The server uses the same approach (line 534 of game-state.ts). Both are consistent. However, the food orb spawned from the tail (line 1186: `value: 1`) is always a small orb. The server (lines 462-475) also always spawns small orbs from boost. ✅ Consistent.
- **WHY:** No inconsistency, but it means boost drops are always 1-point small orbs, which are barely visible.
- **FIX:** Consider making boost drops scale with snake size (e.g., drop a medium orb for large snakes).

### E-M06: Food Array Grows Unbounded on Server
- **SEVERITY:** Medium
- **FILE:** `mini-services/game-server/game-state.ts` lines 1192-1201
- **WHAT:** `replenishFood()` filters out eaten food (value=0) then spawns up to 50 new food per tick. Death drops add potentially hundreds of food items. If deaths happen faster than food is eaten (e.g., multiple snakes die in the same tick), `room.foods` can grow well beyond `foodCountTarget` (1200).
  
  The guard of 50 new food per tick means it takes 24+ ticks (~800ms) to refill from 0 to 1200. But death drops bypass this limit entirely — they add directly without a cap.
- **WHY:** If many snakes die simultaneously (common in bot self-destruct cascades), the food array could grow to thousands of items, increasing snapshot size and bandwidth.
- **FIX:** Add a cap in `replenishFood()` or `dropScoreOrbsAtBody()` to limit total food count. If over cap, don't drop death food (or drop fewer).

### E-M07: No Star Chip Drops in Offline Mode
- **SEVERITY:** Medium
- **FILE:** `src/components/game/offline-engine.ts` (entire file)
- **WHAT:** The offline engine never creates star chips (`isStarChip: true`). The `Food` interface has an optional `isStarChip` field, but it's always set to `false` (lines 1188, 1635). Star chips are an online-only feature (carriedChips, extraction, economy). This is BY DESIGN (offline = practice, no economy). Noting for completeness.
- **WHY:** Intentional design decision.
- **FIX:** No fix needed. Document that star chips are online-only.

### E-M08: `calcDeathFood` in snake-engine.ts Returns Tuple, `computeDeathOrbs` in game-state.ts Returns Object
- **SEVERITY:** Medium
- **FILE:** `src/lib/snake-engine.ts` line 586 vs `mini-services/game-server/game-state.ts` line 385
- **WHAT:** Two functions that compute the same thing (death food mix) with different return types:
  - `calcDeathFood(score, isWallDeath)` → `[small, medium, large]` tuple
  - `computeDeathOrbs(totalScore)` → `{ small, medium, large }` object
  
  The offline engine uses `calcDeathFood`. The server uses `computeDeathOrbs`. Both produce the same values but with different interfaces.
- **WHY:** Code duplication with different APIs. If the formula changes, both need updating.
- **FIX:** Use `calcDeathFood` from snake-engine.ts in the server too, or vice versa.

---

## LOW Findings

### E-L01: `WORLD_SIZE = 8000` Used for Square World, But Game Uses Circular Map
- **SEVERITY:** Low
- **FILE:** `src/lib/game-config.ts` line 185, `mini-services/game-server/game-state.ts` line 1162
- **WHAT:** `WORLD_SIZE = 8000` implies an 8000×8000 square world, but the game uses a circular map with dynamic radius (3000-16000). The `WORLD_SIZE` is only used in the snapshot (`worldSize: WORLD_SIZE`) and for grid/viewport calculations. The actual playable area is circular, defined by `mapRadius`.
- **WHY:** Minor confusion. The `worldSize` field in snapshots is misleading — it's not the actual world boundary.
- **FIX:** Consider removing `worldSize` from snapshots or renaming it to clarify it's a viewport hint, not the actual boundary.

### E-L02: Bot AI Personality Not Exposed in SnakeSnapshot
- **SEVERITY:** Low
- **FILE:** `src/lib/types.ts` line 94, `mini-services/game-server/game-state.ts` line 1122
- **WHAT:** `SnakeSnapshot.botState` only shows `'harvesting' | 'selfDestruct'`. The full personality (`scavenger`, `opportunist`, `hunter`, `extractor`, `coward`) is not exposed to the client. This means the client can't render different bot behaviors visually (e.g., hunter bots could have red eyes).
- **WHY:** Minor missed feature — bots all look the same to the player regardless of personality.
- **FIX:** Add `botPersonality?: string` to `SnakeSnapshot` and include it in `buildSnapshot()`.

### E-L03: `SNAKE_COLORS` in game-types.ts Includes Indigo
- **SEVERITY:** Low
- **FILE:** `src/lib/game-types.ts` line 108
- **WHAT:** `SNAKE_COLORS` includes `'#6366f1'` (indigo-500). The project styling rules explicitly say "NO indigo or blue colors unless specified". However, this is for bot snake colors, not UI styling, so it may be acceptable.
- **WHY:** Very minor — just noting the color policy.
- **FIX:** No fix needed (game colors are different from UI colors).

### E-L04: `online-replay-player.tsx` Exists But Replay System Integration Is Unclear
- **SEVERITY:** Low
- **FILE:** `src/components/game/online-replay-player.tsx`
- **WHAT:** This file exists but it's unclear if it's integrated into the death screen flow. The `game-canvas.tsx` has replay frame recording (lines 334-370) and replay playback in the end screen, but it may use its own replay rendering rather than this component.
- **WHY:** Potential dead code if not wired in.
- **FIX:** Verify if this component is actually imported anywhere. If not, delete it.

---

## DEATH FOOD DROP VERDICT

The original bug report was "death food/star drops not appearing on snake death." After thorough audit:

### Online Mode: ✅ WORKING
The full chain is intact:
1. Death trigger → `dead.isDead = true` (index.ts:501)
2. `dropScoreOrbsAtBody()` adds food to `room.foods[]` (index.ts:518)
3. `dropStarsAtDeath()` adds stars to `room.foods[]` (index.ts:523)
4. `buildSnapshot()` includes ALL foods in `room.foods[]` (game-state.ts:1128)
5. `drawFood()` renders all foods including death drops (game-canvas.tsx:1441)
6. `death_food_drop` event sends particle effect data (index.ts:557)

### Offline Mode: ✅ WORKING
1. Death trigger → deaths array (offline-engine.ts:1219)
2. `computeDeathFoodDrop()` creates food orbs (offline-engine.ts:1232)
3. Food pushed to `this.foods[]` (offline-engine.ts:1252)
4. `drawFoodOrbs()` renders from `this.foods[]` (offline-engine.ts:2057)

### The REAL issues are different from what was reported:
- **E-M03**: Offline double-counts initial spawn score in death food (drops 20 extra)
- **E-H04**: Segment spacing not maintained during movement (gap navigation broken)
- **E-C04**: Path-based body system from snake-engine.ts is never used

---

## FILES TO DELETE (Dead Code)
1. `src/lib/game-types.ts` — duplicate types, replaced by `types.ts`
2. `src/components/game/online-game.tsx` — legacy online game, replaced by `game-canvas.tsx`

## FILES TO CLEAN UP
1. `src/lib/game-config.ts` — remove `SEGMENT_SPACING = 6` and other duplicated constants
2. `src/lib/snake-engine.ts` — remove `buildInitialPath`, `extendPath`, `sampleSegments` (or implement them)
3. `src/components/game/offline-engine.ts` — fix double-counting death score (line 1231)
