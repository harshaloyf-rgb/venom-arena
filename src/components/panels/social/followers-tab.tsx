'use client';

import { UserCheck, Check, UserPlus } from 'lucide-react';
import { PanelSkeleton } from '../_panel-primitives';
import { countryFlag } from '@/lib/game-config';
import type { FollowItem } from './_types';

interface FollowersTabProps {
  followers: FollowItem[];
  followersLoading: boolean;
  followedBackTags: Set<string>;
  onFollowBack: (tag: string, name: string) => void;
}

export function FollowersTab({ followers, followersLoading, followedBackTags, onFollowBack }: FollowersTabProps) {
  if (followersLoading) return <PanelSkeleton count={4} />;

  if (followers.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
        <UserCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-white">No Followers Yet</h4>
        <p className="text-xs text-slate-400 mt-1">
          When other players follow you, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll rounded-2xl border border-slate-800/60 bg-slate-950/80">
      {followers.map((f) => {
        const tag = f.userTag ?? f.followerUserTag ?? '';
        const name = f.name ?? f.followerName ?? '';
        const country = f.country ?? f.followerCountry ?? '';
        const alreadyFollowing = followedBackTags.has(tag);
        return (
          <li key={f.followerId ?? tag} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 bg-slate-800/60 border border-slate-700/60" aria-hidden>
                {countryFlag(country)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white text-sm truncate">{name}</div>
                <div className="text-[10px] font-mono text-slate-500">#{tag}</div>
              </div>
            </div>
            {alreadyFollowing ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                <Check className="w-3 h-3" /> Following
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onFollowBack(tag, name)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-violet-600/20 border border-violet-500/40 text-violet-300 hover:bg-violet-600 hover:text-white transition flex items-center gap-1"
              >
                <UserPlus className="w-3 h-3" /> Follow Back
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
