// Server-authoritative catalog for the ad-free Time Pass matrix (USD IAP).
// Mirrors store-catalog.ts: the client NEVER tells the server what a pass
// grants — this module is the single source of truth mapping a store product
// id to duration, bundled tickets and reference price.
//
// Product id scheme (valid for BOTH stores — lowercase alphanumerics, dots,
// underscores; must start with a letter/number on Google Play):
//   venom.pass.<duration>   e.g. pass-5d -> venom.pass.5d
//
// These product ids MUST be created in Play Console / App Store Connect with
// matching prices before enabling real purchases — see IAP-SETUP.md.

export interface PassPlan {
  id: string; // sku, e.g. "pass-5d" — also the PassOrder.sku value
  productId: string; // store product id, e.g. "venom.pass.5d"
  label: string; // UI label, e.g. "5 Days"
  durationDays: number;
  priceUsd: number; // reference price in USD
  priceUsdMicros: number; // USD * 1_000_000 (audit)
  tickets: number; // bundled Virtual Tickets (credited upfront on purchase)
  hook: string; // marketing hook line shown on the plan card
}

// Global USD One-Time Pass Matrix (locked spec, 2026-09-04).
export const PASS_PLANS: PassPlan[] = [
  { id: 'pass-5d',  productId: 'venom.pass.5d',  label: '5 Days',   durationDays: 5,    priceUsd: 1.19,  priceUsdMicros: 1_190_000,   tickets: 10,  hook: 'Micro-Tier: Pocket-change entry point for casual testing.' },
  { id: 'pass-15d', productId: 'venom.pass.15d', label: '15 Days',  durationDays: 15,   priceUsd: 2.99,  priceUsdMicros: 2_990_000,   tickets: 30,  hook: 'Vacation Pass: Ideal for casual breaks or holiday weeks.' },
  { id: 'pass-30d', productId: 'venom.pass.30d', label: '30 Days',  durationDays: 30,   priceUsd: 5.99,  priceUsdMicros: 5_990_000,   tickets: 70,  hook: 'The Standard: Matches standard digital entertainment pricing.' },
  { id: 'pass-3m',  productId: 'venom.pass.3m',  label: '3 Months', durationDays: 90,   priceUsd: 11.99, priceUsdMicros: 11_990_000,  tickets: 160, hook: 'Best Seller: High volume discount that drives mid-tier conversions.' },
  { id: 'pass-6m',  productId: 'venom.pass.6m',  label: '6 Months', durationDays: 180,  priceUsd: 19.99, priceUsdMicros: 19_990_000,  tickets: 320, hook: 'Semi-Annual Elite: Clean, psychologically appealing $20 price point.' },
  { id: 'pass-1y',  productId: 'venom.pass.1y',  label: '1 Year',   durationDays: 365,  priceUsd: 34.99, priceUsdMicros: 34_990_000,  tickets: 700, hook: 'Ultimate Value: Heavy long-term discount for die-hard players.' },
];

// Shown verbatim at purchase confirmation (locked spec, 2026-09-04).
export const PASS_LEGAL_TEXT =
  'All purchases of Time Passes and bundled Virtual Tickets are final and non-refundable. ' +
  'If an account is closed, deleted, or banned for cheating, all remaining unexpired time ' +
  'and unused tickets are permanently forfeited without liability.';

function buildCatalog(): Map<string, PassPlan> {
  const byProduct = new Map<string, PassPlan>();
  for (const plan of PASS_PLANS) {
    byProduct.set(plan.productId, plan);
    byProduct.set(plan.id, plan); // sku also resolvable (admin grants)
  }
  return byProduct;
}

const CATALOG = buildCatalog();

export function passPlanForProduct(productId: string): PassPlan | null {
  return CATALOG.get(productId) ?? null;
}

export function passPlanById(sku: string): PassPlan | null {
  return CATALOG.get(sku) ?? null;
}

export function formatUsd(usd: number): string {
  return `$${usd.toFixed(2)}`;
}
