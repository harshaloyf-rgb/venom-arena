import { db } from '@/lib/db';
import { formatChipsIndian } from '@/lib/format-chips';

// ============================================================================
// Highlights auto-publish (shared by /api/match/result and /api/player/match-history)
//
// WHY SHARED: the thresholds + title generator + clip row shape used to live
// only in POST /api/player/match-history — an endpoint with ZERO callers in
// the codebase. Real matches all flow through /api/match/result (game-server
// internal secret), which never created clips, so Match Cards were dead code
// and the Highlights feed stayed video-clips-only. Both routes now funnel
// through publishMatchCard() so the documented triggers can never drift.
// ============================================================================

// Auto-publish thresholds for the Highlights feed (documented in Rules S20)
export const AUTO_PUBLISH_MIN_CHIPS = 5000; // extraction with 5,000+ chips banked
export const AUTO_PUBLISH_MIN_KILLS = 3;    // extraction with 3+ kills
export const AUTO_PUBLISH_DEATH_KILLS = 5;  // death needs 5+ kills to be impressive

export function isImpressiveMatch(isExtract: boolean, chipsEarned: number, kills: number): boolean {
  return (
    (isExtract && chipsEarned >= AUTO_PUBLISH_MIN_CHIPS) ||
    (isExtract && kills >= AUTO_PUBLISH_MIN_KILLS) ||
    (!isExtract && kills >= AUTO_PUBLISH_DEATH_KILLS)
  );
}

export function matchCardTitle(isExtract: boolean, chipsEarned: number, kills: number, arenaName: string): string {
  if (isExtract && chipsEarned >= AUTO_PUBLISH_MIN_CHIPS && kills >= AUTO_PUBLISH_MIN_KILLS) {
    return `💥 ${formatChipsIndian(chipsEarned)}c Extraction with ${kills} Kills!`;
  }
  if (isExtract && chipsEarned >= AUTO_PUBLISH_MIN_CHIPS) {
    return `💰 Massive ${formatChipsIndian(chipsEarned)}c Extraction!`;
  }
  if (isExtract && kills >= AUTO_PUBLISH_MIN_KILLS) {
    return `💀 ${kills}-Kill Extraction in ${arenaName}!`;
  }
  return `⚔️ ${kills} Eliminations Before Falling!`;
}

// Publish a Match Card to the Highlights feed. BEST-EFFORT by design: a clip
// failure must never fail the match result / history save. Callers wrap this
// after their main transaction and swallow errors (logged).
export async function publishMatchCard(input: {
  playerId: string;
  matchId?: string | null;
  arenaName: string;
  isExtract: boolean;
  chipsEarned: number;
  chipsLost: number;
  kills: number;
  snakeLength: number;
  durationSec: number;
  isOnline: boolean;
}): Promise<void> {
  try {
    await db.clip.create({
      data: {
        playerId: input.playerId,
        matchId: input.matchId || null,
        title: matchCardTitle(input.isExtract, input.chipsEarned, input.kills, input.arenaName),
        description: '',
        platform: 'match-card',
        url: '',
        chipsExtracted: input.chipsEarned,
        kills: input.kills,
        arenaName: input.arenaName,
        tags: JSON.stringify(['auto', input.isExtract ? 'extraction' : 'combat']),
        cardType: 'match-card',
        matchData: JSON.stringify({
          outcome: input.isExtract ? 'extract' : 'death',
          chipsLost: input.chipsLost,
          snakeLength: input.snakeLength,
          durationSec: input.durationSec,
          isOnline: input.isOnline,
        }),
        status: 'approved', // system-generated, auto-approved
      },
    });
  } catch (err) {
    console.error('[clips] auto-publish match card failed', err);
  }
}
