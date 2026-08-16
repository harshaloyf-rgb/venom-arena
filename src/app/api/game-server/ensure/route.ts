import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import net from 'net';

const GAME_SERVER_PORT = 3001;
const GAME_SERVER_DIR = '/home/z/my-project/mini-services/game-server';
let spawning = false;

/** Check if port is listening */
function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: '127.0.0.1' }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
    sock.setTimeout(2000, () => { sock.destroy(); resolve(false); });
  });
}

/** Spawn the game server process */
function spawnGameServer(): Promise<boolean> {
  return new Promise((resolve) => {
    if (spawning) { resolve(false); return; }
    spawning = true;

    const child = exec(
      `cd ${GAME_SERVER_DIR} && nohup bun index.ts > /home/z/my-project/game-server.log 2>&1 &`,
      { timeout: 5000 },
      (err) => {
        spawning = false;
        // exec timeout is fine — the process is backgrounded with nohup
        resolve(!err || ('killed' in err && (err as any).killed));
      },
    );
    child.unref();
  });
}

export async function GET() {
  // Check if game server is already running
  const isOpen = await isPortOpen(GAME_SERVER_PORT);
  if (isOpen) {
    return NextResponse.json({ ok: true, running: true, port: GAME_SERVER_PORT });
  }

  // Try to spawn it
  const spawned = await spawnGameServer();
  if (!spawned) {
    return NextResponse.json({ ok: false, running: false, error: 'Spawn failed' }, { status: 503 });
  }

  // Wait up to 8 seconds for it to start listening
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isPortOpen(GAME_SERVER_PORT)) {
      return NextResponse.json({ ok: true, running: true, port: GAME_SERVER_PORT, started: true });
    }
  }

  return NextResponse.json(
    { ok: false, running: false, error: 'Server did not start in time' },
    { status: 503 },
  );
}
