// ============================================================================
// Shared API route helpers — reduce boilerplate across 20+ routes.
// ============================================================================

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Require authentication for an API route.
 * Returns the session if valid, or a 401 JSON response if not.
 *
 * Usage:
 *   const { session, error } = await requireAuth();
 *   if (error) return error;
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };
  }
  return { session, error: null };
}

// ============================================================================
// Simple in-memory rate limiter
// ============================================================================

type RateLimitEntry = { count: number; firstAt: number };
const rateLimitMap = new Map<string, RateLimitEntry>();

// Periodically clean up stale entries (every 10 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.firstAt > entry.count * 60_000) {
      rateLimitMap.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * Check rate limit for a given key (usually IP address).
 * Returns null if allowed, or a 429 NextResponse if exceeded.
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): NextResponse | null {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.firstAt > windowMs) {
    rateLimitMap.set(key, { count: 1, firstAt: now });
    return null;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const remainingMs = windowMs - (now - entry.firstAt);
    const remainingSec = Math.ceil(remainingMs / 1000);
    return NextResponse.json(
      { error: `Too many requests. Try again in ${remainingSec} seconds.` },
      { status: 429 },
    );
  }

  return null;
}

