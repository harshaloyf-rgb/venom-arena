# AUDIT: API Routes — Venom Arena

**Audit ID:** audit-2
**Scope:** 42 API route files under `src/app/api/`
**Date:** 2025-01-24

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 8 |
| High | 14 |
| Medium | 18 |
| Low | 8 |

---

## CRITICAL Findings

### C-01: Hardcoded JWT Secret Fallback
- **SEVERITY:** Critical
- **FILE:** `src/lib/auth.ts` line 6
- **WHAT:** `const JWT_SECRET = process.env.JWT_SECRET || 'venom-arena-dev-secret-change-in-prod'`
- **WHY:** If `JWT_SECRET` env var is unset in production, the publicly known fallback string is used. Anyone who reads this source code can forge arbitrary JWTs, impersonate any player (including admin), and take full control of all accounts and data.
- **FIX:** Remove the fallback entirely. Fail to start the server if `JWT_SECRET` is not set. Add a startup check in the application entry point.

### C-02: Hardcoded Internal Secret Fallback (3 routes)
- **SEVERITY:** Critical
- **FILE:** `src/app/api/match/join/route.ts` line 13, `src/app/api/match/result/route.ts` line 114, `src/app/api/match/verify/route.ts` line 15
- **WHAT:** `process.env.INTERNAL_SECRET || 'venom-arena-internal-dev'` used to authenticate game-server-to-API calls.
- **WHY:** If the env var is missing, anyone can call `/api/match/join` (to join without paying), `/api/match/result` (to credit themselves arbitrary chips/XP/kills), and `/api/match/verify` (to impersonate any player in the game). This is a complete economy and authentication bypass.
- **FIX:** Same as C-01 — remove the fallback, fail startup if missing.

### C-03: Admin Config Endpoints Have Zero Authentication
- **SEVERITY:** Critical
- **FILE:** `src/app/api/admin/config/route.ts` line 45 (PUT), `src/app/api/admin/config/seed/route.ts` line 10 (POST)
- **WHAT:** The PUT handler that modifies all 38 game-config values and the POST handler that re-seeds the database have **no authentication check at all**. There is no `getSession()` call, no admin role check — nothing.
- **WHY:** Any unauthenticated user can modify all game physics parameters, economy settings, map configs, and bot settings. They can also re-seed the config table. This gives complete control over game behavior.
- **FIX:** Add `getSession()` + admin role check at the top of both PUT and POST handlers.

### C-04: Social OAuth CSRF Bypass When State Cookie Is Missing
- **SEVERITY:** Critical
- **FILE:** `src/app/api/auth/social-callback/route.ts` lines 42–45, 85–87
- **WHAT:** CSRF check is: `if (savedState && receivedState && savedState !== receivedState)`. If `savedState` is `null`/`undefined` (cookie expired, cleared, never set), the condition short-circuits to false and the CSRF check is **completely skipped**. The OAuth flow proceeds without any CSRF protection.
- **WHY:** An attacker can craft a URL that triggers OAuth login for a victim, and the callback will succeed without state verification, potentially linking the attacker's OAuth to the victim's session or creating an account under the attacker's control.
- **FIX:** Change logic to: if `!savedState` OR `savedState !== receivedState`, reject. The state must always be present.

### C-05: Silent Account Takeover via OAuth Email Linking
- **SEVERITY:** Critical
- **FILE:** `src/app/api/auth/social-callback/route.ts` lines 153–178
- **WHAT:** When an OAuth login returns an email that matches an existing account, the code **silently links** the OAuth provider to that account and logs in as that user — with no password verification, no email confirmation, no consent prompt.
- **WHY:** If an attacker controls (or creates) a Google/Facebook/Apple account with a victim's email address, they can log in as the victim by OAuth. This completely bypasses the victim's password. This is especially dangerous because email addresses are not verified during registration.
- **FIX:** Either (a) require the user to be already logged in to link an OAuth provider (consent flow), (b) send a verification email before linking, or (c) at minimum require the existing account's password.

