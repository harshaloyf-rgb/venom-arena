import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const reqs = await db.clanJoinRequest.findMany({
  where: { clanTag: 'T47B' },
  include: { player: { select: { userTag: true } } },
});
console.log(JSON.stringify(reqs.map(r => ({ id: r.id.slice(-6), player: r.player.userTag, status: r.status, respondedBy: r.respondedBy })), null, 2));
await db.$disconnect();
