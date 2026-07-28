#!/bin/bash
# Persistent supervisor for the Next.js dev server.
# Restarts the server if it exits, up to 20 times. Designed to be run with setsid.
cd /home/z/my-project
export NEXT_TELEMETRY_DISABLED=1
ATTEMPTS=0
MAX_ATTEMPTS=20
while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  echo "[supervisor] attempt $ATTEMPTS/$MAX_ATTEMPTS starting bun run dev at $(date -u +%FT%TZ)"
  bun run dev
  RC=$?
  echo "[supervisor] bun run dev exited with rc=$RC at $(date -u +%FT%TZ)"
  if [ $RC -eq 0 ]; then break; fi
  sleep 2
done
echo "[supervisor] giving up after $ATTEMPTS attempts"
