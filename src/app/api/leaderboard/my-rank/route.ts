import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { milestoneTierForChips, MILESTONE_TIERS } from '@/lib/game-config';

// ── Regional mapping (mirrors client-side) ──────────────────────
const REGION_MAP: Record<string, string> = {
  IN: 'APAC', JP: 'APAC', KR: 'APAC', SG: 'APAC', AU: 'APAC', CN: 'APAC', TW: 'APAC', TH: 'APAC', VN: 'APAC', PH: 'APAC', ID: 'APAC', MY: 'APAC',
  US: 'NA', CA: 'NA', MX: 'NA',
  GB: 'EU', DE: 'EU', FR: 'EU', IT: 'EU', ES: 'EU', NL: 'EU', PL: 'EU', SE: 'EU', NO: 'EU', FI: 'EU', DK: 'EU', PT: 'EU', AT: 'EU', CH: 'EU', BE: 'EU', IE: 'EU', CZ: 'EU', GR: 'EU',
  BR: 'LATAM', AR: 'LATAM', CO: 'LATAM', CL: 'LATAM', PE: 'LATAM',
};

const REGION_NAMES: Record<string, string> = {
  APAC: 'Asia-Pacific', NA: 'North America', EU: 'Europe', LATAM: 'Latin America',
};

function regionOf(countryCode: string): string {
  return REGION_MAP[countryCode] || 'EU';
}

interface MilestoneEntry {
  tier: string;
  badge: string;
  color: string;
  chips: number;
  achievedAt: string;
}

// GET /api/leaderboard/my-rank
export async function GET() {
  const session = await getSession();
  if (!session?.userTag) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const player = await db.player.findUnique({
    where: { userTag: session.userTag },
    select: { id: true, userTag: true, country: true, bankedChips: true, level: true, clanTag: true, createdAt: true },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const playerRegion = regionOf(player.country || '');
  const regionCountries = Object.entries(REGION_MAP)
    .filter(([, r]) => r === playerRegion)
    .map(([c]) => c);

  let globalRank: number;
  let nationalRank: number;
  let regionalRank: number;
  let totalGlobal: number;
  let totalNational: number;
  let totalRegional: number;
  let milestoneHistory: MilestoneEntry[] = [];

  try {
    // Tie-breaking: bankedChips DESC → level DESC → createdAt ASC (veteran wins)
    // Rank = players with more chips + same chips but higher level + same chips & level but earlier join
    const rankWhere = (countryFilter?: Record<string, unknown>) => ({
      banned: false as const,
      ...countryFilter,
    });

    const moreChips = { bankedChips: { gt: player.bankedChips } };
    const sameChipsHigherLevel = { bankedChips: player.bankedChips, level: { gt: player.level } };
    const sameChipsSameLevelEarlier = { bankedChips: player.bankedChips, level: player.level, createdAt: { lt: player.createdAt } };

    const calcRank = async (countryFilter?: Record<string, unknown>) => {
      const base = rankWhere(countryFilter);
      const [a, b, c] = await Promise.all([
        db.player.count({ where: { ...base, ...moreChips } }),
        db.player.count({ where: { ...base, ...sameChipsHigherLevel } }),
        db.player.count({ where: { ...base, ...sameChipsSameLevelEarlier } }),
      ]);
      return a + b + c + 1;
    };

    [globalRank, nationalRank, regionalRank, totalGlobal, totalNational, totalRegional, milestoneHistory] = await Promise.all([
      calcRank(),
      calcRank(player.country ? { country: player.country } : undefined),
      calcRank(regionCountries.length > 0 ? { country: { in: regionCountries } } : undefined),
      db.player.count({ where: { banned: false } }),
      db.player.count({ where: { banned: false, country: player.country } }),
      db.player.count({ where: { banned: false, country: { in: regionCountries } } }),
      // Fetch milestone timestamps
      db.playerMilestone.findMany({
        where: { playerId: player.id },
        orderBy: { createdAt: 'asc' },
        select: { tierId: true, chipsAtMilestone: true, createdAt: true },
      }).then((ms) => ms.map(m => {
        const t = MILESTONE_TIERS.find(mt => mt.id === m.tierId);
        return {
          tier: m.tierId,
          badge: t?.badge || m.tierId,
          color: t?.color || '#94a3b8',
          chips: m.chipsAtMilestone,
          achievedAt: m.createdAt.toISOString(),
        };
      })),
    ]);
  } catch (err: unknown) {
    console.error('[my-rank] error:', err);
    return NextResponse.json({ error: 'DB error', detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  const tier = milestoneTierForChips(player.bankedChips);

  return NextResponse.json({
    globalRank,
    nationalRank,
    regionalRank,
    region: playerRegion,
    regionName: REGION_NAMES[playerRegion] || playerRegion,
    country: player.country,
    bankedChips: player.bankedChips,
    level: player.level,
    clanTag: player.clanTag,
    tier: tier.badge,
    tierName: tier.name,
    totalGlobal,
    totalNational,
    totalRegional,
    milestones: milestoneHistory,
  });
}
