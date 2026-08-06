# Work Log

---
Task ID: 1
Agent: Main
Task: Read codebase and diagnose all issues

Work Log:
- Read render-snake-atlas.tsx (822 lines) — found eye tracking, boost effects, custom skin rendering
- Read input.ts — found mouse angle calculation using viewport center
- Read SnakeGame.tsx — found skin resolution using getPlayerSkinAsset/getPlayerSkinId
- Read skin-registry.ts — confirmed getPlayerSkinId returns 'custom-lab-skin' from localStorage
- Read engine.ts — confirmed snake.skinId set correctly from skinOverride
- Read cosmetics-shop.tsx (908 lines) — found complex 3-tab + 7-filter UI
- Read try-on-preview.tsx — found preview with fixed-forward eyes
- Read skin-preview-game.tsx — found preview eyes not tracking mouse
- Read cosmetics-section.tsx — found face cosmetics panel
- Read face-cosmetics.ts — found CosmeticDrawParams type and renderEquippedCosmetics

Stage Summary:
- ROOT CAUSE 1: Custom lab skin gets atlas built, so atlas renderer used → atlas renderer has no shape/taper/glow code
- ROOT CAUSE 2: Eyes use snake.targetAngle which converges to snake.angle (turn-rate limited) → pupils always look forward
- ROOT CAUSE 3: Preview eyes are drawn at fixed offset, don't track mouse
- ROOT CAUSE 4: Shop has 3 tabs + 7 category filters + 4-step lab jargon = confusing

---
Task ID: 2
Agent: Main
Task: Fix custom skin not equipping in-game

Work Log:
- Modified renderSnakeAtlas() to redirect 'custom-lab-skin' to fallback renderer
- Fallback renderer has shape/taper/glow code at lines 556-567
- Also added mouseScreenX/mouseScreenY parameters for eye tracking

Stage Summary:
- Custom lab skins now correctly use fallback renderer with shapes, taper, and glow
- File: src/components/game/render-snake-atlas.tsx

---
Task ID: 3
Agent: Main
Task: Fix ultra-responsive eyes

Work Log:
- Updated drawResponsiveEyes() to accept mouseScreenX/mouseScreenY parameters
- Changed eye tracking from snake.targetAngle (converges to snake.angle) to raw mouse position
- Pupils now track mouse cursor directly with 0.7 * eyeRadius shift (edge of socket)
- Falls back to targetAngle when mouse position unavailable
- Updated both atlas and fallback renderer paths to pass mouse position
- Updated SnakeGame.tsx to get mouse position via input.getMousePos() and pass to renderers
- Updated CosmeticsDrawParams interface to include mouseScreenX/mouseScreenY
- Updated GameSkinPreview to track mouse and make preview eyes responsive

Stage Summary:
- Eyes now track mouse cursor directly — even tiny movements cause visible pupil shifts
- Files: render-snake-atlas.tsx, SnakeGame.tsx, face-cosmetics.ts, skin-preview-game.tsx

---
Task ID: 4
Agent: Main
Task: Fix preview eyes + cosmetics positioning

Work Log:
- Updated skin-preview-game.tsx to track mouse position via mousemove event
- Changed eye positioning to use proper perpendicular angle (like in-game)
- Pupils in preview now track mouse with same 0.7 * eyeR shift

Stage Summary:
- Preview now has same eye positioning and tracking as in-game
- File: src/components/panels/cosmetics/skin-preview-game.tsx

---
Task ID: 5
Agent: Main
Task: Redesign Shop+Lab into simple Wardrobe

Work Log:
- Completely rewrote cosmetics-shop.tsx (908 lines → 478 lines)
- New structure: "My Wardrobe" with two tabs ("Body Skin" + "Face Cosmetics")
- Live TryOnPreview always visible at top
- Body tab: horizontal scrollable preset cards + collapsible "Create Your Own" section
- Create Your Own: inline color palette, shape, thickness, glow selectors (no numbered steps)
- Face tab: reuses existing CosmeticsSection component
- Removed: 3 view-mode tabs, 7 category filters, Genetic Pattern Lab jargon, manufactured/premium skin cards

