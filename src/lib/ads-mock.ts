// Shared helper for the DEV-ONLY mock ad flow (web/preview).
//
// The real ad SDK is native-only (AdMob via Capacitor). On web/preview the
// join gate renders a labeled "TEST AD" screen instead; its completion is
// recorded through the SAME server-side session pipeline (no client minting).
//
// SECURITY: this is dead code in production builds — enable ONLY by setting
// NEXT_PUBLIC_ADS_MOCK=true in a dev/preview environment. The route that
// consumes this flag must 403 unless it is set.
export function adsMockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ADS_MOCK === 'true';
}
