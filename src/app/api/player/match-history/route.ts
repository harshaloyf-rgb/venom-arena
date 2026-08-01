import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/player/match-history?limit=25&offset=0&status=
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '25', 10) || 25, 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);
    const status = searchParams.get('status'); // 'EXTRACTED' | 'COLLIDED' | undefined (all)

    const where: Record<string, unknown> = { playerId: session.playerId };
    if (status && (status === 'EXTRACTED' || status === 'COLLIDED')) {
      where.status = status;
    }

    const [entries, total] = await Promise.all([
      db.matchHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.matchHistory.count({ where }),
    ]);

    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        arenaId: e.arenaId,
        arenaName: e.arenaName,
        isOnline: e.isOnline,
        status: e.status,
        chipsEarned: e.chipsEarned,
        chipsLost: e.chipsLost,
        kills: e.kills,
        snakeLength: e.snakeLength,
        durationSec: e.durationSec,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
    });
  } catch (e) {
    console.error('[match-history] GET error', e);
    return NextResponse.json({ entries: [], total: 0 });
  }
}

// POST /api/player/match-history — record a match result (called by game engine)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { arenaId, arenaName, isOnline, status, chipsEarned, chipsLost, kills, snakeLength, durationSec } = body;

    if (!arenaId || !arenaName || !status) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }
    if (status !== 'EXTRACTED' && status !== 'COLLIDED') {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
    }

    const entry = await db.matchHistory.create({
      data: {
        playerId: session.playerId,
        arenaId: String(arenaId),
        arenaName: String(arenaName),
        isOnline: Boolean(isOnline),
        status,
        chipsEarned: Math.max(0, Number(chipsEarned) || 0),
        chipsLost: Math.max(0, Number(chipsLost) || 0),
        kills: Math.max(0, Number(kills) || 0),
        snakeLength: Math.max(0, Number(snakeLength) || 0),
        durationSec: Math.max(0, Number(durationSec) || 0),
      },
    });

    return NextResponse.json({ id: entry.id, ok: true });
  } catch (e) {
    console.error('[match-history] POST error', e);
    return NextResponse.json({ error: 'Failed to record match.' }, { status: 500 });
  }
}
