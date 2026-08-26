# Venom Arena — Complete Requirements Checklist
> Last updated: Session 6 (current)

## ✅ = Implemented & Verified | 🔧 = Implemented (needs testing) | ❌ = Not Done | ⚠️ = Partially Done

---

## 1. CORE GAME MECHANICS

### 1.1 Snake Movement
- [x] Server-authoritative movement (client sends angle + wantsBoost only)
- [x] BASE_SPEED = 4.5 (normal speed)
- [x] BOOST_SPEED = 8.0 (boost speed)
- [x] EXTRACT_GLIDE_SPEED = 3.2 (extraction speed)
- [x] Turn rate: TURN_BASE(0.35) - score * TURN_SCORE_FACTOR(0.0003), min TURN_MIN(0.08)
- [x] Bigger snakes turn slower (score affects turn rate)
- [x] Segment spacing = 6px

### 1.2 Score & Body System
- [x] INITIAL_SPAWN_SCORE = 20 (starting score)
- [x] INITIAL_BODY_LENGTH = 20 (base body segments at spawn)
- [x] Body length = INITIAL_BODY_LENGTH + (score - INITIAL_SPAWN_SCORE)
- [x] MAX_BODY_LENGTH = 200 (body cap)
- [x] Size formula: SIZE_BASE(8) + sqrt(score) * SIZE_SCORE_FACTOR(0.4)
- [x] Score increases by eating food orbs (+1, +3, or +5 per orb)

### 1.3 Food Orbs
- [x] Three sizes: Small(1pt, 3px), Medium(3pt, 5px), Large(5pt, 8px)
- [x] Spawn weights: Small=60%, Medium=30%, Large=10%
- [x] Food count target maintained per arena
- [x] Visual rendering with glow effects per size

### 1.4 Star Collectibles
- [x] Always exactly 10 stars dropped per real player death (STAR_DROP_COUNT=10)
- [x] Each star value = floor(carriedChips / 10), remainder to last star
- [x] 5-pointed golden glow star visual
- [x] ONLY real players drop stars; bots NEVER drop stars
- [x] Bots NEVER collect star chips (ignored in bot AI)

### 1.5 Death Food Drop
- [x] Food orbs spread evenly along the ENTIRE body path (not one spot)
- [x] S/M/L distribution: greedily pick Large(5) first, then Medium(3), then Small(1)
- [x] Sum of all food orbs = snake's total score (exact match)
- [x] Scatter = 15-20px around each body segment position
- [x] Map death: 0 food orbs dropped (score destroyed)
- [x] Bot selfDestruct WALL death: 0 food, 0 stars (vanish cleanly)
- [x] Bot selfDestruct COLLISION death: STILL drops food

### 1.6 Boost Mechanic
- [x] Activation: Hold Space / Left-click / Boost button
- [x] BOOST_MIN_LENGTH = 8 (need >8 segments to boost)
- [x] BOOST_DROP_INTERVAL = 40 frames (~2s at 20Hz)
- [x] Drops 1 tail segment as small food orb per interval
- [x] Snake shrinks: score -= 1 per drop
- [x] Both online and offline modes implement boost food drops
- [x] Boost is purely cosmetic/speed — does NOT affect collision outcome directly

---

## 2. COLLISION SYSTEM

### 2.1 Head-to-Body Collision
- [x] Snake head hits foreign body segment → head owner dies
- [x] Neck protection: First 5 segments (NECK_PROTECTION_SEGS=5) cannot kill
- [x] Collision detection uses spatial hash grid for performance
- [x] Hit factor: COLLISION_HIT_FACTOR applied to sum of sizes

### 2.2 Head-on (Head-to-Head) Collision
- [x] 3 rules:
  - (A) Neither boosting → larger score survives
  - (B) Smaller boosting vs larger steady → smaller survives
  - (C) Both boosting → larger score survives
- [x] Tie → both die
- [x] HEAD_ON_HIT_FACTOR applied to sum of sizes

### 2.3 Wall/Map Collision
- [x] Online: Circular boundary — going outside radius = death
- [x] Offline: NO wall death (infinite map, no boundaries)
- [x] Map boundary has breathing oscillation (±40px over 10s cycle)

---

## 3. BOT AI

