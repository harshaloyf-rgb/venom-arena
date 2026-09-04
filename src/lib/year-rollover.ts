// Yearly wallet rollover (locked spec 2026-09-04):
// "On 1 Jan every wallet resets to zero for the New Year Championship."
//
// Semantics:
//   - bankedChips -> 0 for EVERYONE. Levels, stats, cosmetics, passes and
//     tickets are untouched.
//   - Chips already staked in live matches settle into the zeroed wallet
//     when their results arrive (extracts still credit; deaths add nothing).
//   - The reset fires when the year flips in IST (UTC+5:30) — the player
//     base's calendar.
//
// Mechanism: lazy + idempotent. `ensureYearRollover()` is called from
// getSession() (every authenticated request); it is memoized to a single
// integer compare per process per year, and a CAS'd GameConfig marker row
// guarantees exactly one process performs the bulk reset even across
// restarts — no cron dependency, works after downtime over New Year.
import { db } from '@/lib/db';

const ROLLOVER_KEY = 'wallet_reset_year';

let lastCheckedYear = 0;

export function currentIstYear(now = Date.now()): number {
  return new Date(now + 5.5 * 60 * 60 * 1000).getUTCFullYear();
}

export async function ensureYearRollover(): Promise<void> {
  const year = currentIstYear();
  if (year === lastCheckedYear) return;
  // Set immediately — at most one DB pass per year per process, even under
  // concurrent first-requests after a year flip.
  lastCheckedYear = year;
  try {
    await db.$transaction(async (tx) => {
      const current = await tx.gameConfig.findUnique({ where: { key: ROLLOVER_KEY } });
      if (!current) {
        // FIRST RUN BASELINE: record the deployment year WITHOUT resetting —
        // otherwise deploying mid-year would wipe every wallet immediately.
        // The reset must only ever fire on a genuine year FLIP (Jan 1).
        await tx.gameConfig.create({
          data: {
            key: ROLLOVER_KEY,
            value: String(year),
            label: 'Last wallet reset year (Jan 1 IST)',
            category: 'economy',
            type: 'string',
          },
        });
        return;
      }
      const marker = Number(current.value);
      if (marker >= year) return;
      // CAS claim: only one process wins the reset.
      const claimed = await tx.gameConfig.updateMany({
        where: { key: ROLLOVER_KEY, value: current.value },
        data: { value: String(year) },
      });
      if (claimed.count !== 1) return;
      await tx.player.updateMany({ data: { bankedChips: 0 } });
      console.info(`[year-rollover] Wallets reset to 0 for ${year} (Jan 1 IST championship reset).`);
    });
  } catch (e) {
    // Never block auth on rollover problems. The memoized year advanced, but
    // the marker row is only written on success — a restart re-checks and
    // completes the reset. Acceptable eventual consistency for a yearly event.
    console.error('[year-rollover] failed:', e);
  }
}

export async function walletResetStatus(): Promise<{ lastResetYear: number; currentIstYear: number; resetDue: boolean }> {
  const row = await db.gameConfig.findUnique({ where: { key: ROLLOVER_KEY } });
  const last = row ? Number(row.value) : 0;
  const cur = currentIstYear();
  return { lastResetYear: last, currentIstYear: cur, resetDue: last < cur };
}

/** Admin-forced immediate reset (same semantics as the Jan 1 rollover). */
export async function forceWalletReset(): Promise<number> {
  const res = await db.player.updateMany({ data: { bankedChips: 0 } });
  return res.count;
}
