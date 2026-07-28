'use client';

/**
 * Venom Arena — Official Guide, Rules & FAQ modal.
 *
 * Comprehensive rules page covering ALL game mechanics, modes,
 * food, stars, collision, boost, bot AI, map, extraction, and FAQ.
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
  Target,
  Map,
  Bot,
  Star,
  Crosshair,
  Gamepad,
} from 'lucide-react';

interface GameRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GameRulesModal({ isOpen, onClose }: GameRulesModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 max-w-3xl max-h-[88vh] p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-slate-800/80 bg-slate-900/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-white tracking-tight">
                VENOM ARENA — OFFICIAL GUIDE &amp; RULES
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Controls, modes, food, collision, boost, bot AI, extraction &amp; FAQ
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto va-scroll max-h-[calc(88vh-130px)]">
          {/* HERO */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-950/50 border border-emerald-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <span className="text-[10px] text-emerald-400 font-mono font-bold tracking-widest block uppercase">
              Core Loop
            </span>
            <h3 className="text-lg font-black text-white mt-1">
              Hunt. Harvest. Extract. Don&apos;t get caught.
            </h3>
            <p className="text-xs text-slate-300 font-sans mt-2 leading-relaxed">
              You spawn as a small venom snake. Grow by harvesting food orbs and the star-chip trails of fallen rivals.
              The bigger you are, the more chips you carry — but also the easier you are to cut off.
              Bank your winnings by extracting before someone makes you their harvest.
            </p>
          </div>

          {/* 1. CONTROLS */}
          <Section icon={<Gamepad className="w-4 h-4" />} title="1. CONTROLS" accent="text-cyan-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="🖱️ Mouse / Touch" accent="text-cyan-300">
                Move cursor to steer. Left-click or hold for Boost. On mobile, drag the joystick — push far for boost.
              </InfoCard>
              <InfoCard title="⌨️ Keyboard" accent="text-amber-300">
                WASD or Arrow Keys to steer. Hold Space/Shift for Boost. Hold E for Extract.
              </InfoCard>
            </div>
          </Section>

          {/* 2. ONLINE vs OFFLINE */}
          <Section icon={<Users className="w-4 h-4" />} title="2. ONLINE MULTIPLAYER VS. OFFLINE PRACTICE" accent="text-emerald-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                  <Users className="w-3.5 h-3.5" /> Online Arena (High Stakes)
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li><strong>Chip Buy-In:</strong> Deducts buy-in from your banked vault into carried match chips.</li>
                  <li><strong>Real Players:</strong> Live PvP with real opponents and leaderboard rankings.</li>
                  <li><strong>Graduated Commission:</strong> 0% if ≤3 real players, 35% if ≥4. Extract anytime.</li>
                  <li><strong>Full Death Penalty:</strong> Crashing loses 100% of carried match chips.</li>
                  <li><strong>Star Chips:</strong> Golden stars drop from killed real players. Collect to increase carried chips.</li>
                  <li><strong>XP:</strong> Earned on successful extraction only.</li>
                  <li><strong>Map:</strong> Circular boundary that breathes. Stay inside!</li>
                  <li><strong>Bots:</strong> Per arena tier (25-60). Self-destruct at score≥100.</li>
                </ul>
              </div>

              <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                  <Target className="w-3.5 h-3.5" /> Offline Practice (Risk-Free)
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li><strong>100% FREE:</strong> Zero chip cost. No buy-in.</li>
                  <li><strong>1000 AI Bots:</strong> Always exactly 1000 bots of varied sizes.</li>
                  <li><strong>No Chips / Stars / XP:</strong> Score-only leaderboard.</li>
                  <li><strong>Infinite Map:</strong> No boundaries, no wall death.</li>
                  <li><strong>No Bot Self-Destruct:</strong> Bots just harvest and dodge.</li>
                  <li><strong>Ideal for Warmups:</strong> Practice without pressure.</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* 3. FOOD ORBS */}
          <Section icon={<Coins className="w-4 h-4" />} title="3. FOOD ORBS &amp; STAR CHIPS" accent="text-amber-400">
            <p className="mb-2">Two types of collectibles exist on the arena floor:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="🟢 Food Orbs (3 sizes)" accent="text-emerald-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Small:</strong> 1 point, green glow (60% chance)</li>
                  <li><strong>Medium:</strong> 3 points, blue glow (30% chance)</li>
                  <li><strong>Large:</strong> 5 points, pink glow (10% chance)</li>
                </ul>
                <p className="mt-1">Eating food increases score and body length. ALL snakes eat food orbs.</p>
              </InfoCard>
              <InfoCard title={<><Star className="w-3.5 h-3.5 text-amber-400 inline" /> Star Chips (golden)</>} accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Exactly <strong>10 stars</strong> drop when a real player dies</li>
                  <li>Each star = floor(chips/10), remainder to last star</li>
                  <li>Only <strong>real players</strong> collect stars (bots ignore)</li>
                  <li>Stars add to <strong>carried chips</strong> (not score)</li>
                  <li>Bots <strong>never</strong> drop stars on death</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* 4. BOOST */}
          <Section icon={<Zap className="w-4 h-4" />} title="4. BOOST MECHANIC" accent="text-cyan-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="How Boost Works" accent="text-cyan-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Hold Space / Left-click / Boost button</li>
                  <li>Speed: 4.5 → 8.0 (nearly 2x faster)</li>
                  <li>Every ~2s, tail drops a <strong>small food orb</strong></li>
                  <li>Snake <strong>shrinks</strong> by 1 segment per drop</li>
                  <li>Need &gt;8 body segments to boost</li>
                </ul>
              </InfoCard>
              <InfoCard title="Strategy Tips" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Use to cut off rivals or escape danger</li>
                  <li>Boosting costs body mass — don&apos;t overuse!</li>
                  <li>Dropped food orbs can be collected by anyone</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* 5. COLLISION RULES */}
          <Section icon={<Crosshair className="w-4 h-4" />} title="5. COLLISION RULES" accent="text-rose-400">
            <div className="space-y-3">
              <InfoCard title="Head-to-Body Collision" accent="text-rose-300">
                If your head hits another snake&apos;s body, <strong>YOU die</strong>. Your body transforms into food orbs spread along your body path + 10 star chips (if you had chips).
                <strong>Neck protection:</strong> First 5 segments behind a head cannot kill (prevents unfair &quot;neck touch&quot;).
              </InfoCard>
              <InfoCard title="Head-on Collision (Head vs Head)" accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Neither boosting:</strong> Larger wins, smaller dies</li>
                  <li><strong>Smaller boosting, larger steady:</strong> Smaller survives!</li>
                  <li><strong>Both boosting:</strong> Larger wins</li>
                  <li><strong>Tie:</strong> Both die</li>
                </ul>
              </InfoCard>
              <InfoCard title="Map Boundary (Online Only)" accent="text-emerald-300">
                Going outside the circular map = instant death. Carried chips lost. No food orbs drop, but stars still appear. Boundary gently breathes (±40px).
              </InfoCard>
            </div>
          </Section>

          {/* 6. BOT AI */}
          <Section icon={<Bot className="w-4 h-4" />} title="6. BOT AI BEHAVIOR" accent="text-violet-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="Harvesting Mode" accent="text-violet-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Seek nearest food orbs</li>
                  <li>Dodge players (predictive — 8 ticks ahead)</li>
                  <li>Avoid body segments (150px range)</li>
                  <li>Turn away from map boundary</li>
                  <li>Never boost, never collect stars</li>
                </ul>
              </InfoCard>
              <InfoCard title="Self-Destruct (Online Only)" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Triggered at score ≥100</li>
                  <li>Navigate <strong>toward</strong> wall slowly</li>
                  <li><strong>NEVER boost</strong></li>
                  <li>Still collect food on the way</li>
                  <li>Wall death = vanish cleanly (0 food, 0 stars)</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* 7. MAP & SPAWNING */}
          <Section icon={<Map className="w-4 h-4" />} title="7. MAP &amp; SAFE SPAWNING" accent="text-emerald-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="Online Map" accent="text-emerald-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Circular arena (breathes ±40px over 10s)</li>
                  <li>Radius: 3000 (1 player) → 16000 (1000 players)</li>
                  <li>Outside boundary = death</li>
                </ul>
              </InfoCard>
              <InfoCard title="Offline Map" accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Infinite</strong> — no boundaries, no wall death</li>
                  <li>Roam freely in any direction</li>
                </ul>
              </InfoCard>
              <InfoCard title="Safe Spawning" accent="text-cyan-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>500px from every other snake</li>
                  <li>500px inside map boundary (online)</li>
                  <li><strong>4s spawn protection</strong> (invulnerable)</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* 8. EXTRACTION */}
          <Section icon={<Trophy className="w-4 h-4" />} title="8. EXTRACTION" accent="text-amber-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="How to Extract" accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Hold <strong>E key</strong> or <strong>EXTRACT</strong> button</li>
                  <li>3-second progress bar — must hold still</li>
                  <li><strong>Steering cancels</strong> immediately</li>
                  <li>Extract <strong>anytime</strong> — no minimum threshold</li>
                  <li>Extract <strong>anywhere</strong> — no zone restriction</li>
                </ul>
              </InfoCard>
              <InfoCard title="Commission" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>≤3 real players:</strong> 0% (keep 100%)</li>
                  <li><strong>≥4 real players:</strong> 35% (keep 65%)</li>
                  <li>Rate shown live on HUD</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* 9. DEATH & REPLAY */}
          <Section icon={<Skull className="w-4 h-4" />} title="9. DEATH &amp; REPLAY" accent="text-rose-400">
            <div className="space-y-3">
              <InfoCard title="When You Die" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Body transforms to food orbs <strong>spread along your body path</strong></li>
                  <li>Food values sum to exactly your total score</li>
                  <li>10 golden star chips if you had carried chips</li>
                  <li>Anyone can collect your dropped food/stars</li>
                  <li>Killed by real player → View Profile / Add Friend / Add Rival</li>
                </ul>
              </InfoCard>
              <InfoCard title="Death Replay (15s Before + 15s After)" accent="text-cyan-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>15s before death (circular buffer)</li>
                  <li>15s after death (shows food being collected)</li>
                  <li>Camera stays on death food, then follows first collector</li>
                  <li>Controls: Play/Pause, Speed, Zoom, Restart</li>
                  <li>Progress bar with death marker</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* 10. FAQ */}
          <Section icon={<AlertTriangle className="w-4 h-4" />} title="10. FAQ" accent="text-purple-400">
            <div className="flex flex-col gap-2.5">
              <FaqItem q="Do I lose my banked vault chips if I crash?" a="No! Your banked vault chips are 100% safe. You only lose the buy-in chips carried in that specific match." />
              <FaqItem q="What is the graduated commission?" a="If ≤3 real players are in the arena, extraction is FREE (0%). If ≥4 real players, 35% commission applies (you keep 65%)." />
              <FaqItem q="Why did my extraction cancel?" a="Turning or steering while extracting cancels the 3-second channel. Hold still and glide straight!" />
              <FaqItem q="Can I extract at any time?" a="Yes! No minimum chip threshold and no zone restriction. Extract from anywhere on the map." />
              <FaqItem q="What happens to bots at score 100?" a="(Online only) They enter self-destruct: slowly navigate toward the wall without boosting, collecting food on the way. Wall death = vanish cleanly." />
              <FaqItem q="Is this gambling?" a="No. Chips are free in-game soft currency with no real-world value. The buy-in is a gameplay risk mechanic, not a wager." />
              <FaqItem q="How does anti-cheat work?" a="Server is authoritative. All chip creation, food eating, collisions, extraction computed server-side. Client only sends steering input." />
            </div>
          </Section>

          {/* FOOTER */}
          <div className="text-center text-[10px] font-mono text-slate-500 uppercase tracking-widest pt-2 border-t border-slate-800/60">
            Play responsibly · Chips have no real-world value · Stores-safe edition
          </div>
        </div>

        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-emerald-600/30"
          >
            Understood &amp; Ready to Play
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, accent, children }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
      <h3 className={`flex items-center gap-2 font-bold text-sm ${accent}`}>
        {icon} {title}
      </h3>
      <div className="text-slate-300 text-xs leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function InfoCard({ title, accent, children }: { title: React.ReactNode; accent: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
      <span className={`font-bold ${accent} block text-xs mb-1`}>{title}</span>
      <div className="text-slate-400 text-[11px] leading-relaxed">{children}</div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
      <h4 className="text-xs font-bold text-white">
        <span className="text-emerald-400 font-mono mr-1.5">Q.</span>{q}
      </h4>
      <p className="text-[11.5px] text-slate-400 mt-1.5 leading-relaxed pl-5">{a}</p>
    </div>
  );
}

export default GameRulesModal;
