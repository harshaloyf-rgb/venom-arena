// Rewarded-ads bridge (Ads option C — real AdMob behind a feature flag).
//
// The ONLY rewarded-ad surface in the game. Chips are credited exclusively by
// the server when Google's SSV (server-side verification) callback arrives at
// /api/ads/ssv with a valid signature and our one-time nonce (see ads-ssv.ts).
// The client shows the ad, then POLLS for the credit — it can never mint chips.
//
// Feature flag (Ads option C): ads stay invisible until every piece is set:
//   NEXT_PUBLIC_ADMOB_ENABLED=true                master switch
//   NEXT_PUBLIC_ADMOB_REWARDED_UNIT_ANDROID       ca-app-pub-xxx/yyy
//   NEXT_PUBLIC_ADMOB_REWARDED_UNIT_IOS           ca-app-pub-xxx/yyy
// With the flag off, no ad UI is rendered anywhere (the fake "sponsor" buttons
// of the old build were removed — a "watch ad" button that shows no ad is a
// Play Store policy violation).
//
// Full setup walkthrough: ADS-SETUP.md at the repo root.
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';

// Google's official TEST ad unit — always safe to show in dev, zero revenue.
// Replace via env (or AndroidManifest app-id) before enabling in production.
export const TEST_REWARDED_UNIT = 'ca-app-pub-3940256099942544/5224354917';

export function adsFlagEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ADMOB_ENABLED === 'true';
}

export function rewardedAdUnitId(): string {
  const id =
    Capacitor.getPlatform() === 'ios'
      ? process.env.NEXT_PUBLIC_ADMOB_REWARDED_UNIT_IOS
      : process.env.NEXT_PUBLIC_ADMOB_REWARDED_UNIT_ANDROID;
  return id || TEST_REWARDED_UNIT;
}

/** Ads are offered only inside the native app with the flag on. */
export function rewardedAdsAvailable(): boolean {
  if (!adsFlagEnabled()) return false;
  if (typeof window === 'undefined') return false;
  try {
    return Capacitor.isNativePlatform() === true;
  } catch {
    return false;
  }
}

let initialized = false;
async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  await AdMob.initialize({ initializeForTesting: process.env.NODE_ENV !== 'production' });
  initialized = true;
}

export type RewardedAdResult = 'earned' | 'dismissed' | 'failed';

/**
 * Prepare + show a rewarded ad bound to `nonce` (passed to Google as the SSV
 * custom_data). Resolves when the ad flow finishes. Crediting happens
 * server-side via the SSV callback — poll /api/ads/session?nonce= afterwards.
 */
export async function showRewardedAd(nonce: string): Promise<RewardedAdResult> {
  if (!rewardedAdsAvailable()) return 'failed';
  await ensureInitialized();

  let earned = false;
  const listeners: PluginListenerHandle[] = [];

  const rewardedListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
    earned = true;
  });
  listeners.push(rewardedListener);

  try {
    await AdMob.prepareRewardVideoAd({
      adId: rewardedAdUnitId(),
      ssv: { customData: nonce },
    });
    await AdMob.showRewardVideoAd();
    // showRewardVideoAd resolves when the ad closes; the Rewarded event fires
    // while it is still open. Give the event a short grace window to land.
    if (!earned) {
      await new Promise((r) => setTimeout(r, 700));
    }
    return earned ? 'earned' : 'dismissed';
  } catch {
    return 'failed';
  } finally {
    for (const l of listeners) {
      try {
        await l.remove();
      } catch {
        /* noop */
      }
    }
  }
}
