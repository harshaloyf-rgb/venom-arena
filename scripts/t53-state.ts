// T53 verification helper — snapshot/restore admin Cyber Pass state around
// live browser tests. Usage:
//   bun run scripts/t53-state.ts snapshot   -> prints JSON snapshot to scripts/t53-snapshot.json
//   bun run scripts/t53-state.ts restore    -> restores from scripts/t53-snapshot.json (also deletes pass purchase rows)
//   bun run scripts/t53-state.ts show       -> prints current pass state
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const db = new PrismaClient();
const TAG = process.env.USER_TAG || 'VM-0oelp9';
const SNAP = 'scripts/t53-snapshot.json';
const mode = process.argv[2] || 'show';

const select = {
  id: true, unlockedSkins: true, passXp: true, passXpToday: true, passXpDate: true,
  hasElitePass: true, passClaimedFree: true, passClaimedElite: true, xp: true, level: true,
} as const;

const p = await db.player.findUniqueOrThrow({ where: { userTag: TAG }, select });

if (mode === 'snapshot') {
  const purchases = await db.purchase.count({ where: { playerId: p.id, itemType: { in: ['pass-cosmetic', 'pass-chip', 'elite-pass'] } } });
  writeFileSync(SNAP, JSON.stringify({ player: p, passPurchaseCount: purchases }, null, 2));
  console.log('snapshot saved:', JSON.stringify({ ...p, passPurchaseCount: purchases }));
} else if (mode === 'restore') {
  if (!existsSync(SNAP)) throw new Error('no snapshot file');
  const snap = JSON.parse(readFileSync(SNAP, 'utf8'));
  await db.purchase.deleteMany({ where: { playerId: p.id, itemType: { in: ['pass-cosmetic', 'pass-chip', 'elite-pass'] } } });
  // Re-insert the original number of pass purchase rows is not possible
  // (they were real pre-test rows only if passPurchaseCount > 0 — the admin
  // account started at 0 in this session; guard anyway).
  const restored = await db.player.update({
    where: { userTag: TAG },
    data: {
      unlockedSkins: snap.player.unlockedSkins,
      passXp: snap.player.passXp,
      passXpToday: snap.player.passXpToday,
      passXpDate: snap.player.passXpDate,
      hasElitePass: snap.player.hasElitePass,
      passClaimedFree: snap.player.passClaimedFree,
      passClaimedElite: snap.player.passClaimedElite,
    },
  });
  console.log('restored:', JSON.stringify({ passXp: restored.passXp, hasElitePass: restored.hasElitePass, claimedFree: restored.passClaimedFree, unlockedSkinsLen: JSON.parse(restored.unlockedSkins || '[]').length }));
  if (snap.passPurchaseCount > 0) console.log(`WARN: snapshot had ${snap.passPurchaseCount} pass purchase rows — re-create manually if needed.`);
} else {
  console.log(JSON.stringify({
    passXp: p.passXp, passXpToday: p.passXpToday, passXpDate: p.passXpDate,
    hasElitePass: p.hasElitePass, claimedFree: p.passClaimedFree, claimedElite: p.passClaimedElite,
    unlockedSkins: JSON.parse(p.unlockedSkins || '[]'), xp: p.xp, level: p.level,
  }, null, 1));
}

await db.$disconnect();
