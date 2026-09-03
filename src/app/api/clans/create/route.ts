import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth';

// POST /api/clans/create  body: { tag, name, emblem, description }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const tag = String(body.tag || '').toUpperCase().trim().slice(0, 5);
    const name = String(body.name || '').trim().slice(0, 30);
    const emblem = String(body.emblem || '\uD83D\uDC0D').slice(0, 4).replace(/[\x00-\x1F\u200B-\u200D\uFEFF]/g, '');
    const description = String(body.description || '').slice(0, 200);

    if (!/^[A-Z0-9]{3,5}$/.test(tag)) {
      return NextResponse.json({ error: 'Tag must be 3-5 letters/numbers.' }, { status: 400 });
    }
    if (name.length < 3) {
      return NextResponse.json({ error: 'Name must be at least 3 characters.' }, { status: 400 });
    }

    const me = await db.player.findUnique({ where: { id: session.playerId } });
    if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (me.clanTag) return NextResponse.json({ error: 'You are already in a clan.' }, { status: 400 });

    const existing = await db.clan.findUnique({ where: { tag } });
    if (existing) return NextResponse.json({ error: 'Tag already taken.' }, { status: 409 });

    // Create clan + make player the Leader + log activity, atomically
    await db.$transaction([
      db.clan.create({ data: { tag, name, emblem, description } }),
      db.player.update({ where: { id: me.id }, data: { clanTag: tag, clanRank: 'Leader' } }),
      db.clanActivity.create({
        data: {
          clanTag: tag,
          type: 'create',
          actorTag: me.userTag,
          actorName: me.name,
          detail: `founded the syndicate`,
        },
      }),
    ]);
    return NextResponse.json({ ok: true, clanTag: tag });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Tag already taken.' }, { status: 409 });
    }
    console.error('[clans/create] error', e);
    return NextResponse.json({ error: 'Failed to create clan.' }, { status: 500 });
  }
}
