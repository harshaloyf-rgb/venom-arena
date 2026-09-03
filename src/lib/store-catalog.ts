// Server-authoritative store catalog for real-money IAP (Google Play Billing /
// Apple StoreKit 2). The client NEVER tells the server how many chips a pack
// grants — this module is the single source of truth that maps a store product
// id to a chip amount and reference price.
//
// Product id scheme (valid for BOTH stores — lowercase alphanumerics, dots,
// underscores; must start with a letter/number on Google Play):
//   venom.chips.<priceINR>   e.g. pack-100 -> venom.chips.100
//
// These product ids MUST be created in Play Console / App Store Connect with
// matching prices — see IAP-SETUP.md at the repo root.
import { CHIP_PACKS } from '@/lib/game-config';

export const STORE_YEARLY_CAP_CHIPS = 2_500_000; // 25 Lakh / year (store-policy cap)
export const STORE_YEARLY_CAP_INR = 15_000; // ₹15,000 / year — copy shown in the UI

export interface StoreCatalogEntry {
  packId: string; // internal pack id, e.g. "pack-100"
  productId: string; // store product id, e.g. "venom.chips.100"
  chips: number; // chips credited on purchase
  priceINR: number; // reference price
}

function productIdForPack(packId: string): string {
  // "pack-10" -> "venom.chips.10"
  const suffix = packId.replace(/^pack-/, '');
  return `venom.chips.${suffix}`;
}

function buildCatalog(): Map<string, StoreCatalogEntry> {
  const byProduct = new Map<string, StoreCatalogEntry>();
  for (const pack of CHIP_PACKS) {
    byProduct.set(productIdForPack(pack.id), {
      packId: pack.id,
      productId: productIdForPack(pack.id),
      chips: pack.chips,
      priceINR: pack.priceINR,
    });
  }
  return byProduct;
}

export const STORE_CATALOG: Map<string, StoreCatalogEntry> = buildCatalog();

export function catalogEntryForProduct(productId: string): StoreCatalogEntry | null {
  return STORE_CATALOG.get(productId) ?? null;
}

export function allStoreProducts(): StoreCatalogEntry[] {
  return [...STORE_CATALOG.values()];
}

// Calendar-year window used for the store-policy cap. UTC year boundaries keep
// it deterministic across server restarts and timezones.
export function currentYearWindow(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0));
  return { start, end };
}
