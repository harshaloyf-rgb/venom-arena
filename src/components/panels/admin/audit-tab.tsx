'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';

// X11: Admin audit trail viewer — read-only, newest first.

interface AuditEntry {
  id: string;
  adminTag: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

const PAGE_SIZE = 50;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function summarize(entry: AuditEntry): string {
  const d = entry.details;
  if (!d) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(d)) {
    const val = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
    parts.push(`${k}=${val.length > 80 ? val.slice(0, 80) + '…' : val}`);
  }
  return parts.join(' · ');
}

const ACTION_COLORS: Record<string, string> = {
  ban: 'text-red-400 border-red-500/30 bg-red-500/10',
  unban: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  modify_chips: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  config_update: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  config_seed: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
};

export function AuditTab() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async (off: number, action: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
      if (action) params.set('action', action);
      const res = await fetch(`/api/admin/audit-logs?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { logs: AuditEntry[]; total: number };
      setLogs(data.logs);
      setTotal(data.total);
    } catch {
      setError('Failed to load audit log.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(offset, actionFilter);
  }, [offset, actionFilter, fetchLogs]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-slate-300">
          <History className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium lg:text-[11px]">Audit Log</span>
          <span className="text-xs text-slate-500 lg:text-[10px]">({total} entries)</span>
        </div>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setOffset(0); }}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 lg:text-[10px]"
        >
          <option value="">All actions</option>
          <option value="ban">ban</option>
          <option value="unban">unban</option>
          <option value="modify_chips">modify_chips</option>
          <option value="clan_disband">clan_disband</option>
          <option value="clan_kick">clan_kick</option>
          <option value="clan_set_chips">clan_set_chips</option>
          <option value="config_update">config_update</option>
          <option value="clip_approve">clip_approve</option>
          <option value="clip_reject">clip_reject</option>
          <option value="hof_induct">hof_induct</option>
        </select>
        <button
          onClick={() => fetchLogs(offset, actionFilter)}
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 lg:text-[10px]"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400 lg:text-[10px]">{error}</p>
      )}

      {!error && logs.length === 0 && !loading && (
        <p className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-4 text-center text-xs text-slate-500 lg:text-[10px]">
          No audit entries yet. Admin actions will appear here automatically.
        </p>
      )}

      {logs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-xs lg:text-[10px]">
              <thead className="sticky top-0 bg-slate-900 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Admin</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {logs.map((l) => (
                  <tr key={l.id} className="text-slate-300">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatWhen(l.createdAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{l.adminTag}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`rounded border px-1.5 py-0.5 font-medium ${ACTION_COLORS[l.action] || 'border-slate-600/40 bg-slate-800 text-slate-300'}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {l.targetType && (
                        <span className="text-slate-500">{l.targetType}:</span>
                      )}{' '}
                      <span className="font-mono">{l.targetId}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{summarize(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-500 lg:text-[10px]">
        <span>Showing {logs.length === 0 ? 0 : offset + 1}–{offset + logs.length} of {total}</span>
        <div className="flex gap-2">
          <button
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40 hover:bg-slate-800"
          >
            Prev
          </button>
          <button
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40 hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
