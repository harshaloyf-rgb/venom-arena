'use client';

import { useCallback, useEffect, useState } from 'react';
import { Crown, Tickets, Loader2, RefreshCw, Ban, XCircle } from 'lucide-react';
import { notify, type ToastFn } from '../../_panel-primitives';

// Admin "Pass & Tickets" section for the player detail panel (2026-09-05).
// Lets the admin CHECK why a player has (or doesn't have) an ad-free pass —
// which order granted it, from which store — and FIX common issues inline:
// grant / revoke pass, ±tickets, clear a stuck ad-unlock window.
// All actions go through /api/admin/economy (session + audit logged server-side).

interface PlayerPassState {
  id: string; name: string; userTag: string;
  adFreeUntil: string | null;
  adUnlockUntil: string | null;
  tickets: number;
  passActive: boolean;
  windowActive: boolean;
}
interface OrderMini { id: string; createdAt: string; sku: string; durationDays: number; store: string; ticketsGranted: number; adFreeUntilAfter: string }
interface LedgerMini { id: string; createdAt: string; delta: number; reason: string; refId: string | null }
interface PlayerView { player: PlayerPassState; orders: OrderMini[]; ledger: LedgerMini[] }
interface PlanRow { sku: string; label: string; days: number; tickets: number }

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtDaysLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