### C-06: Security PIN Stored and Compared in Plaintext
- **SEVERITY:** Critical
- **FILE:** `src/app/api/auth/change-pin/route.ts` line 46 (comparison), line 53 (storage); `src/app/api/auth/forgot-password/route.ts` line 39 (comparison)
- **WHAT:** The 4-digit PIN is stored as plaintext in the database and compared with direct string equality (`player.securityPin !== currentPin`).
- **WHY:** On database compromise, all user PINs are immediately exposed. Since the PIN is the sole gate for password reset (forgot-password flow), a leaked PIN means total account takeover.
- **FIX:** Hash the PIN using bcrypt (same as passwords). Store the hash, verify using `bcrypt.compare`.

### C-07: Forgot-Password Has No Rate Limiting
- **SEVERITY:** Critical
- **FILE:** `src/app/api/auth/forgot-password/route.ts` entire file
- **WHAT:** The forgot-password endpoint validates a 4-digit PIN (10,000 combinations) with no rate limiting, no account lockout, and no delay.
- **WHY:** An attacker who knows (or guesses) a user's email can brute-force the 4-digit PIN in seconds with parallel requests. At even 10 requests/second, all 10,000 combinations can be tested in ~17 minutes. This gives full password reset capability.
- **FIX:** Add rate limiting (e.g., max 5 attempts per email per hour), progressive delays, and/or account lockout after N failed attempts.

### C-08: Chip Pack Endpoint Gives Free Chips With No Payment
- **SEVERITY:** Critical
- **FILE:** `src/app/api/chips/pack/route.ts` lines 9–41
- **WHAT:** The POST handler credits chips to the player purely on request, with no payment verification, no payment gateway integration, and no cost. The comment says "simulated payment" but the endpoint is fully functional.
- **WHY:** Any authenticated user can call this endpoint repeatedly to receive unlimited chips, completely destroying the game economy.
- **FIX:** Either remove the endpoint, add real payment integration, or gate it behind a verified purchase token from a payment provider.

---

## HIGH Findings

### H-01: No Rate Limiting on Authentication Endpoints
- **SEVERITY:** High
- **FILE:** `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/guest/route.ts`
- **WHAT:** No rate limiting on login, registration, or guest account creation.
- **WHY:** Login is vulnerable to brute-force password attacks. Registration can be abused to create unlimited accounts (each with 150 free chips). Guest creation can flood the database with throwaway accounts.
- **FIX:** Implement rate limiting per IP and per email/account (e.g., max 10 login attempts per IP per 15 minutes, max 3 registrations per IP per hour, CAPTCHA on registration).

### H-02: Challenge Claim TOCTOU Race Condition (Double Chip Credit)
- **SEVERITY:** High
- **FILE:** `src/app/api/player/challenges/route.ts` lines 483–510
- **WHAT:** The `claimed` check (line 487) happens **outside** the database transaction. Two concurrent POST requests can both read `claimed === false`, then both enter the `$transaction` and both execute `bankedChips: { increment: totalReward }`. Since the increment is unconditional inside the transaction and there's no re-check, both succeed, crediting chips twice.
- **WHY:** A player can send two simultaneous claim requests for the same challenge and receive double the chip reward. With the streak multiplier, this could be significant.
- **FIX:** Move the `claimed` and `completed` checks inside the transaction, or use an `UPDATE ... WHERE claimed = false` pattern with a rows-affected check.

### H-03: Challenge Generation Race Condition (Duplicate Challenges)
- **SEVERITY:** High
- **FILE:** `src/app/api/player/challenges/route.ts` lines 374–406 (GET handler)
- **WHAT:** The check for existing challenges (`existingDaily.length === 0`) and the `createMany` call are **not in a transaction**. Two concurrent GET requests can both see zero existing challenges and both create a full set, resulting in 6 daily challenges instead of 3.
- **WHY:** Duplicate challenges give the player more opportunities to earn rewards. The progress tracking and claiming logic may behave unpredictably with duplicates.
- **FIX:** Wrap the check + create in a transaction, or use a unique constraint (e.g., composite unique on `playerId + type + category + periodStart`).

### H-04: Promo Code Double-Redeem Across Server Restarts
- **SEVERITY:** High
- **FILE:** `src/app/api/player/promo-reward/route.ts` line 7
- **WHAT:** `const redeemedPromos = new Map<string, Set<string>>()` is an in-memory data structure. All redemption state is lost on server restart.
- **WHY:** Players can re-redeem promo codes (including high-value ones) every time the server restarts. With the code "CHAMPION" potentially granting large rewards, this is a significant economy exploit.
- **FIX:** Store redemption records in the database (e.g., a `PromoRedemption` table with `playerId + code` unique constraint).

