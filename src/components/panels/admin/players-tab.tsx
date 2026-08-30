'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { notify, type ToastFn } from '../_panel-primitives';
import { formatChipsShort as formatChips } from '@/lib/format-chips';
import { PlayerList, type AdminPlayer } from './players/player-list';
import { PlayerDetailPanel, type PlayerDetail } from './players/player-detail';

// ── Main Component ───────────────────────────────────────────────────────────

export function PlayersTab({ onToast }: { onToast?: ToastFn }) {
  const { player } = useAuth();
  const isAdmin = player?.role === 'admin';

  // State
  const [search, setSearch] = useState('');
   const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [playerDetail, setPlayerDetail] = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [chipAmount, setChipAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [showBannedOnly, setShowBannedOnly] = useState(false);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch search results ──
  const fetchPlayers = useCallback(async (query: string, bannedOnly: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, banned: String(bannedOnly) });
      const res = await fetch(`/api/admin/search-players?${params}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();
      const data = (await res.json().catch(() => ({}))) as { players?: AdminPlayer[] };
      setPlayers(data.players || []);
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch player detail ──
  const fetchDetail = useCallback(async (userTag: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/players/${encodeURIComponent(userTag)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      // API returns player fields at top level (not nested under .player)
      if (data.id) {
        setPlayerDetail(data as unknown as PlayerDetail);
      } else {
        setPlayerDetail(null);
      }
    } catch {
      setPlayerDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Debounced search effect ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchPlayers(search, showBannedOnly);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, showBannedOnly, fetchPlayers]);

  // ── Initial load ──
  useEffect(() => {
    if (isAdmin) void fetchPlayers('', false);
  }, [isAdmin, fetchPlayers]);

  // ── Handle row click ──
  function handleSelectPlayer(userTag: string) {
    setSelectedTag(userTag);
    setChipAmount('');
    void fetchDetail(userTag);
  }

  // ── Close detail ──
  function closeDetail() {
    setSelectedTag(null);
    setPlayerDetail(null);
    setChipAmount('');
  }

  // ── Refresh both list + detail ──
  async function refreshAll() {
    await Promise.all([
      fetchPlayers(search, showBannedOnly),
      selectedTag ? fetchDetail(selectedTag) : Promise.resolve(),
    ]);
  }

  // ── Modify chips ──
  async function handleModifyChips(type: 'add' | 'remove') {
    if (!selectedTag || !chipAmount.trim()) {
      notify('Select a player and enter an amount.', 'error', onToast);
      return;
    }
    const amount = Math.abs(Number(chipAmount));
    if (!Number.isFinite(amount) || amount === 0) {
      notify('Amount must be a positive number.', 'error', onToast);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/modify-chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userTag: selectedTag,
          amount: type === 'remove' ? -amount : amount,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        notify(data?.error || 'Failed to modify chips.', 'error', onToast);
        return;
      }
      notify(
        `${type === 'remove' ? 'Removed' : 'Added'} ${formatChips(amount)} chips for ${selectedTag}.`,
        'success',
        onToast,
      );
      setChipAmount('');
      await refreshAll();
    } catch {
      notify('Network error while modifying chips.', 'error', onToast);
    } finally {
      setBusy(false);
    }
  }

  // ── Ban / Unban ──
  async function handleBanToggle() {
    if (!selectedTag || !playerDetail) return;
    const banning = !playerDetail.banned;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTag: selectedTag, banned: banning }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        notify(data?.error || `Failed to ${banning ? 'ban' : 'unban'} player.`, 'error', onToast);
        return;
      }
      notify(
        `${playerDetail.name} has been ${banning ? 'banned' : 'unbanned'}.`,
        banning ? 'info' : 'success',
        onToast,
      );
      await refreshAll();
    } catch {
      notify('Network error.', 'error', onToast);
    } finally {
      setBusy(false);
    }
  }

  // ── Guard: not admin ──
  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-8 text-center max-w-sm mx-auto">
        <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-xs text-slate-400">Access restricted to administrators.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* ── LEFT: Player list ── */}
      <PlayerList
        players={players}
        loading={loading}
        selectedTag={selectedTag}
        search={search}
        showBannedOnly={showBannedOnly}
        onSearchChange={setSearch}
        onBannedOnlyChange={setShowBannedOnly}
        onSelectPlayer={handleSelectPlayer}
      />

      {/* ── RIGHT: Detail panel ── */}
      <PlayerDetailPanel
        selectedTag={selectedTag}
        playerDetail={playerDetail}
        detailLoading={detailLoading}
        chipAmount={chipAmount}
        busy={busy}
        onChipAmountChange={setChipAmount}
        onClose={closeDetail}
        onModifyChips={handleModifyChips}
        onBanToggle={handleBanToggle}
      />
    </div>
  );
}
