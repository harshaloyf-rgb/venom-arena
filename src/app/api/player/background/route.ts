import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { getBackgroundById } from '@/lib/snake/backgrounds';

// POST /api/player/background
// body: { backgroundId: string }
// Backgrounds are free cosmetics — no ownership check, id validated against
// the theme catalog (same validation pattern as /api/player/cosmetic).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const backgroundId = String(body.backgroundId || '');
  if (!getBackgroundById(backgroundId)) {
    return NextResponse.json({ error: 'Background not found.' }, { status: 404 });
  }

  try {
    const updated = await db.player.update({
      where: { id: session.playerId },
      data: { currentBackground: backgroundId },
    });
    return NextResponse.json({ player: toProfile(updated) });
  } catch (e: unknown) {
    console.error('[background/equip] error', e);
    return NextResponse.json({ error: 'Equip failed.' }, { status: 500 });
  }
}
