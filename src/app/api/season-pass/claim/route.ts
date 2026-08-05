import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile, encodeSkins } from '@/lib/player-helpers';
import { PASS_FREE_COSMETICS, PASS_ELITE_COSMETICS, PASS_TIER_LEVEL } from '@/lib/game-config';

// POST /api/season-pass/claim
// body: { tier: number, track: 'free' | 'elite' }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tier = Math.floor(Number(body.tier) || 0);
  const track = String(body.track || '');

  if (!['free', 'elite'].includes(track)) {
    return NextResponse.json({ error: 'Invalid track. Use "free" or "elite".' }, { status: 400 });
  }
  if (tier < 1 || tier > 20) {
    return NextResponse.json({ error: 'Tier must be between 1 and 20.' }, { status: 400 });
  }

  // Resolve the cosmetic for this tier
  const cosmetic = track === 'free'
    ? PASS_FREE_COSMETICS[tier - 1]
    : PASS_ELITE_COSMETICS[tier - 1];
  if (!cosmetic) {
    return NextResponse.json({ error: 'Cosmetic not found for this tier.' }, { status: 404 });
  }

  const requiredLevel = PASS_TIER_LEVEL[tier - 1];

  try {
    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!player) throw new Error('PLAYER_NOT_FOUND');

      // Check level requirement
      if (player.level < requiredLevel) {
        throw new Error('LEVEL_TOO_LOW');
      }

      // Check elite requirement
      if (track === 'elite' && !player.hasElitePass) {
        throw new Error('NO_ELITE');
      }

      // Parse existing claims
      const claimedField = track === 'free' ? 'passClaimedFree' : 'passClaimedElite';
      let claimed: number[] = [];
      try {
        claimed = JSON.parse(player[claimedField] || '[]');
        if (!Array.isArray(claimed)) claimed = [];
      } catch { claimed = []; }

      if (claimed.includes(tier)) {
        throw new Error('ALREADY_CLAIMED');
      }

      // Parse existing unlocked skins
      let unlocked: string[] = [];
      try {
        unlocked = JSON.parse(player.unlockedSkins || '[]');
        if (!Array.isArray(unlocked)) unlocked = [];
      } catch { unlocked = []; }

      // Add the cosmetic to unlockedSkins
      if (!unlocked.includes(cosmetic.id)) {
        unlocked.push(cosmetic.id);
      }

      // Add tier to claimed
      claimed.push(tier);

      // Build update data
      const data: Record<string, unknown> = {
        unlockedSkins: encodeSkins(unlocked),
        [claimedField]: JSON.stringify(claimed),
      };

      // Auto-equip if player has nothing equipped in that slot
      if (cosmetic.type === 'skin' && player.currentSkin === 'skin-default') {
        data.currentSkin = cosmetic.id;
      } else if (cosmetic.type === 'trail' && player.currentTrail === 'trail-none') {
        data.currentTrail = cosmetic.id;
      } else if (cosmetic.type === 'death' && player.currentDeath === 'death-default') {
        data.currentDeath = cosmetic.id;
      } else if (cosmetic.type === 'flag' && !player.currentFlag) {
        data.currentFlag = cosmetic.id;
      } else if (cosmetic.type === 'banner' && !player.currentBanner) {
        data.currentBanner = cosmetic.id;
      }

      const updated = await tx.player.update({
        where: { id: player.id },
        data,
      });

      // Record purchase (cost 0 — earned from pass)
      await tx.purchase.create({
        data: {
          playerId: player.id,
          itemId: cosmetic.id,
          itemType: 'pass-cosmetic',
          amountChips: 0,
        },
      });

      return updated;
    });

    return NextResponse.json({
      player: toProfile(result),
      cosmetic,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Player not found.', status: 404 },
      LEVEL_TOO_LOW: { error: `Reach Level ${requiredLevel} to unlock this reward.`, status: 400 },
      NO_ELITE: { error: 'Unlock the Elite Pass to claim premium rewards.', status: 403 },
      ALREADY_CLAIMED: { error: 'This reward has already been claimed.', status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[season-pass/claim] error', e);
    return NextResponse.json({ error: 'Failed to claim reward.' }, { status: 500 });
  }
}
