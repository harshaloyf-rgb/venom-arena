/* Section 6 — Bot AI Behavior */
'use client';

import { Bot } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section06_BotAI() {
  return (
    <Section icon={<Bot className="w-4 h-4" />} title="6. BOT AI BEHAVIOR" accent="text-violet-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard title="Harvesting Mode" accent="text-violet-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Seek nearest food orbs</li>
            <li>Dodge players (predictive — 8 ticks ahead)</li>
            <li>Avoid body segments (150px range)</li>
            <li>Turn away from map boundary</li>
            <li>Never boost, never collect stars</li>
          </ul>
        </InfoCard>
        <InfoCard title="Self-Destruct (Online Only)" accent="text-rose-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Triggered at score ≥100</li>
            <li>Navigate <strong>toward</strong> wall slowly</li>
            <li><strong>NEVER boost</strong></li>
            <li>Still collect food on the way</li>
            <li>Wall death = vanish cleanly (0 food, 0 stars)</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
