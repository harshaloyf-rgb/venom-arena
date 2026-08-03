#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS='--max-old-space-size=768' npx next dev -p 3000 2>>/home/z/my-project/dev-err.log >>/home/z/my-project/dev.log
  echo "$(date): dev server exited, restarting in 2s..." >> /home/z/my-project/dev.log
  sleep 2
done
