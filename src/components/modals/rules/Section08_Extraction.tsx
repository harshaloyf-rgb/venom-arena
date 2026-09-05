/* Section 8 — Extraction */
'use client';

import { Trophy } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section08_Extraction() {
  return (
    <Section icon={<Trophy className="w-4 h-4" />} title="8. EXTRACTION" accent="text-amber-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard title="How to Extract" accent="text-amber-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Hold <strong>E key</strong> (or right-click) or the <strong>EXTRACT</strong> button</li>
            <li>3-second progress — forward gliding is allowed</li>
            <li><strong>Steering restarts progress to 0%</strong> — glide straight, but a real course change (more than ≈7°, held briefly) resets the timer. Tiny input tremor is ignored.</li>
            <li>A white-to-green <strong>progress ring</strong> appears around your snake head — <strong>only visible to you</strong>, other players cannot see it</li>
            <li>Extract <strong>anytime</strong> — no minimum threshold</li>
            <li>Extract <strong>anywhere</strong> — no zone restriction</li>
          </ul>
        </InfoCard>
        <InfoCard title="Commission" accent="text-rose-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>≤3 real players:</strong> 0% (keep 100%)</li>
            <li><strong>≥4 real players:</strong> 35% (keep 65%)</li>
            <li>Your final commission and banked amount are shown on the <strong>&quot;You Banked&quot;</strong> result after extracting</li>
          </ul>
        </InfoCard>
      </div>
      <InfoCard title="Extraction UI Elements" accent="text-cyan-300">
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Progress ring:</strong> The white-to-green ring around your head IS the progress bar — it fills over 3 seconds</li>
          <li><strong>EXTRACT button:</strong> Bottom-left amber button — hold to extract (keyboard hint: E / Right Click)</li>
          <li><strong>BOOST button:</strong> Bottom-left orange button above it — hold to boost (B / Left Click). Boost is available from score 1</li>
          <li>Release or turn while extracting and the ring resets — just hold still and glide straight</li>
        </ul>
      </InfoCard>
    </Section>
  );
}
