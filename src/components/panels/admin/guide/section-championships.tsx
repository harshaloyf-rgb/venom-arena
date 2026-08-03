'use client';

import { Target } from 'lucide-react';
import { SubHeading, Bullet, Note } from './_helpers';

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

      <SubHeading>Finalization</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Admins finalize past championship years via the API endpoint <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">POST /api/admin/championship/finalize</code>.
        </Bullet>
        <Bullet>
          This is <strong className="text-slate-200">not yet available in the UI</strong> — must be called directly.
        </Bullet>
        <Bullet>
          Finalization locks in the leaderboard and triggers Hall of Fame induction.
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
          Hall of Fame entries are permanent records displayed in the championships UI.
        </Bullet>
      </ul>

      <Note>
        <strong>Bug fix this session:</strong> Championship finalization was broken due to referencing the wrong field when computing rankings. This has been corrected and the endpoint now works as intended.
      </Note>
    </div>
  );
}