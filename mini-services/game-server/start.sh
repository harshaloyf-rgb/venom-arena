#!/bin/bash
# Persistent game server runner - restarts on crash
while true; do
  cd /home/z/my-project/mini-services/game-server
  bun index.ts
  echo "[game-server] Crashed, restarting in 2s..."
  sleep 2
done
