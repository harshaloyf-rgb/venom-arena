import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// ── Word filter for prohibited / obscene content ──
const BANNED_WORDS = [
  // Common profanity (English)
  'fuck', 'shit', 'asshole', 'bitch', 'dick', 'pussy', 'bastard', 'crap',
  'damn', 'whore', 'slut', 'nigger', 'nigga', 'fag', 'faggot', 'retard',
  'retarded', 'motherfucker', 'cock', 'cum', 'rape', 'porn', 'hentai',
  // Hindi/Hinglish profanity
  'chutiya', 'chod', 'chut', 'gaand', 'gandu', 'bhenchod', 'madarchod',
  'laude', 'lavde', 'randi', 'bsdk', 'mc', 'bc', 'bkc', 'lodu',
  // Off-topic / spam patterns
  'http://' , 'https://', // in title (URLs belong in the URL field)
];

function containsBannedWords(text: string): boolean {
  const lower = text.toLowerCase().trim();
  for (const word of BANNED_WORDS) {
    // Check word boundary to avoid false positives (e.g. "classic" should not match "ass")
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lower)) return true;
  }
  return false;
}

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

// GET /api/clips?limit=20&offset=0&player=USERTAG&type=match-card|user-clip
// Public: only APPROVED clips. Own player + ?pending=true shows their pending too.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 30, 1), 100);
  const offset = Math.max(Number(sp.get('offset')) || 0, 0);
  const playerTag = sp.get('player') || undefined;
  const cardType = sp.get('type') || undefined;
  const showPending = sp.get('pending') === 'true'; // for uploaders to see their own pending

  const session = await getSession();

  const where: Record<string, unknown> = {};

  // Filter by status: public sees only approved; own player can see their pending too
  if (showPending && playerTag && session) {
    const p = await db.player.findUnique({ where: { userTag: playerTag }, select: { id: true } });
    if (!p) return NextResponse.json({ clips: [], total: 0 });
    where.playerId = p.id;
    // Don't add status filter — show all their clips
  } else {
    // Public: only approved
    where.status = 'approved';
  }

  if (playerTag && !showPending) {
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
    return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
  }

  // Title length limits
  if (title.length < 5) {
    return NextResponse.json({ error: 'Title must be at least 5 characters.' }, { status: 400 });
  }
  if (title.length > 120) {
    return NextResponse.json({ error: 'Title must be under 120 characters.' }, { status: 400 });
  }

  // Description length limit
  if (description && description.length > 300) {
    return NextResponse.json({ error: 'Description must be under 300 characters.' }, { status: 400 });
  }

  // ── Word filter ──
  const combinedText = `${title} ${description || ''}`;
  if (containsBannedWords(combinedText)) {
    return NextResponse.json({
      error: 'Your title or description contains prohibited language. Please keep it clean and gameplay-focused.',
    }, { status: 400 });
  }

  // For user-clip, url is required.
  const isMatchCard = body.cardType === 'match-card';
  if (!isMatchCard && !url) {
    return NextResponse.json({ error: 'Video URL is required for clips.' }, { status: 400 });
  }
  if (!isMatchCard && typeof url === 'string' && !url.startsWith('http')) {
    return NextResponse.json({ error: 'URL must start with http.' }, { status: 400 });
  }

  // Auto-extract thumbnail from YouTube
  let thumbnailUrl: string | null = body.thumbnailUrl || null;
  if (!thumbnailUrl && url) {
    const lowerPlatform = (platform || '').toLowerCase();
    if (lowerPlatform === 'youtube') {
      thumbnailUrl = extractYoutubeThumbnail(url);
    }
  }

  // Match-cards are auto-approved (system-generated, always clean).
  // User clips start as "pending" — admin must approve before public visibility.
  const clipStatus = isMatchCard ? 'approved' : 'pending';

  const clip = await db.clip.create({
    data: {
      playerId: session.playerId,
      title: title.trim(),
      description: (description || '').trim(),
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
      status: clipStatus,
    },
  });

  return NextResponse.json({
    ok: true,
    id: clip.id,
    status: clipStatus,
    message: clipStatus === 'pending'
      ? 'Your clip is submitted for review. It will appear in the Highlights feed once approved.'
      : 'Clip published!',
  });
}
