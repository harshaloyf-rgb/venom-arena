import { db } from '@/lib/db';
import { hashPassword, generateUniqueUserTag } from '@/lib/auth';
import { encodeSkins, generateReferralCode } from '@/lib/player-helpers';
import { DEFAULT_UNLOCKED_SKINS } from '@/lib/constants';
import { REGISTERED_TOTAL_CHIPS } from '@/lib/game-config';

async function main() {
  const email = 'admin@venom.arena';
  const password = 'Admin@123';
  const passwordHash = await hashPassword(password);
  const userTag = await generateUniqueUserTag();
  const referralCode = generateReferralCode();

  const admin = await db.player.create({
    data: {
      email,
      passwordHash,
      userTag,
      name: 'Admin',
      country: 'US',
      role: 'admin',
      emailVerified: true,
      unlockedSkins: encodeSkins(DEFAULT_UNLOCKED_SKINS),
      bankedChips: REGISTERED_TOTAL_CHIPS,
      totalEarned: REGISTERED_TOTAL_CHIPS,
      referralCode,
    },
  });

  console.log('Admin created:');
  console.log('  Email:', email);
  console.log('  Password:', password);
  console.log('  UserTag:', userTag);
  console.log('  Chips:', admin.bankedChips);
  await db.disconnect();
}
main();
