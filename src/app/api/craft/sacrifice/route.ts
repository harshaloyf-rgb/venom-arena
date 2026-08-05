import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

// Run: bun run db:push

const sacrificeSchema = z.object({
  setId: z.string().min(1),
});

// Possible skins per rarity (server-side pool for sacrifice results)
// In a full implementation, this would come from a skin registry
const RARITY_SKIN_POOL: Record<string, string[]> = {
  common: [
    'skin-forest-viper', 'skin-desert-cobra', 'skin-arctic-python',
    'skin-swamp-moccasin', 'skin-coral-snake', 'skin-garden-serpent',
  ],
  rare: [
    'skin-phoenix-striker', 'skin-thunder-serpent', 'skin-frost-viper',
    'skin-shadow-cobra', 'skin-crystal-python',
  ],
  epic: [
    'skin-neon-venom', 'skin-plasma-king', 'skin-spectral-fang',
  ],
  legendary: [
    'skin-void-emperor', 'skin-cosmic-leviathan',
  ],
};

const RARITY_SKIN_NAMES: Record<string, string[]> = {
  common: ['Forest Viper', 'Desert Cobra', 'Arctic Python', 'Swamp Moccasin', 'Coral Snake', 'Garden Serpent'],
  rare: ['Phoenix Striker', 'Thunder Serpent', 'Frost Viper', 'Shadow Cobra', 'Crystal Python'],
  epic: ['Neon Venom', 'Plasma King', 'Spectral Fang'],
  legendary: ['Void Emperor', 'Cosmic Leviathan'],
};

/** Determine the result rarity based on sacrificed set's rewardRarity */
function determineResultRarity(sacrificedRarity: string): string {
  // Same rarity or one tier higher with small chance
  const tiers = ['common', 'rare', 'epic', 'legendary'];
  const idx = tiers.indexOf(sacrificedRarity);

  if (idx === -1 || idx >= tiers.length - 1) return sacrificedRarity;

  // 15% chance to upgrade one tier
  if (Math.random() < 0.15) {
    return tiers[idx + 1];
  }
  return sacrificedRarity;
}

// ---------------------------------------------------------------------------
// POST handler — sacrifice a completed collection set for a random skin
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const playerId = session.playerId;

  // Validate input
  let body: { setId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = sacrificeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing or invalid setId.' }, { status: 400 });
  }

  const { setId } = parsed.data;

  // Verify the set exists
  const collectionSet = await db.collectionSet.findUnique({
    where: { id: setId },
  });
  if (!collectionSet) {
    return NextResponse.json({ error: 'Collection set not found.' }, { status: 404 });
  }

  // Verify the player has all pieces (completed the set)
  const collectedCount = await db.skinPiece.count({
    where: { playerId, skinSetId: setId },
  });

  if (collectedCount < collectionSet.totalPieces) {
    return NextResponse.json(
      { error: `Set not complete. Need ${collectionSet.totalPieces} pieces, have ${collectedCount}.` },
      { status: 400 },
    );
  }

  // Determine result rarity and skin
  const resultRarity = determineResultRarity(collectionSet.rewardRarity);
  const pool = RARITY_SKIN_POOL[resultRarity] || RARITY_SKIN_POOL.common;
  const namePool = RARITY_SKIN_NAMES[resultRarity] || RARITY_SKIN_NAMES.common;
  const skinIndex = Math.floor(Math.random() * pool.length);
  const unlockedSkinId = pool[skinIndex];
  const unlockedSkinName = namePool[skinIndex];

  // Execute sacrifice in a transaction
  const transaction = await db.$transaction(async (tx) => {
    // Delete all skin pieces for this set
    await tx.skinPiece.deleteMany({
      where: { playerId, skinSetId: setId },
    });

    // Add skin to player's unlocked skins
    const player = await tx.player.findUnique({
      where: { id: playerId },
      select: { unlockedSkins: true },
    });

    if (player) {
      const currentSkins: string[] = JSON.parse(player.unlockedSkins || '[]');
      if (!currentSkins.includes(unlockedSkinId)) {
        currentSkins.push(unlockedSkinId);
        await tx.player.update({
          where: { id: playerId },
          data: { unlockedSkins: JSON.stringify(currentSkins) },
        });
      }
    }

    // Create crafting transaction record
    const txn = await tx.craftingTransaction.create({
      data: {
        playerId,
        sacrificedSetId: setId,
        resultSkinId: unlockedSkinId,
        resultRarity,
        resultSkinName: unlockedSkinName,
        timestamp: Date.now(),
      },
    });

    return txn;
  });

  return NextResponse.json({
    transaction,
    unlockedSkinId,
    unlockedSkinName,
  });
}
