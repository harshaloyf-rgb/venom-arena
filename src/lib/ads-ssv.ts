// Server-side verification (SSV) for AdMob rewarded ads.
//
// Implements Google's "Manual verification of rewarded SSV" spec exactly:
//   https://developers.google.com/admob/android/ssv
//
// Callback URLs issued by Google always end with the last two query params
// `signature` and `key_id`. The signed content ("dataToVerify") is the RAW
// (still percent-encoded) query string with the trailing `&signature=...`
// and `&key_id=...` parameters removed. The signature is an ECDSA
// (P-256 / SHA-256 / DER) signature made with the private half of the key
// published under `keyId` in Google's verifier-keys JSON.
//
// Verifier keys:  https://www.gstatic.com/admob/reward/verifier-keys.json
//   → { keys: [{ keyId: number, pem: "-----BEGIN PUBLIC KEY-----...", base64: "..." }] }
// Keys rotate — Google says do not cache for longer than 24 hours.
//
// Venom Arena flow (server-authoritative, mirrors the IAP design):
//   1. Client: POST /api/ads/session  → { nonce } (stored in AdRewardSession)
//   2. Client: prepareRewardVideoAd({ adId, ssv: { customData: nonce } }) → show
//   3. Google's servers call OUR SSV callback (configured in the AdMob console):
//      GET /api/ads/ssv?...&custom_data=<nonce>&signature=...&key_id=...
//   4. We verify the signature, claim the nonce (single-use) and credit chips.
//   The client never states amounts and can never mint chips by itself —
//   the legacy client-claimed faucet (POST /api/player/video-reward) was
//   removed for exactly that reason.
import crypto from 'crypto';

export const ADMOB_VERIFIER_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';

// Test-only override: point at a local/static keys JSON (e.g. a data: URL)
// so integration tests can sign callbacks with their own key pair. Never set
// in production — the default URL is Google's official key server.
function verifierKeysUrl(): string {
  return process.env.ADMOB_SSV_KEYS_URL || ADMOB_VERIFIER_KEYS_URL;
}

// Google: keys are rotated on a variable schedule; do not cache longer than 24h.
export const KEYS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type AdSsvErrorCode =
  | 'MISSING_SIGNATURE'
  | 'MISSING_KEY_ID'
  | 'BAD_KEY_ID'
  | 'UNKNOWN_KEY_ID'
  | 'KEYS_FETCH_FAILED'
  | 'BAD_SIGNATURE';

