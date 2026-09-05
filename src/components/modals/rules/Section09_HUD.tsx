/* Section 9 — In-Game HUD Explained */
'use client';

import { Gamepad } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section09_HUD() {
  return (
    <Section icon={<Gamepad className="w-4 h-4" />} title="9. IN-GAME HUD EXPLAINED" accent="text-indigo-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard title="Top-Left: Exit, Connection &amp; Status Stack" accent="text-emerald-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Exit button (✕):</strong> Top-left corner. Leaves the match (online: you forfeit your carried chips)</li>
            <li><strong>Connection badge:</strong> Next to it — <strong>LIVE</strong> (green) when connected, or the current status (e.g. CONNECTING / DISCONNECTED) in red</li>
            <li><strong>Minimap:</strong> Always-on circular radar below the exit button — shows you, other snakes and the arena edge</li>
            <li><strong>Rank:</strong> Under the minimap — &quot;Rank X / Y&quot; among all alive snakes</li>
            <li><strong>Carried Chips (online only):</strong> Under the rank — your carried chip total plus the breakdown (&quot;buy-in + stars collected&quot;). Hidden in offline practice</li>
          </ul>
        </InfoCard>
        <InfoCard title="Top-Right: Best Ever &amp; Arena Leaderboard" accent="text-cyan-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Best Ever:</strong> Your all-time high score for quick reference</li>
            <li><strong>Arena Leaderboard (top 10):</strong> Toggle between <strong>Chips</strong> (default — carried chips) and <strong>Score</strong> (body length, 👑 crown for #1)</li>
            <li>Your entry is <strong>highlighted in green</strong></li>
            <li><strong>Empty state:</strong> &quot;No chip holders yet&quot; / &quot;Waiting...&quot;</li>
            <li>In Score view, bots appear too; in Chips view only chip holders are listed (bots carry no chips)</li>
          </ul>
        </InfoCard>
        <InfoCard title="Bottom Edge: Score, Kills &amp; Action Buttons" accent="text-amber-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Score:</strong> Bottom-center card — your current body length/score</li>
            <li><strong>Kills:</strong> Bottom-right card — opponents you&apos;ve eliminated</li>
            <li><strong>BOOST button:</strong> Bottom-left orange button (B / Left Click). Hold to boost — drains score, drops food</li>
            <li><strong>EXTRACT button:</strong> Bottom-left amber button (E / Right Click). Hold for 3s to bank your carried chips</li>
            <li><strong>Keyboard:</strong> WASD/Arrows steer, Space/Shift/B boost, hold E to extract</li>
          </ul>
        </InfoCard>
        <InfoCard title="Overlays &amp; Indicators" accent="text-rose-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Extraction ring:</strong> White-to-green ring around your head while extracting (only you can see it)</li>
            <li><strong>Death screen:</strong> &quot;ELIMINATED&quot; card with your killer highlighted, plus View Profile / Add Friend / Add Rival actions and your banked/lost summary</li>
            <li><strong>Spectating:</strong> After death you can watch the arena while the death card floats over the action</li>
            <li><strong>Disconnect grace:</strong> If you drop, your snake stays alive for 12 seconds so you can reconnect</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
