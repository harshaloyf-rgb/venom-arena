/* Section 10 — Tactical Challenges */
'use client';

import { ListTodo, Zap, Star } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section10_Challenges() {
  return (
    <Section icon={<ListTodo className="w-4 h-4" />} title="10. TACTICAL CHALLENGES" accent="text-emerald-400">
      <p className="mb-2">
        Tactical Challenges are daily and weekly missions that reward bonus chips for completing
        specific in-game objectives. View them in the right sidebar of the Lobby Headquarters.
        Challenges <strong>scale with your level</strong> — as you grow, missions get harder but pay more.
      </p>

      {/* Level Tiers */}
      <InfoCard title="Challenge Level Tiers" accent="text-emerald-300">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
          <div className="bg-emerald-950/30 border border-emerald-500/20 p-2 rounded-lg text-center">
            <div className="text-[10px] font-bold text-emerald-400 uppercase">Novice</div>
            <div className="text-[10px] text-slate-500">Level 1–5</div>
            <div className="text-[10px] text-slate-400">×1.0 reward</div>
          </div>
          <div className="bg-cyan-950/30 border border-cyan-500/20 p-2 rounded-lg text-center">
            <div className="text-[10px] font-bold text-cyan-400 uppercase">Operative</div>
            <div className="text-[10px] text-slate-500">Level 6–15</div>
            <div className="text-[10px] text-slate-400">×1.5 reward</div>
          </div>
          <div className="bg-amber-950/30 border border-amber-500/20 p-2 rounded-lg text-center">
            <div className="text-[10px] font-bold text-amber-400 uppercase">Veteran</div>
            <div className="text-[10px] text-slate-500">Level 16–30</div>
            <div className="text-[10px] text-slate-400">×2.5 reward</div>
          </div>
          <div className="bg-red-950/30 border border-red-500/20 p-2 rounded-lg text-center">
            <div className="text-[10px] font-bold text-red-400 uppercase">Elite</div>
            <div className="text-[10px] text-slate-500">Level 31+</div>
            <div className="text-[10px] text-slate-400">×4.0 reward</div>
          </div>
        </div>
      </InfoCard>

      {/* Challenge Types */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl space-y-1.5">
          <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
            <Zap className="w-3.5 h-3.5" /> Daily Challenges (3 per day)
          </span>
          <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
            <li><strong>3 new challenges</strong> every day (UTC midnight reset)</li>
            <li>Always <strong>3 different categories</strong> (no duplicates in same day)</li>
            <li><strong>Anti-repeat:</strong> yesterday's challenges are excluded</li>
            <li>Objectives include: kills, extractions, star collection, score (body length), arena entries, survival time, and extraction streaks</li>
            <li>Rewards scale with your level tier (×1.0 to ×4.0)</li>
          </ul>
        </div>

        <div className="bg-violet-950/20 border border-violet-500/30 p-3 rounded-xl space-y-1.5">
          <span className="font-bold text-violet-300 flex items-center gap-1.5 text-xs">
            <Star className="w-3.5 h-3.5" /> Weekly Challenges (2 per week)
          </span>
          <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
            <li><strong>2 new challenges</strong> every Monday (UTC weekly reset)</li>
            <li>Always <strong>2 different categories</strong></li>
            <li><strong>Anti-repeat:</strong> last week's challenges are excluded</li>
            <li>Higher difficulty with bigger scaled rewards</li>
            <li>Must claim before the week ends!</li>
          </ul>
        </div>
      </div>

      {/* Streak Bonus */}
      <InfoCard title="🔥 Streak Bonus System" accent="text-amber-300" className="mt-3">
        <p className="mb-1">Complete and claim <strong>ALL daily challenges</strong> for consecutive days to build a streak:</p>
        <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
          <li><strong>3-day streak</strong> → ×1.5 reward bonus on all challenge claims</li>
          <li><strong>7-day streak</strong> → ×2.0 reward bonus</li>
          <li><strong>14-day streak</strong> → ×3.0 reward bonus</li>
          <li>Missing a day resets your streak to 0</li>
          <li>Your current streak and multiplier are shown in the challenges panel header</li>
        </ul>
      </InfoCard>
    </Section>
  );
}
