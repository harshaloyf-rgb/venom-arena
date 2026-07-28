import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { CHIP_PACKS } from '@/lib/game-config';

// POST /api/chips/pack  — "buy" a chip pack (simulated payment, credits chips)
// body: { packId: string }
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pack = CHIP_PACKS.find((p) => p.id === body.packId);
  if (!pack) return NextResponse.json({ error: 'Invalid pack.' }, { status: 400 });

  const player = await db.player.findUnique({ where: { id: session.playerId } });
  if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

  const totalChips = pack.chips + pack.bonus;

  const [updated] = await db.$transaction([
    db.player.update({
      where: { id: player.id },
      data: {
        bankedChips: { increment: totalChips },
        totalEarned: { increment: totalChips },
      },
    }),
    db.purchase.create({
      data: {
        playerId: player.id,
        itemId: pack.id,
        itemType: 'chip_pack',
        amountChips: totalChips,
      },
    }),
  ]);

  return NextResponse.json({ player: toProfile(updated), granted: totalChips });
}
