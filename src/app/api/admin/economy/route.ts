import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-helpers';
import { logAdminAction } from '@/lib/audit';
import { passPlanById, PASS_PLANS } from '@/lib/pass-catalog';
import { creditPassPurchase } from '@/lib/pass-order';
import { walletResetStatus, forceWalletReset } from '@/lib/year-rollover';

// Admin economy controls for the Time Pass / Ticket system (locked spec
// 2026-09-04). Mirrors the modify-chips route's session+audit pattern.
//
// GET  → reset status + pass plan catalog + active-pass count.
// POST → { action: 'grant_pass',   userTag, sku }
//        { action: 'set_tickets',  userTag, delta }        // +grant / -revoke
//        { action: 'force_wallet_reset' }                   // immediate Jan-1-style reset
export async function GET() {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const [status, activePasses, totalTickets] = await Promise.all([
    walletResetStatus(),
    db.player.count({ where: { adFreeUntil: { gt: new Date() } } }),
    db.player.aggregate({ _sum: { tickets: true } }),
  ]);

  return NextResponse.json({
    walletReset: status,
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
    const count = await forceWalletReset();
    await logAdminAction(session, 'force_wallet_reset', 'system', 'all-players', { playersReset: count });
    return NextResponse.json({ ok: true, playersReset: count });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
