---
Task ID: 1
Agent: main
Task: Fix profile panel scrolling, match history recording, and milestone display issues

Work Log:
- Investigated root cause of Match History always being empty: /api/match/result never created MatchHistory DB entries
- Added MatchHistory.create() inside the /api/match/result transaction to record every match
- Investigated scrolling issue: profile panel had overflow-hidden and parent had md:overflow-visible, preventing ALL scrolling on desktop
- Changed md:overflow-visible to overflow-y-auto in page.tsx panel container
- Removed overflow-hidden from profile panel root div in player-profile.tsx
- Updated milestones empty message to show current banked chips and next milestone threshold (100K for Bronze)
- Updated match history empty message to be more helpful
- Verified with agent-browser: scrolling works on desktop, guest profile correct, no Edit Identity for guest, milestones show banked amount

Stage Summary:
- Match History: Fixed by adding DB recording in /api/match/result route
- Scrolling: Fixed by enabling overflow-y-auto on desktop panel container
- Milestones: Shows informative empty state with current chips and threshold
- All fixes verified via agent-browser
---
Task ID: 1-6
Agent: Main
Task: Profile pic/skin compact row, live snake demo, country full name, social stats, alphanumeric tags, referral section

Work Log:
- Created /api/player/social-counts API endpoint for lightweight friend/follower/following/rival counts
- Changed userTag generation from VENOM-XXXX (4 digits) to VM-xxxxxx (6 alphanumeric chars) in auth.ts
- Replaced static SVG loadout modal with GameSnakePreview canvas-based live demo modal
- Added compact profile pic + equipped skin row above Records & Statistics (registered only)
- Profile pic click opens avatar lightbox; skin row click opens live canvas demo
- Changed country display from short code (US/IN) to full name (United States/India) via activeFlag?.name
- Added 4 social stat cards (Friends, Followers, Following, Rivals) in stats grid for registered users
- Added collapsible Referral Program section with how-it-works, code copy, referral history
- Removed View Loadout button; removed unused imports (Crown, Globe, Star)
- Updated Identity Lock Policy text to remove VENOM-XXXX reference

Stage Summary:
- All 6 items implemented and browser-verified
- Guest view: no profile pic/skin, no social cards, no referral section (correct)
- Registered view: compact pic+skin row, social cards, referral section all present
- Country shows full name, tags use new VM-xxxxxx format
- Live snake demo uses real GameSnakePreview canvas (480x200)
