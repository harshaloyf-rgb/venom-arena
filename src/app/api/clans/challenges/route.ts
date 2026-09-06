import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { utcMonday } from '@/lib/date-utils';
import { ensureWeeklyChallenges } from '@/lib/clan-weekly';

// ─── GET /api/clans/challenges?tag=APEX ────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tag = String(req.nextUrl.searchParams.get('tag') || '').toUpperCase().trim();
  if (!tag) {
    return NextResponse.json({ error: 'Missing clan tag.' }, { status: 400 });
  }

  try {
    const me = await db.player.findUnique({
      where: { id: session.playerId },
      select: { clanTag: true },
    });
    if (!me || me.clanTag !== tag) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Current ISO week start (Monday, UTC)
    const weekStart = utcMonday();

    let challenges = await db.clanChallenge.findMany({
      where: { clanTag: tag, weekStart },
      orderBy: { createdAt: 'asc' },
    });

    // Auto-create challenges for the week if any of the 4 are missing.
    // T50: template logic now lives in lib/clan-weekly.ts (shared with the
    // increment sites, so progress made BEFORE the first GET of the week is
    // retained). This also covers the old 3-challenge backfill case, since
    // ensureWeeklyChallenges creates any missing type idempotently.
    if (challenges.length < 4) {
      const clan = await db.clan.findUnique({ where: { tag } });
      if (!clan) {
        return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });
      }

      await ensureWeeklyChallenges(db, tag, weekStart);
      challenges = await db.clanChallenge.findMany({
        where: { clanTag: tag, weekStart },
        orderBy: { createdAt: 'asc' },
      });
    }

    return NextResponse.json({ challenges });
  } catch (e) {
    console.error('[clans/challenges] GET error', e);
    return NextResponse.json({ error: 'Failed to fetch challenges.' }, { status: 500 });
  }
}

// ─── POST /api/clans/challenges  body: { tag, challengeId } ───────────────
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim();
  const challengeId = String(body.challengeId || '').trim();

  if (!tag || !challengeId) {
    return NextResponse.json({ error: 'Missing tag or challengeId.' }, { status: 400 });
  }

  try {
    const player = await db.player.findUnique({
      where: { id: session.playerId },
      select: { clanTag: true, clanRank: true, userTag: true, name: true },
    });
    if (!player || player.clanTag !== tag) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!['Leader', 'Co-Leader'].includes(player.clanRank || '')) {
      return NextResponse.json({ error: 'Only Leader or Co-Leader can claim rewards.' }, { status: 403 });
    }

    const result = await db.$transaction(async (tx) => {
      const challenge = await tx.clanChallenge.findUnique({
        where: { id: challengeId },
      });
      if (!challenge) throw new Error('CHALLENGE_NOT_FOUND');
      if (challenge.clanTag !== tag) throw new Error('CHALLENGE_NOT_FOUND');
      if (challenge.progress < challenge.target) throw new Error('NOT_COMPLETED');
      if (challenge.claimed) throw new Error('ALREADY_CLAIMED');

      // 1. Mark challenge as claimed
      await tx.clanChallenge.update({
        where: { id: challengeId },
        data: { claimed: true, claimedBy: player.userTag },
      });

      // 2. Add reward chips to clan treasury
      await tx.clan.update({
        where: { tag },
        data: { bankedChips: { increment: challenge.reward } },
      });

      // 3. Create ClanActivity
      await tx.clanActivity.create({
        data: {
          clanTag: tag,
          type: 'challenge_claim',
          actorTag: player.userTag,
          actorName: player.name,
          detail: `completed "${challenge.title}" — +${challenge.reward}c to treasury`,
        },
      });

      // 4. Give 10% bonus XP
      const bonusXp = Math.floor(challenge.reward * 0.1);
      let clan = await tx.clan.findUnique({ where: { tag } });
      if (clan) {
        clan = await tx.clan.update({
          where: { tag },
          data: { xp: { increment: bonusXp } },
        });

        // 5. Check level-up (subtract the CURRENT level's requirement, same as
        // the deposit route — subtracting after `level += 1` went negative)
        let { xp, level } = clan;
        if (xp >= level * 1000) {
          xp = xp - level * 1000;
          level += 1;
          clan = await tx.clan.update({
            where: { tag },
            data: { level, xp },
          });

          await tx.clanActivity.create({
            data: {
              clanTag: tag,
              type: 'level_up',
              actorTag: player.userTag,
              actorName: player.name,
              detail: `Clan leveled up to ${level}!`,
            },
          });
        }
      }

      // Fetch final treasury value
      const final = await tx.clan.findUnique({
        where: { tag },
        select: { bankedChips: true },
      });
      return final?.bankedChips ?? 0;
    });

    return NextResponse.json({ ok: true, newTreasury: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      CHALLENGE_NOT_FOUND: { error: 'Challenge not found.', status: 404 },
      NOT_COMPLETED: { error: 'Challenge has not been completed yet.', status: 400 },
      ALREADY_CLAIMED: { error: 'Reward has already been claimed.', status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/challenges] POST error', e);
    return NextResponse.json({ error: 'Failed to claim reward.' }, { status: 500 });
  }
}
