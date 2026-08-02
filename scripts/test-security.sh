#!/usr/bin/env bash
# Venom Arena — Automated Security Test Script (Phase 1)
# Usage: bash scripts/test-security.sh
set -uo pipefail

BASE_URL="http://localhost:3000"
PASS=0
FAIL=0
SKIP=0
RESULTS=()

# ── Colors ──
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Generate tokens ──
generate_tokens() {
  cd /home/z/my-project
  source .env

  ADMIN_INFO=$(node -e "
    const {PrismaClient}=require('./node_modules/.prisma/client');
    const db=new PrismaClient();
    db.player.findFirst({where:{role:'admin'},select:{id:true,userTag:true}}).then(a=>{
      const jwt=require('jsonwebtoken');
      const t=jwt.sign({playerId:a.id,userTag:a.userTag,role:'admin'},process.env.JWT_SECRET,{expiresIn:'1h'});
      console.log(a.userTag+'|'+a.id+'|'+t);
      db.\$disconnect();
    });
  ")

  PLAYER_INFO=$(node -e "
    const {PrismaClient}=require('./node_modules/.prisma/client');
    const db=new PrismaClient();
    db.player.findFirst({where:{role:'player'},select:{id:true,userTag:true}}).then(p=>{
      const jwt=require('jsonwebtoken');
      const t=jwt.sign({playerId:p.id,userTag:p.userTag,role:'player'},process.env.JWT_SECRET,{expiresIn:'1h'});
      console.log(p.userTag+'|'+p.id+'|'+t);
      db.\$disconnect();
    });
  ")

  ADMIN_TAG=$(echo "$ADMIN_INFO" | cut -d'|' -f1)
  ADMIN_ID=$(echo "$ADMIN_INFO" | cut -d'|' -f2)
  ADMIN_COOKIE=$(echo "$ADMIN_INFO" | cut -d'|' -f3)
  PLAYER_TAG=$(echo "$PLAYER_INFO" | cut -d'|' -f1)
  PLAYER_ID=$(echo "$PLAYER_INFO" | cut -d'|' -f2)
  PLAYER_COOKIE=$(echo "$PLAYER_INFO" | cut -d'|' -f3)

  # Read INTERNAL_SECRET as raw value (Next.js/dotenv doesn't evaluate $())
  INTERNAL_SECRET=$(rg '^INTERNAL_SECRET=' /home/z/my-project/.env | head -1 | cut -d'=' -f2-)
}

# ── Test runner ──
run_test() {
  local test_num="$1"
  local test_name="$2"
  local expected_status="$3"
  local expected_fragment="$4"
  shift 4

  local http_code body
  http_code=$(curl -s -o /tmp/venom_test_body.json -w "%{http_code}" "$@" 2>/dev/null) || http_code="000"
  body=$(cat /tmp/venom_test_body.json 2>/dev/null || echo "")

  local status_icon="X"
  local color="$RED"
  local result="FAIL"
  local detail=""

  if [ "$http_code" = "$expected_status" ]; then
    if [ -n "$expected_fragment" ]; then
      if echo "$body" | grep -qi "$expected_fragment"; then
        result="PASS"; status_icon="OK"; color="$GREEN"
      else
        detail="missing fragment: $expected_fragment"
      fi
    else
      result="PASS"; status_icon="OK"; color="$GREEN"
    fi
  else
    detail="expected $expected_status, got $http_code"
  fi

  RESULTS+=("$test_num|$test_name|$result|$http_code|$detail")

  if [ "$result" = "PASS" ]; then
    printf "  ${GREEN}PASS${NC} [%s] %s -> %s\n" "$test_num" "$test_name" "$http_code"
    PASS=$((PASS + 1))
  else
    printf "  ${RED}FAIL${NC} [%s] %s -> %s (%s)\n" "$test_num" "$test_name" "$http_code" "$detail"
    echo "    Body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

# ══════════════════════════════════════════════════════════
printf "${BOLD}${CYAN}"
echo "========================================"
echo "  VENOM ARENA Security Test Suite (Phase 1)"
echo "========================================"
printf "${NC}\n"

# Check server
if ! curl -s -o /dev/null -w "" "$BASE_URL" 2>/dev/null; then
  printf "${RED}ERROR: Dev server not running at %s${NC}\n" "$BASE_URL"
  exit 1
fi
printf "${CYAN}Server OK${NC} - generating test tokens...\n\n"

generate_tokens

echo "  Admin   : $ADMIN_TAG ($ADMIN_ID)"
echo "  Player  : $PLAYER_TAG ($PLAYER_ID)"
echo "  Internal: ${INTERNAL_SECRET:0:25}..."
echo

# ══════════════════════════════════════════════════════════
printf "${BOLD}-- TEST 1: Self-Promotion Prevention (P0) --${NC}\n"
# ══════════════════════════════════════════════════════════

run_test "1a" "Player self-promote blocked" "403" "Admin only" \
  -X POST "$BASE_URL/api/admin/promote-self" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d "{\"userTag\": \"$PLAYER_TAG\"}"

run_test "1b" "No auth -> 401" "401" "Unauthorized" \
  -X POST "$BASE_URL/api/admin/promote-self" \
  -H "Content-Type: application/json" \
  -d "{\"userTag\": \"$PLAYER_TAG\"}"

# Ensure player is NOT admin
cd /home/z/my-project
node -e "
const {PrismaClient}=require('./node_modules/.prisma/client');
new PrismaClient().player.update({where:{userTag:'$PLAYER_TAG'},data:{role:'player'}}).then(()=>process.exit(0));
" 2>/dev/null || true

run_test "1c" "Admin promotes player" "200" "ok" \
  -X POST "$BASE_URL/api/admin/promote-self" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$ADMIN_COOKIE" \
  -d "{\"userTag\": \"$PLAYER_TAG\"}"

run_test "1d" "Promote already-admin" "400" "already admin" \
  -X POST "$BASE_URL/api/admin/promote-self" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$ADMIN_COOKIE" \
  -d "{\"userTag\": \"$PLAYER_TAG\"}"

# Revert
node -e "
const {PrismaClient}=require('./node_modules/.prisma/client');
new PrismaClient().player.update({where:{userTag:'$PLAYER_TAG'},data:{role:'player'}}).then(()=>process.exit(0));
" 2>/dev/null || true

run_test "1e" "Promote non-existent" "404" "Player not found" \
  -X POST "$BASE_URL/api/admin/promote-self" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$ADMIN_COOKIE" \
  -d '{"userTag": "VENOM-9999"}'

echo

# ══════════════════════════════════════════════════════════
printf "${BOLD}-- TEST 2: Video Reward Race Condition (P0) --${NC}\n"
# ══════════════════════════════════════════════════════════

node -e "
const {PrismaClient}=require('./node_modules/.prisma/client');
new PrismaClient().videoReward.deleteMany({where:{playerId:'$PLAYER_ID'}}).then(()=>process.exit(0));
" 2>/dev/null || true

run_test "2a" "First video reward" "200" "reward" \
  -X POST "$BASE_URL/api/player/video-reward" \
  -H "Cookie: va_session=$PLAYER_COOKIE"

run_test "2b" "Second video reward (cooldown)" "429" "Cooldown" \
  -X POST "$BASE_URL/api/player/video-reward" \
  -H "Cookie: va_session=$PLAYER_COOKIE"

run_test "2c" "No auth video reward" "401" "Authentication" \
  -X POST "$BASE_URL/api/player/video-reward"

# 2d: Race condition
printf "  ${YELLOW}..${NC} [2d] Race condition stress test (5 parallel)...\n"
node -e "
const {PrismaClient}=require('./node_modules/.prisma/client');
new PrismaClient().videoReward.deleteMany({where:{playerId:'$PLAYER_ID'}}).then(()=>process.exit(0));
" 2>/dev/null || true
sleep 1

for i in 1 2 3 4 5; do
  curl -s -X POST "$BASE_URL/api/player/video-reward" \
    -H "Cookie: va_session=$PLAYER_COOKIE" > /dev/null 2>&1 &
done
wait

REWARD_COUNT=$(node -e "
const {PrismaClient}=require('./node_modules/.prisma/client');
new PrismaClient().videoReward.count({where:{playerId:'$PLAYER_ID'}}).then(c=>{console.log(c);process.exit(0)});
" 2>/dev/null) || REWARD_COUNT="err"

if [ "$REWARD_COUNT" = "1" ]; then
  RESULTS+=("2d|Race condition 5 parallel|PASS|count=$REWARD_COUNT|")
  printf "  ${GREEN}PASS${NC} [2d] Race condition: 5 parallel -> only %s reward\n" "$REWARD_COUNT"
  PASS=$((PASS + 1))
else
  RESULTS+=("2d|Race condition 5 parallel|FAIL|count=$REWARD_COUNT (expected 1)|")
  printf "  ${RED}FAIL${NC} [2d] Race condition: 5 parallel -> %s rewards (expected 1)\n" "$REWARD_COUNT"
  FAIL=$((FAIL + 1))
fi

echo

# ══════════════════════════════════════════════════════════
printf "${BOLD}-- TEST 3: Promo Code Double-Redemption (P0) --${NC}\n"
# ══════════════════════════════════════════════════════════

node -e "
const {PrismaClient}=require('./node_modules/.prisma/client');
new PrismaClient().promoReward.deleteMany({where:{playerId:'$PLAYER_ID',code:'VENOM'}}).then(()=>process.exit(0));
" 2>/dev/null || true

run_test "3a" "Redeem VENOM code" "200" "reward" \
  -X POST "$BASE_URL/api/player/promo-reward" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"code": "VENOM"}'

run_test "3b" "Double redeem VENOM" "400" "already redeemed" \
  -X POST "$BASE_URL/api/player/promo-reward" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"code": "VENOM"}'

run_test "3c" "Invalid promo code" "400" "Invalid" \
  -X POST "$BASE_URL/api/player/promo-reward" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"code": "FAKECODE"}'

echo

# ══════════════════════════════════════════════════════════
printf "${BOLD}-- TEST 4: Clip Double-Upvote (P0) --${NC}\n"
# ══════════════════════════════════════════════════════════

CLIP_ID=$(node -e "
const {PrismaClient}=require('/home/z/my-project/node_modules/.prisma/client');
(async()=>{
  const db=new PrismaClient();
  const c=await db.clip.findFirst({select:{id:true}});
  if(c){console.log(c.id);await db.\$disconnect();return;}
  const nc=await db.clip.create({data:{playerId:'$PLAYER_ID',title:'Security Test',videoUrl:'https://test.com/c.mp4',thumbnailUrl:'https://test.com/t.jpg',upvotes:0}});
  console.log(nc.id);
  await db.\$disconnect();
})();
" 2>/dev/null) || CLIP_ID=""

if [ -n "$CLIP_ID" ] && [ "$CLIP_ID" != "undefined" ] && [ "$CLIP_ID" != "null" ]; then
  node -e "
  const {PrismaClient}=require('/home/z/my-project/node_modules/.prisma/client');
  new PrismaClient().clipUpvote.deleteMany({where:{playerId:'$PLAYER_ID',clipId:'$CLIP_ID'}}).then(()=>process.exit(0));
  " 2>/dev/null || true

  run_test "4a" "First upvote" "200" "ok" \
    -X POST "$BASE_URL/api/clips/upvote" \
    -H "Content-Type: application/json" \
    -H "Cookie: va_session=$PLAYER_COOKIE" \
    -d "{\"clipId\": \"$CLIP_ID\"}"

  run_test "4b" "Second upvote (already)" "200" "already" \
    -X POST "$BASE_URL/api/clips/upvote" \
    -H "Content-Type: application/json" \
    -H "Cookie: va_session=$PLAYER_COOKIE" \
    -d "{\"clipId\": \"$CLIP_ID\"}"
else
  RESULTS+=("4a|First upvote|SKIP|no clips|")
  RESULTS+=("4b|Second upvote|SKIP|no clips|")
  printf "  ${YELLOW}SKIP${NC} [4a/4b] No clips in DB\n"
  SKIP=$((SKIP + 2))
fi

echo

# ══════════════════════════════════════════════════════════
printf "${BOLD}-- TEST 5: Cosmetic Purchase no totalLost (P1) --${NC}\n"
# ══════════════════════════════════════════════════════════

totalLost_BEFORE=$(node -e "
const {PrismaClient}=require('/home/z/my-project/node_modules/.prisma/client');
new PrismaClient().player.findUnique({where:{id:'$PLAYER_ID'},select:{totalLost:true}}).then(p=>{console.log(p?.totalLost||0);process.exit(0)});
" 2>/dev/null) || totalLost_BEFORE="0"

run_test "5a" "Buy cosmetic skin-venom" "200" "player" \
  -X POST "$BASE_URL/api/player/cosmetic" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"action": "buy", "skinId": "skin-cyber"}'

totalLost_AFTER=$(node -e "
const {PrismaClient}=require('/home/z/my-project/node_modules/.prisma/client');
new PrismaClient().player.findUnique({where:{id:'$PLAYER_ID'},select:{totalLost:true}}).then(p=>{console.log(p?.totalLost||0);process.exit(0)});
" 2>/dev/null) || totalLost_AFTER="0"

if [ "$totalLost_BEFORE" = "$totalLost_AFTER" ]; then
  RESULTS+=("5b|totalLost unchanged|PASS|$totalLost_BEFORE == $totalLost_AFTER|")
  printf "  ${GREEN}PASS${NC} [5b] totalLost unchanged (%s)\n" "$totalLost_BEFORE"
  PASS=$((PASS + 1))
else
  RESULTS+=("5b|totalLost unchanged|FAIL|%s -> %s|" "$totalLost_BEFORE" "$totalLost_AFTER")
  printf "  ${RED}FAIL${NC} [5b] totalLost changed (%s -> %s)\n" "$totalLost_BEFORE" "$totalLost_AFTER"
  FAIL=$((FAIL + 1))
fi

echo

# ══════════════════════════════════════════════════════════
printf "${BOLD}-- TEST 6: Gift totalLost/totalEarned (P1) --${NC}\n"
# ══════════════════════════════════════════════════════════
RESULTS+=("6|Gift tracking|SKIP|requires friendship|")
printf "  ${YELLOW}SKIP${NC} [6] Requires pre-existing friendship (test via browser)\n"
SKIP=$((SKIP + 1))
echo

# ══════════════════════════════════════════════════════════
printf "${BOLD}-- TEST 7: HOF Self-Induction Blocked (P0) --${NC}\n"
# ══════════════════════════════════════════════════════════

run_test "7a" "Player self-induct" "401" "Unauthorized" \
  -X POST "$BASE_URL/api/hof/induct" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d "{\"userTag\": \"$PLAYER_TAG\", \"inductionType\": \"milestone\", \"milestoneTierId\": \"t-1lakh\"}"

run_test "7b" "Admin inducts player" "200" "inducted" \
  -X POST "$BASE_URL/api/hof/induct" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$ADMIN_COOKIE" \
  -d "{\"userTag\": \"$PLAYER_TAG\", \"inductionType\": \"milestone\", \"milestoneTierId\": \"t-1lakh\"}"

run_test "7c" "Internal secret inducts" "200" "inducted" \
  -X POST "$BASE_URL/api/hof/induct" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INTERNAL_SECRET" \
  -d "{\"userTag\": \"$PLAYER_TAG\", \"inductionType\": \"championship\", \"championshipYear\": 2024, \"championshipRank\": 1}"

echo

# ══════════════════════════════════════════════════════════
printf "${BOLD}-- TEST 8: Milestone Cross-Player Blocked (P1) --${NC}\n"
# ══════════════════════════════════════════════════════════

OTHER_TAG=$(node -e "
const {PrismaClient}=require('/home/z/my-project/node_modules/.prisma/client');
new PrismaClient().player.findFirst({where:{role:'player',id:{not:'$PLAYER_ID'}},select:{userTag:true}}).then(p=>{console.log(p?.userTag||'');process.exit(0)});
" 2>/dev/null) || OTHER_TAG=""

if [ -n "$OTHER_TAG" ]; then
  run_test "8a" "Check own milestones" "200" "checked" \
    -X POST "$BASE_URL/api/leaderboard/check-milestone" \
    -H "Content-Type: application/json" \
    -H "Cookie: va_session=$PLAYER_COOKIE" \
    -d "{\"userTag\": \"$PLAYER_TAG\"}"

  run_test "8b" "Check other player's milestones" "403" "only check your own" \
    -X POST "$BASE_URL/api/leaderboard/check-milestone" \
    -H "Content-Type: application/json" \
    -H "Cookie: va_session=$PLAYER_COOKIE" \
    -d "{\"userTag\": \"$OTHER_TAG\"}"
else
  RESULTS+=("8a|Own milestones|SKIP|no other player|")
  RESULTS+=("8b|Cross-player milestones|SKIP|no other player|")
  printf "  ${YELLOW}SKIP${NC} [8a/8b] No other player in DB\n"
  SKIP=$((SKIP + 2))
fi

echo

# ══════════════════════════════════════════════════════════
printf "${BOLD}-- TEST 9: Championship Finalize (P1) --${NC}\n"
# ══════════════════════════════════════════════════════════

run_test "9a" "Player finalize" "403" "Admin only" \
  -X POST "$BASE_URL/api/championship/finalize" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$PLAYER_COOKIE" \
  -d '{"year": 2024}'

FINALIZE_CODE=$(curl -s -o /tmp/venom_test_body.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/championship/finalize" \
  -H "Content-Type: application/json" \
  -H "Cookie: va_session=$ADMIN_COOKIE" \
  -d '{"year": 2024}' 2>/dev/null) || FINALIZE_CODE="000"

if [ "$FINALIZE_CODE" = "200" ] || [ "$FINALIZE_CODE" = "404" ] || [ "$FINALIZE_CODE" = "409" ]; then
  RESULTS+=("9b|Admin finalize 2024|PASS|$FINALIZE_CODE|")
  printf "  ${GREEN}PASS${NC} [9b] Admin finalize -> %s (no crash)\n" "$FINALIZE_CODE"
  PASS=$((PASS + 1))
else
  RESULTS+=("9b|Admin finalize 2024|FAIL|$FINALIZE_CODE|unexpected|")
  printf "  ${RED}FAIL${NC} [9b] Admin finalize -> %s (unexpected)\n" "$FINALIZE_CODE"
  FAIL=$((FAIL + 1))
fi

echo

# ══════════════════════════════════════════════════════════
# RESULTS SUMMARY
# ══════════════════════════════════════════════════════════
printf "${BOLD}${CYAN}========================================${NC}\n"
printf "${BOLD}             RESULTS SUMMARY              ${NC}\n"
printf "${BOLD}${CYAN}========================================${NC}\n"
TOTAL=$((PASS + FAIL + SKIP))
echo "  Total : $TOTAL"
printf "  ${GREEN}Pass  : %s${NC}\n" "$PASS"
printf "  ${RED}Fail  : %s${NC}\n" "$FAIL"
printf "  ${YELLOW}Skip  : %s${NC}\n" "$SKIP"
echo

if [ $FAIL -gt 0 ]; then
  printf "${RED}${BOLD}Failed tests:${NC}\n"
  for r in "${RESULTS[@]}"; do
    if [[ "$r" == *"|FAIL|"* ]]; then
      echo "  - $r"
    fi
  done
  echo
fi

if [ $FAIL -eq 0 ]; then
  printf "${GREEN}${BOLD}ALL TESTS PASSED!${NC}\n"
else
  printf "${RED}${BOLD}%s test(s) failed.${NC}\n" "$FAIL"
fi

exit $FAIL