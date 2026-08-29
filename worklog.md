---
Task ID: 1
Agent: Main
Task: Season Pass Redesign - Option A (meaningful, time-gated progression)

Work Log:
- Audited entire Season Pass system: game-config, 3 API routes, Prisma schema, match result XP, Shop & Lab integration, economy guide
- Identified core problems: instant completion (1-3 hrs), no daily cap, no chip rewards, no FOMO, cosmetic bloat
- Presented audit with Option A (redesign) and Option B (remove)
- User chose Option A
- Planned full redesign with XP thresholds, daily cap, chip rewards, post-match notifications

Stage Summary:
- Audit complete. User selected Option A redesign.

---
Task ID: 2
Agent: Main
Task: Implement Season Pass redesign (Option A)

Work Log:
- Added 3 DB fields: passXp, passXpToday, passXpDate to Player model (prisma/schema.prisma)
- Ran db:push to apply schema changes
- Replaced PASS_TIER_LEVEL (level-gated) with PASS_TIER_XP (XP-gated, 20 thresholds from 0 to 55,000)
- Added PASS_DAILY_XP_CAP (1,500) and PASS_XP_MULTIPLIER (0.5)
- Added PASS_FREE_CHIP_REWARDS and PASS_ELITE_CHIP_REWARDS arrays (8 chip reward tiers each)
- Removed PASS_SEASON_NUMBER (unused)
- Updated PlayerProfile type (types.ts) with passXp, passXpToday, passXpDate
- Updated toProfile() in player-helpers.ts to expose new fields
- Updated MatchResult type with passXpGained and newPassTier
- Modified /api/match/result to award pass XP (50% of match XP, daily cap, date-based reset)
- Rewrote /api/season-pass/claim to use passXp instead of level, handle chip rewards
- Rewrote /api/season-pass/claim-all with same changes
- Updated end-overlay.tsx to show Pass XP Earned + Pass Tier in match results
- Updated use-socket-lifecycle.ts to pass new fields and show tier-up toast
- Rewrote season-pass.tsx panel: XP progress bar, daily cap indicator, chip rewards
- Updated page.tsx bento gate: new badge/footLeft using passXp + PASS_TIER_XP
- Verified via browser: all 5 checks pass (XP bar, daily cap, XP thresholds, chip rewards, no errors)
- Verified claim flow: Tier 1 claims correctly, Tier 2 shows correct XP requirement
- Clean lint, no compile errors

Stage Summary:
- Season Pass redesigned from instant-completion level-gated system to meaningful XP-gated system
- Active players: ~37 days to complete, Casual players: ~79 days, Very casual: won't finish (intentional FOMO)
- Mixed rewards: 12 cosmetics + 8 chip rewards per track
- Free track total: 10,400c in chips | Elite track total: 28,300c (justifies 100K cost)
- Post-match pass XP display + tier-up toast notification
- 9 files modified, 0 new files created
