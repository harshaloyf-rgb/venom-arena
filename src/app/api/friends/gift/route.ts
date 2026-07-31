import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/friends/gift  body: { userTag: string, amount: number }
// Sends chips to a friend. Atomic: deduct from sender, credit recipient, record gift.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const toTag = String(body.userTag || '').toUpperCase().trim();
  const amount = Math.max(1, Math.min(1000, Math.floor(Number(body.amount) || 0)));
  if (!toTag) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  if (toTag === session.userTag) return NextResponse.json({ error: 'Cannot gift yourself.' }, { status: 400 });

  const result = await db.$transaction(async (tx) => {
    const sender = await tx.player.findUnique({ where: { id: session.playerId } });
    if (!sender) throw new Error('sender_missing');
    if (sender.bankedChips < amount) throw new Error('insufficient');

    const recipient = await tx.player.findUnique({ where: { userTag: toTag } });
    if (!recipient) throw new Error('recipient_missing');

    // must be friends
    const f = await tx.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: sender.id, recipientId: recipient.id, status: 'accepted' },
          { initiatorId: recipient.id, recipientId: sender.id, status: 'accepted' },
        ],
      },
    });
    if (!f) throw new Error('not_friends');

    const updatedSender = await tx.player.update({
      where: { id: sender.id },
      data: { bankedChips: { decrement: amount }, totalLost: { increment: amount } },
    });
    await tx.player.update({
      where: { id: recipient.id },
      data: { bankedChips: { increment: amount }, totalEarned: { increment: amount } },
    });
    await tx.gift.create({
      data: { fromId: sender.id, toId: recipient.id, amount },
    });
    return updatedSender;
  }).catch((e) => {
    return { error: String(e.message || e) };
  });

  if ('error' in result) {
    const map: Record<string, string> = {
      insufficient: 'Not enough chips.',
      not_friends: 'You can only gift friends.',
      sender_missing: 'Sender missing.',
      recipient_missing: 'Recipient not found.',
    };
    const msg = map[result.error] || 'Gift failed.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true, newBankedChips: result.bankedChips });
}
