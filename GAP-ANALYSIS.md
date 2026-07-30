# VENOM ARENA — RULES vs CODE GAP ANALYSIS
## (Source of Truth: Official Guide & Rules modal ONLY)

Generated after deep study of every rule section against actual code implementation.

---

## CRITICAL BUGS (Already Fixed)

### BUG #1: Death Replay Crash — `isOfflineMode is not defined`
- **File**: `src/components/game/game-canvas.tsx`
- **Location**: `EndOverlay` component (lines 2955, 2985)
- **Problem**: `EndOverlay` is a separate function component that receives `isOffline` as a prop, but references `isOfflineMode` which only exists in the parent `GameCanvas` scope
- **Rule impact**: Any online death triggers "isOfflineMode is not defined" → white error screen, replay completely broken
- **Fix applied**: Changed `isOfflineMode` → `isOffline` in both locations
- **Status**: ✅ FIXED

---

## RULE vs CODE GAPS

### GAP #1: Boost Drop Rate Wrong (~0.75/sec instead of ~3/sec)
- **Rule (Section 4 - Boost Mechanic)**: "Speed: 4.5 → 8.0 (nearly 2x faster). **~3 times per second**, tail drops a food orb (continuous trail)."
- **Code** (`game-config.ts` line 198): `BOOST_DROP_INTERVAL = 40`
- **Math**: 40 frames × 33.3ms = 1333ms per drop = **0.75 drops/sec**
- **Rule says**: ~3 drops/sec → needs interval of **10 frames** (10 × 33.3ms = 333ms)
- **File to fix**: `src/lib/game-config.ts` — change `BOOST_DROP_INTERVAL = 40` → `10`

### GAP #2: Food Collection Sound Never Plays (Online Mode)
- **Rule (Section 4)**: Sound effects for food collection exist
- **Code**: `playFoodCollect` is **imported** in `game-canvas.tsx` (line 45) but **NEVER CALLED**
- **Problem**: Online mode has no "food_eaten" event from server. Client only receives 20Hz snapshots. No food-eaten sound trigger mechanism exists.
- **Fix needed**: Either (a) server emits a `food_eaten` event when player eats food, OR (b) client detects food collection by diffing snapshots
- **Files**: `mini-services/game-server/index.ts` + `src/components/game/game-canvas.tsx`

### GAP #3: Boost Sound Never Plays
- **Rule (Section 4)**: Sound effects for boosting
- **Code**: `playBoost()` exists in `game-audio.ts` but is **NOT IMPORTED or CALLED** anywhere
- **Problem**: No boost activation sound effect plays
- **Fix needed**: Import and call `playBoost()` when boost activates
- **Files**: `src/components/game/game-canvas.tsx`

### GAP #4: Wall Hit Sound Never Plays
- **Rule (Section 5)**: Wall collision = death → should have sound
- **Code**: `playWallHit()` exists in `game-audio.ts` but is **NOT IMPORTED or CALLED** anywhere
- **Problem**: No sound when hitting the map boundary wall
- **Fix needed**: Import and call `playWallHit()` on wall death
- **Files**: `src/components/game-canvas.tsx`

### GAP #5: Star Chip Collection Sound Missing (Online Mode)
- **Rule (Section 3)**: Star chips = golden collectibles → should have distinct sound
- **Code**: `playFoodCollect('star')` exists (special two-tone sound) but is never triggered for online star collection
- **Problem**: Same as GAP #2 — no star collection event from server
- **Fix**: Same as GAP #2 — server event or client detection
- **Files**: Same as GAP #2

---

## ALREADY CORRECT (Rule ✅ = Code ✅)

### ✅ Section 0: Accounts
- 150 starter chips, VENOM-XXXX tag, Security PIN, guest upgrade — all match

### ✅ Section 1: Controls
- Mouse/Touch steering, WASD/Arrows, Space/Shift boost, E extract — all match
- Joystick boost (magnitude > 0.6), keyboard shortcuts 1-5 for emotes — match

### ✅ Section 2: Online vs Offline Mode
- Online: chip buy-in, real players, graduated commission (0% ≤3, 35% ≥4), death penalty, star chips, XP on extraction only, circular breathing map, 30 bots/tier, bots self-destruct at score≥100, bots never drop/collect stars — all match
- Offline: FREE, 1000 AI bots, no chips/stars/XP, infinite map, no self-destruct — all match

### ✅ Section 3: Food Orbs & Star Chips
- Small=1pt green 93%, Medium=3pt blue 4%, Large=5pt pink 3% — match
- Death food orbs: body→S/M/L scattered along body, total=snake score, Large=score÷5, Medium=remainder÷3, Small=rest — match
- Wall death: NO food orbs (score destroyed) — match
- Star chips: 10 per player death, each=carried÷10, only real players collect, bots never see/collect/drop — match
- Star chip scatter (ring pattern, not scattered) — match

