#!/usr/bin/env bash
# ============================================================================
# Venom Arena — post-deploy smoke test (see DEPLOY.md section 4)
# Usage:  BASE=https://play.venomarena.gg bash scripts/deploy/smoke.sh
#         BASE=http://127.0.0.1:3000 bash scripts/deploy/smoke.sh
# ============================================================================
set -u
BASE="${BASE:-https://play.venomarena.gg}"
echo "smoke-testing ${BASE}"

FAIL=0
check() { # name, path, expected_substr(optional)
  local name="$1" path="$2" want="${3:-}"
  local body code
  code="$(curl -sk -o /tmp/va_smoke_body -w '%{http_code}' "${BASE}${path}")"
  if [ "$code" != "200" ]; then
    echo "FAIL ${name} -> HTTP ${code}"; FAIL=1; return
  fi
  if [ -n "$want" ] && ! grep -q "$want" /tmp/va_smoke_body; then
    echo "FAIL ${name} -> 200 but missing '${want}'"; FAIL=1; return
  fi
  echo "PASS ${name} (200${want:+, has '$want'})"
}

check "home page"        "/"            "viewport-fit=cover"
check "service worker"   "/sw.js"       "venom-shell"
check "manifest"         "/manifest.json"
check "offline page"     "/offline"
check "icons"            "/icons/icon-192.png"
check "guest auth API"   "/api/auth/me"

# Game WS via nginx — only meaningful through the production nginx conf
# (local dev routes the socket via the sandbox preview proxy instead).
if [ "${SKIP_WS:-0}" = "1" ]; then
  echo "SKIP game WS via nginx (SKIP_WS=1)"
else
  check "game WS via nginx" "/socket.io/?EIO=4&transport=polling"
fi

# Real _next/static asset — the regression guard for the distDir static
# placement bug (HTML-only checks render fine while every chunk 404s).
CHUNK="$(curl -sk "${BASE}/" | grep -oP '/_next/static/[^"]+\.(js|css)' | head -1)"
if [ -z "$CHUNK" ]; then
  echo "FAIL static-asset -> no /_next/static URL in home HTML"; FAIL=1
else
  check "_next/static asset (${CHUNK})" "$CHUNK"
fi

if [ "$FAIL" = "1" ]; then echo "SMOKE RESULT: FAIL"; exit 1; fi
echo "SMOKE RESULT: ALL PASS"
