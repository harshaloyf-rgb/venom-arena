import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { countryName } from '@/lib/game-config';

// GET /api/players/countries — unique country codes with player counts
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groups = await db.player.groupBy({
    by: ['country'],
    where: { country: { not: null, not: '' } },
    _count: true,
    orderBy: { _count: { country: 'desc' } },
  });

  const countries = groups.map((g) => ({
    code: g.country,
    name: countryName(g.country),
    count: g._count,
  }));

  return NextResponse.json({ countries });
}
