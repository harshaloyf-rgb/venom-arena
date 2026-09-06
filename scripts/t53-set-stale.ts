// T53 baseline evidence: set a STALE daily-cap state (passXpToday from yesterday)
// so the Season Pass page's missing passXpDate check becomes visible in the UI.
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const tag = process.env.USER_TAG || 'VM-0oelp9';
const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
await db.player.update({ where: { userTag: tag }, data: { passXpToday: 1500, passXpDate: y } });
const p = await db.player.findUnique({ where: { userTag: tag }, select: { passXpToday: true, passXpDate: true, passXp: true } });
console.log('SET stale:', JSON.stringify(p));
await db.$disconnect();
