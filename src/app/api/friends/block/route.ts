import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { findPlayerByTag } from '@/lib/player-lookup';

// POST /api/friends/block  body: { userTag: string }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const tag = String(body.userTag || '').trim();
  if (!tag) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const target = await findPlayerByTag(tag);
  if (!target) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
  if (target.id === session.playerId) return NextResponse.json({ error: 'Cannot block yourself.' }, { status: 400 });

  let appError: string | null = null;

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.friendship.findFirst({
        where: {
          OR: [
            { initiatorId: session.playerId, recipientId: target.id },
            { initiatorId: target.id, recipientId: session.playerId },
          ],
        },
      });

      if (existing) {
        await tx.friendship.update({
          where: { id: existing.id },
          data: { status: 'blocked' },
        });
      } else {
        await tx.friendship.create({
          data: {
            initiatorId: session.playerId,
            recipientId: target.id,
            status: 'blocked',
          },
        });
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const appErrors: Record<string, string> = {
      unique_constraint: 'Already blocked.',
    };
    if (msg in appErrors) {
      appError = appErrors[msg];
    } else {
      console.error('[friends/block] error', e);
      return NextResponse.json({ error: 'Block failed.' }, { status: 500 });
    }
  }

  if (appError) {
    return NextResponse.json({ error: appError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/friends/block?userTag=X (unblock) — removes the blocked relationship entirely
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tag = String(searchParams.get('userTag') || '').trim();
  if (!tag) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const target = await findPlayerByTag(tag);
  if (!target) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
  if (target.id === session.playerId) return NextResponse.json({ error: 'Cannot unblock yourself.' }, { status: 400 });

  try {
    const friendship = await db.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: session.playerId, recipientId: target.id, status: 'blocked' },
          { initiatorId: target.id, recipientId: session.playerId, status: 'blocked' },
        ],
      },
    });

    if (!friendship) {
      return NextResponse.json({ error: 'No blocked relationship found.' }, { status: 404 });
    }

    await db.friendship.delete({ where: { id: friendship.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('[friends/block] unblock error', e);
    return NextResponse.json({ error: 'Unblock failed.' }, { status: 500 });
  }
}
