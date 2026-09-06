// T58 — revert QA mutations to the exact pre-test baseline (t58-baseline.json)
// Keeps: audit rows (append-only operational history — precedent from T53/T54).
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const db = new PrismaClient();
const base = JSON.parse(fs.readFileSync('/home/z/my-project/scripts/t58-baseline.json', 'utf8'));
const pid = base.playerId;
const p = base.player;

// Claim/hourly/spin chips deltas: daily 10 + hourly 146 + spins (52 + 648) = 856 earned,
// 200 spent on the paid spin → net banked +656. totalEarned only tracks gains (+856).
const cur = await db.player.findUnique({ where: { id: pid }, select: { bankedChips: true, totalEarned: true, dailyStreak: true, lastDailyClaim: true, streakFreezes: true } });
console.log('before:', cur);

await db.player.update({
  where: { id: pid },
  data: {
    bankedChips: p.bankedChips,
    totalEarned: p.totalEarned,
    dailyStreak: p.dailyStreak,
    lastDailyClaim: p.lastDailyClaim,
    lastHourlyClaim: p.lastHourlyClaim,
    streakFreezes: p.streakFreezes,
  },
});
await db.dailyClaim.deleteMany({ where: { playerId: pid } });
await db.hourlyClaim.deleteMany({ where: { playerId: pid } });
await db.luckySpin.deleteMany({ where: { playerId: pid } });

const after = await db.player.findUnique({ where: { id: pid }, select: { bankedChips: true, totalEarned: true, dailyStreak: true, lastDailyClaim: true, lastHourlyClaim: true, streakFreezes: true } });
const counts = {
  dailyClaims: await db.dailyClaim.count({ where: { playerId: pid } }),
  hourlyClaims: await db.hourlyClaim.count({ where: { playerId: pid } }),
  luckySpins: await db.luckySpin.count({ where: { playerId: pid } }),
};
console.log('after:', after, counts);
const match = JSON.stringify(after) === JSON.stringify(p) && counts.dailyClaims === 0 && counts.hourlyClaims === 0 && counts.luckySpins === 0;
console.log(match ? 'REVERT EXACT ✓' : 'MISMATCH ✗');
process.exit(match ? 0 : 1);
