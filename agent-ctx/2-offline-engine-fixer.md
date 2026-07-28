# Task 2: Fix offline-engine.ts for 1000 bots

## Changes Made

### 1. Fixed 1000 Bot Count (CRITICAL)
- **Line 718**: Changed `const botCount = Math.min(1000, this.arena.botsCount)` → `const botCount = 1000`
- **Line 1153**: Changed `while (this.bots.size < this.arena.botsCount)` → `while (this.bots.size < 1000)`
- **Line 1612**: Already correct

### 2. Added Rendering Culling (CRITICAL)
- **drawAllSnakes()**: Added VIEW_RADIUS=1500 distance check before processing/rendering snakes
- Reduces opacity computation from O(1000²) to O(~visible_count²)

### 3. Simplified Safe Spawning
- Removed expensive bot-to-bot distance check (O(N²) per spawn attempt)
- Now only checks distance from player (>500px), accepts bot-to-bot proximity

### 4. Verified Boost ✅, Food Drops ✅, Neck Protection ✅, Turn Radius ✅
- All verified working correctly with game-config imports

## Lint: Zero errors
