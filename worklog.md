# Venom Arena — Worklog

---
Task ID: 1
Agent: main
Task: Fix bug in match/result/route.ts — undefined `commission` variable

Work Log:
- Identified that line 88 of `/api/match/result/route.ts` referenced `commission` which was not defined in scope
- The game server computes commission and passes `bankedAmount` (already post-commission) to the route
- Fixed by deriving commission as `carriedChips - bankedAmount` for extract outcomes, 0 for death

Stage Summary:
- Fixed critical runtime bug that would crash every match result API call
- File: `src/app/api/match/result/route.ts` line 88-89

---
Task ID: 2
Agent: main
Task: Update game-canvas.tsx rendering pipeline

Work Log:
- Added imports for `drawChipLabel`, `drawMapBoundary`, `drawSnakeWithLayering`, `drawStarCollectible`, `drawFoodOrb`
- Replaced `drawSnake` with `drawSnakeWithLayering` for all non-player snakes (opacity layering: larger snake fades to 75% when smaller passes underneath)
- Added dynamic map boundary rendering using `snap.mapRadius` from server
- Added chip label rendering over real player heads (NOT bots)
- Updated minimap and full map to use dynamic mapRadius from GameSnapshot
- Added `Play`, `Pause`, `ZoomIn`, `ZoomOut` to lucide-react imports

Stage Summary:
- Rendering pipeline now uses opacity layering, dynamic map boundaries, and chip labels
- Files: `src/components/game/game-canvas.tsx` (imports + rendering loop + minimap + fullmap)

---
Task ID: 3
Agent: main
Task: Implement replay death screen system

Work Log:
- Added circular replay buffer (600 frames = 30s at 20Hz) using refs
- Added `recordReplayFrame` and `getReplayFrames` helpers
- Recording happens in the snapshot handler during playing phase
- Extended `EndScreenState` with `replayFrames` and `replayMyId`
- Created `ReplayPlayer` component with canvas-based replay rendering
- Added playback controls: play/pause, restart, speed cycle (0.25x/0.5x/1x/2x), zoom in/out
- Added "Watch Death Replay" button in death end screen
- Replay buffer cleared on arena reset

Stage Summary:
- Full client-side replay system for death screen
- Files: `src/components/game/game-canvas.tsx` (replay buffer refs + recording logic + ReplayPlayer component + EndOverlay integration)

---
Task ID: 4
Agent: main
Task: Verify HUD elements and offline-engine.ts

