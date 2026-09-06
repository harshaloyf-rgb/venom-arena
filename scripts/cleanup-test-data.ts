import { db } from '../src/lib/db';

// One-off cleanup: remove ALL seeded/audit test accounts and their artifacts
// from the DEV database so the preview shows no fake players.
// Keep only the real admin account. Player deletes cascade to most child rows
// (claims, spins, milestones, HOF, clips, follows, rivals, friendships, gifts,
// registrations, purchases, sessions). Clan + clan-scoped rows are removed
// explicitly since Clan is keyed by tag, not playerId.

// Run with: ADMIN_EMAIL=... bun scripts/cleanup-test-data.ts
// (owner email comes from env — never hardcode it in this public repo)
if (!process.env.ADMIN_EMAIL) {
  console.error('Set the ADMIN_EMAIL environment variable first (refusing to delete without a keep-list).');
  process.exit(1);
}
const KEEP_EMAILS = new Set([process.env.ADMIN_EMAIL]);

async function main() {
  const doomed = await db.player.findMany({
    where: {
      OR: [
        { email: { notIn: Array.from(KEEP_EMAILS) } },
        { email: null },
      ],
    },
    select: { id: true, userTag: true, name: true, bankedChips: true },
  });
  const ids = doomed.map((p) => p.id);
  console.log(`Deleting ${doomed.length} test players:`);
  doomed.forEach((p) => console.log(`  - ${p.name} [${p.userTag}] (${p.bankedChips}c)`));

  // Clan-scoped rows first (AUDT was created during the audit; delete any clan
  // whose only members are test players being removed)
  const clans = await db.clan.findMany({ select: { tag: true, name: true } });
  for (const clan of clans) {
    const memberCount = await db.player.count({ where: { clanTag: clan.tag } });
    if (memberCount === 0 || ids.length > 0) {
      // delete clan + scoped rows
      await db.clanActivity.deleteMany({ where: { clanTag: clan.tag } });
      await db.clanChallenge.deleteMany({ where: { clanTag: clan.tag } });
      await db.clanMessage.deleteMany({ where: { clanTag: clan.tag } });
      await db.clanPurchase.deleteMany({ where: { clanTag: clan.tag } });
      await db.clanWar.deleteMany({
        where: { OR: [{ declarerTag: clan.tag }, { targetTag: clan.tag }] },
      });
      const gone = await db.clan.deleteMany({ where: { tag: clan.tag } });
      if (gone.count) console.log(`  - clan ${clan.name} [${clan.tag}] deleted`);
    }
  }

  // Verification tokens may be keyed by playerId (cascade) — clean strays
  if (ids.length) {
    await db.verificationToken.deleteMany({ where: { playerId: { in: ids } } }).catch(() => 0);
  }

  // Players last — cascades wipe their child rows
  const res = await db.player.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted players: ${res.count}`);

  const remaining = await db.player.findMany({
    select: { userTag: true, name: true, email: true, role: true, bankedChips: true },
  });
  console.log('Remaining players:', JSON.stringify(remaining, null, 1));
  await db.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
