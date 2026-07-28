import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile, encodeSkins } from '@/lib/player-helpers';
import { getCosmeticById } from '@/lib/game-config';

// POST /api/player/cosmetic
// body: { action: 'buy' | 'equip', skinId: string }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const skinId = String(body.skinId || '');
  const cosmetic = getCosmeticById(skinId);
  if (!cosmetic) return NextResponse.json({ error: 'Cosmetic not found.' }, { status: 404 });

  const player = await db.player.findUnique({ where: { id: session.playerId } });
  if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

  let unlocked: string[] = (() => {
    try { return JSON.parse(player.unlockedSkins || '[]') as string[]; } catch { return []; }
  })();

  if (action === 'buy') {
    if (unlocked.includes(skinId)) {
      return NextResponse.json({ error: 'Already owned.' }, { status: 400 });
    }
    if (player.bankedChips < cosmetic.cost) {
      return NextResponse.json({ error: 'Not enough chips.' }, { status: 400 });
    }
    // Atomic transaction: deduct chips, unlock skin, record purchase, equip it
    const [updated] = await db.$transaction([
      db.player.update({
        where: { id: player.id },
        data: {
          bankedChips: { decrement: cosmetic.cost },
          totalLost: { increment: cosmetic.cost },
          unlockedSkins: encodeSkins([...unlocked, skinId]),
          // equip the freshly purchased item
          ...(cosmetic.type === 'skin' ? { currentSkin: skinId } : {}),
          ...(cosmetic.type === 'trail' ? { currentTrail: skinId } : {}),
          ...(cosmetic.type === 'death' ? { currentDeath: skinId } : {}),
          ...(cosmetic.type === 'flag' ? { currentFlag: skinId } : {}),
          ...(cosmetic.type === 'banner' ? { currentBanner: skinId } : {}),
        },
      }),
      db.purchase.create({
        data: {
          playerId: player.id,
          itemId: skinId,
          itemType: 'skin',
          amountChips: -cosmetic.cost,
        },
      }),
    ]);
    return NextResponse.json({ player: toProfile(updated) });
  }

  if (action === 'equip') {
    if (!unlocked.includes(skinId)) {
      return NextResponse.json({ error: 'You do not own this item.' }, { status: 403 });
    }
    const data: Record<string, string | null> = {};
    if (cosmetic.type === 'skin') data.currentSkin = skinId;
    if (cosmetic.type === 'trail') data.currentTrail = skinId;
    if (cosmetic.type === 'death') data.currentDeath = skinId;
    if (cosmetic.type === 'flag') data.currentFlag = skinId;
    if (cosmetic.type === 'banner') data.currentBanner = skinId;
    const updated = await db.player.update({
      where: { id: player.id },
      data,
    });
    return NextResponse.json({ player: toProfile(updated) });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
