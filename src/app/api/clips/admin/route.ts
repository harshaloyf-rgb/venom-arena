import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// All endpoints require admin role.
async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null };

  const player = await db.player.findUnique({
    where: { id: session.playerId },
    select: { role: true },
  });
  if (!player || player.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin only.' }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

// GET /api/clips/admin?status=pending&limit=20
// List clips pending review (or any status)
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') || 'pending';
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 20, 1), 100);

  const where: Record<string, unknown> = {};
  if (status === 'pending' || status === 'approved' || status === 'rejected' || status === 'all') {
    if (status !== 'all') where.status = status;
  } else {
    where.status = 'pending';
  }

  const [clips, total] = await Promise.all([
    db.clip.findMany({
      where,
      orderBy: { createdAt: 'asc' }, // oldest pending first
      take: limit,
      include: {
        player: { select: { name: true, userTag: true, country: true, level: true } },
      },
    }),
    db.clip.count({ where }),
  ]);

  // Also get counts for each status
  const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
    db.clip.count({ where: { status: 'pending' } }),
    db.clip.count({ where: { status: 'approved' } }),
    db.clip.count({ where: { status: 'rejected' } }),
  ]);

  return NextResponse.json({
    clips: clips.map((c) => ({
      ...c,
      tags: JSON.parse(c.tags),
      matchData: c.matchData ? JSON.parse(c.matchData) : null,
    })),
    total,
    counts: { pending: pendingCount, approved: approvedCount, rejected: rejectedCount },
  });
}

// POST /api/clips/admin — approve or reject a clip
// body: { clipId, action: 'approve' | 'reject' }
export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;
  if (!session) return error.error;

  const body = await req.json();
  const { clipId, action } = body;

  if (!clipId || !action) {
    return NextResponse.json({ error: 'clipId and action are required.' }, { status: 400 });
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject.' }, { status: 400 });
  }

  const clip = await db.clip.findUnique({ where: { id: clipId } });
  if (!clip) {
    return NextResponse.json({ error: 'Clip not found.' }, { status: 404 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  await db.clip.update({
    where: { id: clipId },
    data: {
      status: newStatus,
      reviewedBy: session.playerId,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, status: newStatus });
}

// POST /api/clips/admin/bulk — approve or reject multiple clips
// body: { clipIds: string[], action: 'approve' | 'reject' }
export async function PUT(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;
  if (!session) return error.error;

  const body = await req.json();
  const { clipIds, action } = body;

  if (!Array.isArray(clipIds) || clipIds.length === 0) {
    return NextResponse.json({ error: 'clipIds array is required.' }, { status: 400 });
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject.' }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  await db.clip.updateMany({
    where: { id: { in: clipIds } },
    data: {
      status: newStatus,
      reviewedBy: session.playerId,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, updated: clipIds.length, status: newStatus });
}
