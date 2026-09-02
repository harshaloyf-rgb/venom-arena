#!/bin/bash
# Start the default game server on port 3001 (if not already running)
GAME_DIR="/home/z/my-project/mini-services/game-server"
LOG="/home/z/my-project/game-server-default.log"

# Check if port 3001 is already listening
if ss -tlnp 2>/dev/null | rg -q ':3001 '; then
  echo "[start-game-server] Port 3001 already in use, skipping."
  exit 0
fi

cd "$GAME_DIR" && setsid env PORT=3001 REGION=DEFAULT bun index.ts > "$LOG" 2>&1 &
echo "[start-game-server] Spawned default game server on port 3001"
exit 0
