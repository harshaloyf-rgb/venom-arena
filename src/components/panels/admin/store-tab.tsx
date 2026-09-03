'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShoppingBag, RefreshCw } from 'lucide-react';

// Admin Store tab — real-money IAP orders (Google Play / App Store).
// Read-only: revenue totals + newest-first order list.

interface StoreOrderRow {
  id: string;
  createdAt: string;
  userTag: string;
  playerName: string;
  platform: string;
  packId: string;
  productId: string;
  chips: number;
  pricePaidINR: number | null;
  status: string;
}

interface StoreOrdersResponse {
  orders: StoreOrderRow[];
  total: number;
  lifetime: { orders: number; chips: number; revenueINR: number };
  thisYear: { orders: number; chips: number; revenueINR: number };
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

export function StoreTab() {
  const [data, setData] = useState<StoreOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [platformFilter, setPlatformFilter] = useState('');

  const fetchOrders = useCallback(async (off: number, platform: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
      if (platform) params.set('platform', platform);
      const res = await fetch(`/api/admin/store-orders?${params.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || `Failed to load store orders (HTTP ${res.status}).`);
        return;
      }
      setData((await res.json()) as StoreOrdersResponse);
    } catch {
      setError('Network error loading store orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders(offset, platformFilter);
  }, [fetchOrders, offset, platformFilter]);

  const statCard = (label: string, orders: string, chips: string, inr: string, tone: string) => (
    <div className={`p-3 rounded-xl border ${tone}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">{label}</div>
      <div className="font-mono font-bold text-sm">{orders} orders</div>
      <div className="font-mono text-xs opacity-80">{chips} chips · ₹{inr}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-emerald-400" /> Store Orders (IAP)
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={platformFilter}
            onChange={(e) => { setPlatformFilter(e.target.value); setOffset(0); }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">All platforms</option>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
          </select>
          <button
            type="button"
            onClick={() => void fetchOrders(offset, platformFilter)}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 text-xs text-rose-200">{error}</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {statCard(
              'This Year',
              data.thisYear.orders.toLocaleString('en-IN'),
              data.thisYear.chips.toLocaleString('en-IN'),
              data.thisYear.revenueINR.toLocaleString('en-IN'),
              'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
            )}
            {statCard(
              'Lifetime',
              data.lifetime.orders.toLocaleString('en-IN'),
              data.lifetime.chips.toLocaleString('en-IN'),
              data.lifetime.revenueINR.toLocaleString('en-IN'),
              'border-slate-700 bg-slate-900/60 text-slate-200',
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Platform</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">Chips</th>
                  <th className="px-3 py-2 text-right">Price ₹</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                      No store orders yet. Purchases appear here once billing is configured and live.
                    </td>
                  </tr>
                )}
                {data.orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-900 last:border-0">
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{formatWhen(o.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-emerald-300">{o.userTag}</span>
                      <span className="text-slate-500 ml-1.5">{o.playerName}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        o.platform === 'android'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                      }`}>
                        {o.platform}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-300">{o.productId}</td>
                    <td className="px-3 py-2 text-right font-mono text-amber-300">{o.chips.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">{o.pricePaidINR ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        o.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-700/30 text-slate-400 border border-slate-700'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total.toLocaleString('en-IN')}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-800 disabled:opacity-40 hover:text-slate-200"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= data.total}
                className="px-3 py-1.5 rounded-lg border border-slate-800 disabled:opacity-40 hover:text-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