export class AdSsvError extends Error {
  readonly code: AdSsvErrorCode;
  constructor(code: AdSsvErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type FetchFn = typeof fetch;

interface KeysCacheEntry {
  fetchedAt: number;
  keys: Map<number, crypto.KeyObject>;
}
let keysCache: KeysCacheEntry | null = null;

async function fetchVerifierKeys(fetchFn: FetchFn): Promise<Map<number, crypto.KeyObject>> {
  let res: Response;
  try {
    res = await fetchFn(verifierKeysUrl(), { cache: 'no-store' } as RequestInit);
  } catch (e) {
    throw new AdSsvError('KEYS_FETCH_FAILED', `Could not reach AdMob key server: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    throw new AdSsvError('KEYS_FETCH_FAILED', `AdMob key server responded ${res.status}.`);
  }
  const data = (await res.json().catch(() => null)) as { keys?: { keyId?: number | string; pem?: string; base64?: string }[] } | null;
  const map = new Map<number, crypto.KeyObject>();
  for (const k of data?.keys ?? []) {
    const keyId = Number(k.keyId);
    if (!Number.isFinite(keyId)) continue;
    // Prefer the PEM block; fall back to the base64 SPKI body wrapped in PEM.
    const material =
      k.pem ??
      (k.base64 ? `-----BEGIN PUBLIC KEY-----\n${k.base64}\n-----END PUBLIC KEY-----` : undefined);
    if (!material) continue;
    try {
      map.set(keyId, crypto.createPublicKey(material));
    } catch {
      // Skip malformed keys — Google occasionally rotates in new formats.
    }
  }
  if (map.size === 0) {
    throw new AdSsvError('KEYS_FETCH_FAILED', 'AdMob key server returned no usable keys.');
  }
  return map;
}

async function getVerifierKeys(fetchFn: FetchFn): Promise<Map<number, crypto.KeyObject>> {
  if (keysCache && Date.now() - keysCache.fetchedAt < KEYS_CACHE_TTL_MS) {
    return keysCache.keys;
  }
  const keys = await fetchVerifierKeys(fetchFn);
  keysCache = { fetchedAt: Date.now(), keys };
  return keys;
}

/**
 * Pure splitter mirroring Google's RewardedAdsVerifier sample:
 * the data to verify is the raw query string WITHOUT the trailing
 * "&signature=...&key_id=..." (signature & key_id are always last).
 */
export function parseSsvQuery(rawQuery: string): {
  dataToVerify: string;
  signature: string;
  keyId: number;
} {
  const SIGNATURE_PARAM = 'signature=';
  const KEY_ID_PARAM = 'key_id=';
  const i = rawQuery.lastIndexOf(SIGNATURE_PARAM);
  if (i <= 0) {
    // i <= 0: missing, or signature would be the first param (malformed —
    // Google guarantees signature/key_id are the LAST two params).
    throw new AdSsvError('MISSING_SIGNATURE', 'Callback query has no trailing signature parameter.');
  }
  const dataToVerify = rawQuery.slice(0, i - 1); // -1 drops the '&' before signature=
  const sigAndKeyId = rawQuery.slice(i);
  const j = sigAndKeyId.indexOf(KEY_ID_PARAM);
  if (j === -1) {
    throw new AdSsvError('MISSING_KEY_ID', 'Callback query has no key_id parameter after signature.');
  }
  const sig = sigAndKeyId.slice(SIGNATURE_PARAM.length, j - 1); // -1 drops the '&'
  const keyId = Number.parseInt(sigAndKeyId.slice(j + KEY_ID_PARAM.length), 10);
  if (!Number.isFinite(keyId)) {
    throw new AdSsvError('BAD_KEY_ID', `key_id is not a number: "${sigAndKeyId.slice(j + KEY_ID_PARAM.length)}"`);
  }
  return { dataToVerify, signature: sig, keyId };
}

/**
 * Pure ECDSA (SHA-256 / DER) verification against a parsed public key.
 * Accepts standard and URL-safe base64 in the signature.
 */
export function verifySsvSignature(dataToVerify: string, signatureB64: string, key: crypto.KeyObject): boolean {
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  } catch {
    return false;
  }
  if (sigBuf.length === 0) return false;
  try {
    return crypto.verify('sha256', Buffer.from(dataToVerify, 'utf8'), { key, dsaEncoding: 'der' }, sigBuf);
  } catch {
    return false;
  }
}

/** Pull the (percent-decoded) custom_data param — our session nonce. */
export function extractSsvCustomData(rawQuery: string): string | null {
  const m = /(?:^|&)custom_data=([^&]*)/.exec(rawQuery);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, '%20'));
  } catch {
    return null;
  }
}

/**
 * Verify a full SSV callback query string against Google's verifier keys.
 * Throws AdSsvError on any failure; resolves with the decoded custom data.
 */
export async function verifySsvCallback(
  rawQuery: string,
  fetchFn: FetchFn = fetch,
): Promise<{ customData: string | null }> {
  const { dataToVerify, signature, keyId } = parseSsvQuery(rawQuery);
  const keys = await getVerifierKeys(fetchFn);
  const key = keys.get(keyId);
  if (!key) {
    throw new AdSsvError('UNKNOWN_KEY_ID', `No verifier key with keyId ${keyId}.`);
  }
  if (!verifySsvSignature(dataToVerify, signature, key)) {
    throw new AdSsvError('BAD_SIGNATURE', 'SSV signature verification failed.');
  }
  return { customData: extractSsvCustomData(rawQuery) };
}
