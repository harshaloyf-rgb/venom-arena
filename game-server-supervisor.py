#!/usr/bin/env python3
"""Persistent supervisor for Game Server (port 3001). Double-fork daemon."""
import os, sys, time, subprocess, signal, socket

PROJECT = "/home/z/my-project"
GAMESERVER_DIR = f"{PROJECT}/mini-services/game-server"
LOG = f"{PROJECT}/game-server.log"
PIDFILE = f"{PROJECT}/game-server.pid"
MAX_RESTARTS = 100
RESTART_DELAY = 3
PORT = 3001

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

def port_in_use(port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(('127.0.0.1', port)) == 0
    except:
        return False

def kill_port(port):
    """Kill any process using the port."""
    try:
        result = subprocess.run(
            ["fuser", "-k", f"{port}/tcp"],
            capture_output=True, timeout=5,
        )
        return result.returncode == 0
    except:
        return False

def main():
    env = os.environ.copy()
    env["PATH"] = "/usr/local/bin:/usr/bin:/bin:" + env.get("PATH", "")
    restarts = 0
    consecutive_port_errors = 0

    while restarts < MAX_RESTARTS:
        restarts += 1
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # If port is still in use from previous instance, wait longer
        if port_in_use(PORT):
            consecutive_port_errors += 1
            print(f"[game-supervisor] attempt {restarts}/{MAX_RESTARTS} port {PORT} in use, waiting {RESTART_DELAY * 2}s at {ts}", flush=True)
            # Try to kill the stale process
            kill_port(PORT)
            time.sleep(RESTART_DELAY * 2)
            if port_in_use(PORT):
                time.sleep(RESTART_DELAY * 2)
            continue

        consecutive_port_errors = 0
        print(f"[game-supervisor] attempt {restarts}/{MAX_RESTARTS} starting at {ts}", flush=True)
        try:
            proc = subprocess.Popen(["bun", "index.ts"], cwd=GAMESERVER_DIR, env=env)
            proc.wait()
            ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            print(f"[game-supervisor] exited rc={proc.returncode} at {ts}", flush=True)
        except Exception as e:
            ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            print(f"[game-supervisor] error: {e} at {ts}", flush=True)
        time.sleep(RESTART_DELAY)

    print(f"[game-supervisor] Max restarts ({MAX_RESTARTS}) reached, giving up", flush=True)

if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    signal.signal(signal.SIGINT, lambda *_: sys.exit(0))
    daemonize()
    main()
