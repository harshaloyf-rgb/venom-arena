// ============================================================================
// Shared date utility functions.
// Used by challenges, match/result, and challenges/progress routes.
// ============================================================================

/** Format a Date to YYYY-MM-DD in UTC */
function fmt(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** Get today's date in UTC as YYYY-MM-DD */
export function utcToday(): string {
  return fmt(new Date());
}

/** Get the most recent Monday in UTC as YYYY-MM-DD */
export function utcMonday(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? 6 : day - 1; // shift so Monday=0
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return fmt(monday);
}

/** Get yesterday's date in UTC as YYYY-MM-DD */
export function utcYesterday(): string {
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return fmt(yesterday);
}

/** Get the previous week's Monday in UTC as YYYY-MM-DD */
export function utcLastMonday(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  const lastMonday = new Date(Date.UTC(thisMonday.getUTCFullYear(), thisMonday.getUTCMonth(), thisMonday.getUTCDate() - 7));
  return fmt(lastMonday);
}
