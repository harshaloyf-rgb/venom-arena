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
              <li><strong>Chip Buy-In:</strong> Deducts buy-in from your banked chips into carried match chips.</li>
              <li><strong>Real Players:</strong> Live PvP with real opponents and leaderboard rankings.</li>
              <li><strong>Graduated Commission:</strong> 0% if ≤3 real players, 35% if ≥4. Extract anytime.</li>
              <li><strong>Full Death Penalty:</strong> On death, your carried chips transform into 10 stars dropped along your body trail for others to collect.</li>
              <li><strong>Star Chips:</strong> Golden stars dropped when real players die. Each star = player&apos;s carried chips ÷ 10. Collect to increase your carried chips.</li>
              <li><strong>XP:</strong> Earned on extraction AND on death (score ×5 + kills ×50, scaled by arena multiplier). Chips are only banked on extraction.</li>
              <li><strong>Map:</strong> Circular boundary that breathes. Stay inside!</li>
              <li><strong>Bots:</strong> Every online arena spawns exactly <strong>999 AI bots</strong> that harvest food, dodge and fight — they respawn to keep the arena full. Real players join on top (up to 1,000 humans per arena). Bots never drop or collect stars.</li>
            </ul>
          </div>

          <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-xl space-y-1.5">
            <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
              <Target className="w-3.5 h-3.5" /> Offline Practice (Risk-Free)
            </span>
            <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
              <li><strong>100% FREE:</strong> Zero chip cost. No buy-in, no ad gate.</li>
              <li><strong>AI Bots:</strong> Up to 999 bots of varied sizes — auto-scaled to your device (weaker phones get ~350, desktops the full crowd) so practice stays smooth everywhere.</li>
              <li><strong>No Chips / Stars / XP:</strong> Score-only (body length). Nothing touches your banked chips — win or die, your balance never changes.</li>
              <li><strong>Bounded Map:</strong> A circular arena that breathes like online — Easy 29,000px, Medium 20,000px, Hard 14,000px radius. Touching the edge kills you (bots avoid it).</li>
              <li><strong>Difficulty Scales:</strong> Bigger arenas and fleeing bots on Easy; tiny dense maps with food scarcity and bot hunters that boost freely on Hard.</li>
              <li><strong>In-Game List:</strong> Top-right score leaderboard (top 10, you highlighted in green, crown for #1) plus your per-arena <strong>Best Ever</strong> high score.</li>
              <li><strong>Ideal for Warmups:</strong> Practice without pressure — extract or exit anytime.</li>
            </ul>
          </div>
        </div>

        <InfoCard title="🏆 Arena Leaderboard: Online vs Offline" accent="text-yellow-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-2.5 space-y-1">
              <span className="font-bold text-emerald-300 text-[11px]">Online Arena Leaderboard (top-right)</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                <li><strong>Top 10</strong> live entries, refreshed from the server</li>
                <li><strong>Toggle:</strong> <strong>Chips</strong> (default, sorted by carried chips) or <strong>Score</strong> (sorted by body length — #1 gets a 👑 crown)</li>
                <li><strong>Your entry:</strong> Highlighted in green</li>
                <li><strong>Empty state:</strong> &quot;No chip holders yet&quot; (Chips view) / &quot;Waiting...&quot; (Score view)</li>
                <li>Your exact rank among all alive snakes is always shown below the minimap (&quot;Rank X / Y&quot;)</li>
              </ul>
            </div>
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-2.5 space-y-1">
              <span className="font-bold text-amber-300 text-[11px]">Offline Practice (score list)</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                <li><strong>Score list (top 10)</strong> top-right — sorted by body length, refreshed ~every 0.5s, crown for #1, your entry in green</li>
                <li><strong>Best Ever</strong> card above it — your all-time practice high score for that arena (saved per arena on this device)</li>
                <li><strong>Rank X / Y</strong> below the minimap compares your score with every alive snake</li>
                <li><strong>Score</strong> (body length) shown bottom-center; <strong>Kills</strong> bottom-right</li>
                <li>No chips, XP (or Pass XP), stars or country flags in practice</li>
              </ul>
            </div>
          </div>
        </InfoCard>
      </Section>

      {/* ================================================================= */}
      {/* THE PLAY PANEL (BATTLE GATE) UI */}
      {/* ================================================================= */}
      <InfoCard title="🎮 The Play Panel (Battle Gate) — How It Works" accent="text-indigo-300">
        <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px] mt-1">
          <li><strong>Mode Toggle:</strong> Online (indigo) vs Offline (amber) at the top — switching resets to the first tier of that mode.</li>
          <li><strong>Difficulty Filters:</strong> All (30) · Beginner · Medium · High Stakes · Extreme · Legendary — six tiers in each group. Tapping a filter jumps to that group&apos;s first tier.</li>
          <li><strong>Jump to Highest Affordable:</strong> A quick link that selects the richest arena your banked chips can currently cover.</li>
          <li><strong>Live Online Counts:</strong> Each online tier shows real players right now out of the 1,000-player arena cap (em dash before the count loads). It excludes the 999 AI bots.</li>
          <li><strong>Unaffordable Tiers:</strong> Buy-in turns red when your bank can&apos;t cover it, the button reads <strong>STAKE AMOUNT EXCEEDS BANK</strong>, and entering shows an insufficient-chips warning.</li>
          <li><strong>Detail Card:</strong> Desktop shows a sticky detail card (stake, extraction, bot population, live players, XP multiplier); mobile expands the same details inline when you tap a tier.</li>
          <li><strong>Online Join:</strong> BUY IN ARENA deducts the buy-in from your banked chips into carried match chips — after the pre-join ad gate (one rewarded ad unlocks 10 minutes of entries; Ad-Free Pass holders and Jade Corridor Virtual Tickets skip it entirely, see the Ad-Free section).</li>
          <li><strong>Offline Join:</strong> START PRACTICE MODE (FREE) drops you straight in — no gate, no ad, no cost.</li>
        </ul>
      </InfoCard>

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

      <InfoCard title="🎯 Practice Tiers (3 Free Tiers — Up to 999 Bots Each, Device-Scaled)" accent="text-amber-300">
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
