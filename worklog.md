---
Task ID: 1
Agent: Main
Task: Investigate and fix all pending issues from previous session

Work Log:
- Read all affected files: leaderboards.tsx, hall-of-fame.tsx, player-profile.tsx, player-inspector-modal.tsx, social-panel.tsx
- Tested Leaderboard Tiers tab via agent-browser — works fine, no error
- Investigated HOF Champions Wing leak — found REAL test data in DB (VENOM-9402 inducted as GRAND CHAMPION with 4160c)
- Deleted polluted HOF entry from database
- Verified admin-only tabs already removed from Profile and Inspector
- Verified profile edit (IdentityEditor) already exists and works
- Verified rival count already displays in Inspector social stats bar
- Verified Followers tab with follow-back already exists in social-panel
- Added "Turn Rival into Friend" feature to Inspector (new handler + UI button)
- All tests verified via agent-browser

Stage Summary:
- Tiers tab: Working, no error found (may have been fixed in previous session)
- HOF demo leak: Root cause was test data in DB, not code issue. Cleaned DB.
- Admin tabs: Already removed in previous session
- Profile edit: Already exists (Edit2 button + IdentityEditor component)
- Rival count: Already shows in Inspector (Swords icon, orange badge)
- NEW: "Turn Rival into Friend" button added to Inspector when viewing a rival
- Followers + Follow-back: Already exists in Friends & Search panel
