import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getArenaById, JADE_CORRIDOR_TIER_ID } from '@/lib/game-config';
import { verifyInternalSecret } from '@/lib/api-helpers';

// POST /api/match/join
// Internal endpoint called by the game server when a player joins an arena.
// Atomically deducts buyIn (or redeems a Virtual Ticket). Returns the player's
// snapshot for spawning.
//
// body: { userTag: string, arenaId: string, useTicket?: boolean }
// returns: { ok: boolean, player: {...} | null, ticketJoin?: boolean, reason?: string }
//
// ── Pre-join ad gate (locked spec 2026-09-04) ───────────────────────────────
// HARD RULE: ads exist at exactly ONE surface — the pre-join gate, evaluated
// ONLY here at join time. They can never appear mid-gameplay: an expired
// window never interrupts a live match, it only means the NEXT join needs a
// new ad. One ad unlocks a 10-minute window (adUnlockUntil) with unlimited
// joins; every join still pays its own chip buyIn. Active Time Pass holders
// (adFreeUntil) skip the gate everywhere.
//
// Virtual Tickets: 1 ticket = completely free entry (no buyIn, no ad) to Jade
// Corridor (JADE_CORRIDOR_TIER_ID) only. The ticket is redeemed atomically in
// the same transaction that spawns the player.
export async function POST(req: NextRequest) {
  if (!verifyInternalSecret(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userTag = String(body.userTag || '');
  const arenaId = String(body.arenaId || '');
  const useTicket = body.useTicket === true;
  const arena = getArenaById(arenaId);
  if (!arena) return NextResponse.json({ ok: false, reason: 'invalid_arena' }, { status: 400 });

  let result;
  try {
    result = await db.$transaction(async (tx) => {
      const p = await tx.player.findUnique({ where: { userTag } });
      if (!p) return { ok: false as const, reason: 'player_not_found' };
      if (p.banned) return { ok: false as const, reason: 'banned' };

      const now = new Date();
      const adFreeActive = !!p.adFreeUntil && p.adFreeUntil.getTime() > now.getTime();
      const windowActive = !!p.adUnlockUntil && p.adUnlockUntil.getTime() > now.getTime();

      let ticketJoin = false;

      if (useTicket) {
        // ── Virtual Ticket redemption: free entry, Jade Corridor only ──────
        if (arenaId !== JADE_CORRIDOR_TIER_ID) {
          return { ok: false as const, reason: 'ticket_invalid_arena' };
        }
        if (p.tickets < 1) {
          return { ok: false as const, reason: 'no_tickets' };
        }
        const claimed = await tx.player.updateMany({
          where: { id: p.id, tickets: { gte: 1 } }, // race-proof single ticket claim
          data: { tickets: { decrement: 1 }, lastSeenAt: now },
        });
        if (claimed.count !== 1) {
          return { ok: false as const, reason: 'no_tickets' };
        }
        await tx.ticketLedger.create({
          data: { playerId: p.id, delta: -1, reason: 'jade_corridor_join' },
        });
        ticketJoin = true;
      } else {
        // ── Normal join: pre-join ad gate first, then buyIn ─────────────────
        if (!adFreeActive && !windowActive) {
          return { ok: false as const, reason: 'ad_required' };
        }
        if (p.bankedChips < arena.buyIn) {
          return { ok: false as const, reason: 'insufficient_chips' };
        }
        await tx.player.update({
          where: { id: p.id },
          data: {
            bankedChips: { decrement: arena.buyIn },
            totalLost: { increment: arena.buyIn },
            lastSeenAt: now,
          },
        });
      }

      let unlocked: string[] = [];
      try { unlocked = JSON.parse(p.unlockedSkins || '[]') as string[]; } catch {}

      // bankedChipsAfterBuyIn: balance after this join's economy event
      // (unchanged for ticket joins — the ticket replaced the buyIn).
      const refreshed = await tx.player.findUniqueOrThrow({
        where: { id: p.id },
        select: { bankedChips: true },
      });

      return {
        ok: true as const,
        ticketJoin,
        player: {
          userTag: p.userTag,
          name: p.name,
          country: p.country,
          level: p.level,
          currentSkin: p.currentSkin,
          currentTrail: p.currentTrail,
          currentDeath: p.currentDeath,
          currentFlag: p.currentFlag,
          bankedChipsAfterBuyIn: refreshed.bankedChips,
          unlockedSkins: unlocked,
          clanTag: p.clanTag,
          clanRank: p.clanRank,
        },
      };
    });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: 'database_error' }, { status: 500 });
  }

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
