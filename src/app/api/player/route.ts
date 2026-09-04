import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, clearSessionCookie } from '@/lib/auth';
import { toProfile, encodeSkins } from '@/lib/player-helpers';
import { COUNTRIES } from '@/lib/game-config';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const player = await db.player.findUnique({ where: { id: session.playerId } });
    if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const [followersCount, followingCount, rivalsCount] = await Promise.all([
      db.follow.count({ where: { followingId: session.playerId } }),
      db.follow.count({ where: { followerId: session.playerId } }),
      db.rival.count({ where: { playerId: session.playerId } }),
    ]);
    return NextResponse.json({ player: toProfile(player), followersCount, followingCount, rivalsCount });
  } catch (e) {
    console.error('[player/get] error', e);
    return NextResponse.json({ error: 'Failed to load profile.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    const player = await db.player.findUnique({ where: { id: session.playerId } });
    if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Whitelisted fields the player can edit directly.
    // Cosmetics equip / name / country / avatar only. Economy is server-only.
    const data: Record<string, unknown> = {};

    // --- Name change: 30-day cooldown (leaderboard integrity) ---
    if (typeof body.name === 'string') {
      const name = body.name.trim().slice(0, 20);
      if (name.length >= 2) {
        if (name !== player.name) {
          const cooldownMs = 30 * 24 * 60 * 60 * 1000; // 30 days
          if (player.nameChangedAt && (Date.now() - player.nameChangedAt.getTime()) < cooldownMs) {
            const remainingMs = cooldownMs - (Date.now() - player.nameChangedAt.getTime());
            const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
            return NextResponse.json(
              { error: `Handle can only be changed once every 30 days. ${remainingDays} day${remainingDays !== 1 ? 's' : ''} remaining.`, cooldownEndsAt: player.nameChangedAt.toISOString() },
              { status: 429 },
            );
          }
          data.name = name;
          data.nameChangedAt = new Date();
        }
      }
    }

    // --- Country change: 7-day cooldown (leaderboard integrity) ---
    if (typeof body.country === 'string') {
      const c = COUNTRIES.find((x) => x.code === body.country);
      if (c) {
        if (c.code !== player.country) {
          const cooldownMs = 7 * 24 * 60 * 60 * 1000; // 7 days
          if (player.countryChangedAt && (Date.now() - player.countryChangedAt.getTime()) < cooldownMs) {
            const remainingMs = cooldownMs - (Date.now() - player.countryChangedAt.getTime());
            const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
            return NextResponse.json(
              { error: `Region can only be changed once every 7 days. ${remainingDays} day${remainingDays !== 1 ? 's' : ''} remaining.`, cooldownEndsAt: player.countryChangedAt.toISOString() },
              { status: 429 },
            );
          }
          data.country = c.code;
          data.countryChangedAt = new Date();
        }
      }
    }
    if (typeof body.avatar === 'string' && body.avatar.length <= 8) {
      data.avatar = body.avatar;
    }
    // Social links — can only be cleared here, NOT set.
    // Setting social links requires the /api/player/social-verify verification flow.
    if (body.instagram === '' || body.instagram === null) {
      data.instagram = null;
      data.instagramVerified = false;
    }
    if (body.youtube === '' || body.youtube === null) {
      data.youtube = null;
      data.youtubeVerified = false;
    }
    if (body.twitch === '' || body.twitch === null) {
      data.twitch = null;
      data.twitchVerified = false;
    }
    // Equip cosmetics — must be in unlockedSkins
    const unlocked = (() => {
      try { return JSON.parse(player.unlockedSkins || '[]') as string[]; } catch { return []; }
    })();
    if (typeof body.currentSkin === 'string' && unlocked.includes(body.currentSkin)) data.currentSkin = body.currentSkin;
    if (typeof body.currentTrail === 'string' && unlocked.includes(body.currentTrail)) data.currentTrail = body.currentTrail;
    if (typeof body.currentDeath === 'string' && unlocked.includes(body.currentDeath)) data.currentDeath = body.currentDeath;
    if (typeof body.currentFlag === 'string') {
      if (body.currentFlag === '' || unlocked.includes(body.currentFlag)) data.currentFlag = body.currentFlag || null;
    }
    if (typeof body.currentBanner === 'string') {
      if (body.currentBanner === '' || unlocked.includes(body.currentBanner)) data.currentBanner = body.currentBanner || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ player: toProfile(player) });
    }

    const updated = await db.player.update({
      where: { id: session.playerId },
      data: { ...data, lastSeenAt: new Date() },
    });
    return NextResponse.json({ player: toProfile(updated) });
  } catch (e) {
    console.error('[player/put] error', e);
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 });
  }
}

// DELETE /api/player — soft-delete account (anonymize data)
// M-17: GDPR Right to Erasure
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const player = await db.player.findUnique({ where: { id: session.playerId } });
    if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Anonymize: clear PII, set email to deleted prefix, randomize name
    const anonEmail = `deleted-${player.id.slice(0,8)}@deleted.venom.local`;
    await db.player.update({
      where: { id: player.id },
      data: {
        email: anonEmail,
        name: 'Deleted Player',
        avatar: null,
        securityPin: null,
        passwordHash: null,
        oauthProvider: null,
        oauthProviderId: null,
        bankedChips: 0,
        totalEarned: 0,
        totalLost: 0,
        unlockedSkins: '[]',
        currentSkin: 'skin-default',
        currentTrail: 'trail-none',
        currentDeath: 'death-default',
        currentFlag: null,
        currentBanner: null,
        clanTag: null,
        clanRank: null,
        instagram: null,
        youtube: null,
        twitch: null,
        tokenVersion: { increment: 1 },
      },
    });
    // Security (audit A9): also clear the session cookie server-side — the
    // UI cleared it client-side only, leaving a still-valid copied token.
    // (tokenVersion bump above revokes every copy of every session token.)
    await clearSessionCookie();
    return NextResponse.json({ ok: true, message: 'Account deleted successfully.' });
  } catch (e) {
    console.error('[player/delete] error', e);
    return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 });
  }
}
