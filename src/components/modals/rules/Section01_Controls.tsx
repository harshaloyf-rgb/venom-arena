/* Section 1 — Controls */
'use client';

import { Gamepad } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section01_Controls() {
  return (
    <Section icon={<Gamepad className="w-4 h-4" />} title="1. CONTROLS" accent="text-cyan-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard title="🖱️ Mouse / Touch" accent="text-cyan-300">
          Move cursor to steer. Left-click or hold for Boost. On mobile, drag the joystick — push far for boost.
        </InfoCard>
        <InfoCard title="⌨️ Keyboard" accent="text-amber-300">
          WASD or Arrow Keys to steer. Hold Space/Shift for Boost. Hold E for Extract.
        </InfoCard>
      </div>
    </Section>
  );
}
