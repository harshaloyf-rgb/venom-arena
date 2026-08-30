import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import net from 'net';
import { getRegionServer, VALID_REGIONS, type RegionCode } from '@/lib/game-config';

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

/** Spawn a regional game server process */
function spawnServer(port: number, region: string): Promise<boolean> {
  const key = `${port}:${region}`;
  return new Promise((resolve) => {
    if (spawnLocks.get(key)) { resolve(false); return; }
    spawnLocks.set(key, true);

    const envVars = `PORT=${port} REGION=${region}`;
    const logFile = `/home/z/my-project/game-server-${region.toLowerCase()}.log`;
    const child = exec(
      `cd ${GAME_SERVER_DIR} && ${envVars} nohup bun index.ts > ${logFile} 2>&1 &`,
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
 * GET /api/game-server/ensure?region=SA
 *
 * Ensures the game server for a specific region is running.
 * If no region is specified, starts the default server (port 3001).
 */
export async function GET(req: NextRequest) {
  const regionParam = req.nextUrl.searchParams.get('region');

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

  // Check if already running
  const isOpen = await isPortOpen(port);
  if (isOpen) {
    return NextResponse.json({ ok: true, running: true, port, region });
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
