/* Section 13 — Annual Championships */
'use client';

import { Trophy } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section13_Championships() {
  return (
    <Section icon={<Trophy className="w-4 h-4" />} title="13. ANNUAL CHAMPIONSHIPS" accent="text-amber-400">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <InfoCard title="🏆 What is the Annual Championship?" accent="text-amber-300">
          <p className="mb-1">The <strong>Annual Championship</strong> is a year-long competitive event that tracks every player&apos;s performance across all online matches. Unlike the lobby leaderboard (which is live/session-based), championship standings persist across the entire calendar year and culminate in a <strong>Jan 1st Payout</strong>.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Runs from <strong>Jan 1 to Dec 31</strong> each year</li>
            <li>Every online match counts toward your championship score</li>
            <li>Top finishers earn prizes and Hall of Fame induction</li>
            <li>Results are archived and viewable in perpetuity</li>
          </ul>
        </InfoCard>

        <InfoCard title="📋 DB-Backed Registration" accent="text-cyan-300">
          <p className="mb-1">Championship registration is handled entirely through the database — no separate sign-up needed:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Auto-enrolled:</strong> Every registered player is automatically entered when they play their first online match of the year</li>
            <li><strong>Persistent:</strong> Your registration status, match history, and standings are stored server-side in the database</li>
            <li><strong>One account per player:</strong> Duplicate or alt accounts are merged using your VENOM-XXXX tag</li>
            <li><strong>Guest players:</strong> Must register or link a social account before their championship stats are tracked</li>
          </ul>
        </InfoCard>

        <InfoCard title="💰 Jan 1st Payout &amp; Hall of Fame Tiers" accent="text-yellow-300">
          <p className="mb-1.5">On <strong>January 1st</strong> of each year, final standings are locked and prizes are distributed based on your final championship rank:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] mt-1">
              <thead>
                <tr className="text-left border-b border-slate-700">
                  <th className="py-1 pr-2 text-slate-300">Rank</th>
                  <th className="py-1 pr-2 text-slate-300">HOF Tier</th>
                  <th className="py-1 pr-2 text-slate-300">Prize</th>
                  <th className="py-1 text-slate-300">Perk</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#fbbf24' }}>#1</td>
                  <td className="py-1 pr-2" style={{ color: '#fbbf24' }}>👑 World Champion</td>
                  <td className="py-1 pr-2 text-slate-400">5,000,000c</td>
                  <td className="py-1 text-slate-400">Permanent crown badge + HOF plaque</td>
                </tr>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#a1a1aa' }}>#2–10</td>
                  <td className="py-1 pr-2" style={{ color: '#a1a1aa' }}>🥈 Elite 10</td>
                  <td className="py-1 pr-2 text-slate-400">500,000c each</td>
                  <td className="py-1 text-slate-400">Silver HOF badge + title</td>
                </tr>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#cd7f32' }}>#11–50</td>
                  <td className="py-1 pr-2" style={{ color: '#cd7f32' }}>🥉 Masters 50</td>
                  <td className="py-1 pr-2 text-slate-400">100,000c each</td>
                  <td className="py-1 text-slate-400">Bronze HOF badge</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2 font-bold" style={{ color: '#64748b' }}>#51–100</td>
                  <td className="py-1 pr-2" style={{ color: '#64748b' }}>🛡️ Qualifier 100</td>
                  <td className="py-1 pr-2 text-slate-400">25,000c each</td>
                  <td className="py-1 text-slate-400">Qualifier badge + next-year priority</td>
                </tr>
              </tbody>
            </table>
          </div>
        </InfoCard>

        <InfoCard title="📊 My Championship Summary" accent="text-emerald-300">
          <p className="mb-1">A personal dashboard card shows your championship progress at a glance:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Current Rank:</strong> Your live position in the championship standings</li>
            <li><strong>Matches Played:</strong> Total online matches this year</li>
            <li><strong>Total Extracted:</strong> Cumulative chips extracted across all matches</li>
            <li><strong>Win Rate:</strong> Percentage of matches where you successfully extracted</li>
            <li><strong>Best Streak:</strong> Longest consecutive extraction streak</li>
            <li><strong>Projected Tier:</strong> Based on current pace, which HOF tier you&apos;re on track for</li>
          </ul>
        </InfoCard>

        <InfoCard title="⚠️ Match Cap Warnings (9K / 9.5K / 9.9K)" accent="text-red-400">
          <p className="mb-1">To encourage fair play and prevent grinding exploits, the championship has <strong>annual match caps</strong> with escalating warnings:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>9,000 matches:</strong> Yellow warning — &quot;Approaching annual cap. Matches beyond 9,500 score at 75% weight.&quot;</li>
            <li><strong>9,500 matches:</strong> Orange warning — &quot;Near cap. Matches beyond 9,900 score at 50% weight.&quot;</li>
            <li><strong>9,900 matches:</strong> Red warning — &quot;Final 100 matches. These score at 25% weight. Plan carefully!&quot;</li>
            <li><strong>10,000 matches:</strong> Hard cap reached — no further championship scoring for the year</li>
          </ul>
          <p className="mt-1 text-amber-400/80">Caps reset every Jan 1st. Quality over quantity — each match should count!</p>
        </InfoCard>

        <InfoCard title="🌍 Standings Scopes &amp; Clan Rankings" accent="text-indigo-300">
          <p className="mb-1">Championship standings support <strong>4 scope tabs</strong> — just like the lobby leaderboard:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>GLOBAL</strong> — All players worldwide, ranked by championship score</li>
            <li><strong>REGIONAL</strong> — Players grouped by geographic region (e.g., Asia, Europe, Americas)</li>
            <li><strong>NATIONAL</strong> — Players from your country only</li>
            <li><strong>CLAN</strong> — Clan-based rankings: aggregates all clan members&apos; championship scores into a clan total, then ranks clans against each other</li>
          </ul>
          <p className="mt-1">Clan rankings use the <strong>sum of top 10 members&apos; scores</strong> to prevent single-player clan exploits. A &quot;Clan Members&quot; count shows active participants.</p>
        </InfoCard>

        <InfoCard title="🟢 Live Activity Indicators" accent="text-green-400">
          <p className="mb-1">On the championship standings, some player rows display a <strong>green pulsing dot</strong> next to their name:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Green pulsing dot = currently online</strong> — that player is in an active match right now</li>
            <li><strong>No dot = offline</strong> — the player is not currently in a match</li>
            <li>The dot updates in real-time via the server&apos;s presence system</li>
            <li>It adds a competitive edge — you can see if your rivals are grinding!</li>
          </ul>
          <p className="mt-1">The pulsing animation uses a smooth CSS animation (scale + opacity) on a 2-second loop.</p>
        </InfoCard>

        <InfoCard title="🔍 Find Me in Championship" accent="text-violet-300">
          <p className="mb-1">The <strong>Find Me</strong> button works the same as the lobby leaderboard:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Click <strong>Find Me</strong> on any championship tab</li>
            <li>If you&apos;re on the current page, it scrolls to your row and highlights it</li>
            <li>If you&apos;re not visible (e.g., viewing a different region), a <strong>Rank Summary Card</strong> appears showing your position across all 4 scopes</li>
            <li>The summary includes: rank, score, matches played, and projected HOF tier</li>
          </ul>
        </InfoCard>

        <InfoCard title="🧪 Demo Data &amp; Real Standings" accent="text-slate-300">
          <p className="mb-1">Before enough real match data accumulates, the championship page shows <strong>demo data</strong>:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Demo rows have a grey <strong>&quot;DEMO&quot; badge</strong> on each entry</li>
            <li>The header displays &quot;· Showing demo data&quot;</li>
            <li>Once you&apos;ve played real matches, your actual data replaces demo entries</li>
            <li>Demo data is identical in structure to real data — same columns, same sorting</li>
            <li>At least <strong>10 real players</strong> must have championship scores before demo data is fully retired</li>
          </ul>
        </InfoCard>

        <InfoCard title="📜 Past Archives &amp; Championship vs. Lobby Leaderboard" accent="text-amber-300">
          <p className="mb-1"><strong>Archives:</strong> Completed championship years are frozen and accessible via a year selector dropdown. Past years show final standings, HOF inductees, and prize winners — nothing can change.</p>
          <ul className="list-disc pl-4 space-y-0.5 mt-1">
            <li><strong>Year selector</strong> — Dropdown at the top to switch between current and past years</li>
            <li><strong>Frozen badge</strong> — Archived years display a &quot;🔒 FROZEN&quot; indicator</li>
          </ul>
          <p className="mt-1.5"><strong>Championship vs. Lobby Leaderboard:</strong> The lobby leaderboard is <strong>session-based</strong> — it shows real-time chip totals and updates continuously. The championship is <strong>annual-based</strong> — it tracks cumulative performance across the whole year. A player can be #1 on the lobby board but #50 in the championship (or vice versa).</p>
        </InfoCard>
      </div>
    </Section>
  );
}
