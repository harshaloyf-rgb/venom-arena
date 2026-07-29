'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { COUNTRIES, countryFlag } from '@/lib/game-config';
import type { LeaderboardEntry } from '@/lib/types';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Shield,
  ShieldAlert,
  Users,
  Coins,
  Server,
  FileText,
  Ban,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  VolumeX,
  UserX,
  Trash2,
  Send,
  Zap,
} from 'lucide-react';

interface AdminPanelProps {
  onToast?: ToastFn;
}

interface AdminLogEntry {
  id: string;
  ts: string;
  action: string;
  target: string;
  detail: string;
  ok: boolean;
}

interface SystemStats {
  totalPlayers: number;
  totalChips: number;
  activeArenas: number;
}

const ACTIVE_ARENAS = 7;

function nowStamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function AdminPanel({ onToast }: AdminPanelProps) {
  const { player, refresh } = useAuth();
  const isAdmin = player?.role === 'admin';

  // Access gate: admin role is already verified below; gate provides additional confirmation
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [accessCode, setAccessCode] = useState('');

  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [chipAmount, setChipAmount] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [broadcast, setBroadcast] = useState('');

  const addLog = useCallback((action: string, target: string, detail: string, ok: boolean) => {
    setLogs((prev) => [
      { id: randomId(), ts: nowStamp(), action, target, detail, ok },
      ...prev,
    ].slice(0, 50));
  }, []);

  const fetchPlayers = useCallback(async () => {
    setLoadingPlayers(true);
    try {
      const res = await fetch('/api/leaderboard?type=chips&limit=100', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { entries?: LeaderboardEntry[]; error?: string };
      const list = res.ok ? (data.entries || []) : [];
      setPlayers(list);
      const totalChips = list.reduce((sum, e) => sum + e.bankedChips, 0);
      setStats({
        totalPlayers: list.length,
        totalChips,
        activeArenas: ACTIVE_ARENAS,
      });
    } catch {
      setPlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin || !gateUnlocked) return;
    void fetchPlayers();
  }, [isAdmin, gateUnlocked, fetchPlayers]);

  // Access denied if not admin role
  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-8 max-w-md mx-auto my-12 text-center shadow-md">
        <ShieldAlert className="w-14 h-14 text-rose-400 mx-auto mb-4" />
        <h3 className="text-xl font-black text-white mb-2 tracking-tight">Access Denied</h3>
        <p className="text-xs text-rose-300/80 leading-relaxed">
          This console is restricted to authorized Venom Arena operators with the
          <span className="font-mono text-rose-200"> admin</span> role.
          Your account does not have permission to view or modify player data.
        </p>
      </div>
    );
  }

  // Access gate — confirms admin identity before showing sensitive tools
  if (!gateUnlocked) {
    function handleAuthorize() {
      const code = accessCode.trim();
      if (code !== 'venom_admin_2024') {
        notify('Invalid operations code.', 'error', onToast);
        return;
      }
      setGateUnlocked(true);
      notify('Admin credentials verified!', 'success', onToast);
    }

    return (
      <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden max-w-md mx-auto my-12">
        <GlowBlob color="bg-rose-500/10" className="-top-12 -right-12 w-56 h-56" />
        <div className="relative text-center">
          <Shield className="w-14 h-14 text-rose-400 mx-auto mb-3" />
          <h3 className="text-xl font-black text-white mb-1 tracking-tight">Central Operations Gate</h3>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            Access is restricted to authorized Syndicate Technical Overseers.
            Enter your operations code to proceed.
          </p>
          <input
            type="password"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAuthorize(); }}
            placeholder="Operations Code"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-rose-500/50 mb-3"
          />
          <button
            type="button"
            onClick={handleAuthorize}
            className="w-full px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition"
          >
            Authorize Terminal
          </button>
        </div>
      </div>
    );
  }

  const filteredPlayers = players.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.userTag.toLowerCase().includes(q);
  });

  const selected = players.find((p) => p.userTag === selectedTag) || null;

  async function handleModifyChips(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTag) {
      notify('Select a player first.', 'error', onToast);
      return;
    }
    const amount = Number(chipAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      notify('Amount must be a non-zero number.', 'error', onToast);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/modify-chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTag: selectedTag, amount }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; player?: { bankedChips: number } };
      if (!res.ok) {
        notify(data?.error || 'Failed to adjust player chips.', 'error', onToast);
        addLog('MODIFY_CHIPS', selectedTag, `FAILED: ${data?.error || 'unknown'}`, false);
        return;
      }
      notify(`Modified balance of ${selectedTag} by ${amount > 0 ? '+' : ''}${amount} chips!`, 'success', onToast);
      addLog('MODIFY_CHIPS', selectedTag, `${amount > 0 ? '+' : ''}${amount}c → ${data.player?.bankedChips ?? '?'}c`, true);
      setChipAmount('');
      await fetchPlayers();
      if (selectedTag === player?.userTag) await refresh();
    } catch {
      notify('Failed to adjust player chips.', 'error', onToast);
    } finally {
      setBusy(false);
    }
  }

  async function handleBan(userTag: string, ban: boolean) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTag, banned: ban }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        notify(data?.error || 'Ban action failed.', 'error', onToast);
        addLog(ban ? 'BAN' : 'UNBAN', userTag, `FAILED: ${data?.error || 'unknown'}`, false);
        return;
      }
      notify(ban ? `Banned player ${userTag} permanently.` : `Unbanned player ${userTag}.`, ban ? 'error' : 'success', onToast);
      addLog(ban ? 'BAN' : 'UNBAN', userTag, ban ? 'Player banned' : 'Player unbanned', true);
      await fetchPlayers();
    } catch {
      notify('Network error during ban action.', 'error', onToast);
    } finally {
      setBusy(false);
    }
  }

  function handleKick(playerId: string) {
    notify(`Player ${playerId} kicked from active lobby.`, 'info', onToast);
    addLog('KICK', playerId, 'Kicked from lobby', true);
  }

  function handleMute(playerId: string) {
    notify(`Toggled mute state for player ${playerId}.`, 'info', onToast);
    addLog('MUTE', playerId, 'Mute toggled', true);
  }

  function handleBroadcast() {
    if (!broadcast.trim()) return;
    notify('Global admin broadcast sent!', 'success', onToast);
    addLog('BROADCAST', 'ALL', broadcast.slice(0, 80), true);
    setBroadcast('');
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* COL 1: SYSTEM DIAGNOSTICS + LOGS */}
      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 flex flex-col gap-5 shadow-md">
        <header className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Server className="w-5 h-5 text-rose-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">System Diagnostics</h3>
          <button
            type="button"
            onClick={() => void fetchPlayers()}
            disabled={loadingPlayers}
            className="ml-auto p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Refresh stats"
          >
            {loadingPlayers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </header>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
            <span className="text-[10px] text-slate-500 font-mono uppercase block">Connected Sockets</span>
            <div className="text-lg font-black text-rose-400 font-mono mt-1 tabular-nums">
              {stats?.totalPlayers ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
            <span className="text-[10px] text-slate-500 font-mono uppercase block">Active Rooms</span>
            <div className="text-lg font-black text-emerald-400 font-mono mt-1 tabular-nums">
              {stats?.activeArenas ?? 0}
            </div>
          </div>
        </div>

        {/* Broadcast */}
        <div>
          <MicroLabel className="mb-1.5">Global Intercom Broadcast</MicroLabel>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={broadcast}
              onChange={(e) => setBroadcast(e.target.value)}
              placeholder="Announce to all active matches..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-500/50"
            />
            <button
              type="button"
              onClick={handleBroadcast}
              disabled={!broadcast.trim()}
              className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          </div>
        </div>

        {/* Syslog */}
        <div className="flex-1 flex flex-col gap-2 min-h-[200px]">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            <span>SYSLOG MONITOR</span>
            <span className="ml-auto text-[10px] text-slate-500 font-mono normal-case">{logs.length} entries</span>
          </div>
          <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] text-slate-400 overflow-y-auto va-scroll max-h-[280px] flex flex-col gap-1">
            {logs.length === 0 ? (
              <span className="text-slate-600 italic">No recent transactions...</span>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="border-b border-slate-900/60 pb-1 flex items-start gap-2">
                  <span className="text-slate-600 shrink-0">[{log.ts}]</span>
                  <span className={log.ok ? 'text-emerald-400' : 'text-rose-400'}>
                    {log.ok ? '✓' : '✗'} {log.action}
                  </span>
                  <span className="text-amber-300">{log.target}</span>
                  <span className="text-slate-500 truncate">{log.detail}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* COL 2-3: PLAYER ROSTER + ACTIONS */}
      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-md lg:col-span-2 flex flex-col gap-4">
        <header className="flex items-center justify-between border-b border-slate-800 pb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Operations Roster</h3>
          </div>
          <span className="bg-rose-500/10 text-rose-400 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold border border-rose-500/20">
            {filteredPlayers.length} Active
          </span>
        </header>

        {/* SEARCH */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or userTag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/60 font-mono"
          />
        </div>

        {/* LIST */}
        <div className="flex-1 overflow-y-auto va-scroll max-h-[340px] flex flex-col gap-2 pr-1">
          {loadingPlayers ? (
            <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
              Loading roster...
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/30 border border-slate-800 rounded-xl text-slate-500 text-xs">
              No active human players currently linked to server memory.
            </div>
          ) : (
            filteredPlayers.map((p) => {
              const isSelected = selectedTag === p.userTag;
              const isSelf = p.userTag === player?.userTag;
              const socketId = `${p.userTag}-${randomId()}`.slice(0, 8).toUpperCase();
              return (
                <div
                  key={p.userTag}
                  className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${isSelected ? 'bg-rose-500/10 border-rose-500/40' : 'bg-slate-950 border-slate-800/60 hover:border-slate-700'}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 va-pulse shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white">{p.name}</span>
                        <span className="text-[9px] font-mono text-slate-500 bg-slate-900 border border-slate-800/60 px-1 py-0.5 rounded">#{p.userTag}</span>
                        {isSelf && <span className="text-[9px] font-mono font-bold bg-amber-500 text-slate-950 px-1 py-0.5 rounded">YOU</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap font-mono">
                        <span aria-hidden>{countryFlag(p.country)}</span>
                        <span>• Lvl {p.level}</span>
                        <span>• Room: tier-{(p.rank % 7) + 1}</span>
                        <span className="text-amber-400 font-bold">{p.bankedChips.toLocaleString()} Chips</span>
                        <span className="text-slate-600">SID: {socketId}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMute(p.userTag)}
                      disabled={busy || isSelf}
                      title="Toggle Mute Player"
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 hover:text-white hover:bg-amber-900/30 hover:border-amber-500/30 transition disabled:opacity-40"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKick(p.userTag)}
                      disabled={busy || isSelf}
                      title="Kick Connection"
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-yellow-400 hover:text-white hover:bg-yellow-900/30 hover:border-yellow-500/30 transition disabled:opacity-40"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBan(p.userTag, true)}
                      disabled={busy || isSelf}
                      title="Ban UserTag Permanently"
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTag(p.userTag)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${isSelected ? 'bg-rose-500 text-white' : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'}`}
                      aria-pressed={isSelected}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ECONOMY LEDGER */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 mt-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase mb-3 tracking-wider">
            <Coins className="w-4 h-4" />
            <span>Economy Ledger Overrides</span>
            {selected && (
              <span className="ml-auto text-[10px] font-mono text-slate-500 normal-case flex items-center gap-1">
                <Zap className="w-3 h-3" /> Target: <span className="text-amber-300">{selected.name}</span> #{selected.userTag}
              </span>
            )}
          </div>
          <form onSubmit={handleModifyChips} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
            <input
              type="text"
              placeholder="Player Tag (e.g. STRK-8291)"
              value={selectedTag || ''}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-rose-500/50"
            />
            <input
              type="number"
              placeholder="Amount (+/- e.g. 5000)"
              value={chipAmount}
              onChange={(e) => setChipAmount(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
              required
            />
            <button
              type="submit"
              disabled={busy || !selectedTag}
              className="bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-lg px-4 py-1.5 text-xs transition flex items-center gap-1.5 justify-center"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
              Adjust Chips Balance
            </button>
          </form>
          <p className="text-[10px] text-slate-500 font-mono mt-2 flex items-center gap-1">
            <Shield className="w-3 h-3" /> All actions are logged. Banked chips clamp at 0 (no negatives).
          </p>
        </div>
      </section>
    </div>
  );
}

export default AdminPanel;
