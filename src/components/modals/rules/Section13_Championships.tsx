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

        <InfoCard title="📋 Tracked Server-Side" accent="text-cyan-300">
          <p className="mb-1">Championship registration is handled entirely through the database — one click, free entry:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Free registration:</strong> Click <strong>Register</strong> on the Championships tab — everyone can enter (guests and registered players alike)</li>
            <li><strong>Not automatic:</strong> Until you register, your online matches do NOT count toward the standings — registering takes 2 seconds, do it early!</li>
            <li><strong>Persistent:</strong> Your registration status, match count, and standings are stored server-side in the database</li>
            <li><strong>One account per player:</strong> Your VM-XXXXXX tag is your single championship identity</li>
            <li><strong>Fair play:</strong> Banned accounts cannot register, and banned players are excluded from the standings</li>
          </ul>
        </InfoCard>

        <InfoCard title="💰 Jan 1st Payout &amp; Hall of Fame Tiers" accent="text-yellow-300">
          <p className="mb-1.5">After <strong>January 1st</strong> of each year, final standings are locked and the top 100 registered players are paid their prizes and inducted into the Hall of Fame:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] mt-1">
              <thead>
                <tr className="text-left border-b border-slate-700">
                  <th className="py-1 pr-2 text-slate-300">Rank</th>
                  <th className="py-1 pr-2 text-slate-300">Prize Tier</th>
                  <th className="py-1 pr-2 text-slate-300">Prize</th>
                  <th className="py-1 text-slate-300">Also Includes</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#fbbf24' }}>#1</td>
                  <td className="py-1 pr-2" style={{ color: '#fbbf24' }}>👑 Global 1st Place</td>
                  <td className="py-1 pr-2 text-slate-400">5,000,000c</td>
                  <td className="py-1 text-slate-400">Crown title, exclusive champion rewards + HOF inscription</td>
                </tr>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#a1a1aa' }}>#2–10</td>
                  <td className="py-1 pr-2" style={{ color: '#a1a1aa' }}>🥈 Global Top 10</td>
                  <td className="py-1 pr-2 text-slate-400">2,500,000c each</td>
                  <td className="py-1 text-slate-400">Crown title, exclusive rewards + HOF inscription</td>
                </tr>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#cd7f32' }}>#11–50</td>
                  <td className="py-1 pr-2" style={{ color: '#cd7f32' }}>🥉 Global Ranks 11–50</td>
                  <td className="py-1 pr-2 text-slate-400">1,000,000c each</td>
                  <td className="py-1 text-slate-400">Crown title, exclusive rewards + HOF inscription</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2 font-bold" style={{ color: '#64748b' }}>#51–100</td>
                  <td className="py-1 pr-2" style={{ color: '#64748b' }}>🛡️ Global Ranks 51–100</td>
                  <td className="py-1 pr-2 text-slate-400">250,000c each</td>
                  <td className="py-1 text-slate-400">Crown title, exclusive rewards + HOF inscription</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-slate-500 text-[10px]">Every top-100 finisher gets a permanent Hall of Fame inscription and the crown title shown on the prize cards. Prizes are paid once, based on the <strong>global</strong> ranking (see scopes below).</p>
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
          <p className="mb-1">The championship tracks your ranked matches against an <strong>annual 10,000-match cap</strong>, with escalating warnings as you approach it:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>9,000 matches:</strong> Yellow warning — approaching the annual cap</li>
            <li><strong>9,500 matches:</strong> Orange warning — near the annual cap</li>
            <li><strong>9,900 matches:</strong> Red warning — final 100 matches before the counter fills</li>
            <li><strong>10,000 matches:</strong> Hard cap — the server stops counting further matches toward your championship tally</li>
          </ul>
          <p className="mt-1 text-amber-400/80">Your final RANK is always decided by your banked chips at year-end. The cap keeps the event about quality over quantity — make each match count!</p>
        </InfoCard>

        <InfoCard title="🌍 Standings Scopes &amp; Clan Rankings" accent="text-indigo-300">
          <p className="mb-1">Championship standings support <strong>4 scope tabs</strong>. Everyone is ranked on the same <strong>global ladder by banked chips</strong> — the Rank column always shows your <strong>global rank</strong>; the Regional and National tabs simply filter which players are listed:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>GLOBAL</strong> — All registered players worldwide, ranked by banked chips, with a top-3 podium when 3+ contenders are registered</li>
            <li><strong>REGIONAL</strong> — Registered players in one world region (8 regions — same grouping as the lobby leaderboard)</li>
            <li><strong>NATIONAL</strong> — Registered players from one country (dropdown with all 197 supported countries)</li>
            <li><strong>CLAN</strong> — Clan leaderboard: sums the <strong>banked chips of all registered clan members</strong> into a clan total and ranks clans. Shows each clan&apos;s member count, average chips per member, and top member</li>
          </ul>
          <p className="mt-1">Rank filters (#1, 2–10, 11–50, 51–100) slice the list by global prize bracket. Ties are broken by higher level, then earlier join date.</p>
          <p className="mt-1"><strong>View any contender&apos;s profile:</strong> on desktop, click a standings row or a podium card to open that player&apos;s profile; on mobile, expand a row and tap <strong>Profile</strong>. In the CLAN view, each clan&apos;s top member has a <strong>Profile</strong> button too. From the profile you can add friends, follow, or set rivals without leaving the championship.</p>
        </InfoCard>

        <InfoCard title="🔍 Find Me in Championship" accent="text-violet-300">
          <p className="mb-1">The <strong>Find Me</strong> button works on the Global, Regional, and National tabs:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>If your row is in the current list, the page <strong>scrolls to you</strong> and highlights it</li>
            <li>If you&apos;re not visible (e.g., you&apos;re outside the top 100, or filtered out), a <strong>summary card</strong> appears showing your <strong>global rank</strong>, banked chips, projected prize, and games played — this works even when you&apos;re ranked beyond the visible top 100</li>
            <li>The standings list shows the <strong>top 100</strong> by global rank; your summary card always reflects your true global position</li>
          </ul>
        </InfoCard>

        <InfoCard title="📜 Past Archives &amp; Championship vs. Lobby Leaderboard" accent="text-amber-300">
          <p className="mb-1"><strong>Archives:</strong> Once the first championship year completes, a collapsible <strong>Past Championship Archives</strong> section appears on the Championships tab. Each archived year shows its winner (name, country, winning chips), top clan, total participants, payout status, and the finalization date — frozen forever.</p>
          <ul className="list-disc pl-4 space-y-0.5 mt-1">
            <li><strong>Payouts Complete</strong> — confirms the year&apos;s prizes were paid and inductions locked</li>
            <li>The section stays hidden until the first year is archived (nothing to show before that)</li>
          </ul>
          <p className="mt-1.5"><strong>Championship vs. Lobby Leaderboard:</strong> The lobby leaderboard is <strong>database-backed</strong> — it ranks lifetime <strong>banked chips</strong> and refreshes every 30 minutes (or instantly via the Refresh button — see Section 12). The championship is <strong>annual-based</strong> — only <strong>registered</strong> players count, and the final ranking is taken at the Jan 1 close. A player can be #1 on the lobby board but #50 in the championship (or vice versa).</p>
        </InfoCard>
      </div>
    </Section>
  );
}
