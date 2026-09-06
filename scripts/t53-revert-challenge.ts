import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const TAG = process.env.USER_TAG || 'VM-0oelp9';
const p = await db.player.findUniqueOrThrow({ where: { userTag: TAG }, select: { id: true, xp: true, bankedChips: true } });
// Revert the T53 test claim of 'Star Spark' (+20c, +25 xp)
const ch = await db.challenge.findFirst({ where: { playerId: p.id, title: 'Star Spark', claimed: true }, orderBy: { createdAt: 'desc' } });
if (ch) await db.challenge.update({ where: { id: ch.id }, data: { claimed: false, completed: false, current: 0 } });
const upd = await db.player.update({ where: { userTag: TAG }, data: { bankedChips: { decrement: 20 }, xp: 0, level: 1 } });
console.log('challenge reverted:', !!ch, '| bankedChips:', upd.bankedChips, '| xp:', upd.xp);
await db.$disconnect();
