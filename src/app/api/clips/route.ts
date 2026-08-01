import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// ── YouTube thumbnail extraction (no API key needed) ──
function extractYoutubeThumbnail(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId = '';
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      videoId = u.searchParams.get('v')!;
    } else if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1).split('/')[0];
    }
    if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  } catch {}
  return null;
}

// ── Instagram post thumbnail (og image, best-effort) ──
function extractInstagramThumbnail(url: string): string | null {
  // Instagram doesn't have a simple thumbnail API like YouTube.
  // We return null and let the frontend show a styled card instead.
  return null;
}

// GET /api/clips?limit=20&offset=0&player=USERTAG&type=match-card|user-clip
// No auth required for browsing — this is public marketing content
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 30, 1), 100);
  const offset = Math.max(Number(sp.get('offset')) || 0, 0);
  const playerTag = sp.get('player') || undefined;
  const cardType = sp.get('type') || undefined; // "match-card" | "user-clip"

  const where: Record<string, unknown> = {};
  if (playerTag) {
    const p = await db.player.findUnique({ where: { userTag: playerTag }, select: { id: true } });
    if (!p) return NextResponse.json({ clips: [], total: 0 });
    where.playerId = p.id;
  }
  if (cardType && (cardType === 'match-card' || cardType === 'user-clip')) {
    where.cardType = cardType;
  }

  const [clips, total] = await Promise.all([
    db.clip.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: offset,
      take: limit,
      include: {
        player: { select: { name: true, userTag: true, country: true, level: true, clanTag: true } },
      },
    }),
    db.clip.count({ where }),
  ]);

  return NextResponse.json({
    clips: clips.map((c) => ({
      ...c,
      tags: JSON.parse(c.tags),
      matchData: c.matchData ? JSON.parse(c.matchData) : null,
      player: c.player,
    })),
    total,
  });
}

// POST /api/clips — submit a new clip (auth required)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, platform, url, description, chipsExtracted, kills, arenaName, tags, matchId } = body;

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  // For user-clip, url is required. For match-card, url is optional.
  const isMatchCard = body.cardType === 'match-card';
  if (!isMatchCard && !url) {
    return NextResponse.json({ error: 'url is required for video clips' }, { status: 400 });
  }
  if (!isMatchCard && typeof url !== 'string' && !url.startsWith('http')) {
    return NextResponse.json({ error: 'url must start with http' }, { status: 400 });
  }

  // Auto-extract thumbnail from YouTube/Instagram
  let thumbnailUrl: string | null = body.thumbnailUrl || null;
  if (!thumbnailUrl && url) {
    const lowerPlatform = (platform || '').toLowerCase();
    if (lowerPlatform === 'youtube') {
      thumbnailUrl = extractYoutubeThumbnail(url);
    } else if (lowerPlatform === 'instagram') {
      thumbnailUrl = extractInstagramThumbnail(url);
    }
  }

  const clip = await db.clip.create({
    data: {
      playerId: session.playerId,
      title,
      description: description || '',
      platform: platform || 'other',
      url: url || '',
      thumbnailUrl,
      chipsExtracted: chipsExtracted || 0,
      kills: kills || 0,
      arenaName: arenaName || '',
      tags: Array.isArray(tags) ? JSON.stringify(tags) : '[]',
      matchId: matchId || null,
      cardType: isMatchCard ? 'match-card' : 'user-clip',
      matchData: body.matchData ? JSON.stringify(body.matchData) : null,
    },
  });

  return NextResponse.json({ ok: true, id: clip.id });
}
