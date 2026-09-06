'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Tickets, Crown, Wallet, AlertTriangle, Loader2, Search, X } from 'lucide-react';
import { notify, type ToastFn } from '../_panel-primitives';
import { getCosmeticById } from '@/lib/game-config';

// Admin Economy tab — Time Pass / Ticket control room (locked spec 2026-09-04,
// tooling added 2026-09-05, cosmetic purchase ledger added 2026-09-06).
// Read surfaces: pass orders, ticket ledger, cosmetic purchase ledger,
// wallet reset status. Write surfaces: grant/revoke pass, ±tickets, clear ad
// window, guarded force wallet reset (server additionally gated by
// ADMIN_FORCE_WALLET_RESET=1).

interface PlanRow { sku: string; label: string; days: number; priceUsd: number; tickets: number }
interface StatusData {
  walletReset: { lastResetYear: number; currentIstYear: number; resetDue: boolean; resetEnabled: boolean };
  activePasses: number;
  totalTickets: number;
  plans: PlanRow[];
}

interface OrderRow {
  id: string; createdAt: string; userTag: string; playerName: string;
  sku: string; durationDays: number; priceUsdMicros: number; store: string;
  storeOrderId: string; ticketsGranted: number; adFreeUntilAfter: string; verifierNote: string | null;
}
interface LedgerRow {
  id: string; createdAt: string; userTag: string; playerName: string;
  delta: number; reason: string; refId: string | null;
}
interface CosRow {
  id: string; createdAt: string; userTag: string; playerName: string;
  itemId: string; itemType: string; amountChips: number;
}
interface CosByType { itemType: string; count: number; chips: number }

const PAGE_SIZE = 50;
const STORES = ['', 'admin', 'play', 'appstore'];
const REASONS = ['', 'pass_grant', 'admin_grant', 'admin_revoke', 'jade_corridor_join'];
const COS_TYPES = ['', 'skin', 'elite-pass', 'pass-cosmetic', 'pass-chip'];

