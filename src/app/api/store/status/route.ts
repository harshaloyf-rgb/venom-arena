import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { yearlyPurchasedChips } from '@/lib/store-order';
import { allStoreProducts, STORE_YEARLY_CAP_CHIPS, STORE_YEARLY_CAP_INR } from '@/lib/store-catalog';
import { billingStatus } from '@/lib/iap-verifier';

// GET /api/store/status — purchase availability for the signed-in player.
// Used by the chip-store panel on mount (replaces the old localStorage
// yearly counter with server truth) and by support to answer "why can't
// I buy?" tickets (per-store configured flags).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const [yearlyPurchased, billing] = await Promise.all([
    yearlyPurchasedChips(session.playerId),
    Promise.resolve(billingStatus()),
  ]);

  return NextResponse.json({
    yearlyPurchased,
    yearlyCap: STORE_YEARLY_CAP_CHIPS,
    yearlyCapINR: STORE_YEARLY_CAP_INR,
    storeLocked: yearlyPurchased >= STORE_YEARLY_CAP_CHIPS,
    billingConfigured: billing,
    products: allStoreProducts(),
  });
}
