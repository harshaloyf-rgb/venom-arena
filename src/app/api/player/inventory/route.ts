import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// ---------------------------------------------------------------------------
// GET handler — return player's skin pieces grouped by set with completion status
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const playerId = session.playerId;

  // Fetch all skin pieces for the player
  const pieces = await db.skinPiece.findMany({
    where: { playerId },
    orderBy: [{ skinSetId: 'asc' }, { pieceIndex: 'asc' }],
  });

  // Get all set IDs the player has pieces in
  const setIds = [...new Set(pieces.map((p) => p.skinSetId))];

  // Fetch those collection sets
  const sets = setIds.length > 0
    ? await db.collectionSet.findMany({
        where: { id: { in: setIds } },
      })
    : [];

  // Build a map of setId -> collected count
  const collectedMap = new Map<string, number>();
  for (const piece of pieces) {
    collectedMap.set(piece.skinSetId, (collectedMap.get(piece.skinSetId) || 0) + 1);
  }

  // Build response with completion status
  const setsWithProgress = sets.map((set) => {
    const collected = collectedMap.get(set.id) || 0;
    return {
      set,
      collected,
      total: set.totalPieces,
      completed: collected >= set.totalPieces,
    };
  });

  return NextResponse.json({ pieces, sets: setsWithProgress });
}