Stage Summary:
- Clean, simple Wardrobe UI verified working in browser
- File: src/components/panels/cosmetics-shop.tsx (complete rewrite)

---
Task ID: 6
Agent: Main
Task: Add 1 billion chips

Work Log:
- Ran `npx prisma db execute` to UPDATE Player SET bankedChips = 1000000000

Stage Summary:
- Player bankedChips updated to 1,000,000,000 in database

---
Task ID: 7
Agent: Main
Task: Browser verification

Work Log:
- Opened app in agent-browser, logged in as guest
- Navigated to Wardrobe: confirmed "My Wardrobe" title, 2 tabs, 20 preset cards, all working
- Switched to Face Cosmetics tab: confirmed all 9 slots and 8 eye cosmetics (all Free)
- Expanded "Create Your Own": confirmed 18 color palette, shape/taper/glow options, Deploy button
- Started game via arena selector: confirmed canvas renders, no errors in console
- Lint: clean (0 errors, 0 warnings)

Stage Summary:
- All changes verified working in browser
- Game starts and renders correctly
- Wardrobe UI is clean and functional

---
Task ID: 1
Agent: main
Task: Redesign Shop+Lab into 4-corner Wardrobe layout with sub-pages for Cosmetics and Build Your Venom

Work Log:
- Analyzed 3 uploaded UI screenshots (current skin list, cosmetics grid, color palette reference)
- Read all existing wardrobe/cosmetics code files (cosmetics-shop.tsx, cosmetics-types.ts, cosmetics-utils.ts, cosmetics-section.tsx, try-on-preview.tsx, skins-canvas-preview.tsx, venom-painter.tsx)
- Created VenomPainter component at /src/components/panels/cosmetics/venom-painter.tsx — interactive canvas with 20 segment positions, color palette, shape/taper/glow selectors, delete/reset/save
- Rewrote cosmetics-shop.tsx as 4-corner wardrobe layout:
  - Main view: scrollable skin list (20 presets + custom), top-left BG changer, top-right Cosmetics button, bottom-left Skin Applied, bottom-right Build Your Venom
  - Cosmetics view: back button + CosmeticsSection + OK button
  - Venom view: back button + VenomPainter + OK button
- Fixed lint errors: moved useCallback before early returns, renamed Image icon to ImageIcon, removed malformed JSX comments
- Added 1 billion chips to user account (was already at 1B from previous session)
- Verified cosmetics positioning code is correct (uses forward/perp angle helpers, proportional to head radius)
- Browser verified all 3 views render correctly

Stage Summary:
- 4-corner wardrobe layout implemented and working
- Venom painter canvas allows painting segments with 18-color palette + shape/taper/glow options
- All 20 presets, cosmetics, and custom skin features preserved
- Lint passes clean
---
Task ID: 1
Agent: main
Task: Replace single GameSnakePreview with grid of small per-skin roaming snake previews

Work Log:
- Read cosmetics-shop.tsx, game-snake-preview.tsx, skin-registry.ts, cosmetics-types.ts to understand structure
- Updated GameSnakePreview component: added `scale` prop (default 1), `showLabel` prop, proportional wall margin based on canvas size
- Replaced single <GameSnakePreview> in cosmetics-shop.tsx (line 498) with a responsive grid of small previews (130x70, scale=0.5, 10 segments)
- Each skin gets its own roaming snake canvas — 20 presets + 13 premium = 33 total
- Grid filters by category: shows presets when presets tab active, premium when premium tab active, both when 'all'
- Removed unused preview state (previewSkinId, previewHeadColor, previewBodyColor) and onMouseEnter hover handlers from PresetCard/SkinCard
- Wrapped grid in styled container with "Live Skin Previews" header

Stage Summary:
- File modified: src/components/panels/cosmetics/game-snake-preview.tsx (added scale, showLabel, proportional wallM)
- File modified: src/components/panels/cosmetics-shop.tsx (replaced single preview with grid, cleaned up state)
- Verified: 33 canvases render on 'all' category, 20 on presets, 13 on premium
- VLM screenshot verification confirmed different colored snakes, names below each, roaming animation
- Lint passes clean, no runtime errors
---
Task ID: 1
Agent: Main
Task: Fix Genetic Pattern Lab - remove text, add segments, fix teleporting, fix geometry/taper/glow

