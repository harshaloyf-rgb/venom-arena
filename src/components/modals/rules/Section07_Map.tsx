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
            <li>Circular arena (29,000px radius) shared by every tier</li>
            <li>Boundary <strong>breathes</strong>: shrinks/grows by up to ~8% of the radius on a 60-second cycle (30s in, 30s out) — watch the edge!</li>
            <li>Outside boundary = instant death</li>
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
            <li><strong>Online:</strong> at least 600px from every snake&apos;s head, with extra body-aware checks so you never materialize inside a coil</li>
            <li><strong>Offline:</strong> 400px from every snake</li>
            <li>Spawn zone sits well inside the boundary (within ~85% of the map radius)</li>
            <li><strong>2s spawn protection</strong> (invulnerable)</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
