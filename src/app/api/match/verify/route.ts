import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { getCosmeticById } from '@/lib/game-config';

// POST /api/match/verify
// Internal endpoint called by the Socket.IO server on socket connection.
// Validates the user's JWT (passed from the client via socket auth) and returns
// the player's spawn-safe profile.
//
// body: { token: string }
// returns: { ok: boolean, player?: {...} }
export async function POST(req: NextRequest) {
  try {
    const internalSecret = req.headers.get('x-internal-secret');
    const expected = process.env.INTERNAL_SECRET;
    if (!expected) throw new Error('INTERNAL_SECRET env var is required');
    if (internalSecret !== expected) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '');
    const session = verifySession(token);
    if (!session) return NextResponse.json({ ok: false, reason: 'invalid_token' });

    const p = await db.player.findUnique({ where: { id: session.playerId } });
    if (!p) return NextResponse.json({ ok: false, reason: 'player_not_found' });
    if (p.banned) return NextResponse.json({ ok: false, reason: 'banned' });

    let unlocked: string[] = [];
    try { unlocked = JSON.parse(p.unlockedSkins || '[]') as string[]; } catch {}

    const skin = getCosmeticById(p.currentSkin);

    // Determine rarity from the cosmetic skin's cost, or from the skin ID.
    // Preset skins (preset-*) and custom-lab-skin don't exist in the cosmetics DB,
    // so their color/rarity are resolved client-side. The server only needs the
    // skinId so the client can look up the correct local skin asset.
    let skinId = p.currentSkin || 'skin-default';
    let rarity = 'common';
    if (skin) {
      // Cosmetic skin — use its color/rarity
      if (skin.cost <= 200) rarity = 'common';
      else if (skin.cost <= 500) rarity = 'rare';
      else if (skin.cost <= 1000) rarity = 'epic';
      else rarity = 'legendary';
    } else if (skinId.startsWith('preset-')) {
      // Preset skin — colors resolved client-side from SLITHER_PRESETS
      rarity = 'common';
    } else if (skinId === 'custom-lab-skin') {
      // Custom lab skin — colors resolved client-side from localStorage
      rarity = 'rare';
    }

    return NextResponse.json({
      ok: true,
      player: {
        id: p.id,
        userTag: p.userTag,
        name: p.name,
        country: p.country,
        level: p.level,
        bankedChips: p.bankedChips,
        currentSkin: p.currentSkin,
        currentTrail: p.currentTrail,
        currentDeath: p.currentDeath,
        currentFlag: p.currentFlag,
        color: skin?.color || '#22c55e',
        secondaryColor: skin?.secondaryColor,
        skinId,
        rarity,
        pattern: skin?.pattern,
        unlockedSkins: unlocked,
        clanTag: p.clanTag,
        clanRank: p.clanRank,
        role: p.role,
      },
    });
  } catch (e) {
    console.error('[match/verify] error', e);
    return NextResponse.json({ ok: false, reason: 'server_error' });
  }
}
