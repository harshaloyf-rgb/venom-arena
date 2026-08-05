/* Section 2 — Online vs Offline + Arena Tiers */
'use client';

import { Users, Target } from 'lucide-react';
import { Section, InfoCard, fmtShort } from './_helpers';
import { ARENA_TIERS, PRACTICE_TIERS } from '@/lib/game-config';

export function Section02_Modes() {
  return (
    <>
      <Section icon={<Users className="w-4 h-4" />} title="2. ONLINE MULTIPLAYER VS. OFFLINE PRACTICE" accent="text-emerald-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl space-y-1.5">
            <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5" /> Online Arena (High Stakes)
            </span>
            <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
              <li><strong>Chip Buy-In:</strong> Deducts buy-in from your banked vault into carried match chips.</li>
              <li><strong>Real Players:</strong> Live PvP with real opponents and leaderboard rankings.</li>
              <li><strong>Graduated Commission:</strong> 0% if ≤3 real players, 35% if ≥4. Extract anytime.</li>
              <li><strong>Full Death Penalty:</strong> On death, your carried chips transform into 10 stars at your last position for others to collect.</li>
              <li><strong>Star Chips:</strong> Golden stars dropped when real players die. Each star = player&apos;s carried chips ÷ 10. Collect to increase your carried chips.</li>
              <li><strong>XP:</strong> Earned on successful extraction only.</li>
              <li><strong>Map:</strong> Circular boundary that breathes. Stay inside!</li>
              <li><strong>Bots:</strong> 30 bots per tier. Self-destruct at score≥100. Bots never drop or collect stars.</li>
            </ul>
          </div>

          <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-xl space-y-1.5">
            <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
              <Target className="w-3.5 h-3.5" /> Offline Practice (Risk-Free)
            </span>
            <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
              <li><strong>100% FREE:</strong> Zero chip cost. No buy-in.</li>
              <li><strong>AI Bots:</strong> 1,000 AI bots of varied sizes.</li>
              <li><strong>No Chips / Stars / XP:</strong> Score-based leaderboard (body length), no chip economy</li>
              <li><strong>Infinite Map:</strong> No boundaries, no wall death.</li>
              <li><strong>No Bot Self-Destruct:</strong> Bots just harvest and dodge.</li>
              <li><strong>Ideal for Warmups:</strong> Practice without pressure.</li>
            </ul>
          </div>
        </div>

        <InfoCard title="🏆 Arena Leaderboard: Online vs Offline" accent="text-yellow-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-2.5 space-y-1">
              <span className="font-bold text-emerald-300 text-[11px]">Online Arena Leaderboard</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                <li><strong>Who appears:</strong> Real players only (no bots)</li>
                <li><strong>Sorted by:</strong> Carried Chips (highest first)</li>
                <li><strong>Value shown:</strong> Carried chips in green (e.g., &quot;100c&quot;)</li>
                <li><strong>Your entry:</strong> Highlighted with indigo background + &quot;YOU&quot; badge</li>
                <li><strong>Country flags:</strong> ✅ Shown next to each player name</li>
                <li><strong>Ranking format:</strong> &quot;#X of Y&quot; (e.g., &quot;#1 of 3&quot;)</li>
                <li><strong>Empty state:</strong> Shows &quot;No real players yet.&quot;</li>
              </ul>
            </div>
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-2.5 space-y-1">
              <span className="font-bold text-amber-300 text-[11px]">Offline Practice Leaderboard</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                <li><strong>Who appears:</strong> You + nearby active bots (top 10)</li>
                <li><strong>Sorted by:</strong> Score / body length (highest first)</li>
                <li><strong>Value shown:</strong> Score in indigo (e.g., &quot;42&quot;)</li>
                <li><strong>Your entry:</strong> Highlighted with green background</li>
                <li><strong>Country flags:</strong> ❌ Not shown</li>
                <li><strong>Ranking format:</strong> &quot;#X&quot; only (e.g., &quot;#31&quot;)</li>
                <li><strong>Always populated:</strong> Player + bots always visible</li>
              </ul>
            </div>
          </div>
        </InfoCard>
      </Section>

      {/* ================================================================= */}
      {/* ARENA TIERS REFERENCE TABLE */}
      {/* ================================================================= */}
      <InfoCard title="⚔️ Arena Tiers — 30 Competitive Tiers (10c → 1B)" accent="text-indigo-300">
        <div className="overflow-x-auto mt-1">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left py-1 pr-2">#</th>
                <th className="text-left py-1 pr-2">Tier</th>
                <th className="text-left py-1 pr-2">Buy-In</th>
                <th className="text-left py-1 pr-2">Bots</th>
                <th className="text-left py-1 pr-2">XP Multi</th>
                <th className="text-left py-1">Difficulty</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {ARENA_TIERS.map((tier, i, arr) => (
                <tr key={tier.id} className={i < arr.length - 1 ? 'border-b border-slate-900' : ''}>
                  <td className="py-1 pr-2 font-bold" style={{ color: tier.accentColor }}>#{i + 1}</td>
                  <td className="py-1 pr-2 font-bold" style={{ color: tier.accentColor }}>{tier.name}</td>
                  <td className="py-1 pr-2">{fmtShort(tier.buyIn)}</td>
                  <td className="py-1 pr-2">{tier.botsCount}</td>
                  <td className="py-1 pr-2 text-indigo-300">x{tier.rewardMultiplier}</td>
                  <td className="py-1">{tier.difficulty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </InfoCard>

      <InfoCard title="🎯 Practice Tiers (3 Free Tiers — 1,000 Bots Each)" accent="text-amber-300">
        <div className="overflow-x-auto mt-1">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left py-1 pr-2">Tier</th>
                <th className="text-left py-1 pr-2">Buy-In</th>
                <th className="text-left py-1 pr-2">Bots</th>
                <th className="text-left py-1 pr-2">XP Multi</th>
                <th className="text-left py-1">Difficulty</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {PRACTICE_TIERS.map((tier, i, arr) => (
                <tr key={tier.id} className={i < arr.length - 1 ? 'border-b border-slate-900' : ''}>
                  <td className="py-1 pr-2 font-bold" style={{ color: tier.accentColor }}>{tier.name}</td>
                  <td className="py-1 pr-2 text-emerald-300">FREE</td>
                  <td className="py-1 pr-2">{tier.botsCount}</td>
                  <td className="py-1 pr-2 text-slate-500">x{tier.rewardMultiplier}</td>
                  <td className="py-1">{tier.difficulty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </InfoCard>
    </>
  );
}
