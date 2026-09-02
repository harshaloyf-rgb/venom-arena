// ============================================================================
// Client-side API base URL (T4 backend-split prep)
// ============================================================================
// Default '' keeps everything same-origin (/api/...), exactly as deployed
// today. When the backend is eventually split out (or the game ships inside
// a Capacitor shell pointing at a hosted API), set:
//   NEXT_PUBLIC_API_BASE_URL=https://api.example.com
// and every wired call site re-points with zero code churn.

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

/**
 * Resolve an API path against the configured base.
 * Accepts '/api/...' (normal), bare segments, or absolute URLs (passthrough).
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
}
