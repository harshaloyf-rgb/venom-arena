# Venom Arena — Security Testing Guide (Phase 1 Fixes)

This guide covers **how to test every security fix** from Phase 1. Each test includes:
- **What was the vulnerability**
- **How to test it manually** (curl commands)
- **Expected result** (PASS / FAIL)

---

## Prerequisites

1. Dev server running: `bun run dev` (port 3000)
2. You need two JWT tokens:
   - **Admin token** (role=admin)
   - **Player token** (role=player)
3. `INTERNAL_SECRET` from `.env`

### Quick: Generate Test Tokens

```bash
cd /home/z/my-project
bash scripts/test-security.sh --tokens-only
```

---

## TEST 1: Self-Promotion Prevention (P0 — Critical)

**File:** `src/app/api/admin/promote-self/route.ts`
**Bug:** Previously ANY user could call this endpoint and become admin.
**Fix:** Now requires caller to already be `admin` + provide a target `userTag`.

### Test 1a — Player tries to self-promote → Should FAIL (403)
```bash
curl -s -X POST http://localhost:3000/api/admin/promote-self \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"userTag": "VENOM-7257"}'
# Expected: {"error":"Admin only"}  ← 403
```

### Test 1b — No auth → Should FAIL (401)
```bash
curl -s -X POST http://localhost:3000/api/admin/promote-self \
  -H "Content-Type: application/json" \
  -d '{"userTag": "VENOM-7257"}'
# Expected: {"error":"Unauthorized"}  ← 401
```

### Test 1c — Admin promotes a player → Should SUCCEED (200)
```bash
curl -s -X POST http://localhost:3000/api/admin/promote-self \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$ADMIN_COOKIE" \
  -d '{"userTag": "VENOM-7257"}'
# Expected: {"ok":true,"promoted":"VENOM-7257"}  ← 200
```

### Test 1d — Admin promotes someone who's already admin → Should FAIL (400)
```bash
curl -s -X POST http://localhost:3000/api/admin/promote-self \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$ADMIN_COOKIE" \
  -d '{"userTag": "VENOM-7551"}'
# Expected: {"error":"Player is already admin"}  ← 400
```

### Test 1e — Admin promotes non-existent tag → Should FAIL (404)
```bash
curl -s -X POST http://localhost:3000/api/admin/promote-self \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$ADMIN_COOKIE" \
  -d '{"userTag": "VENOM-9999"}'
# Expected: {"error":"Player not found"}  ← 404
```

---

## TEST 2: Video Reward Race Condition (P0)

**File:** `src/app/api/player/video-reward/route.ts`
**Bug:** Cooldown check was outside the transaction → rapid requests could bypass it.
**Fix:** Cooldown check moved inside `db.$transaction()`.

### Test 2a — First claim → Should SUCCEED (200)
```bash
curl -s -X POST http://localhost:3000/api/player/video-reward \
  -H "Cookie: va_session=$PLAYER_COOKIE"
# Expected: {"player":{...},"reward":50,"cooldownSeconds":60}  ← 200
```

### Test 2b — Immediate second claim → Should FAIL (429)
```bash
curl -s -X POST http://localhost:3000/api/player/video-reward \
  -H "Cookie: va_session=$PLAYER_COOKIE"
# Expected: {"error":"Cooldown active..."}  ← 429
```

### Test 2c — No auth → Should FAIL (401)
```bash
curl -s -X POST http://localhost:3000/api/player/video-reward
# Expected: {"error":"Authentication required."}  ← 401
```

### Test 2d — Race condition stress test (5 parallel requests)
```bash
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:3000/api/player/video-reward \
    -H "Cookie: va_session=$PLAYER_COOKIE" &
done
wait
# Check DB: should only show ONE new reward (not 5)
```

---

## TEST 3: Promo Code Double-Redemption (P0)

