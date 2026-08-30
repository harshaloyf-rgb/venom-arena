import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';

// POST /api/player/current-skin
// body: { skinId: string }
// Lightweight endpoint to set player.currentSkin without ownership/cost checks.
// Used by free skins (presets, custom-lab) that aren't in the cosmetics catalog.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const skinId = String(body.skinId || '').trim();
  if (!skinId || skinId.length > 100) {
    return NextResponse.json({ error: 'Invalid skin ID.' }, { status: 400 });
  }

  try {
    const updated = await db.player.update({
      where: { id: session.playerId },
      data: { currentSkin: skinId },
    });
    return NextResponse.json({ player: toProfile(updated) });
  } catch (e) {
    console.error('[current-skin] error', e);
    return NextResponse.json({ error: 'Failed to update skin.' }, { status: 500 });
  }
}