### H-05: Video Reward Bypass Across Server Restarts and Instances
- **SEVERITY:** High
- **FILE:** `src/app/api/player/video-reward/route.ts` line 6
- **WHAT:** Cooldown tracking uses an in-memory `Map`. Lost on restart. Also, in a multi-instance or serverless deployment, each instance has its own Map, allowing the cooldown to be bypassed by hitting different instances.
- **WHY:** Players can claim the 50-chip video reward repeatedly — across restarts and potentially across instances — without any actual video ad being watched.
- **FIX:** Store cooldown timestamps in the database (e.g., `lastVideoRewardAt` column on the Player table), or use Redis for distributed rate limiting.

### H-06: Socket.IO Token Has Same 30-Day Expiry as Session
- **SEVERITY:** High
- **FILE:** `src/app/api/auth/token/route.ts` line 19
- **WHAT:** The token minted for Socket.IO authentication uses `signSession()` with the default 30-day expiry. This token is passed from client-side JavaScript to the socket connection.
- **WHY:** Unlike the httpOnly session cookie (which is harder to exfiltrate), the Socket.IO token is accessible to client-side JS. If a player has a keylogger, XSS, or browser extension that reads this token, it remains valid for 30 days. The token grants full game access.
- **FIX:** Sign the Socket.IO token with a short expiry (e.g., 5–15 minutes) and have the game server re-fetch as needed.

### H-07: No Session Invalidation on Password Change
- **SEVERITY:** High
- **FILE:** `src/app/api/auth/change-password/route.ts`
- **WHAT:** After changing the password, existing JWT tokens (session cookie and any Socket.IO tokens) remain valid until natural expiry.
- **WHY:** If a user's password is compromised and they change it, the attacker's existing session remains active. The password change provides no real protection.
- **FIX:** Re-sign the session cookie after password change (issue a new token, invalidating the old one). Optionally maintain a token version/generation counter in the database.

### H-08: Friend Request Check-Then-Create Is Not Atomic
- **SEVERITY:** High
- **FILE:** `src/app/api/friends/request/route.ts` lines 20–36
- **WHAT:** The existence check for an existing friendship and the `create` call are separate, non-transactional operations.
- **WHY:** Two concurrent requests from the same user to the same target can both pass the existence check and create duplicate friendship records. This could cause unexpected behavior in the friends list and gift system.
- **FIX:** Wrap in a database transaction, or use a unique compound index on `(initiatorId, recipientId)` with a try/catch for the unique constraint violation.

### H-09: Match Result Does Not Validate bankedAmount ≤ carriedChips
- **SEVERITY:** High
- **FILE:** `src/app/api/match/result/route.ts` lines 142–143, 200
- **WHAT:** `bankedAmountFromBody` is used directly as `chipsEarned` without checking that `bankedAmountFromBody <= carriedChips`. The commission calculation `carriedChips - bankedAmountFromBody` (line 200) can become negative.
- **WHY:** A compromised or buggy game server could report `carriedChips: 0, bankedAmount: 50000`, crediting the player 50,000 chips from a match where they carried nothing. The negative commission is nonsensical but not validated.
- **FIX:** Add validation: `if (outcome === 'extract' && bankedAmountFromBody > carriedChips)` reject or clamp `bankedAmount` to `carriedChips`.

### H-10: Challenge Progress Double-Counting (Server + Client)
- **SEVERITY:** High
- **FILE:** `src/app/api/player/challenges/progress/route.ts` (client-callable) and `src/app/api/match/result/route.ts` lines 180–187 (server-side `updateChallengeProgress`)
- **WHAT:** Both the game server (via match/result) and the client (via challenges/progress) can update challenge progress for the same events (kills, extracts, etc.).
- **WHY:** A single kill could be credited twice: once by the match server reporting the match result, and once by the client canvas calling the progress endpoint. This lets players inflate challenge progress and earn more rewards than intended.
- **FIX:** Choose one source of truth. Either track all progress server-side only (remove client endpoint) or client-side only (remove server-side tracking in match/result). If both must exist, add deduplication logic.

