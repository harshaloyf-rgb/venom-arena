#!/usr/bin/env bash
# serverctl.sh — Manage the Next.js dev server as a PID-1 daemon
# Usage:
#   ./serverctl.sh start   — start if not running
#   ./serverctl.sh stop    — kill existing server
#   ./serverctl.sh restart — stop + start
#   ./serverctl.sh status  — check if running
#   ./serverctl.sh log     — tail the dev log

PROJECT_DIR="/home/z/my-project"
DEVLOG="$PROJECT_DIR/dev.log"
DAEMONIZE="$PROJECT_DIR/daemonize.sh"

is_running() {
  ss -tlnp 2>/dev/null | rg -q ':3000'
}

wait_for_up() {
  for i in $(seq 1 30); do
    if is_running; then
      echo "Server ready on port 3000 (${i}s)"
      return 0
    fi
    sleep 1
  done
  echo "Server failed to start within 30s"
  return 1
}

case "${1:-status}" in
  start)
    if is_running; then
      echo "Server already running on port 3000"
      exit 0
    fi
    echo "Starting Next.js dev server as daemon..."
    echo "[$(date -u +%FT%TZ)] daemonize: starting next dev" >> "$DEVLOG"
    bash "$DAEMONIZE" "$DEVLOG" npx next dev -p 3000
    wait_for_up
    ;;
  stop)
    if ! is_running; then
      echo "Server not running"
      exit 0
    fi
    echo "Stopping server..."
    pkill -f 'next-server' 2>/dev/null
    pkill -f 'next dev' 2>/dev/null
    sleep 2
    if is_running; then
      pkill -9 -f 'next-server' 2>/dev/null
      sleep 1
    fi
    echo "Server stopped"
    ;;
  restart)
    $0 stop
    sleep 1
    $0 start
    ;;
  status)
    if is_running; then
      RSS=$(ps -eo rss,pid,cmd | rg -v rg | rg 'next-server' | awk '{print $1}')
      MB=$((RSS / 1024))
      echo "Server: RUNNING (port 3000, ~${MB}MB RSS)"
    else
      echo "Server: NOT RUNNING"
    fi
    ;;
  log)
    tail -30 "$DEVLOG"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|log}"
    exit 1
    ;;
esac
