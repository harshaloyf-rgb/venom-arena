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
            <li>Seek nearest food orbs (and food clusters)</li>
            <li>Dodge players (predictive — 25–45 ticks ahead)</li>
            <li>Avoid body segments (120px range) and other snakes (300px range)</li>
            <li>Turn away from map boundary</li>
            <li>Boost defensively to escape threats; some bot types boost aggressively on higher tiers</li>
            <li>Never collect stars (they can&apos;t even see them)</li>
          </ul>
        </InfoCard>
        <InfoCard title="Bots &amp; the Wall (Online)" accent="text-rose-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Bots <strong>always steer away</strong> from the boundary — there is no scripted self-destruct</li>
            <li>The breathing boundary can still catch a distracted bot mid-chase</li>
            <li><strong>Bot wall death = vanish cleanly</strong> (0 food, 0 stars)</li>
            <li>Bots killed by collision <strong>do</strong> drop food orbs like any snake</li>
            <li>Bots never carry chips, so they never drop stars</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
