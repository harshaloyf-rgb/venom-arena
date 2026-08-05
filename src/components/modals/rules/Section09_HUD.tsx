/* Section 9 — In-Game HUD Explained */
'use client';

import { Gamepad } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section09_HUD() {
  return (
    <Section icon={<Gamepad className="w-4 h-4" />} title="9. IN-GAME HUD EXPLAINED" accent="text-indigo-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard title="Top-Left: Status Cards" accent="text-emerald-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Carried Chips (online only):</strong> Green card showing total carried chips with &quot;c&quot; suffix. Starts at buy-in amount, increases when you collect star chips from dead players. Hidden in offline mode</li>
            <li><strong>Stars Earned (online only):</strong> Amber card showing extra chips earned from collecting star collectibles (Carried Chips − Buy-In)</li>
            <li><strong>Stars in Arena (online only):</strong> Shows how many golden star collectibles are currently on the arena floor (drops when real players die, decreases when collected)</li>
            <li><strong>Rank:</strong> Yellow trophy icon + arena rank number</li>
            <li><strong>Score:</strong> Purple shield icon + snake body length</li>
            <li><strong>Kills:</strong> Red skull icon + opponents eliminated</li>
            <li><strong>Boost:</strong> Amber zap icon + &quot;SPACE&quot; reminder</li>
            <li><strong>Active Competitors:</strong> &quot;Real Players: N Active&quot; (pulsing indigo) or &quot;Offline Mode: 1 Player&quot; (amber)</li>
          </ul>
        </InfoCard>
        <InfoCard title="Top-Right: Network &amp; Leaderboard" accent="text-cyan-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Banked Chips:</strong> Amber card showing vault balance (deducts buy-in on match start)</li>
            <li><strong>FPS / Ping:</strong> Frames per second + latency in ms. Color-coded. &quot;LQ&quot; badge if low quality</li>
            <li><strong>Chat / Minimap:</strong> Below banked card. Chat opens message dialog. Minimap toggles radar</li>
            <li><strong>Arena Leaders (Online):</strong> Collapsible top-10 leaderboard of real players only. Sorted by carried chips (e.g., &quot;100c&quot; in green). Shows player name, country flag, carried chips. Your entry highlighted with &quot;YOU&quot; badge in indigo. Shows &quot;No real players yet.&quot; if you&apos;re the only one</li>
            <li><strong>Arena Leaders (Offline):</strong> Top-10 of you + nearby active bots. Sorted by score (body length, shown in indigo). Your entry highlighted in green. No country flags shown</li>
          </ul>
        </InfoCard>
        <InfoCard title="Bottom-Left: Quick Chat Emotes" accent="text-violet-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>5 emotes: GG! 🏆, Target! 🎯, Flee! 🏃💨, Ripped! 💪, Extracting! ⚡</li>
            <li>Keyboard shortcuts: Keys 1-5 for instant emotes</li>
            <li>Emotes appear as chat bubbles above snake head for 4 seconds</li>
          </ul>
        </InfoCard>
        <InfoCard title="Bottom-Right: Action Buttons" accent="text-amber-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>BOOST:</strong> 64px amber circle. Hold to activate</li>
            <li><strong>EXTRACT:</strong> 80px green circle. Hold to extract. Shows % during extraction</li>
            <li><strong>EXIT:</strong> Small pill button at far-left bottom. Leaves match (forfeits carried chips online)</li>
          </ul>
        </InfoCard>
      </div>
      <InfoCard title="Overlays &amp; Indicators" accent="text-rose-300">
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Reconnecting:</strong> Amber pill at top-center with Wifi icon</li>
          <li><strong>Minimap:</strong> Bottom-left circular radar (toggle M key). Player, food, boundary</li>
          <li><strong>Full Map:</strong> Press M for full-screen arena map</li>
          <li><strong>Commission indicator:</strong> Rate shown below extraction progress bar</li>
        </ul>
      </InfoCard>
    </Section>
  );
}
