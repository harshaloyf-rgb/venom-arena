import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-helpers';
import { logAdminAction } from '@/lib/audit';
import { passPlanById, PASS_PLANS } from '@/lib/pass-catalog';
import { creditPassPurchase } from '@/lib/pass-order';
import { walletResetStatus, forceWalletReset } from '@/lib/year-rollover';
import { PASS_TIER_XP } from '@/lib/game-config';

// Admin economy controls for the Time Pass / Ticket system (locked spec
// 2026-09-04, extended 2026-09-05 with inspect/revoke tooling so the admin
// can both CHECK and FIX pass/ticket issues without touching the DB by hand).
// Extended 2026-09-06 with Cyber Pass (Season Pass) support tools — the
// cyber_* actions at the bottom.
// Mirrors the modify-chips route's session+audit pattern.
//
// GET ?view=player  &userTag=                          -> one player's pass state + history (incl. Cyber Pass dossier)
// GET ?view=orders  [&userTag=][&store=][&sku=][&limit=][&offset=] -> PassOrder table
// GET ?view=ledger  [&userTag=][&reason=][&limit=][&offset=]       -> TicketLedger table
// GET ?view=cosmetics [&userTag=][&itemType=][&limit=][&offset=]   -> Purchase table (cosmetic ledger)
// GET (no view)                                        -> reset status + plan catalog + totals
//
// POST { action: 'grant_pass',      userTag, sku }
// POST { action: 'revoke_pass',     userTag }         // clears adFreeUntil immediately
// POST { action: 'clear_ad_unlock', userTag }         // clears a stuck 10-min ad window
// POST { action: 'set_tickets',     userTag, delta }  // +grant / -revoke (ledgered)
// POST { action: 'cyber_grant_elite', userTag }       // comp the Elite Cyber Pass (no chip cost, audit-logged)
// POST { action: 'cyber_set_xp',      userTag, xp }   // set absolute Pass XP (0..1,000,000, audit-logged)
// POST { action: 'cyber_unclaim',     userTag, tier, track } // re-open a claimed tier (chips NOT clawed back)
// POST { action: 'force_wallet_reset' }               // DANGEROUS: gated by ADMIN_FORCE_WALLET_RESET=1

const RESET_ENABLED = process.env.ADMIN_FORCE_WALLET_RESET === '1';

