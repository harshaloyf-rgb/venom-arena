'use client';

import { Eye } from 'lucide-react';
import { SubHeading, Bullet, InfoBox } from './_helpers';

export function SectionContentModeration() {
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