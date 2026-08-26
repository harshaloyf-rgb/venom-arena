#!/bin/bash
# ============================================================================
# session-start.sh — Run at the START of every new session.
# Verifies local git matches GitHub. Auto-restores if sandbox reset happened.
# ============================================================================
set -euo pipefail

REPO_DIR="/home/z/my-project"
GITHUB_URL="https://github.com/harshaloyf-rgb/venom-arena.git"
GITHUB_USER="harshaloyf-rgb"
EXPECTED_MIN_COMMITS=50  # if local has fewer than this, something is wrong

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}=== SESSION INTEGRITY CHECK ===${NC}"

# --- 0. Ensure git credentials are available ---
GIT_CRED_FILE="$REPO_DIR/.git-credentials"
if [ ! -f "$GIT_CRED_FILE" ]; then
  echo -e "${YELLOW}No .git-credentials found. Will attempt unauthenticated fetch.${NC}"
  echo -e "${YELLOW}If push fails later, you need to re-add your GitHub token.${NC}"
else
  chmod 600 "$GIT_CRED_FILE"
  echo -e "${GREEN}.git-credentials found.${NC}"
fi

# --- 1. Check if we're in a git repo ---
cd "$REPO_DIR" || { echo -e "${RED}FATAL: $REPO_DIR not found${NC}"; exit 1; }
if [ ! -d .git ]; then
  echo -e "${RED}FATAL: No .git directory. Repo was wiped.${NC}"
  NEED_RESTORE=1
else
  NEED_RESTORE=0
  # --- 2. Check remote exists ---
  if ! git remote get-url origin &>/dev/null; then
    echo -e "${YELLOW}WARNING: No git remote configured. Sandbox reset likely.${NC}"
    NEED_RESTORE=1
  fi

  # --- 3. Check commit count ---
  LOCAL_COMMITS=$(git log --oneline 2>/dev/null | wc -l)
  echo -e "Local commits: ${LOCAL_COMMITS} (minimum expected: ${EXPECTED_MIN_COMMITS})"
  if [ "$LOCAL_COMMITS" -lt "$EXPECTED_MIN_COMMITS" ]; then
    echo -e "${YELLOW}WARNING: Commit count too low. Sandbox reset detected.${NC}"
    NEED_RESTORE=1
  fi

  # --- 4. Check if GitHub is reachable and has more commits ---
  if [ "$NEED_RESTORE" -eq 0 ]; then
    REMOTE_HASH=$(git ls-remote origin main 2>/dev/null | head -1 | awk '{print $1}')
    LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null)
    if [ -z "$REMOTE_HASH" ]; then
      echo -e "${YELLOW}WARNING: Cannot reach GitHub. Cannot verify.${NC}"
    elif [ "$REMOTE_HASH" != "$LOCAL_HASH" ]; then
      echo -e "${YELLOW}WARNING: Local HEAD (${LOCAL_HASH:0:7}) != GitHub (${REMOTE_HASH:0:7})${NC}"
      echo -e "${YELLOW}GitHub is ahead. Restoring...${NC}"
      NEED_RESTORE=1
    else
      echo -e "${GREEN}Local matches GitHub. Integrity OK.${NC}"
    fi
  fi
fi

# --- 5. Restore if needed ---
if [ "$NEED_RESTORE" -eq 1 ]; then
  echo -e "${RED}RESTORING FROM GITHUB...${NC}"
  
  # Backup DB and env if they exist
  [ -f db/custom.db ] && cp db/custom.db /tmp/custom.db.backup
  [ -f .env ] && cp .env /tmp/venom_env.backup
  echo "Backed up DB and .env"
  
  # Save current state for reporting
  OLD_COMMITS=$(git log --oneline 2>/dev/null | wc -l || echo 0)
  
  # Reset git to match GitHub
  git remote remove origin 2>/dev/null || true
  git remote add origin "$GITHUB_URL"
  git fetch origin main 2>&1
  git reset --hard origin/main 2>&1
  
  # Restore DB and env
  [ -f /tmp/custom.db.backup ] && { mkdir -p db; cp /tmp/custom.db.backup db/custom.db; }
  [ -f /tmp/venom_env.backup ] && cp /tmp/venom_env.backup .env
  echo "Restored DB and .env"
  
  # Verify restore
  NEW_COMMITS=$(git log --oneline | wc -l)
  NEW_HASH=$(git rev-parse HEAD)
  echo -e "${GREEN}RESTORED: ${NEW_COMMITS} commits, HEAD=${NEW_HASH:0:7}${NC}"
  echo -e "${YELLOW}Before restore had ${OLD_COMMITS} commits — sandbox had reset the repo.${NC}"
  
  # Run npm install since node_modules get wiped
  echo "Installing dependencies..."
  bun install 2>&1 | tail -3
fi

# --- 6. Quick health checks ---
echo ""
echo -e "${YELLOW}=== HEALTH CHECK ===${NC}"
TIERS=$(rg -c "id: 'tier-" src/lib/game-config.ts 2>/dev/null || echo 0)
echo "Arena tiers: ${TIERS}"
[ -f .env ] && echo ".env: present" || echo -e "${RED}.env: MISSING${NC}"
[ -f db/custom.db ] && echo "Database: present" || echo -e "${RED}Database: MISSING${NC}"
[ -d node_modules ] && echo "node_modules: present" || echo "node_modules: missing (run bun install)"

# --- 7. Check if .git-credentials has the token ---
if [ -f "$GIT_CRED_FILE" ]; then
  if grep -q "ghp_" "$GIT_CRED_FILE" 2>/dev/null; then
    echo -e "${GREEN}GitHub token: present${NC}"
  else
    echo -e "${RED}GitHub token: MISSING from .git-credentials${NC}"
    echo -e "${YELLOW}Push will fail! You need to re-add your GitHub PAT.${NC}"
  fi
else
  echo -e "${RED}.git-credentials: MISSING${NC}"
fi

# --- 7. Show recent chat history ---
echo ""
echo -e "${YELLOW}=== RECENT SESSION HISTORY ===${NC}"
CHAT_DIR="$REPO_DIR/chats"
if [ -d "$CHAT_DIR" ]; then
  # Show index summary
  if [ -f "$CHAT_DIR/INDEX.md" ]; then
    echo "--- Session Index ---"
    rg '^\| [0-9]' "$CHAT_DIR/INDEX.md" 2>/dev/null || echo "No sessions logged yet."
  fi
  echo ""
  # Show the LATEST session log summary (first 30 lines)
  LATEST_LOG=$(ls -t "$CHAT_DIR"/202*.md 2>/dev/null | grep -v INDEX | head -1)
  if [ -n "$LATEST_LOG" ]; then
    echo "--- Latest Session: $(basename "$LATEST_LOG") ---"
    head -30 "$LATEST_LOG"
    TOTAL_LINES=$(wc -l < "$LATEST_LOG")
    if [ "$TOTAL_LINES" -gt 30 ]; then
      echo "... ($((TOTAL_LINES - 30)) more lines. Read full log: $LATEST_LOG)"
    fi
  fi
else
  echo "No chat history yet (chats/ directory missing)."
fi

echo ""
echo -e "${GREEN}=== CHECK COMPLETE ===${NC}"
