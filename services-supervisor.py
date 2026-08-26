#!/usr/bin/env python3
"""Supervisor for game-server (3001) and ws-proxy (3002). Double-fork daemon."""
import os, sys, time, subprocess, signal

PROJECT = "/home/z/my-project"
LOG = "/home/z/my-project/services-dev.log"
PIDFILE = "/home/z/my-project/services-dev.pid"
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
    
    services = [
        {"name": "ws-proxy",    "dir": f"{PROJECT}/mini-services/ws-proxy",    "cmd": ["bun", "run", "index.ts"]},
        {"name": "game-server", "dir": f"{PROJECT}/mini-services/game-server", "cmd": ["bun", "run", "index.ts"]},
    ]
    
    procs = {}
    for svc in services:
        procs[svc["name"]] = None
    
    while True:
        for svc in services:
            name = svc["name"]
            p = procs[name]
            if p is None or p.poll() is not None:
                rc = p.returncode if p else -1
                ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                print(f"[{name}] starting (prev rc={rc}) at {ts}", flush=True)
                try:
                    procs[name] = subprocess.Popen(svc["cmd"], cwd=svc["dir"], env=env)
                except Exception as e:
                    print(f"[{name}] error: {e}", flush=True)
                    procs[name] = None
        time.sleep(2)

if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    signal.signal(signal.SIGINT, lambda *_: sys.exit(0))
    daemonize()
    main()
