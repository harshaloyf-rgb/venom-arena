'use client';

import { SubHeading, Bullet, Note, TwoColumnTable } from './_helpers';

export function SectionConfiguration() {
  return (
    <div className="space-y-1">
      <SubHeading>Game Configuration Page</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Game config is managed at the <strong className="text-slate-200">/admin</strong> route (separate page, not a tab).
        </Bullet>
        <Bullet>
          The configuration page provides a full form for all tunable game parameters.
        </Bullet>
      </ul>

      <SubHeading>Configuration Categories</SubHeading>
      <TwoColumnTable
        rows={[
          { label: 'Snake Physics', value: 'Speed, acceleration, deceleration, turn rate' },
          { label: 'Growth', value: 'Length per food, max length, growth rate' },
          { label: 'Boost', value: 'Boost speed multiplier, boost drain rate, cooldown' },
          { label: 'Collision', value: 'Self-collision, wall collision, head-on rules' },
          { label: 'Food', value: 'Spawn rate, food types, nutritional value' },
          { label: 'Extraction', value: 'Extraction zone timing, chip conversion rate' },
          { label: 'Spawning', value: 'Safe spawn duration, spawn location logic' },
          { label: 'Map', value: 'Arena size, boundary type, grid visibility' },
          { label: 'Bots', value: 'Bot count, difficulty, behavior patterns' },
          { label: 'Economy', value: 'Daily claim amounts, match buy-in, rewards' },
        ]}
      />

      <SubHeading>Applying Changes</SubHeading>
      <ul className="space-y-1.5 ml-1">
        <Bullet>
          Configuration changes take effect <strong className="text-emerald-400">immediately</strong> upon saving.
        </Bullet>
        <Bullet>
          A <strong className="text-slate-200">Reset to Defaults</strong> button is available to restore all values to their shipped defaults.
        </Bullet>
      </ul>

      <Note>
        <strong>Always test configuration changes in a practice arena first.</strong> Changing physics or economy values without testing can severely impact player experience. Document all changes with timestamps.
      </Note>
    </div>
  );
}