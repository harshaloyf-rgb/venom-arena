import { db } from '../src/lib/db';
import bcrypt from 'bcryptjs';

// Canonical owner/admin account.
// Idempotent: safe to re-run (updates password/chips if the account exists,
// creates it if missing).
// Run with: ADMIN_EMAIL=... ADMIN_PASSWORD=... bun scripts/create-admin.ts
// Credentials come from the environment — NEVER hardcode them in this public repo.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const ADMIN_CHIPS = 1_000_000_000; // ~1 billion — owner account

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables first.');
  process.exit(1);
}

async function main() {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  const data = {
    email: ADMIN_EMAIL,
    emailVerified: true,
    passwordHash: hash,
    userTag: 'VIPER-ADMIN',
    name: 'Admin',
    country: 'IN',
    region: 'SA',
    role: 'admin' as const,
    bankedChips: ADMIN_CHIPS,
    totalEarned: ADMIN_CHIPS,
    level: 99,
    xp: 999999,
    lifetimeKills: 9999,
    lifetimeExtracts: 5000,
    bestStreak: 500,
    biggestExtract: 200,
    dailyStreak: 365,
    streakFreezes: 200,
    hasElitePass: true,
    unlockedSkins: JSON.stringify(['skin-default', 'trail-none', 'death-default']),
  };

  const player = await db.player.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: hash, role: 'admin', emailVerified: true },
    create: data,
  });
  console.log('Admin ready:', player.id, player.userTag, player.email, 'role:', player.role);
  await db.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
