// Server-side purchase verification for real-money IAP.
//
// Android (Google Play Billing):
//   Client passes the raw `purchaseToken` from the Play Billing purchase.
//   We authenticate as a Google service account (JWT bearer grant, RS256 via
//   the already-bundled `jsonwebtoken`), then call the Android Publisher API
//   `purchases.products.get` and assert packageName/productId/purchaseState.
//   Consumables are acknowledged server-side when the client hasn't already.
//
// iOS (StoreKit 2):
//   Client passes the `signedTransaction` JWS emitted by StoreKit 2.
//   We verify the JWS signature against the leaf x5c certificate, walk the
//   certificate chain up to the embedded Apple Root CA - G3, then assert
//   bundleId/productId and extract the transactionId.
//
// Env vars (all optional at build time — routes degrade to 503 until set):
//   GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL   service-account@project.iam.gserviceaccount.com
//   GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY  PEM with literal \n escapes
//   GOOGLE_PLAY_PACKAGE_NAME            default: gg.venomarena.app
//   APPLE_BUNDLE_ID                     default: gg.venomarena.app
//
// See IAP-SETUP.md at the repo root for full setup instructions.
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { APPLE_ROOT_CA_G3_PEM } from '@/lib/apple-root';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ANDROIDPUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const ANDROIDPUBLISHER_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

export const DEFAULT_PACKAGE_NAME = 'gg.venomarena.app';
export const DEFAULT_APPLE_BUNDLE_ID = 'gg.venomarena.app';

// ---------------------------------------------------------------------------
// Errors — mapped to HTTP statuses by the route layer
// ---------------------------------------------------------------------------

export class IapNotConfiguredError extends Error {
  readonly platform: string;
  constructor(platform: string, missing: string) {
    super(`Billing is not configured on the server (${platform}: ${missing}).`);
    this.platform = platform;
  }
}

export class IapVerificationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Android — Google Play Billing
// ---------------------------------------------------------------------------

export interface GoogleServiceAccountConfig {
  email: string;
  privateKey: string;
  packageName: string;
}

export function googleServiceAccountConfig(env: NodeJS.ProcessEnv = process.env): GoogleServiceAccountConfig | null {
  const email = env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (!email || !rawKey) return null;
  // Secrets editors commonly store the PEM with literal \n sequences.
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
  if (!privateKey.includes('BEGIN')) return null;
  const packageName = env.GOOGLE_PLAY_PACKAGE_NAME?.trim() || DEFAULT_PACKAGE_NAME;
  return { email, privateKey, packageName };
}

// Access-token cache — service account JWTs live 1h; refresh 5 min early.
let googleTokenCache: { token: string; expiresAt: number } | null = null;

export interface GoogleTokenFetcherDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

