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

  try {
    await db.$transaction(async (tx) => {
      // Already exists? Check inside transaction to prevent race condition
      const existing = await tx.friendship.findFirst({
        where: {
          OR: [
            { initiatorId: session.playerId, recipientId: target.id },
            { initiatorId: target.id, recipientId: session.playerId },
          ],
        },
      });
      if (existing) {
        if (existing.status === 'accepted') throw new Error('already_friends');
        if (existing.status === 'blocked') throw new Error('blocked');
        throw new Error('pending');
      }

      // Max friends limit check
      const friendCount = await tx.friendship.count({
        where: {
          OR: [
            { initiatorId: session.playerId, status: 'accepted' },
            { recipientId: session.playerId, status: 'accepted' },
          ],
        },
      });
      if (friendCount >= 100) throw new Error('max_friends');

      await tx.friendship.create({
        data: { initiatorId: session.playerId, recipientId: target.id, status: 'pending' },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      already_friends: { error: 'Already friends.', status: 400 },
      blocked: { error: 'Cannot send request.', status: 403 },
      pending: { error: 'Request already pending.', status: 400 },
      max_friends: { error: 'You have reached the maximum number of friends (100).', status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    // Unique constraint violation (duplicate from race condition)
    if (msg.includes('Unique')) {
      return NextResponse.json({ error: 'Request already pending.', status: 400 });
    }
    console.error('[friends/request] error', e);
    return NextResponse.json({ error: 'Failed to send request.' }, { status: 500 });
  }
}
