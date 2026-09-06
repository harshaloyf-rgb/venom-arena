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
            <li>All cosmetics are changeable anytime from the Shop &amp; Lab (full details in Section 17)</li>
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
