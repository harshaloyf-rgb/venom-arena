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
