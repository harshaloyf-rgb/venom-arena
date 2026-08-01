import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/friends/history?type=sent&limit=20
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'all';
  const limit = Math.min(50, Math.max(1, Math.floor(Number(searchParams.get('limit')) || 20)));

  if (type !== 'sent' && type !== 'received' && type !== 'all') {
    return NextResponse.json({ error: 'Invalid type parameter.' }, { status: 400 });
  }

  let gifts: any[];

  if (type === 'sent') {
    const rows = await db.gift.findMany({
      where: { fromId: session.playerId },
      include: { to: { select: { name: true, userTag: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    gifts = rows.map((g) => ({
      id: g.id,
      amount: g.amount,
      createdAt: g.createdAt,
      direction: 'sent' as const,
      player: { name: g.to.name, userTag: g.to.userTag },
    }));
  } else if (type === 'received') {
    const rows = await db.gift.findMany({
      where: { toId: session.playerId },
      include: { from: { select: { name: true, userTag: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    gifts = rows.map((g) => ({
      id: g.id,
      amount: g.amount,
      createdAt: g.createdAt,
      direction: 'received' as const,
      player: { name: g.from.name, userTag: g.from.userTag },
    }));
  } else {
    const rows = await db.gift.findMany({
      where: {
        OR: [{ fromId: session.playerId }, { toId: session.playerId }],
      },
      include: {
        from: { select: { name: true, userTag: true } },
        to: { select: { name: true, userTag: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    gifts = rows.map((g) => ({
      id: g.id,
      amount: g.amount,
      createdAt: g.createdAt,
      direction: (g.fromId === session.playerId ? 'sent' : 'received') as 'sent' | 'received',
      player:
        g.fromId === session.playerId
          ? { name: g.to.name, userTag: g.to.userTag }
          : { name: g.from.name, userTag: g.from.userTag },
    }));
  }

  return NextResponse.json({ entries: gifts });
}
