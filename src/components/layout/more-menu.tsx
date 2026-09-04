'use client';

import { X, ShoppingBag, User, Crown, Award, Shield, Sparkles, Film, Landmark, Users } from 'lucide-react';

interface MoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tabId: string) => void;
  isAdmin: boolean;
}

interface MenuItem {
  tabId: string;
  Icon: typeof ShoppingBag;
  label: string;
  color: string;
  adminOnly?: boolean;
}

const ITEMS: MenuItem[] = [
  { tabId: 'shop', Icon: ShoppingBag, label: 'Shop & Lab', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20' },
  { tabId: 'profile', Icon: User, label: 'Agent Profile', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20' },
  { tabId: 'championships', Icon: Crown, label: 'Championships', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' },
  { tabId: 'halloffame', Icon: Award, label: 'Hall of Fame', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20' },
  { tabId: 'clans', Icon: Shield, label: 'Syndicates', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20' },
  { tabId: 'seasonpass', Icon: Sparkles, label: 'Season Pass', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20' },
  { tabId: 'clips', Icon: Film, label: 'Highlights', color: 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20' },
  { tabId: 'store', Icon: Landmark, label: 'Vault', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20' },
  { tabId: 'social', Icon: Users, label: 'Social', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20' },
  { tabId: 'admin', Icon: Shield, label: 'Admin', color: 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20', adminOnly: true },
];

export function MoreMenu({ isOpen, onClose, onSelectTab, isAdmin }: MoreMenuProps) {
  if (!isOpen) return null;

  // Filter out admin-only items for non-admins
  const items = isAdmin ? ITEMS : ITEMS.filter((item) => !item.adminOnly);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom sheet */}
      <div className="absolute bottom-14 left-0 right-0 bg-slate-900/98 border-t border-slate-700 rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] va-fade-in">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">All Stations</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {items.map(({ tabId, Icon, label, color }) => (
            <button
              key={tabId}
              onClick={() => onSelectTab(tabId)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer active:scale-95 ${color}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-bold leading-tight text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
