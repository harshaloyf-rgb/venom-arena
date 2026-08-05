/* Section 15 — Syndicates (Clan System) */
'use client';

import { Shield } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section15_Syndicates() {
  return (
    <Section icon={<Shield className="w-4 h-4" />} title="15. SYNDICATES (CLAN SYSTEM)" accent="text-amber-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <InfoCard title="🛡️ What Are Syndicates?" accent="text-amber-300">
          <p className="mb-1.5">Syndicates (clans) are player-formed teams. Team up with allies, pool chips into a shared Treasury, complete weekly challenges together, and climb the clan level system.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Create your own syndicate or browse and join existing ones</li>
            <li>Each syndicate has a unique <strong>3-5 character tag</strong> (uppercase letters/numbers, e.g. VNM, APEX)</li>
            <li>Clan level unlocks powerful perks for all members</li>
          </ul>
        </InfoCard>
        <InfoCard title="⚔️ Clan Roles" accent="text-amber-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong className="text-amber-300">Leader</strong> — Full control: promote, demote, kick, edit settings, disband, claim challenges</li>
            <li><strong className="text-purple-300">Co-Leader</strong> — Can kick Vipers, claim challenges. Max 2 per clan</li>
            <li><strong className="text-indigo-300">Viper</strong> — Standard member. Can deposit, chat, leave freely</li>
          </ul>
        </InfoCard>
        <InfoCard title="💰 Clan Treasury" accent="text-emerald-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Members deposit chips from their personal bank into the Treasury</li>
            <li>Quick-deposit buttons: 10%, 25%, 50%, or MAX of your chips</li>
            <li>Max 1,000,000c per transaction</li>
            <li><strong className="text-rose-300">Withdraw</strong> — You can withdraw chips you deposited (up to what you put in). Enter amount and click Withdraw. Leaving the clan forfeits unwithdrawn deposits.</li>
            <li><strong className="text-amber-300">Payout</strong> — Leader/Co-Leader can distribute chips from the treasury to any member. Uses the same input field as deposit/withdraw.</li>
            <li>Treasury grows via deposits and challenge reward claims</li>
            <li>Deposits also grant <strong>5% XP</strong> to your clan</li>
            <li>Treasury chips are spent in the <strong>Clan Shop</strong> and <strong>Clan Wars</strong> (see below)</li>
          </ul>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        <InfoCard title="⭐ Clan XP &amp; Leveling" accent="text-emerald-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Clans start at <strong>Level 1</strong> (0 XP)</li>
            <li>Level-up requires <strong>Level × 1,000 XP</strong> (e.g. Lv2 = 2,000 XP)</li>
            <li>XP sources: deposits (5%), challenge claims (10% of reward)</li>
            <li>Level-ups are logged in the Activity Log</li>
          </ul>
        </InfoCard>
        <InfoCard title="🏆 Weekly Challenges" accent="text-amber-300">
          <p className="mb-1.5">Four challenges reset every <strong>Monday UTC</strong>. Scaled by clan level:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Treasury Target</strong> — Deposit a total of X chips (scales: Level × 2,000 target, Level × 1,000 reward)</li>
            <li><strong>Recruitment Drive</strong> — Recruit X new members (scales: min(Level, 5) target)</li>
            <li><strong>Syndicate Comms</strong> — Send X chat messages (scales: Level × 5 + 15 target)</li>
            <li><strong>Deposit Streak</strong> — Make X total deposits as a clan (any member, any amount; scales: Level × 2 + 8 target, Level × 500 + 2,000 reward)</li>
            <li>Leader/Co-Leader can <strong>Claim</strong> completed challenges — rewards go to the <strong>Clan Treasury</strong> as chips + 10% XP bonus</li>
          </ul>
        </InfoCard>
        <InfoCard title="📊 Clan Management" accent="text-cyan-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Settings</strong> — Leader can edit name, description, emblem</li>
            <li><strong>Transfer Leadership</strong> — Pass leadership to a Co-Leader</li>
            <li><strong>Disband</strong> — Permanently dissolve the syndicate (Leader only)</li>
            <li><strong>Activity Log</strong> — Full history of joins, leaves, deposits, withdrawals, payouts, promotions, kicks, challenges, level-ups, shop purchases</li>
            <li><strong>Stats</strong> — Aggregate combat stats across all members</li>
          </ul>
        </InfoCard>
        <InfoCard title="🛒 Clan Shop" accent="text-violet-300">
          <p className="mb-1.5">The <strong>Leader</strong> can spend treasury chips on permanent perks. Visible on the Overview tab:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Member Expansion</strong> (15,000c) — +5 max member slots. Repeatable. Default is 30 members.</li>
            <li><strong>XP Windfall</strong> (8,000c) — Instantly grants Level × 500 XP. Repeatable.</li>
            <li><strong>War Shield</strong> (5,000c) — 7-day peace mode. No other clan can declare war on you while active. One-time purchase.</li>
          </ul>
        </InfoCard>
        <InfoCard title="⚔️ Clan Wars — How It Works" accent="text-rose-300">
          <p className="mb-1.5"><strong>No separate clan arenas needed.</strong> Members play <strong>normal matches</strong> as usual — their kills automatically count toward the war score.</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li><strong>Declare:</strong> Leader picks a target clan, enters a wager (min 1,000c). Both clans&apos; treasuries are <strong>deducted immediately</strong> (escrow). Total pot = wager × 2.</li>
            <li><strong>Fight:</strong> ALL members of BOTH clans play their <strong>normal matches</strong>. Every kill by any member automatically adds to their clan&apos;s war score. No special mode or lobby needed.</li>
            <li><strong>Score:</strong> War tab shows live score bars (e.g. KILL: 32/50 vs APEX: 28/50). Scores update after each member finishes a match.</li>
            <li><strong>Win:</strong> First clan to reach <strong>50 kills</strong> wins the <strong>entire pot</strong>. War ends automatically — chips are added to the winner&apos;s treasury.</li>
          </ol>
          <p className="mt-1.5 text-[10px] text-slate-500"><strong>Rules:</strong> One active war per clan. Can&apos;t declare on a clan that already has a war. Can&apos;t declare on a clan with an active War Shield. Both clans must have enough treasury for the wager.</p>
        </InfoCard>
      </div>

      <div className="mt-3">
        <InfoCard title="🗺️ Perks Roadmap" accent="text-amber-300">
          <p className="mb-1.5">Your syndicate earns XP via deposits and challenge claims. Leveling up is a badge of honor shown on the Perks Roadmap in your clan panel:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
              <div className="text-[10px] font-mono text-amber-400 font-bold">LVL 1</div>
              <div className="text-[10px] text-slate-400">Base — Up to 30 members</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
              <div className="text-[10px] font-mono text-slate-400 font-bold">LVL 2</div>
              <div className="text-[10px] text-slate-500">Extended Roster</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
              <div className="text-[10px] font-mono text-slate-400 font-bold">LVL 3</div>
              <div className="text-[10px] text-slate-500">Quick Deposit</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
              <div className="text-[10px] font-mono text-slate-400 font-bold">LVL 5</div>
              <div className="text-[10px] text-slate-500">Elite Status</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
              <div className="text-[10px] font-mono text-slate-400 font-bold">LVL 10</div>
              <div className="text-[10px] text-slate-500">Legendary Syndicate</div>
            </div>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">Syndicates start with 30 member slots. The Leader can buy Member Expansion from the Clan Shop to add +5 slots per purchase. XP requirements increase per level (Level × 1,000 XP). Higher levels = harder challenges with bigger rewards.</p>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <InfoCard title="💬 Syndicate Chat" accent="text-emerald-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Real-time chat feed for all clan members (shows <strong>last 50 messages</strong>)</li>
            <li><strong>2-second cooldown</strong> between messages to prevent spam</li>
            <li>Max <strong>300 characters</strong> per message</li>
            <li>Chat messages count toward the <strong>Syndicate Comms</strong> weekly challenge</li>
            <li>Each message shows sender name, rank badge, and timestamp</li>
          </ul>
        </InfoCard>
        <InfoCard title="🔍 Top Members &amp; Roster" accent="text-amber-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Overview shows the <strong>top 3 richest members</strong> by personal chip balance</li>
            <li>Members have <strong>online/offline status</strong> indicators (green/gray dot)</li>
            <li>Full member roster with rank badges, levels, chips, and management actions</li>
            <li>Clan display shows <strong>dynamic max members</strong> (starts at 30, can be increased via Clan Shop)</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
