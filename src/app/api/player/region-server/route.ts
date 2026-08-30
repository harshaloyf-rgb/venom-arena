import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getRegionServer, REGION_NAMES } from '@/lib/game-config';

/**
 * GET /api/player/region-server
 *
 * Returns the game server endpoint for the authenticated player's region.
 * The frontend uses this to connect Socket.IO to the correct regional server.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const player = await db.player.findUnique({
      where: { id: session.playerId },
      select: { region: true, country: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const server = getRegionServer(player.region);

    return NextResponse.json({
      region: player.region,
      regionName: REGION_NAMES[player.region] || player.region,
      country: player.country,
      server,
    });
  } catch (e) {
    console.error('[region-server] error', e);
    return NextResponse.json({ error: 'Failed to get region server' }, { status: 500 });
  }
}