async function getGoogleAccessToken(
  config: GoogleServiceAccountConfig,
  deps: GoogleTokenFetcherDeps = {},
): Promise<string> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  if (googleTokenCache && googleTokenCache.expiresAt > now() + 5 * 60_000) {
    return googleTokenCache.token;
  }

  const iat = Math.floor(now() / 1000);
  const assertion = jwt.sign(
    {
      iss: config.email,
      scope: ANDROIDPUBLISHER_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat,
      exp: iat + 3600,
    },
    config.privateKey,
    { algorithm: 'RS256' },
  );

  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new IapVerificationError(`Google auth failed (HTTP ${res.status}). ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new IapVerificationError('Google auth returned no access token.');
  }
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  googleTokenCache = { token: data.access_token, expiresAt: now() + expiresIn * 1000 };
  return data.access_token;
}

export interface AndroidPurchaseResult {
  kind: 'android';
  storeTxId: string; // the purchaseToken (idempotency key)
  orderId: string | null;
  acknowledged: boolean;
  purchaseState: number;
  raw: Record<string, unknown>;
}

interface AndroidPurchaseResponse {
  purchaseState?: number;
  acknowledgementState?: number;
  packageName?: string;
  productId?: string;
  orderId?: string;
  purchaseToken?: string;
  [key: string]: unknown;
}

export const PURCHASE_STATE_PURCHASED = 0;
export const PURCHASE_STATE_CANCELLED = 1;
export const PURCHASE_STATE_PENDING = 2;

export async function verifyAndroidPurchase(
  args: { productId: string; purchaseToken: string },
  deps: GoogleTokenFetcherDeps & { env?: NodeJS.ProcessEnv } = {},
): Promise<AndroidPurchaseResult> {
  const config = googleServiceAccountConfig(deps.env ?? process.env);
  if (!config) {
    throw new IapNotConfiguredError('android', 'GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL / _PRIVATE_KEY');
  }
  const fetchImpl = deps.fetchImpl ?? fetch;

  const url = `${ANDROIDPUBLISHER_BASE}/${encodeURIComponent(config.packageName)}/purchases/products/${encodeURIComponent(args.productId)}/tokens/${encodeURIComponent(args.purchaseToken)}`;
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${await getGoogleAccessToken(config, deps)}` },
  });
  if (res.status === 404 || res.status === 400) {
    throw new IapVerificationError('Purchase token not found — it may be forged, refunded, or from another app.');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new IapVerificationError(`Google Play verification failed (HTTP ${res.status}). ${body.slice(0, 200)}`);
  }
  const payload = (await res.json()) as AndroidPurchaseResponse;

  if (payload.packageName && payload.packageName !== config.packageName) {
    throw new IapVerificationError('Purchase belongs to a different app.');
  }
  if (payload.productId && payload.productId !== args.productId) {
    throw new IapVerificationError('Purchase product does not match the requested pack.');
  }
  const purchaseState = payload.purchaseState ?? -1;
  if (purchaseState === PURCHASE_STATE_CANCELLED) {
    throw new IapVerificationError('Purchase was cancelled or refunded.');
  }
  if (purchaseState === PURCHASE_STATE_PENDING) {
    throw new IapVerificationError('Purchase is still pending payment — chips will not be credited yet.');
  }
  if (purchaseState !== PURCHASE_STATE_PURCHASED) {
    throw new IapVerificationError(`Unexpected purchase state (${purchaseState}).`);
  }

  return {
    kind: 'android',
    storeTxId: args.purchaseToken,
    orderId: payload.orderId ?? null,
    acknowledged: payload.acknowledgementState === 1,
    purchaseState,
    raw: payload as Record<string, unknown>,
  };
}