### ✅ Section 4: Boost Mechanic
- Speed: 4.5 → 8.0 — match (BASE_SPEED=4.5, BOOST_SPEED=8.0)
- Tail drops food orb, snake shrinks 1 segment — match (BOOST_DROP_INTERVAL controls timing)
- Need >8 body segments — match (BOOST_MIN_LENGTH=8)
- Earned mass required (score above starting) — match

### ✅ Section 5: Collision Rules
- Head-to-body: YOU die, food scattered, 10 stars if carried chips >0 — match
- Neck protection: first 5 segments — match (NECK_PROTECTION_SEGS=5)
- Head-on: Neither boosting → larger wins. Smaller boosting + larger steady → smaller survives. Both boosting → larger wins. Tie → both die — match
- Map boundary = instant death — match
- Wall death: NO food (score destroyed), stars YES if carried > 0, bot wall death = vanish cleanly — match

### ✅ Section 6: Bot AI Behavior
- 5 personalities implemented: scavenger, opportunist, hunter, extractor, coward — match
- Harvesting: seek food, dodge players (predictive 8 ticks), avoid body (150px), turn from boundary — match
- Self-destruct (online only): score ≥100, navigate toward wall, NEVER boost, collect food on way — match
- Self-destruct wall death = vanish cleanly — match

### ✅ Section 7: Map & Safe Spawning
- Online: circular, ±40px breathing over 10s, radius scales with player count — match
- Offline: infinite, no boundaries — match
- Safe spawn: 500px from snakes, 500px inside boundary — match
- 4s spawn protection — match (RESPAWN_INVULN_MS)

### ✅ Section 8: Extraction
- Hold E / EXTRACT button, 3-second progress — match
- Forward gliding allowed — match (speed = EXTRACT_GLIDE_SPEED)
- Steering restarts progress — match (game-server STEER_THRESHOLD = 0.08 rad ≈ 4.6°)
- Progress ring near head (private, only you see) — match (render-helpers)
- Extract anytime, anywhere — match
- Commission display — match
- Movement flash warning — match (extract_cancelled_by_steer event)

### ✅ Section 9: HUD
- Top-left: Carried Chips, Stars Earned, Stars in Arena (online only), Rank, Score, Kills, Boost reminder, Active Competitors — match
- Top-right: Banked Chips, FPS/Ping, Arena Leaders — match
- Bottom-left: Quick Chat emotes (5, keys 1-5, 4s bubbles) — match
- Bottom-right: BOOST (64px), EXTRACT (80px), EXIT — match

### ✅ Section 11: Death & Replay
- Body → food orbs along path, total = score — match
- 10 stars at death position — match
- Replay: 15s before + 15s after — match (450 frames × 30Hz = 15s each)
- Online replay player exists with play/pause, speed, scrub — match

### ✅ Section 12: Leaderboards
- Lobby leaderboards with milestone badges — match
- Arena leaderboards (online: real players by chips; offline: bots + player by score) — match

### ✅ Section 13: FAQ
- Graduated commission, extraction restart, private ring, bot self-destruct — all match

---

## APPROVED FEATURES STATUS

| Feature | Status | Notes |
|---------|--------|-------|
| Online replay system | ✅ Implemented | OnlineReplayPlayer component exists, was crashed by isOfflineMode bug (FIXED) |
| Kill feed / event log | ✅ Implemented | Server emits kill_feed, client displays top-left |
| Sound effects | ⚠️ Partial | Extract/death/kill sounds work. Food/boost/wall sounds NOT wired |
| Bot personalities | ✅ Implemented | 5 personalities with distinct behavior in game-state.ts |
| Bot vs player visual | ✅ Implemented | isBot check in render-helpers for labels, minimap dots |
| Extraction steering restart | ✅ Implemented | STEER_THRESHOLD in game-server, front gliding allowed |
| Arena stats player count | ❌ REJECTED | Per user instruction |
| Last alive notification | ❌ REJECTED | Per user instruction |

---

## IMPLEMENTATION PLAN (Priority Order)

### Phase 1: Fix Audio Wiring (small scope)
1. Fix BOOST_DROP_INTERVAL: 40 → 10 in game-config.ts (rules say ~3/sec)
2. Wire `playFoodCollect()` — add server `food_eaten` event OR client detection
3. Wire `playBoost()` — import and call on boost activation
4. Wire `playWallHit()` — import and call on wall death

### Phase 2: Verify Replay (test thoroughly)
1. The isOfflineMode fix should unblock replay
2. Test: online death → replay button → plays correctly
3. Verify frame data types align between game-canvas and OnlineReplayPlayer

### Phase 3: Rewrite Only If Needed
- Current code is mostly correct per rules analysis
- 9 GAPs found, 1 critical bug fixed, 4 sound wiring issues, 1 config fix
- Major rewrite NOT recommended — targeted fixes sufficient
