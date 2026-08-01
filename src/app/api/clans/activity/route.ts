import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/clans/activity?tag=APEX
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tag = String(req.nextUrl.searchParams.get('tag') || '').toUpperCase().trim();
  if (!tag) {
    return NextResponse.json({ error: 'Missing clan tag.' }, { status: 400 });
  }

  try {
    // Verify the requesting player belongs to this clan
    const me = await db.player.findUnique({
      where: { id: session.playerId },
      select: { clanTag: true },
    });
    if (!me || me.clanTag !== tag) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const activities = await db.clanActivity.findMany({
      where: { clanTag: tag },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        type: true,
        actorTag: true,
        actorName: true,
        detail: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ activities });
  } catch (e) {
    console.error('[clans/activity] error', e);
    return NextResponse.json({ error: 'Failed to fetch activity log.' }, { status: 500 });
  }
}
