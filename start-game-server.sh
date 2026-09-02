#!/bin/bash
# Start the default game server on port 3001 (if not already running)
# Paths are derived from THIS script's location — works on any machine/checkout.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME_DIR="$ROOT/mini-services/game-server"
LOG="$ROOT/game-server-default.log"

# Load secrets from the repo .env (the game server needs INTERNAL_SECRET to
# verify player tokens against the main server. Without it, every player
# gets AUTH_FAIL because bun falls back to 'dev-secret').
if [ -f "$ROOT/.env" ]; then
  set -a
  source "$ROOT/.env"
  set +a
fi

# Check if port 3001 is already listening
if ss -tlnp 2>/dev/null | grep -q ':3001 '; then
  echo "[start-game-server] Port 3001 already in use, skipping."
  exit 0
fi

cd "$GAME_DIR" && setsid env PORT=3001 REGION=DEFAULT INTERNAL_SECRET="${INTERNAL_SECRET:-}" bun index.ts > "$LOG" 2>&1 &
echo "[start-game-server] Spawned default game server on port 3001"
exit 0
