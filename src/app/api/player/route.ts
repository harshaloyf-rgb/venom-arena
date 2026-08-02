import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
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

    if (typeof body.name === 'string') {
      const name = body.name.trim().slice(0, 20);
      if (name.length >= 2) data.name = name;
    }
    if (typeof body.country === 'string') {
      const c = COUNTRIES.find((x) => x.code === body.country);
      if (c) data.country = c.code;
    }
    if (typeof body.avatar === 'string' && body.avatar.length <= 8) {
      data.avatar = body.avatar;
    }
    // Social links
    if (typeof body.instagram === 'string') {
      data.instagram = body.instagram.trim().slice(0, 60) || null;
    }
    if (typeof body.youtube === 'string') {
      data.youtube = body.youtube.trim().slice(0, 100) || null;
    }
    if (typeof body.twitch === 'string') {
      data.twitch = body.twitch.trim().slice(0, 60) || null;
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

// Internal helper used by /api/player/cosmetic and /api/player/daily
export async function unlockSkin(playerId: string, skinId: string) {
  const updated = await db.$transaction(async (tx) => {
    const player = await tx.player.findUnique({ where: { id: playerId } });
    if (!player) return null;
    const unlocked = (() => {
      try { return JSON.parse(player.unlockedSkins || '[]') as string[]; } catch { return []; }
    })();
    if (unlocked.includes(skinId)) return player; // already unlocked, no-op
    unlocked.push(skinId);
    const result = await tx.player.update({
      where: { id: playerId },
      data: { unlockedSkins: encodeSkins(unlocked) },
    });
    return result;
  });
  return updated;
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
    return NextResponse.json({ ok: true, message: 'Account deleted successfully.' });
  } catch (e) {
    console.error('[player/delete] error', e);
    return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 });
  }
}
