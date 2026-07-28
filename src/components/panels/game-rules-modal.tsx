'use client';

/**
 * BUILD-11 — `GameRulesModal` panel.
 *
 * Faithful replica of `/upload/extracted/src/components/GameRulesModal.tsx`
 * (173 lines). Re-implemented on top of the shadcn `Dialog` primitive while
 * preserving every text string, section heading, bullet, FAQ pair, and the
 * "Understood & Ready to Play" close action verbatim from the original.
 */

import {
  BookOpen,
  Coins,
  Crosshair,
  Globe,
  HelpCircle,
  Keyboard,
  MousePointer,
  Swords,
  Users,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GameRulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Section({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl space-y-2">
      <h3 className={`flex items-center gap-2 font-bold text-sm ${accent}`}>
        {icon} {title}
      </h3>
      <div className="text-slate-300 text-xs leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}

export function GameRulesModal({ open, onOpenChange }: GameRulesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 max-w-3xl max-h-[88vh] p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-slate-800/80 bg-slate-900/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-white tracking-tight">
                VENOM ARENA — OFFICIAL GUIDE, RULES &amp; FAQ
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Learn controls, Online vs Offline modes, Star Chips, and
                extraction rules
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition shrink-0"
            aria-label="Close rules modal"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="p-6 overflow-y-auto va-scroll space-y-6 text-slate-300 text-xs font-sans leading-relaxed max-h-[calc(88vh-130px)]">
          {/* 1. STEERING & CONTROLS */}
          <Section
            icon={<MousePointer className="w-4 h-4" />}
            title="1. STEERING & CONTROLS"
            accent="text-indigo-400"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <span className="font-bold text-white flex items-center gap-1.5 mb-1 text-xs">
                  <MousePointer className="w-3.5 h-3.5 text-cyan-400" /> Mouse Control
                </span>
                <p className="text-slate-400 text-[11px]">
                  Move cursor around the screen to steer your snake head. Left-Click or Spacebar for Speed Boost.
                </p>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <span className="font-bold text-white flex items-center gap-1.5 mb-1 text-xs">
                  <Keyboard className="w-3.5 h-3.5 text-amber-400" /> Keyboard Control
                </span>
                <p className="text-slate-400 text-[11px]">
                  Use Arrow Keys or WASD to steer. Hold Spacebar for Boost. Hold E or tap the Extract UI button to extract.
                </p>
              </div>
            </div>
          </Section>

          {/* 2. ONLINE MULTIPLAYER VS. OFFLINE PRACTICE */}
          <Section
            icon={<Swords className="w-4 h-4" />}
            title="2. ONLINE MULTIPLAYER VS. OFFLINE PRACTICE"
            accent="text-emerald-400"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-indigo-950/20 border border-indigo-500/30 p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-indigo-300 flex items-center gap-1.5 text-xs">
                  <Users className="w-3.5 h-3.5 text-indigo-400" /> Online Arena Shards (High Stakes)
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li><strong>Chip Buy-In:</strong> Deducts buy-in chips from your Banked Vault into your match stomach.</li>
                  <li><strong>Real Players:</strong> Live PvP server shards with real opponents and leaderboard rankings.</li>
                  <li><strong>65% Payout / 35% Commission:</strong> Successful extraction returns 65% of all carried chips safely to your bank.</li>
                  <li><strong>Full Death Penalty:</strong> Crashing loses 100% of carried match chips!</li>
                </ul>
              </div>

              <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                  <Swords className="w-3.5 h-3.5 text-amber-400" /> Offline Practice Mode (Risk-Free)
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li><strong>0 Chip Buy-In (100% FREE):</strong> Zero chip cost to play.</li>
                  <li><strong>AI Bot Opponents:</strong> Practice against simulated bots without pressure.</li>
                  <li><strong>0 Chips Earned or Lost:</strong> Extraction yields 0 chips banked, but awards Level XP to level up safely.</li>
                  <li><strong>Ideal for Warmups:</strong> Test new skins, practice steering, or warm up risk-free!</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* 3. STAR CHIPS & ORBS */}
          <Section
            icon={<Coins className="w-4 h-4" />}
            title="3. WHAT ARE STAR CHIPS & ORBS?"
            accent="text-amber-400"
          >
            <p>The arena floor contains two distinct types of collectible items:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li><strong>Glowing Orbs:</strong> Colorful energy nodes scattered across the map. Consuming orbs increases your snake&apos;s length and score.</li>
              <li><strong>Golden Star Chips:</strong> High-value golden star drops (<span className="text-amber-300 font-mono">#fbbf24</span>) that drop when an enemy or rival snake crashes and disintegrates. Collecting Star Chips increases your carried chip stomach balance!</li>
            </ul>
          </Section>

          {/* 4. EXTRACTION */}
          <Section
            icon={<Crosshair className="w-4 h-4" />}
            title="4. HOW EXTRACTION WORKS (HOW TO BANK EARNINGS)"
            accent="text-cyan-400"
          >
            <p>Extraction is how you safely secure your earnings and exit a match:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li><strong>Hold to Extract:</strong> Press and hold the <strong>E key</strong> (or hold the on-screen <strong>EXTRACT</strong> button).</li>
              <li><strong>3-Second Progress Meter:</strong> A radial meter counts down from 0% to 100% over 3 seconds.</li>
              <li><strong>Steering Interrupts Extraction:</strong> If you turn or steer your snake head while extracting, extraction cancels immediately! Maintain a straight line while holding extract.</li>
              <li><strong>Minimum Extraction Threshold:</strong> In Online Arenas, you must carry at least the tier&apos;s minimum required chips (e.g. 2,000c) before extraction unlocks.</li>
            </ul>
          </Section>

          {/* 5. GLOBAL FRIENDS, SEARCH & SYNDICATES */}
          <Section
            icon={<Globe className="w-4 h-4" />}
            title="5. GLOBAL FRIENDS, SEARCH & SYNDICATES"
            accent="text-indigo-400"
          >
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong>Global Search:</strong> Find rivals globally by Name or exact Tag (e.g. <code className="text-cyan-300 font-mono">#IND-8821</code>) and filter by country flags (🇮🇳 India, 🇺🇸 USA, 🇯🇵 Japan, 🇰🇷 South Korea, 🇬🇧 UK, etc.).</li>
              <li><strong>Daily Gifting:</strong> Send free +25 chip gifts to connected friends every 24 hours.</li>
              <li><strong>Spectate &amp; Invites:</strong> Click &quot;Spectate&quot; to watch a friend&apos;s active match live, or send match invites.</li>
              <li><strong>Syndicate Co-Op Codes:</strong> Create 6-digit lobby codes to join the same arena shard with allies.</li>
            </ul>
          </Section>

          {/* 6. FAQ */}
          <Section
            icon={<HelpCircle className="w-4 h-4" />}
            title="6. FREQUENTLY ASKED QUESTIONS (FAQ)"
            accent="text-purple-400"
          >
            <div className="space-y-2.5 text-slate-300">
              <div>
                <span className="font-bold text-white">Q: Do I lose my banked vault chips if I crash in a match?</span>
                <p className="text-slate-400 text-[11px] mt-0.5">A: No! Your Banked Vault chips are 100% safe. You only lose the buy-in chips carried inside that specific active match.</p>
              </div>
              <div>
                <span className="font-bold text-white">Q: Why did my extraction cancel?</span>
                <p className="text-slate-400 text-[11px] mt-0.5">A: Turning or steering your snake head while extracting cancels the 3-second meter. Hold still and glide straight while holding Extract!</p>
              </div>
              <div>
                <span className="font-bold text-white">Q: What is the 35% system commission?</span>
                <p className="text-slate-400 text-[11px] mt-0.5">A: In Online Arena Shards, extracting deducts a 35% arena transaction fee, banking 65% of all carried chips directly into your permanent vault.</p>
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-indigo-600/30"
          >
            Understood &amp; Ready to Play
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GameRulesModal;
