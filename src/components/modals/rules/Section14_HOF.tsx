/* Section 14 — Hall of Fame */
'use client';

import { Award } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section14_HOF() {
  return (
    <Section icon={<Award className="w-4 h-4" />} title="14. HALL OF FAME" accent="text-yellow-400">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <InfoCard title="🏆 What is the Hall of Fame?" accent="text-yellow-300">
          <p className="mb-1">The <strong>Hall of Fame (HOF)</strong> is Venom Arena&apos;s <strong>permanent shrine</strong> celebrating legendary players. Every inductee&apos;s record is stored in the database and can <strong>never be removed</strong> — it is truly immortal.</p>
          <p>There are <strong>two induction paths</strong>:</p>
          <ul className="list-disc pl-4 space-y-0.5 mt-1">
            <li><strong>Milestone Induction:</strong> Reach lifetime banked chip thresholds (1 Lakh to 1 Crore)</li>
            <li><strong>Championship Induction:</strong> Finish in the top 100 of any Annual Championship</li>
          </ul>
        </InfoCard>

        <InfoCard title="⭐ Milestone Induction Path" accent="text-amber-300">
          <p className="mb-1.5">When your <strong>total banked chips</strong> cross a milestone threshold for the <strong>first time</strong>, you&apos;re automatically inducted into the HOF:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] mt-1">
              <thead>
                <tr className="text-left border-b border-slate-700">
                  <th className="py-1 pr-2 text-slate-300">Threshold</th>
                  <th className="py-1 pr-2 text-slate-300">Badge</th>
                  <th className="py-1 text-slate-300">Details</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-900"><td className="py-1 pr-2 font-mono text-amber-400">1,00,000c</td><td className="py-1 pr-2">🥉 Bronze Elite</td><td className="py-1 text-slate-400">First step to immortality</td></tr>
                <tr className="border-b border-slate-900"><td className="py-1 pr-2 font-mono text-slate-300">5,00,000c</td><td className="py-1 pr-2">🥈 Silver Commander</td><td className="py-1 text-slate-400">Half a million club</td></tr>
                <tr className="border-b border-slate-900"><td className="py-1 pr-2 font-mono text-yellow-400">10,00,000c</td><td className="py-1 pr-2">🥇 Gold Apex Vanguard</td><td className="py-1 text-slate-400">Millionaire status</td></tr>
                <tr className="border-b border-slate-900"><td className="py-1 pr-2 font-mono text-cyan-400">25,00,000c</td><td className="py-1 pr-2">💎 Platinum Sovereign</td><td className="py-1 text-slate-400">Elite tier</td></tr>
                <tr className="border-b border-slate-900"><td className="py-1 pr-2 font-mono text-violet-400">50,00,000c</td><td className="py-1 pr-2">🔮 Diamond Warlord</td><td className="py-1 text-slate-400">Top 0.1% of players</td></tr>
                <tr><td className="py-1 pr-2 font-mono text-yellow-300">1,00,00,000c</td><td className="py-1 pr-2">👑 Omega Immortal God</td><td className="py-1 text-slate-400">Legendary — 1 Crore+</td></tr>
              </tbody>
            </table>
          </div>
        </InfoCard>

        <InfoCard title="🏆 Championship Induction Path" accent="text-yellow-300">
          <p className="mb-1">When an Annual Championship season closes (<strong>Jan 1st</strong>), the <strong>top 100 finishers</strong> are automatically inducted with rank-based badges and titles:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>#1 (Crown):</strong> 👑 Crown badge + &quot;RANK 1: GRAND CHAMPION&quot; title</li>
            <li><strong>#2-10 (Silver):</strong> 🥈 Silver badge + &quot;TOP 10 LEGENDS&quot; title</li>
            <li><strong>#11-50 (Bronze):</strong> 🥉 Bronze badge + &quot;ELITE MASTERS&quot; title</li>
            <li><strong>#51-100 (Contender):</strong> 🛡️ Contender badge + &quot;CHAMPIONSHIP CONTENDERS&quot; title</li>
          </ul>
          <p className="mt-1">Each championship year creates a <strong>separate induction record</strong> — a player can be inducted multiple times across different years. See Section 13 for the prize payouts that come with induction.</p>
        </InfoCard>

        <InfoCard title="🛡️ HOF Permanence Rules" accent="text-emerald-300">
          <p className="mb-1">HOF records are <strong>immutable</strong>:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Milestone inductions are based on the <strong>first time</strong> you reach a tier — even if your chips later drop below, the HOF entry stays</li>
            <li>Championship inductions are <strong>finalized on Jan 1st</strong> and locked permanently</li>
            <li>There is no appeal, removal, or expiration of HOF records</li>
            <li>HOF status is visible everywhere — a small 🏆 icon on <strong>leaderboard rows</strong>, your highest badge in the <strong>player inspector</strong></li>
          </ul>
        </InfoCard>

        <InfoCard title="👤 Checking Your HOF Status" accent="text-cyan-300">
          <p className="mb-1">View your HOF profile in several places:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Hall of Fame tab</strong> — Full profile with all inductions, next milestone goal, and live stats</li>
            <li><strong>Player Inspector</strong> — HOF badge shown at the top of the overview tab</li>
            <li><strong>Leaderboard rows</strong> — Small HOF icon (🏆) next to your name if inducted</li>
            <li><strong>Championship podium</strong> — HOF badge visible on top-3 contenders</li>
          </ul>
        </InfoCard>

        <InfoCard title="🏛️ Browsing the Wings" accent="text-amber-300">
          <p className="mb-1">The Hall of Fame tab has <strong>three sub-tabs</strong>:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>My HOF Profile</strong> — your total inductions, current banked chips, your next milestone target, and every induction you hold</li>
            <li><strong>Champions Wing</strong> — browse championship inductees by year (year chips, current year marked), search by name, VM-tag, or clan, and click any row to open the player inspector. Each year reads in podium order (#1 first)</li>
            <li><strong>Milestones Wing</strong> — every milestone inductee listed in <strong>induction order</strong> (earliest achievers first — #1 in a tier filter is the first player ever to reach that tier), with tier filter chips showing per-tier counts, search, a <strong>First!</strong> pill on each tier&apos;s first achiever, and a <strong>Find Me</strong> button that scrolls to your row</li>
          </ul>
        </InfoCard>

        <InfoCard title="📊 HOF Statistics" accent="text-violet-300">
          <p className="mb-1">The HOF tab shows aggregate stats for the entire server:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Total Inducted Players:</strong> Count of unique players with at least one HOF entry</li>
            <li><strong>Total Entries:</strong> Sum of all inductions (one player can have multiple)</li>
            <li><strong>Milestone / Championship Inductees:</strong> Unique players on each induction path</li>
            <li><strong>Per-Tier Counts:</strong> How many inductees hold each milestone tier — shown in brackets on the tier filter chips in the Milestones Wing</li>
            <li><strong>First Achievers:</strong> The very first player to reach each milestone tier is marked with a &quot;First!&quot; pill in the Milestones Wing</li>
            <li><strong>Championship Years:</strong> Which years have inductees — shown as year filter chips in the Champions Wing</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