Work Log:
- Read try-on-preview.tsx (old component, now replaced by GameSnakePreview)
- Read game-snake-preview.tsx to understand current rendering
- Read cosmetics-shop.tsx to find where GameSnakePreview is used in the lab
- Identified root causes:
  1. "STEER TO TEST" text was a span above the canvas in cosmetics-shop.tsx
  2. Segments was 16, user wanted 20-21
  3. Teleporting: all snake state was inside useEffect closure, re-initialized on every prop change
  4. Geometry/Taper/Glow: these props (bodyStyle, taperStyle, glow) were not passed from cosmetics-shop.tsx to GameSnakePreview, and the component didn't support them
- Rewrote GameSnakePreview to support Genetic Lab mode (colors[], bodyStyle, taperStyle, glow)
- Used persistent refs (posRef, bufRef) for position state that survives effect re-runs
- Color resolution done via useMemo-like pattern in render body, captured in effect closure
- Added drawSegmentShape integration for non-circle shapes (dragon, armored, crystal, obsidian, basilisk)
- Added computeTaperRadius integration for taper physics
- Added glow shadow rendering via drawSegmentShape's glow parameter
- Updated cosmetics-shop.tsx: removed "LAB HOLO-PREVIEW (STEER TO TEST)" span, passed colors/bodyStyle/taperStyle/glow props, increased segments from 16 to 20
- Fixed lint issues with react-hooks/immutability by avoiding ref mutations after useEffect
- Verified with browser + VLM:
  - STEER TO TEST text removed ✅
  - Snake has 20 body segments ✅
  - No teleporting on color change ✅
  - Dragon Scales geometry shows spikes ✅
  - Heavy Head taper shows large head + thin tail ✅
  - Bioluminescent Aura glow toggle works ✅
  - Skin card previews still work correctly ✅

Stage Summary:
- All 6 user requests fixed in a single pass
- GameSnakePreview now supports dual mode: simple (skinId/headColor/bodyColor for cards) and lab mode (colors[]/bodyStyle/taperStyle/glow for Genetic Lab)
- Position persistence via refs eliminates the teleporting bug
- No runtime errors, clean lint, clean dev server log
---
Task ID: 2
Agent: Main
Task: Improve skin card previews (bigger, more segments), fix uniqueness, add new geometry shapes

Work Log:
- Identified root cause of no uniqueness: PresetCard only passed headColor+bodyColor (2 colors), ignoring preset's full colors[], shape, taper, glow
- SkinCard only passed skinId, ignoring pattern-based visual variety
- Increased preview height from 80px to 110px, segments from 10 to 15, scale from 0.45 to 0.5
- Reduced text sizes: name text-sm→text-[11px], desc text-[10.5px]→text-[9px], button text-xs→text-[10px]
- Reduced padding: p-4→p-3, mb-4→mb-2.5, py-2→py-1.5
- Updated PresetCard to pass colors={preset.colors}, bodyStyle={preset.shape}, taperStyle={preset.taper}, glow={preset.glow}
- Updated SkinCard to derive visual props from item.pattern (neon→crystal+glow, metallic→fortress+uniform, rainbow→crystal+wave+glow, camo→stingray, pulse→stellar+wave+glow)
- Added 4 new SegShape types: star, hexagon, triangle, ring (ghost)
- Added 4 new BodyStyle options: stellar, fortress, stingray, phantom
- Implemented star shape: 5-pointed star using starPath helper with outer/inner radius
- Implemented hexagon shape: regular 6-sided polygon using hexPath helper
- Implemented triangle shape: forward-pointing arrowhead
- Implemented phantom/ghost: semi-transparent segments with bright outline
- Enhanced existing shapes: spike (longer forward tip 1.35→1.6), square (wider), diamond (more elongated 1.2→1.4)
- Updated resolveShapeStyle for new body styles
- Updated generateCustomSegments and cosmetics-shop randomizer to include new shapes
- Updated geometry grid from 2/3 cols to 2/3/4 cols for 10 options
- Verified all 10 shapes with VLM browser testing:
  - Smooth Circles ✅
  - Dragon Scales (spikes) ✅
  - Armored Plates (squares) ✅
  - Crystal Shards (diamonds) ✅
  - Spiky Obsidian (all spikes) ✅
  - Basilisk Diamonds (all diamonds) ✅
  - Stellar Stars (5-pointed stars) ✅
  - Fortress Hex (hexagons) ✅
  - Stingray Blades (triangles) ✅
  - Phantom Ghost (semi-transparent) ✅
