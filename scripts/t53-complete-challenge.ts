// T53: mark one unclaimed DAILY challenge of the test player as completed so
// the claim flow (+25 Pass XP) can be exercised end-to-end in the browser.
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const TAG = process.env.USER_TAG || 'VM-0oelp9';
const p = await db.player.findUniqueOrThrow({ where: { userTag: TAG }, select: { id: true } });
const ch = await db.challenge.findFirst({ where: { playerId: p.id, type: 'daily', claimed: false }, orderBy: { createdAt: 'asc' } });
if (!ch) { console.log('NO unclaimed daily challenge found'); process.exit(1); }
await db.challenge.update({ where: { id: ch.id }, data: { current: ch.target, completed: true } });
console.log('completed challenge:', ch.id, ch.title, `${ch.current}/${ch.target}`, 'reward', ch.reward);
await db.$disconnect();