### H-11: Client-Callable Challenge Progress Is Exploitable
- **SEVERITY:** High
- **FILE:** `src/app/api/player/challenges/progress/route.ts`
- **WHAT:** This endpoint is called by the client during gameplay and accepts self-reported progress for kills, extracts, score, etc. The `MAX_AMOUNT_PER_CATEGORY` limits help, but the limits are generous (e.g., 10 kills per call).
- **WHY:** A modified client can call this endpoint at will, claiming kills and score progress without actually playing. With `arena_entry` having a max of 1 per call but no limit on calls, a player could claim infinite arena entries.
- **FIX:** Either move all progress tracking to server-side only (match/result), or add per-challenge accumulation caps and stricter per-session/per-match rate limiting.

### H-12: Friend Gift Transaction Error Handling Swallows Real Errors
- **SEVERITY:** High
- **FILE:** `src/app/api/friends/gift/route.ts` lines 47–49
- **WHAT:** The transaction's `.catch()` converts all errors to `{ error: String(e.message || e) }`. If `e.message` is undefined (e.g., a Prisma internal error), `String(e)` may produce `[object Object]` which doesn't match any key in the error map (line 52), falling through to the generic "Gift failed" message. More critically, Prisma unique constraint violations or connection errors are all treated as generic 400 errors instead of 500s.
- **WHY:** Real database errors return misleading 400 status codes. Connection failures, Prisma timeouts, etc. are reported as client errors.
- **FIX:** Check the error type explicitly. Prisma errors should return 500. Only known application-level thrown errors (with specific messages) should return 400.

### H-13: `unlockSkin` Exported Helper Has Read-Modify-Write Race Condition
- **SEVERITY:** High
- **FILE:** `src/app/api/player/route.ts` lines 64–76
- **WHAT:** The `unlockSkin` function reads the player's `unlockedSkins`, parses JSON, pushes a new skin ID, and writes back. This is a classic read-modify-write cycle with no transaction or locking.
- **WHY:** If called concurrently (e.g., from match/result + daily reward at the same time), one unlock could overwrite the other, causing a skin to be lost. Since it's exported and potentially called from multiple places, this is a real risk.
- **FIX:** Use a database transaction with a re-read inside the tx, or use a single atomic query that appends to the JSON string.

### H-14: Arena-Stats Hardcodes localhost
- **SEVERITY:** High
- **FILE:** `src/app/api/arena-stats/route.ts` line 10
- **WHAT:** `fetch('http://localhost:3001/stats', ...)` is hardcoded.
- **WHY:** In any deployed environment (Docker, Kubernetes, Vercel, etc.), the game server will not be at localhost:3001. The endpoint will always fall back to zero-player counts, making arena selection useless.
- **FIX:** Use an environment variable (e.g., `GAME_SERVER_URL`) for the game server address.

---

## MEDIUM Findings

### M-01: No Auth on Clans List Endpoint
- **SEVERITY:** Medium
- **FILE:** `src/app/api/clans/list/route.ts`
- **WHAT:** The GET endpoint returns all clans with member counts, banked chips, and descriptions with no authentication.
- **WHY:** While this may be intentional for discovery, it exposes clan banked chips (financial data) to unauthenticated users and bots. This can be scraped for intelligence.
- **FIX:** Add optional auth (return public data for unauthenticated, enriched data for authenticated) or require auth.

### M-02: No Auth on Leaderboard Endpoint
- **SEVERITY:** Medium
- **FILE:** `src/app/api/leaderboard/route.ts`
- **WHAT:** The GET endpoint exposes all player tags, names, countries, banked chips, and levels with no authentication.
- **WHY:** Enables mass scraping of player data. User tags and chip balances are exposed to anyone.
- **FIX:** Add authentication or at minimum rate limiting. Consider whether banked chips should be public.

### M-03: No Try/Catch on Multiple Route Handlers
- **SEVERITY:** Medium
- **FILE:** `src/app/api/auth/me/route.ts`, `src/app/api/auth/token/route.ts` (GET body, not the try), `src/app/api/clans/create/route.ts`, `src/app/api/clans/chat/route.ts` (POST), `src/app/api/player/route.ts` (PUT), `src/app/api/match/verify/route.ts`, `src/app/api/chips/pack/route.ts`, `src/app/api/friends/accept/route.ts`, `src/app/api/friends/remove/route.ts`
- **WHAT:** These handlers have no try/catch wrapping. Unhandled exceptions will return Next.js default error pages or leak Prisma error details (including table names, column names, query structure).
- **WHY:** Prisma errors can expose database schema information. Unhandled promise rejections may cause connection pool leaks.
- **FIX:** Wrap all handlers in try/catch with a generic error response.

