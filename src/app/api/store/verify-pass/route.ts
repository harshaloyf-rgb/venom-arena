import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { playerActionLimit } from '@/lib/api-helpers';
import { passPlanForProduct } from '@/lib/pass-catalog';
import { creditPassPurchase } from '@/lib/pass-order';
import {
  acknowledgeAndroidPurchase,
  IapNotConfiguredError,
  IapVerificationError,
  verifyAndroidPurchase,
  verifyAppleJws,
} from '@/lib/iap-verifier';

// POST /api/store/verify-pass — server-authoritative IAP verification +
// Time Pass crediting (ad-free entitlement + bundled Virtual Tickets).
//
// Body (same shapes as /api/store/verify):
//   { platform: 'android', productId, purchaseToken }
//   { platform: 'ios',     productId, signedTransaction }
//
// Flow: auth -> rate limit -> pass catalog lookup (server-side duration +
// tickets!) -> store verification (Google androidpublisher / Apple JWS) ->
// idempotent credit (stacking adFreeUntil + upfront tickets in one
// transaction) -> optional Android acknowledgement.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const playerId = session.playerId;

  const rl = playerActionLimit(playerId, 'store-verify-pass', 10, 60_000);
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
    (body.id as string | undefined) ??
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

  // Chip pack product ids are REJECTED here — the pack catalog and this pass
  // catalog are deliberately disjoint.
  const plan = passPlanForProduct(productId);
  if (!plan) {
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

    const result = await creditPassPurchase({
      playerId,
      plan,
      store: platform === 'android' ? 'play' : 'appstore',
      storeTxId,
      verifierNote,
    });

    // Acknowledge AFTER crediting (non-fatal on failure — Play gives 3 days).
    if (platform === 'android' && needsAck && ackArgs && !result.alreadyCredited) {
      await acknowledgeAndroidPurchase(ackArgs);
    }

    return NextResponse.json({
      credited: !result.alreadyCredited,
      alreadyCredited: result.alreadyCredited,
      sku: plan.id,
      adFreeUntil: result.adFreeUntil,
      tickets: result.tickets,
      ticketsGranted: result.ticketsGranted,
      orderId: result.orderId,
    });
  } catch (e) {
    if (e instanceof IapNotConfiguredError) {
      console.error(`[store/verify-pass] not configured (${e.platform}):`, e.message);
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
    console.error('[store/verify-pass] error', e);
    return NextResponse.json({ error: 'Verification failed. Please try again.', code: 'internal' }, { status: 500 });
  }
}

// GET /api/store/verify-pass — current Time Pass + ticket status for the
// signed-in player (used by the Vault panel on mount).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const player = await db.player.findUnique({
    where: { id: session.playerId },
    select: { adFreeUntil: true, tickets: true },
  });
  if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
  return NextResponse.json({
    adFreeUntil: player.adFreeUntil,
    passActive: !!player.adFreeUntil && player.adFreeUntil.getTime() > Date.now(),
    tickets: player.tickets,
  });
}
