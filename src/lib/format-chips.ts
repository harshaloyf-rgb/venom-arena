// ============================================================================
// Shared chip formatting utilities.
// Consolidates 6 variants from: share-card.tsx, match-card-visual.tsx,
// admin/players-tab.tsx, daily-rewards.tsx, hall-of-fame.tsx, arena-selector.tsx.
// ============================================================================

/** Indian-notation short form: 1.0 Cr, 1.0L, 1.0K (used in share cards) */
export function formatChipsIndian(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Western-notation short form: 1.00B, 1.00M, 1.0K (used in admin) */
export function formatChipsShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Full locale-formatted number with optional short suffix + 'c' unit */
export function chipFull(n: number): string {
  if (n === 0) return 'FREE';
  const full = `${n.toLocaleString()}c`;
  if (n >= 1_000_000_000) return `${full} (${(n / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Bc)`;
  if (n >= 1_000_000) return `${full} (${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Mc)`;
  if (n >= 1_000) return `${full} (${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Kc)`;
  return full;
}

/** Short form with 'c' unit: 1.0Kc, 1.0Mc, 1.0Bc */
export function chipShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Bc`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Mc`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Kc`;
  return `${n}c`;
}

/** Indian locale full format (e.g. 1,00,000) */
export function fmtChipsIndian(n: number): string {
  return n.toLocaleString('en-IN');
}
