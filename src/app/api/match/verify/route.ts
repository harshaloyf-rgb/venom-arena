import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { getCosmeticById } from '@/lib/game-config';
import { SKIN_PRESETS, resolveLegacySkinId } from '@/components/panels/cosmetics/cosmetics-types';
import { verifyInternalSecret } from '@/lib/api-helpers';

// POST /api/match/verify
// Internal endpoint called by the Socket.IO server on socket connection.
// Validates the user's JWT (passed from the client via socket auth) and returns
// the player's spawn-safe profile.
//
// body: { token: string }
// returns: { ok: boolean, player?: {...} }
export async function POST(req: NextRequest) {
  try {
    if (!verifyInternalSecret(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '');
    const session = verifySession(token);
    if (!session) return NextResponse.json({ ok: false, reason: 'invalid_token' });

    // Scope check (audit A2): accept only session- or game-scoped tokens.
    // (Both are signed by us; anything lacking scope is legacy pre-hardening.)
    if (session.scope !== 'game' && session.scope !== 'session') {
      return NextResponse.json({ ok: false, reason: 'invalid_token' });
    }

    const p = await db.player.findUnique({ where: { id: session.playerId } });
    if (!p) return NextResponse.json({ ok: false, reason: 'player_not_found' });
    if (p.banned) return NextResponse.json({ ok: false, reason: 'banned' });

    // Revocation (audit A1 follow-through): reject tokens whose tokenVersion
    // predates a password change / account mutation.
    if (session.tokenVersion === undefined || session.tokenVersion !== p.tokenVersion) {
      return NextResponse.json({ ok: false, reason: 'invalid_token' });
    }

    let unlocked: string[] = [];
    try { unlocked = JSON.parse(p.unlockedSkins || '[]') as string[]; } catch {}

    const skin = getCosmeticById(p.currentSkin);
    // 2026-09-05: the 13 manufactured originals moved to free SKIN_PRESETS —
    // resolve preset (and legacy aliased) ids too so color/secondaryColor
    // stay truthful for players wearing them.
    const preset = skin
      ? undefined
      : SKIN_PRESETS.find((pr) => pr.id === resolveLegacySkinId(p.currentSkin || ''));

    // Determine rarity — honor the Skin.rarity override first (epic-clean
    // character faces), then fall back to the cost-derived default.
    let skinId = p.currentSkin || 'skin-default';
    let rarity = 'common';
    if (skin) {
      rarity = skin.rarity ?? (
        skin.cost <= 200 ? 'common'
        : skin.cost <= 500 ? 'rare'
        : skin.cost <= 1000 ? 'epic'
        : 'legendary');
    } else if (preset || skinId.startsWith('preset-')) {
      rarity = 'common';
    } else if (skinId === 'custom-lab-skin' || skinId.startsWith('custom-')) {
      rarity = 'rare';
    }

    // Resolve custom skin segment data if the player is using a custom DB skin
    let customSkinData: { id: string; colors: string[]; bodyStyle: string; taperStyle: string; glow: boolean } | null = null;
    if (skinId.startsWith('custom-')) {
      try {
        const customSkins = JSON.parse(p.customSkins || '[]') as any[];
        const found = customSkins.find((s) => s.id === skinId);
        if (found) {
          customSkinData = {
            id: found.id,
            colors: found.colors,
            bodyStyle: found.bodyStyle,
            taperStyle: found.taperStyle,
            glow: found.glow,
          };
        }
      } catch {}
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
        color: skin?.color || preset?.colors[0] || '#22c55e',
        secondaryColor: skin?.secondaryColor ?? (preset ? preset.colors[1] : undefined),
        skinId,
        rarity,
        pattern: skin?.pattern,
        unlockedSkins: unlocked,
        clanTag: p.clanTag,
        clanRank: p.clanRank,
        role: p.role,
        customSkinData,
      },
    });
  } catch (e) {
    console.error('[match/verify] error', e);
    return NextResponse.json({ ok: false, reason: 'server_error' });
  }
}
