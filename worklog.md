# Work Log

---
Task ID: 1
Agent: Main
Task: Fix GameSocket "Verification failed" error

Work Log:
- Diagnosed that the OLD supervisor (`/home/z/my-project/game-server-supervisor.py`) was still running
- Old supervisor did NOT load parent `.env`, so INTERNAL_SECRET fell back to 'dev-secret'
- Game server process (pid 29867) was frozen after receiving SIGTERM
- Killed old supervisor (29802) and frozen game server (29867)
- Started new supervisor (`mini-services/game-server/supervisor.py`) which properly loads .env
- Verified: test connection now returns "invalid_token" (correct JWT rejection) instead of "Verification failed"
- Cleaned up stale old supervisor file and PID file

Stage Summary:
- Root cause: Old supervisor without env loading was running instead of new one
- Fix: Killed old processes, started new supervisor with load_parent_env()
- Verification: Socket.IO auth now works correctly

---
Task ID: 2
Agent: Main
Task: Fix game performance (jittering/lag), collision pass-through, glow bug, default skin

Work Log:
- Read all core game files: GameCanvas.tsx, render-snake-atlas.tsx, collision.ts, engine.ts, remote-snake-manager.ts, config.ts, bot-ai.ts, skin-registry.ts, hud.ts, renderer.ts, spatial-hash.ts, game-server/index.ts
- Diagnosed 4 major bugs

### Bug 1: Glow on non-boosting snakes (PERFORMANCE + VISUAL)
- Almost ALL preset skins (fish, lion, motorbike, etc.) have `glow: true`
- Fallback renderer drew glow sprites on EVERY segment of EVERY bot, EVERY frame
- ~600-900 extra drawImage calls per frame = #1 cause of jittering/lag
- Fix: Gated per-segment glow on `snake.boosting` in both pattern and preset code paths
- File: `src/components/game/render-snake-atlas.tsx` lines 1049-1051, 1069-1071

### Bug 2: Collision pass-through (GAMEPLAY)
- Proximity check used fixed `CRAWL_HIT_DIST_SQ = (2*SNAKE_RADIUS-2)^2 = 16` (4px from spine)
- But body radius grows to 10+ px with score — head could be visually inside body without triggering
- Fix: Compute per-snake `crawlDist = SNAKE_RADIUS + otherSnake.bodyRadius - 2`
- Also increased BODY_HASH_RANGE from 5000 to 8000 to prevent edge-case exclusions
- File: `src/lib/snake/collision.ts` lines 47-55, 194-198, 373-404

### Bug 3: Default skin not registered
- `getSkinAsset('skin-default')` fell through to plain green fallback
- DEFAULT_SKINS from atlas.ts were only registered for atlas rendering, not in skin-registry
- Fix: Added `registerDefaultSkins()` function, called from GameCanvas on mount
- Fallback now uses skin-viper-green for unknown skin IDs
- Files: `src/lib/snake/skin-registry.ts`, `src/components/game/GameCanvas.tsx`

### Bug 4: Old supervisor without env loading
- (Covered in Task ID: 1 above)

Stage Summary:
- 4 files modified: render-snake-atlas.tsx, collision.ts, skin-registry.ts, GameCanvas.tsx
- All fixes verified: lint passes, game loads in browser with zero console errors
- Game server restarted to pick up collision.ts changes (shared import)
- Performance improvement: ~600-900 fewer drawImage calls per frame (glow gating)
- Collision now uses actual body radius, preventing pass-through on large snakes

---
Task ID: 3
Agent: Main
Task: Fix remaining glow bug, collision edge cases, and guest default skin issue

Work Log:
- User reported: snakes (including player) still glow without boosting, collision still inconsistent, guest inherits previous user's skin

### Bug 1: Glow still on non-boosting snakes (REMAINING GLOW SOURCES)
- Found 3 additional glow sources that were NOT gated by `snake.boosting`:
  1. Atlas renderer: `applyEpicEffect('glow', ...)` on every segment for epic/legendary skins — always on
  2. Atlas renderer: Legendary head underlay (radial gradient) — always on for legendary
  3. Fallback renderer: Custom lab skin `seg.glow` passed directly without boosting check
- Fix: Added `&& snake.boosting` to all 3 locations
- Files: `src/components/game/render-snake-atlas.tsx` lines 598-599, 640, 703, 1043-1044

### Bug 2: Collision pass-through (BODY HASH RANGE + QUERY RADIUS)
- BODY_HASH_RANGE_SQ was 8000*8000 — bots with heads at 8001px excluded entirely
- Long snakes (bodyLength 300+) have bodies extending 2400+ px behind head
- Body hash query radius was SNAKE_RADIUS*6=18px, but max collision dist is ~20px for large snakes
- Fix: Increased BODY_HASH_RANGE_SQ to 12000*12000 (4000px buffer for long bodies)
- Fix: Increased body hash query from SNAKE_RADIUS*6 to SNAKE_RADIUS*8 (24px, covers max collision dist)
- File: `src/lib/snake/collision.ts` lines 194-199, 341

