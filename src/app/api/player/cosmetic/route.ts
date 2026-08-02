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

  if (action === 'buy') {
    try {
      const result = await db.$transaction(async (tx) => {
        const player = await tx.player.findUnique({ where: { id: session.playerId } });
        if (!player) throw new Error('PLAYER_NOT_FOUND');

        let unlocked: string[] = (() => {
          try { return JSON.parse(player.unlockedSkins || '[]') as string[]; } catch { return []; }
        })();

        if (unlocked.includes(skinId)) {
          throw new Error('ALREADY_OWNED');
        }
        if (player.bankedChips < cosmetic.cost) {
          throw new Error('NOT_ENOUGH_CHIPS');
        }

        // Atomic: deduct chips, unlock skin, record purchase, equip it
        const updated = await tx.player.update({
          where: { id: player.id },
          data: {
            bankedChips: { decrement: cosmetic.cost },
            unlockedSkins: encodeSkins([...unlocked, skinId]),
            // equip the freshly purchased item
            ...(cosmetic.type === 'skin' ? { currentSkin: skinId } : {}),
            ...(cosmetic.type === 'trail' ? { currentTrail: skinId } : {}),
            ...(cosmetic.type === 'death' ? { currentDeath: skinId } : {}),
            ...(cosmetic.type === 'flag' ? { currentFlag: skinId } : {}),
            ...(cosmetic.type === 'banner' ? { currentBanner: skinId } : {}),
          },
        });
        await tx.purchase.create({
          data: {
            playerId: player.id,
            itemId: skinId,
            itemType: 'skin',
            amountChips: -cosmetic.cost,
          },
        });
        return updated;
      });

      return NextResponse.json({ player: toProfile(result) });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const errorMap: Record<string, { error: string; status: number }> = {
        PLAYER_NOT_FOUND: { error: 'Player not found.', status: 404 },
        ALREADY_OWNED: { error: 'Already owned.', status: 400 },
        NOT_ENOUGH_CHIPS: { error: 'Not enough chips.', status: 400 },
      };
      if (msg in errorMap) {
        const { error, status } = errorMap[msg];
        return NextResponse.json({ error }, { status });
      }
      console.error('[cosmetic/buy] error', e);
      return NextResponse.json({ error: 'Purchase failed.' }, { status: 500 });
    }
  }

  if (action === 'equip') {
    try {
      const result = await db.$transaction(async (tx) => {
        const player = await tx.player.findUnique({ where: { id: session.playerId } });
        if (!player) throw new Error('PLAYER_NOT_FOUND');

        const unlocked = (() => {
          try { return JSON.parse(player.unlockedSkins || '[]') as string[]; } catch { return []; }
        })();
        if (!unlocked.includes(skinId)) {
          throw new Error('NOT_OWNED');
        }
        const data: Record<string, string | null> = {};
        if (cosmetic.type === 'skin') data.currentSkin = skinId;
        if (cosmetic.type === 'trail') data.currentTrail = skinId;
        if (cosmetic.type === 'death') data.currentDeath = skinId;
        if (cosmetic.type === 'flag') data.currentFlag = skinId;
        if (cosmetic.type === 'banner') data.currentBanner = skinId;
        const updated = await tx.player.update({
          where: { id: player.id },
          data,
        });
        return updated;
      });
      return NextResponse.json({ player: toProfile(result) });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'PLAYER_NOT_FOUND') return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
      if (msg === 'NOT_OWNED') return NextResponse.json({ error: 'You do not own this item.' }, { status: 403 });
      console.error('[cosmetic/equip] error', e);
      return NextResponse.json({ error: 'Equip failed.' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
