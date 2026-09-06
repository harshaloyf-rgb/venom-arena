import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { findPlayerByTag } from '@/lib/player-lookup';

// POST /api/friends/accept  body: { userTag: string }  (the initiator's tag)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const fromTag = String(body.userTag || '').trim();
    const from = await findPlayerByTag(fromTag);
    if (!from) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

    const f = await db.friendship.findFirst({
      where: { initiatorId: from.id, recipientId: session.playerId, status: 'pending' },
    });
    if (!f) return NextResponse.json({ error: 'No pending request from that player.' }, { status: 404 });

    await db.friendship.update({ where: { id: f.id }, data: { status: 'accepted' } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[friends/accept] error', e);
    return NextResponse.json({ error: 'Failed to accept request.' }, { status: 500 });
  }
}
