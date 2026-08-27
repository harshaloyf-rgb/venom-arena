import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, rateLimit } from '@/lib/api-helpers';
import { randomBytes } from 'crypto';

// In-memory store for social verification codes (15 min TTL)
interface VerifyEntry {
  code: string;
  platform: 'instagram' | 'youtube' | 'twitch';
  username: string;
  playerId: string;
  createdAt: number;
}
const verifyStore = new Map<string, VerifyEntry>();

function cleanupExpired() {
  const now = Date.now();
  for (const [key, val] of verifyStore) {
    if (now - val.createdAt > 15 * 60 * 1000) verifyStore.delete(key);
  }
}

// Generate a 6-char verification code like "VN-AB12"
function generateVerifyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return `VN-${c}`;
}

// Build the profile URL for a platform
function getProfileUrl(platform: string, username: string): string {
  const clean = username.replace('@', '').trim();
  switch (platform) {
    case 'instagram': return `https://www.instagram.com/${clean}/`;
    case 'youtube': return clean.startsWith('http') ? clean : `https://www.youtube.com/@${clean.replace('@', '')}`;
    case 'twitch': return `https://www.twitch.tv/${clean}`;
    default: return '';
  }
}

// Check if an account exists using web-reader SDK
async function checkAccountExists(platform: string, username: string): Promise<{ exists: boolean; displayName?: string }> {
  const url = getProfileUrl(platform, username);
  if (!url) return { exists: false };

  try {
    const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default);
    const zai = await ZAI.create();
    const result = await zai.functions.invoke('page_reader', { url });

    const html = result?.data?.html || '';
    const title = result?.data?.title || '';
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

    if (platform === 'instagram') {
      // Instagram profile pages contain the username in title like "@username • Instagram"
      const cleanName = username.replace('@', '').trim().toLowerCase();
      // Definite rejection signals
      if (text.includes('sorry, this page') || text.includes('page isn\'t available') || text.includes('not found') || text.includes('user not found')) {
        return { exists: false };
      }
      // Check for positive profile signals: username in title, follower/post counts, bio section
      const hasUsernameInTitle = title.toLowerCase().includes(cleanName) || title.toLowerCase().includes('@' + cleanName);
      const hasProfileSignals = text.includes('followers') || text.includes('following') || text.includes('posts') || text.includes('bio') || text.includes('profile picture');
      if (hasUsernameInTitle && hasProfileSignals) {
        const titleParts = title.split(' • ');
        const displayName = titleParts[0]?.replace('@', '').trim() || cleanName;
        return { exists: true, displayName };
      }
      // Login-only pages or empty profiles → reject
      if ((text.includes('log in') || text.includes('sign up')) && !hasProfileSignals) return { exists: false };
      // Without clear profile signals, reject to be safe
      return { exists: false };
    }

    if (platform === 'youtube') {
      // YouTube channel pages have the channel name in title
      const cleanName = username.replace('@', '').trim().toLowerCase();
      if (text.includes('this channel doesn\'t exist') || text.includes('not found') || text.includes('error 404')) {
        return { exists: false };
      }
      // If we got a meaningful title (not just "YouTube")
      if (title && title !== 'YouTube' && !title.includes('404')) {
        return { exists: true, displayName: title.replace(' - YouTube', '').trim() };
      }
      if (html.length > 2000) return { exists: true, displayName: cleanName };
      return { exists: false };
    }

    if (platform === 'twitch') {
      const cleanName = username.replace('@', '').trim().toLowerCase();
      if (text.includes('doesn\'t exist') || text.includes('not found') || text.includes('404')) {
        return { exists: false };
      }
      if (title && !title.includes('Twitch') && !title.includes('404')) {
        return { exists: true, displayName: title.replace(' - Twitch', '').trim() };
      }
      if (html.length > 2000) return { exists: true, displayName: cleanName };
      return { exists: false };
    }

    return { exists: false };
  } catch (e) {
    console.error(`[social-verify] check error for ${platform}/${username}:`, e);
    return { exists: false };
  }
}

