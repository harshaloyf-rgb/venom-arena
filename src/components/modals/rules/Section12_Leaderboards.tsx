/* Section 12 — Lobby Leaderboards */
'use client';

import { Crown } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section12_Leaderboards() {
  return (
    <Section icon={<Crown className="w-4 h-4" />} title="12. LOBBY LEADERBOARDS" accent="text-amber-400">
      <div className="flex flex-col gap-2.5">
        <InfoCard title="What is the Lobby Leaderboard?" accent="text-amber-300">
          <p>The lobby houses <strong>5 tabs</strong> of official tournament leaderboards, all <strong>database-backed and live</strong> — they auto-refresh every 30 minutes, or update instantly via the Refresh button. Your rank reflects your lifetime <strong>banked chips</strong> across all matches. Each tab has a description box explaining what it shows.</p>
          <ul className="list-disc pl-4 space-y-0.5 mt-1.5">
            <li><strong>World Cup Summit</strong> — #1 player per country (top 100)</li>
            <li><strong>Global Rankings</strong> — All players worldwide, 1-to-N</li>
            <li><strong>National Rankings</strong> — Players from one country (top 100)</li>
            <li><strong>Regional Rankings</strong> — Players from one of 8 world regions (top 100)</li>
            <li><strong>Milestone Tiers</strong> — Players holding each Milestone Badge (top 100 per tier)</li>
          </ul>
        </InfoCard>

        <InfoCard title="Find Me — Per-Tab Rank Lookup" accent="text-amber-300">
          <p>Each tab has its own <strong>Find Me</strong> button (color-matched to the tab). Click it to see your rank in that specific view:</p>
          <ul className="list-disc pl-4 space-y-0.5 mt-1.5">
            <li><strong>If you&apos;re visible</strong> on the current list: the page auto-scrolls to your &quot;YOU&quot; row and highlights it with a glow.</li>
            <li><strong>If you&apos;re not visible</strong> (e.g., wrong country/region/tier): a <strong>Rank Summary Card</strong> appears showing your Global Rank, National Rank, Regional Rank, chips, level, current milestone badge, clan, and milestone history. Press the <strong>✕</strong> to hide it; switching tabs hides it too, and Find Me brings it back.</li>
          </ul>
        </InfoCard>

        <InfoCard title="⚔️ Tie-Breaking Rules — What Happens When Chips Are Equal?" accent="text-amber-300">
          <p className="mb-1.5">When two or more players have the <strong>exact same banked chips</strong>, the system uses a 3-step tie-break to decide who ranks higher. This is shown as a <strong>visible badge</strong> on the tied player&apos;s row so everyone understands why:</p>
          <ol className="list-decimal pl-4 space-y-0.5 mb-1.5">
            <li><strong>Most banked chips wins</strong> — Primary sort (everyone already knows this).</li>
            <li><strong>Higher level wins</strong> — If chips are tied, the player with the higher level ranks first. The tied player below gets a <span className="text-amber-400 font-bold">⚔ Lower Lv</span> badge.</li>
            <li><strong>Earlier join date wins (Veteran Advantage)</strong> — If both chips AND level are tied, the player who joined the game earlier ranks first. The tied player below gets a <span className="text-slate-300 font-bold">🕐 Joined Later</span> badge.</li>
          </ol>
          <p className="text-slate-500 text-[10px]">Every tab shows &quot;Tie-break: chips → level → join date&quot; as a reminder. Hover over any tie-break badge for the full explanation.</p>
        </InfoCard>

        <InfoCard title="🏆 Summit — World Cup (Top 100 Country Champions)" accent="text-amber-300">
          <p className="mb-1.5">Shows the <strong>#1 ranked player from each country</strong>, sorted by banked chips. Only one champion per nation — like the Olympics.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Columns: Rank, Move, Country Champion (name + tag), Clan Tag, Nation (flag + name), Chips, Status</li>
            <li><strong>Move column:</strong> Shows rank movement (up/down/unchanged) compared to the previous refresh</li>
            <li><strong>HOF badge (🏆):</strong> Players in the Hall of Fame get a gold Award icon next to their name</li>
            <li><strong>Status column:</strong> Championship prize tier (e.g. &quot;👑 World Champion&quot; for #1, &quot;🥈 Elite 10&quot; for #2-10). Shown as a compact pill on desktop — hover it for the full title; the mobile expanded row shows the full text.</li>
            <li>Tie-break applies: if two country champions have equal chips, higher level wins, then earlier join date.</li>
            <li>Shows <strong>top 100</strong> country champions.</li>
          </ul>
        </InfoCard>

        <InfoCard title="🌐 Global Rankings (1-to-N — All Players Worldwide)" accent="text-cyan-300">
          <p className="mb-1.5">The main leaderboard — <strong>all ranked players worldwide</strong>, sorted by banked chips. Fetches the <strong>top 1000</strong> players maximum. This is the only tab that shows beyond the top 100 limit.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Top 3 Podium</strong>: A visual podium (2nd / 1st / 3rd layout) appears above the list when real data is available and 3+ players are ranked.</li>
            <li>Columns: Rank, Move, Player (flag + name + tag), Clan Tag, Milestone Tier Badge, Chips, Status</li>
            <li><strong>Move column:</strong> Shows rank movement (up/down/unchanged) since last refresh</li>
            <li><strong>HOF badge (🏆):</strong> Players in the Hall of Fame get a gold Award icon next to their name</li>
            <li><strong>Status column:</strong> Championship prize tier for top 100 players</li>
            <li>Tie-break badges appear on tied rows (see tie-break rules above).</li>
            <li>Your row is highlighted with a <strong>&quot;YOU&quot; badge</strong> if visible.</li>
          </ul>
        </InfoCard>

        <InfoCard title="📍 National Rankings (Top 100 Per Country)" accent="text-violet-300">
          <p className="mb-1.5">Choose from <strong>197 supported countries</strong> via dropdown. Shows the top 100 players from that country.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Columns: Rank, Move, Challenger (name + tag), Clan Tag, Level, Chips, Status</li>
            <li><strong>Move column:</strong> Shows rank movement (up/down/unchanged) since last refresh</li>
            <li><strong>HOF badge (🏆):</strong> Players in the Hall of Fame get a gold Award icon next to their name</li>
            <li><strong>Status column:</strong> Championship prize tier for top 100 players</li>
            <li>Defaults to your registered country. Switch anytime.</li>
            <li>Tie-break applies: badges appear on tied rows.</li>
          </ul>
        </InfoCard>

        <InfoCard title="🌎 Regional Rankings (Top 100 Per Region)" accent="text-pink-300">
          <p className="mb-1.5">Players grouped by <strong>world region</strong> (8 regions covering all 197 countries). Click a region button to filter:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>🌏 <strong>APAC</strong> — East &amp; Southeast Asia (China, Japan, Korea, Taiwan, Singapore, Thailand, Vietnam, Philippines, Indonesia, Malaysia, and more)</li>
            <li>🇮🇳 <strong>South Asia</strong> — India, Pakistan, Bangladesh, Sri Lanka, Nepal, Bhutan, Maldives, Afghanistan</li>
            <li>🌍 <strong>Middle East &amp; Africa</strong> — All Arab states, Israel, Iran, Turkey &amp; the entire African continent (71 countries)</li>
            <li>🌎 <strong>North America</strong> — United States, Canada, Mexico, Central America &amp; Caribbean</li>
            <li>🌎 <strong>South America</strong> — Brazil, Argentina, Colombia, Chile, Peru, and more</li>
            <li>🌍 <strong>Europe</strong> — UK, Germany, France, Italy, Spain, and 40+ more European nations</li>
            <li>🌏 <strong>CIS &amp; Central Asia</strong> — Russia, Kazakhstan, Uzbekistan, Kyrgyzstan, Tajikistan, Turkmenistan</li>
            <li>🏝️ <strong>Oceania</strong> — Australia, New Zealand, and Pacific islands</li>
          </ul>
          <p className="mt-1">Columns: Rank, Move, Player (name + tag), Clan Tag, Country (flag + name), Chips, Status. <strong>HOF badge (🏆)</strong> appears next to Hall of Fame players&apos; names. <strong>Status column</strong> shows championship prize tier for top 100. Shows top 100 per region.</p>
        </InfoCard>

        <InfoCard title="🏅 Milestone Badge System — What Are These Badges?" accent="text-yellow-300">
          <p className="mb-1.5">Every player is assigned a <strong>Milestone Badge</strong> based on their <strong>lifetime banked chips</strong>. This badge appears beside your name on the Global View leaderboard, in your &quot;Your Rank&quot; summary card, and in the Player Inspector.</p>
          <ul className="list-disc pl-4 space-y-0.5 mb-2">
            <li>Badges <strong>automatically upgrade</strong> when your banked chips cross a threshold — no action needed.</li>
            <li>Badges <strong>can downgrade</strong> if your banked chips fall below a tier&apos;s requirement (e.g., by buying into arenas and dying without extracting).</li>
            <li>Your tier is always calculated from your <strong>current banked chip balance</strong> in real-time.</li>
            <li>Only <strong>extracted chips</strong> count — carried chips lost in-arena do NOT contribute.</li>
          </ul>
          <div className="overflow-x-auto mt-1">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-1 pr-2">Badge</th>
                  <th className="text-left py-1 pr-2">Tier Name</th>
                  <th className="text-left py-1 pr-2">Min. Banked Chips</th>
                  <th className="text-left py-1">Description</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#64748b' }}>🛡️ Rookie</td>
                  <td className="py-1 pr-2" style={{ color: '#64748b' }}>Rookie</td>
                  <td className="py-1 pr-2 text-slate-400">0 — 99,999</td>
                  <td className="py-1 text-slate-400">Starting tier for all new players. Just getting started!</td>
                </tr>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#b45309' }}>🥉 Bronze</td>
                  <td className="py-1 pr-2" style={{ color: '#b45309' }}>Bronze Elite</td>
                  <td className="py-1 pr-2 text-slate-400">100K+ (1 Lakh)</td>
                  <td className="py-1 text-slate-400">First milestone. Proven arena survival skills.</td>
                </tr>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#cbd5e1' }}>🥈 Silver</td>
                  <td className="py-1 pr-2" style={{ color: '#cbd5e1' }}>Silver Commander</td>
                  <td className="py-1 pr-2 text-slate-400">500K+ (5 Lakhs)</td>
                  <td className="py-1 text-slate-400">Consistent extractor with strategic awareness.</td>
                </tr>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#f59e0b' }}>🥇 Gold</td>
                  <td className="py-1 pr-2" style={{ color: '#f59e0b' }}>Gold Apex Vanguard</td>
                  <td className="py-1 pr-2 text-slate-400">1M+ (10 Lakhs)</td>
                  <td className="py-1 text-slate-400">Elite player — top-tier extraction machine.</td>
                </tr>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#22d3ee' }}>💎 Platinum</td>
                  <td className="py-1 pr-2" style={{ color: '#22d3ee' }}>Platinum Sovereign</td>
                  <td className="py-1 pr-2 text-slate-400">2.5M+ (25 Lakhs)</td>
                  <td className="py-1 text-slate-400">Arena dominator — feared by rivals.</td>
                </tr>
                <tr className="border-b border-slate-900">
                  <td className="py-1 pr-2 font-bold" style={{ color: '#06b6d4' }}>🔮 Diamond</td>
                  <td className="py-1 pr-2" style={{ color: '#06b6d4' }}>Diamond Warlord</td>
                  <td className="py-1 pr-2 text-slate-400">5M+ (50 Lakhs)</td>
                  <td className="py-1 text-slate-400">Legendary status — a true warlord of the arena.</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2 font-bold" style={{ color: '#fbbf24' }}>👑 Omega</td>
                  <td className="py-1 pr-2" style={{ color: '#fbbf24' }}>Omega Legend</td>
                  <td className="py-1 pr-2 text-slate-400">10M+ (1 Crore)</td>
                  <td className="py-1 text-slate-400">The pinnacle. Ultimate venom arena champion.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </InfoCard>

        <InfoCard title="🏅 Milestone Tier Ranks — Filter by Achievement Level" accent="text-yellow-300">
          <p>Filter by milestone tier using the badge buttons. Each board lists players whose <strong>current badge</strong> is that tier — badges are exclusive (a player holds exactly one), so boards never overlap:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>⭐ <strong>All Tiers</strong> — Every ranked player (top 100)</li>
            <li>🛡️ <strong>Rookie</strong> — Badge holders below 100K banked chips</li>
            <li>🥉 <strong>Bronze Elite</strong> — Badge holders from 100K up to 500K</li>
            <li>🥈 <strong>Silver Commander</strong> — Badge holders from 500K up to 1M</li>
            <li>🥇 <strong>Gold Apex Vanguard</strong> — Badge holders from 1M up to 2.5M</li>
            <li>💎 <strong>Platinum Sovereign</strong> — Badge holders from 2.5M up to 5M</li>
            <li>🔮 <strong>Diamond Warlord</strong> — Badge holders from 5M up to 10M</li>
            <li>👑 <strong>Omega Legend</strong> — Badge holders at 10M and beyond</li>
          </ul>
          <p className="mt-1">Columns: Rank, Move, Player (name + tag), Clan Tag, Country (flag + name), Chips. <strong>No Status column</strong> on this tab. <strong>HOF badge (🏆)</strong> appears next to Hall of Fame players&apos; names. The #1 player in each non-Rookie tier board gets a &quot;👑 FIRST&quot; badge. Shows top 100 per tier.</p>
        </InfoCard>

        <InfoCard title="📊 Milestone History — Your Achievement Timeline" accent="text-amber-300">
          <p className="mb-1.5">The <strong>Find Me</strong> rank summary card shows your personal milestone journey:</p>
          <ul className="list-disc pl-4 space-y-0.5 mb-1.5">
            <li><strong>Timeline entries</strong> — Each achieved milestone shows: badge icon, tier name, the chips you had when you reached it, and the <strong>exact date + time (UTC)</strong> you achieved it.</li>
            <li>Only tiers you have actually reached are listed — the card stays clean while you&apos;re still climbing.</li>
          </ul>
          <p>Milestones are recorded automatically the moment your banked chips cross a tier threshold.</p>
        </InfoCard>

        <InfoCard title="🏆 Championship Prize Badges on Rows" accent="text-yellow-300">
          <p>On Summit, Global, National, and Regional tabs, players in the top 100 earn a <strong>Championship Prize badge</strong> in the Status column based on their rank:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Rank #1</strong> — &quot;👑 World Champion&quot; (gold)</li>
            <li><strong>Rank #2-10</strong> — &quot;🥈 Elite 10&quot; (silver)</li>
            <li><strong>Rank #11-50</strong> — &quot;🥉 Masters 50&quot; (bronze)</li>
            <li><strong>Rank #51-100</strong> — &quot;🛡️ Qualifier 100&quot; (slate)</li>
          </ul>
          <p className="mt-1">These badges <strong>mirror the Annual Championship prize tiers</strong> (see Section 13) so you can see at a glance which prize bracket a rank falls in. The championship itself is open to <strong>everyone</strong> — registration is free and never automatic — and the real prizes (5M / 2.5M / 1M / 250K chips) go to the top 100 of the <strong>registered</strong> championship standings at the Jan 1 close, not to these lobby-board badges. The <strong>Tiers tab does not show</strong> Status badges.</p>
        </InfoCard>

        <InfoCard title="🔍 Search &amp; Player Inspector" accent="text-indigo-300">
          <p><strong>Search:</strong> A search box at the top lets you filter the visible list in real-time. Type a player name, VM tag (VM-XXXXXX), or clan tag to find specific players.</p>
          <p className="mt-1.5"><strong>Player Inspector:</strong> On desktop, click any row to open the full profile inspector — name, country, chips, level, clan, milestone badge, and their rank in the view you clicked from (global, national, or regional chip). On mobile, tap a row to expand a quick detail strip (country, clan, level, prize tier); tap again to collapse.</p>
        </InfoCard>

        <InfoCard title="Empty Boards" accent="text-slate-300">
          <p>If no real players qualify for a view yet (e.g., no players from a specific country, or no one has reached a tier), the tab simply shows an <strong>empty state</strong> — no fake filler rows. The moment real players qualify, they appear here automatically.</p>
        </InfoCard>

        <InfoCard title="Auto-Refresh" accent="text-emerald-300">
          <p>Leaderboards auto-refresh every 30 minutes. Click the <strong>Refresh</strong> button to fetch the latest data immediately. &quot;Last sync&quot; timestamp shows when data was last fetched.</p>
        </InfoCard>

        <InfoCard title="📺 Live Ticker Bar" accent="text-rose-300">
          <p>Just under the Leaderboard header, a small <strong>Live Ticker</strong> bar shows <strong>real platform activity</strong> — live aggregate stats straight from the server, refreshed every 30 seconds: matches played today, extractions, chips banked, eliminations, and total registered agents.</p>
          <ul className="list-disc pl-4 space-y-0.5 mt-1.5">
            <li>Messages come from the live stats endpoint — they reflect <strong>actual platform activity</strong>, not fabricated hype</li>
            <li>Only visible when real activity data exists (hidden on a fresh/empty server)</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
