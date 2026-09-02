#!/usr/bin/env bash
# ============================================================================
# Venom Arena — one-command deploy (T5 deploy kit)
# ============================================================================
# Builds the standalone bundle locally, ships it + the game server to a VPS,
# installs/refreshes systemd units, restarts services, health-checks.
#
# Prereqs on the REMOTE host (one-time):
#   - bun installed (curl -fsSL https://bun.sh/install | bash)
#   - nginx + certs configured (template: scripts/deploy/nginx/venom-arena.conf)
#   - passwordless sudo for the ssh user (systemd install), or run manually
#
# Usage:
#   REMOTE_USER=ubuntu REMOTE_HOST=play.venomarena.gg bash scripts/deploy/deploy.sh
#
# Optional env:
#   REMOTE_APP_DIR=/opt/venom-arena   (default)
#   SKIP_BUILD=1                      (reuse last build:prod output)
# ============================================================================
set -euo pipefail

REMOTE_USER="${REMOTE_USER:?set REMOTE_USER}"
REMOTE_HOST="${REMOTE_HOST:?set REMOTE_HOST}"
APP_DIR="${REMOTE_APP_DIR:-/opt/venom-arena}"
SSH="${REMOTE_USER}@${REMOTE_HOST}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# ── 1. Build ────────────────────────────────────────────────────────────────
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> [1/6] Building standalone bundle (isolated distDir)"
  npm run build:prod
else
  echo "==> [1/6] SKIP_BUILD=1 — reusing existing .next-prod-build"
fi
[ -f .next-prod-build/standalone/server.js ] || { echo "FATAL: no standalone output — run without SKIP_BUILD"; exit 1; }

# Prisma query engine: nft tracing usually includes it, but bun-run standalone
# has historically missed it. Defensive copy into the bundle's node_modules.
if [ -d node_modules/.prisma ]; then
  echo "==> [1/6b] Copying prisma engines into standalone node_modules"
  mkdir -p .next-prod-build/standalone/node_modules/.prisma
  cp -r node_modules/.prisma/client .next-prod-build/standalone/node_modules/.prisma/ 2>/dev/null || true
fi

# ── 2. Ship the web bundle ──────────────────────────────────────────────────
echo "==> [2/6] rsync web bundle -> ${SSH}:${APP_DIR}/web"
ssh "$SSH" "mkdir -p '${APP_DIR}/web'"
rsync -az --delete .next-prod-build/standalone/ "${SSH}:${APP_DIR}/web/"
rsync -az .env "${SSH}:${APP_DIR}/web/.env"
chmod 600 "$ROOT/.env" # local hygiene; remote perms set below

# ── 3. Ship the game server ─────────────────────────────────────────────────
echo "==> [3/6] rsync game server -> ${SSH}:${APP_DIR}/game-server"
ssh "$SSH" "mkdir -p '${APP_DIR}/game-server'"
rsync -az --delete \
  --exclude node_modules --exclude '*.log' --exclude '*.pid' \
  mini-services/game-server/ "${SSH}:${APP_DIR}/game-server/"
rsync -az .env "${SSH}:${APP_DIR}/game-server/.env"

# ── 4. Install systemd units (bun path resolved remotely) ──────────────────
echo "==> [4/6] Installing systemd units"
BUN_PATH="$(ssh "$SSH" 'which bun || echo /usr/bin/bun')"
echo "    remote bun: ${BUN_PATH}"
for unit in venom-web venom-game; do
  sed "s|ExecStart=/usr/bin/bun|ExecStart=${BUN_PATH}|" \
    "scripts/deploy/systemd/${unit}.service" > "/tmp/${unit}.service"
  rsync -az "/tmp/${unit}.service" "${SSH}:/tmp/${unit}.service"
  ssh "$SSH" "sudo mv /tmp/${unit}.service /etc/systemd/system/${unit}.service"
done
ssh "$SSH" "sudo chmod 600 '${APP_DIR}/web/.env' '${APP_DIR}/game-server/.env' && \
            sudo systemctl daemon-reload && \
            sudo systemctl enable --now venom-web venom-game && \
            sudo systemctl restart venom-web venom-game"

# ── 5. Health checks (from the remote's point of view) ─────────────────────
echo "==> [5/6] Health checks"
sleep 3
ssh "$SSH" "curl -sf -o /dev/null http://127.0.0.1:3000/ && echo 'web :3000 OK' || { echo 'web FAIL'; sudo journalctl -u venom-web -n 20 --no-pager; exit 1; }"
ssh "$SSH" "curl -sf -o /dev/null 'http://127.0.0.1:3001/socket.io/?EIO=4&transport=polling' && echo 'game :3001 OK' || { echo 'game FAIL'; sudo journalctl -u venom-game -n 20 --no-pager; exit 1; }"
ssh "$SSH" "curl -sf -o /dev/null http://127.0.0.1:3000/sw.js && echo 'sw.js OK'"

# ── 6. Done ────────────────────────────────────────────────────────────────
echo "==> [6/6] Deployed to ${REMOTE_HOST}"
echo "    Public check: https://${REMOTE_HOST}/  (nginx + TLS assumed)"
echo "    App env for the Capacitor release shell:"
echo "      CAPACITOR_SERVER_URL=https://${REMOTE_HOST} npm run mobile:sync"
