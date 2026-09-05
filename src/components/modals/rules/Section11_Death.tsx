/* Section 11 — Death & Replay */
'use client';

import { Skull } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section11_Death() {
  return (
    <Section icon={<Skull className="w-4 h-4" />} title="11. DEATH &amp; REPLAY" accent="text-rose-400">
      <div className="space-y-3">
        <InfoCard title="When You Die" accent="text-rose-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Body transforms to food orbs <strong>spread along your body path</strong></li>
            <li>Food values sum to exactly your total score</li>
            <li>10 golden star chips drop <strong>along your body trail</strong> if you had carried chips</li>
            <li>Anyone can collect your dropped food/stars</li>
            <li>Killed by real player → View Profile / Add Friend / Add Rival buttons</li>
          </ul>
        </InfoCard>
        <InfoCard title="After Your Death" accent="text-cyan-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Your killer is highlighted in the elimination banner</li>
            <li>View their profile, add them as a friend or track them as a rival</li>
            <li>XP is still awarded for the run — only carried chips are lost</li>
            <li>Disconnects: a 12s grace window lets you rejoin your snake</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
