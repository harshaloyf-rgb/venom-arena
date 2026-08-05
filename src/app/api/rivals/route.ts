import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/rivals — list my rivals + check if a tag is a rival
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const checkTag = req.nextUrl.searchParams.get('check')?.trim();
    if (checkTag) {
      const rival = await db.rival.findUnique({
        where: { playerId_rivalTag: { playerId: session.playerId, rivalTag: checkTag } },
      });
      return NextResponse.json({ isRival: !!rival });
    }

    const rivals = await db.rival.findMany({
      where: { playerId: session.playerId },
      orderBy: { lastEncounterAt: 'desc' },
    });
    // Enrich with target player's country, bankedChips, level
    const enriched = await Promise.all(rivals.map(async (r) => {
      const target = await db.player.findUnique({
        where: { userTag: r.rivalTag },
        select: { country: true, bankedChips: true, level: true },
      });
      return {
        ...r,
        country: target?.country || 'US',
        bankedChips: target?.bankedChips || 0,
        level: target?.level || 1,
      };
    }));
    const rivalsCount = rivals.length;
    return NextResponse.json({ rivals: enriched, rivalsCount: enriched.length });
  } catch (e) {
    console.error('[rivals/get] error', e);
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}

// POST /api/rivals { tag: string, name?: string, action: 'add' | 'remove' }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tag = String(body.tag || '').trim();
    const action = String(body.action || 'add');
    const name = String(body.name || '').trim();

    if (!tag) return NextResponse.json({ error: 'Missing tag' }, { status: 400 });
    if (tag === session.userTag) return NextResponse.json({ error: 'Cannot rival yourself' }, { status: 400 });

    // Verify target exists
    const target = await db.player.findUnique({ where: { userTag: tag }, select: { name: true } });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    if (action === 'remove') {
      const existing = await db.rival.findUnique({
        where: { playerId_rivalTag: { playerId: session.playerId, rivalTag: tag } },
      });
      if (existing) await db.rival.delete({ where: { id: existing.id } });
      const count = await db.rival.count({ where: { playerId: session.playerId } });
      return NextResponse.json({ isRival: false, rivalsCount: count });
    }

    // Add rival (upsert)
    const rival = await db.rival.upsert({
      where: { playerId_rivalTag: { playerId: session.playerId, rivalTag: tag } },
      create: { playerId: session.playerId, rivalTag: tag, rivalName: name || target.name },
      update: { rivalName: name || target.name },
    });
    const count = await db.rival.count({ where: { playerId: session.playerId } });
    return NextResponse.json({ isRival: true, rival, rivalsCount: count });
  } catch (e) {
    console.error('[rivals/post] error', e);
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}
