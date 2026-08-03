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
  );
}
