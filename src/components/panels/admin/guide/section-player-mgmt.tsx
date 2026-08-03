'use client';

import { Ban } from 'lucide-react';
import { SubHeading, Bullet, Note } from './_helpers';

export function SectionPlayerManagement() {
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