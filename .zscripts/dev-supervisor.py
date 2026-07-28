#!/usr/bin/env python3
"""
Persistent supervisor for the Next.js dev server.

Uses a double-fork daemonization to fully detach from any controlling terminal
and parent process group, so it survives the shell that launched it. Restarts
the dev server if it exits (including OOM kills), up to MAX_RESTARTS times.

Memory is constrained via NODE_OPTIONS=--max-old-space-size=640 to keep the
Turbopack dev server under the 4.1GB container limit.
"""
import os
import sys
import time
import subprocess
import signal

PROJECT = "/home/z/my-project"
LOG = PROJECT + "/dev.log"
PIDFILE = PROJECT + "/.zscripts/dev.pid"
MAX_RESTARTS = 40
RESTART_DELAY = 2

# Constrain Node heap so Turbopack doesn't get OOM-killed.
ENV = os.environ.copy()
ENV["NEXT_TELEMETRY_DISABLED"] = "1"
ENV["NODE_OPTIONS"] = "--max-old-space-size=640"

def daemonize():
    """Double-fork to detach from any terminal/session."""
    # First fork
    if os.fork() > 0:
        sys.exit(0)
    os.setsid()
    # Second fork
    if os.fork() > 0:
        sys.exit(0)
    # Redirect stdio
    sys.stdout.flush()
    sys.stderr.flush()
    devnull = os.open(os.devnull, os.O_RDWR)
    os.dup2(devnull, 0)
    log_fd = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    os.dup2(log_fd, 1)
    os.dup2(log_fd, 2)
    os.close(devnull)
    os.close(log_fd)
    # Write pidfile
    with open(PIDFILE, "w") as f:
        f.write(str(os.getpid()))

def main():
    restarts = 0
    while restarts < MAX_RESTARTS:
        restarts += 1
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        print(f"[supervisor] attempt {restarts}/{MAX_RESTARTS} starting bun run dev at {ts}", flush=True)
        try:
            # exec via subprocess so we retain control to respawn
            proc = subprocess.Popen(
                ["bun", "run", "dev"],
                cwd=PROJECT,
                env=ENV,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.STDOUT,
            )
            proc.wait()
            rc = proc.returncode
            ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            print(f"[supervisor] bun run dev exited rc={rc} at {ts}", flush=True)
        except Exception as e:
            ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            print(f"[supervisor] error: {e} at {ts}", flush=True)
        # If killed by OOM, rc is negative (signal). Wait then restart.
        time.sleep(RESTART_DELAY)
    print(f"[supervisor] giving up after {restarts} attempts", flush=True)

if __name__ == "__main__":
    # Handle SIGTERM gracefully
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    daemonize()
    main()
