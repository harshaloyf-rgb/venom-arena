import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { milestoneTierForChips } from '@/lib/game-config';

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

// GET /api/leaderboard/my-rank
// Returns the authenticated player's rank summary including regional
export async function GET() {
  const session = await getSession();
  if (!session?.userTag) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const player = await db.player.findUnique({
    where: { userTag: session.userTag },
    select: { userTag: true, country: true, bankedChips: true, level: true, clanTag: true },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const playerRegion = regionOf(player.country || '');
  const regionCountries = Object.entries(REGION_MAP)
    .filter(([, r]) => r === playerRegion)
    .map(([c]) => c);

  // Run all rank queries in parallel
  const [globalRank, nationalRank, regionalRank, totalGlobal, totalNational, totalRegional] = await Promise.all([
    db.player.count({ where: { banned: false, bankedChips: { gt: player.bankedChips } } }).then((c) => c + 1),
    db.player.count({ where: { banned: false, country: player.country, bankedChips: { gt: player.bankedChips } } }).then((c) => c + 1),
    db.player.count({
      where: { banned: false, country: { in: regionCountries }, bankedChips: { gt: player.bankedChips } },
    }).then((c) => c + 1),
    db.player.count({ where: { banned: false } }),
    db.player.count({ where: { banned: false, country: player.country } }),
    db.player.count({ where: { banned: false, country: { in: regionCountries } } }),
  ]);

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
  });
}
