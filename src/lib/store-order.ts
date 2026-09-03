// Idempotent crediting of verified store purchases.
//
// The StoreOrder.storeTxId UNIQUE constraint is the hard guarantee: the
// create + chip-increment happen inside one transaction, so a replayed
// purchase token / transactionId resolves to the ORIGINAL order and credits
// nothing again. Yearly store-policy cap (25 Lakh chips) is re-checked inside
// the same transaction to make it race-proof.
import { db } from '@/lib/db';
import { currentYearWindow, STORE_YEARLY_CAP_CHIPS } from '@/lib/store-catalog';

export class YearlyCapError extends Error {
  readonly purchasedThisYear: number;
  constructor(purchasedThisYear: number) {
    super('YEARLY_CAP');
    this.purchasedThisYear = purchasedThisYear;
  }
}

export interface CreditStorePurchaseArgs {
  playerId: string;
  platform: 'android' | 'ios';
  packId: string;
  productId: string;
  storeTxId: string;
  chips: number;
  pricePaidINR?: number | null;
  verifierNote?: string | null;
}

export interface CreditStorePurchaseResult {
  alreadyCredited: boolean;
  credited: number;
  balance: number;
  yearlyPurchased: number;
  yearlyCap: number;
  storeLocked: boolean;
  orderId: string;
}

export async function yearlyPurchasedChips(playerId: string, now = new Date()): Promise<number> {
  const { start, end } = currentYearWindow(now);
  const agg = await db.storeOrder.aggregate({
    where: { playerId, status: 'completed', createdAt: { gte: start, lt: end } },
    _sum: { chips: true },
  });
  return agg._sum.chips ?? 0;
}

export async function creditStorePurchase(args: CreditStorePurchaseArgs): Promise<CreditStorePurchaseResult> {
  const { start, end } = currentYearWindow();

  return db.$transaction(async (tx) => {
    // Idempotency: same store transaction => return the original credit.
    const existing = await tx.storeOrder.findUnique({ where: { storeTxId: args.storeTxId } });
    if (existing) {
      const player = await tx.player.findUniqueOrThrow({ where: { id: args.playerId } });
      const purchasedThisYear = await tx.storeOrder.aggregate({
        where: { playerId: args.playerId, status: 'completed', createdAt: { gte: start, lt: end } },
        _sum: { chips: true },
      });
      const yearly = purchasedThisYear._sum.chips ?? 0;
      return {
        alreadyCredited: true,
        credited: existing.chips,
        balance: player.bankedChips,
        yearlyPurchased: yearly,
        yearlyCap: STORE_YEARLY_CAP_CHIPS,
        storeLocked: yearly >= STORE_YEARLY_CAP_CHIPS,
        orderId: existing.id,
      };
    }

    // Yearly cap — re-checked inside the transaction (race-proof).
    const purchasedThisYear = await tx.storeOrder.aggregate({
      where: { playerId: args.playerId, status: 'completed', createdAt: { gte: start, lt: end } },
      _sum: { chips: true },
    });
    const yearly = purchasedThisYear._sum.chips ?? 0;
    if (yearly + args.chips > STORE_YEARLY_CAP_CHIPS) {
      throw new YearlyCapError(yearly);
    }

    const player = await tx.player.update({
      where: { id: args.playerId },
      data: {
        bankedChips: { increment: args.chips },
        totalEarned: { increment: args.chips },
      },
    });
    const order = await tx.storeOrder.create({
      data: {
        playerId: args.playerId,
        platform: args.platform,
        packId: args.packId,
        productId: args.productId,
        storeTxId: args.storeTxId,
        chips: args.chips,
        pricePaidINR: args.pricePaidINR ?? null,
        status: 'completed',
        verifierNote: args.verifierNote ?? null,
      },
    });

    return {
      alreadyCredited: false,
      credited: args.chips,
      balance: player.bankedChips,
      yearlyPurchased: yearly + args.chips,
      yearlyCap: STORE_YEARLY_CAP_CHIPS,
      storeLocked: yearly + args.chips >= STORE_YEARLY_CAP_CHIPS,
      orderId: order.id,
    };
  });
}
