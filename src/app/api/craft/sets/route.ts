import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Run: bun run db:push

// ---------------------------------------------------------------------------
// GET handler — return all available collection sets with player progress
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const playerId = session.playerId;

  // Fetch all collection sets
  const sets = await db.collectionSet.findMany({
    orderBy: [
      { requiredLevel: 'asc' },
      { rewardRarity: 'asc' },
    ],
  });

  // Count collected pieces per set for this player in a single query
  const pieceCounts = await db.skinPiece.groupBy({
    by: ['skinSetId'],
    where: { playerId },
    _count: { id: true },
  });

  // Build a map of setId -> collected count
  const countMap = new Map<string, number>();
  for (const row of pieceCounts) {
    countMap.set(row.skinSetId, row._count.id);
  }

  // Attach progress to each set
  const setsWithProgress = sets.map((set) => {
    const collected = countMap.get(set.id) || 0;
    return {
      ...set,
      collected,
      completed: collected >= set.totalPieces,
    };
  });

  return NextResponse.json({ sets: setsWithProgress });
}
