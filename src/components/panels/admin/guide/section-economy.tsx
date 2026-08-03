'use client';

import { Zap, Crown, Gift } from 'lucide-react';
import { SubHeading, Bullet, Note, TwoColumnTable } from './_helpers';

export function SectionEconomyOverview() {
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
          { label: 'Elite Cyber Pass', value: '100,000c one-time purchase to unlock elite track', note: 'server-validated, persistent', icon: <Crown className="h-3 w-3 text-amber-400" /> },
          { label: 'Gifts', value: 'Chips spent sending gifts to other players', note: 'sender loses, receiver gains', icon: <Gift className="h-3 w-3 text-pink-400" /> },
          { label: 'Clan Deposits', value: 'Player-initiated deposits to clan treasury', note: 'withdrawable + payouts exist' },
        ]}
      />

      <SubHeading>Season Pass (Cyber Pass)</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          <strong className="text-slate-200">Fully server-enforced.</strong> DB fields: <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">hasElitePass</code>, <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">passClaimedFree</code>, <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">passClaimedElite</code>.
        </Bullet>
        <Bullet>
          <strong className="text-emerald-400">20 tiers</strong> tied to player levels (Lv 2 → 38). Each tier unlocks a free + elite cosmetic reward.
        </Bullet>
        <Bullet>
          <strong className="text-amber-400">Elite unlock:</strong> <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">POST /api/season-pass/unlock-elite</code> — deducts 100K chips atomically.
        </Bullet>
        <Bullet>
          <strong className="text-cyan-400">Claim:</strong> <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">POST /api/season-pass/claim</code> — validates level, track, prevents double-claim, adds cosmetic to <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">unlockedSkins</code>.
        </Bullet>
        <Bullet>
          <strong className="text-purple-400">40 pass-exclusive cosmetics</strong> (20 free + 20 elite) defined in <code className="text-[11px] font-mono text-slate-300 bg-slate-800 px-1 rounded">game-config.ts</code> — never available in the regular Shop.
        </Bullet>
        <Bullet>
          Pass cosmetic purchases do <strong className="text-emerald-400">NOT count as losses</strong> (same rule as regular cosmetics).
        </Bullet>
      </ul>

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