import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

// POST /api/admin/verify-email  body: { userTag: string }
// Admin-only. Marks a player's email as verified (support action for players
// whose verification email bounced or never arrived). Sets emailVerified=true
// so the +850 verification bonus flow is unblocked for that account — the
// bonus itself is only ever granted through the real /api/auth/verify-email
// token flow, so this endpoint alone never pays out chips.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userTag = String(body.userTag || '').trim();

  if (!userTag) {
    return NextResponse.json({ error: 'userTag required' }, { status: 400 });
  }

  const target = await db.player.findUnique({ where: { userTag } });
  if (!target) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }
  if (!target.email) {
    return NextResponse.json({ error: 'Guest accounts have no email to verify.' }, { status: 400 });
  }
  if (target.emailVerified) {
    return NextResponse.json({ error: 'Email is already verified.' }, { status: 400 });
  }

  await db.player.update({
    where: { userTag },
    data: { emailVerified: true },
  });

  await logAdminAction(session, 'verify_email', 'player', userTag, {
    email: target.email,
  });

  return NextResponse.json({ ok: true, message: `Email verified for ${userTag}.` });
}
