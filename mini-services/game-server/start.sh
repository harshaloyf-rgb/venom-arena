#!/bin/bash
# Persistent game server runner - restarts on crash
# Redirects all output to game-server.log with timestamps
cd /home/z/my-project/mini-services/game-server
while true; do
  echo "[$(date -Iseconds)] Starting game-server..." >> /home/z/my-project/game-server.log
  bun index.ts 2>&1 | while IFS= read -r line; do
    echo "[$(date -Iseconds)] $line" >> /home/z/my-project/game-server.log
  done
  EXIT_CODE=${PIPESTATUS[0]}
  echo "[$(date -Iseconds)] Crashed with exit code $EXIT_CODE, restarting in 2s..." >> /home/z/my-project/game-server.log
  sleep 2
done
