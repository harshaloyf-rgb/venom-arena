/// <reference types="cordova-plugin-purchase" />

// Native in-app purchase bridge (Google Play Billing / Apple StoreKit 2).
//
// Architecture (server-authoritative):
//   1. purchase flow via cordova-plugin-purchase v13 (the APK adds the native
//      side — see IAP-SETUP.md; the Capacitor shell injects the bridge into
//      the remote-loaded web app, so this module works inside the deployed app).
//   2. purchase proof (Android purchaseToken / iOS StoreKit 2 JWS) is posted
//      to /api/store/verify — the SERVER verifies with Google/Apple and
//      credits chips idempotently.
//   3. only after the server confirms the credit do we finish() the native
//      transaction. If the app dies mid-flow, the transaction re-fires as
//      `approved` on the next launch and is auto-reconciled below.
//
// On web/PWA (no native bridge) `nativeBillingAvailable()` is false and the
// chip-store shows "buy in the mobile app" instead — real IAP is only
// possible inside the store-installed app anyway (Play/App Store policy).
import { Capacitor } from '@capacitor/core';
import { allStoreProducts } from '@/lib/store-catalog';

type AnyTransaction = CdvPurchase.Transaction & {
  nativePurchase?: {
    purchaseToken?: string;
    jwsRepresentation?: string;
    transactionReceipt?: string;
    transactions?: { jwsRepresentation?: string; transactionReceipt?: string }[];
  };
};

export type IapPlatform = 'android' | 'ios';

export interface PurchaseProof {
  platform: IapPlatform;
  productId: string;
  purchaseToken?: string; // Android — Google Play Billing purchase token
  signedTransaction?: string; // iOS — StoreKit 2 signedTransaction JWS
  finish: () => Promise<void>;
}

export class IapError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Capacitor.isNativePlatform() === true;
  } catch {
    return false;
  }
}

export function nativeBillingAvailable(): boolean {
  if (!isNativeApp()) return false;
  const Cdv = (window as unknown as { CdvPurchase?: { store?: unknown } }).CdvPurchase;
  return !!Cdv?.store;
}

function currentStorePlatform(): CdvPurchase.Platform {
  return Capacitor.getPlatform() === 'ios'
    ? CdvPurchase.Platform.APPLE_APPSTORE
    : CdvPurchase.Platform.GOOGLE_PLAY;
}

function storeApi(): CdvPurchase.Store {
  const Cdv = (window as unknown as { CdvPurchase?: { store?: CdvPurchase.Store } }).CdvPurchase;
  if (!Cdv?.store) {
    throw new IapError(
      'BILLING_UNAVAILABLE',
      'In-app billing is not available on this device build. Please update the app.',
    );
  }
  return Cdv.store;
}

// ---------------------------------------------------------------------------
// Store lifecycle — init once per page load
// ---------------------------------------------------------------------------

let initPromise: Promise<void> | null = null;
let applicationUsername = '';

