'use client';

import { LayoutDashboard, Swords, Gift, Trophy, LayoutGrid } from 'lucide-react';

export interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onMoreOpen: () => void;
}

const TABS = [
  { id: 'home', tabId: 'dashboard', Icon: LayoutDashboard, label: 'Home' },
  { id: 'play', tabId: 'arena', Icon: Swords, label: 'Play' },
  { id: 'claims', tabId: 'rewards', Icon: Gift, label: 'Claims' },
  { id: 'ranks', tabId: 'leaderboard', Icon: Trophy, label: 'Ranks' },
  { id: 'more', tabId: null, Icon: LayoutGrid, label: 'More' },
] as const;

const PRIMARY_TABS = new Set(['dashboard', 'arena', 'rewards', 'leaderboard']);

function getActiveBottomTab(activeTab: string): string {
  if (PRIMARY_TABS.has(activeTab)) {
    const map: Record<string, string> = { dashboard: 'home', arena: 'play', rewards: 'claims', leaderboard: 'ranks' };
    return map[activeTab] ?? 'more';
  }
  return 'more';
}

export function BottomTabBar({ activeTab, onTabChange, onMoreOpen }: BottomTabBarProps) {
  const active = getActiveBottomTab(activeTab);

  return (
    <nav className="md:hidden sticky bottom-0 shrink-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 pb-[env(safe-area-inset-bottom)] z-30">
      <div className="flex items-center justify-around h-14">
        {TABS.map(({ id, tabId, Icon, label }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => {
                if (tabId) onTabChange(tabId);
                else onMoreOpen();
              }}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors cursor-pointer relative ${
                isActive ? 'text-indigo-400' : 'text-slate-500'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-500 rounded-full" />
              )}
              <Icon className={`w-5 h-5 transition-all ${isActive ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]' : ''}`} />
              <span className={`text-[10px] font-semibold ${isActive ? 'text-indigo-400' : ''}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
