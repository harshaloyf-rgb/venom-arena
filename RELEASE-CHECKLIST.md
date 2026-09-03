# Venom Arena — Release Checklist (the "do it later" handoff)

Everything buildable in the sandbox is done and pushed. What remains needs **your machine / your accounts**. Work top to bottom; each step is copy-paste. Deep details live in `DEPLOY.md`.

State at handoff: main = `0266f03` · tsc 0 errors · tier1 5/5 · tier2 34/34 · sprint2 21/21 · prod build + static chunks verified · nginx WS routing fixed · signing config wired.

---

## Phase A — VPS + domain (one-time, ~30 min)

**A1.** Buy a small VPS: Ubuntu 24.04, 1 vCPU / 1–2 GB RAM is plenty to start (Hetzner CX22, DigitalOcean Basic $6, etc.).

**A2.** Point a domain (or subdomain) at it: DNS `A` record → VPS IP. Example: `play.venomarena.gg`.

**A3.** Install bun + nginx + TLS on the VPS (ssh in as root first):

```bash
curl -fsSL https://bun.sh/install | bash && source ~/.bashrc
apt update && apt install -y nginx certbot python3-certbot-nginx
```

**A4.** Install the nginx template (from your local clone of the repo, or copy-paste the file):

```bash
# from your repo clone:
scp scripts/deploy/nginx/venom-arena.conf root@<VPS_IP>:/etc/nginx/sites-available/venom-arena
# then on the VPS:
sed -i 's/server_name _;/server_name play.venomarena.gg;/' /etc/nginx/sites-available/venom-arena
ln -sf /etc/nginx/sites-available/venom-arena /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d play.venomarena.gg    # free https, auto-renews
```

## Phase B — Deploy (~5 min, repeatable)

From the machine that has the repo + `.env` (this sandbox can do it too if you provide SSH access):

```bash
npm run build:prod        # only if you changed code since last build
REMOTE_USER=root REMOTE_HOST=play.venomarena.gg bash scripts/deploy/deploy.sh
```

The script ships the web bundle + game server, installs systemd services (`venom-web`, `venom-game`), restarts them, and health-checks. Verify from anywhere:

```bash
BASE=https://play.venomarena.gg bash scripts/deploy/smoke.sh
```

Then play one live round in a desktop browser — socket must connect.

> Database: the VPS reuses your existing `DATABASE_URL` (shipped inside `.env`). If the DB lives elsewhere, make sure it accepts connections from the VPS IP.

**B-SCHEMA (REQUIRED after every code update — do not skip).** Newer API routes
read/write newer tables. If the VPS database is behind the code, the lobby shows
"Network error during registration", "Failed to load clips", failing claims, and
empty leaderboards/HOF details. After every deploy, run on the VPS (in the app
folder that contains `prisma/schema.prisma`):

```bash
npx prisma db push        # applies schema diffs to the SQLite file (non-destructive for additive changes)
pm2 restart venom-web || systemctl restart venom-web   # or your process manager
```

Then verify with the built-in self-check (reports any missing table by name):

```bash
curl -s https://play.venomarena.gg/api/health
# ok:true  → schema current. missingTables:[...] → run npx prisma db push.

## Phase C — Android APK (your machine, needs Android Studio)

**C1.** Install [Android Studio](https://developer.android.com/studio) (includes SDK; open the project once to let it download what's needed).

**C2.** Point the shell at your live site and sync:

```bash
CAPACITOR_SERVER_URL=https://play.venomarena.gg npm run mobile:sync
npm run mobile:open
```

**C3.** (Only if publishing to Play Store) Create + wire the signing keystore:

```bash
keytool -genkeypair -v -keystore venom-arena-release.jks -alias venom-arena \
  -keyalg RSA -keysize 2048 -validity 10000
cp android/keystore.properties.template android/keystore.properties   # fill it in
```

⚠️ Back the `.jks` + passwords up forever — Play treats the first uploaded cert as the app's identity. Without `keystore.properties`, release builds simply fall back to debug signing (fine for sharing APKs directly).

**C4.** In Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)** → APK at `android/app/build/outputs/apk/release/` (or `debug/`). Install on a phone, play a round.

## Phase D — Publish (optional, Play Console $25 one-time)

1. Play Console → Create app (name **Venom Arena**, id `gg.venomarena.app`).
2. Upload the signed **.aab** (Build → Generate Signed Bundle) to internal testing first.
3. Store listing copy, ready to paste:

   - **Short (80 chars):** `Weave, boost, and outplay rivals in a fast multiplayer snake arena.`
   - **Full:** `Venom Arena is a real-time multiplayer snake io game. Grow by collecting chips, boost to cut off rivals, survive the shrinking arena, and climb the global leaderboard. Season passes, daily rewards, clans, and tournaments keep the arena alive.`

4. Required graphic assets: app icon (already generated: `public/icons/icon-512.png`), 2+ phone screenshots (take from the game), 1024×500 feature graphic.

## Phase D2 — Monetization setup (IAP + rewarded ads, optional)

Both systems are fully implemented server-authoritative and ship **dark** — nothing
is visible or earnable until you complete the respective setup guide:

- **Real IAP (chip store):** follow `IAP-SETUP.md` — Play Console products +
  service account, App Store Connect products, env vars, then `npm i && npx cap sync android`.
- **Rewarded ads (AdMob):** follow `ADS-SETUP.md` — AdMob app + rewarded ad unit,
  set the SSV callback URL to `https://YOUR-DOMAIN/api/ads/ssv`, replace the TEST
  App ID in `AndroidManifest.xml`, set `NEXT_PUBLIC_ADMOB_ENABLED=true` + ad unit env,
  then rebuild. With the flag off no ad UI renders anywhere.

## Phase E — Every future release

1. Bump `VERSION` in `public/sw.js` (cache-bust for returning players).
2. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
3. `npm run build:prod` → `deploy.sh` → `smoke.sh` → `mobile:sync` → build APK/aab.
