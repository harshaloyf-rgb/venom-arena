import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isImpressiveMatch, publishMatchCard } from '@/lib/clips';

// NOTE (highlights audit): the auto-publish logic (thresholds + titles + clip
// row) moved to src/lib/clips.ts and now ALSO runs on the server-authoritative
// path (/api/match/result) — previously it lived only here, an endpoint with
// zero callers, so Match Cards never actually appeared in the feed. This route
// keeps working for any future client-reported history submissions.

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

// POST /api/player/match-history — record a match result & auto-publish impressive ones
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { arenaId, arenaName, isOnline, status, chipsEarned, chipsLost, kills, snakeLength, durationSec } = body;
    // FIX KILL-1: offline deaths are always bot kills, but accept the killer
    // identity anyway so offline history rows render the same "Killed by X"
    // UI. Only a display name is accepted from the client — killerTag is
    // NEVER accepted here (a client must not mint real-player kill credits).
    const clientKillerName = body.killerName ? String(body.killerName).slice(0, 40) : null;

    if (!arenaId || !arenaName || !status) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }
    if (status !== 'EXTRACTED' && status !== 'COLLIDED') {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
    }

    const safeChipsEarned = Math.max(0, Number(chipsEarned) || 0);
    const safeChipsLost = Math.max(0, Number(chipsLost) || 0);
    const safeKills = Math.max(0, Number(kills) || 0);
    const safeSnakeLength = Math.max(0, Number(snakeLength) || 0);
    const safeDuration = Math.max(0, Number(durationSec) || 0);
    const isExtract = status === 'EXTRACTED';

    // ── Record match history ──
    const entry = await db.matchHistory.create({
      data: {
        playerId: session.playerId,
        arenaId: String(arenaId),
        arenaName: String(arenaName),
        isOnline: Boolean(isOnline),
        status,
        chipsEarned: safeChipsEarned,
        chipsLost: safeChipsLost,
        kills: safeKills,
        snakeLength: safeSnakeLength,
        durationSec: safeDuration,
        killerName: status === 'COLLIDED' ? clientKillerName : null,
        killerTag: null, // client-supplied tags are never trusted
        killerIsBot: status === 'COLLIDED' ? (clientKillerName ? true : null) : null,
      },
    });

    // ── Auto-publish impressive matches to Highlights feed ──
    // Marketing: every great match becomes a free content card on the platform
    if (isImpressiveMatch(isExtract, safeChipsEarned, safeKills)) {
      await publishMatchCard({
        playerId: session.playerId,
        matchId: entry.id,
        arenaName: String(arenaName),
        isExtract,
        chipsEarned: safeChipsEarned,
        chipsLost: safeChipsLost,
        kills: safeKills,
        snakeLength: safeSnakeLength,
        durationSec: safeDuration,
        isOnline: Boolean(isOnline),
      });
    }

    // ── Clan war scoring ──
    // NOTE (security hardening): war kills are counted ONLY by the
    // server-authoritative path (/api/match/result, internal-secret auth from
    // the game server). The previous fire-and-forget call to
    // /api/clans/war/score here let any client mint arbitrary war kills and
    // steal the escrowed war pot, so it was removed. Offline match kills are
    // client-reported and unverifiable, so they no longer score wars.

    return NextResponse.json({ id: entry.id, ok: true });
  } catch (e) {
    console.error('[match-history] POST error', e);
    return NextResponse.json({ error: 'Failed to record match.' }, { status: 500 });
  }
}


