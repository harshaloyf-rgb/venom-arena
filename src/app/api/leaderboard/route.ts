import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { milestoneTierForChips, MILESTONE_TIERS } from '@/lib/game-config';

// GET /api/leaderboard?type=chips|level&limit=50&view=global|national|world_summit&country=US&milestone=gold
export async function GET(req: NextRequest) {
  const session = await getSession();
  const url = new URL(req.url);

  const type = url.searchParams.get('type') === 'level' ? 'level' : 'bankedChips';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 100);
  const view = url.searchParams.get('view') || 'global';
  const country = url.searchParams.get('country') || '';
  const milestone = url.searchParams.get('milestone') || '';

  // Validate view
  if (!['global', 'national', 'world_summit'].includes(view)) {
    return NextResponse.json({ error: 'Invalid view. Use global, national, or world_summit.' }, { status: 400 });
  }

  // National view requires country
  if (view === 'national' && !country) {
    return NextResponse.json({ error: 'National view requires a country parameter.' }, { status: 400 });
  }

  // Validate milestone if provided
  let milestoneMin = 0;
  let milestoneMax = Infinity;
  if (milestone) {
    const tier = MILESTONE_TIERS.find(t => t.id === milestone);
    if (!tier || tier.id === 'all') {
      if (milestone !== 'all') {
        return NextResponse.json({ error: 'Invalid milestone tier.' }, { status: 400 });
      }
    } else {
      milestoneMin = tier.minChips;
      // Find the next higher tier's minChips
      const sortedTiers = MILESTONE_TIERS
        .filter(t => t.id !== 'all')
        .sort((a, b) => b.minChips - a.minChips);
      const nextHigher = sortedTiers.find(t => t.minChips > milestoneMin);
      milestoneMax = nextHigher ? nextHigher.minChips : Infinity;
    }
  }

  let players: Array<{
    userTag: string;
    name: string;
    country: string;
    bankedChips: number;
    level: number;
  }>;

  if (view === 'world_summit') {
    // Get #1 player from each country
    const allPlayers = await db.player.findMany({
      where: { banned: false },
      orderBy: { [type]: 'desc' },
      select: {
        userTag: true,
        name: true,
        country: true,
        bankedChips: true,
        level: true,
      },
    });

    // Group by country and take #1 from each
    const countryMap = new Map<string, typeof allPlayers[0]>();
    for (const p of allPlayers) {
      if (!countryMap.has(p.country)) {
        countryMap.set(p.country, p);
      }
    }

    // Apply milestone filter
    let summitPlayers = Array.from(countryMap.values());
    if (milestone) {
      summitPlayers = summitPlayers.filter(p => p.bankedChips >= milestoneMin && p.bankedChips < milestoneMax);
    }

    // Sort by bankedChips desc and limit
    summitPlayers.sort((a, b) => b.bankedChips - a.bankedChips);
    players = summitPlayers.slice(0, limit);
  } else {
    // Global or National view
    const where: Record<string, unknown> = { banned: false };
    if (view === 'national') {
      where.country = country;
    }

    // Fetch more to account for milestone filtering
    const fetchLimit = milestone ? Math.max(limit * 5, 500) : limit;
    const rawPlayers = await db.player.findMany({
      where,
      orderBy: { [type]: 'desc' },
      take: fetchLimit,
      select: {
        userTag: true,
        name: true,
        country: true,
        bankedChips: true,
        level: true,
      },
    });

    // Apply milestone filter
    if (milestone) {
      players = rawPlayers.filter(p => p.bankedChips >= milestoneMin && p.bankedChips < milestoneMax).slice(0, limit);
    } else {
      players = rawPlayers.slice(0, limit);
    }
  }

  const entries = players.map((p, i) => {
    const tier = milestoneTierForChips(p.bankedChips);
    return {
      userTag: p.userTag,
      name: p.name,
      country: p.country,
      bankedChips: p.bankedChips,
      level: p.level,
      rank: i + 1,
      isPlayer: session?.userTag === p.userTag,
      milestoneBadge: tier.badge,
      milestoneColor: tier.color,
    };
  });

  const response: Record<string, unknown> = {
    entries,
    view,
    total: entries.length,
  };

  if (view === 'national') {
    response.country = country;
  }
  if (milestone) {
    response.milestone = milestone;
  }

  return NextResponse.json(response);
}
