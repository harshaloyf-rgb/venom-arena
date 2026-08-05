/* Section 4 — Boost Mechanic */
'use client';

import { Zap } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section04_Boost() {
  return (
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
  );
}
