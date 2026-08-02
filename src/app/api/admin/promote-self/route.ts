import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/admin/promote-self
// DEPRECATED: This endpoint was a security vulnerability (any user could self-promote).
// Now requires an existing admin to promote another player.
// Body: { userTag: string } — the userTag of the player to promote.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Caller MUST already be admin
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { userTag?: string };
  const userTag = String(body.userTag || '').trim().toUpperCase();
  if (!userTag) {
    return NextResponse.json({ error: 'userTag is required' }, { status: 400 });
  }

  const target = await db.player.findUnique({
    where: { userTag },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }
  if (target.role === 'admin') {
    return NextResponse.json({ error: 'Player is already admin' }, { status: 400 });
  }

  await db.player.update({
    where: { id: target.id },
    data: { role: 'admin' },
  });

  return NextResponse.json({ ok: true, promoted: userTag });
}
