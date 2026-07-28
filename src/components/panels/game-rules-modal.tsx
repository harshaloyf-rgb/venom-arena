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

function InfoCard({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
      <span className={`font-bold ${accent} flex items-center gap-1.5 mb-1 text-xs`}>
        {title}
      </span>
      <div className="text-slate-400 text-[11px] leading-relaxed">{children}</div>
    </div>
  );
}

export function GameRulesModal({ open, onOpenChange }: GameRulesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

        <div className="p-6 overflow-y-auto va-scroll space-y-5 text-slate-300 text-xs leading-relaxed max-h-[calc(88vh-130px)]">
          {/* 1. CONTROLS */}
          <Section icon={<Gamepad className="w-4 h-4" />} title="1. CONTROLS" accent="text-cyan-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title={<><span className="text-cyan-400">🖱️</span> Mouse / Touch</>} accent="text-cyan-300">
                Move cursor to steer. Left-click or hold for Boost. On mobile, drag the joystick to steer — push far for boost.
              </InfoCard>
              <InfoCard title={<><span className="text-amber-400">⌨️</span> Keyboard</>} accent="text-amber-300">
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
                  <li><strong>Graduated Commission:</strong> 0% if ≤3 real players in arena, 35% if ≥4. Extract anytime — no minimum threshold.</li>
                  <li><strong>Full Death Penalty:</strong> Crashing loses 100% of carried match chips.</li>
                  <li><strong>Star Chips:</strong> Golden stars drop from killed real players. Collect to increase carried chips.</li>
                  <li><strong>XP:</strong> Earned on successful extraction only.</li>
                  <li><strong>Map:</strong> Circular boundary that breathes (expands/contracts). Stay inside!</li>
                  <li><strong>Bots:</strong> Per arena tier (25-60 bots). Self-destruct at score≥100.</li>
                </ul>
              </div>

              <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                  <Target className="w-3.5 h-3.5" /> Offline Practice (Risk-Free)
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li><strong>100% FREE:</strong> Zero chip cost to play. No buy-in required.</li>
                  <li><strong>1000 AI Bots:</strong> Always exactly 1000 bots of varied sizes in the arena.</li>
                  <li><strong>No Chips / Stars / XP:</strong> Score-only leaderboard. Practice without pressure.</li>
                  <li><strong>Infinite Map:</strong> No boundaries, no wall death. Roam freely in any direction.</li>
                  <li><strong>No Bot Self-Destruct:</strong> Bots just harvest food and dodge collisions.</li>
                  <li><strong>Ideal for Warmups:</strong> Test controls, practice strategies, learn collision mechanics.</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* 3. FOOD ORBS */}
          <Section icon={<Coins className="w-4 h-4" />} title="3. FOOD ORBS &amp; STAR CHIPS" accent="text-amber-400">
            <p>Two types of collectibles exist on the arena floor:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <InfoCard title={<><span className="text-emerald-400">🟢</span> Food Orbs (3 sizes)</>} accent="text-emerald-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Small:</strong> 1 point, green glow (most common — 60%)</li>
                  <li><strong>Medium:</strong> 3 points, blue glow (30% chance)</li>
                  <li><strong>Large:</strong> 5 points, pink glow (10% chance)</li>
                </ul>
                <p className="mt-1">Eating food increases your score and body length. ALL snakes (including bots) eat food orbs.</p>
              </InfoCard>
              <InfoCard title={<><Star className="w-3.5 h-3.5 text-amber-400 inline" /> Star Chips (golden)</>} accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Exactly <strong>10 stars</strong> drop when a real player dies</li>
                  <li>Each star = floor(chips/10), remainder to last star</li>
                  <li>Only <strong>real players</strong> can collect stars (bots ignore them)</li>
                  <li>Stars add to your <strong>carried chips</strong> (not score)</li>
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
                  <li>Hold Space / Left-click / Boost button to activate</li>
                  <li>Speed increases from 4.5 → 8.0 (nearly 2x faster)</li>
                  <li>Every ~2 seconds, your tail drops a <strong>small food orb</strong></li>
                  <li>Your snake <strong>shrinks</strong> by 1 segment per drop</li>
                  <li>Need more than 8 body segments to boost</li>
                </ul>
              </InfoCard>
              <InfoCard title="Strategy Tips" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Use boost to cut off rivals or escape danger</li>
                  <li>Boosting costs body mass — don&apos;t overuse!</li>
                  <li>Dropped food orbs can be collected by anyone</li>
                  <li>Boost does NOT give collision advantage vs steady snakes (except the smaller-vs-larger head-on rule)</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* 5. COLLISION SYSTEM */}
          <Section icon={<Crosshair className="w-4 h-4" />} title="5. COLLISION RULES" accent="text-rose-400">
            <div className="space-y-3">
              <InfoCard title="Head-to-Body Collision" accent="text-rose-300">
                If your head hits another snake&apos;s body, <strong>YOU die</strong>. Your entire body transforms into food orbs spread along your body path, plus 10 star chips (if you had carried chips). <strong>Neck protection:</strong> The first 5 segments behind a snake&apos;s head cannot kill — this prevents unfair &quot;neck touch&quot; deaths.
              </InfoCard>
              <InfoCard title="Head-on Collision (Head vs Head)" accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Neither boosting:</strong> Larger snake wins, smaller dies</li>
                  <li><strong>Smaller boosting, larger steady:</strong> Smaller survives! (boost advantage)</li>
                  <li><strong>Both boosting:</strong> Larger snake wins</li>
                  <li><strong>Tie (same score):</strong> Both snakes die</li>
                </ul>
              </InfoCard>
              <InfoCard title="Map Boundary (Online Only)" accent="text-emerald-300">
                Going outside the circular map boundary = instant death. Your carried chips are lost. No food orbs drop from map death, but stars still appear. The boundary gently breathes (expands/contracts).
              </InfoCard>
            </div>
          </Section>

          {/* 6. BOT AI */}
          <Section icon={<Bot className="w-4 h-4" />} title="6. BOT AI BEHAVIOR" accent="text-violet-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="Harvesting Mode (Normal)" accent="text-violet-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Seek nearest food orbs within scanning range</li>
                  <li>Dodge human players (predictive evasion — looks 8 ticks ahead)</li>
                  <li>Avoid body segments of all snakes (150px detection)</li>
                  <li>Turn away from map boundary if too close</li>
                  <li>Never boost, never collect stars</li>
                </ul>
              </InfoCard>
              <InfoCard title="Self-Destruct Mode (Online Only)" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Triggered when bot score reaches ≥100</li>
                  <li>Navigates <strong>toward</strong> the map wall slowly</li>
                  <li><strong>NEVER boosts</strong> during self-destruct</li>
                  <li>Still collects nearby food while heading to wall</li>
                  <li>Wall death = vanish cleanly (no food, no stars)</li>
                  <li>If killed by collision before reaching wall = still drops food</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* 7. MAP & SPAWNING */}
          <Section icon={<Map className="w-4 h-4" />} title="7. MAP &amp; SAFE SPAWNING" accent="text-emerald-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="Online Map" accent="text-emerald-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Circular arena boundary (breathes ±40px over 10s)</li>
                  <li>Radius scales with player count: 3000 (1 player) → 16000 (1000 players)</li>
                  <li>Going outside = death (no food drops, but stars appear)</li>
                </ul>
              </InfoCard>
              <InfoCard title="Offline Map" accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Infinite map</strong> — no boundaries, no wall death</li>
                  <li>Roam freely in any direction forever</li>
                  <li>Food respawns around the player&apos;s position</li>
                </ul>
              </InfoCard>
              <InfoCard title="Safe Spawning" accent="text-cyan-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>All players/bots spawn at least 500px from every other snake</li>
                  <li>At least 500px inside the map boundary (online)</li>
                  <li><strong>Spawn Protection:</strong> 4 seconds of invulnerability after spawning</li>
                  <li>Cannot be killed by body collision during protection (head-on still kills)</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* 8. EXTRACTION */}
          <Section icon={<Trophy className="w-4 h-4" />} title="8. HOW EXTRACTION WORKS" accent="text-amber-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="Extracting Your Chips" accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Hold <strong>E key</strong> or the <strong>EXTRACT</strong> button</li>
                  <li>3-second progress bar — must hold still</li>
                  <li><strong>Steering cancels</strong> extraction immediately</li>
                  <li>Extract <strong>anytime</strong> — no minimum chip threshold</li>
                  <li>Extract <strong>anywhere</strong> on the map — no zone restriction</li>
                </ul>
              </InfoCard>
              <InfoCard title="Commission System" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>≤3 real players in arena:</strong> 0% commission (keep 100% of carried chips)</li>
                  <li><strong>≥4 real players in arena:</strong> 35% commission (keep 65%)</li>
                  <li>Commission is displayed on the HUD in real-time</li>
                  <li>Extracted chips go to your permanent banked vault</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* 9. DEATH & REPLAY */}
          <Section icon={<Skull className="w-4 h-4" />} title="9. DEATH &amp; REPLAY SYSTEM" accent="text-rose-400">
            <div className="space-y-3">
              <InfoCard title="When You Die" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Your body transforms into food orbs <strong>spread along your entire body path</strong></li>
                  <li>Food orb values (Small/Medium/Large) sum to exactly your total score</li>
                  <li>10 golden star chips appear if you had carried chips</li>
                  <li>Any nearby snake (bot or player) can collect your dropped food/stars</li>
                  <li>If killed by a real player: View Profile, Add Friend, Add Rival buttons appear</li>
                </ul>
              </InfoCard>
              <InfoCard title="Death Replay (15s Before + 15s After)" accent="text-cyan-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Replay starts 15 seconds before your death (circular buffer)</li>
                  <li>Continues 15 seconds AFTER death (shows food being collected)</li>
                  <li>Camera follows you before death, then stays on your death food</li>
                  <li>Camera switches to follow the first entity collecting your death food (spectator mode)</li>
                  <li>Controls: Play/Pause, Speed (0.25x–2x), Zoom, Restart</li>
                  <li>Progress bar with death marker shows exact moment of death</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* 10. FAQ */}
          <Section icon={<AlertTriangle className="w-4 h-4" />} title="10. FREQUENTLY ASKED QUESTIONS" accent="text-purple-400">
            <div className="space-y-2.5">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-bold text-white">Q: Do I lose my banked vault chips if I crash?</span>
                <p className="text-slate-400 text-[11px] mt-0.5">A: No! Your banked vault chips are 100% safe. You only lose the buy-in chips carried in that specific match.</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-bold text-white">Q: What is the graduated commission?</span>
                <p className="text-slate-400 text-[11px] mt-0.5">A: If ≤3 real players are in the arena, extraction is FREE (0% commission). If ≥4 real players, a 35% commission applies (you keep 65%). The rate is shown live on your HUD.</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-bold text-white">Q: Why did my extraction cancel?</span>
                <p className="text-slate-400 text-[11px] mt-0.5">A: Turning or steering while extracting cancels the 3-second channel. Hold still and glide straight!</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-bold text-white">Q: Can I extract at any time?</span>
                <p className="text-slate-400 text-[11px] mt-0.5">A: Yes! There is no minimum chip threshold and no zone restriction. Hold E or the Extract button from anywhere on the map.</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-bold text-white">Q: What happens to bots that reach score 100?</span>
                <p className="text-slate-400 text-[11px] mt-0.5">A: (Online only) Bots enter self-destruct mode: they slowly navigate toward the wall without boosting, collecting food on the way. When they hit the wall, they vanish without dropping anything.</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-bold text-white">Q: Is this gambling?</span>
                <p className="text-slate-400 text-[11px] mt-0.5">A: No. Chips are free in-game soft currency. They have no real-world value and cannot be cashed out. The &quot;buy-in&quot; is a gameplay risk mechanic, not a wager.</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-bold text-white">Q: How does anti-cheat work?</span>
                <p className="text-slate-400 text-[11px] mt-0.5">A: The server is authoritative. All chip creation, food eating, collisions, and extraction are computed server-side. The client only sends steering input (angle + boost).</p>
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-emerald-600/30"
          >
            Understood &amp; Ready to Play
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GameRulesModal;
