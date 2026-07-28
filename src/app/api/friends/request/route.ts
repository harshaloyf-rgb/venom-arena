import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/friends/request  body: { userTag: string }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const targetTag = String(body.userTag || '').toUpperCase().trim();
  if (!targetTag) return NextResponse.json({ error: 'userTag required' }, { status: 400 });

  if (targetTag === session.userTag) {
    return NextResponse.json({ error: 'Cannot friend yourself.' }, { status: 400 });
  }
  const target = await db.player.findUnique({ where: { userTag: targetTag } });
  if (!target) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

  // Already exists?
  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        { initiatorId: session.playerId, recipientId: target.id },
        { initiatorId: target.id, recipientId: session.playerId },
      ],
    },
  });
  if (existing) {
    if (existing.status === 'accepted') return NextResponse.json({ error: 'Already friends.' }, { status: 400 });
    if (existing.status === 'blocked') return NextResponse.json({ error: 'Cannot send request.' }, { status: 403 });
    return NextResponse.json({ error: 'Request already pending.' }, { status: 400 });
  }

  await db.friendship.create({
    data: { initiatorId: session.playerId, recipientId: target.id, status: 'pending' },
  });
  return NextResponse.json({ ok: true });
}
