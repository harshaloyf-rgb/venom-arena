import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { playerActionLimit } from '@/lib/api-helpers';

// ── URL allowlist (audit X8 — SSRF hardening) ──────────────────────────
// Previously ANY http(s) URL was accepted, then SERVER-FETCHED for Instagram
// thumbnails (SSRF on submit + on read-backfill), with redirects followed.
// Now: https-only, public YouTube/Instagram hosts only, redirects rejected,
// and stored thumbnails must point at public CDN hosts.
const CLIP_URL_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be',
  'instagram.com', 'www.instagram.com',
]);

const THUMBNAIL_HOST_SUFFIXES = ['ytimg.com', 'youtube.com', 'ggpht.com', 'cdninstagram.com', 'fbcdn.net'];

function isPrivateHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    /^127\.|^10\.|^0\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^(::1|f[cd][0-9a-f]{2}:|fe80:)/i.test(hostname)
  );
}

function isAllowedClipUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return CLIP_URL_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isSafeThumbnailUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (isPrivateHost(h)) return false;
    return THUMBNAIL_HOST_SUFFIXES.some((s) => h === s || h.endsWith('.' + s));
  } catch {
    return false;
  }
}

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
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')}\\b`, 'i');
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
    } else if (u.hostname.includes('youtube.com') && u.pathname.includes('/shorts/')) {
      videoId = u.pathname.split('/shorts/')[1]?.split('/')[0] || '';
    }
    if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  } catch {}
  return null;
}

// ── Instagram thumbnail: extract og:image from page HTML ──
async function extractInstagramThumbnail(url: string): Promise<string | null> {
  // Defense in depth: caller validates, but refuse non-allowlisted URLs here too
  if (!isAllowedClipUrl(url)) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'error', // never follow redirects (SSRF via open redirects)
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Match og:image from meta tags
    const match = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);
    if (match?.[1] && isSafeThumbnailUrl(match[1].replace(/&amp;/g, '&'))) return match[1].replace(/&amp;/g, '&');
    // Fallback: try twitter:image
    const twMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["'][^>]*>/i);
    if (twMatch?.[1] && isSafeThumbnailUrl(twMatch[1].replace(/&amp;/g, '&'))) return twMatch[1].replace(/&amp;/g, '&');
  } catch {}
  return null;
}

// ── Auto-detect platform from URL (overrides user selection) ──
function detectPlatform(url: string, userPlatform: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
      if (u.pathname.includes('/shorts/')) return 'YouTube Shorts';
      return 'YouTube';
    }
    if (u.hostname.includes('instagram.com')) return 'Instagram';
  } catch {}
  return userPlatform || 'other';
}

// ── Map frontend platform filter to DB platform values ──
function mapPlatformFilter(frontendPlatform: string): string[] {
  switch (frontendPlatform) {
    case 'youtube': return ['YouTube'];
    case 'youtube-shorts': return ['YouTube Shorts'];
    case 'instagram': return ['Instagram'];
    default: return [];
  }
}

