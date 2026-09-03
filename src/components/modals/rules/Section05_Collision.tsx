/* Section 5 — Collision Rules */
'use client';

import { Crosshair } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section05_Collision() {
  return (
    <Section icon={<Crosshair className="w-4 h-4" />} title="5. COLLISION RULES" accent="text-rose-400">
      <div className="space-y-3">
        <InfoCard title="Head-to-Body Collision" accent="text-rose-300">
          If your head hits another snake&apos;s body, <strong>YOU die</strong>. Your body transforms into food orbs spread along your body path. If you had carried chips, <strong>10 stars</strong> appear at your last position.
          <strong>Neck protection:</strong> First 5 segments behind a head cannot kill (prevents unfair &quot;neck touch&quot;).
        </InfoCard>
        <InfoCard title="Head-on Collision (Head vs Head)" accent="text-amber-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Neither boosting:</strong> Larger wins, smaller dies</li>
            <li><strong>Smaller boosting, larger steady:</strong> Smaller survives — but only if it holds at least 25% of the larger snake&apos;s score (head-on boost gate)</li>
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
  );
}
