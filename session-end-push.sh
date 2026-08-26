#!/bin/bash
# ============================================================================
# session-end-push.sh — Run at the END of every session before closing.
# 1. Creates a chat log stub if the AI hasn't written one yet.
# 2. Stages everything, commits if changed, and pushes to GitHub.
# ============================================================================
set -euo pipefail

REPO_DIR="/home/z/my-project"
CHAT_DIR="$REPO_DIR/chats"
cd "$REPO_DIR" || exit 1

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

DATE_TODAY=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y-%m-%d-%H%M)

# --- 0. Ensure chats directory exists ---
mkdir -p "$CHAT_DIR"

# --- 1. Check if a chat log exists for today ---
TODAY_LOG=$(ls "$CHAT_DIR"/${DATE_TODAY}*.md 2>/dev/null | grep -v INDEX | sort | tail -1)
if [ -z "$TODAY_LOG" ]; then
  SESSION_NUM=1
  STUB_FILE="$CHAT_DIR/${DATE_TODAY}-session-${SESSION_NUM}.md"
  cat > "$STUB_FILE" <<EOF
# Session Log — ${DATE_TODAY} (Session ${SESSION_NUM})

**Time**: ${TIMESTAMP} (Asia/Calcutta timezone)
**Duration**: unknown
**GitHub Commits at start**: $(git log --oneline | wc -l)
**Branch**: main

---

## What Happened This Session

> ⚠️ AI did not write a detailed log. Below is auto-generated summary.

### Commits This Session
$(git log --oneline --since="2025-07-30" 2>/dev/null | head -20)

### Files Changed
$(git diff --stat HEAD~5..HEAD 2>/dev/null | tail -10)

---
*Auto-logged by session-end-push.sh*
EOF
  echo -e "${YELLOW}Created chat log stub: $STUB_FILE${NC}"
fi

# --- 2. Check for uncommitted changes ---
echo -e "${YELLOW}=== SESSION END — AUTO PUSH ===${NC}"

if git diff --quiet && git diff --cached --quiet; then
  UNTRACKED=$(git ls-files --others --exclude-standard | grep -v '.git-credentials' | head -5)
  if [ -z "$UNTRACKED" ]; then
    echo -e "${GREEN}Nothing to commit. Already synced with GitHub.${NC}"
    exit 0
  fi
fi

echo -e "${YELLOW}Changes detected. Staging and pushing...${NC}"

# Stage everything except credentials
git add -A
git reset HEAD .git-credentials 2>/dev/null || true

# Commit
SESSION_ID="$(date +%Y%m%d-%H%M%S)"
git commit -m "auto-push: end of session ${SESSION_ID}" 2>&1 || {
  echo -e "${YELLOW}Nothing new to commit (staged but no changes).${NC}"
}

# Push
echo -e "${YELLOW}Pushing to GitHub...${NC}"
if git push origin main 2>&1; then
  echo -e "${GREEN}Push successful! Your work is safe on GitHub.${NC}"
  COMMIT_COUNT=$(git log --oneline | wc -l)
  echo -e "${GREEN}Total commits on GitHub: ${COMMIT_COUNT}${NC}"
else
  echo -e "${RED}PUSH FAILED! Your work may not be backed up!${NC}"
  echo -e "${RED}Check your GitHub token in .git-credentials${NC}"
  exit 1
fi