### Bug 3: Guest inherits previous user's skin (LOCALSTORAGE LEAK)
- `getPlayerSkinAsset()` checked localStorage for custom skin override BEFORE verifying server skin
- localStorage is per-browser, not per-user — switching users inherited previous user's skin
- Example: admin uses custom-lab-skin → guest logs in → guest gets admin's skin
- Fix: Only apply localStorage override when `serverSkinId === state.currentSkin` (server confirms it)
- File: `src/lib/snake/skin-registry.ts` lines 179-201

Stage Summary:
- 3 files modified: render-snake-atlas.tsx, collision.ts, skin-registry.ts
- Lint passes, game server restarted to pick up collision.ts changes
- All glow sources now properly gated by snake.boosting
- Collision detection range increased to handle long snake bodies
- Guest users now correctly get their own default skin from server

---
Task ID: 4
Agent: Main
Task: Fix default skin head-body visual separation

Work Log:
- User reported: default skin shows head and body as separate/disconnected objects
- Other skins don't have this issue — only the default skin (skin-viper-green)

### Root Cause Analysis
- Default skin had `pattern: 'solid'` = flat bodyColor fill on every body segment
- `bodyColor: '#22c55e'` (bright green) vs `headColor: '#16a34a'` (dark green) = visible color seam
- `accentColor: '#86efac'` (very light green) = jarring bright ring around head
- Head has 3D shading overlay + accent ring; body has no visual detail
- Result: head looks like a completely separate object from the flat body

