# Worklog — Venom Arena Snake Engine Rebuild & Critical Bug Fixes

---
Task ID: 1
Agent: Main
Task: Fix online 'arena does not exist' error, fix offline rendering bugs, rebuild snake renderer

Work Log:
- Investigated 'arena does not exist' error — found game server was hiding real errors (player_not_found, database_error) behind generic 'invalid_arena' message
- Fixed game-server/index.ts line 860-875: pass through actual error reason instead of defaulting to 'invalid_arena', added error logging
- Fixed use-socket-lifecycle.ts: expanded JoinErrorReason type to include player_not_found, database_error, server_error; added user-friendly messages for each
- Investigated offline 'eyes disappear after 3 sec' bug — found lowQuality flag set to true after 2s of low FPS, and face rendering was gated on !lowQuality even for player
- Fixed render-snakes.ts: changed face rendering condition to always draw for player snake (isMe || !lowQuality)
- Fixed offline-engine.ts: added pointerAngle to FrameRenderCtx so pupils track mouse/touch direction
- Fixed 'stretchy start' — reduced base zoom from 0.9 to 0.85 for better segment overlap
- Completely rewrote render-snake-visuals.ts (~380 lines): new 3D gradient with configurable HIGHLIGHT_OFFSET/BRIGHT/SHADOW_DARK (from user's game), 6 hat types with user's cleaner drawing code, face with specular+eyes+pupil tracking+nose+smile (from user's game), direction arrow with smooth lerp (from user's game), 7 shape types with per-segment alternation, shortestAngleDelta helper, GradientCache
- Completely rewrote render-snakes.ts (~350 lines): uses new make3DGrad for all segments, shape-aware rendering (boxes/triangles rotate with snake angle), smooth pupil tracking per-frame (from user's game), direction arrow for player, kept Venom Arena features (skin patterns, opacity layering, chat bubbles, name labels, metallic/glow patterns)
- Fixed duplicate mySnake variable in use-render-loop.ts
- Fixed database readonly issue (supervisor-spawned Next.js lost write access; restarted directly)
- Browser verified: practice mode loads and renders without errors, canvas is active (1280x577)

Stage Summary:
- Online mode: error messages now accurate (was: all errors showed 'arena does not exist'; now: shows actual reason like 'Server error' or 'Player not found')
- Offline mode: eyes no longer disappear (always render for player), pupils track pointer direction, reduced initial zoom for less stretchy look
- Snake renderer: completely rebuilt with user's game approach — 3D gradient, 7 shapes, face details (specular, eyes, nose, mouth), direction arrow, 6 hat types
- Both servers running (port 3000 + 3001), lint clean, browser verified

---
Task ID: 2
Agent: Main
Task: Fresh engine rebuild — fix all remaining bugs, ensure both modes work end-to-end

Work Log:
- Deep analysis of full codebase (~52K lines, 264 files) to understand architecture
- Verified game server imports work correctly (getArenaById, snake-engine physics)
- Fixed game-server/index.ts: network errors in joinMatch() catch block now emit 'server_error' instead of misleading 'invalid_arena'
- Added /health endpoint and diagnostic logging (logs arenaId on join, joinMatch result)
- Fixed render-snakes.ts line 357: eyes now ALWAYS render for player snake (isMe || condition) regardless of distance/quality
- Added canvas backing store validation guard in use-render-loop.ts: re-sizes immediately if mismatch detected (fixes 'stretchy' on start)
- Added same guard in offline-engine.ts renderFrame()
- Added 'connection_error' to client-side error messages in use-socket-lifecycle.ts
- Started game server via supervisor.py (port 3001) and Next.js dev server (port 3000)
- Browser-tested OFFLINE mode: Practice arena loads, game runs at 60fps, HUD displays correctly, no console errors
- Browser-tested ONLINE mode: Successfully connected to tier-1 (Scrap Alley), bought in for 10c, game rendered with arena leaderboard, bot AI active, wall collision detected, death flow completed, post-death replay window worked
- Game server log confirmed full flow: socket connect → auth → join_arena → match/join → snapshot broadcast → wall death → star drop → match settlement

Stage Summary:
- ONLINE MODE FIXED: The 'arena does not exist' error was caused by two things: (1) game server not running in background, (2) network errors mapped to 'invalid_arena'. Both fixed.
- OFFLINE MODE FIXED: Eyes always render for player, canvas stretchy guard added
- Both modes verified working end-to-end in browser with zero console errors
- Game server log confirms complete game lifecycle (connect → play → death → settle → cleanup)