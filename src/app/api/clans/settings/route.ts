import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/settings  body: { tag, name?, description?, emblem? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim();
  const name = body.name !== undefined ? String(body.name).trim().slice(0, 30) : undefined;
  const description = body.description !== undefined ? String(body.description).trim().slice(0, 200) : undefined;
  const emblem = body.emblem !== undefined ? String(body.emblem).slice(0, 4).replace(/[\x00-\x1F\u200B-\u200D\uFEFF]/g, '') : undefined;

  if (!tag) return NextResponse.json({ error: 'Missing clan tag.' }, { status: 400 });

  // At least one field must be provided
  if (name === undefined && description === undefined && emblem === undefined) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }

  try {
    const me = await db.player.findUnique({ where: { id: session.playerId } });
    if (!me || !me.clanTag) return NextResponse.json({ error: 'Not in a clan.' }, { status: 400 });
    if (me.clanTag !== tag) return NextResponse.json({ error: 'Not your clan.' }, { status: 403 });
    if (me.clanRank !== 'Leader') return NextResponse.json({ error: 'Only the Leader can edit clan settings.' }, { status: 403 });

    if (name !== undefined && name.length < 3) {
      return NextResponse.json({ error: 'Name must be at least 3 characters.' }, { status: 400 });
    }

    const data: Record<string, string> = {};
    if (name !== undefined && name.length >= 3) data.name = name;
    if (description !== undefined) data.description = description;
    if (emblem !== undefined && emblem.length > 0) data.emblem = emblem;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    await db.clan.update({ where: { tag }, data });

    await db.clanActivity.create({
      data: {
        clanTag: tag,
        type: 'settings',
        actorTag: me.userTag,
        actorName: me.name,
        detail: `updated clan settings`,
      },
    });
  } catch (e) {
    console.error('[clans/settings] error', e);
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
