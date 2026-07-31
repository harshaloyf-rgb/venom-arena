import { NextResponse, NextRequest } from 'next/server'
import { seedGameConfig } from '@/lib/game-config-db'
import { getSession } from '@/lib/auth'

/**
 * POST /api/admin/config/seed
 * Re-seeds the GameConfig table with defaults.
 * Existing rows are left untouched (upsert semantics).
 * Returns the full updated config list.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  await seedGameConfig()
  return NextResponse.json({ success: true })
}