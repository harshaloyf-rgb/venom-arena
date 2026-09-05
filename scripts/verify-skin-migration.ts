/**
 * Verification for the 2026-09-05 premium-shop relocation (Task 24).
 * Imports the REAL registry + catalog and asserts:
 *  - ALL_COSMETICS now contains ONLY the 12 character faces
 *  - the 9 relocated uniques resolve via SKIN_PRESETS (same ids)
 *  - the 4 duplicates resolve via LEGACY_SKIN_ALIAS
 *  - epic-clean character faces still report rarity 'epic'
 *  - legacy ids resolve colors per segment (multi-color rendering)
 * Run: bun scripts/verify-skin-migration.ts
 */
import { ALL_COSMETICS } from '../src/lib/game-config';
import { SKIN_PRESETS, LEGACY_SKIN_ALIAS, resolveLegacySkinId } from '../src/components/panels/cosmetics/cosmetics-types';
import { getSkinAsset, getSegmentColor, isMultiColorSkin } from '../src/lib/snake/skin-registry';

let failures = 0;
function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  }
}

console.log('— catalog shape —');
check('ALL_COSMETICS has exactly 12 skins', ALL_COSMETICS.length === 12, `got ${ALL_COSMETICS.length}`);
check('ALL_COSMETICS are all character faces', ALL_COSMETICS.every((s) => !!s.headStyle));
check('no lab-proof wording anywhere in catalog', ALL_COSMETICS.every((s) => !s.description.toLowerCase().includes('lab-proof')));

console.log('— SKIN_PRESETS batch 3 (relocated uniques, original ids) —');
const relocated = ['skin-default', 'skin-venom', 'skin-cyber', 'skin-rainbow', 'skin-neonglow', 'skin-metallic', 'skin-camo', 'skin-gold', 'skin-crimson'];
check('9 relocated uniques present in SKIN_PRESETS', relocated.every((id) => SKIN_PRESETS.some((p) => p.id === id)));
for (const id of relocated) {
  const asset = getSkinAsset(id);
  check(`${id} resolves via registry`, asset.id === id && asset.name !== 'Unknown Skin', `${asset.name} / ${asset.bodyColor}`);
}

console.log('— legacy aliases (4 duplicate twins) —');
for (const [legacy, target] of Object.entries(LEGACY_SKIN_ALIAS)) {
  check(`resolveLegacySkinId(${legacy}) → ${target}`, resolveLegacySkinId(legacy) === target);
  const asset = getSkinAsset(legacy);
  check(`${legacy} resolves (was premium)`, asset.id === legacy && asset.name !== 'Unknown Skin', `${asset.name}`);
  check(`${legacy} is multi-color`, isMultiColorSkin(legacy));
  const c0 = getSegmentColor(legacy, 0);
  const c1 = getSegmentColor(legacy, 1);
  check(`${legacy} per-segment colors`, !!c0 && !!c1, `${c0} / ${c1}`);
}

console.log('— epic-clean character faces unchanged —');
for (const face of ALL_COSMETICS) {
  const asset = getSkinAsset(face.id);
  check(`${face.id} rarity=epic, anim=none`, asset.rarity === 'epic' && asset.animation === 'none');
}

console.log('— pools —');
check('SKIN_PRESETS grew to 73 (20 base + 20 expansion + 24 migrated + 9 relocated)', SKIN_PRESETS.length === 73, `got ${SKIN_PRESETS.length}`);
check('verify route seed: skin-default body color still Toxic Slime green', getSkinAsset('skin-default').bodyColor === '#22c55e');

if (failures > 0) {
  console.error(`\n${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
