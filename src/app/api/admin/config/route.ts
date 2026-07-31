import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedGameConfig } from '@/lib/game-config-db'

/**
 * GET /api/admin/config
 * Returns all GameConfig rows. If the table is empty, seeds defaults first.
 */
export async function GET() {
  let rows = await db.gameConfig.findMany({ orderBy: { order: 'asc' } })

  if (rows.length === 0) {
    await seedGameConfig()
    rows = await db.gameConfig.findMany({ orderBy: { order: 'asc' } })
  }

  // Parse the JSON value back to native types for the response
  const parsed = rows.map((r) => {
    let parsedValue: unknown
    try {
      parsedValue = JSON.parse(r.value)
    } catch {
      parsedValue = r.value
    }
    return {
      id: r.id,
      key: r.key,
      value: parsedValue,
      label: r.label,
      category: r.category,
      order: r.order,
      type: r.type,
      updatedAt: r.updatedAt,
    }
  })

  return NextResponse.json(parsed)
}

/**
 * PUT /api/admin/config
 * Body: { updates: { key: string, value: any }[] }
 * Updates the given config keys with new values. Returns all configs after update.
 */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({ updates: [] }))
  const updates: { key: string; value: unknown }[] = body.updates ?? []

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: 'updates must be an array' }, { status: 400 })
  }

  for (const u of updates) {
    if (!u.key) continue
    await db.gameConfig.update({
      where: { key: u.key },
      data: { value: JSON.stringify(u.value) },
    })
  }

  // Return the full updated list
  const rows = await db.gameConfig.findMany({ orderBy: { order: 'asc' } })
  const parsed = rows.map((r) => {
    let parsedValue: unknown
    try {
      parsedValue = JSON.parse(r.value)
    } catch {
      parsedValue = r.value
    }
    return {
      id: r.id,
      key: r.key,
      value: parsedValue,
      label: r.label,
      category: r.category,
      order: r.order,
      type: r.type,
      updatedAt: r.updatedAt,
    }
  })

  return NextResponse.json(parsed)
}
