import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/war/score  body: { kills }
// Called when a player finishes a match to contribute kills toward their clan's war.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kills = Math.floor(Number(body.kills) || 0);

  if (kills <= 0) {
    return NextResponse.json({ error: 'Kills must be > 0.' }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');
      if (!me.clanTag) throw new Error('NOT_MEMBER');

      // Find active war for this player's clan (as declarer or target)
      const war = await tx.clanWar.findFirst({
        where: {
          OR: [
            { declarerTag: me.clanTag, status: 'active' },
            { targetTag: me.clanTag, status: 'active' },
          ],
        },
      });

      // No active war — return no-op
      if (!war) {
        return { scored: false };
      }

      // Determine which side to increment
      const isDeclarer = war.declarerTag === me.clanTag;
      const updateData = isDeclarer
        ? { declarerScore: { increment: kills } }
        : { targetScore: { increment: kills } };

      const updatedWar = await tx.clanWar.update({
        where: { id: war.id },
        data: updateData,
      });

      const yourScore = isDeclarer ? updatedWar.declarerScore : updatedWar.targetScore;
      const enemyScore = isDeclarer ? updatedWar.targetScore : updatedWar.declarerScore;

      // Check if war ends (first side to reach 50 kills)
      let warEnded = false;
      if (updatedWar.declarerScore >= 50 || updatedWar.targetScore >= 50) {
        warEnded = true;
        const now = new Date();

        // Determine winner: higher score wins, declarer wins on tie
        let winnerTag: string;
        if (updatedWar.declarerScore > updatedWar.targetScore) {
          winnerTag = updatedWar.declarerTag;
        } else if (updatedWar.targetScore > updatedWar.declarerScore) {
          winnerTag = updatedWar.targetTag;
        } else {
          // Tie — declarer wins
          winnerTag = updatedWar.declarerTag;
        }

        const totalPot = updatedWar.wager * 2;

        await tx.clanWar.update({
          where: { id: war.id },
          data: {
            status: 'ended',
            endedAt: now,
            winnerTag,
          },
        });

        // Award pot to winner
        await tx.clan.update({
          where: { tag: winnerTag },
          data: { bankedChips: { increment: totalPot } },
        });

        // Get both clan names for activity logs
        const declarerClan = await tx.clan.findUnique({ where: { tag: updatedWar.declarerTag }, select: { name: true } });
        const targetClan = await tx.clan.findUnique({ where: { tag: updatedWar.targetTag }, select: { name: true } });
        const declarerName = declarerClan?.name || updatedWar.declarerTag;
        const targetName = targetClan?.name || updatedWar.targetTag;
        const winnerName = winnerTag === updatedWar.declarerTag ? declarerName : targetName;

        // Log war_end on both clans
        await tx.clanActivity.create({
          data: {
            clanTag: updatedWar.declarerTag,
            type: 'war_end',
            actorTag: me.userTag,
            actorName: me.name,
            detail: `War ended — ${winnerName} [${winnerTag}] won ${totalPot.toLocaleString()}c (${updatedWar.declarerScore}-${updatedWar.targetScore})`,
          },
        });
        await tx.clanActivity.create({
          data: {
            clanTag: updatedWar.targetTag,
            type: 'war_end',
            actorTag: me.userTag,
            actorName: me.name,
            detail: `War ended — ${winnerName} [${winnerTag}] won ${totalPot.toLocaleString()}c (${updatedWar.declarerScore}-${updatedWar.targetScore})`,
          },
        });
      }

      return {
        scored: true,
        warId: war.id,
        yourScore,
        enemyScore,
        warEnded,
      };
    });

    if (!result.scored) {
      return NextResponse.json({ ok: true, scored: false });
    }

    return NextResponse.json({
      ok: true,
      scored: true,
      warId: result.warId,
      yourScore: result.yourScore,
      enemyScore: result.enemyScore,
      warEnded: result.warEnded,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Not found.', status: 404 },
      NOT_MEMBER: { error: 'You are not in a clan.', status: 403 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/war/score] error', e);
    return NextResponse.json({ error: 'Score submission failed.' }, { status: 500 });
  }
}
