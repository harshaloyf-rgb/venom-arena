import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const p = await db.player.findUniqueOrThrow({ where: { userTag: 'VM-0oelp9' }, select: { id: true } });
const rows = await db.purchase.findMany({ where: { playerId: p.id, itemType: { in: ['pass-cosmetic', 'pass-chip', 'elite-pass'] } } });
console.log('pass purchase rows:', rows.length);
await db.$disconnect();
