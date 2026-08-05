'use client';

import { SubHeading, Bullet, InfoBox } from './_helpers';

export function SectionSecurityProtocols() {
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