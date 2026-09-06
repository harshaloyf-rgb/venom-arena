import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Wipe all clan/invite/request state and all non-admin players (dev DB reset for audit re-runs)
await db.clanWar.deleteMany({});
await db.clanPurchase.deleteMany({});
await db.clanChallenge.deleteMany({});
await db.clanActivity.deleteMany({});
await db.clanMessage.deleteMany({});
await db.clanInvite.deleteMany({});
await db.clanJoinRequest.deleteMany({});
await db.clan.deleteMany({});
const del = await db.player.deleteMany({ where: { role: { not: 'admin' } } });
console.log('cleaned. players deleted:', del.count);
await db.$disconnect();