### M-04: Clan Creation Not Wrapped in Try/Catch
- **SEVERITY:** Medium
- **FILE:** `src/app/api/clans/create/route.ts` lines 30–33
- **WHAT:** The `$transaction` for creating the clan and updating the player is not in a try/catch. A Prisma `P2002` (unique constraint) error on the clan tag would leak the raw error.
- **WHY:** In a race condition where two players try to create a clan with the same tag simultaneously, the second one gets a raw Prisma error instead of a clean "Tag already taken" message.
- **FIX:** Add try/catch, handle `P2002` specifically to return a 409.

### M-05: Friend Request No Max Friends Limit
- **SEVERITY:** Medium
- **FILE:** `src/app/api/friends/request/route.ts`
- **WHAT:** There is no limit on the number of friends a player can have.
- **WHY:** Players can accumulate unlimited friends, which bloats the `friends/list` query (it does a full include of all friend records). This could cause performance issues and OOM on large datasets.
- **FIX:** Add a max friends limit (e.g., 100) and check the count before accepting.

### M-06: Clan Chat No Rate Limiting or Content Filtering
- **SEVERITY:** Medium
- **FILE:** `src/app/api/clans/chat/route.ts` POST handler
- **WHAT:** No rate limit on message posting (300-char max is the only constraint). No profanity filtering, no XSS sanitization.
- **WHY:** Players can spam unlimited messages. If message content is rendered as HTML on the client (even via React, if `dangerouslySetInnerHTML` is used anywhere), XSS is possible. At minimum, chat spam degrades the experience.
- **FIX:** Add rate limiting (e.g., max 1 message per 2 seconds, max 30 per hour). Sanitize input (strip HTML tags). Consider profanity filtering.

### M-07: `leaderboard/my-rank` Always Returns Chip-Based Rank
- **SEVERITY:** Medium
- **FILE:** `src/app/api/leaderboard/my-rank.ts` lines 24–38
- **WHAT:** The endpoint hardcodes `bankedChips` as the ranking criterion. There is no parameter to get a level-based rank.
- **WHY:** The main leaderboard supports both `chips` and `level` sorting, but `my-rank` always uses chips. If a player is viewing the level leaderboard, their displayed rank won't match.
- **FIX:** Add a `type` query parameter (like the main leaderboard) to support both ranking types.

### M-08: World Summit SQL Can Return Duplicate Countries
- **SEVERITY:** Medium
- **FILE:** `src/app/api/leaderboard/route.ts` lines 66–68
- **WHAT:** The raw SQL uses `MAX(bankedChips)` joined back to players. If two players in the same country have the exact same chip count, both rows are returned for that country.
- **WHY:** The "top player per country" guarantee is broken for tied chip counts. The UI would show duplicate countries.
- **FIX:** Use a subquery with `ROW_NUMBER()` or `LIMIT 1` per country group, or handle duplicates in application code.

### M-09: `match/join` Body Parsing Outside Try/Catch
- **SEVERITY:** Medium
- **FILE:** `src/app/api/match/join/route.ts` lines 18–21
- **WHAT:** `body.userTag` and `body.arenaId` are parsed from the request body before the try/catch block (line 26). If `req.json()` itself throws (not just returns invalid data), it would be unhandled.
- **WHY:** While `.catch(() => ({}))` handles JSON parse errors, other failures (e.g., request body already consumed) could throw unhandled exceptions.
- **FIX:** Move body parsing inside the try block.

### M-10: Cosmetic Equip Action Has Read-Then-Write Race
- **SEVERITY:** Medium
- **FILE:** `src/app/api/player/cosmetic/route.ts` lines 79–99
- **WHAT:** The `equip` action reads the player's `unlockedSkins`, checks if the skin is included, then updates the equipped slot. This is not in a transaction.
- **WHY:** If a player sells/unlocks a cosmetic and equips another simultaneously, the read could see stale data. Low probability but possible.
- **FIX:** Wrap in a transaction or use the same read-then-update pattern as the `buy` action.

