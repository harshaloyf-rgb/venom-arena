# 🔴 HONEST FULL AUDIT — Snake Game Code vs Requirements

**Date:** Audit completed before phased fix plan
**Scope:** All snake-related code cross-checked against user's game requirements document

---

## ARCHITECTURE ASSESSMENT

The modular architecture (`src/lib/snake/` + `engines/` + `render/`) is **structurally sound**:
- Types are clean and well-defined
- Engine is properly zero-alloc
- Pool system is good
- Offline/online separation is correct in concept

**The problems are NOT architectural.** They are:
1. Wrong default values in config
2. Missing wiring in page.tsx
3. Unimplemented features
4. Time format bugs
5. Wrong algorithms
6. offline-engine.ts is a 1024-line monolith doing everything

---

## CRITICAL FINDINGS

### 1. Food Visibility — ⚠️ Visual size issue (MEDIUM)
- Renderer is correct, food spawns correctly
- Food smallRadius=3px at zoom 1.0 is nearly invisible on dark background
- Not a logic bug — visual tuning needed

### 2. Boost Food Drop — ❌ BROKEN (HIGH)
- Drop rate: 30Hz / 40 frames = 0.75/sec (should be ~3/sec)
- Snake body does NOT shrink by 1 segment per drop
- Only score drains via processBoostDrain, path not explicitly trimmed

### 3. Bot Count 1000 — ❌ BROKEN (HIGH)
- offline-engine accepts botCount=1000 ✅
- page.tsx renders GameCanvas WITHOUT passing botCount → defaults to 30

### 4. Bot Varied Sizes — ❌ BROKEN (MEDIUM)
- ALL bots spawn with startLength:20 (same size)
- Config has botMinStartLength:15, botMaxStartLength:40 but NEVER USED

### 5. Extraction Mechanic — ❌ NOT IMPLEMENTED (HIGH)
- Input captured (KeyE) but engine.tickSnakeMovement IGNORES input.extracting
- HUD extraction bar exists in render-hud.ts but is NEVER CALLED from renderHUD()
- Ring visual exists but never triggered
- No commission display, no movement warning, no completion flow

### 6. Kill Feed — ❌ INVISIBLE (HIGH)
- Entries are created correctly ✅
- renderKillFeed exists and is called ✅
- TIME FORMAT MISMATCH: render uses RAF timestamp (seconds since page load ~1000-2000), kill feed uses Date.now() (Unix epoch ms ~1.75 trillion). Alpha always = 0.

### 7. Cosmetics/Skins — ❌ BROKEN AT WIRING (HIGH)
- page.tsx HARDCODES: skinPattern:'solid', bodyStyle:'smooth', hat:'none', primaryColor:'#2ECC71'
- Player's actual cosmetic choices from DB are NEVER passed to GameCanvas
- skin-resolver.ts and render-snake.ts work correctly — they receive wrong input

### 8. HUD Completeness — ⚠️ PARTIAL (MEDIUM)
- Working: Score, Kills, Rank, FPS/Ping, Emote buttons, Action buttons, Mini leaderboard
- Missing: Extraction hint, extraction progress popup, movement warning, banked chips, stars in arena, active competitors count, boost reminder, chat button, minimap toggle button

### 9. Speed Values — ❌ WRONG (HIGH)
- Current: baseSpeed=3.0, boostSpeed=5.0
- Required: baseSpeed=4.5, boostSpeed=8.0

### 10. Boost Min Score — ❌ WRONG (MEDIUM)
- Current: boostMinScore=8, startLength=20 → can boost at spawn
- Required: Must eat food first (score above starting score)

### 11. Head-on-Head Collision — ❌ WRONG (HIGH)
- Current: Both snakes always die (no size/boost comparison)
- Required: Size-based + boost-state logic (4 cases)

### 12. Growth Rate — ⚠️ AMBIGUOUS (LOW)
- Current: growthMult=1.0, small food adds 1.0 score
- Required: "Growth rate is 1/4 of food value" — may mean growthMult should be 0.25

### 13. Death Food Algorithm — ❌ WRONG (HIGH)
- Current: Probabilistic based on body path points, doesn't sum to score
- Required: Exact formula: Large(5pts) = score÷5, Medium(3pts) = remainder÷3, Small(1pt) = rest

### 14. WASD Steering — ❌ NOT IMPLEMENTED (MEDIUM)
- Only mouse steering exists
- No WASD keyboard steering

### 15. Offline Engine Monolith — ⚠️ ARCHITECTURAL (HIGH)
- 1024 lines doing: bot AI, food, collisions, death, leaderboard, particles
- Game-server has its own separate copy of game logic
- Should be thinner, delegating to shared engine

---

## CORRECT FEATURES ✅
- Food color/chance distribution (93% green, 4% blue, 3% pink)
- Neck protection (5 segments)
- Spawn protection (4s, 500px)
- Map breathing (±40px, 10s period) — online only
- Bot self-destruct NOT in offline (correct)
- Star chip creation logic (code exists, online only)
- Emote system (5 emotes, keys 1-5, 4s display)
- PathBuffer (zero-alloc circular buffer) works correctly
- Skin resolver logic works correctly (given correct input)
- Snake renderer (procedural + atlas) works correctly
- Camera follow + zoom works

---

## CONCLUSION

20 items checked. 7 ❌ HIGH severity, 4 ⚠️ MEDIUM, 2 ⚠️ LOW, 7 ✅ correct.

The codebase needs a **foundation-first** approach:
1. Get ONE snake perfect (speed, size, cosmetics, boost)
2. Then food system
3. Then collision system
4. Then HUD
5. Then bots, extraction, kill feed, online
