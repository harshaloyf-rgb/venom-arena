/**
 * GET /api/championship/standings
 *
 * Query params:
 *   scope=global|regional|national
 *   region=APAC|NA|EU|LATAM
 *   country=IN
 *   rankFilter=all|rank1|rank2_10|rank11_50|rank51_100
 *   search=q
 *   clanView=true  (returns clan-aggregated rankings instead of player list)
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { countryFlag, CHAMPIONSHIP_PRIZE_TIERS } from '@/lib/game-config';

const CURRENT_YEAR = 2026;

const REGION_MAP: Record<string, string> = {
  IN: 'APAC', JP: 'APAC', KR: 'APAC', SG: 'APAC', AU: 'APAC', CN: 'APAC',
  TW: 'APAC', TH: 'APAC', VN: 'APAC', PH: 'APAC', ID: 'APAC', MY: 'APAC',
  US: 'NA', CA: 'NA', MX: 'NA',
  GB: 'EU', DE: 'EU', FR: 'EU', IT: 'EU', ES: 'EU', NL: 'EU', PL: 'EU',
  SE: 'EU', NO: 'EU', FI: 'EU', DK: 'EU', PT: 'EU', AT: 'EU', CH: 'EU',
  BE: 'EU', IE: 'EU', CZ: 'EU', GR: 'EU',
  BR: 'LATAM', AR: 'LATAM', CO: 'LATAM', CL: 'LATAM', PE: 'LATAM',
};

function regionOf(cc: string) { return REGION_MAP[cc] || 'EU'; }

function prizeForRank(rank: number) {
  if (rank === 1) return CHAMPIONSHIP_PRIZE_TIERS[0];
  if (rank <= 10) return CHAMPIONSHIP_PRIZE_TIERS[1];
  if (rank <= 50) return CHAMPIONSHIP_PRIZE_TIERS[2];
  if (rank <= 100) return CHAMPIONSHIP_PRIZE_TIERS[3];
  return null;
}

function rankCat(rank: number): string {
  if (rank === 1) return 'rank1';
  if (rank <= 10) return 'rank2_10';
  if (rank <= 50) return 'rank11_50';
  return 'rank51_100';
}

// In-memory set of live player tags (could be updated by game-server heartbeats)
const LIVE_SET = new Set<string>();
export function markLive(tag: string, on: boolean) {
  if (on) LIVE_SET.add(tag); else LIVE_SET.delete(tag);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const u = new URL(req.url);
  const scope  = u.searchParams.get('scope')  || 'global';
  const region = u.searchParams.get('region') || '';
  const country= u.searchParams.get('country')|| '';
  const rf     = u.searchParams.get('rankFilter') || 'all';
  const search = u.searchParams.get('search') || '';
  const clanV  = u.searchParams.get('clanView') === 'true';

  /* ── Fetch registered players ─────────────────────────────── */
  const regs = await db.championshipRegistration.findMany({
    where: { year: CURRENT_YEAR, isActive: true },
    include: { player: { select: {
      userTag: true, name: true, country: true, bankedChips: true,
      level: true, clanTag: true, createdAt: true,
    }}},
  });

  const sorted = regs
    .map(r => ({
      userTag: r.player.userTag,
      name: r.player.name,
      country: r.player.country,
      region: regionOf(r.player.country || ''),
      bankedChips: r.player.bankedChips,
      level: r.player.level,
      clanTag: r.player.clanTag || '',
      gamesPlayed: r.gamesPlayed,
      createdAt: r.player.createdAt.toISOString(),
      isLive: LIVE_SET.has(r.player.userTag),
      isPlayer: session?.userTag === r.player.userTag,
    }))
    .sort((a, b) => {
      if (b.bankedChips !== a.bankedChips) return b.bankedChips - a.bankedChips;
      if (b.level !== a.level) return b.level - a.level;
      return a.createdAt.localeCompare(b.createdAt);
    })
    .map((c, i) => ({ ...c, rank: i + 1 }));

  /* ── Clan aggregated view ─────────────────────────────────── */
  if (clanV) {
    const map = new Map<string, { tag:string; totalChips:number; count:number; topChips:number; topName:string; topCountry:string }>();
    for (const c of sorted) {
      if (!c.clanTag) continue;
      const e = map.get(c.clanTag);
      if (e) {
        e.totalChips += c.bankedChips;
        e.count++;
        if (c.bankedChips > e.topChips) { e.topChips = c.bankedChips; e.topName = c.name; e.topCountry = c.country; }
      } else {
        map.set(c.clanTag, { tag: c.clanTag, totalChips: c.bankedChips, count: 1, topChips: c.bankedChips, topName: c.name, topCountry: c.country });
      }
    }
    const clans = Array.from(map.values())
      .sort((a, b) => b.totalChips - a.totalChips)
      .map((c, i) => ({ ...c, rank: i + 1, avgChips: Math.round(c.totalChips / c.count) }));
    return NextResponse.json({ view: 'clan', entries: clans, total: clans.length, hasRealData: regs.length > 0 });
  }

  /* ── Player view ──────────────────────────────────────────── */
  let filtered = sorted;
  if (scope === 'regional' && region) filtered = filtered.filter(c => c.region === region);
  else if (scope === 'national' && country) filtered = filtered.filter(c => c.country === country);
  if (rf !== 'all') filtered = filtered.filter(c => rankCat(c.rank) === rf);
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(q) || c.userTag.toLowerCase().includes(q) || c.clanTag.toLowerCase().includes(q));
  }

  const entries = filtered.map(c => {
    const p = prizeForRank(c.rank);
    return {
      ...c,
      prize: p ? { chipsReward: p.chipsReward, crownTitle: p.crownTitle } : null,
      efficiency: c.gamesPlayed > 0 ? Math.round(c.bankedChips / c.gamesPlayed) : 0,
      flag: countryFlag(c.country),
    };
  });

  /* ── Player summary (for My Championship card) ────────────── */
  let playerStatus = null;
  if (session) {
    const me = sorted.find(c => c.isPlayer);
    if (me) {
      const idx = sorted.indexOf(me);
      const above = idx > 0 ? sorted[idx - 1] : null;
      const below = idx < sorted.length - 1 ? sorted[idx + 1] : null;
      playerStatus = {
        rank: me.rank,
        bankedChips: me.bankedChips,
        gamesPlayed: me.gamesPlayed,
        efficiency: me.gamesPlayed > 0 ? Math.round(me.bankedChips / me.gamesPlayed) : 0,
        prize: prizeForRank(me.rank) ? { chipsReward: prizeForRank(me.rank)!.chipsReward, crownTitle: prizeForRank(me.rank)!.crownTitle } : null,
        gapAbove: above ? above.bankedChips - me.bankedChips : null,
        gapBelow: below ? me.bankedChips - below.bankedChips : null,
        aboveName: above?.name ?? null,
        belowName: below?.name ?? null,
      };
    }
  }

  return NextResponse.json({ view: scope, entries, total: entries.length, hasRealData: regs.length > 0, playerStatus });
}