// Verify the bio code appears on the page
async function verifyBioCode(platform: string, username: string, code: string): Promise<boolean> {
  const url = getProfileUrl(platform, username);
  if (!url) return false;

  try {
    const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default);
    const zai = await ZAI.create();
    const result = await zai.functions.invoke('page_reader', { url });

    const html = (result?.data?.html || '').toLowerCase();
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const codeLower = code.toLowerCase();

    return text.includes(codeLower);
  } catch (e) {
    console.error(`[social-verify] bio check error for ${platform}/${username}:`, e);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    // Rate limit: 5 per minute
    const rl = rateLimit(`social-verify:${session.playerId}`, 5, 60_000);
    if (rl) return rl;

    cleanupExpired();

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const platform = String(body.platform || '').toLowerCase().trim() as 'instagram' | 'youtube' | 'twitch';
    const username = String(body.username || '').trim();

    if (!['instagram', 'youtube', 'twitch'].includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform.' }, { status: 400 });
    }
    if (!username || username.length < 2) {
      return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    }

    // ── ACTION: check ───────────────────────────────────────────────
    if (action === 'check') {
      const result = await checkAccountExists(platform, username);
      if (!result.exists) {
        return NextResponse.json({ exists: false, error: `This ${platform} account was not found. Please check the username and try again.` });
      }
      return NextResponse.json({ exists: true, displayName: result.displayName });
    }

    // ── ACTION: generate ────────────────────────────────────────────
    if (action === 'generate') {
      // First verify account exists
      const exists = await checkAccountExists(platform, username);
      if (!exists.exists) {
        return NextResponse.json({ error: `This ${platform} account was not found.` }, { status: 400 });
      }

      // Check if already verified
      const player = await db.player.findUnique({
        where: { id: session.playerId },
        select: {
          instagram: true, instagramVerified: true,
          youtube: true, youtubeVerified: true,
          twitch: true, twitchVerified: true,
        },
      });
      if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

      // Check if this platform is already verified with a different username
      const currentVal = player[`${platform}Verified` as keyof typeof player] as boolean;
      const currentHandle = player[platform as keyof typeof player] as string | null;
      if (currentVal && currentHandle && currentHandle !== username) {
        return NextResponse.json({ error: `Your ${platform} is already verified as @${currentHandle}. Remove it first to link a different account.` }, { status: 400 });
      }

      const code = generateVerifyCode();
      const key = `${session.playerId}:${platform}`;

      verifyStore.set(key, {
        code,
        platform,
        username: username.replace('@', '').trim(),
        playerId: session.playerId,
        createdAt: Date.now(),
      });

      return NextResponse.json({
        code,
        message: `Add "${code}" to your ${platform} bio/description, then confirm below.`,
        expiresIn: '15 minutes',
      });
    }

    // ── ACTION: confirm ─────────────────────────────────────────────
    if (action === 'confirm') {
      const codeInput = String(body.code || '').trim().toUpperCase();
      if (!codeInput) {
        return NextResponse.json({ error: 'Verification code is required.' }, { status: 400 });
      }

      const key = `${session.playerId}:${platform}`;
      const entry = verifyStore.get(key);

      if (!entry) {
        return NextResponse.json({ error: 'No pending verification. Please generate a code first.' }, { status: 400 });
      }

      if (Date.now() - entry.createdAt > 15 * 60 * 1000) {
        verifyStore.delete(key);
        return NextResponse.json({ error: 'Verification code expired. Please generate a new one.' }, { status: 410 });
      }

      if (codeInput !== entry.code.toUpperCase()) {
        return NextResponse.json({ error: 'Code mismatch. Make sure you copied it exactly.' }, { status: 400 });
      }

      // Verify the code appears in the bio
      const bioFound = await verifyBioCode(platform, entry.username, entry.code);
      if (!bioFound) {
        return NextResponse.json({
          error: `We couldn't find "${entry.code}" in your ${platform} bio/description. Make sure you saved it and try again.`,
          retryable: true,
        }, { status: 400 });
      }

      // Save the verified social link
      const cleanUsername = entry.username;
      const updateData: Record<string, unknown> = {};
      updateData[platform] = cleanUsername;
      updateData[`${platform}Verified`] = true;

      await db.player.update({
        where: { id: session.playerId },
        data: updateData,
      });

      // Clean up
      verifyStore.delete(key);

      return NextResponse.json({
        verified: true,
        platform,
        username: cleanUsername,
        message: `${platform.charAt(0).toUpperCase() + platform.slice(1)} account @${cleanUsername} verified and linked!`,
      });
    }

    // ── ACTION: remove ──────────────────────────────────────────────
    if (action === 'remove') {
      const updateData: Record<string, unknown> = {};
      updateData[platform] = null;
      updateData[`${platform}Verified`] = false;

      await db.player.update({
        where: { id: session.playerId },
        data: updateData,
      });

      verifyStore.delete(`${session.playerId}:${platform}`);

      return NextResponse.json({ removed: true, platform });
    }

    return NextResponse.json({ error: 'Invalid action. Use: check, generate, confirm, or remove.' }, { status: 400 });
  } catch (e) {
    console.error('[social-verify] error:', e);
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 });
  }
}
