import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/admin/store-orders?limit=100&offset=0&platform=android
// Admin-only view of real-money IAP orders (Google Play / App Store) —
// newest first, with yearly revenue aggregates for quick ops checks.
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
  const platform = searchParams.get('platform') || '';
  const status = searchParams.get('status') || '';

  const where: { platform?: string; status?: string } = {};
  if (platform === 'android' || platform === 'ios') where.platform = platform;
  if (status) where.status = status;

  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));

  const [orders, total, totals, yearTotals] = await Promise.all([
    db.storeOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { player: { select: { userTag: true, name: true } } },
    }),
    db.storeOrder.count({ where }),
    db.storeOrder.aggregate({
      where: { status: 'completed' },
      _count: { _all: true },
      _sum: { chips: true, pricePaidINR: true },
    }),
    db.storeOrder.aggregate({
      where: { status: 'completed', createdAt: { gte: yearStart } },
      _count: { _all: true },
      _sum: { chips: true, pricePaidINR: true },
    }),
  ]);

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt.toISOString(),
      userTag: o.player?.userTag ?? '?',
      playerName: o.player?.name ?? '?',
      platform: o.platform,
      packId: o.packId,
      productId: o.productId,
      chips: o.chips,
      pricePaidINR: o.pricePaidINR,
      status: o.status,
    })),
    total,
    lifetime: {
      orders: totals._count._all,
      chips: totals._sum.chips ?? 0,
      revenueINR: totals._sum.pricePaidINR ?? 0,
    },
    thisYear: {
      orders: yearTotals._count._all,
      chips: yearTotals._sum.chips ?? 0,
      revenueINR: yearTotals._sum.pricePaidINR ?? 0,
    },
  });
}
