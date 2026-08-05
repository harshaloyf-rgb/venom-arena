# 🛡️ Venom Arena — Admin Operations Manual

> **CONFIDENTIAL** — For authorized administrators only.
> This document is separate from the player-facing Game Rules.

---

## Table of Contents

1. [Access & Authentication](#1-access--authentication)
2. [Content Moderation](#2-content-moderation)
3. [Player Management](#3-player-management)
4. [Economy Oversight](#4-economy-oversight)
5. [Clan Governance](#5-clan-governance)
6. [Championship Operations](#6-championship-operations)
7. [Configuration Changes](#7-configuration-changes)
8. [Incident Response](#8-incident-response)
9. [Audit & Accountability](#9-audit--accountability)
10. [Security Protocols](#10-security-protocols)

---

## 1. Access & Authentication

### How Admin Role Works
- Admin status is stored in the `Player.role` field (value: `"admin"`)
- Role is checked via JWT session token on every admin API call
- No access codes, no client-side gates — role is server-authoritative

### Granting Admin Access
- **Only existing admins can promote other players** via `POST /api/admin/promote-self` with `{ userTag: "VENOM-XXXX" }`
- There is NO self-promotion — this was removed for security
- Directly update the database if needed: `UPDATE Player SET role = 'admin' WHERE userTag = 'VENOM-XXXX'`

### Revoking Admin Access
- Run: `UPDATE Player SET role = 'player' WHERE userTag = 'VENOM-XXXX'`
- The user's session will still work for up to 30 days (JWT expiry). To force immediate logout, increment their `tokenVersion` field.

### Admin-Only Endpoints
| Endpoint | Purpose |
|---|---|
| `POST /api/admin/promote-self` | Promote a player to admin (requires existing admin) |
| `GET/PUT /api/admin/config` | View/modify game configuration |
| `POST /api/admin/modify-chips` | Adjust player chip balance |
| `POST /api/admin/ban` | Ban or unban a player |
| `GET/POST/PUT /api/clips/admin` | Moderate user-submitted clips |
| `POST /api/championship/finalize` | Finalize a championship year |
| `/admin` (page) | Game config admin dashboard |

### Frontend Admin Access
- Admin tab in bottom navigation (mobile) / sidebar (desktop) — only visible when `role === 'admin'`
- Admin panel inside the app shows player search, chip modification, ban controls, and clip moderation
- `/admin` page shows full game configuration editor

---

## 2. Content Moderation

### Clip Review Workflow
1. User submits a clip → `status: "pending"`
2. Admin opens Highlights tab → clicks **MODERATE** button (amber, with red badge showing pending count)
3. Review the clip: check title, description, URL, thumbnail
4. **Approve**: Clip becomes publicly visible in the Highlights feed
5. **Reject**: Clip is hidden from public view but remains in the database for audit

### Approval Guidelines
- **APPROVE** if: Content is relevant to Venom Arena gameplay, no inappropriate material, URL is valid
- **REJECT** if: Spam, unrelated content, inappropriate/thumbnail, broken URL, misleading title
- Match cards (auto-generated from gameplay) are auto-approved and don't need review

### Review SLA
- Aim to review pending clips within **24 hours**
- Users can see their pending clips in the "My Clips" tab

### Current Limitations
- No **featured clip toggle** endpoint yet (field exists in DB, needs admin UI)
- No bulk reject with reason — single approve/reject only

---

## 3. Player Management

### Viewing Players
- Admin panel fetches top 100 players by chips from the leaderboard
- Search by name or userTag

### Banning Players
- Use the Ban/Unban buttons in the admin panel
- `POST /api/admin/ban` with `{ userTag, banned: true/false }`
- Banned players cannot log in (checked in `getSession()`)
- **Ban is permanent** — no expiration system yet

### Chip Adjustment
- Use the "Modify Chips" section in the admin panel
- Enter a userTag, enter amount (positive to add, negative to remove)
- Changes are logged in the admin panel's local action log
- Use this for: compensating players for bugs, correcting exploits, event rewards

### What's NOT Built Yet
- Player detail view (match history, cosmetics, clan info for any player)
- Temporary bans / ban expiration
- Mute system (chat mute, not implemented)
- Kick from active arena (requires WebSocket integration)

---

## 4. Economy Oversight

### Economy Rules
- Every chip **earned** must increment `totalEarned`
- Every chip **lost** (match buy-in, gift sent) must increment `totalLost`
- Cosmetic purchases do NOT count as losses (fixed: was incorrectly incrementing `totalLost`)
- Gifts received DO increment `totalEarned` for the recipient (fixed)

### Known Faucets (Chip Sources)
| Source | Amount | Cooldown | Server-Enforced? |
|---|---|---|---|
| Daily claim | Streak-based (50–500c) | 24h | ✅ DB unique constraint |
| Hourly claim | 10c | 1h | ✅ DB transaction |
| Video reward | 50c | 60s | ✅ Fixed (was raceable) |
| Match extract | Variable (commission) | Per match | ✅ Server-authoritative |
| Promo codes | Variable | Once per code | ✅ Fixed (was raceable) |
| Lucky spin | Variable | 1 free/day | ✅ DB count check |
| Referral | 200c | Once per referral | ✅ DB unique constraint |

### Known Drains (Chip Sinks)
| Sink | Amount | Notes |
|---|---|---|
| Match buy-in | Arena tier cost | Deducted server-side before match |
| Cosmetics | Item cost | Deducted in transaction |
| Gifts | Player-chosen (max 1000c) | Deducted in transaction |
| Clan deposits | Player-chosen | Deducted in transaction |
| Elite Cyber Pass | 100,000c (one-time) | Deducted server-side, sets `hasElitePass = true` |

### Season Pass (Cyber Pass — Genesis Season)
- **Fully server-enforced.** 3 DB fields on Player: `hasElitePass` (boolean), `passClaimedFree` (JSON array), `passClaimedElite` (JSON array).
- **20 tiers** tied to player level thresholds (Lv 2 → Lv 38). Each tier unlocks a free cosmetic and an elite cosmetic.
- **40 pass-exclusive cosmetics** defined in `game-config.ts` (`PASS_FREE_COSMETICS`, `PASS_ELITE_COSMETICS`). Types: skins, trails, death effects, flags, banners.
- **Elite unlock:** `POST /api/season-pass/unlock-elite` — deducts 100K chips atomically, sets `hasElitePass = true`.
- **Claim rewards:** `POST /api/season-pass/claim` — validates level ≥ tier requirement, track ownership, prevents double-claim, adds cosmetic ID to `unlockedSkins`.
- **XP source:** Earned from successful match extraction only (0 XP on death). Level = XP-based progression.
- Claimed cosmetics appear in the Cosmetics Shop & Lab for equipping.

### What's NOT Server-Enforced
- **Chip store purchase caps** (yearly buy limit, daily ad limit) — tracked in `localStorage` only. Players can bypass by clearing browser data.

---

## 5. Clan Governance

### Current Capabilities
- View clans via leaderboard / clan list
- Players can deposit chips into clan treasury
- Leader can promote/demote members (max 2 Co-Leaders)
- Leader can disband the clan
- Weekly challenges with auto-creation

### Admin Clan Actions (Not Built Yet)
- Force-disband a toxic clan
- Remove a specific member from a clan
- View clan chat history
- Adjust clan XP or level
- Clan withdrawal system (deposit exists but no withdraw)

---

## 6. Championship Operations

### How Championships Work
- Annual tournament — players register for the current year
- `gamesPlayed` tracked per player per year
- At year end, admin finalizes via `POST /api/championship/finalize`
- Top 100 by bankedChips get inducted into Hall of Fame
- Archive created with winner details and top clan

### Finalization Checklist
1. Verify the year is correct (must be a past year)
2. Ensure all games have been played (no active matches)
3. Call `POST /api/championship/finalize { "year": 2025 }`
4. Verify response: `totalRegistrations`, `top100Inducted`, winner details
5. Check Hall of Fame for new entries

### ⚠️ Known Bug (FIXED)
- Championship finalize was using `session.userId` (wrong field) → always returned 403
- Fixed to `session.playerId`

### What's NOT Built Yet
- Championship registration periods (start/end dates)
- Payout processing (manual chip distribution to winners)
- Admin UI for championship management

---

## 7. Configuration Changes

### Game Config Admin (`/admin` page)
- Full CRUD for all game configuration parameters
- Categories: Snake Physics, Growth, Boost, Collision, Food, Extraction, Spawning, Map, Bot Settings, Economy
- Changes take effect immediately on the game server (reads from DB)
- **Always test** configuration changes in a practice arena before deploying to live arenas

### Reset to Defaults
- "Reset to Defaults" button re-seeds the config table with built-in defaults
- Use this if you've made changes that break the game

### Sensitive Parameters
- **Economy values** (buy-in costs, rewards) — changes affect all players immediately
- **Bot settings** — too aggressive bots = player complaints, too passive = no challenge
- **Map size** — affects gameplay balance significantly

---

## 8. Incident Response

### Chip Exploit Detected
1. Identify the exploiting player(s) via userTag
2. Determine chips gained illegitimately
3. Use admin panel to remove excess chips (negative modification)
4. Ban the player if intentional
5. Check for similar exploits

### Server Issues
1. Check game server logs (mini-services/game-server/)
2. Check Next.js dev.log for API errors
3. Restart game server if needed: restart the mini-service process
4. Verify database integrity

### Data Breach
1. Rotate `JWT_SECRET` in `.env`
2. All existing sessions will be invalidated (increment all `tokenVersion`)
3. Rotate `INTERNAL_SECRET` in `.env` and game server config
4. Audit recent admin actions

---

## 9. Audit & Accountability

### Current Logging
- Admin panel has a **local action log** (in-memory, last 50 actions, session-only)
- This does NOT persist across page reloads or server restarts

### What's Needed (Not Built Yet)
- Persistent admin action log in database
- Who did what, when, and to whom
- Viewable by all admins
- Export capability

---

## 10. Security Protocols

### Authentication
- JWT tokens in httpOnly cookies (not accessible via JavaScript)
- 30-day session expiry
- `tokenVersion` field for forced session invalidation
- Bcryptjs password hashing

### Internal Communication
- Game server ↔ API uses `INTERNAL_SECRET` header
- Never expose this secret in client-side code

### Vulnerabilities Fixed (This Session)
| Issue | Fix |
|---|---|
| `/api/admin/promote-self` — anyone could self-promote | Now requires existing admin + userTag |
| Hardcoded access code `venom_admin_2024` in client bundle | Removed; role-only auth |
| Admin tab visible to all users in More Menu | Now filtered by `isAdmin` prop |
| `/admin` page had no role gate | Added client-side redirect in layout |
| Championship finalize used wrong field (`userId`) | Fixed to `playerId` |
| HOF self-induction vulnerability | Now requires INTERNAL_SECRET or admin role |
| Video reward race condition (farmable) | Moved cooldown check inside transaction |
| Promo code race condition (double redeem) | Moved duplicate check inside transaction |
| Clip upvote race condition (double upvote) | Moved existence check inside transaction |
| Skin purchase incremented `totalLost` | Removed incorrect increment |
| Gift didn't increment receiver's `totalEarned` | Added increment |
| `check-milestone` allowed checking others' milestones | Added userTag verification |

### Remaining Security Concerns
- Rate limiting is in-memory only (resets on server restart)
- No `src/middleware.ts` for global security headers
- Chip store caps enforced client-side only
- No server-side cap on friend requests or clan creation

---

*Last updated: Security hardening session — $(date '+%Y-%m-%d')*
