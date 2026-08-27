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
---
Task ID: 1-6-followup
Agent: Main
Task: 6 follow-up fixes per user feedback

Work Log:
- Removed equipped items grid from Live Demo modal (kept only canvas + title)
- Changed name area format: removed flag emoji, now shows "username, country - FULLNAME, clan - TAG (rank)"
- Added "Profile Pic" label below the small profile picture
- Added "Equipped Skin:" label before skin name in the compact row
- Made avatar lightbox compact (no padding, no title, smaller 32x32 area, auto-fit)
- Made skin demo modal compact (removed p-5 outer padding, reduced canvas height to 180px, removed mx-4)
- Added optional Referral Code field to registration form with helper text
- Updated /api/auth/register to validate and link referral codes on registration

Stage Summary:
- All 6 follow-up items implemented
- Registration form now has Referral Code (optional) input field
- Register API validates code exists and creates Referral record with 'pending' status
- Profile name shows: username, country - FULLNAME (uppercase), clan - TAG (rank)
- Both modals are compact and fit viewport without scrolling
---
Task ID: 1
Agent: main
Task: Fix profile modals, move referral above milestones, name format, labels, referral code in upgrade

Work Log:
- Moved Referral Program section ABOVE Chip Milestones in player-profile.tsx (was after milestones)
- Changed name area format: removed flag emoji, country shows as uppercase short code with "country -" prefix (e.g., "country - US"), clan info shown before country
- Removed unused activeFlag/activeFlagCosmetic/activeBanner variables
- Fixed avatar lightbox: changed from centered to top-aligned (pt-[15vh]), reduced image to w-28 h-28, compacted padding to p-3, moved close button outside
- Fixed skin demo modal: changed from centered to top-aligned (pt-[12vh]), reduced canvas height from 180 to 150, max-w-lg to max-w-md, compacted padding to p-3
- Removed equipped items grid from Live Demo modal (was already only canvas from prior session)
- Added "Profile Pic" label below the small profile pic (was already present from prior session)
- Added "Equipped Skin:" label on the skin row (was already present from prior session)
- Added referral code input field to guest upgrade form (guest-upgrade.tsx)
- Added referral code validation and linking to upgrade API route (/api/auth/upgrade)
- Grid changed from lg:grid-cols-4 to lg:grid-cols-5 to accommodate referral field
- Verified all changes via agent-browser: correct section order, modals don't require scrolling, name format correct

Stage Summary:
- Referral Program now appears BEFORE Chip Milestones (order: Referral → Milestones → Tournament Guardrails)
- Name format: "TestUser99 country - US" (no flag emoji, uppercase country code with "country -" prefix)
- Both modals (avatar lightbox + skin demo) use top-alignment (pt-[15vh]/pt-[12vh]) to avoid scrolling
- Guest upgrade form now has referral code input field with API support
- All changes lint-clean, browser-verified