### M-11: No Validation on Clan Emblem Characters
- **SEVERITY:** Medium
- **FILE:** `src/app/api/clans/create/route.ts` line 12
- **WHAT:** `String(body.emblem || '🐍').slice(0, 4)` allows any 4 characters, including control characters, zero-width characters, or problematic Unicode sequences.
- **WHY:** Could cause display issues, database encoding problems, or be used for invisible clan tags.
- **FIX:** Validate the emblem against a whitelist of allowed emoji/characters, or at minimum strip control characters.

### M-12: Player Name Allows Only 1-Character Names
- **SEVERITY:** Medium
- **FILE:** `src/app/api/player/route.ts` line 29
- **WHAT:** `if (name.length >= 2) data.name = name` allows names of length 2–20, but the registration and upgrade endpoints allow names as short as 1 character (they only check `!name` which is falsy for non-empty strings).
- **WHY:** Inconsistency between registration (min 1 char) and profile update (min 2 char). A registered player with a 1-char name cannot change their name without making it longer.
- **FIX:** Standardize minimum name length across all endpoints (recommend 2 or 3).

### M-13: Guest Account Creation Has No Limits
- **SEVERITY:** Medium
- **FILE:** `src/app/api/auth/guest/route.ts`
- **WHAT:** Each guest account is created with 150 free chips. There is no limit on how many guest accounts can be created from the same IP or device.
- **WHY:** An attacker can create unlimited guest accounts, collect the 150 starting chips from each, and gift them to a main account. With the friends/gift endpoint (max 1000 per gift), 7 accounts = 1050 chips transferred.
- **FIX:** Rate limit guest creation per IP/device. Consider fingerprinting or requiring CAPTCHA after N accounts.

### M-14: No Ban Check in Guest Login
- **SEVERITY:** Medium
- **FILE:** `src/app/api/auth/guest/route.ts`
- **WHAT:** Guest account creation doesn't check if the user is banned. While a new guest account wouldn't be banned, a banned user can always create a fresh guest account.
- **WHY:** Banned players can immediately return by creating a new guest account, rendering bans ineffective against guest users.
- **FIX:** This is partially unavoidable for guest accounts, but consider IP-based banning or device fingerprinting for repeat offenders.

### M-15: `clans/leave` Silently Swallows Clan Delete Errors
- **SEVERITY:** Medium
- **FILE:** `src/app/api/clans/leave/route.ts` line 24
- **WHAT:** `await tx.clan.delete({ where: { tag: clanTag } }).catch(() => {})` silently ignores all errors when deleting an empty clan.
- **WHY:** If the delete fails for a real reason (database constraint, connection issue), the orphaned clan record remains in the database with zero members. This is a data integrity issue that would require manual cleanup.
- **FIX:** Don't swallow the error. Let it propagate so the transaction rolls back, or at minimum log it.

### M-16: `friends/list` Exposes Other Players' Banked Chips
- **SEVERITY:** Medium
- **FILE:** `src/app/api/friends/list/route.ts` line 48
- **WHAT:** Returns `bankedChips` for every friend in the response.
- **WHY:** Players can see exactly how many chips their friends have. While this may be intentional for social features, it's a privacy concern that not all users would expect.
- **FIX:** Consider making this opt-in or removing it from the default response.

### M-17: No Account Deletion/Erasure Endpoint
- **SEVERITY:** Medium
- **FILE:** N/A (missing endpoint)
- **WHAT:** There is no API endpoint to delete a player account or request data erasure.
- **WHY:** Fails GDPR/privacy regulation requirements (Right to Erasure). Players cannot remove their data.
- **FIX:** Add a `DELETE /api/player` endpoint that soft-deletes or anonymizes the player's data after confirmation.

### M-18: `player/daily` Streak Uses Server-Local Time Comparison
- **SEVERITY:** Medium
- **FILE:** `src/app/api/player/daily/route.ts` lines 12, 27–31
- **WHAT:** `new Date().toISOString().slice(0, 10)` uses UTC date, but the streak comparison uses `new Date(player.lastDailyClaim + 'T00:00:00Z')` which assumes the stored date is UTC. The `today` variable from `toISOString()` is UTC, which is correct, but the `diffDays` calculation uses `Math.round` which can be inaccurate near daylight saving time boundaries (though UTC avoids DST, the `Math.round` is still imprecise for fractional milliseconds).
- **WHY:** At millisecond precision, `86400000` may not divide evenly, causing `diffDays` to round incorrectly in edge cases. For example, if the DB stores a timestamp with timezone offset, the UTC comparison could be off by a day.
- **FIX:** Use integer date arithmetic or a dedicated date library (e.g., `date-fns`) for date difference calculations.

