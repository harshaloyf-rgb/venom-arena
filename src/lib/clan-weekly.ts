import { Prisma } from '@prisma/client';
import { utcMonday } from '@/lib/date-utils';

// ============================================================================
// Shared clan weekly-challenge + clan-war helpers.
//
// T50 fixes two live-confirmed bugs:
//
// BUG 2 — Weekly challenges are created LAZILY (first GET /api/clans/challenges
// of the week). The increment sites (deposit / chat / join) use updateMany,
// which silently matches 0 rows when the challenge rows don't exist yet — so
// any activity BEFORE the first GET of the week was lost (e.g. 50k deposited
// → Treasury Target showed 0/6000). Every increment site now calls
// ensureWeeklyChallenges() first; it is idempotent thanks to the
// @@unique([clanTag, type, weekStart]) index + skipDuplicates.
//
// BUG 3 — Disbanding a clan mid-war cascade-deleted the ClanWar row, so the
// escrowed wager (deducted from BOTH treasuries at declare time) was never
// refunded — a permanent chip leak for the surviving clan. refundWarsOnDisband()
// refunds the opponent's escrow to their treasury (with an activity-feed entry)
// and refunds the disbanding clan's own escrow to its Leader's personal bank
// (the clan treasury is about to be deleted, so the chips need a home).
// ============================================================================

const TEMPLATES = [
  {
    type: 'treasury_target',
    title: 'Treasury Target',
    description: 'Deposit a total of {target} chips into the clan treasury this week',
    target: 5000,
    reward: 2500,
  },
  {
    type: 'recruitment_drive',
    title: 'Recruitment Drive',
    description: 'Have {target} new members join the clan this week',
    target: 3,
    reward: 3000,
  },
  {
    type: 'chat_activity',
    title: 'Syndicate Comms',
    description: 'Send {target} messages in clan chat this week',
    target: 20,
    reward: 1500,
  },
  {
    type: 'deposit_streak',
    title: 'Deposit Streak',
    description: 'Make {target} total deposits into the treasury this week (any member, any amount)',
    target: 10,
    reward: 2000,
  },
] as const;

/**
 * Idempotently ensure the 4 weekly challenge rows exist for this clan + week.
 * Safe to call at every increment site and on every GET — existing rows are
 * never duplicated or overwritten (skipDuplicates). Call inside the same
 * transaction as the progress increment so the row exists before updateMany.
 */
export async function ensureWeeklyChallenges(
  tx: Prisma.TransactionClient,
  clanTag: string,
  weekStart: string = utcMonday(),
): Promise<void> {
  const clan = await tx.clan.findUnique({ where: { tag: clanTag }, select: { level: true } });
  if (!clan) return;

  const data = TEMPLATES.map((t) => {
    let resolvedTarget: number;
    let resolvedReward: number;

    if (t.type === 'treasury_target') {
      resolvedTarget = clan.level * 2000;
      resolvedReward = clan.level * 1000;
    } else if (t.type === 'recruitment_drive') {
      resolvedTarget = Math.min(clan.level, 5);
      resolvedReward = t.reward;
    } else if (t.type === 'deposit_streak') {
      resolvedTarget = clan.level * 2 + 8;
      resolvedReward = clan.level * 500 + t.reward;
    } else {
      // chat_activity
      resolvedTarget = clan.level * 5 + 15;
      resolvedReward = t.reward;
    }

    return {
      clanTag,
      type: t.type,
      title: t.title,
      description: t.description.replace('{target}', String(resolvedTarget)),
      target: resolvedTarget,
      reward: resolvedReward,
      weekStart,
    };
  });

  // Per-row atomic upsert with an EMPTY update branch: existing rows (and their
  // live progress) are never modified, missing rows are created. Safe against
  // concurrent first-activity races — no skipDuplicates needed.
  for (const row of data) {
    await tx.clanChallenge.upsert({
      where: {
        clanTag_type_weekStart: { clanTag: row.clanTag, type: row.type, weekStart: row.weekStart },
      },
      create: row,
      update: {},
    });
  }
}

/**
 * Refund escrowed war wagers for every ACTIVE war involving a clan that is
 * about to be disbanded. MUST be called inside the disband transaction,
 * BEFORE the clan row is deleted (the ClanWar cascade would otherwise erase
 * the escrow record). Returns the number of wars that were cancelled.
 *
 * - Opponent clan survives  → its wager goes back to its treasury + activity log.
 * - Disbanding clan's wager → credited to `refundToPlayerId` (the Leader's
 *   personal bankedChips) since the clan treasury is being destroyed.
 */
export async function refundWarsOnDisband(
  tx: Prisma.TransactionClient,
  clanTag: string,
  refundToPlayerId?: string,
): Promise<number> {
  const wars = await tx.clanWar.findMany({
    where: {
      OR: [
        { declarerTag: clanTag, status: 'active' },
        { targetTag: clanTag, status: 'active' },
      ],
    },
  });

  for (const war of wars) {
    const opponentTag = war.declarerTag === clanTag ? war.targetTag : war.declarerTag;

    // 1. Refund the opponent's escrow and tell them why the war ended.
    await tx.clan.update({
      where: { tag: opponentTag },
      data: { bankedChips: { increment: war.wager } },
    });
    await tx.clanActivity.create({
      data: {
        clanTag: opponentTag,
        type: 'war_end',
        actorTag: 'SYSTEM',
        actorName: 'System',
        detail: `War cancelled — [${clanTag}] disbanded mid-war. Your ${war.wager.toLocaleString()}c wager was refunded to the treasury.`,
      },
    });

    // 2. Refund the disbanding clan's own escrow to its Leader.
    if (refundToPlayerId) {
      await tx.player.update({
        where: { id: refundToPlayerId },
        data: { bankedChips: { increment: war.wager } },
      });
    }
  }

  if (wars.length > 0) {
    await tx.clanWar.deleteMany({ where: { id: { in: wars.map((w) => w.id) } } });
  }

  return wars.length;
}
