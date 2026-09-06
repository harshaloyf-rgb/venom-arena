/* Section 17 — Shop & Lab (Identity Workshop) */
'use client';

import { ShoppingBag } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section17_ShopLab() {
  return (
    <Section icon={<ShoppingBag className="w-4 h-4" />} title="17. SHOP &amp; LAB — IDENTITY WORKSHOP" accent="text-purple-400">
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

      <InfoCard title="🛡️ Fair Play Note" accent="text-amber-300">
        <p>Cosmetics are <strong>purely visual</strong>. Every skin, background and face cosmetic has zero effect on gameplay — your hitbox, speed, boost and score are identical no matter what you equip.</p>
      </InfoCard>
    </Section>
  );
}