---

## LOW Findings

### L-01: Social-Login Returns 200 for Unconfigured Provider
- **SEVERITY:** Low
- **FILE:** `src/app/api/auth/social-login/route.ts` lines 30–39
- **WHAT:** When an OAuth provider's credentials are not configured, the endpoint returns `{ error: '...not configured', notConfigured: true }` with **status 200** instead of 400.
- **WHY:** The client must check `notConfigured` flag rather than HTTP status code to detect this error. Inconsistent API design.
- **FIX:** Return status 400 or 501 for unconfigured providers.

### L-02: `auth/me` Returns `{ player: null }` Instead of 401 for Banned Players
- **SEVERITY:** Low
- **FILE:** `src/app/api/auth/me/route.ts` line 12
- **WHAT:** When a player is banned, `/api/auth/me` returns `{ player: null }` with status 200. The client cannot distinguish between "not logged in" and "logged in but banned."
- **WHY:** The client may show a login screen instead of a "your account has been banned" message.
- **FIX:** Return a specific error/status for banned players (e.g., 403 with `{ error: 'banned' }`).

### L-03: `match/join` Returns Player Data Outside Transaction Scope
- **SEVERITY:** Low
- **FILE:** `src/app/api/match/join/route.ts` lines 47–58
- **WHAT:** The `player` object in the transaction return uses `p` (pre-update) for most fields but `updated.bankedChipsAfterBuyIn` for the chip balance. The comment says "player's snapshot for spawning" — this is intentional, but `p` may contain stale data if another process modified the player between the start and end of the transaction.
- **WHY:** Minor: in practice, SQLite's transaction isolation prevents this, but the pattern is fragile.
- **FIX:** This is acceptable for SQLite but should be documented. For PostgreSQL migration, use `updated` for all fields.

### L-04: No Input Length Validation on Clan Description
- **SEVERITY:** Low
- **FILE:** `src/app/api/clans/create/route.ts` line 13
- **WHAT:** `String(body.description || '').slice(0, 200)` truncates but doesn't validate minimum length or content.
- **WHY:** Empty descriptions are allowed. This is likely intentional but could lead to poor UX.
- **FIX:** Consider requiring a minimum description length or making it optional in the schema.

### L-05: Leaderboard Fetches Up to 500 Rows for Milestone Filtering
- **SEVERITY:** Low
- **FILE:** `src/app/api/leaderboard/route.ts` line 94
- **WHAT:** `const fetchLimit = milestone ? Math.max(limit * 5, 500) : limit` can fetch up to 500 player records from the database for in-memory filtering.
- **WHY:** With a large player base and rare milestone tiers, most fetched rows are discarded. This is inefficient but not currently a performance problem at small scale.
- **FIX:** Push milestone filtering into the database query using `WHERE bankedChips >= ? AND bankedChips < ?`.

### L-06: Clan Chat Messages Load All 50 From Beginning of Time
- **SEVERITY:** Low
- **FILE:** `src/app/api/clans/chat/route.ts` line 20
- **WHAT:** `orderBy: { createdAt: 'asc' }, take: 50` returns the **first** 50 messages ever sent, not the most recent 50.
- **WHY:** Active clans will always see the same old messages. New messages beyond the first 50 are never shown.
- **FIX:** Change to `orderBy: { createdAt: 'desc' }, take: 50` and reverse the array before sending, or use a cursor-based approach.

### L-07: Admin Ban Does Not Invalidate Target's Session
- **SEVERITY:** Low
- **FILE:** `src/app/api/admin/ban/route.ts`
- **WHAT:** Banning a player updates the `banned` flag but does not invalidate their existing JWT or clear their session cookie.
- **WHY:** A banned player remains logged in until their session expires (up to 30 days) or they refresh (at which point `getSession()` checks the ban). The `getSession()` function does check the ban, so a page reload will boot them, but active sockets may persist.
- **FIX:** This is partially mitigated by `getSession()` checking the ban on every API call. However, consider adding a session version counter for immediate invalidation.

