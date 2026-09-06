import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const BILLION = 1_000_000_000;

// Run with: ADMIN_EMAIL=... bun scripts/restore-admin.ts (never hardcode creds here)
if (!process.env.ADMIN_EMAIL) {
  console.error('Set the ADMIN_EMAIL environment variable first.');
  process.exit(1);
}

const admin = await db.player.update({
  where: { email: process.env.ADMIN_EMAIL },
  data: {
    role: 'admin',
    bankedChips: BILLION,
    totalEarned: BILLION,
  },
  select: { id: true, email: true, name: true, userTag: true, role: true, bankedChips: true },
});

console.log('ADMIN RESTORED:', JSON.stringify(admin));
await db.$disconnect();
