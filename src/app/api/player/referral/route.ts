import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ensureReferralCode } from '@/lib/player-helpers';
import { REFERRAL_REWARD, REFERRAL_MATCH_THRESHOLD } from '@/lib/game-config';

// GET /api/player/referral — get referral code + list of referred players
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const referralCode = await ensureReferralCode(session.playerId);
    const player = await db.player.findUnique({ where: { id: session.playerId } });
    if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

    const [referrals, myReferral] = await Promise.all([
      db.referral.findMany({
        where: { referrerId: player.id },
        include: {
          referred: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.referral.findUnique({
        where: { referredId: player.id },
        include: {
          referrer: { select: { id: true, name: true, referralCode: true } },
        },
      }),
    ]);

    return NextResponse.json({
      referralCode: player.referralCode,
      hasReferrer: !!myReferral,
      referrerName: myReferral?.referrer.name ?? null,
      referrerCode: myReferral?.referrer.referralCode ?? null,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredName: r.referred.name,
        status: r.status,
        matchesPlayed: r.matchesPlayed,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error('[referral] GET error', e);
    return NextResponse.json({ error: 'Failed to load referral info.' }, { status: 500 });
  }
}

// POST /api/player/referral — link a referral code (called by the NEW player)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    let body: { code?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body required with { code }.' }, { status: 400 });
    }

    const code = (body.code ?? '').trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: 'Referral code is required.' }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!player) throw new Error('PLAYER_NOT_FOUND');

      // Check if player already has a referral
      const existingReferral = await tx.referral.findUnique({
        where: { referredId: player.id },
      });
      if (existingReferral) {
        throw new Error('ALREADY_REFERRED');
      }

      // Find the referrer by code
      const referrer = await tx.player.findUnique({ where: { referralCode: code } });
      if (!referrer) {
        throw new Error('INVALID_CODE');
      }

      // Cannot refer yourself
      if (referrer.id === player.id) {
        throw new Error('SELF_REFERRAL');
      }

      await tx.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: player.id,
          status: 'pending',
        },
      });

      return true;
    });

    return NextResponse.json({
      success: result,
      message: `Referral linked! You and your referrer both get ${REFERRAL_REWARD.toLocaleString()}c when you complete ${REFERRAL_MATCH_THRESHOLD} matches.`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'PLAYER_NOT_FOUND') {
      return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    }
    if (msg === 'ALREADY_REFERRED') {
      return NextResponse.json({ error: 'You already have a referral link.' }, { status: 400 });
    }
    if (msg === 'INVALID_CODE') {
      return NextResponse.json({ error: 'Invalid referral code.' }, { status: 400 });
    }
    if (msg === 'SELF_REFERRAL') {
      return NextResponse.json({ error: 'Cannot refer yourself.' }, { status: 400 });
    }
    console.error('[referral] POST error', e);
    return NextResponse.json({ error: 'Failed to link referral.' }, { status: 500 });
  }
}