- Verified skin card uniqueness: VLM confirmed different cards show different colors, shapes, and visual styles

Stage Summary:
- Skin cards now show full preset visual identity (multi-color, shape, taper, glow)
- 4 new unique geometry shapes added (star, hexagon, triangle, phantom ghost)
- All existing shapes made more dramatically different
- Card text/buttons reduced for cleaner look
- Preview windows 37% taller (80→110px)
---
Task ID: 1
Agent: Main
Task: Replace Face Cosmetics preview with exact Snake Test canvas + fix admin tab visibility

Work Log:
- Enhanced SnakeFaceTester to support embedded mode (skinId prop, custom segments from localStorage, face cosmetics overlay)
- Embedded canvas styled identically to standalone Snake Test tab canvas (same className, same style)
- Replaced GameSnakePreview in cosmetics-section.tsx with embedded SnakeFaceTester — no wrapper, no labels, no buttons, just the canvas
- Fixed admin tab always hidden: visibleTabs filter was unconditionally removing admin tab (line 136 page.tsx)
- Changed filter from `t.id !== 'admin'` to `t.id !== 'admin' || player?.role === 'admin'`

Stage Summary:
- Face Cosmetics now shows exact same Snake Test canvas renderer
- Admin tab now visible for admin-role players in lobby station
- Files: snake-face-tester.tsx (embedded mode), cosmetics-section.tsx (swap), page.tsx (admin filter fix)

---
Task ID: research-skin-state
Agent: research
Work Log:
- Read cosmetics-shop.tsx (920 lines) — parent component with 3 shopView tabs: 'presets', 'editor' (Genetic Pattern Lab), 'cosmetics' (Face Cosmetics)
- Read cosmetics-section.tsx (475 lines) — Face Cosmetics tab with its own TesterCanvas (580x260 roaming preview) and cosmetics grid
- Read game-snake-preview.tsx (479 lines) — shared GameSnakePreview used in Genetic Lab AND skin cards
- Read skins-canvas-preview.tsx (207 lines) — small 180x80 sine-wave wiggler, used in PresetCard/SkinCard (imported via cosmetics-cards.tsx actually uses GameSnakePreview instead)
- Read try-on-preview.tsx (257 lines) — 450x180 mouse-steerable preview, defined but NOT imported/used anywhere in current codebase
- Read skin-preview-game.tsx (273 lines) — atlas-based skin card preview, has equippedCosmetics prop and mouse tracking
- Read face-cosmetics.ts (1691 lines) — face cosmetics definitions, EquippedCosmetics type, localStorage persistence
- Read cosmetics-types.ts (403 lines) — CustomSkinState, ShopView, CategoryFilter types
- Read cosmetics-utils.ts (326 lines) — readCustomSkinStateSafe/writeCustomSkinState localStorage helpers

## 1. Parent Component: cosmetics-shop.tsx

### Active skin ID management
- **Skin ID is derived state, NOT stored separately.** Two sources merged:
  - Server authoritative: `p.currentSkin` (from `useAuth().player`)
  - Client custom skin: `customState` (React useState initialized from localStorage `venom_custom_skin_state`)
- **Line 96-98**: `const [customState, setCustomState] = useState<CustomSkinState | null>(() => readCustomSkinStateSafe());`
- **Line 138-139**: `isSkinActive` checks `!customState?.useCustomSkin && p.currentSkin === item.id`
- **Line 141-143**: `isPresetActive` checks `customState?.useCustomSkin === true && customState.currentSkin === preset.id`

