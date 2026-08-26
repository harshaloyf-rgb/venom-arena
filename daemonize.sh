#!/usr/bin/env bash
# daemonize.sh — Double-fork daemon launcher. Child adopted by PID 1.
# Usage: ./daemonize.sh <log_file> <command> [args...]

LOGFILE="$1"
shift

if [ -z "$LOGFILE" ] || [ $# -eq 0 ]; then
  echo "Usage: $0 <logfile> <command> [args...]"
  exit 1
fi

# Write a small Python daemon script to /tmp
DAEMON_PY=$(mktemp /tmp/daemon_XXXXXX.py)
cat > "$DAEMON_PY" << 'PYEOF'
import os, sys

log_path = sys.argv[1]
cmd = sys.argv[2:]

pid = os.fork()
if pid > 0:
    os.waitpid(pid, 0)
    sys.exit(0)

pid2 = os.fork()
if pid2 > 0:
    sys.exit(0)

os.setsid()
devnull = os.open(os.devnull, os.O_RDWR)
os.dup2(devnull, 0)
log_fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND)
os.dup2(log_fd, 1)
os.dup2(log_fd, 2)
if devnull > 2:
    os.close(devnull)

os.chdir('/home/z/my-project')
os.environ['NODE_OPTIONS'] = '--max-old-space-size=768'
os.execvp(cmd[0], cmd)
PYEOF

python3 "$DAEMON_PY" "$LOGFILE" "$@"
rm -f "$DAEMON_PY"
