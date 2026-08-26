#!/usr/bin/env python3
"""Supervisor for Next.js dev server — double-fork daemon with auto-restart."""
import os, sys, time, subprocess, signal

PROJECT = "/home/z/my-project"
LOG = f"{PROJECT}/dev.log"
PIDFILE = f"{PROJECT}/dev-supervisor.pid"
NEXT_BIN = f"{PROJECT}/node_modules/.bin/next"
MAX_RESTARTS = 100
RESTART_DELAY = 3

def daemonize():
    if os.fork() > 0: sys.exit(0)
    os.setsid()
    if os.fork() > 0: sys.exit(0)
    sys.stdout.flush(); sys.stderr.flush()
    devnull = os.open(os.devnull, os.O_RDWR)
    os.dup2(devnull, 0)
    log_fd = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    os.dup2(log_fd, 1); os.dup2(log_fd, 2)
    os.close(devnull); os.close(log_fd)
    with open(PIDFILE, "w") as f: f.write(str(os.getpid()))

def main():
    restarts = 0
    while restarts < MAX_RESTARTS:
        restarts += 1
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        print(f"[dev-supervisor] attempt {restarts}/{MAX_RESTARTS} starting Next.js at {ts}", flush=True)
        try:
            proc = subprocess.Popen(
                ["node", NEXT_BIN, "dev", "-p", "3000"],
                cwd=PROJECT,
                env=os.environ.copy(),
            )
            proc.wait()
            ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            print(f"[dev-supervisor] Next.js exited rc={proc.returncode} at {ts}", flush=True)
        except Exception as e:
            print(f"[dev-supervisor] error: {e}", flush=True)
        time.sleep(RESTART_DELAY)

if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    signal.signal(signal.SIGINT, lambda *_: sys.exit(0))
    daemonize()
    main()
