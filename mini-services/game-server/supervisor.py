#!/usr/bin/env python3
"""Persistent supervisor for the game server (port 3001). Double-fork daemon."""
import os, sys, time, subprocess, signal

PROJECT = "/home/z/my-project/mini-services/game-server"
PARENT_ENV = "/home/z/my-project/.env"
LOG = "/home/z/my-project/mini-services/game-server.log"
PIDFILE = "/home/z/my-project/mini-services/game-server.pid"
MAX_RESTARTS = 40
RESTART_DELAY = 2

def load_parent_env(env):
    """Load key=value pairs from the parent project's .env into the env dict."""
    if not os.path.isfile(PARENT_ENV):
        return
    with open(PARENT_ENV) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, _, value = line.partition('=')
                env[key.strip()] = value.strip()

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
    restarts = 0
    while restarts < MAX_RESTARTS:
        restarts += 1
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        print(f"[supervisor] attempt {restarts}/{MAX_RESTARTS} starting game server at {ts}", flush=True)
        try:
            env = os.environ.copy()
            load_parent_env(env)
            proc = subprocess.Popen(["bun", "index.ts"], cwd=PROJECT, env=env)
            proc.wait()
            ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            print(f"[supervisor] game server exited rc={proc.returncode} at {ts}", flush=True)
        except Exception as e:
            print(f"[supervisor] error: {e}", flush=True)
        time.sleep(RESTART_DELAY)

if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    daemonize()
    main()
