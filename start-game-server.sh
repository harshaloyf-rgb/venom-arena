#!/bin/bash
# Start the Socket.IO game server in the background
if [ -f "mini-services/game-server/index.ts" ]; then
  cd /home/z/my-project/mini-services/game-server && bun --hot index.ts > /home/z/my-project/game-server.log 2>&1 &
  echo "Game server started (PID $!)"
fi
exit 0