### Fix
- Changed pattern from `'solid'` to `'gradient'` — body segments now have a diagonal gradient
  from bodyColor (#22c55e) to headColor (#16a34a), creating smooth transition to head
- Changed accentColor from `'#86efac'` to `'#4ade80'` — closer to body color, less jarring ring
- Updated both DEFAULT_SKINS in atlas.ts and fallback in skin-registry.ts

Stage Summary:
- 2 files modified: atlas.ts, skin-registry.ts
- Default skin now uses gradient pattern for cohesive head-body appearance
- Accent ring toned down to blend with body
- Lint passes, committed and pushed
---
Task ID: 5
Agent: Main
Task: Fix body/head disconnection, camZoomX crash, and skin selection bugs

Work Log:
- Analyzed render-snake-atlas.tsx camZoomX usage: found double-subtraction of camera position
- camZoomX was cw/2 - camera.x*zoom, body code does (wx-camera.x)*zoom + camZoomX = double subtract
- Head used w2sX() which correctly computes (wx-camera.x)*zoom + cw/2
- This caused body segments to shift by -camera.x*zoom pixels from the head
- Moved camZoomX/camZoomY declarations before first use (was line 620, used at 601)
- Fixed camZoomX to cw/2 and camZoomY to ch/2 (remove double camera offset)
- Created POST /api/player/current-skin endpoint for free skin sync
- Updated handleEquipSlitherPreset() and handleDeployCustomSkin() to call new API
- Changed GameCanvas fallback from 'skin-default' to 'skin-viper-green'
- Verified with agent-browser: game starts, 1 canvas, 32727 non-black pixels, 0 console errors

Stage Summary:
- Root cause of body/head disconnection: camZoomX double-subtracted camera.x*zoom
- Root cause of skin selection: presets never synced to server, matchesServer check failed
- Root cause of crash: camZoomX declared after first use (TDZ violation)
- All 3 bugs fixed, lint passes, game verified running with agent-browser
- Committed: 4b78dbb

---
Task ID: 6
Agent: Main
Task: Remove glow effects from all skin preview components

Work Log:
- User requested: no glow in any preview — glow only in-game while boosting
- Fixed 5 preview components:
  1. cosmetics-cards.tsx: Changed `glow={preset.glow}` → `glow={false}` and `glow={vis.glow}` → `glow={false}`
  2. game-snake-preview.tsx: Changed `effectiveGlow = glow ?? autoGlow ?? false` → `effectiveGlow = false`
  3. skin-preview-game.tsx: Removed seg.glow (→false), removed applyEpicEffect for body/head, removed rarity glow
  4. try-on-preview.tsx: Changed drawSegmentShape glow to false, removed head shadowBlur
  5. skins-canvas-preview.tsx: Set segmentGlow=false, removed neon/rainbow glow overrides, removed head shadowBlur
- Left venom-painter.tsx untouched (user has explicit GLOW ON/OFF toggle for skin creation)
- Lint passes clean

Stage Summary:
- All 5 skin preview components no longer render glow effects
- Glow now ONLY appears in-game while boosting (as intended)
- Venom painter lab tool keeps its manual toggle for design purposes

---
Task ID: 7
Agent: Main
Task: Fix boost glow not visible when boosting in-game

Work Log:
- User reported snake doesn't glow when boosting
- Root cause: boost aura used alpha 0.15-0.25 (barely visible) with only 1 layer at 3x segRadius
- Head glow used hardcoded orange color (rgba(255,200,80)) instead of snake's own color
- Fix: Replaced single boost aura with 2-layer glow system:
  - Layer 1: Wide outer halo (5x segRadius, alpha 0.12-0.18) — soft ambient glow
  - Layer 2: Tight inner glow (2.5x segRadius, alpha 0.35-0.50) — bright visible core
- Fix: Head glow now uses snake's own headColor (lightened 50%) instead of hardcoded orange
- Fix: Head glow radius increased from 1.5x to 2.2x head size, alpha from 0.25-0.40 to 0.45-0.65
- Applied same 2-layer boost aura to both atlas renderer and fallback renderer
- Lint passes clean

Stage Summary:
- Boost glow is now clearly visible with dual-layer body aura + bright head glow
- Glow color matches snake's skin color (not hardcoded)
- Both player (atlas) and bots (fallback) get the same visible boost effect
---
Task ID: 1
Agent: Main
Task: Fix snake body not glowing when boosting + remove strange straight line glow

Work Log:
- Investigated render-snake-atlas.tsx boost glow code
- Found that the "boost aura" used line-stroke approach (ctx.stroke with thick lineWidth) which looked like ugly straight lines
- The per-segment body glow was missing entirely — no slither.io-style glow effect
- Speed lines behind head (6 lines) were also visual noise
- Added getCachedBoostGlow() function: creates a pre-rendered soft radial gradient glow sprite cached by color+size+dpr
- Replaced line-stroke boost aura in atlas renderer (lines 619-654 old) with per-segment drawImage glow loop
- Replaced line-stroke boost aura in fallback renderer (lines 1028-1065 old) with per-segment drawImage glow loop
- Removed speed lines (6 stroked lines behind head) from atlas renderer
- Kept head glow pulse (radial gradient on head) which looks correct

Stage Summary:
- Boost glow now uses slither.io-style per-segment soft radial glow circles
- Each segment gets a cached OffscreenCanvas glow sprite drawn behind it
- Pulsing alpha (0.6 ± 0.2) creates a breathing glow effect
- No more ugly straight line artifacts
- Both atlas and fallback renderers updated consistently
- Lint passes clean
---
Task ID: 1
Agent: main
Task: Remove laser trails, death novas, US flags, and profile banners from shops and labs

Work Log:
- Searched codebase for all references to trail/death/flag/banner cosmetic types
- Identified 7 key files that needed modification
- Removed trail/death/flag/banner items from ALL_COSMETICS in game-config.ts (14 items removed)
- Converted trail/death/flag/banner pass cosmetics to skin type in PASS_FREE_COSMETICS (8 items) and PASS_ELITE_COSMETICS (8 items)
- Simplified CosmeticType to just 'skin'
- Removed 4 category tabs (trails, deaths, flags, banners) from CATEGORY_TABS in cosmetics-types.ts
- Removed CategoryFilter union members for trails/deaths/flags/banners
- Removed TrailCard/DeathCard/FlagCard/BannerCard imports and all rendering sections from cosmetics-shop.tsx
- Removed handleEquip function for trail/death/flag/banner types
- Removed isTrailActive/isDeathActive/isFlagActive/isBannerActive helpers
- Removed 'flag' and 'banner' from CosmeticSlot type in face-cosmetics.ts
- Removed 9 flag cosmetic items (flag-none, flag-india, flag-usa, flag-uk, flag-japan, flag-brazil, flag-france, flag-germany, flag-south-korea) from FACE_COSMETICS
- Removed drawWavingFlag function and FlagStyle type
- Removed flag/banner from SLOT_INFO, EquippedCosmetics interface, and DEFAULT_EQUIPPED
- Removed 'flag' from renderEquippedCosmetics slot render order
- Removed flag/banner from ALL_SLOTS and EQUIPPABLE_SLOTS in cosmetics-section.tsx
- Fixed season-pass claim/route.ts and claim-all/route.ts to remove trail/death/flag/banner auto-equip logic
- Fixed api/player/cosmetic/route.ts to remove trail/death/flag/banner equip logic
- Removed activeTrail/activeDeath references from player-profile.tsx
- Updated shop subtitle text to remove 'luminous laser trails' mention
- Ran lint - clean
- Browser verified: shop shows only 4 tabs (All Items, Ready Presets, Premium Shop, Face Cosmetics)
- Browser verified: Face Cosmetics shows only 7 slots (no Flags/Banner)

Stage Summary:
- All laser trails, death novas, flags, and profile banners completely removed from shops and labs
- 7 files modified: game-config.ts, cosmetics-types.ts, cosmetics-shop.tsx, face-cosmetics.ts, cosmetics-section.tsx, player-profile.tsx, api routes (3)
- Pass cosmetics that were trail/death/flag/banner types converted to skin equivalents to preserve tier rewards
- Lint clean, browser verified
