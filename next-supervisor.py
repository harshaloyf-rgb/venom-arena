#!/usr/bin/env python3
"""Persistent supervisor for Next.js dev server (port 3000). Double-fork daemon."""
import os, sys, time, subprocess, signal

PROJECT = "/home/z/my-project"
LOG = "/home/z/my-project/next-dev.log"
PIDFILE = "/home/z/my-project/next-dev.pid"
MAX_RESTARTS = 100
RESTART_DELAY = 3

def daemonize():
    if os.fork() > 0: sys.exit(0)
    os.setsid()
    if os.fork() > 0: sys.exit(0)
    sys.stdout.flush(); sys.stderr.flush()
    devnull = os.open(os.devnull, os.O_RDWR)
    os.dup2(devnull, 0)
    log_fd = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    os.dup2(log_fd, 1); os.dup2(log_fd, 2)
    os.close(devnull); os.close(log_fd)
    with open(PIDFILE, "w") as f: f.write(str(os.getpid()))

def main():
    env = os.environ.copy()
    env["PATH"] = "/usr/local/bin:/usr/bin:/bin:" + env.get("PATH", "")
    restarts = 0
    while restarts < MAX_RESTARTS:
        restarts += 1
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        print(f"[next-supervisor] attempt {restarts}/{MAX_RESTARTS} starting next dev at {ts}", flush=True)
        try:
            proc = subprocess.Popen(["npx", "next", "dev", "-p", "3000"], cwd=PROJECT, env=env)
            proc.wait()
            ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            print(f"[next-supervisor] next dev exited rc={proc.returncode} at {ts}", flush=True)
        except Exception as e:
            print(f"[next-supervisor] error: {e}", flush=True)
        time.sleep(RESTART_DELAY)

if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    daemonize()
    main()
