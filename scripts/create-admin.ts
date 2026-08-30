import { db } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const hash = bcrypt.hashSync('123456', 10);
  try {
    const player = await db.player.create({
      data: {
        email: 'harshpawar57@gmail.com',
        emailVerified: true,
        passwordHash: hash,
        userTag: 'VIPER-ADMIN',
        name: 'Admin',
        country: 'IN',
        region: 'SA',
        role: 'admin',
        bankedChips: 999999,
        totalEarned: 999999,
        level: 99,
        xp: 999999,
        lifetimeKills: 9999,
        lifetimeExtracts: 5000,
        bestStreak: 500,
        biggestExtract: 200,
        dailyStreak: 365,
        streakFreezes: 200,
        hasElitePass: true,
        unlockedSkins: JSON.stringify(['skin-default','trail-none','death-default']),
      }
    });
    console.log('Admin created:', player.id, player.userTag);
  } catch (e: any) {
    console.error('Error:', e.message);
  }
  await db.$disconnect();
}
main();
