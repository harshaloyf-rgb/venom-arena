import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile, encodeSkins } from '@/lib/player-helpers';
import { PASS_FREE_COSMETICS, PASS_ELITE_COSMETICS, PASS_TIER_LEVEL } from '@/lib/game-config';

// POST /api/season-pass/claim-all
// body: { track: 'free' | 'elite' }
// Claims all unclaimed tiers for the given track in a single transaction.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const track = String(body.track || '');

  if (!['free', 'elite'].includes(track)) {
    return NextResponse.json({ error: 'Invalid track. Use "free" or "elite".' }, { status: 400 });
  }

  const cosmetics = track === 'free' ? PASS_FREE_COSMETICS : PASS_ELITE_COSMETICS;

  try {
    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!player) throw new Error('PLAYER_NOT_FOUND');
      if (track === 'elite' && !player.hasElitePass) throw new Error('NO_ELITE');

      const claimedField = track === 'free' ? 'passClaimedFree' : 'passClaimedElite';
      let claimed: number[] = [];
      try { claimed = JSON.parse(player[claimedField] || '[]'); if (!Array.isArray(claimed)) claimed = []; } catch { claimed = []; }

      let unlocked: string[] = [];
      try { unlocked = JSON.parse(player.unlockedSkins || '[]'); if (!Array.isArray(unlocked)) unlocked = []; } catch { unlocked = []; }

      const claimedSet = new Set(claimed);
      const newlyClaimed: number[] = [];
      const newCosmetics: typeof cosmetics = [];

      for (let i = 0; i < 20; i++) {
        const tier = i + 1;
        const cosmetic = cosmetics[i];
        if (!cosmetic) continue;
        if (claimedSet.has(tier)) continue;
        if (player.level < PASS_TIER_LEVEL[i]) continue;

        newlyClaimed.push(tier);
        newCosmetics.push(cosmetic);
        if (!unlocked.includes(cosmetic.id)) unlocked.push(cosmetic.id);

        await tx.purchase.create({
          data: { playerId: player.id, itemId: cosmetic.id, itemType: 'pass-cosmetic', amountChips: 0 },
        });
      }

      if (newlyClaimed.length === 0) throw new Error('NOTHING_TO_CLAIM');

      const updated = await tx.player.update({
        where: { id: player.id },
        data: { unlockedSkins: encodeSkins(unlocked), [claimedField]: JSON.stringify([...claimed, ...newlyClaimed]) },
      });

      return { updated, newlyClaimed, newCosmetics };
    });

    return NextResponse.json({ player: toProfile(result.updated), claimed: result.newlyClaimed, cosmetics: result.newCosmetics });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Player not found.', status: 404 },
      NO_ELITE: { error: 'Unlock the Elite Pass to claim premium rewards.', status: 403 },
      NOTHING_TO_CLAIM: { error: 'No new rewards to claim.', status: 400 },
    };
    if (msg in errorMap) { const { error, status } = errorMap[msg]; return NextResponse.json({ error }, { status }); }
    console.error('[season-pass/claim-all] error', e);
    return NextResponse.json({ error: 'Failed to claim rewards.' }, { status: 500 });
  }
}
