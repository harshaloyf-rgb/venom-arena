/* Section 19 — Cyber Pass (Season Pass) */
'use client';

import { Award } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section19_CyberPass() {
  return (
    <Section icon={<Award className="w-4 h-4" />} title="19. CYBER PASS (SEASON PASS)" accent="text-purple-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <InfoCard title="🏆 What Is the Cyber Pass?" accent="text-purple-300">
          <p className="mb-1.5">The <strong>Cyber Pass</strong> is a progression-based reward track with <strong>20 tiers</strong> of rewards. You earn <strong>Pass XP</strong> by playing online matches (50% of match XP, up to 1,500 Pass XP per day) and new tiers unlock automatically as Pass XP accumulates.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Each tier requires a specific amount of <strong>Pass XP</strong> (growing per tier — see the progress bar in the Cyber Pass tab)</li>
            <li>Every tier has a <strong>Free reward</strong> + an <strong>Elite reward</strong></li>
            <li>Rewards are <strong>chips and exclusive snake skins</strong> (from 200c up to 10,000c per tier on the two tracks)</li>
          </ul>
        </InfoCard>
        <InfoCard title="⚡ How Do I Earn XP?" accent="text-emerald-300">
          <p className="mb-1.5">XP is earned from <strong>all online match outcomes</strong>:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Extract safely</strong> = XP earned (amount scales with chips extracted + kills)</li>
            <li><strong>Die / collide</strong> = XP still earned based on score and kills before death</li>
            <li><strong>Offline Practice</strong> earns nothing — practice matches award 0 chips and 0 XP, so no Pass XP either. Only online arenas award Pass XP.</li>
            <li>Complete <strong>daily challenges</strong> for bonus XP (+25 per challenge — counts toward your level AND your Pass XP, sharing the daily Pass cap)</li>
            <li>Your Pass XP increases with every online match (50% of match XP, capped at 1,500/day)</li>
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
            <li>Once your <strong>Pass XP</strong> meets a tier&apos;s requirement, the <strong>Claim</strong> button activates</li>
            <li>Claiming adds the cosmetic to your <strong>inventory</strong> (unlockedSkins — server-persisted)</li>
            <li>After claiming, equip it in <strong>Shop &amp; Lab</strong> like any other cosmetic</li>
            <li>If you are still wearing the default starter skin, your first claimed pass skin is <strong>auto-equipped</strong> instantly</li>
            <li>Each reward can only be claimed <strong>once</strong> (server-enforced, no double-claim)</li>
            <li><strong>Claim All</strong> buttons let you batch-claim all unclaimed rewards at once</li>
          </ul>
        </InfoCard>
        <InfoCard title="👑 Unlocking Elite" accent="text-yellow-300">
          <p className="mb-1.5">To unlock the Elite track:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Open the <strong>Season Pass tab</strong> — from the Lobby Stations grid or the desktop tab strip (labelled &quot;Pass&quot;), or <strong>All Stations</strong> on mobile</li>
            <li>Click <strong>&quot;Unlock Elite (1,00,000c)&quot;</strong></li>
            <li>100,000 chips are deducted <strong>server-side</strong></li>
            <li>Elite is permanent for the season — no subscription</li>
            <li>All previously-locked elite tiers become claimable immediately (if your Pass XP qualifies)</li>
          </ul>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        <InfoCard title="🎭 Reward Types" accent="text-pink-300">
          <p className="mb-1.5">All 40 pass rewards are <strong>exclusive snake skins + chip bonuses</strong>:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Free track:</strong> an exclusive skin at EVERY tier, plus chip bonuses (200c at Tier 3 up to 3,000c at Tiers 18–20)</li>
            <li><strong>Elite track:</strong> a premium skin at every tier, plus bigger chip bonuses (500c up to 10,000c)</li>
            <li>Example skins: Ember Worm, Jade Scales, Chrome King (free) · Cyber Serpent God, Dragon Scale, Genesis Crown (elite)</li>
          </ul>
        </InfoCard>
        <InfoCard title="📊 Current Season: Genesis" accent="text-emerald-300">
          <p className="mb-1.5">Season 1 — <strong>Genesis</strong>:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>20 tiers on a Pass-XP ladder — Tier 1 is free (0 Pass XP), Tier 20 needs <strong>55,000 Pass XP</strong> total</li>
            <li>Free track: an <strong>exclusive skin at every tier</strong> + chip bonuses at 7 tiers (200c at Tier 3 up to 3,000c at Tier 20)</li>
            <li>Elite track: a premium skin at every tier + bigger chip bonuses (500c up to 10,000c)</li>
            <li>Elite cost: <strong>100,000 chips</strong> (one-time)</li>
            <li>All rewards are <strong>pass-exclusive</strong> — not available anywhere else</li>
          </ul>
        </InfoCard>
        <InfoCard title="💡 Tips" accent="text-cyan-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Every match counts — you earn XP whether you extract or die</li>
            <li>Higher arena tiers give more chips per extraction = more XP</li>
            <li>Complete <strong>daily challenges</strong> for bonus XP</li>
            <li>Free track rewards are still valuable — don&apos;t skip them!</li>
            <li>Elite is best value if you play regularly — there is <strong>no level requirement</strong>, just the 100,000c price</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
