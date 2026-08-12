#!/bin/bash
# Start the Socket.IO game server daemon (port 3001)
if [ -f "/home/z/my-project/game-server-supervisor.py" ]; then
  python3 /home/z/my-project/game-server-supervisor.py
fi
exit 0
