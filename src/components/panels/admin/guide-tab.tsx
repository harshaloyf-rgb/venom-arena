'use client';

import { useState, type ReactNode } from 'react';
import {
  Shield,
  Users,
  Film,
  Coins,
  ShieldAlert,
  Crown,
  Settings,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Lock,
  Server,
  Eye,
  Ban,
  Gift,
  Zap,
  Target,
  Trophy,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface GuideSection {
  id: string;
  icon: ReactNode;
  title: string;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  content: ReactNode;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  iconColor,
  iconBg,
  open,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  iconColor: string;
  iconBg: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-slate-800/60 transition-colors duration-150 group cursor-pointer"
    >
      <span
        className={`flex items-center justify-center h-9 w-9 rounded-lg ${iconBg} flex-shrink-0`}
      >
        <span className={iconColor}>{icon}</span>
      </span>
      <span className="flex-1 text-left text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
        {title}
      </span>
      {open ? (
        <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
      )}
    </button>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mt-5 mb-2 first:mt-0">
      {children}
    </h4>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
      <span className="text-slate-600 mt-1.5 flex-shrink-0">
        <span className="inline-block h-1 w-1 rounded-full bg-slate-600" />
      </span>
      <span>{children}</span>
    </li>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-2.5">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-300/80 leading-relaxed">{children}</p>
    </div>
  );
}

function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-2.5">
      <Shield className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-emerald-300/80 leading-relaxed">{children}</p>
    </div>
  );
}

