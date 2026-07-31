#!/bin/bash
cd /home/z/my-project
bash start-game-server.sh
exec ./node_modules/.bin/next dev -p 3000
