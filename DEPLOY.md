# Venom Arena — Deployment Runbook

Production deployment guide: Next.js standalone web (:3000) + Bun game server (:3001) behind nginx with TLS. One command ships both.

```
Internet ──> nginx :443 (TLS, WS upgrade) ──> Next.js standalone :3000   (web + /api/*)
                                        └──> Bun game server   :3001   (same-origin WS via /?XTransformPort=3001)
```

The client always talks to one origin: REST goes to `/api/*`, the game socket connects to `/?XTransformPort=3001`. nginx upgrades WebSockets on the root location, so no separate `ws.` domain and no client-side `NEXT_PUBLIC_*` URL config is required for a standard deploy.

---

## 1. One-command deploy

`scripts/deploy/deploy.sh` builds the standalone bundle locally, ships it plus the game server via rsync, installs systemd units, restarts services, and health-checks.

Prereqs:

- **Local (build machine):** Node + npm working; ssh access to the target host.
- **Remote VPS (one-time):**
  - Bun installed: `curl -fsSL https://bun.sh/install | bash`
  - nginx + TLS configured (template: `scripts/deploy/nginx/venom-arena.conf`)
  - ssh user with passwordless sudo (needed to install systemd units)
- **DNS:** an A/AAAA record pointing your domain at the VPS.

Usage:

```bash
REMOTE_USER=ubuntu REMOTE_HOST=play.venomarena.gg bash scripts/deploy/deploy.sh
```

Optional env: `REMOTE_APP_DIR=/opt/venom-arena` (default), `SKIP_BUILD=1` (reuse the last `build:prod` output for a fast re-ship).

What it does, in order:

