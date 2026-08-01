import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/clips?limit=20&offset=0&featured=true&player=USERTAG
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 20, 1), 100);
  const offset = Math.max(Number(sp.get('offset')) || 0, 0);
  const featured = sp.get('featured') === 'true';
  const playerTag = sp.get('player') || undefined;

  const where: any = {};
  if (featured) where.featured = true;
  if (playerTag) {
    const p = await db.player.findUnique({ where: { userTag: playerTag }, select: { id: true } });
    if (!p) return NextResponse.json({ clips: [], total: 0 });
    where.playerId = p.id;
  }

  const [clips, total] = await Promise.all([
    db.clip.findMany({
      where,
      orderBy: featured
        ? [{ createdAt: 'desc' }]
        : [{ upvotes: 'desc' }, { createdAt: 'desc' }],
      skip: offset,
      take: limit,
      include: {
        player: { select: { name: true, userTag: true, country: true, level: true } },
      },
    }),
    db.clip.count({ where }),
  ]);

  return NextResponse.json({
    clips: clips.map((c) => ({
      ...c,
      tags: JSON.parse(c.tags),
      player: c.player,
    })),
    total,
  });
}

// POST /api/clips — submit a new clip
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, platform, url, description, chipsExtracted, kills, arenaName, tags, matchId } = body;

  if (!title || !url) {
    return NextResponse.json({ error: 'title and url are required' }, { status: 400 });
  }
  if (typeof url !== 'string' || !url.startsWith('http')) {
    return NextResponse.json({ error: 'url must start with http' }, { status: 400 });
  }

  const clip = await db.clip.create({
    data: {
      playerId: session.playerId,
      title,
      description: description || '',
      platform: platform || 'other',
      url,
      thumbnailUrl: body.thumbnailUrl || null,
      chipsExtracted: chipsExtracted || 0,
      kills: kills || 0,
      arenaName: arenaName || '',
      tags: Array.isArray(tags) ? JSON.stringify(tags) : '[]',
      matchId: matchId || null,
    },
  });

  return NextResponse.json({ ok: true, id: clip.id });
}
