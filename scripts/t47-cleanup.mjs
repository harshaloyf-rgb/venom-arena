import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

// Delete test clans first (child rows via cascade), then throwaway players
await db.clan.deleteMany({ where: { tag: { in: ['T47A', 'T47B'] } } });
const guests = await db.player.findMany({ where: { OR: [{ userTag: { startsWith: 'VM-T47' } }, { userTag: { in: ['VM-6q5p9c', 'VM-lpia7p', 'VM-uocbwk', 'VM-y8t4ix'] } }] }, select: { id: true, userTag: true } });
console.log('deleting guests:', guests.map(g => g.userTag).join(', '));
await db.player.deleteMany({ where: { id: { in: guests.map(g => g.id) } } });

// Residual check on baseline clan
const residReq = await db.clanJoinRequest.count({ where: { clanTag: 'MP12' } });
const residInv = await db.clanInvite.count();
if (residReq) await db.clanJoinRequest.deleteMany({ where: { clanTag: 'MP12' } });

const players = await db.player.count();
const clans = await db.clan.findMany({ select: { tag: true } });
const regs = await db.championshipRegistration.count();
const hof = await db.hallOfFameEntry.count();
const friends = await db.friendship.count();
const invites = await db.clanInvite.count();
const jreqs = await db.clanJoinRequest.count();
console.log(JSON.stringify({ players, clans: clans.map(c => c.tag), regs, hof, friends, invites, joinRequests: jreqs }));
await db.$disconnect();
