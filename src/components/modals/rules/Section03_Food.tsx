/* Section 3 — Food Orbs & Star Chips */
'use client';

import { Coins, Star } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section03_Food() {
  return (
    <Section icon={<Coins className="w-4 h-4" />} title="3. FOOD ORBS &amp; STAR CHIPS" accent="text-amber-400">
      <p className="mb-2">Two types of collectibles exist on the arena floor:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard title="🟢 Food Orbs (3 sizes)" accent="text-emerald-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Small:</strong> 1 point, green glow (93% chance — very common)</li>
            <li><strong>Medium:</strong> 3 points, blue glow (4% chance)</li>
            <li><strong>Large:</strong> 5 points, pink glow (3% chance — rare)</li>
          </ul>
          <p className="mt-1">Eating food increases score and body length. Length growth is logarithmic in your score — early food grows you fast, later food adds length more gradually. ALL snakes eat food orbs. Food orbs do NOT affect carried chips.</p>
        </InfoCard>
        <InfoCard title="💀 Death Food Orbs (Body Drop)" accent="text-rose-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>When any snake (bot or player) dies from <strong>collision</strong>, their body transforms into food orbs <strong>scattered along the body path</strong>.</li>
            <li>Total food value = the dead snake&apos;s <strong>entire score</strong>, guaranteed — nothing is lost.</li>
            <li>The corpse drops up to <strong>500 orb slots</strong> (capped by body length): roughly <strong>40% large, 30% medium, 30% small</strong>, shuffled along the body. Each orb&apos;s point value is <strong>stacked</strong> so the orbs always sum to the full score.</li>
            <li>Bigger kills pay better: a long high-score corpse drops more slots carrying more value per orb — cutting off a giant is worth the effort.</li>
            <li><strong>ALL snakes</strong> (players + bots) can eat death food → increases score/size only.</li>
            <li><strong>Wall death:</strong> NO food orbs drop (score is destroyed to prevent edge farming), but carried chips <strong>DO</strong> drop as stars along the body trail.</li>
            <li>Death food orbs are <strong>completely separate from stars</strong> — food affects score/size, stars affect carried chips.</li>
          </ul>
        </InfoCard>
        <InfoCard title={<><Star className="w-3.5 h-3.5 text-amber-400 inline" /> Star Chips (Chip Fragments from Death)</>} accent="text-amber-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>A player enters the arena with their <strong>buy-in chips</strong>. During the match, collecting stars from dead opponents increases their <strong>carried chips</strong> (buy-in + star value collected). This total is shown above the player&apos;s head.</li>
            <li><strong>Carried Chips</strong> = buy-in chips + collected star value. Food orbs and boost do NOT affect carried chips — they only affect score and size.</li>
            <li>When a <strong>real player dies</strong>, their carried chips transform into exactly <strong>10 stars</strong> dropped <strong>along the dead player&apos;s body trail</strong> (same positions as their body segments).</li>
            <li>Star values use a <strong>no-decimal system</strong>: Stars 1–9 each get <strong>⌊carried chips ÷ 10⌋</strong>. Star 10 gets the <strong>remainder</strong> (guaranteeing the exact total is preserved).</li>
            <li><strong>Example 1:</strong> 275c → 9 stars of <strong>27c</strong> + 1 star of <strong>32c</strong> = 275c total ✓</li>
            <li><strong>Example 2:</strong> 11c → 9 stars of <strong>1c</strong> + 1 star of <strong>2c</strong> = 11c total ✓</li>
            <li><strong>Example 3:</strong> 7c → 9 stars of <strong>0c</strong> (not spawned) + 1 star of <strong>7c</strong> = 7c total ✓</li>
            <li>Each star&apos;s <strong>visual size</strong> matches the dead player&apos;s body width (thicker snake = bigger stars).</li>
            <li>Only <strong>real players</strong> can collect stars. Bots cannot see, touch, or collect stars.</li>
            <li>Collecting a star adds its chip value to your <strong>carried chips</strong> (not score).</li>
            <li>Bots <strong>never</strong> drop stars on death — they vanish cleanly.</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
