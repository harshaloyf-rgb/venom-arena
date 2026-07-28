'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  HALL_OF_FAME_TIERS,
  INITIAL_COMMENTARY,
  COMMENTARY_NAMES,
  COUNTRIES,
  countryFlag,
  countryName,
  type InspectedPlayer,
} from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Crown,
  Sparkles,
  Trophy,
  Radio,
  Globe,
  Check,
  Award,
  X,
  Search,
} from 'lucide-react';

interface HallOfFameProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type Tab = 'milestones' | 'archives' | 'ticker';
type CommentaryFilter = 'all' | 'extractions' | 'eliminations' | 'milestones';

const YEARS = [2026, 2025, 2024, 2023, 2022];

// National top 100 seed data (H.10)
const COUNTRY_SEEDS: Record<string, { name: string; userTag: string; chips: number; level: number }[]> = {
  IN: [
    { name: 'Hari', userTag: '#IND-001', chips: 10_000_000, level: 50 },
    { name: 'Arjun_Viper', userTag: '#IND-002', chips: 8_400_000, level: 48 },
    { name: 'Delhi_King', userTag: '#IND-003', chips: 6_200_000, level: 45 },
  ],
  US: [
    { name: 'Apex_Viper', userTag: '#USA-882', chips: 9_400_000, level: 49 },
    { name: 'Cyber_Wolf', userTag: '#USA-102', chips: 7_800_000, level: 46 },
  ],
  KR: [
    { name: 'K-Snake_Master', userTag: '#KOR-114', chips: 8_900_000, level: 49 },
  ],
};

function generateNationalTop100(countryCode: string) {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  const countryDisplayName = country?.name || countryCode;
  const seeds = COUNTRY_SEEDS[countryCode] || [];
  const out: { rank: number; name: string; userTag: string; bankedChips: number; level: number }[] = [];
  seeds.forEach((s, i) => out.push({ rank: i + 1, name: s.name, userTag: s.userTag, bankedChips: s.chips, level: s.level }));
  while (out.length < 100) {
    const i = out.length;
    out.push({
      rank: i + 1,
      name: `${countryDisplayName}_Challenger_${i + 1}`,
      userTag: `#${countryCode}-${100 + i}`,
      bankedChips: Math.max(50_000, 5_000_000 - i * 47_000),
      level: Math.max(5, 45 - Math.floor(i / 2.5)),
    });
  }
  return out;
}

// Tier top 100 seed (H.11)
function generateTierTop100(tierId: string) {
  const tier = HALL_OF_FAME_TIERS.find((t) => t.id === tierId);
  if (!tier) return [];
  const out: { rank: number; name: string; userTag: string; country: string; chips: number; level: number; dateStr: string }[] = [];
  // Rank 1 = firstAchiever
  out.push({
    rank: 1,
    name: tier.firstAchiever.name,
    userTag: tier.firstAchiever.userTag,
    country: tier.firstAchiever.country,
    chips: tier.chips,
    level: 45 + Math.floor(Math.random() * 5),
    dateStr: tier.firstAchiever.dateStr,
  });

  if (tierId === 't-1crore') {
    // Special: only 3 achievers
    out.push({ rank: 2, name: 'Apex_Viper', userTag: '#USA-882', country: 'US', chips: 10_000_000, level: 49, dateStr: '24 Jan 2026, 09:11 AM UTC' });
    out.push({ rank: 3, name: 'K-Snake_Master', userTag: '#KOR-114', country: 'KR', chips: 10_000_000, level: 49, dateStr: '25 Jan 2026, 04:30 PM SGT' });
    return out;
  }

  while (out.length < 100) {
    const i = out.length;
    const c = COUNTRIES[i % COUNTRIES.length];
    out.push({
      rank: i + 1,
      name: `${c.name.split(' ')[0]}_Achiever_${i + 1}`,
      userTag: `#${c.code}-${100 + i}`,
      country: c.code,
      chips: tier.chips,
      level: Math.max(5, 45 - Math.floor(i / 2.5)),
      dateStr: `${10 + (i % 18)} Jan 2026, 0${i % 9}:${i % 60} ${i % 2 ? 'PM' : 'AM'} UTC`,
    });
  }
  return out;
}