// Friendly labels for the Purchase.itemType values written by the buy flows
// (cosmetic route, season-pass routes). Unknown values render as-is.
const COS_TYPE_META: Record<string, { label: string; tone: string }> = {
  'skin': { label: 'Shop Skin', tone: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  'elite-pass': { label: 'Elite Pass', tone: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  'pass-cosmetic': { label: 'Pass Cosmetic', tone: 'bg-violet-500/10 text-violet-300 border-violet-500/30' },
  'pass-chip': { label: 'Pass Chips', tone: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
};

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtUsdMicros(m: number): string {
  return `$${(m / 1_000_000).toFixed(2)}`;
}
function fmtDaysLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

export function EconomyTab({ onToast }: { onToast?: ToastFn }) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [section, setSection] = useState<'orders' | 'ledger' | 'cosmetics'>('orders');
  const [loading, setLoading] = useState(true);

  // filters
  const [userFilter, setUserFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [cosTypeFilter, setCosTypeFilter] = useState('');
  const [offset, setOffset] = useState(0);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [purchases, setPurchases] = useState<CosRow[]>([]);
  const [byType, setByType] = useState<CosByType[]>([]);
  const [total, setTotal] = useState(0);

  // guarded wallet reset
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/economy');
      if (res.ok) setStatus(await res.json());
    } catch { /* transient */ }
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: section, limit: String(PAGE_SIZE), offset: String(offset) });
      if (userFilter.trim()) params.set('userTag', userFilter.trim());
      if (section === 'orders') {
        if (storeFilter) params.set('store', storeFilter);
        if (skuFilter.trim()) params.set('sku', skuFilter.trim());
      } else if (section === 'cosmetics') {
        if (cosTypeFilter) params.set('itemType', cosTypeFilter);
      } else if (reasonFilter) {
        params.set('reason', reasonFilter);
      }
      const res = await fetch(`/api/admin/economy?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (section === 'orders') { setOrders(data.orders); setTotal(data.total); }
      else if (section === 'cosmetics') { setPurchases(data.purchases); setTotal(data.total); setByType(data.byType ?? []); }
      else { setLedger(data.ledger); setTotal(data.total); }
    } catch {
      notify(`Failed to load ${section}.`, 'error', onToast);
    } finally {
      setLoading(false);
    }
  }, [section, offset, userFilter, storeFilter, skuFilter, reasonFilter, cosTypeFilter]);

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);
  useEffect(() => { void fetchRows(); }, [fetchRows]);

  async function runWalletReset() {
    setResetBusy(true);
    try {
      const res = await fetch('/api/admin/economy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force_wallet_reset' }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        notify(`Wallet reset done — ${data.playersReset} player(s) zeroed.`, 'success', onToast);
        setResetOpen(false); setResetConfirmText('');
        void fetchStatus();
      } else {
        notify(data.error || `Reset failed (HTTP ${res.status}).`, 'error', onToast);
      }
    } catch {
      notify('Network error during wallet reset.', 'error', onToast);
    } finally {
      setResetBusy(false);
    }
  }

  const storeBadge = (s: string) => {
    const tone = s === 'admin'
      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
      : s === 'play'
        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${tone}`}>{s}</span>;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Tickets className="w-4 h-4 text-emerald-400" /> Economy — Time Pass &amp; Tickets
        </h3>
        <button
          type="button"
          onClick={() => { void fetchStatus(); void fetchRows(); }}
          className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status strip */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-70 mb-1"><Crown className="w-3 h-3" /> Active Passes</div>
            <div className="font-mono font-bold text-sm">{status.activePasses}</div>
          </div>
          <div className="p-3 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-200">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-70 mb-1"><Tickets className="w-3 h-3" /> Tickets in circulation</div>
            <div className="font-mono font-bold text-sm">{status.totalTickets.toLocaleString('en-IN')}</div>
          </div>
          <div className={`p-3 rounded-xl border ${status.walletReset.resetDue ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-slate-700 bg-slate-900/60 text-slate-200'} sm:col-span-1 col-span-2`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-70 mb-1"><Wallet className="w-3 h-3" /> Wallet reset (Jan 1)</div>
            <div className="font-mono font-bold text-sm">
              Last: {status.walletReset.lastResetYear} · Now: {status.walletReset.currentIstYear}
            </div>
            <div className="text-[10px] opacity-80 font-mono">
              {status.walletReset.resetDue ? 'RESET DUE on next authenticated request' : 'No reset pending'}
              {!status.walletReset.resetEnabled && ' · flag off'}
            </div>
          </div>
        </div>
      )}

      {/* Guarded force wallet reset */}
      <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-3">
        {!resetOpen ? (
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-rose-200/80">
              <span className="font-bold text-rose-300">Force wallet reset</span> — zeroes EVERY player&apos;s bankedChips immediately (Jan-1 style). Stats, passes and tickets are kept.
            </div>
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              disabled={!status?.walletReset.resetEnabled}
              title={status?.walletReset.resetEnabled ? undefined : 'Disabled: set ADMIN_FORCE_WALLET_RESET=1 on the server to enable'}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3 h-3" /> Reset
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-300">This wipes EVERY player&apos;s bankedChips to 0. It cannot be undone from this panel.</p>
                <p className="text-rose-200/70 mt-0.5">Type <span className="font-mono font-bold text-white">RESET</span> to confirm.</p>
              </div>
              <button type="button" onClick={() => { setResetOpen(false); setResetConfirmText(''); }} className="ml-auto p-1 rounded-md text-slate-400 hover:text-white" aria-label="Cancel reset">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                className="flex-1 bg-slate-950 border border-rose-500/30 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-rose-400"
              />
              <button
                type="button"
                onClick={() => void runWalletReset()}
                disabled={resetBusy || resetConfirmText !== 'RESET'}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1.5"
              >
                {resetBusy && <Loader2 className="w-3 h-3 animate-spin" />} Execute
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section toggle + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
          {(['orders', 'ledger', 'cosmetics'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setSection(s); setOffset(0); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${section === s ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {s === 'orders' ? 'Pass Orders' : s === 'ledger' ? 'Ticket Ledger' : 'Cosmetics'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setOffset(0); }}
            placeholder="player tag"
            className="bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-1.5 text-xs text-slate-200 w-36 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        {section === 'orders' ? (
          <>
            <select value={storeFilter} onChange={(e) => { setStoreFilter(e.target.value); setOffset(0); }} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200">
              {STORES.map((s) => <option key={s} value={s}>{s === '' ? 'All stores' : s}</option>)}
            </select>
            <select value={skuFilter} onChange={(e) => { setSkuFilter(e.target.value); setOffset(0); }} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200">
              <option value="">All SKUs</option>
              {(status?.plans ?? []).map((p) => <option key={p.sku} value={p.sku}>{p.sku}</option>)}
            </select>
          </>
        ) : section === 'cosmetics' ? (
          <select value={cosTypeFilter} onChange={(e) => { setCosTypeFilter(e.target.value); setOffset(0); }} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200">
            {COS_TYPES.map((t) => <option key={t} value={t}>{t === '' ? 'All types' : COS_TYPE_META[t]?.label ?? t}</option>)}
          </select>
        ) : (
          <select value={reasonFilter} onChange={(e) => { setReasonFilter(e.target.value); setOffset(0); }} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200">
            {REASONS.map((r) => <option key={r} value={r}>{r === '' ? 'All reasons' : r}</option>)}
          </select>
        )}
      </div>

      {/* Cosmetics lifetime breakdown (global, filter-independent) */}
      {section === 'cosmetics' && byType.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Lifetime</span>
          {byType.map((g) => (
            <div key={g.itemType} className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-[10px] text-slate-400">
              <span className="font-bold text-slate-200">{COS_TYPE_META[g.itemType]?.label ?? g.itemType}</span>
              {' · '}{g.count} row{g.count === 1 ? '' : 's'} ·{' '}
              <span className={`font-mono font-bold ${g.chips < 0 ? 'text-rose-300' : g.chips > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>
                {g.chips === 0 ? '±0c' : `${g.chips > 0 ? '+' : ''}${g.chips.toLocaleString('en-IN')}c`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tables */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-x-auto">
        {section === 'orders' ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Store</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Tickets</th>
                <th className="px-3 py-2">Pass until</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No pass orders match. Admin grants show store=<span className="font-mono">admin</span>; real purchases show play/appstore.</td></tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-slate-900 last:border-0">
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtWhen(o.createdAt)}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-emerald-300">{o.userTag}</span>
                    <span className="text-slate-500 ml-1.5">{o.playerName}</span>
                  </td>
                  <td className="px-3 py-2">{storeBadge(o.store)}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{o.sku} <span className="text-slate-600">({o.durationDays}d)</span></td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">{o.store === 'admin' ? '—' : fmtUsdMicros(o.priceUsdMicros)}</td>
                  <td className="px-3 py-2 text-right font-mono text-sky-300">+{o.ticketsGranted}</td>
                  <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap" title={o.adFreeUntilAfter}>{fmtDaysLeft(o.adFreeUntilAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : section === 'cosmetics' ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-right">Chips</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No cosmetic ledger rows match. Shop skin buys, Elite Pass unlocks and season-pass claims land here.</td></tr>
              )}
              {purchases.map((p) => {
                const meta = COS_TYPE_META[p.itemType];
                return (
                  <tr key={p.id} className="border-b border-slate-900 last:border-0">
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtWhen(p.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-emerald-300">{p.userTag}</span>
                      <span className="text-slate-500 ml-1.5">{p.playerName}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${meta?.tone ?? 'bg-slate-500/10 text-slate-300 border-slate-500/30'}`}>{meta?.label ?? p.itemType}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-300 max-w-[180px] truncate" title={p.itemId}>{getCosmeticById(p.itemId)?.name ?? p.itemId}</td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${p.amountChips < 0 ? 'text-rose-300' : p.amountChips > 0 ? 'text-emerald-300' : 'text-slate-600'}`}>
                      {p.amountChips === 0 ? '—' : `${p.amountChips > 0 ? '+' : ''}${p.amountChips.toLocaleString('en-IN')}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2 text-right">Delta</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Ref</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No ticket movements match. Every grant/spend lands here.</td></tr>
              )}
              {ledger.map((r) => (
                <tr key={r.id} className="border-b border-slate-900 last:border-0">
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtWhen(r.createdAt)}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-emerald-300">{r.userTag}</span>
                    <span className="text-slate-500 ml-1.5">{r.playerName}</span>
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-bold ${r.delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                  <td className="px-3 py-2"><span className="font-mono text-[10px] text-slate-300 bg-slate-800/60 border border-slate-700/60 px-1.5 py-0.5 rounded">{r.reason}</span></td>
                  <td className="px-3 py-2 font-mono text-[10px] text-slate-600 max-w-[140px] truncate">{r.refId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString('en-IN')}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0} className="px-3 py-1.5 rounded-lg border border-slate-800 disabled:opacity-40 hover:text-slate-200">Prev</button>
          <button type="button" onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total} className="px-3 py-1.5 rounded-lg border border-slate-800 disabled:opacity-40 hover:text-slate-200">Next</button>
        </div>
      </div>
    </div>
  );
}
