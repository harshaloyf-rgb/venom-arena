/* Section 18 — Cyber Pass (Season Pass) */
'use client';

import { Award } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section18_CyberPass() {
  return (
    <Section icon={<Award className="w-4 h-4" />} title="18. CYBER PASS (SEASON PASS)" accent="text-purple-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <InfoCard title="🏆 What Is the Cyber Pass?" accent="text-purple-300">
          <p className="mb-1.5">The <strong>Cyber Pass</strong> is a progression-based reward track with <strong>20 tiers</strong> of exclusive cosmetics. As you level up by playing matches, new tiers unlock automatically.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Each tier requires a specific <strong>player level</strong> (Lv 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 15, 17, 19, 21, 23, 25, 28, 31, 34, 38)</li>
            <li>Every tier has a <strong>Free reward</strong> + an <strong>Elite reward</strong></li>
            <li>Rewards are <strong>real cosmetics</strong> — skins, trails, death effects, flags, and banners</li>
          </ul>
        </InfoCard>
        <InfoCard title="⚡ How Do I Earn XP?" accent="text-emerald-300">
          <p className="mb-1.5">XP is earned exclusively from <strong>successful extractions</strong> in online matches:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Extract safely</strong> = XP earned (amount scales with chips extracted)</li>
            <li><strong>Die / collide</strong> = 0 XP — no pass progress from dying</li>
            <li>Complete <strong>daily challenges</strong> for bonus XP</li>
            <li>Your player level increases as XP accumulates</li>
          </ul>
        </InfoCard>
        <InfoCard title="💰 Free vs Elite Track" accent="text-amber-300">
          <p className="mb-1.5">Two parallel reward tracks at every tier:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong className="text-emerald-300">Free Track:</strong> Available to all players. Claim anytime you reach the tier&apos;s level requirement.</li>
            <li><strong className="text-amber-300">Elite Track:</strong> Requires the <strong>Elite Cyber Pass</strong> (100,000c one-time purchase). Gives premium cosmetics at every tier.</li>
            <li>Elite cosmetics are <strong>exclusive</strong> — never sold in the Shop.</li>
          </ul>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <InfoCard title="🎁 Claiming Rewards" accent="text-cyan-300">
          <p className="mb-1.5">Rewards must be <strong>manually claimed</strong> from the Pass tab:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Once your level meets a tier&apos;s requirement, the <strong>Claim</strong> button activates</li>
            <li>Claiming adds the cosmetic to your <strong>inventory</strong> (unlockedSkins — server-persisted)</li>
            <li>After claiming, equip it in <strong>Shop &amp; Lab</strong> like any other cosmetic</li>
            <li>Each reward can only be claimed <strong>once</strong> (server-enforced, no double-claim)</li>
            <li><strong>Claim All</strong> buttons let you batch-claim all unclaimed rewards at once</li>
          </ul>
        </InfoCard>
        <InfoCard title="👑 Unlocking Elite" accent="text-yellow-300">
          <p className="mb-1.5">To unlock the Elite track:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Go to the <strong>Pass tab</strong> in Lobby Station</li>
            <li>Click <strong>&quot;Unlock Elite (1,00,000c)&quot;</strong></li>
            <li>100,000 chips are deducted <strong>server-side</strong></li>
            <li>Elite is permanent for the season — no subscription</li>
            <li>All previously-locked elite tiers become claimable immediately (if your level qualifies)</li>
          </ul>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        <InfoCard title="🎭 Reward Types" accent="text-pink-300">
          <p className="mb-1.5">The 40 pass cosmetics span all cosmetic categories:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Skins</strong> — Snake appearances (Ember Worm, Cyber Serpent God, Rainbow Viper, etc.)</li>
            <li><strong>Trails</strong> — Visual effects behind your snake (Venom Drip, Hypernova, Galaxy Drift, etc.)</li>
            <li><strong>Death FX</strong> — Explosion effects on death (Phantom Burst, Void Reaper, Apocalypse Burst, etc.)</li>
            <li><strong>Flags</strong> — Custom flag cosmetics (Clan Crest, Elite Standard)</li>
            <li><strong>Banners</strong> — Profile background banners (War Banner, Throne Room, Genesis Crown Frame)</li>
          </ul>
        </InfoCard>
        <InfoCard title="📊 Current Season: Genesis" accent="text-emerald-300">
          <p className="mb-1.5">Season 1 — <strong>Genesis</strong>:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>20 tiers from Level 2 to Level 38</li>
            <li>20 free cosmetics (mix of skins, trails, deaths, flags, banners)</li>
            <li>20 elite-exclusive cosmetics (premium variants)</li>
            <li>Elite cost: <strong>1,00,000 chips</strong> (one-time)</li>
            <li>All rewards are <strong>pass-exclusive</strong> — not available anywhere else</li>
          </ul>
        </InfoCard>
        <InfoCard title="💡 Tips" accent="text-cyan-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Focus on <strong>extracting safely</strong> — dying gives 0 XP</li>
            <li>Higher arena tiers give more chips per extraction = more XP</li>
            <li>Complete <strong>daily challenges</strong> for bonus XP</li>
            <li>Free track rewards are still valuable — don&apos;t skip them!</li>
            <li>Elite is best value if you play regularly and are above Level 5</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
