'use client';

import { SubHeading, Bullet, EndpointTable } from './_helpers';

export function SectionAccessAuth() {
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