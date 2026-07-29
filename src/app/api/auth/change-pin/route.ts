import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * POST /api/auth/change-pin
 *
 * Changes the player's 4-digit Security PIN.
 * Requires current session + either existing PIN verification or first-time set.
 *
 * Body: { currentPin?: string, newPin: string }
 *   - If player already has a PIN, currentPin is required
 *   - If player has no PIN, currentPin is not needed (first time setup)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const currentPin = String(body.currentPin || '').trim();
    const newPin = String(body.newPin || '').trim();

    // Validate new PIN format
    if (!/^\d{4}$/.test(newPin)) {
      return NextResponse.json({ error: 'New Security PIN must be exactly 4 digits.' }, { status: 400 });
    }

    const player = await db.player.findUnique({ where: { id: session.playerId } });
    if (!player) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    // If player already has a PIN, verify the current one
    if (player.securityPin) {
      if (!/^\d{4}$/.test(currentPin)) {
        return NextResponse.json({ error: 'Current Security PIN (4 digits) is required.' }, { status: 400 });
      }
      if (player.securityPin !== currentPin) {
        return NextResponse.json({ error: 'Current Security PIN is incorrect.' }, { status: 401 });
      }
    }

    await db.player.update({
      where: { id: session.playerId },
      data: { securityPin: newPin },
    });

    return NextResponse.json({
      ok: true,
      message: player.securityPin ? 'Security PIN updated successfully.' : 'Security PIN set successfully.',
    });
  } catch (e) {
    console.error('[auth/change-pin] error', e);
    return NextResponse.json({ error: 'Failed to change PIN.' }, { status: 500 });
  }
}
