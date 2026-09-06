import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
await db.player.update({ where: { userTag: 'VM-0oelp9' }, data: { passXpToday: 0, passXpDate: null } });
console.log('reset ok');
await db.$disconnect();
