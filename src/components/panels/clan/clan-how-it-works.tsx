'use client';

import { Shield, Coins, Target, Swords } from 'lucide-react';

// T50: New-player onboarding for the Syndicates system. Launch feedback was
// that clans + clan wars are hard to understand, so this 4-step strip explains
// the whole loop in plain language. Shown in the clanless "My Clan" view and
// at the top of Browse Clans.

const STEPS = [
  {
    icon: Shield,
    color: 'text-indigo-300',
    ring: 'border-indigo-500/30 bg-indigo-500/10',
    title: '1. Join or Form',
    body: 'Browse clans and tap Request to Join (a Leader must approve), accept an invite from a member, or form your own for free.',
  },
  {
    icon: Coins,
    color: 'text-emerald-300',
    ring: 'border-emerald-500/30 bg-emerald-500/10',
    title: '2. Pool Chips',
    body: 'Deposit chips into the shared Treasury. Deposits give your clan 5% XP, and the Treasury funds perks, payouts and wars.',
  },
  {
    icon: Target,
    color: 'text-amber-300',
    ring: 'border-amber-500/30 bg-amber-500/10',
    title: '3. Weekly Challenges',
    body: '4 challenges reset every Monday (UTC): deposits, recruits, chat, streaks. Leader/Co-Leader claim chip rewards for the Treasury.',
  },
  {
    icon: Swords,
    color: 'text-rose-300',
    ring: 'border-rose-500/30 bg-rose-500/10',
    title: '4. Clan Wars',
    body: 'The Leader wagers Treasury chips on a rival clan. Both treasuries pay in instantly — first clan to 50 real-player kills takes the whole pot.',
  },
] as const;

export function HowSyndicatesWork() {
  return (
    <div className="p-4 lg:p-1.5 rounded-2xl border border-indigo-500/20 bg-slate-950/60">
      <h4 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4 lg:w-3 lg:h-3 text-indigo-400" /> How Syndicates Work
      </h4>
      <p className="text-[11px] text-slate-400 mb-3 lg:mb-1">Four steps — from lone Viper to a war-winning crew:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-1">
        {STEPS.map((s) => (
          <div key={s.title} className={`p-3 lg:p-1 rounded-xl border ${s.ring}`}>
            <div className={`flex items-center gap-1.5 text-[11px] lg:text-[11px] font-bold ${s.color} mb-1`}>
              <s.icon className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> {s.title}
            </div>
            <p className="text-[10px] lg:text-[11px] text-slate-400 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