1. `npm run build:prod` — isolated build (distDir `.next-prod-build`, never touches a running dev server), standalone output + static assets placed at `standalone/.next-prod-build/static/` and `public/`.
2. Defensively copies Prisma query engines into the bundle (bun-run standalone has historically missed them).
3. rsync web bundle → `/opt/venom-arena/web/` and `mini-services/game-server/` → `/opt/venom-arena/game-server/`, each with a copy of `.env` (chmod 600 remote).
4. Installs `venom-web.service` and `venom-game.service` systemd units (bun path rewritten to the remote's `which bun`), enables + restarts both.
5. Health checks from the remote's point of view: `:3000/`, `:3001/socket.io/?EIO=4&transport=polling`, `/sw.js`.

If schema changed since the last deploy, push it first: `npm run db:push` (or `db:migrate`) against the production `DATABASE_URL`.

---

## 2. First-time VPS setup (manual, once)

```bash
# 1. bun
curl -fsSL https://bun.sh/install | bash

# 2. nginx
sudo apt install -y nginx
sudo cp scripts/deploy/nginx/venom-arena.conf /etc/nginx/sites-available/venom-arena
#    edit server_name to your domain, then:
sudo ln -s /etc/nginx/sites-available/venom-arena /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 3. TLS (Capacitor release shell requires https)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d play.venomarena.gg
```

The nginx template does three non-obvious things — keep them if you customize:

- **Game socket routing:** the client opens a raw WebSocket to `/?XTransformPort=3001` (same origin, any path + query param). That convention is understood by the sandbox preview proxy but **not by stock nginx** — so the template rewrites any request carrying the `XTransformPort` query param to an internal `/_game_ws` location that proxies to `:3001` with `Upgrade`/`Connection` headers. Without this, the handshake hits Next.js (which has no WebSocket server) and **production multiplayer silently breaks**.
- `client_max_body_size 20m` (avatar/skin uploads ride the same origin).
- `proxy_read_timeout 300s` for long-lived game sockets.

---

## 3. Environment variables

Remote `.env` files (both services) — same three secrets as local:

| Var | Used by | Purpose |
|-----|---------|---------|
| `DATABASE_URL` | web + game server | Postgres connection |
| `JWT_SECRET` | web | Session/game token signing |
| `INTERNAL_SECRET` | web + game server | Server-to-server auth (`x-internal-secret`) |

Optional client flags (baked in at **build time** — set them before `deploy.sh` if used):

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Point REST at a different API host (empty = same origin) |
| `NEXT_PUBLIC_GAME_WS_URL` | Override the game socket URL (empty = `/?XTransformPort=3001` same origin) |
| `NEXTAUTH_URL` / `NEXT_PUBLIC_BASE_URL` | OAuth callback base — required only if social login is enabled |

A single-domain deploy needs **none** of the `NEXT_PUBLIC_*` vars.

---

## 4. Post-deploy verification

Run from your machine against `https://<domain>` (or use `scripts/deploy/smoke.sh`):

```bash
BASE=https://play.venomarena.gg
curl -sf $BASE/ | grep viewport-fit=cover          # web + mobile viewport meta
curl -sf $BASE/sw.js | grep venom-shell            # service worker served
curl -sf $BASE/manifest.json > /dev/null           # PWA manifest
CHUNK=$(curl -s $BASE/ | grep -oP '/_next/static/[^"]+\.(js|css)' | head -1)
curl -sf "$BASE$CHUNK" > /dev/null                 # a REAL _next/static asset (catches distDir placement bugs)
curl -sf "$BASE/socket.io/?EIO=4&transport=polling" > /dev/null   # game WS reachable via nginx
```

That `_next/static` chunk check matters: the first prod-verification build placed static assets under the default distDir path instead of `.next-prod-build/`, so every page rendered but every CSS/JS chunk 404'd — invisible to plain HTML checks. The chunk fetch is the regression guard.

Browser-level checks:

- Open the game, play one round — socket connects, no console errors.
- DevTools → Application → Service Workers: registered and activated (production only; dev never registers).
- Offline toggle + reload → `/offline` fallback page renders.

---

## 5. Service worker / cache policy

`public/sw.js`:

- Navigation requests: network-first → last-good HTML cache → `/offline` fallback.
- `/_next/static/*` and `/icons/*`: cache-first (immutable, content-hashed).
- `/api/*` and `socket.io`: always network, never cached.

**Bump `VERSION` in `public/sw.js` on every release that changes precached assets** (`venom-shell-v1` → `v2`, …) — otherwise clients keep serving the old precache.

---

## 6. Android APK (Capacitor shell)

The Android app is a branded remote-URL shell (no bundled web assets), so it needs the live https URL at sync time:

```bash
CAPACITOR_SERVER_URL=https://play.venomarena.gg npm run mobile:sync
npm run mobile:open        # opens Android Studio
```

Then in Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**. Requires Android Studio + SDK locally (not buildable in the sandbox). Note: the manifest sets `android:usesCleartextTraffic="true"` so the dev-emulator `http://10.0.2.2:3000` target works; **release builds must use `https://`** (cleartext is permitted, never required — and Apple forbids it on iOS entirely).

Before a store release you also need: a signing keystore, version bump in `android/app/build.gradle`, and store listing assets (see section 7).

---

## 7. Redeploys, rollback, troubleshooting

**Redeploy:** just re-run `deploy.sh` (add `SKIP_BUILD=1` to re-ship the last build). systemd restarts take ~1s; in-flight game sockets drop on restart of `venom-game`, so prefer low-traffic windows or announce restarts.

**Rollback:** the standalone bundle is fully self-contained per release. Keep the previous release by rsyncing to a versioned dir (e.g. `/opt/venom-arena-releases/$(date +%s)/`) and pointing a `web-current` symlink at it — or simply re-deploy an older git tag from a checkout.

**Logs / status on the VPS:**

```bash
sudo systemctl status venom-web venom-game
sudo journalctl -u venom-web -n 100 --no-pager   # web errors
sudo journalctl -u venom-game -n 100 --no-pager  # game server errors
```

**Common failures:**

| Symptom | Likely cause |
|---------|--------------|
| Pages load but unstyled / chunks 404 | static assets not at `standalone/.next-prod-build/static/` — re-run `build:prod` (fixed in `build:prod` script), never hand-copy to `.next/` |
| `venom-web` crash-loops | missing/invalid `DATABASE_URL` in `/opt/venom-arena/web/.env`, or Prisma engine missing (deploy.sh copies it defensively) |
| Game connects locally but not via domain | nginx missing the `XTransformPort` → `/_game_ws` → `:3001` routing (see section 2) — the WS handshake is landing on Next.js |
| Old UI after deploy | SW kept old cache — bump `VERSION` in `public/sw.js` and redeploy |
| 502 from nginx | upstream service down — check `systemctl status`, then journalctl |

**Operational notes:**

- Ops history for this project lives in `/home/z/my-project/worklog.md` (sandbox side); the repo itself is the source of truth for code.
- Admin console: `ADMIN-GUIDE.md` in the repo root.
