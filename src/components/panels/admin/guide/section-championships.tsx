'use client';

import { Target } from 'lucide-react';
import { SubHeading, Bullet } from './_helpers';

export function SectionChampionships() {
  return (
    <div className="space-y-1">
      <SubHeading>Annual Tournament System</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Championships run on an <strong className="text-slate-200">annual cycle</strong> — one tournament per year.
        </Bullet>
        <Bullet>
          Players register for the <strong className="text-slate-200">current year's</strong> championship through the in-game UI.
        </Bullet>
        <Bullet>
          Rankings are based on accumulated <strong className="text-amber-400">chip totals</strong> during the tournament period.
        </Bullet>
      </ul>

      <SubHeading>Finalization (Jan 1 close)</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Run <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">POST /api/admin/championship/finalize</code> with body <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">{`{ "year": 2026 }`}</code> (defaults to the last completed calendar year; admin session required).
        </Bullet>
        <Bullet>
          One transaction does everything: pays top-100 chip prizes (5M / 2.5M / 1M / 250K), inducts the top 100 into the Hall of Fame (badges crown / silver / bronze / contender), and writes the archive row (winner, top clan, participants, payoutsProcessed).
        </Bullet>
        <Bullet>
          <strong className="text-amber-400">Idempotency:</strong> once the archive row says payoutsProcessed, the route refuses with 409 — prizes can never be paid twice. Finalizing the current (unfinished) calendar year requires <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">{`{ "force": true }`}</code> (testing only).
        </Bullet>
        <Bullet>
          <strong className="text-red-400">Order matters:</strong> run finalization BEFORE the Jan 1 wallet reset — the reset zeroes bankedChips, which is the source of truth for final standings. Check the reset status in the Economy tab first.
        </Bullet>
        <Bullet>
          Banned players are excluded automatically (same filter as the standings API), so banned accounts can never occupy a prize spot.
        </Bullet>
        <Bullet>
          Manual fallback (e.g. correcting a single player): <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">POST /api/admin/modify-chips</code> for prizes and <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">POST /api/hof/induct</code> with <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">{`{ inductionType: "championship", championshipYear, championshipRank }`}</code> for induction — both are audit-logged.
        </Bullet>
      </ul>

      <SubHeading>Hall of Fame</SubHeading>
      <div className="flex items-center gap-1.5 mb-2">
        <Target className="h-3.5 w-3.5 text-yellow-400" />
        <span className="text-[11px] text-slate-500">Top performers are permanently enshrined.</span>
      </div>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          The <strong className="text-amber-400">Top 100 players</strong> by chip count are inducted into the Hall of Fame upon finalization.
        </Bullet>
        <Bullet>
          Hall of Fame entries are permanent records displayed in the championships UI and archived years remain viewable in the player-facing Past Championship Archives section.
        </Bullet>
      </ul>
    </div>
  );
}