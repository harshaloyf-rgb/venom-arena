import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { playerActionLimit } from '@/lib/api-helpers';
import { catalogEntryForProduct } from '@/lib/store-catalog';
import { creditStorePurchase, yearlyPurchasedChips, YearlyCapError } from '@/lib/store-order';
import { STORE_YEARLY_CAP_CHIPS, STORE_YEARLY_CAP_INR } from '@/lib/store-catalog';
import {
  acknowledgeAndroidPurchase,
  IapNotConfiguredError,
  IapVerificationError,
  verifyAndroidPurchase,
  verifyAppleJws,
} from '@/lib/iap-verifier';

// POST /api/store/verify — server-authoritative IAP verification + crediting.
//
// Body (flat, what our client adapter sends):
//   { platform: 'android', productId, purchaseToken }
//   { platform: 'ios',     productId, signedTransaction }
// (cordova-plugin-purchase validator-style envelopes carrying
//  transaction.purchaseToken / transaction.jws are also normalized here.)
//
// Flow: auth -> rate limit -> catalog lookup (server-side chips!) -> store
// verification (Google androidpublisher / Apple JWS chain) -> idempotent
// credit -> optional Android acknowledgement -> response with new balance.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const playerId = session.playerId;

  const rl = playerActionLimit(playerId, 'store-verify', 10, 60_000);
  if (rl) return rl;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Normalize: accept our flat body or a cordova-plugin-purchase receipt envelope.
  const txLike = (body.transaction as Record<string, unknown> | undefined) ?? {};
  const platformRaw =
    (body.platform as string | undefined) ??
    (body.type === 'ios-appstore' ? 'ios' : undefined) ??
    (body.type === 'android-playstore' ? 'android' : undefined);
  const productIdRaw =
    (body.productId as string | undefined) ??
    (body.id as string | undefined) ?? // plugin receipt envelope: product id at top level
    undefined;
  const purchaseToken =
    (body.purchaseToken as string | undefined) ||
    (txLike.purchaseToken as string | undefined);
  const signedTransaction =
    (body.signedTransaction as string | undefined) ||
    (txLike.jws as string | undefined) ||
    (txLike.jwsTransaction as string | undefined) ||
    (body.jws as string | undefined);

  const platform = platformRaw === 'android' || platformRaw === 'ios' ? platformRaw : null;
  const productId = typeof productIdRaw === 'string' ? productIdRaw.trim() : '';
  if (!platform || !productId) {
    return NextResponse.json(
      { error: 'Missing platform or productId.', code: 'bad_request' },
      { status: 400 },
    );
  }

  const entry = catalogEntryForProduct(productId);
  if (!entry) {
    return NextResponse.json({ error: 'Unknown product.', code: 'unknown_product' }, { status: 400 });
  }

  try {
    let storeTxId: string;
    let verifierNote: string;
    let needsAck = false;
    let ackArgs: { productId: string; purchaseToken: string } | null = null;

    if (platform === 'android') {
      const token = typeof purchaseToken === 'string' ? purchaseToken.trim() : '';
      if (!token) {
        return NextResponse.json({ error: 'Missing purchaseToken.', code: 'bad_request' }, { status: 400 });
      }
      const verified = await verifyAndroidPurchase({ productId, purchaseToken: token });
      storeTxId = verified.storeTxId;
      needsAck = !verified.acknowledged;
      ackArgs = { productId, purchaseToken: token };
      verifierNote = JSON.stringify({ kind: 'android', orderId: verified.orderId });
    } else {
      const jws = typeof signedTransaction === 'string' ? signedTransaction.trim() : '';
      if (!jws) {
        return NextResponse.json({ error: 'Missing signedTransaction.', code: 'bad_request' }, { status: 400 });
      }
      const verified = await verifyAppleJws({ signedTransaction: jws, expectedProductId: productId });
      storeTxId = verified.storeTxId;
      verifierNote = JSON.stringify({
        kind: 'ios',
        environment: verified.environment,
        originalTransactionId: verified.orderId,
      });
    }

    // Idempotent credit + yearly cap inside one DB transaction.
    const result = await creditStorePurchase({
      playerId,
      platform,
      packId: entry.packId,
      productId,
      storeTxId,
      chips: entry.chips,
      pricePaidINR: entry.priceINR,
      verifierNote,
    });

    // Acknowledge AFTER crediting (non-fatal on failure — Play gives 3 days).
    if (platform === 'android' && needsAck && ackArgs && !result.alreadyCredited) {
      await acknowledgeAndroidPurchase(ackArgs);
    }

    return NextResponse.json({
      credited: result.credited,
      alreadyCredited: result.alreadyCredited,
      balance: result.balance,
      yearlyPurchased: result.yearlyPurchased,
      yearlyCap: result.yearlyCap,
      storeLocked: result.storeLocked,
      packId: entry.packId,
    });
  } catch (e) {
    if (e instanceof IapNotConfiguredError) {
      console.error(`[store/verify] not configured (${e.platform}):`, e.message);
      return NextResponse.json(
        { error: 'Purchases are being set up — available very soon.', code: 'store_not_configured' },
        { status: 503 },
      );
    }
    if (e instanceof IapVerificationError) {
      return NextResponse.json(
        { error: e.message, code: 'purchase_verification_failed' },
        { status: 400 },
      );
    }
    if (e instanceof YearlyCapError) {
      return NextResponse.json(
        {
          error: 'Annual buy cap of 25 Lakh Chips (2,500,000) reached — Store locked for 365 days to maintain tournament skill parity.',
          code: 'yearly_cap',
          yearlyPurchased: e.purchasedThisYear,
          yearlyCap: STORE_YEARLY_CAP_CHIPS,
        },
        { status: 403 },
      );
    }
    console.error('[store/verify] error', e);
    return NextResponse.json({ error: 'Verification failed. Please try again.', code: 'internal' }, { status: 500 });
  }
}

// GET /api/store/verify — yearly cap status for the signed-in player
// (the chip-store panel replaces its old localStorage counter with this).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const yearlyPurchased = await yearlyPurchasedChips(session.playerId);
  return NextResponse.json({
    yearlyPurchased,
    yearlyCap: STORE_YEARLY_CAP_CHIPS,
    storeLocked: yearlyPurchased >= STORE_YEARLY_CAP_CHIPS,
    yearlyCapINR: STORE_YEARLY_CAP_INR,
  });
}
