'use client';
import { useState, useCallback, useEffect } from 'react';
import { Shield, ShieldAlert, LayoutDashboard, Users, Film, Crown, BookOpen, Settings, ExternalLink } from 'lucide-react';
import { GlowBlob, notify, type ToastFn } from './_panel-primitives';

const TABS = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'players', label: 'Players', Icon: Users },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AdminPanel({ onToast }: { onToast?: ToastFn }) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <Shield className="w-5 h-5 text-emerald-400" />
        <h2 className="text-sm font-black text-white uppercase tracking-wider">Admin Dashboard</h2>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition cursor-pointer border',
              activeTab === id
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50',
            ].join(' ')}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
