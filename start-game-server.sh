#!/usr/bin/env bash
# start-game-server.sh — Launch the Socket.IO game server on port 3001.
set -euo pipefail

GAME_SERVER_DIR="$(cd "$(dirname "$0")/mini-services/game-server" && pwd)"
PORT=3001

# Check if port 3001 is already listening
if lsof -i :"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[start-game-server] Port $PORT already in use — game server is running."
  exit 0
fi

echo "[start-game-server] Starting game server..."
cd "$GAME_SERVER_DIR"
nohup bun --hot index.ts > game-server.log 2>&1 &
echo "[start-game-server] Launched (PID $!) — waiting for port $PORT..."

for i in $(seq 1 20); do
  sleep 0.5
  if lsof -i :"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[start-game-server] Game server is up on port $PORT."
    exit 0
  fi
done

echo "[start-game-server] WARNING: Port $PORT not detected after 10s."
exit 1
