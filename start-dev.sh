#!/bin/bash
cd /home/z/my-project
while true; do
  npx next dev -p 3000 >> dev.log 2>&1
  echo "Server died, restarting in 2s..." >> dev.log
  sleep 2
done