**File:** `src/app/api/player/promo-reward/route.ts`
**Bug:** Duplicate check was outside transaction → same code could be redeemed twice.
**Fix:** Check moved inside `db.$transaction()`.

### Test 3a — Redeem valid code → Should SUCCEED (200)
```bash
curl -s -X POST http://localhost:3000/api/player/promo-reward \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"code": "VENOM"}'
# Expected: {"player":{...},"reward":200,...}  ← 200
```

### Test 3b — Redeem same code again → Should FAIL (400)
```bash
curl -s -X POST http://localhost:3000/api/player/promo-reward \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"code": "VENOM"}'
# Expected: {"error":"You already redeemed this promo code."}  ← 400
```

### Test 3c — Invalid code → Should FAIL (400)
```bash
curl -s -X POST http://localhost:3000/api/player/promo-reward \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"code": "FAKECODE"}'
# Expected: {"error":"Invalid or expired promo code..."}  ← 400
```

---

## TEST 4: Clip Double-Upvote (P0)

**File:** `src/app/api/clips/upvote/route.ts`
**Bug:** Existing vote check was outside transaction → rapid clicks could increment multiple times.
**Fix:** Check moved inside `db.$transaction()`.

### Test 4a — First upvote on a clip → Should SUCCEED (200)
```bash
# First, find a clip ID
CLIP_ID=$(node -e "const {PrismaClient}=require('./node_modules/.prisma/client');new PrismaClient().clip.findFirst({select:{id:true}}).then(c=>{console.log(c?.id||'none');process.exit(0)})")

curl -s -X POST http://localhost:3000/api/clips/upvote \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d "{\"clipId\": \"$CLIP_ID\"}"
# Expected: {"ok":true,"upvotes":N}  ← 200
```

### Test 4b — Second upvote same clip → Should return already:true
```bash
curl -s -X POST http://localhost:3000/api/clips/upvote \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d "{\"clipId\": \"$CLIP_ID\"}"
# Expected: {"ok":true,"already":true}  ← 200 (not an error, but no extra increment)
```

---

## TEST 5: Cosmetic Purchase — No totalLost Increment (P1 Bug)

**File:** `src/app/api/player/cosmetic/route.ts`
**Bug:** Buying a skin was incorrectly incrementing `totalLost`.
**Fix:** Removed `totalLost: { increment: cosmetic.cost }`.

### Test 5a — Buy a cosmetic (need enough chips first)
```bash
# Give player chips via promo code first, then buy
# Check player's totalLost before and after — it should NOT increase
curl -s -X POST http://localhost:3000/api/player/promo-reward \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"code": "CHAMPION"}'
```

### Verify in DB:
```bash
node -e "
const {PrismaClient}=require('./node_modules/.prisma/client');
new PrismaClient().player.findFirst({where:{userTag:'VENOM-7257'},select:{totalLost:true,bankedChips:true}}).then(p=>console.log('totalLost='+p.totalLost+' bankedChips='+p.bankedChips));
"
```

---

## TEST 6: Gift — Correct totalLost/totalEarned Tracking (P1 Bug)

**File:** `src/app/api/friends/gift/route.ts`
**Bug:** Gift was not updating `totalLost` for sender or `totalEarned` for recipient.
**Fix:** Added both increments inside the transaction.

### Test 6a — Gift chips (requires friendship first)
```bash
# Check sender's totalLost and recipient's totalEarned before/after
# Both should change by the gift amount
```

### Verify in DB:
```bash
node -e "
const {PrismaClient}=require('./node_modules/.prisma/client');
new PrismaClient().player.findMany({where:{role:'player'},select:{userTag:true,totalLost:true,totalEarned:true},take:5}).then(ps=>ps.forEach(p=>console.log(p.userTag+' lost='+p.totalLost+' earned='+p.totalEarned)));
"
```

---

## TEST 7: Hall of Fame — No Self-Induction (P0)

