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
  const view = url.searchParams.get('view') || 'global';
  const country = url.searchParams.get('country') || '';
  const milestone = url.searchParams.get('milestone') || '';
  const region = url.searchParams.get('region') || '';

  // Global view gets 1-to-N (up to 1000), all others are top 100
  const isGlobal = view === 'global' && !milestone;
  const maxLimit = isGlobal ? 1000 : 100;
  const limit = Math.min(Number(url.searchParams.get('limit')) || maxLimit, maxLimit);

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

  // Tie-breaking order: bankedChips DESC → level DESC → createdAt ASC (veteran wins)
  const tieBreakOrder = type === 'level'
    ? [{ level: 'desc' as const }, { bankedChips: 'desc' as const }, { createdAt: 'asc' as const }]
    : [{ bankedChips: 'desc' as const }, { level: 'desc' as const }, { createdAt: 'asc' as const }];

  let players: Array<{
    userTag: string;
    name: string;
    country: string;
    bankedChips: number;
    level: number;
    clanTag: string | null;
    createdAt: Date;
  }>;

  if (view === 'world_summit') {
    // Top player per country — tie-break: chips DESC, level DESC, createdAt ASC
    const rawRows = await db.$queryRaw<Array<{
      id: string;
      userTag: string;
      name: string;
      country: string;
      bankedChips: number;
      level: number;
      clanTag: string | null;
      createdAt: Date;
      banned: boolean;
    }>>`
      SELECT * FROM (
        SELECT p.*, ROW_NUMBER() OVER (
          PARTITION BY p.country
          ORDER BY p.bankedChips DESC, p.level DESC, p.createdAt ASC
        ) as rn
        FROM Player p
        WHERE p.banned = 0 AND p.country IS NOT NULL AND p.country != ''
      ) ranked
      WHERE rn = 1
      ORDER BY bankedChips DESC, level DESC, createdAt ASC
    `;

    let summitPlayers = rawRows.map(r => ({
      userTag: r.userTag,
      name: r.name,
      country: r.country,
      bankedChips: Number(r.bankedChips),
      level: Number(r.level),
      clanTag: r.clanTag,
      createdAt: r.createdAt,
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
      orderBy: tieBreakOrder,
      take: fetchLimit,
      select: {
        userTag: true,
        name: true,
        country: true,
        bankedChips: true,
        level: true,
        clanTag: true,
        createdAt: true,
      },
    });

    if (milestone) {
      players = rawPlayers.filter(p => p.bankedChips >= milestoneMin && p.bankedChips < milestoneMax).slice(0, limit);
    } else {
      players = rawPlayers.slice(0, limit);
    }
  }

  // Fetch HOF player IDs for badge display (S5)
  const hofPlayerIds = new Set<string>();
  try {
    const hofEntries = await db.hallOfFameEntry.findMany({
      select: { playerId: true },
      distinct: ['playerId'],
    });
    for (const e of hofEntries) hofPlayerIds.add(e.playerId);
  } catch {
    // Best-effort
  }

  // Map userTags to player IDs for HOF lookup
  const playerIds = await db.player.findMany({
    where: { userTag: { in: players.map(p => p.userTag) } },
    select: { userTag: true, id: true },
  });
  const userTagToId = new Map(playerIds.map(p => [p.userTag, p.id]));

  const entries = players.map((p, i) => {
    const tier = milestoneTierForChips(p.bankedChips);
    const pid = userTagToId.get(p.userTag) ?? '';
    return {
      userTag: p.userTag,
      name: p.name,
      country: p.country,
      bankedChips: p.bankedChips,
      level: p.level,
      rank: i + 1,
      isPlayer: session?.userTag === p.userTag,
      isHOF: hofPlayerIds.has(pid),
      clanTag: p.clanTag,
      region: regionOf(p.country || ''),
      milestoneBadge: tier.badge,
      milestoneColor: tier.color,
      createdAt: p.createdAt.toISOString(),
    };
  });

  const response: Record<string, unknown> = {
    entries,
    view,
    total: entries.length,
    isGlobal1toN: isGlobal,
  };

  if (view === 'national') response.country = country;
  if (view === 'regional') response.region = region;
  if (milestone) response.milestone = milestone;

  return NextResponse.json(response);
}
