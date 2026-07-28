import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile, encodeSkins } from '@/lib/player-helpers';
import { COUNTRIES } from '@/lib/game-config';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const player = await db.player.findUnique({ where: { id: session.playerId } });
  if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ player: toProfile(player) });
}

export async function PUT(req: NextRequest) {
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
}

// Internal helper used by /api/player/cosmetic and /api/player/daily
export async function unlockSkin(playerId: string, skinId: string) {
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) return null;
  const unlocked = (() => {
    try { return JSON.parse(player.unlockedSkins || '[]') as string[]; } catch { return []; }
  })();
  if (!unlocked.includes(skinId)) unlocked.push(skinId);
  const updated = await db.player.update({
    where: { id: playerId },
    data: { unlockedSkins: encodeSkins(unlocked) },
  });
  return updated;
}