**File:** `src/app/api/hof/induct/route.ts`
**Bug:** Any logged-in user could create HOF entries for themselves.
**Fix:** Now requires either `INTERNAL_SECRET` Bearer token or admin session.

### Test 7a — Player tries to induct themselves → Should FAIL (401)
```bash
curl -s -X POST http://localhost:3000/api/hof/induct \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"userTag":"VENOM-7257","inductionType":"milestone","milestoneTierId":"t-1lakh"}'
# Expected: {"error":"Unauthorized"}  ← 401
```

### Test 7b — Admin inducts a player → Should SUCCEED (200)
```bash
curl -s -X POST http://localhost:3000/api/hof/induct \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$ADMIN_COOKIE" \
  -d '{"userTag":"VENOM-7257","inductionType":"milestone","milestoneTierId":"t-1lakh"}'
# Expected: {"inducted":true,"entryId":"...",...}  ← 200
```

### Test 7c — Internal service inducts (with INTERNAL_SECRET) → Should SUCCEED (200)
```bash
curl -s -X POST http://localhost:3000/api/hof/induct \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INTERNAL_SECRET" \
  -d '{"userTag":"VENOM-7257","inductionType":"championship","championshipYear":2024,"championshipRank":1}'
# Expected: {"inducted":true,...}  ← 200
```

---

## TEST 8: Milestone Check — No Cross-Player Check (P1)

**File:** `src/app/api/leaderboard/check-milestone/route.ts`
**Bug:** Player could check another player's milestones by passing their userTag.
**Fix:** Session auth now validates `body.userTag` matches `session.userTag`.

### Test 8a — Player checks own milestone → Should SUCCEED (200)
```bash
curl -s -X POST http://localhost:3000/api/leaderboard/check-milestone \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"userTag":"VENOM-7257"}'
# Expected: {"checked":true,"bankedChips":...,...}  ← 200
```

### Test 8b — Player checks ANOTHER player's milestone → Should FAIL (403)
```bash
curl -s -X POST http://localhost:3000/api/leaderboard/check-milestone \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"userTag":"VENOM-9069"}'
# Expected: {"error":"Can only check your own milestones"}  ← 403
```

---

## TEST 9: Championship Finalize — Field Fix (P1)

**File:** `src/app/api/championship/finalize/route.ts`
**Bug:** Used `session.userId` (undefined) instead of `session.playerId`.
**Fix:** Changed to `session.playerId`.

### Test 9a — Player tries to finalize → Should FAIL (403)
```bash
curl -s -X POST http://localhost:3000/api/championship/finalize \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"year":2024}'
# Expected: {"error":"Admin only"}  ← 403
```

### Test 9b — Admin finalizes past year → Should SUCCEED (200) or get expected error
```bash
curl -s -X POST http://localhost:3000/api/championship/finalize \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$ADMIN_COOKIE" \
  -d '{"year":2024}'
# Expected: Either success or "No registrations found for year 2024" (404)
# But NOT a crash/error about undefined userId
```

---

## TEST 10: Admin Menu Visibility (P1)

**File:** `src/components/layout/more-menu.tsx`
**Bug:** Admin menu item was visible to all users.
**Fix:** Added `adminOnly: true` flag, filtered out for non-admins.

### How to test (Browser):
1. Log in as a **regular player** → Open "More" menu → "Admin" button should NOT appear
2. Log in as **admin** → Open "More" menu → "Admin" button should appear

---

## TEST 11: Page.tsx Field Fixes (P1)

**File:** `src/app/page.tsx`
**Bug:** Used `player.matchesPlayed` (doesn't exist) and `player.extractions` (doesn't exist).
**Fix:** Changed to `player.lifetimeKills + player.lifetimeDeaths` and `player.lifetimeExtracts`.

### How to test (Browser):
1. Open the main page → No console errors about undefined properties
2. Player stats card should show correct numbers

---

## Quick Test Script

Run all tests at once:
```bash
bash scripts/test-security.sh
```
