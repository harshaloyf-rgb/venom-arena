'use client';

/**
 * Venom Arena — Official Guide, Rules & FAQ modal.
 *
 * Comprehensive rules page covering ALL game mechanics, modes,
 * food, stars, collision, boost, bot AI, map, extraction, challenges,
 * HUD, lobby leaderboards, milestone badges, agent profile, and FAQ.
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
  Award,
  Swords,
  MessageSquare,
  TrendingUp,
  ScrollText,
  UserCircle,
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
                Accounts, controls, modes, arena tiers, HUD, extraction, challenges, death, replay, leaderboards, championships, hall of fame, syndicates &amp; FAQ
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
            <InfoCard title="🛡️ Identity Change Policy (Leaderboard Integrity)" accent="text-amber-300">
              <p className="mb-1.5">To prevent leaderboard and championship abuse, identity changes are <strong>rate-limited</strong>:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li><strong>Challenger Handle (Name):</strong> Can only be changed once every <strong>30 days</strong></li>
                <li><strong>Faction Region (Country):</strong> Can only be changed once every <strong>7 days</strong></li>
                <li>Your <strong>VENOM-XXXX tag is permanent</strong> and can never be changed — it is your true identity</li>
                <li>Avatar, socials, and cosmetics can be changed <strong>anytime</strong> (no cooldown)</li>
                <li>If you try to change during a cooldown, the save will be blocked with remaining time shown</li>
              </ul>
              <p className="mt-1.5 text-amber-200/80 text-[10px]">⚠️ Leaderboards show your <strong>current</strong> name and country (live, not historical). Your VENOM-XXXX tag remains constant across all leaderboards. See Section 16 (Agent Profile) for full details.</p>
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
          {/* 13. ANNUAL CHAMPIONSHIPS */}
          {/* ================================================================= */}
          <Section icon={<Trophy className="w-4 h-4" />} title="13. ANNUAL CHAMPIONSHIPS" accent="text-amber-400">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <InfoCard title="🏆 What is the Annual Championship?" accent="text-amber-300">
                <p className="mb-1">The <strong>Annual Championship</strong> is a year-long competitive event that tracks every player&apos;s performance across all online matches. Unlike the lobby leaderboard (which is live/session-based), championship standings persist across the entire calendar year and culminate in a <strong>Jan 1st Payout</strong>.</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Runs from <strong>Jan 1 to Dec 31</strong> each year</li>
                  <li>Every online match counts toward your championship score</li>
                  <li>Top finishers earn prizes and Hall of Fame induction</li>
                  <li>Results are archived and viewable in perpetuity</li>
                </ul>
              </InfoCard>

              <InfoCard title="📋 DB-Backed Registration" accent="text-cyan-300">
                <p className="mb-1">Championship registration is handled entirely through the database — no separate sign-up needed:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Auto-enrolled:</strong> Every registered player is automatically entered when they play their first online match of the year</li>
                  <li><strong>Persistent:</strong> Your registration status, match history, and standings are stored server-side in the database</li>
                  <li><strong>One account per player:</strong> Duplicate or alt accounts are merged using your VENOM-XXXX tag</li>
                  <li><strong>Guest players:</strong> Must register or link a social account before their championship stats are tracked</li>
                </ul>
              </InfoCard>

              <InfoCard title="💰 Jan 1st Payout &amp; Hall of Fame Tiers" accent="text-yellow-300">
                <p className="mb-1.5">On <strong>January 1st</strong> of each year, final standings are locked and prizes are distributed based on your final championship rank:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] mt-1">
                    <thead>
                      <tr className="text-left border-b border-slate-700">
                        <th className="py-1 pr-2 text-slate-300">Rank</th>
                        <th className="py-1 pr-2 text-slate-300">HOF Tier</th>
                        <th className="py-1 pr-2 text-slate-300">Prize</th>
                        <th className="py-1 text-slate-300">Perk</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-900">
                        <td className="py-1 pr-2 font-bold" style={{ color: '#fbbf24' }}>#1</td>
                        <td className="py-1 pr-2" style={{ color: '#fbbf24' }}>👑 World Champion</td>
                        <td className="py-1 pr-2 text-slate-400">5,000,000c</td>
                        <td className="py-1 text-slate-400">Permanent crown badge + HOF plaque</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="py-1 pr-2 font-bold" style={{ color: '#a1a1aa' }}>#2–10</td>
                        <td className="py-1 pr-2" style={{ color: '#a1a1aa' }}>🥈 Elite 10</td>
                        <td className="py-1 pr-2 text-slate-400">500,000c each</td>
                        <td className="py-1 text-slate-400">Silver HOF badge + title</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="py-1 pr-2 font-bold" style={{ color: '#cd7f32' }}>#11–50</td>
                        <td className="py-1 pr-2" style={{ color: '#cd7f32' }}>🥉 Masters 50</td>
                        <td className="py-1 pr-2 text-slate-400">100,000c each</td>
                        <td className="py-1 text-slate-400">Bronze HOF badge</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-bold" style={{ color: '#64748b' }}>#51–100</td>
                        <td className="py-1 pr-2" style={{ color: '#64748b' }}>🛡️ Qualifier 100</td>
                        <td className="py-1 pr-2 text-slate-400">25,000c each</td>
                        <td className="py-1 text-slate-400">Qualifier badge + next-year priority</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </InfoCard>

              <InfoCard title="📊 My Championship Summary" accent="text-emerald-300">
                <p className="mb-1">A personal dashboard card shows your championship progress at a glance:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Current Rank:</strong> Your live position in the championship standings</li>
                  <li><strong>Matches Played:</strong> Total online matches this year</li>
                  <li><strong>Total Extracted:</strong> Cumulative chips extracted across all matches</li>
                  <li><strong>Win Rate:</strong> Percentage of matches where you successfully extracted</li>
                  <li><strong>Best Streak:</strong> Longest consecutive extraction streak</li>
                  <li><strong>Projected Tier:</strong> Based on current pace, which HOF tier you&apos;re on track for</li>
                </ul>
              </InfoCard>

              <InfoCard title="⚠️ Match Cap Warnings (9K / 9.5K / 9.9K)" accent="text-red-400">
                <p className="mb-1">To encourage fair play and prevent grinding exploits, the championship has <strong>annual match caps</strong> with escalating warnings:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>9,000 matches:</strong> Yellow warning — &quot;Approaching annual cap. Matches beyond 9,500 score at 75% weight.&quot;</li>
                  <li><strong>9,500 matches:</strong> Orange warning — &quot;Near cap. Matches beyond 9,900 score at 50% weight.&quot;</li>
                  <li><strong>9,900 matches:</strong> Red warning — &quot;Final 100 matches. These score at 25% weight. Plan carefully!&quot;</li>
                  <li><strong>10,000 matches:</strong> Hard cap reached — no further championship scoring for the year</li>
                </ul>
                <p className="mt-1 text-amber-400/80">Caps reset every Jan 1st. Quality over quantity — each match should count!</p>
              </InfoCard>

              <InfoCard title="🌍 Standings Scopes &amp; Clan Rankings" accent="text-indigo-300">
                <p className="mb-1">Championship standings support <strong>4 scope tabs</strong> — just like the lobby leaderboard:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>GLOBAL</strong> — All players worldwide, ranked by championship score</li>
                  <li><strong>REGIONAL</strong> — Players grouped by geographic region (e.g., Asia, Europe, Americas)</li>
                  <li><strong>NATIONAL</strong> — Players from your country only</li>
                  <li><strong>CLAN</strong> — Clan-based rankings: aggregates all clan members&apos; championship scores into a clan total, then ranks clans against each other</li>
                </ul>
                <p className="mt-1">Clan rankings use the <strong>sum of top 10 members&apos; scores</strong> to prevent single-player clan exploits. A &quot;Clan Members&quot; count shows active participants.</p>
              </InfoCard>

              <InfoCard title="🟢 Live Activity Indicators" accent="text-green-400">
                <p className="mb-1">On the championship standings, some player rows display a <strong>green pulsing dot</strong> next to their name:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Green pulsing dot = currently online</strong> — that player is in an active match right now</li>
                  <li><strong>No dot = offline</strong> — the player is not currently in a match</li>
                  <li>The dot updates in real-time via the server&apos;s presence system</li>
                  <li>It adds a competitive edge — you can see if your rivals are grinding!</li>
                </ul>
                <p className="mt-1">The pulsing animation uses a smooth CSS animation (scale + opacity) on a 2-second loop.</p>
              </InfoCard>

              <InfoCard title="🔍 Find Me in Championship" accent="text-violet-300">
                <p className="mb-1">The <strong>Find Me</strong> button works the same as the lobby leaderboard:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Click <strong>Find Me</strong> on any championship tab</li>
                  <li>If you&apos;re on the current page, it scrolls to your row and highlights it</li>
                  <li>If you&apos;re not visible (e.g., viewing a different region), a <strong>Rank Summary Card</strong> appears showing your position across all 4 scopes</li>
                  <li>The summary includes: rank, score, matches played, and projected HOF tier</li>
                </ul>
              </InfoCard>

              <InfoCard title="🧪 Demo Data &amp; Real Standings" accent="text-slate-300">
                <p className="mb-1">Before enough real match data accumulates, the championship page shows <strong>demo data</strong>:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Demo rows have a grey <strong>&quot;DEMO&quot; badge</strong> on each entry</li>
                  <li>The header displays &quot;· Showing demo data&quot;</li>
                  <li>Once you&apos;ve played real matches, your actual data replaces demo entries</li>
                  <li>Demo data is identical in structure to real data — same columns, same sorting</li>
                  <li>At least <strong>10 real players</strong> must have championship scores before demo data is fully retired</li>
                </ul>
              </InfoCard>

              <InfoCard title="📜 Past Archives &amp; Championship vs. Lobby Leaderboard" accent="text-amber-300">
                <p className="mb-1"><strong>Archives:</strong> Completed championship years are frozen and accessible via a year selector dropdown. Past years show final standings, HOF inductees, and prize winners — nothing can change.</p>
                <ul className="list-disc pl-4 space-y-0.5 mt-1">
                  <li><strong>Year selector</strong> — Dropdown at the top to switch between current and past years</li>
                  <li><strong>Frozen badge</strong> — Archived years display a &quot;🔒 FROZEN&quot; indicator</li>
                </ul>
                <p className="mt-1.5"><strong>Championship vs. Lobby Leaderboard:</strong> The lobby leaderboard is <strong>session-based</strong> — it shows real-time chip totals and updates continuously. The championship is <strong>annual-based</strong> — it tracks cumulative performance across the whole year. A player can be #1 on the lobby board but #50 in the championship (or vice versa).</p>
              </InfoCard>
            </div>
          </Section>

          {/* ================================================================= */}
          {/* 14. HALL OF FAME */}
          {/* ================================================================= */}
          <Section icon={<Award className="w-4 h-4" />} title="14. HALL OF FAME" accent="text-yellow-400">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <InfoCard title="🏆 What is the Hall of Fame?" accent="text-yellow-300">
                <p className="mb-1">The <strong>Hall of Fame (HOF)</strong> is Venom Arena&apos;s <strong>permanent shrine</strong> celebrating legendary players. Every inductee&apos;s record is stored in the database and can <strong>never be removed</strong> — it is truly immortal.</p>
                <p>There are <strong>two induction paths</strong>:</p>
                <ul className="list-disc pl-4 space-y-0.5 mt-1">
                  <li><strong>Milestone Induction:</strong> Reach lifetime banked chip thresholds (1 Lakh to 1 Crore)</li>
                  <li><strong>Championship Induction:</strong> Finish in the top 100 of any Annual Championship</li>
                </ul>
              </InfoCard>

              <InfoCard title="⭐ Milestone Induction Path" accent="text-amber-300">
                <p className="mb-1.5">When your <strong>total banked chips</strong> cross a milestone threshold for the <strong>first time</strong>, you&apos;re automatically inducted into the HOF:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] mt-1">
                    <thead>
                      <tr className="text-left border-b border-slate-700">
                        <th className="py-1 pr-2 text-slate-300">Threshold</th>
                        <th className="py-1 pr-2 text-slate-300">Badge</th>
                        <th className="py-1 text-slate-300">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-900"><td className="py-1 pr-2 font-mono text-amber-400">1,00,000c</td><td className="py-1 pr-2">🥉 Bronze Elite</td><td className="py-1 text-slate-400">First step to immortality</td></tr>
                      <tr className="border-b border-slate-900"><td className="py-1 pr-2 font-mono text-slate-300">5,00,000c</td><td className="py-1 pr-2">🥈 Silver Commander</td><td className="py-1 text-slate-400">Half a million club</td></tr>
                      <tr className="border-b border-slate-900"><td className="py-1 pr-2 font-mono text-yellow-400">10,00,000c</td><td className="py-1 pr-2">🥇 Gold Apex Vanguard</td><td className="py-1 text-slate-400">Millionaire status</td></tr>
                      <tr className="border-b border-slate-900"><td className="py-1 pr-2 font-mono text-cyan-400">25,00,000c</td><td className="py-1 pr-2">💎 Platinum Sovereign</td><td className="py-1 text-slate-400">Elite tier</td></tr>
                      <tr className="border-b border-slate-900"><td className="py-1 pr-2 font-mono text-violet-400">50,00,000c</td><td className="py-1 pr-2">🔮 Diamond Warlord</td><td className="py-1 text-slate-400">Top 0.1% of players</td></tr>
                      <tr><td className="py-1 pr-2 font-mono text-yellow-300">1,00,00,000c</td><td className="py-1 pr-2">👑 Omega Immortal God</td><td className="py-1 text-slate-400">Legendary — 1 Crore+</td></tr>
                    </tbody>
                  </table>
                </div>
              </InfoCard>

              <InfoCard title="🏆 Championship Induction Path" accent="text-yellow-300">
                <p className="mb-1">When an Annual Championship year ends (Dec 31), the <strong>top 100 finishers</strong> are automatically inducted with rank-based badges:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>#1 (Crown):</strong> 👑 Permanent crown badge + World Champion title</li>
                  <li><strong>#2-10 (Silver):</strong> 🥈 Silver HOF badge + Overlord title</li>
                  <li><strong>#11-50 (Bronze):</strong> 🥉 Bronze HOF badge + Elite Master title</li>
                  <li><strong>#51-100 (Contender):</strong> 🛡️ Contender badge + priority for next year</li>
                </ul>
                <p className="mt-1">Each championship year creates a <strong>separate induction record</strong> — a player can be inducted multiple times across different years.</p>
              </InfoCard>

              <InfoCard title="🛡️ HOF Permanence Rules" accent="text-emerald-300">
                <p className="mb-1">HOF records are <strong>immutable</strong>:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Milestone inductions are based on the <strong>first time</strong> you reach a tier — even if your chips later drop below, the HOF entry stays</li>
                  <li>Championship inductions are <strong>finalized on Jan 1st</strong> and locked permanently</li>
                  <li>There is no appeal, removal, or expiration of HOF records</li>
                  <li>Your highest HOF badge is shown on the <strong>leaderboard</strong> and <strong>player inspector</strong></li>
                </ul>
              </InfoCard>

              <InfoCard title="👤 Checking Your HOF Status" accent="text-cyan-300">
                <p className="mb-1">View your HOF profile in several places:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Hall of Fame tab</strong> — Full profile with all inductions, next milestone goal, and live stats</li>
                  <li><strong>Player Inspector</strong> — HOF badge shown at the top of the overview tab</li>
                  <li><strong>Leaderboard rows</strong> — Small HOF icon (🏆) next to your name if inducted</li>
                  <li><strong>Championship podium</strong> — HOF badge visible on top-3 contenders</li>
                </ul>
              </InfoCard>

              <InfoCard title="📊 HOF Statistics" accent="text-violet-300">
                <p className="mb-1">The HOF tab shows aggregate stats for the entire server:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Total Inducted Players:</strong> Count of unique players with at least one HOF entry</li>
                  <li><strong>Total Entries:</strong> Sum of all inductions (one player can have multiple)</li>
                  <li><strong>Per-Tier Counts:</strong> How many players hold each milestone/championship badge</li>
                  <li><strong>First Achievers:</strong> The very first player to reach each milestone tier, with date and time</li>
                  <li><strong>Championship Years:</strong> Which years have finalized championship inductees</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* ================================================================= */}
          {/* 15. SYNDICATES (CLAN SYSTEM) */}
          {/* ================================================================= */}
          <Section icon={<Shield className="w-4 h-4" />} title="15. SYNDICATES (CLAN SYSTEM)" accent="text-amber-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoCard title="🛡️ What Are Syndicates?" accent="text-amber-300">
                <p className="mb-1.5">Syndicates (clans) are player-formed teams. Team up with allies, pool chips into a shared Treasury, complete weekly challenges together, and climb the clan level system.</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Create your own syndicate or browse and join existing ones</li>
                  <li>Each syndicate has a unique <strong>3-4 letter tag</strong> (e.g. VNM, APEX)</li>
                  <li>Clan level unlocks powerful perks for all members</li>
                </ul>
              </InfoCard>
              <InfoCard title="⚔️ Clan Roles" accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong className="text-amber-300">Leader</strong> — Full control: promote, demote, kick, edit settings, disband, claim challenges</li>
                  <li><strong className="text-purple-300">Co-Leader</strong> — Can kick Vipers, claim challenges. Max 2 per clan</li>
                  <li><strong className="text-indigo-300">Viper</strong> — Standard member. Can deposit, chat, leave freely</li>
                </ul>
              </InfoCard>
              <InfoCard title="💰 Clan Treasury" accent="text-emerald-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Members deposit chips from their personal bank into the Treasury</li>
                  <li>Quick-deposit buttons: 10%, 25%, 50%, or MAX of your chips</li>
                  <li>Max 1,000,000c per transaction</li>
                  <li>Treasury grows via deposits and challenge reward claims</li>
                  <li>Deposits also grant <strong>5% XP</strong> to your clan (10% at Level 3+)</li>
                </ul>
              </InfoCard>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              <InfoCard title="⭐ Clan XP &amp; Leveling" accent="text-emerald-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Clans start at <strong>Level 1</strong> (0 XP)</li>
                  <li>Level-up requires <strong>Level × 1,000 XP</strong> (e.g. Lv2 = 2,000 XP)</li>
                  <li>XP sources: deposits (5%), challenge claims (10% of reward)</li>
                  <li>Level-ups are logged in the Activity Log</li>
                </ul>
              </InfoCard>
              <InfoCard title="🏆 Weekly Challenges" accent="text-amber-300">
                <p className="mb-1.5">Three challenges reset every <strong>Monday UTC</strong>. Scaled by clan level:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Treasury Target</strong> — Deposit a total of X chips</li>
                  <li><strong>Recruitment Drive</strong> — Recruit X new members</li>
                  <li><strong>Syndicate Comms</strong> — Send X chat messages</li>
                  <li>Leader/Co-Leader can <strong>Claim</strong> completed challenges for bonus chips + XP</li>
                </ul>
              </InfoCard>
              <InfoCard title="📊 Clan Management" accent="text-cyan-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Settings</strong> — Leader can edit name, description, emblem</li>
                  <li><strong>Transfer Leadership</strong> — Pass leadership to a Co-Leader</li>
                  <li><strong>Disband</strong> — Permanently dissolve the syndicate (Leader only)</li>
                  <li><strong>Activity Log</strong> — Full history of joins, leaves, deposits, promotions, kicks, challenges, level-ups</li>
                  <li><strong>Stats</strong> — Aggregate combat stats across all members</li>
                </ul>
              </InfoCard>
            </div>

            <div className="mt-3">
              <InfoCard title="🗺️ Perks Roadmap" accent="text-amber-300">
                <p className="mb-1.5">Your syndicate unlocks powerful bonuses as it levels up:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
                    <div className="text-[10px] font-mono text-amber-400 font-bold">LVL 1</div>
                    <div className="text-[10px] text-slate-400">Up to 10 members</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
                    <div className="text-[10px] font-mono text-slate-400 font-bold">LVL 2</div>
                    <div className="text-[10px] text-slate-500">Up to 15 members</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
                    <div className="text-[10px] font-mono text-slate-400 font-bold">LVL 3</div>
                    <div className="text-[10px] text-slate-500">10% XP bonus on deposits</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
                    <div className="text-[10px] font-mono text-slate-400 font-bold">LVL 5</div>
                    <div className="text-[10px] text-slate-500">20 members, +20% challenge rewards</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
                    <div className="text-[10px] font-mono text-slate-400 font-bold">LVL 10</div>
                    <div className="text-[10px] text-slate-500">30 members, custom emblems</div>
                  </div>
                </div>
              </InfoCard>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <InfoCard title="💬 Syndicate Chat" accent="text-emerald-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Real-time chat feed for all clan members</li>
                  <li>Chat messages count toward the <strong>Syndicate Comms</strong> weekly challenge</li>
                  <li>Use it to coordinate strategies and build team spirit</li>
                </ul>
              </InfoCard>
              <InfoCard title="🔍 Top Depositors" accent="text-amber-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Overview shows the <strong>top 3 contributors</strong> by total deposits</li>
                  <li>Members have <strong>online/offline status</strong> indicators (green/gray dot)</li>
                  <li>Full member roster with rank badges and management actions</li>
                </ul>
              </InfoCard>
            </div>
          </Section>

          {/* ================================================================= */}
          {/* 16. AGENT PROFILE */}
          {/* ================================================================= */}
          <Section icon={<UserCircle className="w-4 h-4" />} title="16. AGENT PROFILE" accent="text-pink-400">
            <InfoCard title="📋 Overview" accent="text-pink-300">
              <p className="mb-1.5">The <strong>Agent Profile</strong> (accessed via the Profile tab in the lobby) is your personal command center. It has <strong>two tabs</strong>:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li><strong>Stats Tab</strong> — Your identity, stats, cosmetics, shareable cards, security settings, and account management</li>
                <li><strong>History Tab</strong> — Your match history with filters (All, Extracted, Collided)</li>
              </ul>
            </InfoCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard title="🆔 Identity Editor" accent="text-pink-300">
                <p className="mb-1.5">Click the <strong>edit icon</strong> on the Stats tab to open the identity editor:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Challenger Handle (Name):</strong> Change your display name (30-day cooldown). Remaining cooldown is shown if active</li>
                  <li><strong>Faction Region (Country):</strong> Choose from 197 countries (7-day cooldown). Your flag updates everywhere instantly</li>
                  <li><strong>Avatar:</strong> Upload a custom image or choose from preset avatars. No cooldown</li>
                  <li><strong>Social Links:</strong> Add your Instagram, YouTube, and Twitch handles. Shown on your profile</li>
                </ul>
              </InfoCard>
              <InfoCard title="🎮 Cosmetics Loadout" accent="text-amber-300">
                <p className="mb-1.5">Your active cosmetic items are displayed on the Stats tab:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Skin</strong> — Your snake&apos;s appearance</li>
                  <li><strong>Trail</strong> — Visual effect behind your snake</li>
                  <li><strong>Death FX</strong> — Explosion effect when you die</li>
                  <li><strong>Flag</strong> — Custom flag cosmetic (separate from your Faction Region)</li>
                  <li><strong>Banner</strong> — Background banner cosmetic</li>
                  <li>All cosmetics are changeable anytime from the Cosmetics Shop</li>
                </ul>
              </InfoCard>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <InfoCard title="🪪 Profile Card &amp; Milestone Card" accent="text-violet-300">
                <p className="mb-1.5">Generate shareable cards from your Stats tab:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Profile Card:</strong> Shows your name, tag, country flag, level, chips, K/D, cosmetics, and social links</li>
                  <li><strong>Milestone Card:</strong> Shows your highest milestone badge and chip progress</li>
                  <li>Both cards can be <strong>downloaded</strong> as images, <strong>copied to clipboard</strong>, or <strong>shared</strong> via the Web Share API</li>
                </ul>
              </InfoCard>
              <InfoCard title="🔐 Security Settings" accent="text-cyan-300">
                <p className="mb-1.5">Available at the bottom of the Stats tab:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Change Password:</strong> Registered accounts can update their password (enter current + new)</li>
                  <li><strong>Security PIN:</strong> Set or change your 4-digit PIN. Required for password recovery</li>
                  <li>If you have a PIN, you must enter the current one before setting a new one</li>
                  <li>Guest accounts cannot use Security Settings (no password to recover)</li>
                </ul>
              </InfoCard>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <InfoCard title="📊 Stats Display" accent="text-emerald-300">
                <p className="mb-1.5">The Stats tab shows your key performance metrics:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Level &amp; XP:</strong> Current level, XP progress bar, and XP needed for next level</li>
                  <li><strong>Chips:</strong> Banked vault balance and current buy-in arena tier</li>
                  <li><strong>K/D Ratio:</strong> Lifetime kills, deaths, and kill/death ratio</li>
                  <li><strong>Win Stats:</strong> Total runs, extractions, and extraction rate percentage</li>
                  <li><strong>Account Age:</strong> Days since account creation</li>
                  <li><strong>Milestone Tier:</strong> Current badge and next tier target</li>
                  <li><strong>Tag &amp; Referral:</strong> Copy your VENOM-XXXX tag and referral code</li>
                </ul>
              </InfoCard>
              <InfoCard title="📜 Match History Tab" accent="text-amber-300">
                <p className="mb-1.5">Switch to the History tab to review your matches:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Filter:</strong> All matches, Extracted only, or Collided only</li>
                  <li>Shows arena type, score, chips won/lost, kills, duration, and timestamp</li>
                  <li>Uses client-side cache for offline viewing, synced with server data</li>
                  <li>Paginated — loads 25 matches at a time</li>
                </ul>
              </InfoCard>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <InfoCard title="🚀 Guest Upgrade" accent="text-emerald-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Guest accounts see an <strong>upgrade banner</strong> at the top of the Stats tab</li>
                  <li>Click to add an email and password, converting to a registered account</li>
                  <li>All progress carries over: chips, stats, cosmetics, streaks, friends, and clan memberships</li>
                  <li>You keep your VENOM-XXXX tag after upgrading</li>
                </ul>
              </InfoCard>
              <InfoCard title="⚠️ Danger Zone — Delete Account" accent="text-rose-300">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>At the bottom of the Stats tab: a <strong>Delete Account</strong> button</li>
                  <li>Requires typing <strong>DELETE</strong> to confirm (double-confirmation)</li>
                  <li>Permanently removes: chips, stats, cosmetics, friends, match history, clan memberships</li>
                  <li><strong>This action is irreversible and cannot be recovered</strong></li>
                </ul>
              </InfoCard>
            </div>

            <InfoCard title="🛡️ Leaderboard Identity Integrity" accent="text-amber-300">
              <p className="mb-1.5">Important note about how your identity appears on leaderboards:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Leaderboards display your <strong>current</strong> Challenger Handle and Faction Region (live, not historical snapshots)</li>
                <li>If you change your name or country, <strong>all leaderboards update immediately</strong> to show the new identity</li>
                <li>Your <strong>VENOM-XXXX tag is always shown alongside your name</strong> — this is your permanent, unchangeable identity that links all your entries across time</li>
                <li>The <strong>cooldowns (30 days for name, 7 days for country)</strong> limit how often identity can change, keeping leaderboards stable during ranking periods</li>
                <li>Historical records like Hall of Fame entries snapshot your name and tag at the time of induction — those never change</li>
              </ul>
            </InfoCard>
          </Section>

          {/* ================================================================= */}
          {/* 17. FAQ */}
          {/* ================================================================= */}
          <Section icon={<AlertTriangle className="w-4 h-4" />} title="17. FAQ" accent="text-purple-400">
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
              <FaqItem q="How do I change or set my Security PIN?" a="Go to Profile → Agent Profile → Security Settings card. If you already have a PIN, enter your current PIN first, then set a new one. If you don&apos;t have a PIN yet, you can set one without entering a current PIN. Your PIN is required for password recovery — don&apos;t forget it!" />
              <FaqItem q="How does social login (Google, Facebook, Apple) work?" a="Click the provider button on the login page. You&apos;ll be redirected to sign in with your social account. After authorization, a Venom Arena account is automatically created (or linked if your social email matches an existing account). You get 150 starter chips and a VENOM-XXXX tag just like regular registration. No separate password needed." />
              <FaqItem q="Can I link a password to my social login account?" a="Yes! Go to Profile → Agent Profile → Security Settings. You can change your Security PIN there. If you need a full password (for email login), contact support. Your social login always works regardless." />
              <FaqItem q="How does championship registration work?" a="You&apos;re automatically enrolled in the Annual Championship when you play your first online match of the year. Registration is DB-backed — your VENOM-XXXX tag, match history, and standings are stored server-side. Guest accounts must register or link a social account before their championship stats are tracked." />
              <FaqItem q="What happens when the championship year ends?" a="On December 31st at 23:59 UTC, all scoring stops and standings are frozen. On January 1st, prizes are distributed based on final ranks (see HOF tiers: #1 gets 5M chips + crown, #2-10 get 500K each, etc.). The previous year is archived and viewable via the year selector. A new championship year begins immediately with everyone&apos;s scores reset to zero." />
              <FaqItem q="What do the green pulsing dots on championship contenders mean?" a="A green pulsing dot next to a player&apos;s name in the championship standings means they are currently online and in an active match. It updates in real-time via the server&apos;s presence system. No dot means the player is offline. It&apos;s a great way to see if your rivals are actively grinding!" />
              <FaqItem q="How do clan rankings work in the championship?" a="Clan rankings aggregate the championship scores of all clan members. To prevent single-player exploits, only the top 10 members&apos; scores are summed. The clan with the highest total across its top 10 members ranks #1. The CLAN tab on the championship standings page shows each clan&apos;s total score, member count, and average score per member." />
              <FaqItem q="What is the Hall of Fame?" a="The Hall of Fame is Venom Arena&apos;s permanent record of legendary players. There are two induction paths: (1) Milestone Induction — reach lifetime chip thresholds (1 Lakh to 1 Crore). (2) Championship Induction — finish in the top 100 of an Annual Championship. Once inducted, your record is permanent and can never be removed." />
              <FaqItem q="How do I get into the Hall of Fame?" a="For milestones: simply play and bank chips. When your total banked chips cross a milestone threshold (100K, 500K, 1M, 2.5M, 5M, 10M), you&apos;re automatically inducted if it&apos;s your first time reaching that tier. For championships: finish in the top 100 of any Annual Championship year. Inductions are automatic and DB-backed." />
              <FaqItem q="What are the HOF badges?" a="Milestone badges: 🥉 Bronze Elite (100K+), 🥈 Silver Commander (500K+), 🥇 Gold Apex Vanguard (1M+), 💎 Platinum Sovereign (2.5M+), 🔮 Diamond Warlord (5M+), 👑 Omega Immortal God (10M+). Championship badges: 👑 Crown (#1), 🥈 Silver (#2-10), 🥉 Bronze (#11-50), 🛡️ Contender (#51-100). Your highest badge is displayed on the leaderboard and player inspector." />
              <FaqItem q="Can I be inducted into both milestone and championship HOF?" a="Absolutely! They are separate tracks. A player can hold multiple milestone inductions (one per tier) plus championship inductions (one per year). All appear in your HOF profile on the Hall of Fame tab." />
              <FaqItem q="Are HOF records permanent?" a="Yes. HOF entries are immutable once created. Even if your banked chips drop below a milestone threshold later, your HOF induction for that tier remains. Championship entries are finalized when the year ends and locked forever." />
              <FaqItem q="How do I create a syndicate?" a="Go to the Syndicates tab → click &quot;Form Syndicate&quot; → enter a Name (3+ chars), Tag (2-4 uppercase letters), Description, and pick an Emblem. You become the Leader automatically. You must not already be in a clan." />
              <FaqItem q="Can I be in multiple syndicates?" a="No. You can only be a member of one syndicate at a time. To join another, you must leave your current syndicate first." />
              <FaqItem q="What happens to my deposited chips if I leave a syndicate?" a="Deposited chips go into the clan Treasury and cannot be withdrawn. They belong to the syndicate, not individual members. Think of it as a team contribution." />
              <FaqItem q="What happens if the Leader leaves?" a="If the Leader leaves, the oldest Co-Leader is automatically promoted to Leader. If there are no Co-Leaders, the oldest member becomes Leader. If you&apos;re the last member, the syndicate is automatically disbanded." />
              <FaqItem q="How do weekly challenges work?" a="Three challenges are generated every Monday UTC: Treasury Target, Recruitment Drive, and Syndicate Comms. They scale with your clan level. When a challenge is complete, any Leader or Co-Leader can click Claim to add the reward chips to the Treasury and grant clan XP. Unclaimed challenges reset on the next Monday." />
              <FaqItem q="How does clan XP work?" a="Clan XP is earned two ways: (1) Deposits grant 5% of the deposited amount as XP (10% at Level 3+). (2) Claiming a challenge grants 10% of the reward as XP. The XP needed to level up is Level × 1,000 (e.g. Level 2 needs 2,000 total XP, Level 3 needs 3,000 total XP)." />
              <FaqItem q="What can a Co-Leader do?" a="Co-Leaders can: claim weekly challenges, kick Viper-ranked members, and participate in all clan activities. They cannot: edit clan settings, disband the clan, promote/demote other members, or kick other Co-Leaders. Max 2 Co-Leaders per clan." />
              <FaqItem q="Can the Leader transfer leadership?" a="Yes. The Leader can transfer leadership to any Co-Leader via the crown icon on the member roster. The current Leader becomes a Co-Leader, and the selected Co-Leader becomes the new Leader. This is irreversible for that session." />
              <FaqItem q="What happens when a syndicate is disbanded?" a="All members are removed from the clan, all activity logs and challenge records are deleted, and the Treasury chips are lost. Disbanding is permanent and can only be done by the Leader." />
              <FaqItem q="What is the Agent Profile?" a="The Agent Profile (Profile tab in lobby) is your personal command center with two tabs. The Stats tab shows your identity, level, chips, K/D, cosmetics loadout, shareable profile/milestone cards, security settings, and account management. The History tab shows your match history with filters for All, Extracted, or Collided matches." />
              <FaqItem q="How do I edit my name, country, avatar, or social links?" a="On the Stats tab of Agent Profile, click the edit icon. You can change: (1) Challenger Handle (30-day cooldown), (2) Faction Region / Country (7-day cooldown), (3) Avatar (upload image or pick preset — no cooldown), (4) Social links — Instagram, YouTube, Twitch (no cooldown). Click Save to apply all changes at once. If a cooldown is active, the save is blocked and remaining time is shown." />
              <FaqItem q="What are Profile Cards and Milestone Cards?" a="On the Stats tab, you can generate shareable image cards. The Profile Card shows your name, tag, country flag, level, chips, K/D, cosmetics, and social links. The Milestone Card shows your highest milestone badge and chip progress. Both can be downloaded as images, copied to clipboard, or shared via the Web Share API." />
              <FaqItem q="How do I change my password or Security PIN?" a="Scroll to the Security Settings card on the Stats tab. Registered accounts can change their password (enter current + new). You can also set or change your 4-digit Security PIN — this is required for password recovery. If you already have a PIN, enter the current one first. Guest accounts cannot use Security Settings." />
              <FaqItem q="How do I upgrade from Guest to Registered?" a="Guest accounts see an upgrade banner at the top of the Stats tab. Click it to add an email and password. All progress carries over — chips, stats, cosmetics, streaks, friends, and clan memberships. You keep your VENOM-XXXX tag." />
              <FaqItem q="Can I delete my account?" a="Yes. At the bottom of the Stats tab is a Danger Zone section with a Delete Account button. You must type &quot;DELETE&quot; to confirm, and a second confirmation dialog appears. This permanently removes all chips, stats, cosmetics, friends, match history, and clan memberships. This action is irreversible." />
              <FaqItem q="Can I change my display name?" a="Yes, but with a 30-day cooldown. Your Challenger Handle can only be changed once every 30 days. Go to Profile → Agent Profile (Stats tab) → click the edit icon. Your VENOM-XXXX tag is permanent and can never be changed — it is your true identity on all leaderboards and records." />
              <FaqItem q="Can I change my country/region?" a="Yes, with a 7-day cooldown. Your Faction Region can only be changed once every 7 days. Go to Profile → Agent Profile (Stats tab) → click the edit icon. The change takes effect immediately on leaderboards and championship standings. Your VENOM-XXXX tag remains the same." />
              <FaqItem q="Why is there a cooldown on name and country changes?" a="Without cooldowns, players on the leaderboard could change their name or country to impersonate others, confuse rivals, or exploit regional/national leaderboards. The cooldown limits how often identity can change. Note: leaderboards always show your CURRENT name and country (not historical snapshots), so the cooldown keeps entries stable during ranking periods. Your permanent VENOM-XXXX tag ensures identity continuity across all leaderboards." />
              <FaqItem q="If I change my name on the leaderboard, does my old name disappear?" a="Yes. Leaderboards display your current Challenger Handle in real-time — they do not store historical name snapshots. However, your permanent VENOM-XXXX tag is always shown alongside your name, so players can always identify you regardless of name changes. Hall of Fame entries DO snapshot your name at the time of induction — those never change." />
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