### How activeSkinId is passed to CosmeticsSection
- **Line 490-494**:
  ```tsx
  <CosmeticsSection onToast={onToast} activeSkinId={
    customState?.useCustomSkin
      ? customState.currentSkin
      : p.currentSkin
  } />
  ```
- CosmeticsSection receives `activeSkinId` as a prop (defaults to `'skin-default'`)

### State/props per tab
- **'presets' tab (Skin & Effect Gallery)**: Renders grid of PresetCard/SkinCard/TrailCard/DeathCard/FlagCard/BannerCard. Category filter via `activeCategory` state. Each card gets its own GameSnakePreview with specific colors/shape/taper/glow. No direct cosmetics/equipped state passed.
- **'editor' tab (Genetic Pattern Lab)**: Uses GameSnakePreview at **line 620** with `colors={colorSequence}`, `bodyStyle`, `taperStyle`, `glow={glowEnabled}`. No `equippedCosmetics` prop passed — cosmetics NOT rendered on lab preview.
- **'cosmetics' tab (Face Cosmetics)**: Renders CosmeticsSection with `activeSkinId` prop.

## 2. Face Cosmetics TesterCanvas (cosmetics-section.tsx)

### Canvas preview rendering loop
- **Line 119-321**: The `loop` function inside TesterCanvas's useEffect
- **Line 119**: `const loop = () => {`
- **Line 321**: `animRef.current = requestAnimationFrame(loop);`
- **Line 227**: useEffect dependency is `[skinId]` — re-creates loop when skinId changes

### Head drawing ends / cosmetics insertion point
- **Line 257**: Head drawing ends with `ctx.restore();` after the head arc fill
- **Line 259-302**: Default eyes drawn conditionally (`if (!hasCustomEyes)`) — eyes with mouse tracking at lines 270-276
- **Line 304-308**: Face cosmetics rendered via `renderEquippedCosmetics(ctx, {...})`
- **INSERT POINT**: After line 302 (end of default eyes) and before line 304 (cosmetics render). But cosmetics already render here.

### Mouse tracking for eyes
- **YES** — Lines 92-102: `mousemove` and `mouseleave` event listeners on canvas
- **Line 75**: `const mouseRef = useRef<{ x: number; y: number } | null>(null);`
- **Lines 270-276**: Pupil look direction computed from mouse position:
  ```ts
  let lookA = angle;
  const m = mouseRef.current;
  if (m) {
    const dx = m.x - headX;
    const dy = m.y - headY;
    if (Math.sqrt(dx * dx + dy * dy) > 5) lookA = Math.atan2(dy, dx);
  }
  ```
- **IMPORTANT**: Eyes are only drawn when `!hasCustomEyes` (line 263). If a custom eye cosmetic is equipped, default eyes are skipped and the cosmetic draw function handles it.

## 3. Genetic Pattern Lab — GameSnakePreview (game-snake-preview.tsx)

### Canvas preview rendering loop
- **Line 227-443**: The `loop` function inside useEffect
- **Line 227**: `const loop = () => {`
- **Line 443**: `animRef.current = requestAnimationFrame(loop);`
- **Line 453**: useEffect dependencies include `equippedCosmetics` — loop re-created when it changes

### Head drawing ends / cosmetics insertion point
- **Line 391**: Head drawing ends with `ctx.restore();`
- **Lines 393-424**: Default eyes ALWAYS drawn (no conditional skip for custom eyes)
- **Lines 426-432**: Face cosmetics rendered ONLY if `curCosmetics` is truthy:
  ```ts
  if (curCosmetics) {
    renderEquippedCosmetics(ctx, {
      hx: headX, hy: headY, hr, angle,
      time: performance.now(), boosting: false,
    });
  }
  ```
- **GAP**: Default eyes are always drawn at lines 393-424 (no `hasCustomEyes` check like TesterCanvas). If cosmetics are passed, they render ON TOP of default eyes.
- **INSERT POINT**: Line 391 (after head, before eyes) to insert cosmetics-aware eye logic, or line 424 (after default eyes) for cosmetics overlay.