export function PassTicketsSection({ userTag, onToast }: { userTag: string; onToast?: ToastFn }) {
  const [data, setData] = useState<PlayerView | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sku, setSku] = useState('');
  const [ticketDelta, setTicketDelta] = useState('');
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pv, st] = await Promise.all([
        fetch(`/api/admin/economy?view=player&userTag=${encodeURIComponent(userTag)}`),
        fetch('/api/admin/economy'),
      ]);
      if (pv.ok) setData(await pv.json()); else setData(null);
      if (st.ok) {
        const s = await st.json();
        setPlans(s.plans ?? []);
        setSku((cur) => cur || s.plans?.[0]?.sku || '');
      }
    } catch { /* transient */ } finally { setLoading(false); }
  }, [userTag]);

  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/economy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) { notify(okMsg, 'success', onToast); await load(); }
      else notify(d.error || `Action failed (HTTP ${res.status}).`, 'error', onToast);
      return res.ok;
    } catch {
      notify('Network error.', 'error', onToast);
      return false;
    } finally { setBusy(false); }
  }

  async function adjustTickets() {
    const delta = Math.trunc(Number(ticketDelta));
    if (!Number.isFinite(delta) || delta === 0) { notify('Enter a non-zero integer delta.', 'error', onToast); return; }
    const ok = await act({ action: 'set_tickets', userTag, delta }, `Tickets ${delta > 0 ? '+' : ''}${delta} for ${userTag}.`);
    if (ok) setTicketDelta('');
  }

  const p = data?.player;

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-950/10 p-3 lg:p-1.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] lg:text-[11px] font-mono uppercase tracking-widest text-sky-500/80 flex items-center gap-1">
          <Crown className="w-3 h-3" /> Pass &amp; Tickets
        </span>
        <button type="button" onClick={() => void load()} className="p-1 rounded-md text-slate-500 hover:text-slate-200" aria-label="Refresh pass state">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !p ? (
        <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-500" /></div>
      ) : !p ? (
        <p className="text-[10px] text-rose-300/70 font-mono">Could not load pass state.</p>
      ) : (
        <>
          {/* State row */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg px-2 py-1">
              <div className="text-[8px] text-slate-500 font-bold uppercase">Ad-Free Pass</div>
              <div className={`text-[10px] font-mono font-bold ${p.passActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                {p.passActive && p.adFreeUntil ? fmtDaysLeft(p.adFreeUntil) : 'None'}
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg px-2 py-1">
              <div className="text-[8px] text-slate-500 font-bold uppercase">Ad Window</div>
              <div className={`text-[10px] font-mono font-bold ${p.windowActive ? 'text-sky-400' : 'text-slate-500'}`}>
                {p.windowActive && p.adUnlockUntil ? fmtDaysLeft(p.adUnlockUntil) : 'Closed'}
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg px-2 py-1">
              <div className="text-[8px] text-slate-500 font-bold uppercase">Tickets</div>
              <div className="text-[10px] font-mono font-bold text-amber-300">{p.tickets}</div>
            </div>
          </div>

          {/* Grant / revoke */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <select
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-[10px] text-slate-200 flex-1 min-w-[110px]"
            >
              {plans.map((pl) => <option key={pl.sku} value={pl.sku}>{pl.label} (+{pl.tickets} 🎟)</option>)}
            </select>
            <button
              type="button"
              onClick={() => void act({ action: 'grant_pass', userTag, sku }, `Pass ${sku} granted to ${userTag}.`)}
              disabled={busy || !sku}
              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[9px] font-bold uppercase tracking-wider transition flex items-center gap-1"
            >
              {busy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Crown className="w-2.5 h-2.5" />} Grant
            </button>
            {p.passActive && (
              confirmRevoke ? (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={async () => { const ok = await act({ action: 'revoke_pass', userTag }, `Pass revoked for ${userTag}.`); if (ok) setConfirmRevoke(false); }}
                    disabled={busy}
                    className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold uppercase transition"
                  >Sure?</button>
                  <button type="button" onClick={() => setConfirmRevoke(false)} className="px-1.5 py-1 text-[9px] text-slate-400 hover:text-white">No</button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(true)}
                  disabled={busy}
                  className="px-2 py-1 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-900/40 text-[9px] font-bold uppercase tracking-wider transition flex items-center gap-1"
                >
                  <Ban className="w-2.5 h-2.5" /> Revoke
                </button>
              )
            )}
            {p.windowActive && (
              <button
                type="button"
                onClick={() => void act({ action: 'clear_ad_unlock', userTag }, `Ad window cleared for ${userTag}.`)}
                disabled={busy}
                className="px-2 py-1 rounded-lg bg-sky-950/40 border border-sky-500/30 text-sky-300 hover:bg-sky-900/40 text-[9px] font-bold uppercase tracking-wider transition flex items-center gap-1"
              >
                <XCircle className="w-2.5 h-2.5" /> Clear window
              </button>
            )}
          </div>

          {/* Tickets adjust */}
          <div className="flex gap-1.5 items-center">
            <input
              type="number"
              value={ticketDelta}
              onChange={(e) => setTicketDelta(e.target.value)}
              placeholder="+10 / -5"
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-white font-mono w-24 focus:outline-none focus:border-sky-500/50"
            />
            <button
              type="button"
              onClick={() => void adjustTickets()}
              disabled={busy || !ticketDelta.trim()}
              className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[9px] font-bold uppercase tracking-wider transition flex items-center gap-1"
            >
              <Tickets className="w-2.5 h-2.5" /> Apply
            </button>
            <span className="text-[9px] text-slate-600 font-mono">ledgers as admin_grant / admin_revoke</span>
          </div>

          {/* History */}
          {(data!.orders.length > 0 || data!.ledger.length > 0) && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {data!.orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-[9px] font-mono bg-slate-950/60 border border-slate-800/40 rounded px-1.5 py-0.5">
                  <span className="text-amber-300/80">{o.store}</span>
                  <span className="text-slate-400">{o.sku} ({o.durationDays}d)</span>
                  <span className="text-sky-300">+{o.ticketsGranted}🎟</span>
                  <span className="text-slate-600">{fmtWhen(o.createdAt)}</span>
                </div>
              ))}
              {data!.ledger.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-[9px] font-mono bg-slate-950/60 border border-slate-800/40 rounded px-1.5 py-0.5">
                  <span className={l.delta > 0 ? 'text-emerald-300' : 'text-rose-300'}>{l.delta > 0 ? `+${l.delta}` : l.delta} tickets</span>
                  <span className="text-slate-400">{l.reason}</span>
                  <span className="text-slate-600">{fmtWhen(l.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
