import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile, encodeSkins } from '@/lib/player-helpers';
import { PASS_FREE_COSMETICS, PASS_ELITE_COSMETICS, PASS_TIER_XP, PASS_FREE_CHIP_REWARDS, PASS_ELITE_CHIP_REWARDS } from '@/lib/game-config';

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

  // Resolve the cosmetic for this tier (may be null for chip-only tiers)
  const cosmetic = track === 'free'
    ? PASS_FREE_COSMETICS[tier - 1]
    : PASS_ELITE_COSMETICS[tier - 1];

  const requiredXp = PASS_TIER_XP[tier - 1];
  const chipReward = track === 'free'
    ? PASS_FREE_CHIP_REWARDS[tier - 1]
    : PASS_ELITE_CHIP_REWARDS[tier - 1];

  // Validate: tier must have something to claim
  if (!cosmetic && chipReward === 0) {
    return NextResponse.json({ error: 'No reward available for this tier.' }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!player) throw new Error('PLAYER_NOT_FOUND');

      // Check pass XP requirement
      if (player.passXp < requiredXp) {
        throw new Error('XP_TOO_LOW');
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

      // Build update data
      const data: Record<string, unknown> = {
        [claimedField]: JSON.stringify([...claimed, tier]),
      };

      // Add cosmetic to unlockedSkins
      if (cosmetic) {
        let unlocked: string[] = [];
        try {
          unlocked = JSON.parse(player.unlockedSkins || '[]');
          if (!Array.isArray(unlocked)) unlocked = [];
        } catch { unlocked = []; }

        if (!unlocked.includes(cosmetic.id)) {
          unlocked.push(cosmetic.id);
        }
        data.unlockedSkins = encodeSkins(unlocked);

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

        // Record purchase (cost 0 — earned from pass)
        await tx.purchase.create({
          data: {
            playerId: player.id,
            itemId: cosmetic.id,
            itemType: 'pass-cosmetic',
            amountChips: 0,
          },
        });
      }

      // Award chip reward
      if (chipReward > 0) {
        data.bankedChips = { increment: chipReward };
        data.totalEarned = { increment: chipReward };
        await tx.purchase.create({
          data: {
            playerId: player.id,
            itemId: `pass-chip-${track}-t${tier}`,
            itemType: 'pass-chip',
            amountChips: chipReward,
          },
        });
      }

      const updated = await tx.player.update({
        where: { id: player.id },
        data,
      });

      return updated;
    });

    return NextResponse.json({
      player: toProfile(result),
      cosmetic: cosmetic ?? null,
      chipReward,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Player not found.', status: 404 },
      XP_TOO_LOW: { error: `Earn ${requiredXp.toLocaleString()} Pass XP to unlock this tier.`, status: 400 },
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
