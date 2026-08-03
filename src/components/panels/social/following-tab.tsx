'use client';

import { UserMinus } from 'lucide-react';
import { PanelSkeleton } from '../_panel-primitives';
import { countryFlag } from '@/lib/game-config';
import type { FollowItem } from './_types';

interface FollowingTabProps {
  following: FollowItem[];
  followingLoading: boolean;
  onUnfollow: (tag: string, name: string) => void;
}

export function FollowingTab({ following, followingLoading, onUnfollow }: FollowingTabProps) {
  if (followingLoading) return <PanelSkeleton count={4} />;

  if (following.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
        <UserMinus className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-white">Not Following Anyone</h4>
        <p className="text-xs text-slate-400 mt-1">
          Follow players from the Followers tab or inspect their profiles.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll rounded-2xl border border-slate-800/60 bg-slate-950/80">
      {following.map((f) => {
        const tag = f.userTag ?? f.followingUserTag ?? '';
        const name = f.name ?? f.followingName ?? '';
        const country = f.country ?? f.followingCountry ?? '';
        return (
          <li key={f.followingId ?? tag} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 bg-slate-800/60 border border-slate-700/60" aria-hidden>
                {countryFlag(country)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white text-sm truncate">{name}</div>
                <div className="text-[10px] font-mono text-slate-500">#{tag}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUnfollow(tag, name)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-rose-600/10 border border-rose-500/30 text-rose-300 hover:bg-rose-600 hover:text-white transition flex items-center gap-1"
            >
              <UserMinus className="w-3 h-3" /> Unfollow
            </button>
          </li>
        );
      })}
    </ul>
  );
}
