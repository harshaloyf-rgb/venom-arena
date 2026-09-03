import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/health — deployment self-check (public, no sensitive data).
 *
 * Purpose: on a VPS whose database schema is behind the deployed code, the
 * newer API routes 500 and the lobby shows "Network error" / "Failed to load
 * clips" / "claims fail". This endpoint reports exactly which tables are
 * missing so the operator knows to run `npx prisma db push`. One curl,
 * instant diagnosis:
 *
 *   curl -s https://your-server/api/health
 */
const TABLE_CHECKS: Array<[label: string, run: () => Promise<number>]> = [
  ['Player', () => db.player.count()],
  ['PlayerMilestone', () => db.playerMilestone.count()],
  ['HallOfFameEntry', () => db.hallOfFameEntry.count()],
  ['ChampionshipRegistration', () => db.championshipRegistration.count()],
  ['Clip', () => db.clip.count()],
  ['ClipUpvote', () => db.clipUpvote.count()],
  ['HourlyClaim', () => db.hourlyClaim.count()],
  ['Challenge', () => db.challenge.count()],
  ['Referral', () => db.referral.count()],
  ['StoreOrder', () => db.storeOrder.count()],
  ['Friendship', () => db.friendship.count()],
  ['Follow', () => db.follow.count()],
  ['Rival', () => db.rival.count()],
  ['Clan', () => db.clan.count()],
  ['ClanWar', () => db.clanWar.count()],
  ['ClanActivity', () => db.clanActivity.count()],
  ['MatchHistory', () => db.matchHistory.count()],
  ['DailyClaim', () => db.dailyClaim.count()],
];

export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (e) {
    console.error('[health] database unreachable', e);
    return NextResponse.json(
      { ok: false, database: 'unreachable', action: 'Check DATABASE_URL and that the SQLite file exists / is writable.' },
      { status: 500 },
    );
  }

  const tables: Record<string, number | 'MISSING'> = {};
  const missing: string[] = [];

  for (const [table, run] of TABLE_CHECKS) {
    try {
      tables[table] = await run();
    } catch {
      // P2021 "table does not exist" (schema drift) or any other model error
      tables[table] = 'MISSING';
      missing.push(table);
    }
  }

  return NextResponse.json({
    ok: missing.length === 0,
    database: 'connected',
    latencyMs: Date.now() - started,
    tables,
    missingTables: missing,
    ...(missing.length > 0
      ? { action: 'Run: npx prisma db push  (then restart the Next app AND the game server)' }
      : {}),
    timestamp: new Date().toISOString(),
  });
}
