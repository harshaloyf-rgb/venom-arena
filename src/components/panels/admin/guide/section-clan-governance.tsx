'use client';

import { SubHeading, Bullet, InfoBox } from './_helpers';

export function SectionClanGovernance() {
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