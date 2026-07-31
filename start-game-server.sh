#!/usr/bin/env bash
# ============================================================================
# start-game-server.sh — Ensures the Socket.IO game server is running.
#
# Called automatically by `bun run dev` (see package.json "dev" script).
# Checks if port 3001 is already listening; if not, launches the game server
# via the supervisor.py daemon so it auto-restarts on crash.
# ============================================================================
set -euo pipefail

GAME_SERVER_DIR="$(cd "$(dirname "$0")/mini-services/game-server" && pwd)"
PIDFILE="$GAME_SERVER_DIR/game-server.pid"
LOGFILE="$GAME_SERVER_DIR/game-server.log"
PORT=3001

# Check if port 3001 is already listening (server running and healthy)
if lsof -i :"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[start-game-server] Port $PORT already in use — game server is running."
  exit 0
fi

# Check if supervisor is already running (but server may have crashed)
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "[start-game-server] Supervisor PID $(cat "$PIDFILE") is alive — it will restart the game server."
  exit 0
fi

# Clean up stale pidfile
rm -f "$PIDFILE"

echo "[start-game-server] Starting game server supervisor..."
cd "$GAME_SERVER_DIR"
python3 supervisor.py &
echo "[start-game-server] Supervisor launched — waiting for port $PORT..."

# Wait up to 10 seconds for the server to become available
for i in $(seq 1 20); do
  sleep 0.5
  if lsof -i :"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[start-game-server] Game server is up on port $PORT."
    exit 0
  fi
done

echo "[start-game-server] WARNING: Port $PORT not detected after 10s. Check $LOGFILE"
exit 1
