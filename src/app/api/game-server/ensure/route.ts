import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import net from 'net';
import { getRegionServer, VALID_REGIONS } from '@/lib/game-config';

const GAME_SERVER_DIR = '/home/z/my-project/mini-services/game-server';
const spawnLocks = new Map<string, boolean>();

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

/** Kill any process listening on a port */
function killPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    exec(`fuser -k ${port}/tcp 2>/dev/null; true`, { timeout: 3000 }, () => resolve());
  });
}

/** Spawn a regional game server process */
function spawnServer(port: number, region: string): Promise<boolean> {
  const key = `${port}:${region}`;
  return new Promise((resolve) => {
    if (spawnLocks.get(key)) { resolve(false); return; }
    spawnLocks.set(key, true);

    const logFile = `/home/z/my-project/game-server-${region.toLowerCase()}.log`;
    const child = exec(
      `cd ${GAME_SERVER_DIR} && setsid env PORT=${port} REGION=${region} bun index.ts > ${logFile} 2>&1 &`,
      { timeout: 5000 },
      (err) => {
        spawnLocks.delete(key);
        resolve(!err || ('killed' in err && (err as any).killed));
      },
    );
    child.unref();
  });
}

/**
 * GET /api/game-server/ensure?region=SA&force=1
 *
 * Ensures the game server for a specific region is running with the latest code.
 * If no region is specified, starts the default server (port 3001).
 * Pass force=1 to kill any existing server and restart.
 */
export async function GET(req: NextRequest) {
  const regionParam = req.nextUrl.searchParams.get('region');
  const forceRestart = req.nextUrl.searchParams.get('force') === '1';

  // Determine which server to ensure
  let port: number;
  let region: string;

  if (regionParam && (VALID_REGIONS as readonly string[]).includes(regionParam)) {
    region = regionParam;
    const server = getRegionServer(regionParam);
    port = server.port;
  } else {
    // Legacy: no region specified — use default port 3001
    region = 'DEFAULT';
    port = 3001;
  }

  // Check if already running (skip early return when force-restarting)
  const isOpen = await isPortOpen(port);
  if (isOpen && !forceRestart) {
    return NextResponse.json({ ok: true, running: true, port, region });
  }

  // When force=1, ALWAYS kill any existing process on that port first.
  // This handles edge cases where a process is running but not accepting
  // connections (zombie/stuck state) — isPortOpen returns false but the
  // port is still held, preventing the new server from binding.
  if (forceRestart) {
    await killPort(port);
    await new Promise((r) => setTimeout(r, 500)); // let port release
  } else if (isOpen) {
    // Port is stale (no response) — kill the zombie process
    await killPort(port);
    await new Promise((r) => setTimeout(r, 500));
  }

  // Try to spawn it
  const spawned = await spawnServer(port, region);
  if (!spawned) {
    return NextResponse.json({ ok: false, running: false, error: 'Spawn failed', port, region }, { status: 503 });
  }

  // Wait up to 8 seconds for it to start listening
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isPortOpen(port)) {
      return NextResponse.json({ ok: true, running: true, port, region, started: true });
    }
  }

  return NextResponse.json(
    { ok: false, running: false, error: 'Server did not start in time', port, region },
    { status: 503 },
  );
}