### L-08: Inconsistent Error Response Formats
- **SEVERITY:** Low
- **FILE:** Multiple files
- **WHAT:** Some endpoints return `{ error: 'message' }`, others return `{ ok: false, reason: '...' }`, and `match/join` uses both patterns. Some use `status` 400 for auth errors, others use 401.
- **WHY:** Makes client-side error handling more complex and error-prone. Inconsistency increases bug surface area.
- **FIX:** Standardize on a single error format (e.g., `{ error: string }` with appropriate HTTP status codes).

---

## FLOW TRACES

### A) AUTH FLOW: login → JWT → session → profile load → lobby display

1. **Login** (`auth/login`): Validates email/password, checks ban, creates JWT, sets httpOnly cookie. ✅ Well-implemented.
2. **JWT verification** (`auth/me` or `getSession()`): Reads cookie, verifies JWT, checks ban status. ✅ Good — ban check is in `getSession()`.
3. **Profile load** (`player` GET): Returns `toProfile(player)`. ✅ Works.
4. **Lobby display**: Client calls multiple endpoints (friends/list, leaderboard, arena-stats, challenges, daily). Each has its own auth check. ✅ Works.

**Gaps found:**
- Hardcoded JWT secret fallback (C-01)
- No session invalidation on password change (H-07)
- Socket.IO token has 30-day expiry (H-06)
- Banned player sees `{ player: null }` instead of ban message (L-02)
- No rate limiting on login (H-01)

### B) MATCH FLOW: join → verify → buy-in deduction → game play → death/extract → result reporting → chips/xp credit

1. **Join** (`match/join`): Internal secret auth ✅, atomic buy-in deduction via transaction ✅.
2. **Verify** (`match/verify`): Validates JWT, checks ban. ✅
3. **Game play**: Handled by Socket.IO server (not in API scope). N/A
4. **Result** (`match/result`): Internal secret auth ✅, atomic chip/XP credit via transaction ✅, challenge progress update ✅.

**Gaps found:**
- Hardcoded internal secret fallback (C-02) — complete bypass possible
- No validation that `bankedAmount ≤ carriedChips` (H-09)
- No verification that player actually joined the specified arena
- Challenge progress double-counting between server and client (H-10)
- `bestStreak` tracks total kills per match, not a consecutive-kill streak (semantic issue)

### C) SHOP FLOW: buy item → API call → deduction → item unlock → inventory update

1. **Cosmetic buy** (`player/cosmetic` POST with `action: 'buy'`): Auth ✅, validates cosmetic exists ✅, checks ownership ✅, checks balance ✅, atomic transaction with chip deduction + skin unlock + purchase record ✅.
2. **Equip** (`player/cosmetic` POST with `action: 'equip'`): Checks ownership ✅, but not in transaction (M-10).

**Gaps found:**
- Equip race condition (M-10)
- `unlockSkin` helper race condition (H-13)
- Chip pack endpoint gives free chips with no payment (C-08)

### D) CLAN FLOW: create → join → deposit → chat → leave

1. **Create** (`clans/create`): Auth ✅, validates tag format ✅, checks not already in clan ✅, checks tag uniqueness ✅, transactional ✅ (but no try/catch — M-04).
2. **Join** (`clans/join`): Auth ✅, checks clan exists ✅, checks member limit (30) ✅, checks not already in clan ✅, transactional ✅.
3. **Deposit** (`clans/deposit`): Auth ✅, checks membership ✅, checks balance ✅, max limit (1M) ✅, atomic deduction + credit ✅.
4. **Chat** (`clans/chat`): Auth ✅, membership check ✅, but no rate limiting (M-06) and loads oldest messages instead of newest (L-06).
5. **Leave** (`clans/leave`): Auth ✅, handles leader promotion ✅, cleans up empty clans ✅ (but swallows delete errors — M-15).

**Gaps found:**
- Clan creation error handling (M-04)
- Chat oldest-messages bug (L-06)
- Chat no rate limiting (M-06)
- Clan delete error swallowed (M-15)
- No clan leader-specific actions (no kick, no promote, no disband — not in scope but noted as missing features)

---

## END OF AUDIT