// Server-side acknowledgement (Play requires acknowledgement within 3 days;
// the client plugin usually finishes/consumes, this is the belt-and-suspenders).
export async function acknowledgeAndroidPurchase(
  args: { productId: string; purchaseToken: string },
  deps: GoogleTokenFetcherDeps & { env?: NodeJS.ProcessEnv } = {},
): Promise<boolean> {
  const config = googleServiceAccountConfig(deps.env ?? process.env);
  if (!config) return false;
  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const token = await getGoogleAccessToken(config, deps);
    const url = `${ANDROIDPUBLISHER_BASE}/${encodeURIComponent(config.packageName)}/purchases/products/${encodeURIComponent(args.productId)}/tokens/${encodeURIComponent(args.purchaseToken)}:acknowledge`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return res.ok;
  } catch (e) {
    console.error('[iap-verifier] android acknowledge failed (non-fatal)', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// iOS — StoreKit 2 signed transactions (JWS)
// ---------------------------------------------------------------------------

export interface AppleBundleConfig {
  bundleId: string;
}

export function appleBundleConfig(env: NodeJS.ProcessEnv = process.env): AppleBundleConfig | null {
  // APPLE_BUNDLE_ID is what we check the JWS against — it is required so a
  // transaction from ANY other app can never be accepted by default.
  const bundleId = env.APPLE_BUNDLE_ID?.trim();
  if (!bundleId) return null;
  return { bundleId };
}

export interface IosTransactionResult {
  kind: 'ios';
  storeTxId: string; // Apple transactionId (idempotency key)
  orderId: string | null; // originalTransactionId
  environment: 'Sandbox' | 'Production' | 'LocalTesting' | string;
  productId: string;
  bundleId: string;
  raw: Record<string, unknown>;
}

interface JwsParts {
  headerB64: string;
  payloadB64: string;
  signatureB64: string;
  signingInput: string;
  header: { x5c?: string[]; alg?: string };
  payload: Record<string, unknown>;
}

function splitJws(jws: string): JwsParts {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new IapVerificationError('Malformed signed transaction.');
  const b64urlToJson = (b64: string): unknown => {
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    try {
      return JSON.parse(json);
    } catch {
      throw new IapVerificationError('Malformed signed transaction payload.');
    }
  };
  return {
    headerB64: parts[0],
    payloadB64: parts[1],
    signatureB64: parts[2],
    signingInput: `${parts[0]}.${parts[1]}`,
    header: b64urlToJson(parts[0]) as JwsParts['header'],
    payload: b64urlToJson(parts[1]) as Record<string, unknown>,
  };
}

function pemFromB64Der(b64: string, label = 'CERTIFICATE'): string {
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

// Verify `cert` was signed by `issuer`'s public key and is currently time-valid.
function certSignedBy(cert: crypto.X509Certificate, issuer: crypto.X509Certificate): boolean {
  if (!cert.verify(issuer.publicKey)) return false;
  const now = new Date();
  return new Date(cert.validFrom) <= now && now <= new Date(cert.validTo);
}

export async function verifyAppleJws(
  args: { signedTransaction: string; expectedProductId?: string },
  deps: { env?: NodeJS.ProcessEnv; rootPem?: string; now?: () => Date } = {},
): Promise<IosTransactionResult> {
  const env = deps.env ?? process.env;
  const config = appleBundleConfig(env);
  if (!config) {
    throw new IapNotConfiguredError('ios', 'APPLE_BUNDLE_ID');
  }
  const rootPem = deps.rootPem ?? APPLE_ROOT_CA_G3_PEM;
  const now = deps.now ?? (() => new Date());

  const parts = splitJws(args.signedTransaction);
  const x5c = parts.header.x5c;
  if (!Array.isArray(x5c) || x5c.length < 1) {
    throw new IapVerificationError('Signed transaction has no certificate chain.');
  }

  // JWS signature check against the leaf certificate from x5c[0].
  let leaf: crypto.X509Certificate;
  try {
    leaf = new crypto.X509Certificate(pemFromB64Der(x5c[0]));
  } catch {
    throw new IapVerificationError('Invalid leaf certificate in signed transaction.');
  }
  const signature = Buffer.from(parts.signatureB64, 'base64url');
  const signed = Buffer.from(parts.signingInput, 'utf8');
  // Apple signs StoreKit 2 JWS with ES256 — the signature is raw r||s
  // (ieee-p1363), NOT the DER encoding crypto.verify defaults to for EC keys.
  const isEc = leaf.publicKey.asymmetricKeyType === 'ec';
  const ok = isEc
    ? crypto.verify('sha256', signed, { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' }, signature)
    : crypto.verify('sha256', signed, leaf.publicKey, signature);
  if (!ok) {
    throw new IapVerificationError('Signed transaction failed signature verification.');
  }

  // Chain walk: cert[i] must be signed by cert[i+1]; the last chain cert must
  // be signed by (or be) the embedded Apple Root CA - G3.
  const chain = x5c.map((b64) => {
    try {
      return new crypto.X509Certificate(pemFromB64Der(b64));
    } catch {
      throw new IapVerificationError('Invalid certificate in signed transaction chain.');
    }
  });
  for (let i = 0; i < chain.length - 1; i++) {
    if (!certSignedBy(chain[i], chain[i + 1])) {
      throw new IapVerificationError('Certificate chain is not internally consistent.');
    }
  }
  const root = new crypto.X509Certificate(rootPem);
  const last = chain[chain.length - 1];
  const lastIsRoot = last.fingerprint256 === root.fingerprint256;
  if (!lastIsRoot && !certSignedBy(last, root)) {
    throw new IapVerificationError('Transaction does not chain to the Apple Root CA - G3.');
  }

  // Leaf must be currently valid.
  if (!(new Date(leaf.validFrom) <= now() && now() <= new Date(leaf.validTo))) {
    throw new IapVerificationError('Transaction certificate is expired or not yet valid.');
  }

  // Payload assertions (Apple fields: transactionId, bundleId, productId, environment).
  const transactionId = parts.payload.transactionId;
  const bundleId = parts.payload.bundleId;
  const productId = parts.payload.productId;
  if (typeof transactionId !== 'string' || transactionId.length === 0) {
    throw new IapVerificationError('Signed transaction has no transactionId.');
  }
  if (bundleId !== config.bundleId) {
    throw new IapVerificationError('Transaction belongs to a different app.');
  }
  if (args.expectedProductId && productId !== args.expectedProductId) {
    throw new IapVerificationError('Transaction product does not match the requested pack.');
  }

  return {
    kind: 'ios',
    storeTxId: transactionId,
    orderId: typeof parts.payload.originalTransactionId === 'string' ? parts.payload.originalTransactionId : null,
    environment: typeof parts.payload.environment === 'string' ? parts.payload.environment : 'Unknown',
    productId: String(productId ?? ''),
    bundleId: String(bundleId),
    raw: parts.payload,
  };
}

// Convenience flags for /api/store/status + UI hinting.
export function billingStatus(env: NodeJS.ProcessEnv = process.env): { android: boolean; ios: boolean } {
  return {
    android: googleServiceAccountConfig(env) !== null,
    ios: appleBundleConfig(env) !== null,
  };
}
