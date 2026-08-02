import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/clans/war?tag=XXX
// Returns the active war for a clan, or null if none.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tag = String(searchParams.get('tag') || '').toUpperCase().trim();

  if (!tag) {
    return NextResponse.json({ error: 'Missing tag parameter.' }, { status: 400 });
  }

  try {
    const war = await db.clanWar.findFirst({
      where: {
        OR: [
          { declarerTag: tag, status: 'active' },
          { targetTag: tag, status: 'active' },
        ],
      },
      include: {
        declarer: { select: { name: true } },
        target: { select: { name: true } },
      },
    });

    if (!war) {
      return NextResponse.json({ war: null });
    }

    return NextResponse.json({
      war: {
        id: war.id,
        declarerTag: war.declarerTag,
        declarerName: war.declarer.name,
        targetTag: war.targetTag,
        targetName: war.target.name,
        wager: war.wager,
        declarerScore: war.declarerScore,
        targetScore: war.targetScore,
        totalPot: war.wager * 2,
        startedAt: war.startedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error('[clans/war] error', e);
    return NextResponse.json({ error: 'Failed to fetch war.' }, { status: 500 });
  }
}
