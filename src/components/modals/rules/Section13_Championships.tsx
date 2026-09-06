/* Section 13 — Annual Championships */
'use client';

import { Trophy } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section13_Championships() {
  return (
    <Section icon={<Trophy className="w-4 h-4" />} title="13. ANNUAL CHAMPIONSHIPS" accent="text-amber-400">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <InfoCard title="🏆 What is the Annual Championship?" accent="text-amber-300">
          <p className="mb-1">The <strong>Annual Championship</strong> is a year-long competitive event. Unlike the lobby leaderboard (which ranks lifetime <strong>banked chips</strong> and refreshes every 30 minutes — see Section 12), championship standings persist across the entire calendar year and culminate in the <strong>Jan 1st season close</strong>.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Runs from <strong>Jan 1 to Dec 31</strong> each year</li>
            <li><strong>What counts:</strong> your <strong>banked wallet chips</strong> at year-end decide the final ranking — &quot;Max chips at year-end decides rank!&quot;</li>
            <li>Top finishers earn prizes and Hall of Fame induction</li>
            <li>Results are archived and viewable in perpetuity</li>
          </ul>
        </InfoCard>

        <InfoCard title="📋 DB-Backed Registration" accent="text-cyan-300">
          <p className="mb-1">Championship registration is handled entirely through the database — one click, free entry:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Free registration:</strong> Click <strong>Register</strong> on the Championships tab — everyone can enter (guests and registered players alike)</li>
            <li><strong>Not automatic:</strong> Until you register, your online matches do NOT count toward the standings — registering takes 2 seconds, do it early!</li>
            <li><strong>Persistent:</strong> Your registration status, match count, and standings are stored server-side in the database</li>
            <li><strong>One account per player:</strong> Your VM-XXXXXX tag is your single championship identity</li>
          </ul>
        </InfoCard>

        <InfoCard title="💰 Jan 1st Payout &amp; Hall of Fame Tiers" accent="text-yellow-300">
          <p className="mb-1.5">After <strong>January 1st</strong> of each year, final standings are locked and the leaderboard winners are finalized, inducted into the Hall of Fame and their prizes awarded:</p>
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
                  <td className="py-1 pr-2 text-slate-400">2,500,000c each</td>
                  <td className="py-1 text-slate-400">Silver HOF badge + title</td>
                </tr>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#cd7f32' }}>#11–50</td>
                  <td className="py-1 pr-2" style={{ color: '#cd7f32' }}>🥉 Masters 50</td>
                  <td className="py-1 pr-2 text-slate-400">1,000,000c each</td>
                  <td className="py-1 text-slate-400">Bronze HOF badge</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2 font-bold" style={{ color: '#64748b' }}>#51–100</td>
                  <td className="py-1 pr-2" style={{ color: '#64748b' }}>🛡️ Qualifier 100</td>
                  <td className="py-1 pr-2 text-slate-400">250,000c each</td>
                  <td className="py-1 text-slate-400">Qualifier badge + next-year priority</td>
                </tr>
              </tbody>
            </table>
          </div>
        </InfoCard>

        <InfoCard title="📊 My Championship Summary" accent="text-emerald-300">
          <p className="mb-1">A personal dashboard card shows your championship progress at a glance:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Projected Rank:</strong> Your live position — top 100 = <strong>HOF Eligible</strong></li>
            <li><strong>Projected Prize:</strong> The prize tier your current rank would earn</li>
            <li><strong>Avg Chips / Game:</strong> Your efficiency (banked chips ÷ games played)</li>
            <li><strong>▲ Player Ahead / ▼ Player Behind:</strong> The exact chip gap to the players around you in the standings</li>
            <li><strong>Matches Limit Progress:</strong> X / 10,000 games played, with escalating warnings as you approach the cap</li>
            <li><strong>Competing Wallet Chips:</strong> The balance that decides your final rank — max chips at year-end wins!</li>
          </ul>
        </InfoCard>

        <InfoCard title="⚠️ Match Cap Warnings (9K / 9.5K / 9.9K)" accent="text-red-400">
          <p className="mb-1">To encourage fair play and prevent grinding exploits, the championship has <strong>annual match caps</strong> with escalating warnings:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>9,000 matches:</strong> Yellow warning — approaching the annual 10,000-match cap</li>
            <li><strong>9,500 matches:</strong> Orange warning — near the annual cap</li>
            <li><strong>9,900 matches:</strong> Red warning — final 100 matches before the annual cap locks your registration</li>
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
          <p className="mt-1">Clan rankings use the <strong>sum of all clan members&apos; scores</strong>. A &quot;Clan Members&quot; count shows active participants.</p>
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

        <InfoCard title="📜 Past Archives &amp; Championship vs. Lobby Leaderboard" accent="text-amber-300">
          <p className="mb-1"><strong>Archives:</strong> Completed championship years are frozen and accessible via a year selector dropdown. Past years show final standings, HOF inductees, and prize winners — nothing can change.</p>
          <ul className="list-disc pl-4 space-y-0.5 mt-1">
            <li><strong>Year selector</strong> — Dropdown at the top to switch between current and past years</li>
            <li><strong>Frozen badge</strong> — Archived years display a &quot;🔒 FROZEN&quot; indicator</li>
          </ul>
          <p className="mt-1.5"><strong>Championship vs. Lobby Leaderboard:</strong> The lobby leaderboard is <strong>database-backed</strong> — it ranks lifetime <strong>banked chips</strong> and refreshes every 30 minutes (or instantly via the Refresh button — see Section 12). The championship is <strong>annual-based</strong> — it tracks cumulative performance across the whole year. A player can be #1 on the lobby board but #50 in the championship (or vice versa).</p>
        </InfoCard>
      </div>
    </Section>
  );
}