// GET /api/clips?limit=20&offset=0&player=USERTAG&type=match-card|user-clip&platform=youtube|youtube-shorts|instagram&search=query&sort=newest|oldest|upvotes
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 30, 1), 100);
  const offset = Math.max(Number(sp.get('offset')) || 0, 0);
  const playerTag = sp.get('player') || undefined;
  const cardType = sp.get('type') || undefined;
  const platformFilter = sp.get('platform') || undefined;
  const showPending = sp.get('pending') === 'true';
  const search = sp.get('search') || undefined;
  const sort = sp.get('sort') || 'newest';

  const session = await getSession();

  const where: Record<string, unknown> = {};

  if (showPending && playerTag && session) {
    const p = await db.player.findUnique({ where: { userTag: playerTag }, select: { id: true } });
    if (!p) return NextResponse.json({ clips: [], total: 0 });
    where.playerId = p.id;
  } else {
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
  if (platformFilter) {
    const platforms = mapPlatformFilter(platformFilter);
    if (platforms.length > 0) {
      where.platform = { in: platforms };
    }
  }
  if (search && search.trim().length > 0) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q } },
      { player: { name: { contains: q } } },
    ];
  }

  // Sorting
  let orderBy: Record<string, string>[] = [{ createdAt: 'desc' }];
  if (sort === 'oldest') orderBy = [{ createdAt: 'asc' }];
  else if (sort === 'upvotes') orderBy = [{ upvotes: 'desc' }, { createdAt: 'desc' }];

  const [clips, total] = await Promise.all([
    db.clip.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      include: {
        player: { select: { name: true, userTag: true, country: true, level: true, clanTag: true } },
      },
    }),
    db.clip.count({ where }),
  ]);

  // Fetch current user's votes for these clips (if logged in)
  let myVotes: Record<string, string> = {};
  if (session) {
    const votes = await db.clipUpvote.findMany({
      where: { playerId: session.playerId, clipId: { in: clips.map(c => c.id) } },
      select: { clipId: true, voteType: true },
    });
    for (const v of votes) myVotes[v.clipId] = v.voteType;
  }

  // Backfill: for Instagram clips missing thumbnails, try to fetch og:image
  // (only for URLs that pass the allowlist — legacy rows may hold junk URLs).
  // Hardening: cap attempts per request — rows whose og:image never resolves
  // would otherwise be re-fetched by EVERY public GET of this endpoint.
  const backfillPromises = clips
    .filter((c) => !c.thumbnailUrl && c.platform === 'Instagram' && c.url && isAllowedClipUrl(c.url))
    .slice(0, 3)
    .map(async (c) => {
      try {
        const thumb = await extractInstagramThumbnail(c.url);
        if (thumb) {
          await db.clip.update({ where: { id: c.id }, data: { thumbnailUrl: thumb } });
          c.thumbnailUrl = thumb;
        }
      } catch {}
    });
  if (backfillPromises.length > 0) await Promise.all(backfillPromises);

  return NextResponse.json({
    clips: clips.map((c) => ({
      ...c,
      tags: JSON.parse(c.tags),
      matchData: c.matchData ? JSON.parse(c.matchData) : null,
      player: c.player,
      likes: c.upvotes,
      dislikes: c.downvotes,
      myVote: (myVotes[c.id] as 'like' | 'dislike' | null) ?? null,
    })),
    total,
  });
}

// POST /api/clips — submit a new clip (auth required)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Anti-spam (X6): clip submission triggers external fetches — keep it tight
  const rl = playerActionLimit(session.playerId, 'clip-submit', 5, 10 * 60_000);
  if (rl) return rl;

  const body = await req.json();
  const { title, platform, url, description, chipsExtracted, kills, arenaName, tags, matchId } = body;

  if (!title) {
    return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
  }

  if (title.length < 5) {
    return NextResponse.json({ error: 'Title must be at least 5 characters.' }, { status: 400 });
  }
  if (title.length > 120) {
    return NextResponse.json({ error: 'Title must be under 120 characters.' }, { status: 400 });
  }

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

  const isMatchCard = body.cardType === 'match-card';
  if (!isMatchCard && !url) {
    return NextResponse.json({ error: 'Video URL is required for clips.' }, { status: 400 });
  }
  if (!isMatchCard && typeof url === 'string' && !isAllowedClipUrl(url)) {
    return NextResponse.json(
      { error: 'Only public YouTube or Instagram video URLs (https) are allowed.' },
      { status: 400 },
    );
  }

  // Auto-detect platform from URL
  const resolvedPlatform = isMatchCard ? 'match-card' : detectPlatform(url || '', platform || 'other');

  // Auto-extract thumbnail from YouTube (both videos and shorts).
  // Client-supplied thumbnails are only trusted if they point at public CDN hosts.
  let thumbnailUrl: string | null =
    typeof body.thumbnailUrl === 'string' && isSafeThumbnailUrl(body.thumbnailUrl) ? body.thumbnailUrl : null;
  if (!thumbnailUrl && url) {
    if (resolvedPlatform === 'YouTube' || resolvedPlatform === 'YouTube Shorts') {
      thumbnailUrl = extractYoutubeThumbnail(url);
    } else if (resolvedPlatform === 'Instagram') {
      thumbnailUrl = await extractInstagramThumbnail(url);
    }
  }

  // If still no thumbnail for Instagram, retry after approval via backfill
  // (admin can trigger re-fetch or we backfill on read)

  const clipStatus = isMatchCard ? 'approved' : 'pending';

  const clip = await db.clip.create({
    data: {
      playerId: session.playerId,
      title: title.trim(),
      description: (description || '').trim(),
      platform: resolvedPlatform,
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