Work Log:
- Verified HUD already has: kill counter, rank display (#X of Y players), commission rate, real player count
- Verified offline-engine.ts: no boundaries, no chips/stars, leaderboard by score only, no XP, no bot self-destruct, head-on collision rules correct
- Ran ESLint — passes with no errors
- Started game server (port 3001) and verified both servers running
- Browser tested: page loads, guest login works, lobby renders correctly, no console errors

Stage Summary:
- All HUD requirements already implemented in prior sessions
- Offline engine verified correct for all spec requirements
- Lint clean, both servers running, browser verified
---
Task ID: 1-7
Agent: Main Agent
Task: Fix ALL gameplay overhaul changes per user spec — arena selector, HUD, minExtract, commission, bot AI bugs, arena-stats API

Work Log:
- Read all 8 target files (game-config.ts, types.ts, game-state.ts, index.ts, render-helpers.ts, game-canvas.tsx, offline-engine.ts, match/result/route.ts)
- Launched 3 parallel verification agents (game-state.ts, render-helpers.ts, offline-engine.ts) to audit existing implementations
- ALL backend game logic confirmed correct: food drops, star drops, head-on collision, bot evasion, selfDestruct, dynamic map, opacity layering, infinite offline map
- Fixed arena-selector.tsx: "0 / 500" → "0 / 1,000", minExtract target → "EXIT ANYTIME", commission description → graduated system
- Fixed game-canvas.tsx: removed carriedBelowMin gate, dynamic commission from server result, removed hardcoded EXTRACT_COMMISSION
- Fixed game-state.ts: bot evasion future-position bug (was using wrong player ref), star count guarantee (always 10 even with low chips)
- Created /api/arena-stats/route.ts for arena player count data
- Removed conflicting HTTP stats handler from game-server (was crashing Socket.IO)
- Restarted both servers, verified via agent-browser

Stage Summary:
- Arena selector now shows "0 / 1,000" for all arenas (was "0 / 500")
- Extraction available at any time (no minExtract gate)
- Graduated commission (0% ≤3 players, 35% ≥4) displayed correctly
- Bot evasion bug fixed (future position now uses correct nearest player)
- Star drops always spawn exactly 10 (fixed value=0 skip)
- Online game confirmed working: connections, kills, deaths, match results
- Offline game confirmed working: score-only leaderboard, no chips, infinite map
- All rendering (food orbs, stars, opacity, boundaries) verified correct
---
Task ID: 1
Agent: Main Agent
Task: Fix all reported gameplay bugs - bot self-destruct, collision system, boost food drops, safe spawning, death replay, social buttons

Work Log:
- Read all 8 key project files to understand existing implementation
- Discovered that most Phase 1-8 changes from previous session WERE actually implemented (MAX_ARENA=1000, types, food system, etc.)
- Identified 6 specific bugs from user's latest feedback that needed fixing

Changes Made:

1. **game-config.ts**: Added NECK_PROTECTION_SEGS=5, SAFE_SPAWN_MIN_DIST=300, SAFE_SPAWN_ATTEMPTS=20

2. **game-state.ts** (online server):
   - Bot self-destruct: Changed `wantsBoost=true` → `wantsBoost=false`, bots now go SLOWLY toward wall while collecting food
   - Neck protection: Added `if (item.segIdx <= NECK_PROTECTION_SEGS) continue;` in detectCollisions
   - Boost food drop: Modified tickSnakeMovement to return Vec2[] of dropped tail positions
   - Safe spawning: Added findSafeSpawnPoint() that checks distance from ALL snakes
   - spawnBot now uses findSafeSpawnPoint instead of randomSpawnPoint

3. **index.ts** (online socket server):
   - Updated imports to include findSafeSpawnPoint, FOOD_ORB_SMALL, NECK_PROTECTION_SEGS
   - Player spawn uses findSafeSpawnPoint
   - Boost food drops: tick loop now creates small food orbs at dropped tail positions
   - Bot food drop fix: Removed isBotSelfDestruct guard from collision death path - ALL snakes drop food on collision, only wall-death selfDestruct bots vanish cleanly
   - Added killerIsBot to death event payload

4. **game-canvas.tsx** (client):
   - Post-death replay: Added postDeathRecordRef (100 frames = 5s), continues recording after death
   - setTimeout fallback updates endScreen replay frames after 5.5s
   - View Profile button: Added onViewProfile prop to EndOverlay
   - Social buttons (View Profile, Add Rival, Add Friend) only shown for real players (killer.isBot === false)
   - Added User icon import from lucide-react
   - killerTag now available in killer info from server

5. **offline-engine.ts** (subagent):
   - Neck protection: Added segIdx <= 5 skip in detectCollisions
   - Boost food drop: Added boostDropQueue, tail positions recorded before pop, processed in tick loop
   - Safe bot spawning: 20-attempt retry loop checking distance from player AND all other bots

Stage Summary:
- All 6 user-reported bugs fixed: bot boost behavior, collision neck protection, boost food drops, safe spawning, death replay extension, social buttons
- ESLint passes clean
- Both servers running (port 3000 + 3001)
- Browser verification: page loads correctly with no JS errors

---
Task ID: 3
Agent: main
Task: Fix offline mode 1000 bots, add death replay to both online and offline modes

Work Log:
- Fixed offline-engine.ts: Changed bot count from `Math.min(1000, this.arena.botsCount)` to `1000` (line 638) and respawn target from `this.arena.botsCount` to `1000` (line 1046)
- Fixed online replay in game-canvas.tsx: Changed from 30s circular buffer + 5s post-death to 15s pre-death circular (300 frames at 20Hz) + 15s post-death linear (300 frames at 20Hz). Added deathFrameIdx tracking passed through EndOverlay → ReplayPlayer. Added death marker on progress bar and countdown/death indicator in replay overlay
- Added full death replay system to offline-engine.ts via subagent: ReplayFrame interfaces, circular pre-death buffer (450 frames at 30Hz), linear post-death buffer (450 frames at 30Hz), post-death simulation continuation (bots keep moving/collecting food), replay viewer with canvas rendering, play/pause/speed/zoom controls, progress bar with death marker, frame counter

Stage Summary:
- offline-engine.ts: 2434 → 3033 lines (+600 lines). Bot count always 1000. Death replay records 15s before + 15s after death
- game-canvas.tsx: 2780 → 2820 lines. Online replay now 15s pre + 15s post with death marker
- All changes pass ESLint with zero errors
- Dev server compiles cleanly, no browser errors

---
Task ID: 4
Agent: main + 2 subagents
Task: Fix 8 issues: bot density, online replay, map size, food spread, boost, safe spawn, turn radius, bot dodge

Work Log:
- Increased BOT_SPAWN_RADIUS from 2000 to 6000 for wider bot distribution
- Bots now spawn with random initial scores (0-80) and varied body lengths for visual variety
- ALL bot personalities now dodge body segments (shouldFlee threshold 150px)
- Added bot-to-bot predictive evasion (200px scan, 8-tick prediction)
- BOT_THREAT_SCAN_RADIUS increased from 200 to 250
- Fixed computeDeathFoodDrop to spread food ALONG the body (not at death point)
- Added computeDeathOrbs helper function for proper S/M/L distribution
- BOT_EVADE_RADIUS increased from 250 to 300
- SAFE_SPAWN_MIN_DIST increased from 300 to 500, SAFE_SPAWN_ATTEMPTS from 20 to 30
- TURN_BASE increased from 0.15 to 0.28, TURN_MIN from 0.045 to 0.06, TURN_SCORE_FACTOR from 0.0006 to 0.0004
- Fixed online replay: death event now emitted BEFORE match_result, delayed room player removal (16s timeout)
- MAP_MAX_RADIUS confirmed at 8000 for 1000-player support
- Boost mechanism verified working (boostDropQueue + tickSnakeMovement)

Stage Summary:
- offline-engine.ts: Bot density fixed (6000 radius), food spread along body, all bots dodge, tighter turns
- game-canvas.tsx: Safe timeout for replay update
- game-config.ts: Turn rates improved, safe spawn distances increased, evade radius increased
- index.ts (game server): Death emitted first, 16s delayed room removal for post-death snapshots
- All changes pass ESLint with zero errors
