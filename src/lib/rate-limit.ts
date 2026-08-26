/**
 * In-memory rate limiter for API routes.
 * Uses a sliding window per IP + endpoint.
 */
const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries every 60 seconds
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 60_000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check (and increment) rate limit for a given key.
 * @param key  Unique identifier — typically `${ip}:${endpoint}`
 * @param max  Max requests in the window
 * @param windowMs  Window duration in milliseconds
 */
export function rateLimit(key: string, max = 10, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

/**
 * Get client IP from NextRequest (respects X-Forwarded-For via Caddy).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

/**
 * Middleware helper: returns 429 if rate limited, or null if allowed.
 */
export function checkRateLimit(
  req: Request,
  endpoint: string,
  max = 10,
  windowMs = 60_000
): Response | null {
  const ip = getClientIp(req);
  const result = rateLimit(`${ip}:${endpoint}`, max, windowMs);
  if (!result.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please slow down.', resetAt: result.resetAt }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }
  return null;
}
