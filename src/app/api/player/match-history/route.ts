import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Auto-publish thresholds for highlights feed
const AUTO_PUBLISH_MIN_CHIPS = 5000;
const AUTO_PUBLISH_MIN_KILLS = 3;
const AUTO_PUBLISH_DEATH_KILLS = 5; // death-only needs more kills to be impressive

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
      },
    });

    // ── Auto-publish impressive matches to Highlights feed ──
    // Marketing: every great match becomes a free content card on the platform
    const isImpressive =
      (isExtract && safeChipsEarned >= AUTO_PUBLISH_MIN_CHIPS) ||
      (isExtract && safeKills >= AUTO_PUBLISH_MIN_KILLS) ||
      (!isExtract && safeKills >= AUTO_PUBLISH_DEATH_KILLS);

    if (isImpressive) {
      try {
        const player = await db.player.findUnique({
          where: { id: session.playerId },
          select: { name: true, userTag: true, country: true, level: true, clanTag: true },
        });
        if (player) {
          // Generate a catchy title
          let title: string;
          if (isExtract && safeChipsEarned >= AUTO_PUBLISH_MIN_CHIPS && safeKills >= AUTO_PUBLISH_MIN_KILLS) {
            title = `💥 ${formatCompact(safeChipsEarned)}c Extraction with ${safeKills} Kills!`;
          } else if (isExtract && safeChipsEarned >= AUTO_PUBLISH_MIN_CHIPS) {
            title = `💰 Massive ${formatCompact(safeChipsEarned)}c Extraction!`;
          } else if (isExtract && safeKills >= AUTO_PUBLISH_MIN_KILLS) {
            title = `💀 ${safeKills}-Kill Extraction in ${arenaName}!`;
          } else {
            title = `⚔️ ${safeKills} Eliminations Before Falling!`;
          }

          const matchData = JSON.stringify({
            outcome: isExtract ? 'extract' : 'death',
            chipsLost: safeChipsLost,
            snakeLength: safeSnakeLength,
            durationSec: safeDuration,
            isOnline: Boolean(isOnline),
          });

          await db.clip.create({
            data: {
              playerId: session.playerId,
              matchId: entry.id,
              title,
              description: '',
              platform: 'match-card',
              url: '',
              chipsExtracted: safeChipsEarned,
              kills: safeKills,
              arenaName: String(arenaName),
              tags: JSON.stringify(['auto', isExtract ? 'extraction' : 'combat']),
              cardType: 'match-card',
              matchData,
              status: 'approved', // system-generated, auto-approved
            },
          });
        }
      } catch (clipErr) {
        // Don't fail the match history save if clip creation fails
        console.error('[match-history] auto-publish clip failed', clipErr);
      }
    }

    // ── Score clan war if applicable (fire-and-forget) ──
    if (safeKills > 0) {
      try {
        const warPlayer = await db.player.findUnique({
          where: { id: session.playerId },
          select: { clanTag: true },
        });
        if (warPlayer?.clanTag) {
          await fetch((process.env.NEXT_PUBLIC_BASE_URL || '') + '/api/clans/war/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') || '' },
            body: JSON.stringify({ kills: safeKills }),
          });
        }
      } catch {
        // Non-critical — don't fail match recording
      }
    }

    return NextResponse.json({ id: entry.id, ok: true });
  } catch (e) {
    console.error('[match-history] POST error', e);
    return NextResponse.json({ error: 'Failed to record match.' }, { status: 500 });
  }
}

// ── Helpers ──
function formatCompact(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
