'use client';

import { useState } from 'react';
import { Shield, Users, Castle, BookOpen, Search, UserPlus, Settings, LayoutDashboard } from 'lucide-react';
import { PlayersTab } from '@/components/panels/admin/players-tab';
import GuideTab from '@/components/panels/admin/guide-tab';
import ClansTab from '@/components/panels/admin/clans-tab';
import type { ToastFn } from '../_panel-primitives';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'players', label: 'Players', icon: Users },
  { id: 'clans', label: 'Clans', icon: Castle },
  { id: 'guide', label: 'Guide', icon: BookOpen },
] as const;

type TabId = (typeof tabs)[number]['id'];

function OverviewContent({ onToast, onTabChange }: { onToast?: ToastFn; onTabChange: (tab: TabId) => void }) {
  const quickActions = [
    {
      icon: UserPlus,
      title: 'Promote Player',
      description: 'Grant admin privileges or change player roles.',
      onClick: () => onTabChange('players'),
    },
    {
      icon: Search,
      title: 'Search Players',
      description: 'Look up player profiles, stats, and activity.',
      onClick: () => onTabChange('players'),
    },
    {
      icon: BookOpen,
      title: 'View Guide',
      description: 'Read the admin guide for commands and policies.',
      onClick: () => onTabChange('guide'),
    },
    {
      icon: Settings,
      title: 'Game Config',
      description: 'Configure game settings, rates, and features.',
      onClick: () => onToast?.('Game config is managed via /admin route.', 'info'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100">Welcome, Administrator</h3>
        <p className="mt-1 text-sm text-slate-400">
          Use this dashboard to manage players, clans, and game settings. Select a quick action below or
          navigate using the tabs above.
        </p>
      </div>

      {/* Quick actions grid */}
      <div>
        <h4 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">Quick Actions</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.title}
                onClick={action.onClick}
                className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-left transition-all hover:border-emerald-500/50 hover:bg-slate-800/80"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 transition-colors group-hover:bg-emerald-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-medium text-slate-200 transition-colors group-hover:text-emerald-400">
                      {action.title}
                    </h5>
                    <p className="mt-1 text-sm text-slate-500">{action.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Info cards row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Player Management</p>
              <p className="text-sm font-medium text-slate-300">Ban, mute, promote</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Castle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Clan Management</p>
              <p className="text-sm font-medium text-slate-300">Disband, rename, edit</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Documentation</p>
              <p className="text-sm font-medium text-slate-300">Guides & references</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminPanel({ onToast }: { onToast?: ToastFn }) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <Shield className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Admin Dashboard</h2>
          <p className="text-sm text-slate-500">Manage your game server</p>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="mt-2">
        {activeTab === 'overview' && <OverviewContent onToast={onToast} onTabChange={setActiveTab} />}
        {activeTab === 'players' && <PlayersTab onToast={onToast} />}
        {activeTab === 'clans' && <ClansTab onToast={onToast} />}
        {activeTab === 'guide' && <GuideTab />}
      </div>
    </div>
  );
}
