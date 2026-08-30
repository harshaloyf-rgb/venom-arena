---
Task ID: 1
Agent: Main
Task: Fix country detection + Build multi-region server infrastructure

Work Log:
- Fixed GeoIP to return empty string for private/localhost IPs (was defaulting to 'US')
- Made country selection REQUIRED in guest login UI (was optional)
- Added region badge showing the player's assigned region after country selection
- Added `region` field to Player DB schema (String, default 'EU')
- Ran `bun run db:push --force-reset` to apply schema
- Added REGION_SERVERS config mapping 8 regions to separate ports (3010-3017)
- Updated all 3 auth routes (guest/register/social-callback) to compute & store region
- Created `/api/player/region-server` endpoint returning server info for player's region
- Updated `/api/game-server/ensure` to accept `region` param and spawn regional servers
- Made game-server port configurable via `PORT` env var
- Updated `game-socket.ts` to fetch player's region and connect to correct server port
- Added `region` to PlayerProfile type and toProfile helper
- Verified end-to-end: India guest login → country=IN, region=SA, server port 3011

Stage Summary:
- GeoIP no longer defaults to US on localhost — returns empty string, backend requires manual selection
- Guest login UI requires country selection, shows region badge (e.g. "Region: South Asia")
- Player DB now stores `region` field (auto-computed from country on signup)
- 8 regional game servers configured: APAC:3010, SA:3011, MEA:3012, NA:3013, SA_AM:3014, EU:3015, CIS:3016, OC:3017
- Frontend dynamically connects to player's regional server via /api/player/region-server
- Game server supports PORT and REGION env vars for multi-instance deployment
- In production, change REGION_SERVERS host/port to deploy to real cloud regions
