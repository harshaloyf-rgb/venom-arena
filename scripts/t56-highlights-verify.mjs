// T56 — Highlights page audit: E2E verification script
// 1) Snapshot admin state
// 2) Seed test clips (approved YT w/ description, shorts, reels, pending, rejected)
// 3) PROOF: /api/match/result now auto-publishes Match Cards (was dead code)
// 4) PROOF: practice arenas never publish + death trigger works
// 5) PROOF: featured endpoint picks today's best match card as Top Play
// 6) Mint va_session cookie for browser testing
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
const BASE = 'http://localhost:3000';
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const ADMIN_TAG = 'VM-0oelp9';

async function main() {
  const admin = await db.player.findUnique({ where: { userTag: ADMIN_TAG } });
  if (!admin) throw new Error('admin not found: ' + ADMIN_TAG);
  console.log(`admin: ${admin.name} ${admin.userTag} chips=${admin.bankedChips}`);

  // ── 1) Snapshot admin pre-state (exact restore later) ──
  const snap = {
    bankedChips: admin.bankedChips, totalEarned: admin.totalEarned, totalLost: admin.totalLost,
    xp: admin.xp, level: admin.level, lifetimeKills: admin.lifetimeKills,
    lifetimeExtracts: admin.lifetimeExtracts, lifetimeDeaths: admin.lifetimeDeaths,
    biggestExtract: admin.biggestExtract, bestStreak: admin.bestStreak,
    passXp: admin.passXp, passXpToday: admin.passXpToday, passXpDate: admin.passXpDate,
  };

  // ── 2) Seed clips owned by admin ──
  const seedTitles = [
    'T56QA — INSANE 1v2 Extraction in Neon Grid!',
    'T56QA — Short: 5-Kill Streak Scrap Alley Run',
    'T56QA — Reel: Diamond Nexus clutch bank',
    'T56QA — PENDING clip waiting for review',
    'T56QA — REJECTED clip (audit test)',
  ];
  await db.clip.deleteMany({ where: { title: { startsWith: 'T56QA' } } });
  const yt = await db.clip.create({ data: {
    playerId: admin.id, title: seedTitles[0],
    description: 'Down to 10 HP, grabbed the extraction with two snakes chasing — audit seed with a description.',
    platform: 'YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    chipsExtracted: 12500, kills: 4, arenaName: 'Neon Grid',
    tags: JSON.stringify(['Community']), cardType: 'user-clip', status: 'approved',
  }});
  const short = await db.clip.create({ data: {
    playerId: admin.id, title: seedTitles[1], description: '',
    platform: 'YouTube Shorts', url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    chipsExtracted: 0, kills: 5, arenaName: 'Scrap Alley',
    tags: JSON.stringify(['Community']), cardType: 'user-clip', status: 'approved',
  }});
  const reel = await db.clip.create({ data: {
    playerId: admin.id, title: seedTitles[2], description: 'Clutch bank with 3.2M carried.',
    platform: 'Instagram', url: 'https://www.instagram.com/reel/Cxyz123/',
    chipsExtracted: 3200000, kills: 2, arenaName: 'Diamond Nexus',
    tags: JSON.stringify(['Community']), cardType: 'user-clip', status: 'approved',
  }});
  const pending = await db.clip.create({ data: {
    playerId: admin.id, title: seedTitles[3], description: 'Should show PENDING REVIEW badge.',
    platform: 'YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    chipsExtracted: 900, kills: 1, arenaName: 'Scrap Alley',
    tags: JSON.stringify(['Community']), cardType: 'user-clip', status: 'pending',
  }});
  const rejected = await db.clip.create({ data: {
    playerId: admin.id, title: seedTitles[4], description: 'Should show REJECTED badge.',
    platform: 'YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    chipsExtracted: 0, kills: 0, arenaName: '',
    tags: JSON.stringify(['Community']), cardType: 'user-clip', status: 'rejected',
  }});
  await db.clipUpvote.create({ data: { playerId: admin.id, clipId: yt.id, voteType: 'like' } });
  await db.clip.update({ where: { id: yt.id }, data: { upvotes: 7, downvotes: 1 } });
  await db.clip.update({ where: { id: short.id }, data: { upvotes: 3 } });
  check('seed: 5 clips created (2 pending/rejected for badge test)', true, `${yt.id.slice(-6)},${pending.id.slice(-6)},${rejected.id.slice(-6)}`);

  // ── 3) PROOF: match/result auto-publishes Match Cards ──
  const matchCardsBefore = await db.clip.count({ where: { cardType: 'match-card' } });
  const ts = Date.now();
  const res1 = await fetch(`${BASE}/api/match/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_SECRET },
    body: JSON.stringify({
      userTag: ADMIN_TAG, arenaId: 'tier-4', outcome: 'extract',
      carriedChips: 6000, bankedAmount: 6000, kills: 2, durationSeconds: 120,
      score: 500, starsCollected: 3, timestamp: ts,
    }),
  });
  const j1 = await res1.json();
  check('match/result extract 200', res1.ok, res1.ok ? `chipsEarned=${j1.chipsEarned}` : JSON.stringify(j1));

  const newCard = await db.clip.findFirst({
    where: { cardType: 'match-card', player: { userTag: ADMIN_TAG } },
    orderBy: { createdAt: 'desc' },
  });
  const matchCardsAfter1 = await db.clip.count({ where: { cardType: 'match-card' } });
  check('auto-publish: extract 6,000c created a Match Card', !!newCard && matchCardsAfter1 === matchCardsBefore + 1,
    newCard ? `"${newCard.title}" arena=${newCard.arenaName} status=${newCard.status} matchId=${newCard.matchId ? 'set' : 'null'}` : 'NO CARD');
  check('auto-publish: title uses Indian short form + auto-approved', !!newCard && newCard.title.includes('6.0K') && newCard.status === 'approved', newCard?.title);

  // Practice gate: impressive practice match must NOT create a card
  const res2 = await fetch(`${BASE}/api/match/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_SECRET },
    body: JSON.stringify({
      userTag: ADMIN_TAG, arenaId: 'practice-easy', outcome: 'extract',
      carriedChips: 100, bankedAmount: 100, kills: 10, durationSeconds: 60,
      score: 200, starsCollected: 0, timestamp: Date.now(),
    }),
  });
  const matchCardsAfter2 = await db.clip.count({ where: { cardType: 'match-card' } });
  check('practice arena does NOT auto-publish', res2.ok && matchCardsAfter2 === matchCardsAfter1, `cards=${matchCardsAfter2}`);

  // Death trigger: 5+ kills death in a real arena → card
  const res3 = await fetch(`${BASE}/api/match/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_SECRET },
    body: JSON.stringify({
      userTag: ADMIN_TAG, arenaId: 'tier-4', outcome: 'death',
      carriedChips: 500, kills: 5, durationSeconds: 90,
      score: 300, killerName: 'Net-817 (bot)', killerIsBot: true, timestamp: Date.now(),
    }),
  });
  const deathCard = await db.clip.findFirst({
    where: { cardType: 'match-card', title: { contains: 'Eliminations Before Falling' } },
    orderBy: { createdAt: 'desc' },
  });
  check('death with 5 kills auto-publishes combat card', res3.ok && !!deathCard, deathCard?.title || 'NO CARD');

  // ── 4) Featured endpoint → today's best match card is the Top Play ──
  const fRes = await fetch(`${BASE}/api/clips/featured`);
  const fJson = await fRes.json();
  check('featured fallback = today\'s best match card', !!fJson.clip && fJson.clip.cardType === 'match-card', fJson.clip ? `"${fJson.clip.title}"` : 'none');

  // ── 5) stats/live returns topTodayClip (Best extract chip data) ──
  const sRes = await fetch(`${BASE}/api/stats/live`);
  const sJson = await sRes.json();
  check('stats/live topTodayClip present', !!sJson.topTodayClip, sJson.topTodayClip ? `${sJson.topTodayClip.chipsExtracted}c by ${sJson.topTodayClip.player.name}` : 'null');
  check('stats/live today counts include the test matches', sJson.today.totalMatches >= 3, JSON.stringify(sJson.today));

  // ── 6) Mint session cookie for browser tests ──
  const jwt = await import('jsonwebtoken');
  const token = jwt.default.sign(
    { playerId: admin.id, userTag: admin.userTag, role: 'admin', tokenVersion: admin.tokenVersion, scope: 'session' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' },
  );
  console.log(`\nCOOKIE=va_session=${token}`);

  // Persist state needed by cleanup + browser steps
  const { writeFileSync } = await import('fs');
  writeFileSync('/home/z/my-project/scripts/t56-state.json', JSON.stringify({
    snap, seededIds: [yt.id, short.id, reel.id, pending.id, rejected.id],
    testStartedAt: new Date(Date.now() - 60_000).toISOString(),
    autoCardId: newCard?.id, deathCardId: deathCard?.id,
  }, null, 2));

  const fails = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
  await db.$disconnect();
  process.exit(fails > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error('FATAL', e); await db.$disconnect(); process.exit(2); });
