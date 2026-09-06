// T54 — revert QA mutations made to the admin test account during the
// Season Pass audit browser test (elite unlock + XP set + tier claims).
// Restores: pass fields, unlockedSkins, bankedChips; deletes the pass
// purchase rows created during the test. No credentials — env-driven.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const TAG = process.env.QA_TAG || 'VM-0oelp9';

const ORIGINAL_SKINS = JSON.stringify(['skin-default', 'trail-none', 'death-default']);
const TEST_SKINS = [
  'pass-f1-ember-worm', 'pass-f2-frost-viper', 'pass-f3-moss-python',
  'pass-e1-cyber-serpent', 'pass-e2-phantom-wraith', 'pass-e3-magma-titan',
];

const p = await db.player.findUnique({ where: { userTag: TAG } });
if (!p) { console.error('player not found:', TAG); process.exit(1); }

const before = {
  bankedChips: p.bankedChips, hasElitePass: p.hasElitePass, passXp: p.passXp,
  claimedFree: p.passClaimedFree, claimedElite: p.passClaimedElite,
  unlockedSkins: p.unlockedSkins, currentSkin: p.currentSkin,
};
console.log('BEFORE:', JSON.stringify(before, null, 2));

if (!before.hasElitePass && before.passXp === 0) {
  console.log('Nothing to revert — account already pristine.');
  await db.$disconnect();
  process.exit(0);
}

// Elite refund (100,000) minus claimed chip rewards (200 free T3 + 500 elite T3 = 700)
const CHIP_CLAIMS = 700;
const ELITE_REFUND = 100_000;

const updated = await db.$transaction(async (tx) => {
  // 1) delete pass-related purchase rows created during the test
  const del = await tx.purchase.deleteMany({
    where: {
      playerId: p.id,
      OR: [
        { itemType: 'elite-pass' },
        { itemType: 'pass-cosmetic' },
        { itemType: 'pass-chip' },
      ],
    },
  });
  console.log('purchase rows deleted:', del.count);

  // 2) restore player fields
  return tx.player.update({
    where: { id: p.id },
    data: {
      hasElitePass: false,
      passXp: 0,
      passXpToday: 0,
      passXpDate: null,
      passClaimedFree: '[]',
      passClaimedElite: '[]',
      unlockedSkins: ORIGINAL_SKINS,
      bankedChips: { increment: ELITE_REFUND - CHIP_CLAIMS },
    },
  });
});

console.log('AFTER:', JSON.stringify({
  bankedChips: updated.bankedChips,
  hasElitePass: updated.hasElitePass,
  passXp: updated.passXp,
  passXpToday: updated.passXpToday,
  passXpDate: updated.passXpDate,
  claimedFree: updated.passClaimedFree,
  claimedElite: updated.passClaimedElite,
  unlockedSkins: updated.unlockedSkins,
}, null, 2));

await db.$disconnect();
