/* Section 16 — Agent Profile */
'use client';

import { UserCircle } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section16_Profile() {
  return (
    <Section icon={<UserCircle className="w-4 h-4" />} title="16. AGENT PROFILE" accent="text-pink-400">
      <InfoCard title="📋 Overview" accent="text-pink-300">
        <p className="mb-1.5">The <strong>Agent Profile</strong> (accessed via the Profile tab in the lobby) is your personal command center. It has <strong>three tabs</strong>:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Stats Tab</strong> — Your identity, stats, cosmetics, shareable cards, security settings, and account management</li>
          <li><strong>History Tab</strong> — Your match history with filters (All, Extracted, Collided)</li>
          <li><strong>Settings Tab</strong> — Help &amp; support, audio (music/sound), mobile options (orientation, performance mode, vibration), legal &amp; data (privacy policy, account deletion), and app info</li>
        </ul>
      </InfoCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard title="🆔 Identity Editor" accent="text-pink-300">
          <p className="mb-1.5">Click the <strong>edit icon</strong> on the Stats tab to open the identity editor:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Challenger Handle (Name):</strong> Change your display name (30-day cooldown). Remaining cooldown is shown if active</li>
            <li><strong>Faction Region (Country):</strong> Choose from 197 countries (7-day cooldown). Your flag updates everywhere instantly</li>
            <li><strong>Avatar:</strong> Upload a custom image or choose from preset avatars. No cooldown</li>
            <li><strong>Social Links:</strong> Add your Instagram, YouTube, and Twitch handles. Shown on your profile</li>
          </ul>
        </InfoCard>
        <InfoCard title="🎮 Cosmetics Loadout" accent="text-amber-300">
          <p className="mb-1.5">Your active cosmetic items are displayed on the Stats tab:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Skin</strong> — Your snake&apos;s appearance (season-pass skins, premium designs, or your own Genetic Lab creations)</li>
            <li><strong>Face cosmetics</strong> — hats, eyes and mouths rendered on your snake&apos;s head (equipped locally, visible on your own snake)</li>
            <li>All cosmetics are changeable anytime from the Shop &amp; Lab</li>
          </ul>
        </InfoCard>
      </div>

      <InfoCard title="🛍️ Shop &amp; Lab Tab (Identity Workshop) — Overview" accent="text-purple-300">
        <p className="mb-1.5">The <strong>Shop &amp; Lab</strong> tab in the Lobby Station is your customization hub. It has <strong>five views</strong> (tabs at the top of the panel):</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>My Inventory</strong> — skins you already own (Cyber Pass claims + saved Genetic Lab designs)</li>
          <li><strong>Backgrounds</strong> — 8 free arena background themes</li>
          <li><strong>Skin &amp; Effect Gallery</strong> — free preset skins + the Premium Shop (character-face skins)</li>
          <li><strong>Genetic Pattern Lab</strong> — design your own repeating body-segment skin</li>
          <li><strong>Face Cosmetics</strong> — eyes, mouths, headgear and more for your snake&apos;s head</li>
        </ul>
      </InfoCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <InfoCard title="🐍 Skin Gallery — Free Presets" accent="text-indigo-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>73 preset skins, all free</strong> — one click equips instantly, no chip cost, no ownership tracked</li>
            <li>Filter chips: <strong>All Items</strong> (everything), <strong>Ready Presets (Free!)</strong>, <strong>Premium Shop</strong>, <strong>Face Cosmetics</strong></li>
            <li>Presets range from flag stripes (India, Germany, Brazil, Pride…) to animal, candy and cyber themes — each card shows a live wiggling preview</li>
            <li>Purchased and pass skins you own also appear under the Premium Shop filter with an Equip button</li>
          </ul>
        </InfoCard>
        <InfoCard title="✨ Premium Shop — Character-Face Skins" accent="text-amber-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>12 exclusive character-face skins</strong> (Panda Brawler, Lucky Frog, Boo Wraith, Turbo Tiger, Abyss Shark, Sly Fox, Circuit Bot, Nebula Grey, Shadow Shinobi, Reef Raider, Inferno Imp, Seraph Glow)</li>
            <li>Prices: <strong>2,000 – 4,500 banked chips</strong> (shown on each card)</li>
            <li>Buying deducts chips and <strong>auto-equips</strong> the skin in one step (server-validated, saved to your account)</li>
            <li>If you can&apos;t afford a skin, the unlock is blocked and shows the chip cost needed</li>
            <li>The full character head (face, ears, bandana…) <strong>replaces your snake&apos;s head</strong> and can&apos;t be reproduced in the Genetic Lab</li>
          </ul>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <InfoCard title="🧬 Genetic Pattern Lab" accent="text-purple-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Build a stripe sequence from a <strong>28-color palette</strong> — up to <strong>24 nodes</strong>; click a node to remove it (first node is the crown/head side)</li>
            <li>Pick <strong>segment geometry</strong> (10 styles: Smooth, Dragon, Armored, Crystal, Obsidian, Basilisk, Stellar, Fortress, Stingray, Phantom) and <strong>taper physics</strong> (4 styles)</li>
            <li>Helpers: <strong>Double</strong> / <strong>Mirror</strong> the sequence (source sequence must be ≤ 12 nodes), <strong>Mutate DNA</strong> (random design), <strong>Reset</strong></li>
            <li><strong>Deploy</strong> equips the design instantly (stored on this device only — other players see a default skin)</li>
            <li><strong>Save to Inventory</strong> persists the design to your account (max <strong>5 slots</strong>, named up to 30 chars) — usable on any device and <strong>visible to other players in online arenas</strong></li>
          </ul>
        </InfoCard>
        <InfoCard title="🎒 My Inventory" accent="text-emerald-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Pass &amp; Premium Skins:</strong> skins claimed from the Cyber Pass (free and elite tracks) — equip from here</li>
            <li><strong>My Custom Designs:</strong> your saved Genetic Lab creations (up to 5, shown with a live preview)</li>
            <li>Custom slot counter (<strong>x/5</strong>) with a Save Current Lab Design shortcut</li>
            <li>Deleting a custom design frees the slot; if it was equipped, the game falls back to your previous skin</li>
          </ul>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <InfoCard title="🖼️ Arena Backgrounds" accent="text-teal-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>8 free themes</strong>: Classic Dark, Neon Synthwave, Venom Pit, Deep Ocean, Desert Pit, Blood Moon, Nebula, Championship Gold</li>
            <li>Swatches use the <strong>exact same painters as gameplay</strong> — what you see is what you get</li>
            <li>Themes tint the arena floor, the boundary ring and the minimap accent</li>
            <li>Fully static — <strong>zero performance cost</strong>; one click to equip, applies in online and offline play</li>
          </ul>
        </InfoCard>
        <InfoCard title="🎭 Face Cosmetics" accent="text-pink-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>43 cosmetics, all free</strong> across 7 slots: Eyes, Mouth, Headgear (ears/horns/crowns), Wings, Nose, Hats, Goggles</li>
            <li>Each slot has its own sub-tab with rarity badges (Common → Legendary)</li>
            <li>Click to equip, click again to <strong>unequip</strong> (toggle back to default)</li>
            <li>Equipped on this device (browser storage), rendered on <strong>your own snake</strong> in both online and offline modes</li>
          </ul>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <InfoCard title="🪪 Profile Card &amp; Milestone Card" accent="text-violet-300">
          <p className="mb-1.5">Generate shareable cards from your Stats tab:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Profile Card:</strong> Shows your name, tag, country flag, level, chips, K/D, cosmetics, and social links</li>
            <li><strong>Milestone Card:</strong> Shows your highest milestone badge and chip progress</li>
            <li>Both cards can be <strong>downloaded</strong> as images, <strong>copied to clipboard</strong>, or <strong>shared</strong> via the Web Share API</li>
          </ul>
        </InfoCard>
        <InfoCard title="🔐 Security Settings" accent="text-cyan-300">
          <p className="mb-1.5">Available at the bottom of the Stats tab:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Change Password:</strong> Registered accounts can update their password (enter current + new)</li>
            <li><strong>Security PIN:</strong> Set or change your 4-digit PIN. Required for password recovery</li>
            <li>If you have a PIN, you must enter the current one before setting a new one</li>
            <li>Guest accounts cannot use Security Settings (no password to recover)</li>
          </ul>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <InfoCard title="📊 Stats Display" accent="text-emerald-300">
          <p className="mb-1.5">The Stats tab shows your key performance metrics:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Level &amp; XP:</strong> Current level, XP progress bar, and XP needed for next level</li>
            <li><strong>Chips:</strong> Banked wallet balance and current buy-in arena tier</li>
            <li><strong>K/D Ratio:</strong> Lifetime real-player kills (bot eliminations don&apos;t count), deaths, and kill/death ratio</li>
            <li><strong>Win Stats:</strong> Total runs, extractions, and extraction rate percentage</li>
            <li><strong>Account Age:</strong> Days since account creation</li>
            <li><strong>Milestone Tier:</strong> Current badge and next tier target</li>
            <li><strong>Tag &amp; Referral:</strong> Copy your VM-XXXXXX tag and referral code</li>
          </ul>
        </InfoCard>
        <InfoCard title="📜 Match History Tab" accent="text-amber-300">
          <p className="mb-1.5">Switch to the History tab to review your matches:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Filter:</strong> All matches, Extracted only, or Collided only</li>
            <li>Shows arena type, score, chips won/lost, kills, duration, and timestamp</li>
            <li>Uses client-side cache for offline viewing, synced with server data</li>
            <li>Paginated — loads 25 matches at a time</li>
          </ul>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <InfoCard title="🚀 Guest Upgrade" accent="text-emerald-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Guest accounts see an <strong>upgrade banner</strong> at the top of the Stats tab</li>
            <li>Click to add an email and password, converting to a registered account</li>
            <li>All progress carries over: chips, stats, cosmetics, streaks, friends, and clan memberships</li>
            <li>You keep your VM-XXXXXX tag after upgrading</li>
          </ul>
        </InfoCard>
        <InfoCard title="⚠️ Danger Zone — Delete Account" accent="text-rose-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>At the bottom of the Stats tab: a <strong>Delete Account</strong> button</li>
            <li>Requires typing <strong>DELETE</strong> to confirm (double-confirmation)</li>
            <li>Permanently removes: chips, stats, cosmetics, friends, match history, clan memberships</li>
            <li><strong>This action is irreversible and cannot be recovered</strong></li>
          </ul>
        </InfoCard>
      </div>

      <InfoCard title="🛡️ Leaderboard Identity Integrity" accent="text-amber-300">
        <p className="mb-1.5">Important note about how your identity appears on leaderboards:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Leaderboards display your <strong>current</strong> Challenger Handle and Faction Region (live, not historical snapshots)</li>
          <li>If you change your name or country, <strong>all leaderboards update immediately</strong> to show the new identity</li>
          <li>Your <strong>VM-XXXXXX tag is always shown alongside your name</strong> — this is your permanent, unchangeable identity that links all your entries across time</li>
          <li>The <strong>cooldowns (30 days for name, 7 days for country)</strong> limit how often identity can change, keeping leaderboards stable during ranking periods</li>
          <li>Historical records like Hall of Fame entries snapshot your name and tag at the time of induction — those never change</li>
        </ul>
      </InfoCard>
    </Section>
  );
}