const COUNTRY_OPTIONS = [
  { code: 'GLOBAL', name: 'Global', flag: '🌐' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
];

function fmtChips(n: number) {
  return n.toLocaleString('en-IN');
}

export function HallOfFame({ onToast, onInspectPlayer }: HallOfFameProps) {
  const { player } = useAuth();
  const [tab, setTab] = useState<Tab>('milestones');
  const [milestoneYear, setMilestoneYear] = useState(2026);
  const [archiveYear, setArchiveYear] = useState(2026);
  const [archiveCountry, setArchiveCountry] = useState('GLOBAL');
  const [commentary, setCommentary] = useState(INITIAL_COMMENTARY);
  const [tickerFilter, setTickerFilter] = useState<CommentaryFilter>('all');
  const [inspectedTierId, setInspectedTierId] = useState<string | null>(null);

  // Live commentary ticker (every 5 seconds)
  useEffect(() => {
    if (tab !== 'ticker') return;
    const id = setInterval(() => {
      const name = COMMENTARY_NAMES[Math.floor(Math.random() * COMMENTARY_NAMES.length)];
      const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
      const chips = 50_000 + Math.floor(Math.random() * 5_000_000);
      const templates = [
        `🎙️ LIVE EXTRACTION: ${name} from ${country.name} ${country.flag} successfully extracted ${fmtChips(chips)} chips in Tier-05 Arena!`,
        `💥 ARENA ELIMINATION: ${name} ${country.flag} trapped a rival viper and claimed ${fmtChips(Math.floor(chips / 2))} star chips!`,
        `👑 MILESTONE UPDATE: ${name} ${country.flag} reached a new milestone tier with ${fmtChips(chips)} chips!`,
        `🔥 HIGH STAKES ACTION: Room #04 is boiling as ${name} ${country.flag} enters extraction zone holding ${fmtChips(chips)} chips!`,
      ];
      const text = templates[Math.floor(Math.random() * templates.length)];
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC';
      setCommentary((prev) => [{ id: `c-${Date.now()}`, ts, text }, ...prev].slice(0, 30));
    }, 5000);
    return () => clearInterval(id);
  }, [tab]);

  const filteredCommentary = useMemo(() => {
    if (tickerFilter === 'all') return commentary;
    const filters: Record<Exclude<CommentaryFilter, 'all'>, RegExp> = {
      extractions: /EXTRACTION/i,
      eliminations: /ELIMINATION/i,
      milestones: /MILESTONE/i,
    };
    return commentary.filter((c) => filters[tickerFilter as Exclude<CommentaryFilter, 'all'>].test(c.text));
  }, [commentary, tickerFilter]);

  if (!player) return <NotSignedIn />;

  const nationalTop100 = generateNationalTop100(archiveCountry === 'GLOBAL' ? 'IN' : archiveCountry);
  const inspectedTier = inspectedTierId ? HALL_OF_FAME_TIERS.find((t) => t.id === inspectedTierId) : null;
  const inspectedTierRanks = inspectedTierId ? generateTierTop100(inspectedTierId) : [];

  function inspectFromName(name: string, userTag: string, country: string, chips: number, level: number) {
    if (!onInspectPlayer) return;
    onInspectPlayer({
      name,
      userTag,
      country,
      flag: countryFlag(country),
      bankedChips: chips,
      level,
      clanTag: 'APEX',
      clanName: 'Viper Apex Syndicate',
      achievedAt: '26 Jul 2026, 05:42 PM UTC',
    });
  }

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-yellow-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5">
            <Crown className="w-5.5 h-5.5 text-yellow-400" />
            Project Venom Hall of Fame &amp; Esports Shrine
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Immortalizing milestone achievers (1 Lakh to 1 Crore), annual World Cup champions,
            and live 1–100 national &amp; global tier rankings!
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-5">
        <HoFTabBtn active={tab === 'milestones'} onClick={() => setTab('milestones')} icon={Sparkles} label="Milestone Tiers (1L - 1Cr)" />
        <HoFTabBtn active={tab === 'archives'} onClick={() => setTab('archives')} icon={Trophy} label="Tournament Archives (Ranks 1-100)" />
        <HoFTabBtn active={tab === 'ticker'} onClick={() => setTab('ticker')} icon={Radio} label="Live Esports Ticker" />
      </div>

      {/* Live broadcast marquee */}
      <div className="relative mb-5 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 flex items-center gap-3 overflow-hidden">
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-rose-300 uppercase tracking-widest px-2 py-1 bg-rose-500/20 border border-rose-500/40 rounded shrink-0">
          <Radio className="w-3 h-3 animate-pulse" /> LIVE BROADCAST
        </span>
        <div className="text-xs text-rose-200 truncate">
          {commentary[0]?.text || '🎙️ ESPORTS COMMENTARY ACTIVE: Welcome to Project Venom World Arena Championship!'}
        </div>
      </div>

      {/* Tab 1: Milestone Tiers */}
      {tab === 'milestones' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/10 p-3 text-[11px] text-yellow-200 leading-relaxed">
            <strong>PERMANENT MILESTONE IMMORTALITY</strong>
            <br />
            Whenever a player reaches a milestone target (from 1 Lakh to 1 Crore Chips),
            their record is permanently inscribed in the Hall of Fame for that tournament year!
            Live ranks update every 30 mins.
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Milestone Year:</span>
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setMilestoneYear(y)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition border ${milestoneYear === y ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
              >
                {y}{y === 2026 ? ' (Current)' : ''}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {HALL_OF_FAME_TIERS.map((tier) => (
              <div
                key={tier.id}
                className="relative p-5 rounded-2xl border border-slate-800 bg-slate-950/80 shadow-md flex flex-col gap-3 overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" aria-hidden />
                <div className="flex items-start justify-between gap-2 relative">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-yellow-400 inline-block">{tier.badge}</span>
                    <h3 className="text-sm font-bold text-white mt-1">{tier.name}</h3>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-full shrink-0">
                    Season {milestoneYear}
                  </span>
                </div>

                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  FIRST ACHIEVER ({milestoneYear})
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-yellow-500 to-amber-700 flex items-center justify-center text-lg shrink-0" aria-hidden>
                    {countryFlag(tier.firstAchiever.country)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                      {tier.firstAchiever.name}
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                        <Check className="w-2.5 h-2.5" /> Achieved!
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      {tier.firstAchiever.userTag} · 🕒 {tier.firstAchiever.dateStr}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <div>
                    <MicroLabel>Total Qualifiers This Year:</MicroLabel>
                    <div className="font-mono font-bold text-yellow-400 mt-0.5">
                      {tier.totalAchieversCount.toLocaleString()} Players
                    </div>
                  </div>
                  <div className="text-right">
                    <MicroLabel>Threshold</MicroLabel>
                    <div className="font-mono font-bold text-emerald-400 mt-0.5">{fmtChips(tier.chips)}c</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectedTierId(tier.id)}
                  className="mt-1 px-3 py-2 rounded-lg bg-slate-900 hover:bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Trophy className="w-3.5 h-3.5" /> View Ranks #1 to #100 for {milestoneYear}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Tournament Archives */}
      {tab === 'archives' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setArchiveYear(y)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition border ${archiveYear === y ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
              >
                {y}{y === 2026 ? ' (Current Live)' : ' (Archive)'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white">Country Leaderboard:</span>
            <select
              value={archiveCountry}
              onChange={(e) => setArchiveCountry(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500/50"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white">
              {archiveYear} {archiveCountry === 'GLOBAL' ? 'Global' : countryName(archiveCountry)} Top 100 Ranking
            </h3>
            <span className="text-[9px] font-mono text-amber-300 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
              #1 Country Champion Wins National Gold Medal
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <div className="col-span-1">Rank</div>
              <div className="col-span-4">Challenger</div>
              <div className="col-span-2">User Tag</div>
              <div className="col-span-2 text-right">Banked Chips</div>
              <div className="col-span-1 text-right">Level</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            <ol className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
              {nationalTop100.map((e) => (
                <li key={e.userTag + e.rank} className="grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm hover:bg-slate-900/40 transition-colors">
                  <div className="col-span-1 font-mono">
                    {e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : <span className="text-slate-400 font-bold">#{e.rank}</span>}
                    {e.rank === 1 && <span className="ml-1 text-[9px] font-mono font-bold text-yellow-400">NATIONAL CHAMP</span>}
                  </div>
                  <div className="col-span-4 min-w-0">
                    <div className="font-bold text-white truncate flex items-center gap-1.5">
                      <span aria-hidden>{countryFlag(archiveCountry === 'GLOBAL' ? 'IN' : archiveCountry)}</span>
                      {e.name}
                    </div>
                  </div>
                  <div className="col-span-2 text-[10px] font-mono text-slate-500 truncate">{e.userTag}</div>
                  <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">
                    {fmtChips(e.bankedChips)}c
                  </div>
                  <div className="col-span-1 text-right text-xs text-amber-400 font-mono">{e.level}</div>
                  <div className="col-span-2 text-right">
                    <button
                      type="button"
                      onClick={() => inspectFromName(e.name, e.userTag, archiveCountry === 'GLOBAL' ? 'IN' : archiveCountry, e.bankedChips, e.level)}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-slate-900 hover:bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 transition"
                    >
                      Inspect
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Tab 3: Live Esports Ticker */}
      {tab === 'ticker' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Radio className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold text-white">Channel Filter:</span>
            {([
              { id: 'all', label: '🌐 All Arena Events' },
              { id: 'extractions', label: '💰 High Stakes Extractions' },
              { id: 'eliminations', label: '💥 Viper Eliminations' },
              { id: 'milestones', label: '👑 Milestone Breakers' },
            ] as const).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTickerFilter(f.id)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition border ${tickerFilter === f.id ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <ol className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
              {filteredCommentary.length === 0 ? (
                <li className="p-6 text-center text-xs text-slate-500">No events in this channel yet…</li>
              ) : (
                filteredCommentary.map((c) => (
                  <li key={c.id} className="px-4 py-3 text-sm flex items-start gap-3 hover:bg-slate-900/40 transition-colors">
                    <span className="text-[10px] font-mono text-slate-500 mt-0.5 shrink-0">{c.ts}</span>
                    <span className="text-slate-200 leading-relaxed">{c.text}</span>
                  </li>
                ))
              )}
            </ol>
          </div>
        </div>
      )}

      {/* Tier Top 100 Modal */}
      {inspectedTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[85vh] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-400" /> {inspectedTier.name}
                </h3>
                <p className="text-[10px] font-mono text-slate-400 mt-1">
                  Target Threshold: {fmtChips(inspectedTier.chips)}c
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-yellow-300 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                  Ranks 1–100
                </span>
                <button
                  type="button"
                  onClick={() => setInspectedTierId(null)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-auto va-scroll flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-2.5">Tier Rank</th>
                    <th className="text-left px-4 py-2.5">Immortal Achiever</th>
                    <th className="text-left px-4 py-2.5">User Tag</th>
                    <th className="text-left px-4 py-2.5">Achieved On</th>
                    <th className="text-right px-4 py-2.5">Qualifying Chips</th>
                    <th className="text-right px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {inspectedTierRanks.map((r) => (
                    <tr key={r.userTag + r.rank} className="hover:bg-slate-900/40 transition">
                      <td className="px-4 py-3 font-mono">
                        {r.rank === 1 ? (
                          <span className="text-yellow-400 font-bold">👑 #1 First</span>
                        ) : r.rank <= 3 ? (
                          <span className="text-lg">{['', '🥇', '🥈', '🥉'][r.rank]}</span>
                        ) : (
                          <span className="text-slate-400 font-bold">#{r.rank}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-white flex items-center gap-1.5">
                        <span aria-hidden>{countryFlag(r.country)}</span> {r.name}
                      </td>
                      <td className="px-4 py-3 text-[10px] font-mono text-slate-500">{r.userTag}</td>
                      <td className="px-4 py-3 text-[10px] font-mono text-slate-400">{r.dateStr}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 tabular-nums">
                        {fmtChips(r.chips)}c
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => inspectFromName(r.name, r.userTag, r.country, r.chips, r.level)}
                          className="px-2 py-1 rounded text-[10px] font-bold bg-slate-900 hover:bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 transition"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface HoFTabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: typeof Crown;
  label: string;
}

function HoFTabBtn({ active, onClick, icon: Icon, label }: HoFTabBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${active ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

export default HallOfFame;
