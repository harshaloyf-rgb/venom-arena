import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/admin/promote-self
// Promotes the logged-in player to admin role.
// Called automatically when a valid operations code is entered.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await db.player.update({
    where: { id: session.playerId },
    data: { role: 'admin' },
  });

  return NextResponse.json({ ok: true });
}
