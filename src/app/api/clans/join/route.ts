import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/join  body: { tag }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim();
  const clan = await db.clan.findUnique({ where: { tag }, include: { _count: { select: { members: true } } } });
  if (!clan) return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });
  if (clan._count.members >= 30) return NextResponse.json({ error: 'Clan is full (max 30).' }, { status: 400 });

  const me = await db.player.findUnique({ where: { id: session.playerId } });
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (me.clanTag) return NextResponse.json({ error: 'Leave your current clan first.' }, { status: 400 });

  await db.player.update({ where: { id: me.id }, data: { clanTag: tag, clanRank: 'Viper' } });
  return NextResponse.json({ ok: true });
}