// Deterministic UUIDv3-style hash of the player id. Sent to the stores as
// Google's obfuscatedAccountId / Apple's appAccountToken so a purchase is
// bound to the account server-side as well (fraud triage / support).
function usernameForPlayer(playerId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < playerId.length; i++) {
    h ^= playerId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hex = (h.toString(16) + playerId.length.toString(16)).padStart(8, '0');
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(2, 5)}-${(hex + hex).slice(0, 12)}`;
}

async function initStore(playerId: string): Promise<void> {
  const store = storeApi();
  const platform = currentStorePlatform();

  // One-time listeners. Registered before any order() so no approval is missed.
  if (!initPromise) {
    const products = allStoreProducts().map((p) => ({
      id: p.productId,
      type: CdvPurchase.ProductType.CONSUMABLE as CdvPurchase.ProductType,
      platform,
    }));

    initPromise = new Promise<void>((resolve, reject) => {
      store.error((err) => {
        console.error('[iap] store error', err.code, err.message);
      });
      store.when()
        .approved((tx) => onApproved(tx));
      // Cancellation surfaces via store.order() resolving with
      // ErrorCode.PAYMENT_CANCELLED — no separate When.cancelled handler in v13.
      store.register(products);
      store.initialize([platform]).then((errs) => {
        const fatal = (errs ?? []).find((e) => e.code === CdvPurchase.ErrorCode.SETUP || e.code === CdvPurchase.ErrorCode.LOAD);
        if (fatal) {
          reject(new IapError('PRODUCT_LOAD_FAILED', 'Could not load store products. Check your connection and try again.'));
          return;
        }
        // Auto-reconcile any unfinished purchase from a previous session
        // (approved but not verified/finished — e.g. app killed mid-flow).
        void reconcileUnfinished();
        resolve();
      }).catch((e) => reject(e));
    }).catch((e) => {
      initPromise = null; // allow retry on next tap
      throw e;
    });
  }

  await initPromise;
  if (applicationUsername !== usernameForPlayer(playerId)) {
    applicationUsername = usernameForPlayer(playerId);
    try {
      (store as unknown as { applicationUsername: string; obfuscationStrategy?: string }).applicationUsername = applicationUsername;
      (store as unknown as { obfuscationStrategy?: string }).obfuscationStrategy = 'legacy';
    } catch {
      // Older plugin builds — account binding is best-effort.
    }
  }
}

// ---------------------------------------------------------------------------
// Approved-transaction handling (waiter for the active purchase + recovery)
// ---------------------------------------------------------------------------

interface ActiveWaiter {
  productId: string;
  resolve: (tx: AnyTransaction) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
let activeWaiter: ActiveWaiter | null = null;
// Approved transactions that arrived with no waiter (purchase finished while
// the verify call was in flight, or reconcile-after-restart) — proof lookup.
const orphanApproved = new Map<string, AnyTransaction>();

function extractProof(tx: AnyTransaction, platform: IapPlatform): { purchaseToken?: string; signedTransaction?: string } {
  if (platform === 'android') {
    // GooglePlay.Receipt.purchaseToken (v13) with fallbacks across minor versions.
    const receipt = tx.parentReceipt as unknown as { purchaseToken?: string } | undefined;
    const token =
      receipt?.purchaseToken ??
      tx.nativePurchase?.purchaseToken ??
      (tx.parentReceipt as unknown as { transactions?: { purchaseToken?: string }[] } | undefined)
        ?.transactions?.slice(-1)?.[0]?.purchaseToken;
    return { purchaseToken: token || undefined };
  }
  // iOS StoreKit 2: the JWS rides on the native purchase / receipt transaction.
  const jws =
    tx.nativePurchase?.jwsRepresentation ??
    tx.nativePurchase?.transactions?.slice(-1)?.[0]?.jwsRepresentation ??
    (tx.parentReceipt as unknown as { jwsRepresentation?: string } | undefined)?.jwsRepresentation;
  return { signedTransaction: jws || undefined };
}

function onApproved(tx: AnyTransaction): void {
  const productId = tx.products?.[0]?.id ?? '';
  if (activeWaiter && (productId === activeWaiter.productId || activeWaiter.productId === '*')) {
    clearTimeout(activeWaiter.timer);
    const waiter = activeWaiter;
    activeWaiter = null;
    waiter.resolve(tx);
    return;
  }
  // No UI waiter — remember for reconciliation.
  orphanApproved.set(productId, tx);
  void reconcileProduct(productId, tx);
}

async function reconcileUnfinished(): Promise<void> {
  // Best-effort: v13 re-emits approved for unfinished transactions when the
  // listeners attach; anything caught lands in orphanApproved and is credited
  // by reconcileProduct. Nothing to scan manually here — the handler covers it.
}

async function reconcileProduct(productId: string, tx: AnyTransaction): Promise<void> {
  const platform: IapPlatform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  const proof = extractProof(tx, platform);
  if (platform === 'android' && !proof.purchaseToken) return;
  if (platform === 'ios' && !proof.signedTransaction) return;
  try {
    const res = await fetch('/api/store/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, productId, ...proof }),
    });
    if (res.ok) {
      orphanApproved.delete(productId);
      await tx.finish();
      console.info('[iap] reconciled unfinished purchase', productId);
    } else {
      console.warn('[iap] reconcile verify failed', res.status, '- transaction left unfinished for retry');
    }
  } catch (e) {
    console.warn('[iap] reconcile network error - transaction left unfinished for retry', e);
  }
}

// ---------------------------------------------------------------------------
// Public flow: purchase -> verify server-side -> finish
// ---------------------------------------------------------------------------

export interface CompletedPurchase {
  credited: number;
  alreadyCredited: boolean;
  balance: number;
  yearlyPurchased: number;
  yearlyCap: number;
  storeLocked: boolean;
}

export interface CompletedPassPurchase {
  alreadyCredited: boolean;
  sku: string;
  adFreeUntil: string | null;
  tickets: number;
  ticketsGranted: number;
}

const PURCHASE_TIMEOUT_MS = 3 * 60_000; // covers slow payment dialogs

interface PurchaseCore {
  tx: AnyTransaction;
  platformId: IapPlatform;
  proof: { purchaseToken?: string; signedTransaction?: string };
}

/** Shared store purchase core: order → wait for approved → extract proof. */
async function runPurchase(productId: string, playerId: string, what: string): Promise<PurchaseCore> {
  await initStore(playerId);
  const store = storeApi();
  const platform = currentStorePlatform();

  const product = store.get(productId, platform);
  const offer = product?.offers?.[0];
  if (!product || !offer) {
    throw new IapError('PRODUCT_UNAVAILABLE', `This ${what} is not available in the store yet. Try again shortly.`);
  }

  const proofPromise = new Promise<AnyTransaction>((resolve, reject) => {
    if (activeWaiter) {
      reject(new IapError('ALREADY_PURCHASING', 'Another purchase is already in progress.'));
      return;
    }
    const timer = setTimeout(() => {
      activeWaiter = null;
      reject(new IapError('TIMEOUT', `Purchase did not complete in time. If you were charged, the ${what} is credited on next app start.`));
    }, PURCHASE_TIMEOUT_MS);
    activeWaiter = { productId, resolve, reject, timer };
  });

  let tx: AnyTransaction;
  try {
    // applicationUsername is set at store level (initStore) — adapters read it
    // from there for obfuscatedAccountId / appAccountToken binding.
    const orderErr = await store.order(offer);
    if (orderErr) {
      if (activeWaiter) {
        clearTimeout(activeWaiter.timer);
        activeWaiter = null;
      }
      const cancelled = orderErr.code === CdvPurchase.ErrorCode.PAYMENT_CANCELLED;
      throw new IapError(
        cancelled ? 'PAYMENT_CANCELLED' : 'ORDER_FAILED',
        cancelled ? 'Purchase cancelled.' : orderErr.message || 'Purchase could not be started.',
      );
    }
    tx = await proofPromise;
  } finally {
    if (activeWaiter) {
      clearTimeout(activeWaiter.timer);
      activeWaiter = null;
    }
  }

  const platformId: IapPlatform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  const proof = extractProof(tx, platformId);
  if (platformId === 'android' && !proof.purchaseToken) {
    throw new IapError('NO_PROOF', `Purchase receipt missing from the store response — the ${what} will be credited automatically on next app start.`);
  }
  if (platformId === 'ios' && !proof.signedTransaction) {
    throw new IapError('NO_PROOF', `Purchase receipt missing from the store response — the ${what} will be credited automatically on next app start.`);
  }

  return { tx, platformId, proof };
}

/** Chip pack flow (dormant unless NEXT_PUBLIC_STORE_CHIPS=true). */
export async function purchaseAndVerify(packId: string, productId: string, playerId: string): Promise<CompletedPurchase> {
  const { tx, platformId, proof } = await runPurchase(productId, playerId, 'pack');

  // Server verification + idempotent credit — the ONLY source of chips.
  const res = await fetch('/api/store/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: platformId, productId, ...proof }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    credited?: number;
    alreadyCredited?: boolean;
    balance?: number;
    yearlyPurchased?: number;
    yearlyCap?: number;
    storeLocked?: boolean;
  };

  if (!res.ok) {
    // Deliberately NOT finishing the transaction: it re-fires `approved` on
    // the next launch and is auto-credited then (or user retried via store).
    throw new IapError(data.code ?? 'VERIFY_FAILED', data.error || 'Purchase verification failed.');
  }

  await tx.finish();

  return {
    credited: data.credited ?? 0,
    alreadyCredited: data.alreadyCredited ?? false,
    balance: data.balance ?? 0,
    yearlyPurchased: data.yearlyPurchased ?? 0,
    yearlyCap: data.yearlyCap ?? 0,
    storeLocked: data.storeLocked ?? false,
  };
}

/** Time Pass flow (locked spec 2026-09-04): ad-free entitlement + tickets. */
export async function purchasePassAndVerify(sku: string, productId: string, playerId: string): Promise<CompletedPassPurchase> {
  const { tx, platformId, proof } = await runPurchase(productId, playerId, 'pass');

  // Server verification + idempotent credit — the ONLY source of the
  // entitlement (stacking adFreeUntil + upfront tickets, server-computed).
  const res = await fetch('/api/store/verify-pass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: platformId, productId, ...proof }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    alreadyCredited?: boolean;
    sku?: string;
    adFreeUntil?: string | null;
    tickets?: number;
    ticketsGranted?: number;
  };

  if (!res.ok) {
    // Deliberately NOT finishing the transaction: it re-fires `approved` on
    // the next launch and is auto-credited then (or user retried via store).
    throw new IapError(data.code ?? 'VERIFY_FAILED', data.error || 'Purchase verification failed.');
  }

  await tx.finish();

  return {
    alreadyCredited: data.alreadyCredited ?? false,
    sku: data.sku ?? sku,
    adFreeUntil: data.adFreeUntil ?? null,
    tickets: data.tickets ?? 0,
    ticketsGranted: data.ticketsGranted ?? 0,
  };
}
