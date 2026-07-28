import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/friends/list — returns accepted friends + pending requests received
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const me = await db.player.findUnique({
    where: { id: session.playerId },
    include: {
      friendsFrom: { include: { recipient: true } },
      friendsTo: { include: { initiator: true } },
    },
  });
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const friends = [];
  const pendingReceived = [];
  const pendingSent = [];

  for (const f of me.friendsFrom) {
    if (f.status === 'accepted') {
      friends.push(toFriend(f.recipient, 'accepted'));
    } else if (f.status === 'pending') {
      pendingSent.push(toFriend(f.recipient, 'pending_sent'));
    }
  }
  for (const f of me.friendsTo) {
    if (f.status === 'accepted') {
      friends.push(toFriend(f.initiator, 'accepted'));
    } else if (f.status === 'pending') {
      pendingReceived.push(toFriend(f.initiator, 'pending_received'));
    }
  }

  return NextResponse.json({ friends, pendingReceived, pendingSent });
}

function toFriend(p: any, status: string) {
  return {
    id: p.id,
    userTag: p.userTag,
    name: p.name,
    country: p.country,
    level: p.level,
    bankedChips: p.bankedChips,
    status,
    online: Date.now() - new Date(p.lastSeenAt).getTime() < 60_000,
  };
}
