/* Section 7 — Map & Safe Spawning */
'use client';

import { Map } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section07_Map() {
  return (
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
            <li>400px from every other snake</li>
            <li>500px inside map boundary (online)</li>
            <li><strong>2s spawn protection</strong> (invulnerable)</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
