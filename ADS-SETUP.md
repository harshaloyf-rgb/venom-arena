# ADS-SETUP.md — Rewarded Ads (AdMob, Option C)

Venom Arena monetizes with **real IAP** (see `IAP-SETUP.md`) plus **AdMob rewarded video ads**
that award small free chip bonuses. Everything ships behind a feature flag:
**nothing ad-related is visible or earnable until you complete this guide.**

## How it works (server-authoritative)

```
1. Client  POST /api/ads/session        → server issues a one-time nonce (stored in AdRewardSession)
2. Client  shows a real rewarded ad     → nonce rides along as the ad's SSV custom_data
3. Google  GET https://YOUR-DOMAIN/api/ads/ssv?...&custom_data=<nonce>&signature=...&key_id=...
           (signed ECDSA callback — configured in the AdMob console, step 4)
4. Server  verifies the signature against Google's public verifier keys,
           claims the nonce (single-use), enforces the 12/day cap and credits 50 chips
5. Client  polls GET /api/ads/session?nonce=... and shows the credited chips
```

- Chips are credited **only** in step 4 — a modified client can never mint ad chips.
- The old fake "Watch Sponsor Ad" buttons (no ad, instant credit) were **deleted** —
  a button promising an ad that shows none is a Play Store policy violation.
- Legacy faucet route `POST /api/player/video-reward` was removed.
- Reward: **50 chips per verified ad, max 12/day (600 chips/day)**, shared cap with
  the admin-visible VideoReward history and the Profile → Guardrails "Rewarded Ads Today" stat.

## Step 1 — AdMob console (Google)

1. Sign in at https://apps.admob.com → **Apps → Add app** (Android, package `gg.venomarena.app`).
2. **Ad units → Add ad unit → Rewarded**. Name it e.g. `Chips Rewarded`. Copy the unit id
   (`ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`).
3. Repeat for iOS later if/when the iOS shell ships (same console, Apple app entry).

## Step 2 — SSV callback (critical)

In the AdMob console open the rewarded ad unit → **Advanced settings → Server-side verification**
and set the callback URL to:

```
https://YOUR-DOMAIN/api/ads/ssv
```

No query parameters needed — Google appends its signed payload automatically.
Do **not** put a fake URL: without SSV the whole flow never credits.

## Step 3 — Android App ID in the manifest

`android/app/src/main/AndroidManifest.xml` currently carries Google's **TEST** App ID:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-3940256099942544~3347511713" />
```

Replace `ca-app-pub-3940256099942544~3347511713` with your real AdMob **App ID**
(Apps → App settings) before enabling ads in a release build. Shipping with the
test App ID is fine while ads stay disabled.

## Step 4 — Env vars (set on the VPS, then rebuild the web app)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_ADMOB_ENABLED` | `true` — master flag; ads UI stays hidden while unset/false |
| `NEXT_PUBLIC_ADMOB_REWARDED_UNIT_ANDROID` | your rewarded ad unit id (falls back to Google's TEST rewarded unit if unset) |
| `NEXT_PUBLIC_ADMOB_REWARDED_UNIT_IOS` | your iOS rewarded unit id (optional until iOS ships) |

After the flag is on, the chip-store shows the "Daily Reward Ads" card **inside the
Android/iOS app only** (web/PWA shows nothing — mobile ad SDKs don't run in browsers).

## Step 5 — Rebuild

```bash
npm install            # pulls @capacitor-community/admob (already in package.json)
npx cap sync android   # wires the native plugin into the APK project
npm run build:prod     # bakes the NEXT_PUBLIC_* values into the web bundle
# then build the APK as usual (RELEASE-CHECKLIST.md Phase B)
```

## Testing

- With no env vars set: no ad card anywhere (safe default).
- Dev build + flag on + test unit id: Google serves **test rewarded ads** — the full
  SSV round-trip runs (SSV callbacks fire for test ads too). Great for verifying
  the callback URL end-to-end before going live.
- Enable SSV "test mode" (AdMob console, ad unit advanced settings) adds
  `ssv_test=true`-style responses — turn it OFF for production.
- Watch the server logs for `[ads/ssv]` lines; every rejected callback is logged
  with a reason (bad signature / unknown key / expired or replayed nonce).

## Policy notes

- Ads must never be shown before purchase flows or in a way that can be clicked by
  accident — the current single entry point (chip-store card, explicit tap) is compliant.
- The "Daily Reward Ads" card copy states the exact reward (50 chips) — keep UI copy
  in sync if you ever change `AD_REWARD_CHIPS` (in `src/lib/game-config.ts`) and the
  server credit in `src/app/api/ads/ssv/route.ts` (they must stay equal).
- Google requires a valid published privacy policy (see IAP-SETUP.md § policy).

---

## Join-gate placement (added 2026-09-04 — locked spec)

A second rewarded-ad placement exists: the **pre-join gate**. Online arena
joins require one rewarded ad, which unlocks `Player.adUnlockUntil` =
**10 minutes** of unlimited entries (each entry still pays its own buy-in).

- Purpose routing: `/api/ads/session` POST accepts `{ purpose: 'join' }`;
  the SSV callback sets `adUnlockUntil` instead of crediting chips
  (`AdRewardSession.purpose` = `chips | join`).
- HARD RULE: ads appear at exactly ONE surface — the pre-join gate — and
  NEVER mid-gameplay (expiry is only evaluated at join time).
- You may reuse the SAME rewarded ad unit, or create a dedicated one for
  better analytics; either way the SSV URL stays `/api/ads/ssv`.
- Web/preview: a labeled TEST-AD simulation unlocks the window via
  `/api/ads/mock-complete`, gated behind `NEXT_PUBLIC_ADS_MOCK=true`.
  NEVER set that env in production.
