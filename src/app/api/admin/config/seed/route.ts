import { NextResponse } from 'next/server'
import { seedGameConfig } from '@/lib/game-config-db'

/**
 * POST /api/admin/config/seed
 * Re-seeds the GameConfig table with defaults.
 * Existing rows are left untouched (upsert semantics).
 * Returns the full updated config list.
 */
export async function POST() {
  await seedGameConfig()
  return NextResponse.json({ success: true })
}
