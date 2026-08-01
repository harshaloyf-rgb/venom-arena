'use client';

/**
 * Venom Arena — Official Guide, Rules & FAQ modal.
 *
 * Comprehensive rules page covering ALL game mechanics, modes,
 * food, stars, collision, boost, bot AI, map, extraction, challenges,
 * HUD, lobby leaderboards, milestone badges, and FAQ.
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
  Landmark,
  LogIn,
  ListTodo,
  Crown,
  Globe,
  Medal,
} from 'lucide-react';
import { ARENA_TIERS, PRACTICE_TIERS, MILESTONE_TIERS } from '@/lib/game-config';

// ── Short-form chip formatter for tier tables ──
function fmtShort(n: number): string {
  if (n === 0) return 'FREE';
  const full = `${n.toLocaleString()}c`;
  if (n >= 1_000_000_000) return `${full} (${(n / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Bc)`;
  if (n >= 1_000_000) return `${full} (${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Mc)`;
  if (n >= 1_000) return `${full} (${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Kc)`;
  return full;
}

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
                Accounts, controls, modes, arena tiers, HUD, extraction, challenges, death, replay, leaderboards &amp; FAQ
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
              You spawn as a small venom snake. Grow by harvesting food orbs for score/size, and collect star chips from fallen rivals to increase your carried chips.
              The bigger you are, the more dangerous you become — but also the easier to cut off.
              Bank your winnings by extracting before someone makes you their harvest.
            </p>
          </div>

          {/* ================================================================= */}
          {/* 0. ACCOUNTS & GETTING STARTED */}
          {/* ================================================================= */}
          <Section icon={<Landmark className="w-4 h-4" />} title="0. ACCOUNTS &amp; GETTING STARTED" accent="text-emerald-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                  <LogIn className="w-3.5 h-3.5" /> Register (Recommended)
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li>Choose a <strong>display name</strong> (up to 20 chars)</li>
                  <li>Enter a valid <strong>email</strong> + password (min 6 chars)</li>
                  <li>Set a <strong>4-digit Security PIN</strong> (needed for password recovery)</li>
                  <li>Receive a unique <strong>VENOM-XXXX</strong> tag (your permanent ID)</li>
                  <li>Start with <strong>150 starter chips</strong> (free!)</li>
                  <li>Your progress is <strong>saved permanently</strong></li>
                </ul>
              </div>
              <div className="bg-violet-950/20 border border-violet-500/30 p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-violet-300 flex items-center gap-1.5 text-xs">
                  <Globe className="w-3.5 h-3.5" /> Social Login
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li>Sign in with <strong>Google</strong>, <strong>Facebook</strong>, or <strong>Apple</strong></li>
                  <li>No password needed — uses your existing account</li>
                  <li>Also starts with <strong>150 starter chips</strong> and a VENOM-XXXX tag</li>
                  <li>If your social email matches an existing account, it <strong>links automatically</strong></li>
                  <li>You can also set a password later in Profile → Security Settings</li>
                </ul>
              </div>
              <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                  <Shield className="w-3.5 h-3.5" /> Guest Play
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li><strong>No email needed</strong> — one-click to play</li>
                  <li>Also starts with <strong>150 starter chips</strong></li>
                  <li>Gets a random VENOM-XXXX tag</li>
                  <li>Guest accounts can <strong>upgrade to registered</strong> later (in Profile panel)</li>
                  <li>All progress carries over when upgrading</li>
                </ul>
              </div>
            </div>
            <InfoCard title="Chip Economy Basics" accent="text-amber-300">
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Chips are <strong>free in-game currency</strong> — no real-world value</li>
                <li>Start with 150 chips. Earn more by: extracting from arenas, daily login rewards, chip store, or gifting from friends (+25 per friend)</li>
                <li>Buy into arenas costs chips. If you die, you lose your carried chips. If you extract, you bank them!</li>
                <li>Need more chips? Visit the Chip Store (free packs) or claim Daily Rewards</li>
              </ul>
            </InfoCard>
            <InfoCard title="🔑 Password Recovery (Forgot Password)" accent="text-cyan-300">
              <ul className="list-disc pl-4 space-y-0.5">
                <li>On the Login page, click <strong>&quot;Forgot Password?&quot;</strong></li>
                <li>Enter your <strong>registered email</strong> and your <strong>4-digit Security PIN</strong></li>
                <li>Set a new password (min 6 chars) and confirm it</li>
                <li>Your password is updated instantly — no email verification needed</li>
                <li><strong>Important:</strong> If you didn&apos;t set a Security PIN during registration, password recovery is not available. Contact support or set a PIN in Profile → Security Settings before you forget your password!</li>
              </ul>
            </InfoCard>
            <InfoCard title="🔒 Managing Your Security PIN" accent="text-emerald-300">
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Your PIN is set during <strong>registration</strong> (optional but recommended)</li>
                <li>Change or set your PIN anytime in <strong>Profile → Security Settings</strong></li>
                <li>If you already have a PIN, you must enter your current PIN before setting a new one</li>
                <li>The PIN is your <strong>only recovery method</strong> — memorize it or store it securely</li>
                <li>Guest accounts cannot set a PIN (they have no password to recover)</li>
              </ul>
            </InfoCard>
          </Section>

          {/* ================================================================= */}
          {/* 1. CONTROLS */}
          {/* ================================================================= */}
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

          {/* ================================================================= */}
          {/* 2. ONLINE vs OFFLINE */}
          {/* ================================================================= */}
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
                  <li><strong>Full Death Penalty:</strong> On death, your carried chips transform into 10 stars at your last position for others to collect.</li>
                  <li><strong>Star Chips:</strong> Golden stars dropped when real players die. Each star = player&apos;s carried chips ÷ 10. Collect to increase your carried chips.</li>
                  <li><strong>XP:</strong> Earned on successful extraction only.</li>
                  <li><strong>Map:</strong> Circular boundary that breathes. Stay inside!</li>
                  <li><strong>Bots:</strong> 30 bots per tier. Self-destruct at score≥100. Bots never drop or collect stars.</li>
                </ul>
              </div>

              <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                  <Target className="w-3.5 h-3.5" /> Offline Practice (Risk-Free)
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li><strong>100% FREE:</strong> Zero chip cost. No buy-in.</li>
                  <li><strong>AI Bots:</strong> 1,000 AI bots of varied sizes.</li>
                  <li><strong>No Chips / Stars / XP:</strong> Score-based leaderboard (body length), no chip economy</li>
                  <li><strong>Infinite Map:</strong> No boundaries, no wall death.</li>
                  <li><strong>No Bot Self-Destruct:</strong> Bots just harvest and dodge.</li>
                  <li><strong>Ideal for Warmups:</strong> Practice without pressure.</li>
                </ul>
              </div>
            </div>

            <InfoCard title="🏆 Arena Leaderboard: Online vs Offline" accent="text-yellow-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-2.5 space-y-1">
                  <span className="font-bold text-emerald-300 text-[11px]">Online Arena Leaderboard</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                    <li><strong>Who appears:</strong> Real players only (no bots)</li>
                    <li><strong>Sorted by:</strong> Carried Chips (highest first)</li>
                    <li><strong>Value shown:</strong> Carried chips in green (e.g., &quot;100c&quot;)</li>
                    <li><strong>Your entry:</strong> Highlighted with indigo background + &quot;YOU&quot; badge</li>
                    <li><strong>Country flags:</strong> ✅ Shown next to each player name</li>
                    <li><strong>Ranking format:</strong> &quot;#X of Y&quot; (e.g., &quot;#1 of 3&quot;)</li>
                    <li><strong>Empty state:</strong> Shows &quot;No real players yet.&quot;</li>
                  </ul>
                </div>
                <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-2.5 space-y-1">
                  <span className="font-bold text-amber-300 text-[11px]">Offline Practice Leaderboard</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                    <li><strong>Who appears:</strong> You + nearby active bots (top 10)</li>
                    <li><strong>Sorted by:</strong> Score / body length (highest first)</li>
                    <li><strong>Value shown:</strong> Score in indigo (e.g., &quot;42&quot;)</li>
                    <li><strong>Your entry:</strong> Highlighted with green background</li>
                    <li><strong>Country flags:</strong> ❌ Not shown</li>
                    <li><strong>Ranking format:</strong> &quot;#X&quot; only (e.g., &quot;#31&quot;)</li>
                    <li><strong>Always populated:</strong> Player + bots always visible</li>
                  </ul>
                </div>
              </div>
            </InfoCard>
          </Section>

          {/* ================================================================= */}
          {/* ARENA TIERS REFERENCE TABLE */}
          {/* ================================================================= */}
          <InfoCard title="⚔️ Arena Tiers — 30 Competitive Tiers (10c → 1B)" accent="text-indigo-300">
            <div className="overflow-x-auto mt-1">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-left py-1 pr-2">#</th>
                    <th className="text-left py-1 pr-2">Tier</th>
                    <th className="text-left py-1 pr-2">Buy-In</th>
                    <th className="text-left py-1 pr-2">Bots</th>
                    <th className="text-left py-1 pr-2">XP Multi</th>
                    <th className="text-left py-1">Difficulty</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {ARENA_TIERS.map((tier, i, arr) => (
                    <tr key={tier.id} className={i < arr.length - 1 ? 'border-b border-slate-900' : ''}>
                      <td className="py-1 pr-2 font-bold" style={{ color: tier.accentColor }}>#{i + 1}</td>
                      <td className="py-1 pr-2 font-bold" style={{ color: tier.accentColor }}>{tier.name}</td>
                      <td className="py-1 pr-2">{fmtShort(tier.buyIn)}</td>
                      <td className="py-1 pr-2">{tier.botsCount}</td>
                      <td className="py-1 pr-2 text-indigo-300">x{tier.rewardMultiplier}</td>
                      <td className="py-1">{tier.difficulty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </InfoCard>

          <InfoCard title="🎯 Practice Tiers (3 Free Tiers — 1,000 Bots Each)" accent="text-amber-300">
            <div className="overflow-x-auto mt-1">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-left py-1 pr-2">Tier</th>
                    <th className="text-left py-1 pr-2">Buy-In</th>
                    <th className="text-left py-1 pr-2">Bots</th>
                    <th className="text-left py-1 pr-2">XP Multi</th>
                    <th className="text-left py-1">Difficulty</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {PRACTICE_TIERS.map((tier, i, arr) => (
                    <tr key={tier.id} className={i < arr.length - 1 ? 'border-b border-slate-900' : ''}>
                      <td className="py-1 pr-2 font-bold" style={{ color: tier.accentColor }}>{tier.name}</td>
                      <td className="py-1 pr-2 text-emerald-300">FREE</td>
                      <td className="py-1 pr-2">{tier.botsCount}</td>
                      <td className="py-1 pr-2 text-slate-500">x{tier.rewardMultiplier}</td>
                      <td className="py-1">{tier.difficulty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </InfoCard>

          {/* ================================================================= */}
          {/* 3. FOOD ORBS & STAR CHIPS */}
          {/* ================================================================= */}
          <Section icon={<Coins className="w-4 h-4" />} title="3. FOOD ORBS &amp; STAR CHIPS" accent="text-amber-400">
            <p className="mb-2">Two types of collectibles exist on the arena floor:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="🟢 Food Orbs (3 sizes)" accent="text-emerald-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Small:</strong> 1 point, green glow (93% chance — very common)</li>
                  <li><strong>Medium:</strong> 3 points, blue glow (4% chance)</li>
                  <li><strong>Large:</strong> 5 points, pink glow (3% chance — rare)</li>
                </ul>
                <p className="mt-1">Eating food increases score and body length. Growth rate is 1/4 of food value. ALL snakes eat food orbs. Food orbs do NOT affect carried chips.</p>
              </InfoCard>
              <InfoCard title="💀 Death Food Orbs (Body Drop)" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>When any snake (bot or player) dies from <strong>collision</strong>, their body transforms into food orbs <strong>scattered along the body path</strong>.</li>
                  <li>Total food value = the dead snake&apos;s <strong>entire score</strong>, broken into S/M/L orbs.</li>
                  <li><strong>Large (5pts, pink):</strong> score ÷ 5. <strong>Medium (3pts, blue):</strong> remainder ÷ 3. <strong>Small (1pt, green):</strong> whatever&apos;s left.</li>
                  <li><strong>Example:</strong> A snake with score 23 dies → 4 large (4×5=20), 1 medium (1×3=3), 0 small. Total = 23 ✓</li>
                  <li><strong>ALL snakes</strong> (players + bots) can eat death food → increases score/size only.</li>
                  <li><strong>Wall death:</strong> NO food orbs drop at all (score is destroyed to prevent edge farming).</li>
                  <li>Death food orbs are <strong>completely separate from stars</strong> — food affects score/size, stars affect carried chips.</li>
                </ul>
              </InfoCard>
              <InfoCard title={<><Star className="w-3.5 h-3.5 text-amber-400 inline" /> Star Chips (Chip Fragments from Death)</>} accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>A player enters the arena with their <strong>buy-in chips</strong>. During the match, collecting stars from dead opponents increases their <strong>carried chips</strong> (buy-in + star value collected). This total is shown above the player&apos;s head.</li>
                  <li><strong>Carried Chips</strong> = buy-in chips + collected star value. Food orbs and boost do NOT affect carried chips — they only affect score and size.</li>
                  <li>When a <strong>real player dies</strong>, their carried chips transform into exactly <strong>10 stars</strong> at the player&apos;s last position. Stars do NOT scatter or spread on the map.</li>
                  <li>Each star&apos;s value = <strong>carried chips ÷ 10</strong>. All 10 stars have the same value.</li>
                  <li><strong>Example:</strong> If your carried chips are <strong>275c</strong> when you die → each star = 275 ÷ 10 = <strong>27.5c</strong>. 10 stars × 27.5c = 275c total.</li>
                  <li>Only <strong>real players</strong> can collect stars. Bots cannot see, touch, or collect stars.</li>
                  <li>Collecting a star adds its chip value to your <strong>carried chips</strong> (not score).</li>
                  <li>Bots <strong>never</strong> drop stars on death — they vanish cleanly.</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* ================================================================= */}
          {/* 4. BOOST MECHANIC */}
          {/* ================================================================= */}
          <Section icon={<Zap className="w-4 h-4" />} title="4. BOOST MECHANIC" accent="text-cyan-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="How Boost Works" accent="text-cyan-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Hold Space / Left-click / Boost button</li>
                  <li>Speed: 4.5 → 8.0 (nearly 2x faster)</li>
                  <li>~3 times per second, tail drops a <strong>food orb</strong> (continuous trail)</li>
                  <li>Snake <strong>shrinks</strong> by 1 segment per drop</li>
                  <li>Need &gt;8 body segments to boost</li>
                  <li><strong>Earned mass required:</strong> Must have eaten food first (score above starting score)</li>
                </ul>
              </InfoCard>
              <InfoCard title="Strategy Tips" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Use to cut off rivals or escape danger</li>
                  <li>Boosting burns earned mass faster than eating grows it</li>
                  <li>Dropped food orbs can be collected by anyone</li>
                  <li>Cannot boost at starting score — eat food first!</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* ================================================================= */}
          {/* 5. COLLISION RULES */}
          {/* ================================================================= */}
          <Section icon={<Crosshair className="w-4 h-4" />} title="5. COLLISION RULES" accent="text-rose-400">
            <div className="space-y-3">
              <InfoCard title="Head-to-Body Collision" accent="text-rose-300">
                If your head hits another snake&apos;s body, <strong>YOU die</strong>. Your body transforms into food orbs spread along your body path. If you had carried chips, <strong>10 stars</strong> appear at your last position.
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
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Going outside the circular map = <strong>instant death</strong>. Boundary gently breathes (±40px).</li>
                  <li><strong>Food Orbs:</strong> NONE — score is completely destroyed (prevents edge farming).</li>
                  <li><strong>Stars:</strong> YES — if player had carried chips &gt; 0, exactly <strong>10 stars</strong> drop at death position. Other players can collect them.</li>
                  <li><strong>Player loses everything:</strong> Both score and carried chips are gone.</li>
                  <li><strong>Bot wall death:</strong> Vanish cleanly — 0 food, 0 stars (bots never carry chips).</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* ================================================================= */}
          {/* 6. BOT AI BEHAVIOR */}
          {/* ================================================================= */}
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

          {/* ================================================================= */}
          {/* 7. MAP & SAFE SPAWNING */}
          {/* ================================================================= */}
          <Section icon={<Map className="w-4 h-4" />} title="7. MAP &amp; SAFE SPAWNING" accent="text-emerald-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="Online Map" accent="text-emerald-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Circular arena (breathes ±40px over 10s)</li>
                  <li>Radius scales with player count</li>
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

          {/* ================================================================= */}
          {/* 8. EXTRACTION */}
          {/* ================================================================= */}
          <Section icon={<Trophy className="w-4 h-4" />} title="8. EXTRACTION" accent="text-amber-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="How to Extract" accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Hold <strong>E key</strong> or <strong>EXTRACT</strong> button</li>
                  <li>3-second progress bar — forward gliding is allowed</li>
                  <li><strong>Steering restarts progress to 0%</strong> — you can glide forward naturally, but any direction change (even slight) resets the timer</li>
                  <li>A white-to-green <strong>progress ring</strong> appears near your snake head — <strong>only visible to you</strong>, other players cannot see it</li>
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
            <InfoCard title="Extraction UI Elements" accent="text-cyan-300">
              <ul className="list-disc pl-4 space-y-0.5">
                <li><strong>Top-center hint:</strong> &quot;Hold E or press the button below to cash out safely!&quot; — always visible while playing</li>
                <li><strong>Progress popup:</strong> When extracting, a bar fills 0→100% with amber gradient. Commission rate shown below</li>
                <li><strong>Movement flash:</strong> If you move during extraction, a red &quot;⚠ MOVEMENT DETECTED — Extraction restarted!&quot; warning flashes</li>
                <li><strong>EXTRACT button:</strong> Bottom-right circular button (80px). Shows percentage while extracting, turns green when active</li>
                <li><strong>BOOST button:</strong> Adjacent circular button (64px, amber). Hold to boost. Must have 8+ body segments and earned mass</li>
              </ul>
            </InfoCard>
          </Section>

          {/* ================================================================= */}
          {/* 9. IN-GAME HUD EXPLAINED */}
          {/* ================================================================= */}
          <Section icon={<Gamepad className="w-4 h-4" />} title="9. IN-GAME HUD EXPLAINED" accent="text-indigo-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="Top-Left: Status Cards" accent="text-emerald-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Carried Chips (online only):</strong> Green card showing total carried chips with &quot;c&quot; suffix. Starts at buy-in amount, increases when you collect star chips from dead players. Hidden in offline mode</li>
                  <li><strong>Stars Earned (online only):</strong> Amber card showing extra chips earned from collecting star collectibles (Carried Chips − Buy-In)</li>
                  <li><strong>Stars in Arena (online only):</strong> Shows how many golden star collectibles are currently on the arena floor (drops when real players die, decreases when collected)</li>
                  <li><strong>Rank:</strong> Yellow trophy icon + arena rank number</li>
                  <li><strong>Score:</strong> Purple shield icon + snake body length</li>
                  <li><strong>Kills:</strong> Red skull icon + opponents eliminated</li>
                  <li><strong>Boost:</strong> Amber zap icon + &quot;SPACE&quot; reminder</li>
                  <li><strong>Active Competitors:</strong> &quot;Real Players: N Active&quot; (pulsing indigo) or &quot;Offline Mode: 1 Player&quot; (amber)</li>
                </ul>
              </InfoCard>
              <InfoCard title="Top-Right: Network &amp; Leaderboard" accent="text-cyan-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Banked Chips:</strong> Amber card showing vault balance (deducts buy-in on match start)</li>
                  <li><strong>FPS / Ping:</strong> Frames per second + latency in ms. Color-coded. &quot;LQ&quot; badge if low quality</li>
                  <li><strong>Chat / Minimap:</strong> Below banked card. Chat opens message dialog. Minimap toggles radar</li>
                  <li><strong>Arena Leaders (Online):</strong> Collapsible top-10 leaderboard of real players only. Sorted by carried chips (e.g., &quot;100c&quot; in green). Shows player name, country flag, carried chips. Your entry highlighted with &quot;YOU&quot; badge in indigo. Shows &quot;No real players yet.&quot; if you&apos;re the only one</li>
                  <li><strong>Arena Leaders (Offline):</strong> Top-10 of you + nearby active bots. Sorted by score (body length, shown in indigo). Your entry highlighted in green. No country flags shown</li>
                </ul>
              </InfoCard>
              <InfoCard title="Bottom-Left: Quick Chat Emotes" accent="text-violet-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>5 emotes: GG! 🏆, Target! 🎯, Flee! 🏃💨, Ripped! 💪, Extracting! ⚡</li>
                  <li>Keyboard shortcuts: Keys 1-5 for instant emotes</li>
                  <li>Emotes appear as chat bubbles above snake head for 4 seconds</li>
                </ul>
              </InfoCard>
              <InfoCard title="Bottom-Right: Action Buttons" accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>BOOST:</strong> 64px amber circle. Hold to activate</li>
                  <li><strong>EXTRACT:</strong> 80px green circle. Hold to extract. Shows % during extraction</li>
                  <li><strong>EXIT:</strong> Small pill button at far-left bottom. Leaves match (forfeits carried chips online)</li>
                </ul>
              </InfoCard>
            </div>
            <InfoCard title="Overlays &amp; Indicators" accent="text-rose-300">
              <ul className="list-disc pl-4 space-y-0.5">
                <li><strong>Reconnecting:</strong> Amber pill at top-center with Wifi icon</li>
                <li><strong>Minimap:</strong> Bottom-left circular radar (toggle M key). Player, food, boundary</li>
                <li><strong>Full Map:</strong> Press M for full-screen arena map</li>
                <li><strong>Commission indicator:</strong> Rate shown below extraction progress bar</li>
              </ul>
            </InfoCard>
          </Section>

          {/* ================================================================= */}
          {/* 10. TACTICAL CHALLENGES */}
          {/* ================================================================= */}
          <Section icon={<ListTodo className="w-4 h-4" />} title="10. TACTICAL CHALLENGES" accent="text-emerald-400">
            <p className="mb-2">
              Tactical Challenges are daily and weekly missions that reward bonus chips for completing
              specific in-game objectives. View them in the right sidebar of the Lobby Headquarters.
              Challenges <strong>scale with your level</strong> — as you grow, missions get harder but pay more.
            </p>

            {/* Level Tiers */}
            <InfoCard title="Challenge Level Tiers" accent="text-emerald-300">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                <div className="bg-emerald-950/30 border border-emerald-500/20 p-2 rounded-lg text-center">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase">Novice</div>
                  <div className="text-[10px] text-slate-500">Level 1–5</div>
                  <div className="text-[10px] text-slate-400">×1.0 reward</div>
                </div>
                <div className="bg-cyan-950/30 border border-cyan-500/20 p-2 rounded-lg text-center">
                  <div className="text-[10px] font-bold text-cyan-400 uppercase">Operative</div>
                  <div className="text-[10px] text-slate-500">Level 6–15</div>
                  <div className="text-[10px] text-slate-400">×1.5 reward</div>
                </div>
                <div className="bg-amber-950/30 border border-amber-500/20 p-2 rounded-lg text-center">
                  <div className="text-[10px] font-bold text-amber-400 uppercase">Veteran</div>
                  <div className="text-[10px] text-slate-500">Level 16–30</div>
                  <div className="text-[10px] text-slate-400">×2.5 reward</div>
                </div>
                <div className="bg-red-950/30 border border-red-500/20 p-2 rounded-lg text-center">
                  <div className="text-[10px] font-bold text-red-400 uppercase">Elite</div>
                  <div className="text-[10px] text-slate-500">Level 31+</div>
                  <div className="text-[10px] text-slate-400">×4.0 reward</div>
                </div>
              </div>
            </InfoCard>

            {/* Challenge Types */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                  <Zap className="w-3.5 h-3.5" /> Daily Challenges (3 per day)
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li><strong>3 new challenges</strong> every day (UTC midnight reset)</li>
                  <li>Always <strong>3 different categories</strong> (no duplicates in same day)</li>
                  <li><strong>Anti-repeat:</strong> yesterday's challenges are excluded</li>
                  <li>Objectives include: kills, extractions, star collection, score (body length), arena entries, survival time, and extraction streaks</li>
                  <li>Rewards scale with your level tier (×1.0 to ×4.0)</li>
                </ul>
              </div>

              <div className="bg-violet-950/20 border border-violet-500/30 p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-violet-300 flex items-center gap-1.5 text-xs">
                  <Star className="w-3.5 h-3.5" /> Weekly Challenges (2 per week)
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li><strong>2 new challenges</strong> every Monday (UTC weekly reset)</li>
                  <li>Always <strong>2 different categories</strong></li>
                  <li><strong>Anti-repeat:</strong> last week's challenges are excluded</li>
                  <li>Higher difficulty with bigger scaled rewards</li>
                  <li>Must claim before the week ends!</li>
                </ul>
              </div>
            </div>

            {/* Streak Bonus */}
            <InfoCard title="🔥 Streak Bonus System" accent="text-amber-300" className="mt-3">
              <p className="mb-1">Complete and claim <strong>ALL daily challenges</strong> for consecutive days to build a streak:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                <li><strong>3-day streak</strong> → ×1.5 reward bonus on all challenge claims</li>
                <li><strong>7-day streak</strong> → ×2.0 reward bonus</li>
                <li><strong>14-day streak</strong> → ×3.0 reward bonus</li>
                <li>Missing a day resets your streak to 0</li>
                <li>Your current streak and multiplier are shown in the challenges panel header</li>
              </ul>
            </InfoCard>
          </Section>

          {/* ================================================================= */}
          {/* 11. DEATH & REPLAY */}
          {/* ================================================================= */}
          <Section icon={<Skull className="w-4 h-4" />} title="11. DEATH &amp; REPLAY" accent="text-rose-400">
            <div className="space-y-3">
              <InfoCard title="When You Die" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Body transforms to food orbs <strong>spread along your body path</strong></li>
                  <li>Food values sum to exactly your total score</li>
                  <li>10 golden star chips appear at your death position if you had carried chips</li>
                  <li>Anyone can collect your dropped food/stars</li>
                  <li>Killed by real player → View Profile / Add Friend / Add Rival buttons</li>
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

          {/* ================================================================= */}
          {/* 12. LOBBY LEADERBOARDS */}
          {/* ================================================================= */}
          <Section icon={<Crown className="w-4 h-4" />} title="12. LOBBY LEADERBOARDS" accent="text-amber-400">
            <div className="flex flex-col gap-2.5">
              <InfoCard title="What is the Lobby Leaderboard?" accent="text-amber-300">
                <p>The lobby houses <strong>5 tabs</strong> of official tournament leaderboards, all <strong>database-backed and real-time</strong>. Your rank reflects your lifetime <strong>banked chips</strong> across all matches. Each tab has a description box explaining what it shows.</p>
                <ul className="list-disc pl-4 space-y-0.5 mt-1.5">
                  <li><strong>World Summit</strong> — #1 player per country (top 100)</li>
                  <li><strong>Global Rankings</strong> — All players worldwide, 1-to-N</li>
                  <li><strong>National Rankings</strong> — Players from one country (top 100)</li>
                  <li><strong>Regional Rankings</strong> — Players from one region: APAC / NA / EU / LATAM (top 100)</li>
                  <li><strong>Milestone Tiers</strong> — Players grouped by chip milestone (top 100 per tier)</li>
                </ul>
              </InfoCard>

              <InfoCard title="Find Me — Per-Tab Rank Lookup" accent="text-amber-300">
                <p>Each tab has its own <strong>Find Me</strong> button (color-matched to the tab). Click it to see your rank in that specific view:</p>
                <ul className="list-disc pl-4 space-y-0.5 mt-1.5">
                  <li><strong>If you&apos;re visible</strong> on the current list: the page auto-scrolls to your &quot;YOU&quot; row and highlights it with a glow.</li>
                  <li><strong>If you&apos;re not visible</strong> (e.g., wrong country/region/tier): a <strong>Rank Summary Card</strong> appears showing your Global Rank, National Rank, Regional Rank, chips, level, clan, and milestone history.</li>
                </ul>
              </InfoCard>

              <InfoCard title="⚔️ Tie-Breaking Rules — What Happens When Chips Are Equal?" accent="text-amber-300">
                <p className="mb-1.5">When two or more players have the <strong>exact same banked chips</strong>, the system uses a 3-step tie-break to decide who ranks higher. This is shown as a <strong>visible badge</strong> on the tied player&apos;s row so everyone understands why:</p>
                <ol className="list-decimal pl-4 space-y-0.5 mb-1.5">
                  <li><strong>Most banked chips wins</strong> — Primary sort (everyone already knows this).</li>
                  <li><strong>Higher level wins</strong> — If chips are tied, the player with the higher level ranks first. The tied player below gets a <span className="text-amber-400 font-bold">⚔ Lower Lv</span> badge.</li>
                  <li><strong>Earlier join date wins (Veteran Advantage)</strong> — If both chips AND level are tied, the player who joined the game earlier ranks first. The tied player below gets a <span className="text-slate-300 font-bold">🕐 Joined Later</span> badge.</li>
                </ol>
                <p className="text-slate-500 text-[10px]">Every tab shows &quot;Tie-break: chips → level → join date&quot; as a reminder. Hover over any tie-break badge for the full explanation.</p>
              </InfoCard>

              <InfoCard title="🏆 Summit — World Cup (Top 100 Country Champions)" accent="text-amber-300">
                <p className="mb-1.5">Shows the <strong>#1 ranked player from each country</strong>, sorted by banked chips. Only one champion per nation — like the Olympics.</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Columns: Rank, Country Champion (name + tag), Clan Tag, Nation (flag + name), Chips, Championship Status</li>
                  <li>Tie-break applies: if two country champions have equal chips, higher level wins, then earlier join date.</li>
                  <li>Shows <strong>top 100</strong> country champions.</li>
                </ul>
              </InfoCard>

              <InfoCard title="🌐 Global Rankings (1-to-N — All Players Worldwide)" accent="text-cyan-300">
                <p className="mb-1.5">The main leaderboard — <strong>every player in the world</strong>, ranked #1 to N. This is the only tab that shows beyond top 100.</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Top 3 Podium</strong>: A visual podium (2nd / 1st / 3rd layout) appears above the list when real data is available.</li>
                  <li>Columns: Rank, Player (flag + name + tag), Clan Tag, Milestone Tier Badge, Chips, Championship Status</li>
                  <li>Tie-break badges appear on tied rows (see tie-break rules above).</li>
                  <li>Your row is highlighted with a <strong>&quot;YOU&quot; badge</strong> if visible.</li>
                </ul>
              </InfoCard>

              <InfoCard title="📍 National Rankings (Top 100 Per Country)" accent="text-violet-300">
                <p className="mb-1.5">Choose from <strong>197 supported countries</strong> via dropdown. Shows the top 100 players from that country.</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Columns: Rank, Challenger (name + tag), Clan Tag, Level, Chips, Championship Status</li>
                  <li>Defaults to your registered country. Switch anytime.</li>
                  <li>Tie-break applies: badges appear on tied rows.</li>
                </ul>
              </InfoCard>

              <InfoCard title="🌎 Regional Rankings (Top 100 Per Region)" accent="text-pink-300">
                <p className="mb-1.5">Players grouped by <strong>world region</strong>. Click a region button to filter:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>🌏 <strong>APAC</strong> — India, Japan, Korea, Singapore, Australia, China, Taiwan, Thailand, Vietnam, Philippines, Indonesia, Malaysia</li>
                  <li>🌎 <strong>NA</strong> — United States, Canada, Mexico</li>
                  <li>🌍 <strong>EU</strong> — UK, Germany, France, Italy, Spain, Netherlands, Poland, Sweden, Norway, Finland, and 10 more</li>
                  <li>💃 <strong>LATAM</strong> — Brazil, Argentina, Colombia, Chile, Peru</li>
                </ul>
                <p className="mt-1">Columns: Rank, Player, Clan Tag, Country (flag + name), Chips, Championship Status. Shows top 100 per region.</p>
              </InfoCard>

              <InfoCard title="🏅 Milestone Badge System — What Are These Badges?" accent="text-yellow-300">
                <p className="mb-1.5">Every player is assigned a <strong>Milestone Badge</strong> based on their <strong>lifetime banked chips</strong>. This badge appears beside your name on the Global View leaderboard, in your &quot;Your Rank&quot; summary card, and in the Player Inspector.</p>
                <ul className="list-disc pl-4 space-y-0.5 mb-2">
                  <li>Badges <strong>automatically upgrade</strong> when your banked chips cross a threshold — no action needed.</li>
                  <li>Badges <strong>can downgrade</strong> if your banked chips fall below a tier&apos;s requirement (e.g., by buying into arenas and dying without extracting).</li>
                  <li>Your tier is always calculated from your <strong>current banked chip balance</strong> in real-time.</li>
                  <li>Only <strong>extracted chips</strong> count — carried chips lost in-arena do NOT contribute.</li>
                </ul>
                <div className="overflow-x-auto mt-1">
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="text-left py-1 pr-2">Badge</th>
                        <th className="text-left py-1 pr-2">Tier Name</th>
                        <th className="text-left py-1 pr-2">Min. Banked Chips</th>
                        <th className="text-left py-1">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      <tr className="border-b border-slate-900">
                        <td className="py-1 pr-2 font-bold" style={{ color: '#64748b' }}>🛡️ Rookie</td>
                        <td className="py-1 pr-2" style={{ color: '#64748b' }}>Challenger</td>
                        <td className="py-1 pr-2 text-slate-400">0 — 99,999</td>
                        <td className="py-1 text-slate-400">Starting tier for all new players. Just getting started!</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="py-1 pr-2 font-bold" style={{ color: '#b45309' }}>🥉 Bronze</td>
                        <td className="py-1 pr-2" style={{ color: '#b45309' }}>Bronze Elite</td>
                        <td className="py-1 pr-2 text-slate-400">100K+ (1 Lakh)</td>
                        <td className="py-1 text-slate-400">First milestone. Proven arena survival skills.</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="py-1 pr-2 font-bold" style={{ color: '#cbd5e1' }}>🥈 Silver</td>
                        <td className="py-1 pr-2" style={{ color: '#cbd5e1' }}>Silver Commander</td>
                        <td className="py-1 pr-2 text-slate-400">500K+ (5 Lakhs)</td>
                        <td className="py-1 text-slate-400">Consistent extractor with strategic awareness.</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="py-1 pr-2 font-bold" style={{ color: '#f59e0b' }}>🥇 Gold</td>
                        <td className="py-1 pr-2" style={{ color: '#f59e0b' }}>Gold Apex Vanguard</td>
                        <td className="py-1 pr-2 text-slate-400">1M+ (10 Lakhs)</td>
                        <td className="py-1 text-slate-400">Elite player — top-tier extraction machine.</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="py-1 pr-2 font-bold" style={{ color: '#22d3ee' }}>💎 Platinum</td>
                        <td className="py-1 pr-2" style={{ color: '#22d3ee' }}>Platinum Sovereign</td>
                        <td className="py-1 pr-2 text-slate-400">2.5M+ (25 Lakhs)</td>
                        <td className="py-1 text-slate-400">Arena dominator — feared by rivals.</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="py-1 pr-2 font-bold" style={{ color: '#06b6d4' }}>🔮 Diamond</td>
                        <td className="py-1 pr-2" style={{ color: '#06b6d4' }}>Diamond Warlord</td>
                        <td className="py-1 pr-2 text-slate-400">5M+ (50 Lakhs)</td>
                        <td className="py-1 text-slate-400">Legendary status — a true warlord of the arena.</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-bold" style={{ color: '#fbbf24' }}>👑 Omega</td>
                        <td className="py-1 pr-2" style={{ color: '#fbbf24' }}>Omega Legend</td>
                        <td className="py-1 pr-2 text-slate-400">10M+ (1 Crore)</td>
                        <td className="py-1 text-slate-400">The pinnacle. Ultimate venom arena champion.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </InfoCard>

              <InfoCard title="🏅 Milestone Tier Ranks — Filter by Achievement Level" accent="text-yellow-300">
                <p>Filter by milestone tier using the badge buttons:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>⭐ <strong>All Tiers</strong> — Every ranked player</li>
                  <li>🛡️ <strong>Rookie / Challenger</strong> — Players below 100K banked chips</li>
                  <li>🥉 <strong>Bronze Elite</strong> — 100K+ banked chips</li>
                  <li>🥈 <strong>Silver Commander</strong> — 5 Lakh (500K+) banked chips</li>
                  <li>🥇 <strong>Gold Apex Vanguard</strong> — 10 Lakh (1M+) banked chips</li>
                  <li>💎 <strong>Platinum Sovereign</strong> — 25 Lakh (2.5M+) banked chips</li>
                  <li>🔮 <strong>Diamond Warlord</strong> — 50 Lakh (5M+) banked chips</li>
                  <li>👑 <strong>Omega Legend</strong> — 1 Crore (10M+) banked chips</li>
                </ul>
                <p className="mt-1">Columns: Rank, Player, Clan Tag, Country (flag + name), Chips. The first player in each non-Rookie tier gets a &quot;👑 FIRST&quot; badge. Shows top 100 per tier.</p>
              </InfoCard>

              <InfoCard title="📊 Milestone History — Your Achievement Timeline" accent="text-amber-300">
                <p className="mb-1.5">Above the tabs, a collapsible <strong>&quot;Milestone History&quot;</strong> section shows your personal tier achievement journey:</p>
                <ul className="list-disc pl-4 space-y-0.5 mb-1.5">
                  <li><strong>Progress bar</strong> — Visual representation of all 6 tiers. Filled segments = achieved, empty = not yet reached.</li>
                  <li><strong>Timeline entries</strong> — Each achieved milestone shows: badge icon, tier name, chips you had when you reached it, and the <strong>exact date + time (UTC)</strong> you achieved it.</li>
                  <li><strong>&quot;🔥 Current&quot; badge</strong> — Marks your most recently achieved tier.</li>
                  <li><strong>&quot;Next milestone&quot; hint</strong> — Shows the next tier to aim for and its chip threshold.</li>
                </ul>
                <p>If you haven&apos;t achieved any milestones yet, <strong>demo milestone data</strong> (clearly labeled with a DEMO badge) is shown so you can see what it will look like. Milestones are recorded automatically when your banked chips cross a tier threshold.</p>
              </InfoCard>

              <InfoCard title="🏆 Championship Prize Badges on Rows" accent="text-yellow-300">
                <p>On Summit and Global tabs, players in the top 100 earn a <strong>Championship Prize badge</strong> based on their rank:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Rank #1</strong> — &quot;👑 World Champion&quot; (gold)</li>
                  <li><strong>Rank #2-10</strong> — &quot;🥈 Elite 10&quot; (silver)</li>
                  <li><strong>Rank #11-50</strong> — &quot;🥉 Masters 50&quot; (bronze)</li>
                  <li><strong>Rank #51-100</strong> — &quot;🛡️ Qualifier 100&quot; (slate)</li>
                </ul>
                <p className="mt-1">These badges connect the Leaderboard system to the Championship system — top-ranked players qualify for tournament events.</p>
              </InfoCard>

              <InfoCard title="🔍 Search &amp; Player Inspector" accent="text-indigo-300">
                <p><strong>Search:</strong> Every tab has a search box. Type a player name, tag, or clan tag to filter the visible list in real-time.</p>
                <p className="mt-1.5"><strong>Player Inspector:</strong> Click any player row to open their profile inspector showing name, country, chips, level, clan, and their rank from the leaderboard.</p>
              </InfoCard>

              <InfoCard title="Empty Boards &amp; Demo Data" accent="text-slate-300">
                <p>If no real players appear for a view (e.g., no players from a specific country, or no one has reached a tier yet), <strong>3 demo entries</strong> appear with a grey <strong>&quot;DEMO&quot; badge</strong> on each row. The header also shows &quot;· Showing demo data&quot;. This is temporary — once real players qualify, the demo rows disappear.</p>
              </InfoCard>

              <InfoCard title="Auto-Refresh &amp; Live Ticker" accent="text-emerald-300">
                <p>Leaderboards auto-refresh every 30 minutes. Click the <strong>Refresh</strong> button to fetch the latest data immediately. &quot;Last sync&quot; timestamp shows when data was last fetched.</p>
                <p className="mt-1">When real data is available, a <strong>Live Ticker</strong> bar cycles through recent in-game events (chip extractions, eliminations, tier milestones) for an esports-style feel.</p>
              </InfoCard>
            </div>
          </Section>

          {/* ================================================================= */}
          {/* 13. FAQ */}
          {/* ================================================================= */}
          <Section icon={<AlertTriangle className="w-4 h-4" />} title="13. FAQ" accent="text-purple-400">
            <div className="flex flex-col gap-2.5">
              <FaqItem q="Do I lose my banked vault chips if I crash?" a="No! Your banked vault chips are 100% safe. You only lose the buy-in chips carried in that specific match." />
              <FaqItem q="What is the graduated commission?" a="If ≤3 real players are in the arena, extraction is FREE (0%). If ≥4 real players, 35% commission applies (you keep 65%)." />
              <FaqItem q="Why did my extraction restart from 0%?" a="Any steering (changing direction) while extracting resets the 3-second progress to 0%. Forward gliding is natural and allowed — just don't turn!" />
              <FaqItem q="What is the green ring near extracting players?" a="When YOU are extracting, a white-to-green progress ring appears near your snake head. It's private — only you can see your own extraction ring." />
              <FaqItem q="Can I Play Again if I don't have enough chips?" a="No. Play Again checks your banked vault balance before letting you rejoin. If you don't have enough chips for the buy-in, you'll see an error and need to earn more chips first." />
              <FaqItem q="Can I extract at any time?" a="Yes! No minimum chip threshold and no zone restriction. Extract from anywhere on the map." />
              <FaqItem q="What happens to bots at score 100?" a="(Online only) They enter self-destruct: slowly navigate toward the wall without boosting, collecting food on the way. Wall death = vanish cleanly." />
              <FaqItem q="Is this gambling?" a="No. Chips are free in-game soft currency with no real-world value. The buy-in is a gameplay risk mechanic, not a wager." />
              <FaqItem q="How does anti-cheat work?" a="Server is authoritative. All chip creation, food eating, collisions, extraction computed server-side. Client only sends steering input." />
              <FaqItem q="Do challenge missions carry over?" a="No. Daily missions reset every day at UTC midnight. Weekly missions reset every Monday at UTC midnight. Complete and claim before the period ends!" />
              <FaqItem q="Can I claim a mission reward twice?" a="No. Each mission can only be claimed once per period. The server prevents double-claiming — even if you refresh or use a different browser." />
              <FaqItem q="Do I earn XP when I die?" a="No. XP is only earned on successful extraction. Dying forfeits your carried chips and awards 0 XP. Extract safely to earn XP!" />
              <FaqItem q="How does the Watch Video reward work?" a="After a match ends, click the Watch Video button on the results screen. A 5-second ad plays, then you claim +50 free chips. One ad reward per 60 seconds cooldown." />
              <FaqItem q="What are the milestone badges (Rookie, Bronze, Silver, Gold, Platinum, Diamond, Omega)?" a="Milestone badges represent your lifetime achievement level. They are automatically assigned based on your total banked chips: Rookie (0-99K), Bronze (100K+), Silver (500K+), Gold (1M+), Platinum (2.5M+), Diamond (5M+), Omega (10M+). Your badge upgrades instantly when you cross a threshold, and can downgrade if your banked chips drop below the requirement. Each time you reach a new tier, it&apos;s recorded in your Milestone History with the exact timestamp." />
              <FaqItem q="Can I lose my milestone badge?" a="Yes. Your badge is calculated from your current banked chip balance in real-time. If you buy into an arena with a high buy-in and die (losing those chips), your banked balance may drop below your tier threshold, causing a downgrade. Only extracted chips count!" />
              <FaqItem q="How does tie-breaking work on the leaderboard?" a="When two players have the same banked chips, the system checks: (1) Higher level wins. (2) If still tied, the player who joined the game earlier wins (veteran advantage). You&apos;ll see a visible badge on tied rows — &quot;⚔ Lower Lv&quot; if they lost on level, or &quot;🕐 Joined Later&quot; if they lost on join date. This applies on every tab." />
              <FaqItem q="What is the Milestone History section?" a="It&apos;s a collapsible panel above the leaderboard tabs that shows your personal tier achievement timeline. Each milestone you&apos;ve reached displays the badge, chips you had when you achieved it, and the exact date/time (UTC). A progress bar shows how many of the 6 tiers you&apos;ve unlocked, and a &quot;Next milestone&quot; hint tells you what to aim for. If you haven&apos;t achieved any milestones yet, demo data is shown as a preview." />
              <FaqItem q="How does Find Me work?" a="Each leaderboard tab has its own Find Me button. Click it and the system checks if you&apos;re on the current visible list. If yes, it scrolls to your row and highlights it. If not (e.g., you&apos;re viewing a different country), a Rank Summary Card appears showing your Global, National, and Regional ranks, chips, level, clan, and milestone history." />
              <FaqItem q="How do I reset my password if I forgot it?" a="Go to the Login page → click &quot;Forgot Password?&quot; → enter your registered email + 4-digit Security PIN → set a new password. This works instantly — no email verification needed. Important: you must have set a Security PIN during registration or in Profile → Security Settings. Without a PIN, password recovery is not available." />
              <FaqItem q="How do I change or set my Security PIN?" a="Go to Profile → Dossier tab → Security Settings card. If you already have a PIN, enter your current PIN first, then set a new one. If you don&apos;t have a PIN yet, you can set one without entering a current PIN. Your PIN is required for password recovery — don&apos;t forget it!" />
              <FaqItem q="How does social login (Google, Facebook, Apple) work?" a="Click the provider button on the login page. You&apos;ll be redirected to sign in with your social account. After authorization, a Venom Arena account is automatically created (or linked if your social email matches an existing account). You get 150 starter chips and a VENOM-XXXX tag just like regular registration. No separate password needed." />
              <FaqItem q="Can I link a password to my social login account?" a="Yes! Go to Profile → Dossier tab → Security Settings. You can change your Security PIN there. If you need a full password (for email login), contact support. Your social login always works regardless." />
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

/* ========================================================================== */
/* Helper sub-components                                                      */
/* ========================================================================== */

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
