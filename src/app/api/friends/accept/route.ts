import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/friends/accept  body: { userTag: string }  (the initiator's tag)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const fromTag = String(body.userTag || '').toUpperCase().trim();
  const from = await db.player.findUnique({ where: { userTag: fromTag } });
  if (!from) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

  const f = await db.friendship.findFirst({
    where: { initiatorId: from.id, recipientId: session.playerId, status: 'pending' },
  });
  if (!f) return NextResponse.json({ error: 'No pending request from that player.' }, { status: 404 });

  await db.friendship.update({ where: { id: f.id }, data: { status: 'accepted' } });
  return NextResponse.json({ ok: true });
}
