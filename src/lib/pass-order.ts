// Idempotent crediting of verified Time Pass purchases.
//
// Mirrors store-order.ts: PassOrder.storeOrderId is UNIQUE — the create +
// entitlement update happen inside one transaction, so a replayed purchase
// token resolves to the ORIGINAL order and grants nothing again.
//
// Stacking rule (locked spec): a purchase made while a pass is active EXTENDS
// the current expiry by the bought duration (time stacks). Bundled Virtual
// Tickets are credited upfront in the same transaction, with a TicketLedger
// row so any balance can be reconstructed for support.
import { db } from '@/lib/db';
import type { PassPlan } from '@/lib/pass-catalog';

export interface CreditPassPurchaseArgs {
  playerId: string;
  plan: PassPlan; // resolved server-side from the product id (never from the client)
  store: 'play' | 'appstore' | 'admin';
  storeTxId: string; // store order/token (or admin-issued id) — idempotency key
  storeOrderId?: string | null;
  verifierNote?: string | null;
}

export interface CreditPassPurchaseResult {
  alreadyCredited: boolean;
  adFreeUntil: Date;
  tickets: number; // balance after grant
  ticketsGranted: number;
  orderId: string;
}

export async function creditPassPurchase(args: CreditPassPurchaseArgs): Promise<CreditPassPurchaseResult> {
  return db.$transaction(async (tx) => {
    // Idempotency: same store transaction => return the original grant.
    const existing = await tx.passOrder.findUnique({ where: { storeOrderId: args.storeTxId } });
    if (existing) {
      const player = await tx.player.findUniqueOrThrow({ where: { id: args.playerId } });
      return {
        alreadyCredited: true,
        adFreeUntil: player.adFreeUntil ?? new Date(0),
        tickets: player.tickets,
        ticketsGranted: existing.ticketsGranted,
        orderId: existing.id,
      };
    }

    const player = await tx.player.findUniqueOrThrow({ where: { id: args.playerId } });

    // Time stacks: new duration extends max(now, current expiry).
    const now = Date.now();
    const base = Math.max(now, player.adFreeUntil ? player.adFreeUntil.getTime() : 0);
    const adFreeUntilAfter = new Date(base + args.plan.durationDays * 24 * 60 * 60 * 1000);

    const updated = await tx.player.update({
      where: { id: args.playerId },
      data: {
        adFreeUntil: adFreeUntilAfter,
        tickets: { increment: args.plan.tickets },
      },
    });

    const order = await tx.passOrder.create({
      data: {
        playerId: args.playerId,
        sku: args.plan.id,
        durationDays: args.plan.durationDays,
        priceUsdMicros: args.plan.priceUsdMicros,
        store: args.store,
        storeOrderId: args.storeTxId,
        ticketsGranted: args.plan.tickets,
        adFreeUntilAfter,
        verifierNote: args.verifierNote ?? null,
      },
    });

    await tx.ticketLedger.create({
      data: {
        playerId: args.playerId,
        delta: args.plan.tickets,
        reason: 'pass_grant',
        refId: order.id,
      },
    });

    return {
      alreadyCredited: false,
      adFreeUntil: updated.adFreeUntil ?? adFreeUntilAfter,
      tickets: updated.tickets,
      ticketsGranted: args.plan.tickets,
      orderId: order.id,
    };
  });
}
