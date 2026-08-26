import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  getTodaysDailyMissions,
  getThisWeeksWeeklyMissions,
  getISOWeek,
} from '@/lib/missions';

// GET /api/player/missions
// Returns today's daily + this week's weekly missions with player's persisted progress.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const week = getISOWeek(new Date());

  // Fetch all mission progress for this player (for today's daily + this week's weekly)
  const progress = await db.missionProgress.findMany({
    where: {
      playerId: session.playerId,
      OR: [
        { missionId: { startsWith: 'daily-' }, periodStart: today },
        { missionId: { startsWith: 'weekly-' }, periodStart: week },
      ],
    },
  });

  // Build lookup map: "missionId-periodStart" → progress row
  const progressMap = new Map<string, { current: number; completed: boolean; claimedAt: string | null }>();
  for (const p of progress) {
    progressMap.set(`${p.missionId}-${p.periodStart}`, {
      current: p.current,
      completed: p.completed,
      claimedAt: p.claimedAt,
    });
  }

  // Also check Purchase table for legacy claim records (backward compat with Phase 1)
  const purchaseClaims = await db.purchase.findMany({
    where: {
      playerId: session.playerId,
      itemType: 'mission_reward',
    },
    select: { itemId: true },
  });
  const claimedSet = new Set(purchaseClaims.map((p) => p.itemId)); // e.g. "mission-2026-01-15-daily-1"

  const dailyMissions = getTodaysDailyMissions(today).map((m) => {
    const p = progressMap.get(`${m.id}-${today}`);
    // Check legacy purchase claim
    const legacyClaimed = claimedSet.has(`mission-${today}-${m.id}`);
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      reward: m.reward,
      target: m.target,
      current: p?.current ?? 0,
      completed: p?.completed ?? false,
      claimed: !!(p?.claimedAt || legacyClaimed),
      category: m.category,
      difficulty: m.difficulty,
    };
  });

  const weeklyMissions = getThisWeeksWeeklyMissions(week).map((m) => {
    const p = progressMap.get(`${m.id}-${week}`);
    const legacyClaimed = claimedSet.has(`mission-${today}-${m.id}`);
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      reward: m.reward,
      target: m.target,
      current: p?.current ?? 0,
      completed: p?.completed ?? false,
      claimed: !!(p?.claimedAt || legacyClaimed),
      category: m.category,
      difficulty: m.difficulty,
    };
  });

  return NextResponse.json({
    missions: [...dailyMissions, ...weeklyMissions],
    date: today,
    week,
  });
}