function EndpointTable({
  rows,
}: {
  rows: { method: string; path: string; desc: string }[];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800/80">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-800/80 bg-slate-900/80">
            <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Method
            </th>
            <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Endpoint
            </th>
            <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-slate-800/40 last:border-0"
            >
              <td className="px-3 py-2">
                <MethodBadge method={row.method} />
              </td>
              <td className="px-3 py-2">
                <code className="text-[11px] font-mono text-slate-300">
                  {row.path}
                </code>
              </td>
              <td className="px-3 py-2 text-[11px] text-slate-400">
                {row.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    POST: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
    PATCH: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    DELETE: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
    PUT: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold ${colors[method] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}
    >
      {method}
    </span>
  );
}

function TwoColumnTable({
  rows,
}: {
  rows: { label: string; value: string; note?: string; icon?: ReactNode }[];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800/80">
      <table className="w-full text-left">
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-slate-800/40 last:border-0"
            >
              <td className="px-3 py-2 text-[11px] font-medium text-slate-300 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  {row.icon}
                  {row.label}
                </span>
              </td>
              <td className="px-3 py-2 text-[11px] text-slate-400">
                {row.value}
                {row.note && (
                  <span className="ml-1.5 text-[10px] text-slate-600">
                    {row.note}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Section Content ───────────────────────────────────────────────────────────

function SectionAccessAuth() {
  return (
    <div className="space-y-1">
      <SubHeading>How Admin Role Works</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          The admin role is stored in the <code className="text-[11px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1 rounded">Player.role</code> field in the database.
        </Bullet>
        <Bullet>
          Accepted values: <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">USER</code>, <code className="text-[11px] font-mono text-amber-400/80 bg-amber-500/10 px-1 rounded">ADMIN</code>.
        </Bullet>
        <Bullet>
          On login, the JWT token includes the role claim. Every admin API route verifies the JWT and checks <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">role === 'ADMIN'</code>.
        </Bullet>
        <Bullet>
          The token is stored in an httpOnly cookie — it cannot be tampered with client-side.
        </Bullet>
      </ul>

      <SubHeading>How to Promote a Player to Admin</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Only an <em>existing admin</em> can promote another player.
        </Bullet>
        <Bullet>
          Navigate to the <strong className="text-slate-200">Players</strong> tab → click on a player → use the role modification control.
        </Bullet>
        <Bullet>
          The change takes effect immediately on the next API call (existing JWT remains valid until expiry).
        </Bullet>
      </ul>

      <SubHeading>How to Revoke Admin Access</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Use chip/role modification controls on the Players tab to adjust the role back to USER.
        </Bullet>
        <Bullet>
          Alternatively, directly modify the <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">role</code> field in the database.
        </Bullet>
        <Bullet>
          To force-invalidate their session, increment their <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">tokenVersion</code> — this will cause their current JWT to fail verification.
        </Bullet>
      </ul>

      <SubHeading>Admin API Endpoints</SubHeading>
      <EndpointTable
        rows={[
          { method: 'GET', path: '/api/admin/players', desc: 'List/search players' },
          { method: 'GET', path: '/api/admin/players/[id]', desc: 'Player detail with stats' },
          { method: 'PATCH', path: '/api/admin/players/[id]/chips', desc: 'Adjust player chips' },
          { method: 'PATCH', path: '/api/admin/players/[id]/role', desc: 'Change player role' },
          { method: 'POST', path: '/api/admin/players/[id]/ban', desc: 'Ban a player' },
          { method: 'POST', path: '/api/admin/players/[id]/unban', desc: 'Unban a player' },
          { method: 'GET', path: '/api/admin/clips', desc: 'List clips for moderation' },
          { method: 'PATCH', path: '/api/admin/clips/[id]', desc: 'Approve or reject clip' },
          { method: 'GET', path: '/api/admin/clans', desc: 'List/search clans' },
          { method: 'GET', path: '/api/admin/matches', desc: 'Recent match history' },
          { method: 'GET', path: '/api/admin/stats', desc: 'Platform overview stats' },
          { method: 'POST', path: '/api/admin/championship/finalize', desc: 'Finalize championship year' },
          { method: 'GET', path: '/api/admin/config', desc: 'Read game configuration' },
          { method: 'PUT', path: '/api/admin/config', desc: 'Update game configuration' },
        ]}
      />
    </div>
  );
}

function SectionPlayerManagement() {
  return (
    <div className="space-y-1">
      <SubHeading>Viewing &amp; Searching Players</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          The <strong className="text-slate-200">Players</strong> tab supports search by <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">name</code> or <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">userTag</code>.
        </Bullet>
        <Bullet>
          Search is debounced at 300ms to reduce API load.
        </Bullet>
        <Bullet>
          A toggle/filter is available to show <strong className="text-slate-200">banned players only</strong>.
        </Bullet>
        <Bullet>
          Clicking a player opens a detail panel with full stats, cosmetics, social links, and history.
        </Bullet>
      </ul>

      <SubHeading>Banning Players</SubHeading>
      <div className="flex items-center gap-1.5 mb-2">
        <Ban className="h-3.5 w-3.5 text-rose-400" />
        <span className="text-[11px] text-slate-500">Bans are permanent and enforced at the auth middleware level.</span>
      </div>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Open the player detail → click the <strong className="text-rose-400">Ban</strong> button.
        </Bullet>
        <Bullet>
          Bans are <strong className="text-slate-200">permanent</strong> — there is no expiry system.
        </Bullet>
        <Bullet>
          <strong className="text-rose-400">Cannot ban admins.</strong> The API will reject the request.
        </Bullet>
        <Bullet>
          Banned players are blocked at the auth middleware level and cannot access any game endpoint.
        </Bullet>
        <Bullet>
          To unban, use the <strong className="text-emerald-400">Unban</strong> button on the player detail (visible only for banned players).
        </Bullet>
      </ul>

      <SubHeading>Chip Adjustment</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Open the player detail → locate the chip adjustment section.
        </Bullet>
        <Bullet>
          Enter a numeric amount, then click <strong className="text-emerald-400">Add</strong> or <strong className="text-rose-400">Remove</strong>.
        </Bullet>
        <Bullet>
          Positive values <strong className="text-emerald-400">add</strong> chips; negative values <strong className="text-rose-400">remove</strong> chips.
        </Bullet>
        <Bullet>
          Chip balance is <strong className="text-slate-200">clamped at 0</strong> — it will never go negative from an adjustment.
        </Bullet>
        <Bullet>
          All chip operations are wrapped in database transactions and logged.
        </Bullet>
      </ul>

      <Note>
        Chip adjustments bypass the normal economy flow. Use sparingly and always document the reason in your admin notes.
      </Note>
    </div>
  );
}

function SectionContentModeration() {
  return (
    <div className="space-y-1">
      <SubHeading>Clip Submission Workflow</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Players can submit game clips from the Highlights tab after a match.
        </Bullet>
        <Bullet>
          New clips enter <code className="text-[11px] font-mono text-amber-400/80 bg-amber-500/10 px-1 rounded">PENDING</code> status and are not visible to other players.
        </Bullet>
        <Bullet>
          Admins review and either <strong className="text-emerald-400">approve</strong> (shows in public feed) or <strong className="text-rose-400">reject</strong> (hidden but retained for audit).
        </Bullet>
      </ul>

      <SubHeading>Match Cards (Auto-Generated)</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Match cards are <strong className="text-slate-200">auto-generated</strong> by the system at match end.
        </Bullet>
        <Bullet>
          These are <strong className="text-emerald-400">auto-approved</strong> and do not require manual moderation.
        </Bullet>
      </ul>

      <SubHeading>How to Moderate</SubHeading>
      <div className="flex items-center gap-1.5 mb-2">
        <Eye className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-[11px] text-slate-500">Review each clip carefully before approving.</span>
      </div>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Navigate to the <strong className="text-slate-200">Highlights</strong> tab.
        </Bullet>
        <Bullet>
          Click the <strong className="text-amber-400">MODERATE</strong> button to enter moderation mode.
        </Bullet>
        <Bullet>
          Review each pending clip — preview the clip content, check metadata.
        </Bullet>
        <Bullet>
          Click <strong className="text-emerald-400">Approve</strong> to publish to the public feed, or <strong className="text-rose-400">Reject</strong> to hide it.
        </Bullet>
        <Bullet>
          For <strong className="text-amber-400">approved</strong> clips, a <strong className="text-amber-300">Feature ★</strong> button appears — click it to pin the clip as the Top Play spotlight on the Highlights feed. Click again to unfeature. Only one clip should be featured at a time for best results.
        </Bullet>
      </ul>

      <SubHeading>SLA</SubHeading>
      <InfoBox>
        Target: review all pending clips <strong className="text-emerald-300">within 24 hours</strong> of submission. Rejected clips are preserved in the database for audit purposes — they are never deleted.
      </InfoBox>
    </div>
  );
}

function SectionEconomyOverview() {
  return (
    <div className="space-y-1">
      <SubHeading>Chip Faucets (Inflows)</SubHeading>
      <TwoColumnTable
        rows={[
          { label: 'Daily Claim', value: 'Base amount once per day, scales with streak', note: 'streak freeze available' },
          { label: 'Hourly Claim', value: 'Smaller amount, available every hour', note: 'reduced vs daily' },
          { label: 'Video Reward', value: 'Chips for watching a short ad', note: '60s cooldown' },
          { label: 'Match Extracts', value: 'Chips extracted from arena to bank', note: 'varies by performance' },
          { label: 'Promo Codes', value: 'One-time redemption via code entry', note: 'single use per code per player' },
          { label: 'Lucky Spin', value: 'Gacha-style reward wheel', note: 'free spin daily, paid extra', icon: <Zap className="h-3 w-3 text-yellow-400" /> },
          { label: 'Referrals', value: 'Bonus chips when referred players sign up', note: 'both parties rewarded' },
        ]}
      />

      <SubHeading>Chip Drains (Outflows)</SubHeading>
      <TwoColumnTable
        rows={[
          { label: 'Match Buy-In', value: 'Entry fee deducted before match starts', note: 'primary drain' },
          { label: 'Cosmetics', value: 'Skins, trails, death effects purchased in shop', note: 'NOT counted as losses' },
          { label: 'Gifts', value: 'Chips spent sending gifts to other players', note: 'sender loses, receiver gains', icon: <Gift className="h-3 w-3 text-pink-400" /> },
          { label: 'Clan Deposits', value: 'Player-initiated deposits to clan treasury', note: 'withdrawable + payouts exist' },
        ]}
      />

      <SubHeading>Important Economy Rules</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          <strong className="text-slate-200">All economy operations are server-authoritative.</strong> The client sends an intent; the server validates, computes, and commits in a database transaction.
        </Bullet>
        <Bullet>
          <strong className="text-emerald-400">Cosmetic purchases do NOT count as losses.</strong> They are tracked separately and do not affect <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">totalLost</code>.
        </Bullet>
        <Bullet>
          <strong className="text-amber-400">Gifts received DO increment totalEarned.</strong> The receiver's <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">totalEarned</code> is increased by the gift amount.
        </Bullet>
      </ul>

      <Note>
        Never modify economy values directly in the database — always use the admin API endpoints to ensure transactional integrity and audit trails.
      </Note>
    </div>
  );
}

function SectionClanGovernance() {
  return (
    <div className="space-y-1">
      <SubHeading>Viewing Clans</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          The <strong className="text-slate-200">Clans</strong> tab lists all clans with member counts, levels, XP progress, and treasury balances.
        </Bullet>
        <Bullet>
          Click a clan to see its detail panel — includes emblem, description, stats, and creation date.
        </Bullet>
      </ul>

      <SubHeading>Clan Treasury Operations</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          <strong className="text-slate-200">Deposit</strong> — Members move chips from personal bank to treasury. Quick-deposit buttons (10%, 25%, 50%, MAX). Max 1,000,000c per transaction.
        </Bullet>
        <Bullet>
          <strong className="text-emerald-400">Withdraw</strong> — Members can withdraw up to what they personally deposited. Leaving the clan forfeits unwithdrawn deposits.
        </Bullet>
        <Bullet>
          <strong className="text-amber-400">Payout</strong> — Leader/Co-Leader distributes treasury chips to any member. Uses the same amount input, then clicks the payout icon on the member row.
        </Bullet>
        <Bullet>
          <strong className="text-violet-400">Clan Shop</strong> — Leader spends treasury on perks: Member Expansion (+5 slots, 15,000c), XP Windfall (Level×500 XP, 8,000c), War Shield (7-day peace mode, 5,000c).
        </Bullet>
      </ul>

      <SubHeading>Clan Wars</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          <strong className="text-slate-200">No separate arenas.</strong> Members play normal matches — kills automatically count toward their clan's war score.
        </Bullet>
        <Bullet>
          Leader declares war with a wager (min 1,000c). Both treasuries deducted immediately (escrow). Total pot = wager × 2.
        </Bullet>
        <Bullet>
          First clan to <strong className="text-rose-400">50 kills</strong> wins the pot. War ends automatically.
        </Bullet>
        <Bullet>
          Protections: one active war per clan, War Shield blocks declarations (7 days), both clans must have sufficient treasury.
        </Bullet>
      </ul>

      <SubHeading>Clan Roles &amp; Hierarchy</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          <strong className="text-amber-400">Leader</strong> — one per clan. Full control over clan settings, promotions, and member management.
        </Bullet>
        <Bullet>
          <strong className="text-slate-200">Co-Leader</strong> — maximum <strong className="text-white">2 per clan</strong>. Can manage members but cannot demote the leader.
        </Bullet>
        <Bullet>
          <strong className="text-slate-300">Member</strong> — standard membership. Can deposit chips and participate in clan activities.
        </Bullet>
      </ul>

      <SubHeading>Admin Clan Actions</SubHeading>
      <InfoBox>
        No admin-specific clan actions are built into the UI yet. Planned features: force-disband clan, remove specific member, transfer leadership. For emergencies, modify the database directly via Prisma queries.
      </InfoBox>
    </div>
  );
}

function SectionChampionships() {
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

function SectionConfiguration() {
  return (
    <div className="space-y-1">
      <SubHeading>Game Configuration Page</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Game config is managed at the <strong className="text-slate-200">/admin</strong> route (separate page, not a tab).
        </Bullet>
        <Bullet>
          The configuration page provides a full form for all tunable game parameters.
        </Bullet>
      </ul>

      <SubHeading>Configuration Categories</SubHeading>
      <TwoColumnTable
        rows={[
          { label: 'Snake Physics', value: 'Speed, acceleration, deceleration, turn rate' },
          { label: 'Growth', value: 'Length per food, max length, growth rate' },
          { label: 'Boost', value: 'Boost speed multiplier, boost drain rate, cooldown' },
          { label: 'Collision', value: 'Self-collision, wall collision, head-on rules' },
          { label: 'Food', value: 'Spawn rate, food types, nutritional value' },
          { label: 'Extraction', value: 'Extraction zone timing, chip conversion rate' },
          { label: 'Spawning', value: 'Safe spawn duration, spawn location logic' },
          { label: 'Map', value: 'Arena size, boundary type, grid visibility' },
          { label: 'Bots', value: 'Bot count, difficulty, behavior patterns' },
          { label: 'Economy', value: 'Daily claim amounts, match buy-in, rewards' },
        ]}
      />

      <SubHeading>Applying Changes</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Configuration changes take effect <strong className="text-emerald-400">immediately</strong> upon saving.
        </Bullet>
        <Bullet>
          A <strong className="text-slate-200">Reset to Defaults</strong> button is available to restore all values to their shipped defaults.
        </Bullet>
      </ul>

      <Note>
        <strong>Always test configuration changes in a practice arena first.</strong> Changing physics or economy values without testing can severely impact player experience. Document all changes with timestamps.
      </Note>
    </div>
  );
}

function SectionSecurityProtocols() {
  return (
    <div className="space-y-1">
      <SubHeading>Authentication</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          JWTs are stored in <strong className="text-slate-200">httpOnly cookies</strong> — invisible to client-side JavaScript.
        </Bullet>
        <Bullet>
          Token expiry: <strong className="text-slate-200">30 days</strong>. Refresh happens automatically on API calls.
        </Bullet>
        <Bullet>
          Each player has a <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">tokenVersion</code> — incrementing it invalidates all existing tokens for that user.
        </Bullet>
      </ul>

      <SubHeading>Server-to-Server Auth</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          The game server communicates with the web server using <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">INTERNAL_SECRET</code> — an environment variable shared between services.
        </Bullet>
        <Bullet>
          This secret is used for server-to-server API calls only and is never exposed to the client.
        </Bullet>
      </ul>

      <SubHeading>Access Code Removal</SubHeading>
      <InfoBox>
        Hardcoded access codes have been <strong className="text-emerald-300">removed this session</strong>. Authentication now relies solely on the JWT + role system. No backdoor access codes exist.
      </InfoBox>

      <SubHeading>Race Condition Fixes</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          <strong className="text-emerald-400">Video reward</strong> — cooldown check and chip grant are now atomic within a database transaction.
        </Bullet>
        <Bullet>
          <strong className="text-emerald-400">Promo code redemption</strong> — idempotency key prevents double-redemption even under concurrent requests.
        </Bullet>
        <Bullet>
          <strong className="text-emerald-400">Clip upvote</strong> — unique constraint on (playerId, clipId) prevents duplicate votes at the database level.
        </Bullet>
      </ul>

      <SubHeading>Rate Limiting</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Rate limiting exists on <strong className="text-slate-200">auth endpoints only</strong> (login, register, password reset).
        </Bullet>
        <Bullet>
          Implementation: <strong className="text-slate-200">in-memory</strong> sliding window counter. Resets on server restart.
        </Bullet>
        <Bullet>
          Game API endpoints do <strong className="text-slate-200">not</strong> have rate limiting yet — planned for future.
        </Bullet>
      </ul>
    </div>
  );
}

function SectionIncidentResponse() {
  return (
    <div className="space-y-1">
      <SubHeading>Chip Exploit Response</SubHeading>
      <div className="ml-1 space-y-2">
        <div className="flex items-start gap-2">
          <span className="flex-shrink-0 h-5 w-5 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-[10px] font-mono font-bold text-rose-400 mt-0.5">
            1
          </span>
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-200">Identify</strong> — Check the Players tab for abnormal chip balances. Cross-reference with match history to spot discrepancies.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="flex-shrink-0 h-5 w-5 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-[10px] font-mono font-bold text-rose-400 mt-0.5">
            2
          </span>
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-200">Remove excess</strong> — Use the chip adjustment tool to remove the illegally gained chips. Clamp to 0 if necessary.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="flex-shrink-0 h-5 w-5 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-[10px] font-mono font-bold text-rose-400 mt-0.5">
            3
          </span>
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-200">Ban if intentional</strong> — If the exploit was deliberately abused, ban the player permanently. Document the evidence.
          </p>
        </div>
      </div>

      <SubHeading>Server Issues</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Check <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">dev.log</code> for error messages and stack traces.
        </Bullet>
        <Bullet>
          If the game server is unresponsive, restart it. The game server auto-restarts on file changes when running in dev mode.
        </Bullet>
        <Bullet>
          Check database connectivity — Prisma client errors usually indicate a SQLite lock or corruption.
        </Bullet>
      </ul>

      <SubHeading>Data Breach Response</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          <strong className="text-rose-400">Immediately rotate</strong> <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">JWT_SECRET</code> in the environment variables.
        </Bullet>
        <Bullet>
          Increment <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">tokenVersion</code> on <strong className="text-slate-200">all players</strong> to force re-authentication.
        </Bullet>
        <Bullet>
          This can be done via a bulk Prisma update: <code className="text-[11px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1 rounded">{'db.player.updateMany({ data: { tokenVersion: { increment: 1 } } })'}</code>
        </Bullet>
        <Bullet>
          Review server logs for suspicious access patterns post-rotation.
        </Bullet>
      </ul>

      <Note>
        In any incident, document the timeline, actions taken, and root cause. Store incident reports in a secure location for post-mortem analysis.
      </Note>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const SECTIONS: GuideSection[] = [
  {
    id: 'access-auth',
    icon: <Shield className="h-4.5 w-4.5" />,
    title: 'Access & Authentication',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    content: <SectionAccessAuth />,
  },
  {
    id: 'player-management',
    icon: <Users className="h-4.5 w-4.5" />,
    title: 'Player Management',
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
    content: <SectionPlayerManagement />,
  },
  {
    id: 'content-moderation',
    icon: <Film className="h-4.5 w-4.5" />,
    title: 'Content Moderation',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    content: <SectionContentModeration />,
  },
  {
    id: 'economy-overview',
    icon: <Coins className="h-4.5 w-4.5" />,
    title: 'Economy Overview',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    content: <SectionEconomyOverview />,
  },
  {
    id: 'clan-governance',
    icon: <Crown className="h-4.5 w-4.5" />,
    title: 'Clan Governance',
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    content: <SectionClanGovernance />,
  },
  {
    id: 'championships',
    icon: <Trophy className="h-4.5 w-4.5" />,
    title: 'Championships',
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    content: <SectionChampionships />,
  },
  {
    id: 'configuration',
    icon: <Settings className="h-4.5 w-4.5" />,
    title: 'Configuration',
    iconColor: 'text-slate-300',
    iconBg: 'bg-slate-700/30',
    borderColor: 'border-slate-600/30',
    content: <SectionConfiguration />,
  },
  {
    id: 'security-protocols',
    icon: <Lock className="h-4.5 w-4.5" />,
    title: 'Security Protocols',
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    content: <SectionSecurityProtocols />,
  },
  {
    id: 'incident-response',
    icon: <ShieldAlert className="h-4.5 w-4.5" />,
    title: 'Incident Response',
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    content: <SectionIncidentResponse />,
  },
];

export default function GuideTab() {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(['access-auth']),
  );

  const toggle = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenSections(new Set(SECTIONS.map((s) => s.id)));
  };

  const collapseAll = () => {
    setOpenSections(new Set());
  };

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-800 border border-slate-700/50">
            <BookOpen className="h-4.5 w-4.5 text-slate-300" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              Admin Operations Guide
            </h2>
            <p className="text-[11px] text-slate-500">
              Reference manual for all admin tasks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={expandAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ChevronDown className="h-3 w-3" />
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ChevronRight className="h-3 w-3" />
            Collapse All
          </button>
        </div>
      </div>

      {/* ── Sections ──────────────────────────────────────────────────────── */}
      <div className="max-h-[600px] overflow-y-auto space-y-2 custom-scrollbar-guide pr-1">
        {SECTIONS.map((section) => {
          const isOpen = openSections.has(section.id);
          return (
            <div
              key={section.id}
              className={`rounded-2xl border transition-colors duration-200 ${
                isOpen
                  ? `${section.borderColor} bg-slate-900/60`
                  : 'border-slate-800/60 bg-slate-900/30'
              }`}
            >
              <SectionHeader
                icon={section.icon}
                title={section.title}
                iconColor={section.iconColor}
                iconBg={section.iconBg}
                open={isOpen}
                onClick={() => toggle(section.id)}
              />

              {isOpen && (
                <div className="px-5 pb-5 pt-0 border-t border-slate-800/40">
                  <div className="pt-4">{section.content}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1">
        <span className="flex items-center gap-1.5">
          <Server className="h-3 w-3" />
          Venom Arena Admin v1.0
        </span>
        <span>
          {SECTIONS.length} sections · All content is static — no server requests
        </span>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar-guide::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar-guide::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar-guide::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.3);
          border-radius: 999px;
        }
        .custom-scrollbar-guide::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.5);
        }
      `}</style>
    </div>
  );
}