### 3.1 Bot Personalities (Online)
- [x] Scavenger, Opportunist, Hunter, Extractor, Coward
- [x] All bots seek food and evade human players
- [x] Body segment collision avoidance (150px range)
- [x] Predictive evasion: project player 8 ticks ahead, steer perpendicular
- [x] Edge avoidance: if near boundary (300px), turn toward center

### 3.2 Self-Destruct (Online Only)
- [x] Triggered at score >= 100 (BOT_SELF_DESTRUCT_THRESHOLD)
- [x] Navigate AWAY from center (toward wall) — SLOWLY
- [x] NEVER boost during self-destruct
- [x] Still collect food on the way (20% food seeking + 80% wall seeking)
- [x] Wall death = vanish cleanly (0 food, 0 stars)
- [x] Collision death = still drops food

### 3.3 Bot Restrictions
- [x] Bots never boost (wantsBoost always false)
- [x] Bots never collect star chips
- [x] Bots drop 0 stars on death
- [x] Bots have no chips (carriedChips = 0)

### 3.4 Offline Bots
- [x] Always exactly 1000 bots in offline mode
- [x] Varied body sizes: random initial score (0-80), random body length (+0 to +30)
- [x] Rendering culling: only render bots within 1500px of camera
- [x] No self-destruct behavior in offline mode
- [x] No chips, no stars, no XP in offline mode

---

## 4. MAP SYSTEM

### 4.1 Online Map
- [x] Circular boundary with breathing (radius oscillates ±40px, 10s cycle)
- [x] Dynamic sizing: sqrt(realPlayerCount) scaling
- [x] MAP_MIN_RADIUS = 3000 (1 player)
- [x] MAP_MAX_RADIUS = 16000 (1000 players)
- [x] Map boundary rendered as neon circle
- [x] Safe spawn at least 500px inside boundary

### 4.2 Offline Map
- [x] Infinite map (no boundaries, no wall death)
- [x] No map boundary rendering

---

## 5. SPAWN SYSTEM

### 5.1 Safe Spawning
- [x] Distance-based check from ALL snake heads (SAFE_SPAWN_MIN_DIST = 500px)
- [x] At least 500px inside map boundary (online)
- [x] SAFE_SPAWN_ATTEMPTS = 30 (max attempts before fallback)
- [x] Fallback to random point if no safe spot found
- [x] Spawn protection: 4 seconds invulnerability (RESPAWN_INVULN_MS = 4000)

### 5.2 Bot Displacement (Online)
- [x] When human joins, one harvesting bot is forced into selfDestruct
- [x] Makes room for new player without exceeding MAX_ARENA_PLAYERS

---

## 6. DEATH REPLAY SYSTEM

### 6.1 Recording
- [x] Pre-death: 300-frame circular buffer (15s at 20Hz)
- [x] Post-death: 300-frame linear buffer (15s at 20Hz)
- [x] No pre-spawn frames (recording starts only after player snake appears)
- [x] Death frame index tracked for progress bar marker

### 6.2 Camera Behavior
- [x] Pre-death: follows player's snake head
- [x] At death: camera centers on body midpoint (where food drops)
- [x] Post-death: stays at death food position initially
- [x] Tracks first entity (bot/player) collecting death food
- [x] Switches to follow that entity's head (spectator mode)
- [x] If no one collects food, slow zoom out at death position

### 6.3 UI
- [x] Play/pause button
- [x] Speed cycle: 0.25x, 0.5x, 1x, 2x
- [x] Zoom in/out
- [x] Restart button
- [x] Progress bar with death marker (yellow line)
- [x] Frame counter + time display (pre-death countdown / post-death count-up)
- [x] "REPLAY" watermark
- [x] Death indicator text after death frame

### 6.4 Server Side
- [x] Death event emitted BEFORE match_result
- [x] Player kept in room for 16s after death (for post-death snapshot delivery)
- [x] Snapshots continue broadcasting during post-death window

---

## 7. ONLINE vs OFFLINE DIFFERENCES

| Feature | Online | Offline |
|---------|--------|---------|
| Chips | Buy-in + carry + extract | None (0) |
| Stars | Drop on player death | Not present |
| XP | Earned on extract | 0 |
| Commission | 0% if ≤3 real players, 35% if ≥4 | N/A |
| Map | Circular boundary, dynamic radius | Infinite, no walls |
| Leaderboard | By carried chips (top 10 real players) | By score (top 10 all snakes) |
| Bot Self-Destruct | Yes (score≥100, online only) | No |
| Bot Count | Per arena tier (25-60) | Always 1000 |
| Death Penalty | Lose all carried chips | None (practice) |
| Food on death | Spread along body + stars | Spread along body only |
| Wall death | Yes (map boundary) | No (infinite map) |

