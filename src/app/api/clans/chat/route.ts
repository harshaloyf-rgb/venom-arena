import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/clans/chat?tag=APEX   — last 50 messages
// POST /api/clans/chat            body: { tag, message }
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const tag = String(url.searchParams.get('tag') || '').toUpperCase();
  if (!tag) return NextResponse.json({ error: 'tag required' }, { status: 400 });

  // membership check
  const me = await db.player.findUnique({ where: { id: session.playerId } });
  if (!me || me.clanTag !== tag) return NextResponse.json({ error: 'Not a member.' }, { status: 403 });

  const messages = await db.clanMessage.findMany({
    where: { clanTag: tag },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase();
  const message = String(body.message || '').trim().slice(0, 300);
  if (!tag || !message) return NextResponse.json({ error: 'Invalid message.' }, { status: 400 });

  const me = await db.player.findUnique({ where: { id: session.playerId } });
  if (!me || me.clanTag !== tag) return NextResponse.json({ error: 'Not a member.' }, { status: 403 });

  const created = await db.clanMessage.create({
    data: {
      clanTag: tag,
      senderTag: me.userTag,
      senderName: me.name,
      rank: me.clanRank || 'Viper',
      message,
    },
  });
  return NextResponse.json({ ok: true, message: created });
}
