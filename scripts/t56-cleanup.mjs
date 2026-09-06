// T56 cleanup — remove ALL test data and restore admin's exact pre-test state
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnv('/home/z/my-project/venom-arena/.env');
loadEnv('/home/z/my-project/venom-arena/.env.local');

const db = new PrismaClient();
const { snap, testStartedAt } = JSON.parse(readFileSync('/home/z/my-project/scripts/t56-state.json', 'utf8'));
const ADMIN_TAG = 'VM-0oelp9';

async function main() {
  const admin = await db.player.findUnique({ where: { userTag: ADMIN_TAG } });
  if (!admin) throw new Error('admin missing');

  // 1) Delete test clips (QA seeds + browser-submitted + auto-published match cards)
  const delVotes = await db.clipUpvote.deleteMany({ where: { clip: { title: { startsWith: 'T56Q' } } } }).catch(() => null);
  // ClipUpvote has no clip relation — delete by clipId list instead
  const testClips = await db.clip.findMany({
    where: {
      OR: [
        { title: { startsWith: 'T56Q' } },
        { cardType: 'match-card', createdAt: { gte: new Date(testStartedAt) } },
      ],
    },
    select: { id: true, title: true },
  });
  if (testClips.length) {
    await db.clipUpvote.deleteMany({ where: { clipId: { in: testClips.map(c => c.id) } } });
  }
  const delClips = await db.clip.deleteMany({
    where: {
      OR: [
        { title: { startsWith: 'T56Q' } },
        { cardType: 'match-card', createdAt: { gte: new Date(testStartedAt) } },
      ],
    },
  });

  // 2) Delete test match-history rows
  const delHistory = await db.matchHistory.deleteMany({
    where: { playerId: admin.id, createdAt: { gte: new Date(testStartedAt) } },
  });

  // 3) Restore admin snapshot exactly
  await db.player.update({
    where: { id: admin.id },
    data: {
      bankedChips: snap.bankedChips, totalEarned: snap.totalEarned, totalLost: snap.totalLost,
      xp: snap.xp, level: snap.level, lifetimeKills: snap.lifetimeKills,
      lifetimeExtracts: snap.lifetimeExtracts, lifetimeDeaths: snap.lifetimeDeaths,
      biggestExtract: snap.biggestExtract, bestStreak: snap.bestStreak,
      passXp: snap.passXp, passXpToday: snap.passXpToday, passXpDate: snap.passXpDate,
    },
  });

  // 4) Verify
  const remainingClips = await db.clip.count();
  const remainingTest = await db.clip.count({ where: { title: { startsWith: 'T56Q' } } });
  const after = await db.player.findUnique({ where: { userTag: ADMIN_TAG } });
  const drift = [];
  for (const k of Object.keys(snap)) {
    const a = after[k] instanceof Date ? after[k].toISOString() : after[k];
    const b = snap[k] instanceof Date ? snap[k] : snap[k];
    if (String(a) !== String(b)) drift.push(`${k}: ${b} -> ${a}`);
  }
  console.log(`clips deleted: ${delClips.count} (vote rows: ${delVotes?.count ?? 'n/a'}), history deleted: ${delHistory.count}`);
  console.log(`remaining clips in DB: ${remainingClips} (test clips: ${remainingTest})`);
  console.log(drift.length ? `ADMIN DRIFT: ${drift.join(', ')}` : 'admin state restored exactly ✓');
  await db.$disconnect();
  process.exit(drift.length || remainingTest > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error('FATAL', e); await db.$disconnect(); process.exit(2); });
