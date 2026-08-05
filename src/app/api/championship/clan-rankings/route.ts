/**
 * GET /api/championship/clan-rankings
 *
 * Returns clan-aggregated championship standings.
 * Delegates to /standings?clanView=true for consistency.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Forward to the standings endpoint with clanView=true
  const url = new URL(req.url);
  url.pathname = '/api/championship/standings';
  url.searchParams.set('clanView', 'true');

  // Use internal fetch (same-origin)
  const res = await fetch(url.toString(), {
    headers: { 'x-internal': '1' },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
