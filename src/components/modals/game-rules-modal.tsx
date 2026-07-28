'use client';

/**
 * Venom Arena — Official Guide, Rules & FAQ modal (BUILD-6).
 *
 * A polished, single-source-of-truth rules modal styled to match the dark
 * slate + indigo AAA shell. Renders inside a shadcn Dialog so it inherits
 * focus-trap, ESC-to-close, and backdrop-click semantics for free.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BookOpen,
  Compass,
  Coins,
  Skull,
  Shield,
  Trophy,
  Sparkles,
  Users,
  Zap,
  AlertTriangle,
} from 'lucide-react';

interface GameRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RuleBlock {
  icon: typeof BookOpen;
  title: string;
  color: string; // tailwind text color
  body: string;
}

const OBJECTIVE_BLOCKS: RuleBlock[] = [
  {
    icon: Compass,
    title: 'Steer & Survive',
    color: 'text-indigo-400',
    body: 'Move your venom snake by aiming with the mouse (or WASD / arrows / virtual joystick on mobile). Your body trails behind — never crash head-first into another snake.',
  },
  {
    icon: Coins,
    title: 'Harvest Chips',
    color: 'text-emerald-400',
    body: 'Drifting orbs refill your mass. Star-chips (gold) drop from defeated rivals and are worth far more. Each orb converts directly to carried chips.',
  },
  {
    icon: Skull,
    title: 'Eliminate Rivals',
    color: 'text-rose-400',
    body: 'Force an opponent\'s head into your body to kill them. Their whole trail explodes into a harvestable star-chip field — but anyone can steal it.',
  },
  {
    icon: Trophy,
    title: 'Extract to Bank',
    color: 'text-amber-400',
    body: 'Hold the Extract button inside the boundary ring to lock in your carried chips. A 3-second channel — move and you cancel. Extracted chips are banked to your wallet (minus the arena\'s cut).',
  },
];

const MECHANICS_BLOCKS: RuleBlock[] = [
  {
    icon: Zap,
    title: 'Boost',
    color: 'text-cyan-400',
    body: 'Hold Space / Shift / Right-click / Boost button to burn a little mass for a speed surge. Useful to cut off rivals — but costs chips.',
  },
  {
    icon: Shield,
    title: 'Spawn Protection',
    color: 'text-violet-400',
    body: 'Newly spawned snakes glow and are immune to body collisions for a few seconds. Head-to-head still kills both. Don\'t get cocky.',
  },
  {
    icon: Sparkles,
    title: 'Extraction Zone',
    color: 'text-indigo-400',
    body: 'You can only channel extraction inside the safe boundary ring near the arena edge. Stepping outside cancels extraction immediately.',
  },
  {
    icon: Users,
    title: 'Syndicate Co-op',
    color: 'text-violet-400',
    body: 'Create or join a Clan in the Social panel to share an in-arena beacon. Clanmates\' bodies appear tethered with a dashed line — never friendly-fire.',
  },
];

const FAQ_BLOCKS: { q: string; a: string }[] = [
  {
    q: 'Is this gambling?',
    a: 'No. Chips are a free in-game soft currency earned through play and daily rewards. They have no real-world value and cannot be cashed out. The "buy-in" is a gameplay risk mechanic, not a wager.',
  },
  {
    q: 'Can I lose my banked chips?',
    a: 'Only the buy-in for the arena you enter is at risk. Carried chips (those you haven\'t extracted yet) are lost on death, but your banked wallet is safe.',
  },
  {
    q: 'What happens if I disconnect?',
    a: 'The server is authoritative. If your socket drops, your snake keeps moving in a straight line. Reconnect within 30s and you re-join the same match; otherwise you\'re settled at the result of the last snapshot.',
  },
  {
    q: 'How is anti-cheat enforced?',
    a: 'All chip creation, food eating, collisions, and extraction happen server-side. The client only sends input (angle + boost). Any client-reported "I killed X" or "I extracted Y" is ignored.',
  },
];

export function GameRulesModal({ isOpen, onClose }: GameRulesModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto va-scroll bg-slate-950 border border-slate-800 text-slate-100 p-0">
        <DialogHeader className="p-6 pb-3 border-b border-slate-800/80 sticky top-0 bg-slate-950/95 backdrop-blur z-10">
          <DialogTitle className="flex items-center gap-2.5 text-white font-black tracking-tight uppercase">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Official Guide · Rules & FAQ
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs font-mono">
            VENOM ARENA · STORES-SAFE COMPLIANT EDITION · v1.0
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-8">
          {/* HERO */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/70 border border-indigo-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <span className="text-[10px] text-indigo-400 font-mono font-bold tracking-widest block uppercase">
              Core Loop
            </span>
            <h3 className="text-lg font-black text-white mt-1">
              Hunt. Harvest. Extract. Don&apos;t get caught.
            </h3>
            <p className="text-xs text-slate-300 font-sans mt-2 leading-relaxed">
              You spawn as a small venom snake. Grow by harvesting chip orbs and the star-chip trails of fallen rivals. The bigger you are, the more chips you carry — but also the easier you are to cut off. Bank your winnings by reaching the extraction zone before someone makes you their harvest.
            </p>
          </div>

          {/* OBJECTIVES */}
          <section>
            <SectionHeader label="Objectives" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {OBJECTIVE_BLOCKS.map((b) => (
                <RuleCard key={b.title} {...b} />
              ))}
            </div>
          </section>

          {/* MECHANICS */}
          <section>
            <SectionHeader label="Mechanics" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {MECHANICS_BLOCKS.map((b) => (
                <RuleCard key={b.title} {...b} />
              ))}
            </div>
          </section>

          {/* FAIR-PLAY NOTICE */}
          <section className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-300 uppercase tracking-wide">
                  Fair-play & anti-exploit
                </h4>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  The server is the single source of truth. Chip creation, food eating, collisions, and extraction are all computed server-side — the client only sends steering input. Attempting to modify your client to spawn chips, fake a kill, or inflate your extracted amount will be silently rejected by the game server. Repeat offenses result in a ban.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <SectionHeader label="Frequently Asked" />
            <div className="flex flex-col gap-2.5 mt-3">
              {FAQ_BLOCKS.map((f, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80"
                >
                  <h4 className="text-xs font-bold text-white flex items-start gap-2">
                    <span className="text-indigo-400 font-mono shrink-0">Q.</span>
                    <span>{f.q}</span>
                  </h4>
                  <p className="text-[11.5px] text-slate-400 mt-1.5 leading-relaxed pl-5">
                    {f.a}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* FOOTER NOTE */}
          <div className="text-center text-[10px] font-mono text-slate-500 uppercase tracking-widest pt-2 border-t border-slate-800/60">
            Play responsibly · Chips have no real-world value · Stores-safe edition
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        {label}
      </span>
      <div className="h-px flex-1 bg-slate-800/60" />
    </div>
  );
}

function RuleCard({ icon: Icon, title, color, body }: RuleBlock) {
  return (
    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <h4 className="text-xs font-bold text-white uppercase tracking-wide">{title}</h4>
      </div>
      <p className="text-[11.5px] text-slate-400 leading-relaxed">{body}</p>
    </div>
  );
}

export default GameRulesModal;
