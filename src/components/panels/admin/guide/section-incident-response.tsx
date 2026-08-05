'use client';

import { SubHeading, Bullet, Note } from './_helpers';

export function SectionIncidentResponse() {
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
