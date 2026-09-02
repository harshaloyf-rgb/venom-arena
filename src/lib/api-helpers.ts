// ============================================================================
// Shared API route helpers — reduce boilerplate across 20+ routes.
// ============================================================================

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { timingSafeEqual } from 'crypto';

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

/**
 * Require admin role for an API route.
 * Returns the session if admin, or a 401/403 JSON response if not.
 *
 * Usage:
 *   const { session, error } = await requireAdmin();
 *   if (error) return error;
 */
export async function requireAdmin() {
  const { session, error: authError } = await requireAuth();
  if (authError) return { session: null, error: authError };
  if (session.role !== 'admin') {
    return { session: null, error: NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }) };
  }
  return { session, error: null };
}

/**
 * Verify an x-internal-secret header using constant-time comparison.
 * Returns true if the secret matches, false otherwise.
 */
export function verifyInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret');
  const expected = process.env.INTERNAL_SECRET;
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
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
 * Rate limit a per-player economy/reward action (audit X6/A5).
 * Keyed on playerId (not IP) so authenticated spam is throttled per account.
 * Call AFTER requireAuth/getSession so playerId is available.
 * Returns null if allowed, or a 429 NextResponse if exceeded.
 *
 * Usage:
 *   const rl = playerActionLimit(session.playerId, 'spin', 15, 60_000);
 *   if (rl) return rl;
 */
export function playerActionLimit(
  playerId: string,
  action: string,
  max: number,
  windowMs: number,
): NextResponse | null {
  return rateLimit(`pa:${action}:${playerId}`, max, windowMs);
}

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

