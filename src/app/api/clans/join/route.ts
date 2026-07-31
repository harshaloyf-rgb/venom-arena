import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/join  body: { tag }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim();

  try {
    await db.$transaction(async (tx) => {
      const clan = await tx.clan.findUnique({ where: { tag }, include: { _count: { select: { members: true } } } });
      if (!clan) throw new Error('CLAN_NOT_FOUND');
      if (clan._count.members >= 30) throw new Error('CLAN_FULL');

      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');
      if (me.clanTag) throw new Error('ALREADY_IN_CLAN');

      await tx.player.update({ where: { id: me.id }, data: { clanTag: tag, clanRank: 'Viper' } });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      CLAN_NOT_FOUND: { error: 'Clan not found.', status: 404 },
      CLAN_FULL: { error: 'Clan is full (max 30).', status: 400 },
      PLAYER_NOT_FOUND: { error: 'Not found', status: 404 },
      ALREADY_IN_CLAN: { error: 'Leave your current clan first.', status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/join] error', e);
    return NextResponse.json({ error: 'Failed to join clan.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
