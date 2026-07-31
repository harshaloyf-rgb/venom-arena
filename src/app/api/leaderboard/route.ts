import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { milestoneTierForChips, MILESTONE_TIERS } from '@/lib/game-config';

// ── Regional mapping (mirrors client-side REGION_MAP) ─────────────
const REGION_MAP: Record<string, string> = {
  IN: 'APAC', JP: 'APAC', KR: 'APAC', SG: 'APAC', AU: 'APAC', CN: 'APAC', TW: 'APAC', TH: 'APAC', VN: 'APAC', PH: 'APAC', ID: 'APAC', MY: 'APAC',
  US: 'NA', CA: 'NA', MX: 'NA',
  GB: 'EU', DE: 'EU', FR: 'EU', IT: 'EU', ES: 'EU', NL: 'EU', PL: 'EU', SE: 'EU', NO: 'EU', FI: 'EU', DK: 'EU', PT: 'EU', AT: 'EU', CH: 'EU', BE: 'EU', IE: 'EU', CZ: 'EU', GR: 'EU',
  BR: 'LATAM', AR: 'LATAM', CO: 'LATAM', CL: 'LATAM', PE: 'LATAM',
};

function regionOf(countryCode: string): string {
  return REGION_MAP[countryCode] || 'EU';
}

// GET /api/leaderboard?type=chips|level&limit=50&view=global|national|world_summit|regional&country=US&milestone=gold&region=APAC
export async function GET(req: NextRequest) {
  const session = await getSession();
  const url = new URL(req.url);

  const type = url.searchParams.get('type') === 'level' ? 'level' : 'bankedChips';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 1000, 1000);
  const view = url.searchParams.get('view') || 'global';
  const country = url.searchParams.get('country') || '';
  const milestone = url.searchParams.get('milestone') || '';
  const region = url.searchParams.get('region') || '';

  // Validate view
  if (!['global', 'national', 'world_summit', 'regional'].includes(view)) {
    return NextResponse.json({ error: 'Invalid view. Use global, national, regional, or world_summit.' }, { status: 400 });
  }

  // National view requires country
  if (view === 'national' && !country) {
    return NextResponse.json({ error: 'National view requires a country parameter.' }, { status: 400 });
  }

  // Regional view requires region
  if (view === 'regional' && !region) {
    return NextResponse.json({ error: 'Regional view requires a region parameter (APAC, NA, EU, LATAM).' }, { status: 400 });
  }

  // Validate region if provided
  if (region && !['APAC', 'NA', 'EU', 'LATAM'].includes(region)) {
    return NextResponse.json({ error: 'Invalid region. Use APAC, NA, EU, or LATAM.' }, { status: 400 });
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
      const sortedTiers = MILESTONE_TIERS
        .filter(t => t.id !== 'all')
        .sort((a, b) => b.minChips - a.minChips);
      const nextHigher = sortedTiers.find(t => t.minChips > milestoneMin);
      milestoneMax = nextHigher ? nextHigher.minChips : Infinity;
    }
  }

  // Build list of countries for regional filtering
  const regionCountries = region
    ? Object.entries(REGION_MAP).filter(([, r]) => r === region).map(([c]) => c)
    : [];

  let players: Array<{
    userTag: string;
    name: string;
    country: string;
    bankedChips: number;
    level: number;
    clanTag: string | null;
  }>;

  if (view === 'world_summit') {
    // Top player per country
    const rawRows = await db.$queryRaw<Array<{
      id: string;
      userTag: string;
      name: string;
      country: string;
      bankedChips: number;
      level: number;
      clanTag: string | null;
      banned: boolean;
    }>>`
      SELECT p.* FROM Player p INNER JOIN (
        SELECT country, MAX(bankedChips) as maxChips FROM Player WHERE banned = 0 AND country IS NOT NULL AND country != '' GROUP BY country
      ) top ON p.country = top.country AND p.bankedChips = top.maxChips WHERE p.banned = 0 ORDER BY p.bankedChips DESC
    `;

    let summitPlayers = rawRows.map(r => ({
      userTag: r.userTag,
      name: r.name,
      country: r.country,
      bankedChips: Number(r.bankedChips),
      level: Number(r.level),
      clanTag: r.clanTag,
    }));

    if (milestone) {
      summitPlayers = summitPlayers.filter(p => p.bankedChips >= milestoneMin && p.bankedChips < milestoneMax);
    }

    players = summitPlayers.slice(0, limit);
  } else {
    // Global, National, or Regional view
    const where: Record<string, unknown> = { banned: false };
    if (view === 'national') {
      where.country = country;
    } else if (view === 'regional' && regionCountries.length > 0) {
      where.country = { in: regionCountries };
    }

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
        clanTag: true,
      },
    });

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
      clanTag: p.clanTag,
      region: regionOf(p.country || ''),
      milestoneBadge: tier.badge,
      milestoneColor: tier.color,
    };
  });

  const response: Record<string, unknown> = {
    entries,
    view,
    total: entries.length,
  };

  if (view === 'national') response.country = country;
  if (view === 'regional') response.region = region;
  if (milestone) response.milestone = milestone;

  return NextResponse.json(response);
}
