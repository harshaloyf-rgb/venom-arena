import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Run: bun run db:push

// Rarity weights for random set selection
const RARITY_WEIGHTS: Record<string, number> = {
  common: 60,
  rare: 30,
  epic: 8,
  legendary: 2,
};

/** Weighted random selection from eligible sets */
function weightedRandomSelect(sets: { id: string; rewardRarity: string }[]): string | null {
  if (sets.length === 0) return null;

  // Build weighted pool
  const weighted: { id: string; weight: number }[] = [];
  for (const set of sets) {
    const weight = RARITY_WEIGHTS[set.rewardRarity] || 10;
    weighted.push({ id: set.id, weight });
  }

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.id;
  }

  // Fallback to last item
  return weighted[weighted.length - 1].id;
}

// ---------------------------------------------------------------------------
// POST handler — claim a level chest reward
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const playerId = session.playerId;

  // Parse body
  let body: { count?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const chestCount = Math.max(1, Math.min(body.count || 1, 10)); // cap at 10

  // Get player level
  const player = await db.player.findUnique({
    where: { id: playerId },
    select: { level: true },
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Find all sets available to this player (level requirement met)
  const eligibleSets = await db.collectionSet.findMany({
    where: { requiredLevel: { lte: player.level } },
  });

  if (eligibleSets.length === 0) {
    return NextResponse.json({ pieces: [], newCompleted: [] });
  }

  const allCreatedPieces: Awaited<ReturnType<typeof db.skinPiece.create>>[] = [];
  const newCompleted: string[] = [];
  const now = Date.now();

  // Process each chest
  for (let chest = 0; chest < chestCount; chest++) {
    // Select a random set (weighted by rarity)
    const selectedSetId = weightedRandomSelect(eligibleSets);
    if (!selectedSetId) continue;

    const selectedSet = eligibleSets.find((s) => s.id === selectedSetId);
    if (!selectedSet) continue;

    const piecesPerChest = selectedSet.piecesPerChest;

    // Find which pieces the player already has for this set
    const existingPieces = await db.skinPiece.findMany({
      where: { playerId, skinSetId: selectedSet.id },
      select: { pieceIndex: true },
    });
    const existingIndices = new Set(existingPieces.map((p) => p.pieceIndex));

    // Determine which new piece indices to create
    const availableIndices: number[] = [];
    for (let i = 0; i < selectedSet.totalPieces; i++) {
      if (!existingIndices.has(i)) {
        availableIndices.push(i);
      }
    }

    // Shuffle and pick up to piecesPerChest new pieces
    const shuffled = availableIndices.sort(() => Math.random() - 0.5);
    const toCreate = shuffled.slice(0, piecesPerChest);

    if (toCreate.length === 0) continue; // set already fully collected

    // Create the piece records
    const created = await db.skinPiece.createMany({
      data: toCreate.map((idx) => ({
        playerId,
        skinSetId: selectedSet.id,
        pieceIndex: idx,
        totalPieces: selectedSet.totalPieces,
        rarity: selectedSet.rewardRarity,
        source: 'level_chest',
        obtainedAt: now,
      })),
    });

    if (created.count > 0) {
      // Check if this set is now complete
      const totalCollected = existingIndices.size + toCreate.length;
      if (totalCollected >= selectedSet.totalPieces) {
        newCompleted.push(selectedSet.id);
      }
    }
  }

  // Fetch all pieces created in this session for the response
  const pieces = await db.skinPiece.findMany({
    where: {
      playerId,
      obtainedAt: now,
    },
    orderBy: [{ skinSetId: 'asc' }, { pieceIndex: 'asc' }],
  });

  return NextResponse.json({ pieces, newCompleted });
}