---

## 8. EXTRACTION SYSTEM

- [x] Hold E key or Extract button to start extraction
- [x] 3-second channel (EXTRACT_DURATION_MS = 3000)
- [x] Steering interrupts extraction (cancel on turn)
- [x] NO minimum extraction threshold (extract anytime)
- [x] NO extraction zone restriction (extract anywhere)
- [x] Graduated commission: 0% if ≤3 real players, 35% if ≥4
- [x] Extracted chips = carriedChips - commission

---

## 9. HUD / UI ELEMENTS

### 9.1 In-Game HUD
- [x] Kill counter
- [x] Rank (#X of Y real players)
- [x] Commission rate display
- [x] Real player count
- [x] Carried chips counter
- [x] Score (body length)
- [x] Mini-map
- [x] Arena leaderboard (top 10)
- [x] Boost button (mobile)
- [x] Extract button with progress bar

### 9.2 Death Screen
- [x] Kill/death info
- [x] Killer name and tag
- [x] Duration played
- [x] Score at death
- [x] Carried chips lost
- [x] "Watch Death Replay" button
- [x] Social buttons (View Profile, Add Friend, Add Rival) — only for real player killers
- [x] XP gained display (online extract only)

### 9.3 Post-Game
- [x] Match result with chips banked
- [x] Level up notification
- [x] Return to lobby button

---

## 10. ARENA TIERS

| Tier | Name | Buy-In | Bots | Reward Mult | Difficulty |
|------|------|--------|------|-------------|------------|
| 1 | Slum Alley | 10 | 25 | 1.0x | Beginner |
| 2 | Neon Grid | 100 | 30 | 1.5x | Medium |
| 3 | Viper Syndicate | 500 | 40 | 2.0x | High Stakes |
| 4 | Crimson Pit | 1,000 | 50 | 2.5x | Extreme |
| 5 | Void Serpent | 5,000 | 60 | 3.0x | Legendary |
| 6 | Venom Royale | 25,000 | 60 | 4.0x | Mythic |
| 7 | Apocalypse | 100,000 | 60 | 5.0x | Apocalypse |
| Practice | Offline | 0 | 1000 | 0x | Free |

---

## 11. SOCIAL FEATURES

- [x] Global search by name or tag
- [x] Friend system (request, accept, remove)
- [x] Daily gifting (+25 chips per friend)
- [x] Rival system (add rival from death screen)
- [x] Clan system (create, join, leave)
- [x] Player profile inspection
- [x] Country flags display

---

## 12. ADMIN FEATURES

- [x] Player banning
- [x] Chip modification
- [x] Banlist management

---

## 13. COSMETICS

- [x] Skins (unlockable, equipable)
- [x] Trails (visual effect behind snake)
- [x] Death effects (visual on death)
- [x] Flags (country flag display)
- [x] Banners (profile banner)
- [x] Chip store (purchase chip packs)

---

## 14. PROGRESSION

- [x] XP system (online extract only)
- [x] Level system
- [x] Daily rewards (streak system)
- [x] Season pass

---

## 15. INFRASTRUCTURE

- [x] Next.js 16 + App Router (port 3000)
- [x] Socket.IO game server (Bun mini-service, port 3001)
- [x] Prisma ORM with SQLite
- [x] Spatial hash grid for collision detection
- [x] Caddy gateway for port forwarding
- [x] JWT authentication
- [x] Server-authoritative game state
- [x] Dynamic map scaling
- [x] 20Hz broadcast rate (online)
- [x] 30Hz physics tick (offline)

---

## 16. RULES & GUIDE PAGE

- [x] Comprehensive rules modal with all mechanics documented
- [x] Sections: Controls, Online vs Offline, Food/Stars, Extraction, Collision, Boost, Bot AI, Map, FAQ
- [x] Accurate graduated commission info
- [x] No outdated information (min extraction, extraction zone, etc.)

---

## NOTES

- Items marked ✅ have been implemented and code-reviewed
- Items marked 🔧 need browser verification
- This checklist is the single source of truth for all game requirements
- Update this file whenever new features are added or changed
