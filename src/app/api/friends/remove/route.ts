import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/friends/remove  body: { userTag: string }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const otherTag = String(body.userTag || '').toUpperCase().trim();
    const other = await db.player.findUnique({ where: { userTag: otherTag } });
    if (!other) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

    await db.friendship.deleteMany({
      where: {
        OR: [
          { initiatorId: session.playerId, recipientId: other.id },
          { initiatorId: other.id, recipientId: session.playerId },
        ],
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[friends/remove] error', e);
    return NextResponse.json({ error: 'Failed to remove friend.' }, { status: 500 });
  }
}