function parseLimitOffset(req: NextRequest) {
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 50, 1), 200);
  const offset = Math.max(Number(req.nextUrl.searchParams.get('offset')) || 0, 0);
  return { limit, offset };
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  void session;

  const view = req.nextUrl.searchParams.get('view') || '';

  // ── Per-player pass dossier ──────────────────────────────────────────────
  if (view === 'player') {
    const userTag = req.nextUrl.searchParams.get('userTag')?.trim();
    if (!userTag) return NextResponse.json({ error: 'userTag is required.' }, { status: 400 });
    const player = await db.player.findUnique({
      where: { userTag },
      select: {
        id: true, name: true, userTag: true, adFreeUntil: true, adUnlockUntil: true, tickets: true,
        // Cyber Pass (Season Pass) dossier fields
        hasElitePass: true, passXp: true, passXpToday: true, passXpDate: true,
        passClaimedFree: true, passClaimedElite: true,
      },
    });
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const now = new Date();
    const [orders, ledger] = await Promise.all([
      db.passOrder.findMany({
        where: { playerId: player.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      db.ticketLedger.findMany({
        where: { playerId: player.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // Cyber Pass derived state
    const parseTiers = (raw: string | null): number[] => {
      try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
    };
    const cyberTier = (() => {
      for (let i = PASS_TIER_XP.length - 1; i >= 0; i--) {
        if (player.passXp >= PASS_TIER_XP[i]) return i + 1;
      }
      return 0;
    })();
    const cyber = {
      hasElitePass: player.hasElitePass,
      passXp: player.passXp,
      passXpToday: player.passXpToday,
      passXpDate: player.passXpDate ?? null,
      isCappedToday: player.passXpDate === now.toISOString().slice(0, 10) && player.passXpToday >= 1500,
      tier: cyberTier,
      claimedFree: parseTiers(player.passClaimedFree),
      claimedElite: parseTiers(player.passClaimedElite),
    };

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.name,
        userTag: player.userTag,
        adFreeUntil: player.adFreeUntil,
        adUnlockUntil: player.adUnlockUntil,
        tickets: player.tickets,
        passActive: !!player.adFreeUntil && player.adFreeUntil > now,
        windowActive: !!player.adUnlockUntil && player.adUnlockUntil > now,
      },
      cyber,
      orders: orders.map((o) => ({ ...o, verifierNote: o.verifierNote ?? null })),
      ledger,
    });
  }

  // ── Pass orders table (all players) ──────────────────────────────────────
  if (view === 'orders') {
    const { limit, offset } = parseLimitOffset(req);
    const userTag = req.nextUrl.searchParams.get('userTag')?.trim();
    const store = req.nextUrl.searchParams.get('store')?.trim();
    const sku = req.nextUrl.searchParams.get('sku')?.trim();

    const where: {
      playerId?: string;
      store?: string;
      sku?: string;
    } = {};
    if (userTag) {
      const p = await db.player.findUnique({ where: { userTag }, select: { id: true } });
      if (!p) return NextResponse.json({ orders: [], total: 0 });
      where.playerId = p.id;
    }
    if (store) where.store = store;
    if (sku) where.sku = sku;

    const [rows, total] = await Promise.all([
      db.passOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { player: { select: { userTag: true, name: true } } },
      }),
      db.passOrder.count({ where }),
    ]);

    return NextResponse.json({
      orders: rows.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        userTag: o.player.userTag,
        playerName: o.player.name,
        sku: o.sku,
        durationDays: o.durationDays,
        priceUsdMicros: o.priceUsdMicros,
        store: o.store,
        storeOrderId: o.storeOrderId,
        ticketsGranted: o.ticketsGranted,
        adFreeUntilAfter: o.adFreeUntilAfter,
        verifierNote: o.verifierNote,
      })),
      total,
    });
  }

  // ── Ticket ledger table (all players) ────────────────────────────────────
  if (view === 'ledger') {
    const { limit, offset } = parseLimitOffset(req);
    const userTag = req.nextUrl.searchParams.get('userTag')?.trim();
    const reason = req.nextUrl.searchParams.get('reason')?.trim();

    const where: { playerId?: string; reason?: string } = {};
    if (userTag) {
      const p = await db.player.findUnique({ where: { userTag }, select: { id: true } });
      if (!p) return NextResponse.json({ ledger: [], total: 0 });
      where.playerId = p.id;
    }
    if (reason) where.reason = reason;

    const [rows, total] = await Promise.all([
      db.ticketLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { player: { select: { userTag: true, name: true } } },
      }),
      db.ticketLedger.count({ where }),
    ]);

    return NextResponse.json({
      ledger: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        userTag: r.player.userTag,
        playerName: r.player.name,
        delta: r.delta,
        reason: r.reason,
        refId: r.refId,
      })),
      total,
    });
  }

  // ── Cosmetic purchase ledger table (all players) ────────────────────────
  // Purchase rows are written automatically by the buy flows (shop skin
  // buys, Elite Pass unlock, season-pass claims). Read-only surface for
  // dispute checks — added 2026-09-06 (Task 34 recommendation).
  if (view === 'cosmetics') {
    const { limit, offset } = parseLimitOffset(req);
    const userTag = req.nextUrl.searchParams.get('userTag')?.trim();
    const itemType = req.nextUrl.searchParams.get('itemType')?.trim();

    const where: { playerId?: string; itemType?: string } = {};
    if (userTag) {
      const p = await db.player.findUnique({ where: { userTag }, select: { id: true } });
      if (!p) return NextResponse.json({ purchases: [], total: 0, byType: [] });
      where.playerId = p.id;
    }
    if (itemType) where.itemType = itemType;

    const [rows, total, byType] = await Promise.all([
      db.purchase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { player: { select: { userTag: true, name: true } } },
      }),
      db.purchase.count({ where }),
      db.purchase.groupBy({
        by: ['itemType'],
        _count: { _all: true },
        _sum: { amountChips: true },
      }),
    ]);

    return NextResponse.json({
      purchases: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        userTag: r.player.userTag,
        playerName: r.player.name,
        itemId: r.itemId,
        itemType: r.itemType,
        amountChips: r.amountChips,
      })),
      total,
      byType: byType
        .map((g) => ({ itemType: g.itemType, count: g._count._all, chips: g._sum.amountChips ?? 0 }))
        .sort((a, b) => b.count - a.count),
    });
  }

  // ── Default: global status ───────────────────────────────────────────────
  const [status, activePasses, totalTickets] = await Promise.all([
    walletResetStatus(),
    db.player.count({ where: { adFreeUntil: { gt: new Date() } } }),
    db.player.aggregate({ _sum: { tickets: true } }),
  ]);

  return NextResponse.json({
    walletReset: { ...status, resetEnabled: RESET_ENABLED },
    activePasses,
    totalTickets: totalTickets._sum.tickets ?? 0,
    plans: PASS_PLANS.map((p) => ({ sku: p.id, label: p.label, days: p.durationDays, priceUsd: p.priceUsd, tickets: p.tickets })),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  if (action === 'grant_pass') {
    const userTag = String(body.userTag || '').trim();
    const sku = String(body.sku || '').trim();
    const plan = passPlanById(sku);
    if (!userTag || !plan) {
      return NextResponse.json({ error: 'userTag and a valid pass sku are required.' }, { status: 400 });
    }
    const target = await db.player.findUnique({ where: { userTag } });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const result = await creditPassPurchase({
      playerId: target.id,
      plan,
      store: 'admin',
      storeTxId: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      verifierNote: JSON.stringify({ kind: 'admin', by: session.playerId }),
    });
    await logAdminAction(session, 'grant_pass', 'player', userTag, {
      sku: plan.id,
      days: plan.durationDays,
      tickets: plan.tickets,
      adFreeUntilAfter: result.adFreeUntil.toISOString(),
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'revoke_pass') {
    const userTag = String(body.userTag || '').trim();
    if (!userTag) return NextResponse.json({ error: 'userTag is required.' }, { status: 400 });
    const target = await db.player.findUnique({ where: { userTag }, select: { id: true, adFreeUntil: true } });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    await db.player.update({ where: { id: target.id }, data: { adFreeUntil: null } });
    // Trail policy (user decision 2026-09-05): audit log only — PassOrder
    // rows stay untouched so grant history remains queryable.
    await logAdminAction(session, 'revoke_pass', 'player', userTag, {
      previousAdFreeUntil: target.adFreeUntil ? target.adFreeUntil.toISOString() : null,
    });
    return NextResponse.json({ ok: true, userTag, previousAdFreeUntil: target.adFreeUntil });
  }

  if (action === 'clear_ad_unlock') {
    const userTag = String(body.userTag || '').trim();
    if (!userTag) return NextResponse.json({ error: 'userTag is required.' }, { status: 400 });
    const target = await db.player.findUnique({ where: { userTag }, select: { id: true, adUnlockUntil: true } });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    await db.player.update({ where: { id: target.id }, data: { adUnlockUntil: null } });
    await logAdminAction(session, 'clear_ad_unlock', 'player', userTag, {
      previousAdUnlockUntil: target.adUnlockUntil ? target.adUnlockUntil.toISOString() : null,
    });
    return NextResponse.json({ ok: true, userTag, previousAdUnlockUntil: target.adUnlockUntil });
  }

  if (action === 'set_tickets') {
    const userTag = String(body.userTag || '').trim();
    const rawDelta = Math.trunc(Number(body.delta));
    if (!userTag || !Number.isFinite(rawDelta) || rawDelta === 0) {
      return NextResponse.json({ error: 'userTag and a non-zero integer delta are required.' }, { status: 400 });
    }
    const updated = await db.$transaction(async (tx) => {
      const target = await tx.player.findUnique({ where: { userTag } });
      if (!target) return null;
      const newTickets = Math.max(0, target.tickets + rawDelta);
      const applied = newTickets - target.tickets; // clamped delta actually applied
      if (applied === 0) return { userTag, tickets: target.tickets, applied: 0 };
      const p = await tx.player.update({
        where: { id: target.id },
        data: { tickets: newTickets },
      });
      await tx.ticketLedger.create({
        data: { playerId: target.id, delta: applied, reason: applied > 0 ? 'admin_grant' : 'admin_revoke' },
      });
      return { userTag, tickets: p.tickets, applied };
    });
    if (!updated) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    await logAdminAction(session, 'set_tickets', 'player', userTag, { applied: updated.applied, balance: updated.tickets });
    return NextResponse.json({ ok: true, ...updated });
  }

  if (action === 'force_wallet_reset') {
    if (!RESET_ENABLED) {
      return NextResponse.json(
        { error: 'force_wallet_reset is disabled. Set ADMIN_FORCE_WALLET_RESET=1 in the server environment to enable it.' },
        { status: 403 },
      );
    }
    const count = await forceWalletReset();
    await logAdminAction(session, 'force_wallet_reset', 'system', 'all-players', { playersReset: count });
    return NextResponse.json({ ok: true, playersReset: count });
  }

  // ── Cyber Pass (Season Pass) support tools ────────────────────────────────
  if (action === 'cyber_grant_elite') {
    const userTag = String(body.userTag || '').trim();
    if (!userTag) return NextResponse.json({ error: 'userTag is required.' }, { status: 400 });
    const target = await db.player.findUnique({ where: { userTag }, select: { id: true, hasElitePass: true } });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    if (target.hasElitePass) return NextResponse.json({ error: 'Player already has the Elite Pass.' }, { status: 400 });

    const updated = await db.player.update({ where: { id: target.id }, data: { hasElitePass: true } });
    // Comp: no chip deduction (real purchases keep their own Purchase row via
    // /api/season-pass/unlock-elite). Audit log is the only trail, matching
    // the revoke_pass policy.
    await logAdminAction(session, 'cyber_grant_elite', 'player', userTag, { previousHasElitePass: target.hasElitePass });
    return NextResponse.json({ ok: true, userTag, hasElitePass: updated.hasElitePass });
  }

  if (action === 'cyber_set_xp') {
    const userTag = String(body.userTag || '').trim();
    const rawXp = Math.trunc(Number(body.xp));
    if (!userTag || !Number.isFinite(rawXp) || rawXp < 0 || rawXp > 1_000_000) {
      return NextResponse.json({ error: 'userTag and an xp value between 0 and 1,000,000 are required.' }, { status: 400 });
    }
    const target = await db.player.findUnique({ where: { userTag }, select: { id: true, passXp: true } });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const updated = await db.player.update({ where: { id: target.id }, data: { passXp: rawXp } });
    await logAdminAction(session, 'cyber_set_xp', 'player', userTag, { previousPassXp: target.passXp, newPassXp: rawXp });
    return NextResponse.json({ ok: true, userTag, previousPassXp: target.passXp, passXp: updated.passXp });
  }

  if (action === 'cyber_unclaim') {
    const userTag = String(body.userTag || '').trim();
    const tier = Math.trunc(Number(body.tier));
    const track = String(body.track || '');
    if (!userTag || !['free', 'elite'].includes(track) || tier < 1 || tier > 20) {
      return NextResponse.json({ error: 'userTag, track (free|elite) and tier (1-20) are required.' }, { status: 400 });
    }
    const field = track === 'free' ? 'passClaimedFree' : 'passClaimedElite';
    const updated = await db.$transaction(async (tx) => {
      const target = await tx.player.findUnique({ where: { userTag } });
      if (!target) return null;
      let claimed: number[] = [];
      try { claimed = JSON.parse(target[field] || '[]'); if (!Array.isArray(claimed)) claimed = []; } catch { claimed = []; }
      if (!claimed.includes(tier)) return { userTag, tier, track, removed: false, claimed };
      const next = claimed.filter((t) => t !== tier);
      const p = await tx.player.update({ where: { id: target.id }, data: { [field]: JSON.stringify(next) } });
      return { userTag, tier, track, removed: true, claimed: JSON.parse(p[field] || '[]') as number[] };
    });
    if (!updated) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    if (!updated.removed) {
      return NextResponse.json({ error: `Tier ${tier} (${track}) was not claimed by this player.` }, { status: 400 });
    }
    // NOTE: chips/cosmetic already granted stay with the player — this only
    // re-opens the claim so the pass can re-award it.
    await logAdminAction(session, 'cyber_unclaim', 'player', userTag, { tier, track });
    return NextResponse.json({ ok: true, ...updated, note: 'Claim re-opened. Already-granted chips/cosmetics were NOT clawed back.' });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
