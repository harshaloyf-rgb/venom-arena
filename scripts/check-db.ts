import { db } from '../src/lib/db';
async function main() {
  const matchCount = await db.matchHistory.count();
  console.log('MatchHistory count:', matchCount);
  const milestoneCount = await db.milestone.count();
  console.log('Milestone count:', milestoneCount);
  const playerCount = await db.player.count();
  console.log('Player count:', playerCount);
  const players = await db.player.findMany({ select: { id: true, name: true, email: true } });
  console.log('Players:', JSON.stringify(players, null, 2));
  await db.$disconnect();
}
main();
