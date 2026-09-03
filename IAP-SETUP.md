# IAP Setup — Real-Money Chip Purchases (Google Play + App Store)

The full purchase pipeline is implemented and server-authoritative. This guide
covers what YOU must configure on the store consoles + server env before real
money flows. Until the env vars below are set, the purchase endpoint responds
`503 store_not_configured` and the store UI stays in "available in the app" mode.

## How the flow works (already implemented)

```
Android APK (Capacitor shell)                    Venom Arena server
┌────────────────────────────────┐               ┌──────────────────────────────┐
│ cordova-plugin-purchase v13    │               │ POST /api/store/verify       │
│ 1. register venom.chips.*      │               │  ├─ auth + rate limit        │
│ 2. order(offer)  ──────────────┼── Play ──────▶│  ├─ catalog lookup (server   │
│ 3. purchaseToken returned      │   Billing     │  │   decides chips, never    │
│ 4. POST /api/store/verify ─────┼──────────────▶│  │   the client)             │
│    { android, productId,       │               │  ├─ Google androidpublisher  │
│      purchaseToken }           │               │  │   purchases.products.get  │
│ 5. server credits chips        │               │  ├─ idempotent credit (Store │
│ 6. tx.finish() (consume+ack)   │               │  │   Order.storeTxId UNIQUE) │
└────────────────────────────────┘               │  ├─ yearly cap 2.5M chips    │
                                                 │  └─ acknowledge if needed    │
iOS (same shell, StoreKit 2)                     └──────────────────────────────┘
  signedTransaction (JWS) → server verifies signature + chain to embedded
  Apple Root CA - G3 + bundleId/productId → same idempotent credit.
```

Anti-fraud built in:
- Chip amounts come from `src/lib/store-catalog.ts` (server) — the client never states an amount.
- `StoreOrder.storeTxId` is UNIQUE — a replayed receipt can never double-credit.
- Yearly buy cap (25 Lakh chips / ₹15,000) is enforced inside the credit transaction.
- Purchases are bound to the player via obfuscatedAccountId / appAccountToken.
- Unfinished purchases auto-credit on next app start (approved → verify → finish recovery).

## Product IDs (create these in BOTH consoles)

| Pack (internal)  | Product ID          | Chips    | Reference price |
|------------------|---------------------|----------|-----------------|
| pack-10          | `venom.chips.10`    | 1,000    | ₹10             |
| pack-50          | `venom.chips.50`    | 5,100    | ₹50             |
| pack-100         | `venom.chips.100`   | 10,500   | ₹100            |
| pack-250         | `venom.chips.250`   | 27,500   | ₹250            |
| pack-500         | `venom.chips.500`   | 57,500   | ₹500            |
| pack-1000        | `venom.chips.1000`  | 1,20,000 | ₹1,000          |
| pack-2500        | `venom.chips.2500`  | 3,25,000 | ₹2,500          |
| pack-5000        | `venom.chips.5000`  | 7,00,000 | ₹5,000          |
| pack-10000       | `venom.chips.10000` | 15,00,000| ₹10,000         |
| pack-15000       | `venom.chips.15000` | 25,00,000| ₹15,000         |

## Android — Google Play Console (one-time, ~1 hour)

1. **Create the app** (if not done): package name MUST be `gg.venomarena.app`
   (matches `capacitor.config.ts` appId). Different package name? Set
   `GOOGLE_PLAY_PACKAGE_NAME` env to override.
2. **Monetise → Products → In-app products**: create the 10 products above,
   type **Managed product** (consumable). Activate them.
3. **Service account for verification**:
   - Google Cloud Console → new service account (name: `venom-arena-iap`).
   - Create a JSON key → download it.
   - Play Console → Users & permissions → invite the service-account email,
     grant **"View financial data"** + **"Manage orders and refunds"** (API access).
4. **Env vars** (in the server's `.env`):
   ```
   GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL=venom-arena-iap@<project>.iam.gserviceaccount.com
   GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
   (keep the `\n` escapes inside the quotes — the verifier un-escapes them)
5. **License testers** (Setup → License testing): add your Gmail(s) so you can
   buy with test cards that charge nothing.

## iOS — App Store Connect (one-time, ~1 hour)

1. **Agreements, Tax, and Banking**: accept the Paid Applications agreement
   (purchases 503 without it even if code is fine).
2. **In-App Purchases**: create the 10 products above, type **Consumable**,
   with the same prices. State "Ready to Submit" is fine; they go live with the app.
3. **Bundle ID**: the app must use `gg.venomarena.app`. Different? Set
   `APPLE_BUNDLE_ID` env to override (REQUIRED env for iOS either way):
   ```
   APPLE_BUNDLE_ID=gg.venomarena.app
   ```
4. **Sandbox testers** (Users and Access → Sandbox → Testers): create one for
   device testing. StoreKit 2 sandbox purchases verify against the SAME code
   path (environment is recorded on the order, not blocked — App Review pays
   in sandbox too).

## Android build (APK/AAB) with the billing plugin

The npm dependency `cordova-plugin-purchase@13` is already in `package.json`.
On your build machine:

```bash
npm install
npx cap add android          # if android/ not generated yet
npx cap sync android
npx cap open android         # build APK/AAB in Android Studio as usual
```

Play Billing library is bundled by the plugin; nothing else to configure.
Test on device with a license tester account: buy a pack → you should see the
purchase sheet → chips credited → the pack is consumed (repeatable).

## Server env summary

| Variable                              | Required for | Default                |
|---------------------------------------|--------------|------------------------|
| `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`   | Android      | —                      |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` | Android  | —                      |
| `GOOGLE_PLAY_PACKAGE_NAME`            | Android      | `gg.venomarena.app`    |
| `APPLE_BUNDLE_ID`                     | iOS          | — (required for iOS)   |

After adding them, restart the server. Check readiness:
`GET /api/store/status` → `billingConfigured: { android: true, ios: true }`.

## Admin visibility

Admin panel → **Store** tab: lifetime + this-year revenue (orders / chips / ₹),
filterable order list. API: `GET /api/admin/store-orders`.

## Refunds

Play/App Store refunds do NOT auto-revoke chips (v1). When you refund a user
from Play Console, also run the existing admin modify-chips action (it writes
an audit log). A `refunded` status field exists on StoreOrder for future
webhook automation.

## Store-review notes

- Consumables with server entitlement — standard pattern, accepted worldwide.
- No real-money trading / withdrawals anywhere — chips are in-game only (review-safe).
- Yearly cap copy in the app matches the enforced server cap (₹15,000 / 2.5M chips).
- The web/PWA build shows "Buy in App" instead of a paywall — this keeps the
  PWA outside Play's billing-policy scope.
