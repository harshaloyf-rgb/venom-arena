// One-off migration (audit A3): hash any PLAINTEXT securityPin rows.
// Plaintext rows are 4-6 digit strings; bcrypt hashes start with '$2'.
// Run: bun scripts/migrate-security-pins.ts   (from repo root)
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const players = await db.player.findMany({
    where: { securityPin: { not: null } },
    select: { id: true, userTag: true, securityPin: true },
  });

  let migrated = 0;
  let alreadyHashed = 0;
  for (const p of players) {
    const pin = p.securityPin as string;
    if (pin.startsWith('$2')) {
      alreadyHashed++;
      continue;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      console.log(`SKIP ${p.userTag}: unexpected pin format (len ${pin.length})`);
      continue;
    }
    const hash = await bcrypt.hash(pin, 10);
    await db.player.update({ where: { id: p.id }, data: { securityPin: hash } });
    migrated++;
  }
  console.log(`DONE: ${migrated} plaintext PINs hashed, ${alreadyHashed} already hashed, ${players.length - migrated - alreadyHashed} skipped`);
}

main().finally(() => db.$disconnect());
