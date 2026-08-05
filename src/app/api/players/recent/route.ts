import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/players/recent?limit=10
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const rawLimit = parseInt(searchParams.get('limit') ?? '10', 10);
  const limit = Math.min(Math.max(rawLimit, 1), 20);

  const matches = await db.matchHistory.findMany({
    where: { playerId: session.playerId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      arenaName: true,
      status: true,
      chipsEarned: true,
      chipsLost: true,
      kills: true,
      snakeLength: true,
      durationSec: true,
      createdAt: true,
      isOnline: true,
    },
  });

  return NextResponse.json({ matches });
}