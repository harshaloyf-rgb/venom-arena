import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const reqs = await db.clanJoinRequest.findMany({ include: { player: { select: { userTag: true } } } });
console.log('ALL join requests:', JSON.stringify(reqs.map(r => ({ clan: r.clanTag, player: r.player.userTag, status: r.status }))));
const clans = await db.clan.findMany({ select: { tag: true, name: true } });
console.log('ALL clans:', JSON.stringify(clans));
await db.$disconnect();
