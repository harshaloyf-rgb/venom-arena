import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

// POST /api/admin/ban  body: { userTag: string, banned: boolean }
// Admin-only. Sets the target player's `banned` field.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userTag = String(body.userTag || '').trim();
  const banned = Boolean(body.banned);

  if (!userTag) {
    return NextResponse.json({ error: 'userTag required' }, { status: 400 });
  }
  if (userTag === session.userTag) {
    return NextResponse.json({ error: 'Cannot ban yourself' }, { status: 400 });
  }

  const target = await db.player.findUnique({ where: { userTag } });
  if (!target) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }
  if (target.role === 'admin') {
    return NextResponse.json({ error: 'Cannot ban an admin' }, { status: 400 });
  }

  await db.player.update({
    where: { userTag },
    data: { banned, lastSeenAt: new Date() },
  });

  // X11: record the ban/unban in the audit trail
  await logAdminAction(session, banned ? 'ban' : 'unban', 'player', userTag, {
    targetName: target.name,
  });

  return NextResponse.json({ ok: true, userTag, banned });
}
