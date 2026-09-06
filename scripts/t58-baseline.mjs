// T58 — snapshot the admin player's pre-test baseline (claims fields) for exact revert
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const db = new PrismaClient();
const admin = await db.player.findFirst({ where: { role: 'admin' }, select: { id: true, userTag: true } });
if (!admin) { console.error('no admin'); process.exit(1); }

const p = await db.player.findUnique({
  where: { id: admin.id },
  select: {
    bankedChips: true, totalEarned: true, dailyStreak: true, lastDailyClaim: true,
    lastHourlyClaim: true, streakFreezes: true,
  },
});
const counts = {
  dailyClaims: await db.dailyClaim.count({ where: { playerId: admin.id } }),
  hourlyClaims: await db.hourlyClaim.count({ where: { playerId: admin.id } }),
  luckySpins: await db.luckySpin.count({ where: { playerId: admin.id } }),
  streakMilestones: await db.streakMilestoneClaim.count({ where: { playerId: admin.id } }),
  promoRewards: await db.promoReward.count({ where: { playerId: admin.id } }),
};
const snapshot = { playerId: admin.id, userTag: admin.userTag, player: p, counts, takenAt: new Date().toISOString() };
fs.writeFileSync('/home/z/my-project/scripts/t58-baseline.json', JSON.stringify(snapshot, null, 2));
console.log(JSON.stringify(snapshot, null, 2));
process.exit(0);