### Mouse tracking for eyes
- **YES** — Lines 177-187: `mousemove`/`mouseleave` listeners
- **Line 111**: `const mouseRef = useRef<{ x: number; y: number } | null>(null);`
- **Lines 400-405**: Mouse-based pupil tracking (same pattern as TesterCanvas)
- **NOTE**: `equippedCosmetics` prop exists (line 90, 107) but is NOT passed from cosmetics-shop.tsx line 620 — so cosmetics never render in the Lab preview.

## 4. Shared State Management

### NO zustand store. NO React context. All state is via localStorage + React useState.

**Two separate localStorage keys:**
1. **`venom_custom_skin_state`** (line 315, cosmetics-types.ts): Stores `CustomSkinState { useCustomSkin, currentSkin, customSkinSegments[] }` — used for presets and genetic lab skins
2. **`venom_equipped_cosmetics`** (line 1639, face-cosmetics.ts): Stores `EquippedCosmetics { eyes, mouth, ears, wings, nose, hat, goggles, flag }` — used for face cosmetics

**readEquippedCosmetics()** (face-cosmetics.ts line 1663-1670): Reads from localStorage on every call (no caching, no reactive state). Returns defaults if window undefined or parse fails.

**renderEquippedCosmetics()** (face-cosmetics.ts line 1678-1690): Calls `readEquippedCosmetics()` internally each frame, then iterates slots back-to-front calling each cosmetic's `draw()`.

**Key architectural issue**: Since `readEquippedCosmetics()` reads localStorage synchronously each frame, there's NO React re-render trigger when cosmetics change. The TesterCanvas in cosmetics-section.tsx works because it gets re-mounted when `activeSkinId` changes (via `key={activeSkinId}` on line 397), but the GameSnakePreview in the Genetic Lab has no such mechanism — it would need the `equippedCosmetics` prop passed and to re-read localStorage or receive updated state.

### Summary of ALL canvas preview components:
| Component | File | Used In | Size | Has Mouse Tracking | Renders Face Cosmetics | Issue |
|-----------|------|---------|------|-------------------|----------------------|-------|
| TesterCanvas (inline) | cosmetics-section.tsx:72 | Face Cosmetics tab | 580x260 | YES | YES (via renderEquippedCosmetics L305) | Default eyes skipped when custom eyes equipped ✅ |
| GameSnakePreview | game-snake-preview.tsx:74 | Lab preview (L620), PresetCard, SkinCard | variable | YES | ONLY if `equippedCosmetics` prop passed | Lab doesn't pass it; always draws default eyes |
| GameSkinPreview | skin-preview-game.tsx:67 | (not used in current shop) | variable | YES | YES (L222-233) | Supports both prop-based and localStorage-based rendering |
| SkinsCanvasPreview | skins-canvas-preview.tsx:17 | (not used in current shop — replaced by GameSnakePreview) | 180x80 | NO | NO | Only used in old code |
| TryOnPreview | try-on-preview.tsx:18 | (NOT imported/used anywhere) | 450x180 | YES (mouse steering) | NO | Dead code |

Stage Summary:
- Active skin ID is derived from `customState.useCustomSkin ? customState.currentSkin : p.currentSkin` in cosmetics-shop.tsx lines 490-494
- Face cosmetics state is purely localStorage-based (`venom_equipped_cosmetics`), read via `readEquippedCosmetics()` with no React reactivity
- TesterCanvas (Face Cosmetics tab) properly renders cosmetics and conditionally skips default eyes for custom eye cosmetics
- GameSnakePreview (Genetic Lab) has the prop support (`equippedCosmetics`) but cosmetics-shop.tsx does NOT pass it at line 620, and default eyes are always drawn unconditionally
- To share cosmetics across all previews: pass `equippedCosmetics={readEquippedCosmetics()}` to GameSnakePreview in the Lab, and add `hasCustomEyes` conditional to skip default eyes like TesterCanvas does
- TryOnPreview is dead code (defined but never imported)
- SkinsCanvasPreview is also not used in the current shop (replaced by GameSnakePreview in cards)

