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
            <li>Hold <strong>E key</strong> or <strong>EXTRACT</strong> button</li>
            <li>3-second progress bar — forward gliding is allowed</li>
            <li><strong>Steering restarts progress to 0%</strong> — you can glide forward naturally, but any direction change (even slight) resets the timer</li>
            <li>A white-to-green <strong>progress ring</strong> appears near your snake head — <strong>only visible to you</strong>, other players cannot see it</li>
            <li>Extract <strong>anytime</strong> — no minimum threshold</li>
            <li>Extract <strong>anywhere</strong> — no zone restriction</li>
          </ul>
        </InfoCard>
        <InfoCard title="Commission" accent="text-rose-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>≤3 real players:</strong> 0% (keep 100%)</li>
            <li><strong>≥4 real players:</strong> 35% (keep 65%)</li>
            <li>Rate shown live on HUD</li>
          </ul>
        </InfoCard>
      </div>
      <InfoCard title="Extraction UI Elements" accent="text-cyan-300">
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Top-center hint:</strong> &quot;Hold E or press the button below to cash out safely!&quot; — always visible while playing</li>
          <li><strong>Progress popup:</strong> When extracting, a bar fills 0→100% with amber gradient. Commission rate shown below</li>
          <li><strong>Movement flash:</strong> If you move during extraction, a red &quot;⚠ MOVEMENT DETECTED — Extraction restarted!&quot; warning flashes</li>
          <li><strong>EXTRACT button:</strong> Bottom-right circular button (80px). Shows percentage while extracting, turns green when active</li>
          <li><strong>BOOST button:</strong> Adjacent circular button (64px, amber). Hold to boost. Must have 8+ body segments and earned mass</li>
        </ul>
      </InfoCard>
    </Section>
  );
}
