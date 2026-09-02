import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/admin/audit-logs?limit=100&offset=0&action=ban
// Admin-only. Newest-first view of the X11 admin audit trail.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let limit = parseInt(searchParams.get('limit') || '100', 10);
  if (isNaN(limit) || limit < 1) limit = 100;
  if (limit > 200) limit = 200;
  let offset = parseInt(searchParams.get('offset') || '0', 10);
  if (isNaN(offset) || offset < 0) offset = 0;
  const action = (searchParams.get('action') || '').trim();

  const where = action ? { action } : {};

  const [logs, total] = await Promise.all([
    db.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.adminAuditLog.count({ where }),
  ]);

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      adminTag: l.adminTag,
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId,
      details: l.details ? JSON.parse(l.details) : null,
      createdAt: l.createdAt,
    })),
    total,
    limit,
    offset,
  });
}
