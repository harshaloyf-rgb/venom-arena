/* Section 0 — Accounts & Getting Started */
'use client';

import { Landmark, LogIn, Globe, Shield } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section00_Accounts() {
  return (
    <Section icon={<Landmark className="w-4 h-4" />} title="0. ACCOUNTS &amp; GETTING STARTED" accent="text-emerald-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl space-y-1.5">
          <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
            <LogIn className="w-3.5 h-3.5" /> Register (Recommended)
          </span>
          <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
            <li>Choose a <strong>display name</strong> (up to 20 chars)</li>
            <li>Enter a valid <strong>email</strong> + password (min 6 chars)</li>
            <li><strong>Select your country</strong> — it decides your regional server (see below)</li>
            <li>Optional: a <strong>4-digit Security PIN</strong> (needed for password recovery)</li>
            <li>Optional: a friend&apos;s <strong>Referral Code</strong> — you both earn 2,500 chips (see below)</li>
            <li>Receive a unique <strong>VM-XXXXXX</strong> tag (your permanent ID)</li>
            <li>Start with <strong>150 starter chips</strong> — verify your email for <strong>+850 more</strong> (1,000 total)</li>
            <li>Your progress is <strong>saved permanently</strong></li>
          </ul>
        </div>
        <div className="bg-violet-950/20 border border-violet-500/30 p-3 rounded-xl space-y-1.5">
          <span className="font-bold text-violet-300 flex items-center gap-1.5 text-xs">
            <Globe className="w-3.5 h-3.5" /> Social Login
          </span>
          <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
            <li>Sign in with <strong>Google</strong>, <strong>Facebook</strong>, or <strong>Apple</strong></li>
            <li>No password needed — uses your existing account</li>
            <li>Also starts with <strong>150 starter chips</strong> and a VM-XXXXXX tag</li>
            <li>If your social email matches an existing account, it <strong>links automatically</strong></li>
            <li>You can also set a password later in Profile → Security Settings</li>
          </ul>
        </div>
        <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-xl space-y-1.5">
          <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
            <Shield className="w-3.5 h-3.5" /> Guest Play
          </span>
          <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
            <li><strong>No email needed</strong> — pick your country and play</li>
            <li>Also starts with <strong>150 starter chips</strong></li>
            <li>Gets a random VM-XXXXXX tag</li>
            <li>Guest accounts can <strong>upgrade to registered</strong> later (in Profile panel)</li>
            <li>All progress carries over when upgrading</li>
          </ul>
        </div>
      </div>
      <InfoCard title="👥 Referral Program — Both Earn 2,500 Chips" accent="text-cyan-300">
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Your referral code is in <strong>Profile → Tag &amp; Referral</strong> — format <strong>VIPER-XXXX</strong>. Copy it and share with friends</li>
          <li>Your friend enters your code in the <strong>“Referral Code (optional)”</strong> field on the Register form — it can only be entered <strong>during registration</strong>, never added afterwards</li>
          <li>When your friend finishes <strong>5 matches</strong>, you <strong>BOTH automatically receive 2,500 chips</strong> — credited to your banks right after their 5th match ends</li>
          <li>Track your referred friends in <strong>Profile → Referrals</strong>: see each friend&apos;s status (pending → claimed) and their match progress</li>
          <li>No limit on how many friends you can refer — every friend who completes 5 matches pays out</li>
        </ul>
      </InfoCard>
      <InfoCard title="🌍 Your Country &amp; Regional Server" accent="text-sky-300">
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Your country decides which <strong>regional server</strong> you play on — the nearest one, for the lowest latency</li>
          <li>Regions: <strong>Asia-Pacific, South Asia, Middle East &amp; Africa, Europe, North America, South America, CIS &amp; Central Asia, Oceania</strong></li>
          <li><strong>Guests:</strong> pick your country on the login screen — the Play as Guest button unlocks once a country is chosen</li>
          <li><strong>Registered:</strong> pick your country during registration — your region is shown right under the selector</li>
          <li>Moved house? Change your Faction Region (Country) later in <strong>Profile → Stats → edit</strong> — once every <strong>7 days</strong> (see Identity Change Policy above)</li>
        </ul>
      </InfoCard>
      <InfoCard title="✉️ Email Verification — +850 Bonus Chips" accent="text-emerald-300">
        <ul className="list-disc pl-4 space-y-0.5">
          <li>New registered accounts start with <strong>150 chips</strong></li>
          <li>Verify your email from the <strong>banner in Profile → Stats</strong> and receive an instant <strong>+850 chip bonus</strong> — <strong>1,000 chips total</strong></li>
          <li>The bonus is <strong>one-time per account</strong> and is credited automatically the moment verification succeeds</li>
          <li>Social-login accounts (Google/Facebook/Apple) are <strong>verified automatically</strong> — no banner, no extra step</li>
          <li>Guests who upgrade to a registered account in Profile can verify afterwards to claim the bonus too</li>
        </ul>
      </InfoCard>
      <InfoCard title="Chip Economy Basics" accent="text-amber-300">
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Chips are <strong>free in-game currency</strong> — no real-world value</li>
          <li>Start with 150 chips. Earn more by: extracting from arenas, daily login rewards, chip store, or gifting from friends (+25 per friend)</li>
          <li>Buy into arenas costs chips. If you die, you lose your carried chips. If you extract, you bank them!</li>
          <li>Need more chips? Claim Daily Rewards, complete challenges — or buy chip packs in the Chip Store inside the mobile app</li>
        </ul>
      </InfoCard>
      <InfoCard title="🎁 Daily Claims Hub — Free Chips Every Day" accent="text-emerald-300">
        <p className="mb-1.5">Open it from the <strong>Claims</strong> tab (mobile bottom bar) or the <strong>Daily Free Claims</strong> card on the Lobby HQ dashboard. Six tabs inside:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Daily Streak:</strong> One claim per day on a repeating 7-day cycle — <strong>10 → 20 → 50 → 100 → 250 → 500 → 1,000 chips</strong>. Rewards scale with your level multiplier (×1.0 up to ×4.0) and get a bonus multiplier (×1.5–×2) on special seasonal bonus days. Miss a calendar day and the streak resets to 0 (a Streak Freeze can protect exactly one missed day)</li>
          <li><strong>Streak Milestones:</strong> Day 30 = <strong>5,000c</strong> (Iron Veteran 🛡️), Day 60 = <strong>15,000c</strong> (Steel Sentinel ⚔️), Day 90 = <strong>50,000c</strong> (Diamond Immortal 👑) — credited automatically when you hit the day</li>
          <li><strong>Streak Freeze:</strong> Buy for <strong>500c</strong> each, hold up to <strong>3</strong>. A freeze is consumed automatically if you miss exactly one day; longer gaps still reset the streak</li>
          <li><strong>Hourly:</strong> One micro-claim every hour — a random <strong>10–150 chips</strong> base, scaled by your level multiplier and seasonal bonuses</li>
          <li><strong>Lucky Spin:</strong> <strong>1 free spin daily</strong>; extra spins cost <strong>200c</strong>. Prize wheel ranges from 5c up to a <strong>5,000c JACKPOT</strong> (rare). Spin rewards also get your level bonus (capped at ×2), and a paid spin never consumes your free daily spin</li>
          <li><strong>Calendar:</strong> A month-view calendar of your past daily claims (UTC days — rewards reset at 00:00 UTC / 05:30 AM IST)</li>
          <li><strong>Bonus:</strong> Redeem <strong>Promo Codes</strong> (distributed via official channels only) and, in the mobile app, watch <strong>user-initiated reward ads</strong> — up to 12 per day × 50c each</li>
          <li><strong>History:</strong> All your claims from the last 7 days — daily, hourly, spins, streak milestones, promo codes, and video ads — with amounts and dates</li>
        </ul>
      </InfoCard>
      <InfoCard title="📈 Player Levels & XP" accent="text-sky-300">
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Every online match grants XP: <strong>(score × 5 + kills × 50) × arena reward multiplier</strong> — you earn XP whether you extract or die (practice arenas grant 0 XP)</li>
          <li>Each <strong>challenge claim</strong> adds <strong>+25 XP</strong> on top of its chip reward</li>
          <li>Level N requires <strong>(N − 1) × 200 total XP</strong> — a steady 200 XP between every level, forever</li>
          <li>Your level is shown in the header badge and on the Lobby HQ dashboard, with an XP progress bar</li>
          <li>Levels drive your <strong>challenge tier</strong> (Novice → Elite) and <strong>reward multiplier</strong> — see Section 10</li>
        </ul>
      </InfoCard>
      <InfoCard title="🔑 Password Recovery (Forgot Password)" accent="text-cyan-300">
        <ul className="list-disc pl-4 space-y-0.5">
          <li>On the Login page, click <strong>&quot;Forgot Password?&quot;</strong></li>
          <li>Enter your <strong>registered email</strong> and your <strong>4-digit Security PIN</strong></li>
          <li>Set a new password (min 6 chars) and confirm it</li>
          <li>Your password is updated instantly — no email verification needed</li>
          <li><strong>Important:</strong> If you didn&apos;t set a Security PIN during registration, password recovery is not available. Contact support or set a PIN in Profile → Security Settings before you forget your password!</li>
        </ul>
      </InfoCard>
      <InfoCard title="🔒 Managing Your Security PIN" accent="text-emerald-300">
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Your PIN is set during <strong>registration</strong> (optional but recommended)</li>
          <li>Change or set your PIN anytime in <strong>Profile → Security Settings</strong></li>
          <li>If you already have a PIN, you must enter your current PIN before setting a new one</li>
          <li>The PIN is your <strong>only recovery method</strong> — memorize it or store it securely</li>
          <li>Guest accounts cannot set a PIN (they have no password to recover)</li>
        </ul>
      </InfoCard>
      <InfoCard title="⚙️ Settings Button (Lobby Header)" accent="text-slate-300">
        <p className="mb-1.5">The <strong>Settings</strong> button sits in the Welcome page top bar, right next to <strong>Rules &amp; Guide</strong> (inside the 3-dot menu on phones). It covers:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Help &amp; Support:</strong> report an issue by email — the report auto-attaches your app version and device info; one tap copies the support address</li>
          <li><strong>Audio:</strong> music and sound-effect toggles</li>
          <li><strong>Mobile:</strong> orientation lock (portrait/landscape), performance mode (lower render resolution — smoother on low-end phones, saves battery), vibration (if the device supports haptics)</li>
          <li><strong>Legal &amp; Data:</strong> privacy policy, data access/removal requests, and delete-account guidance (self-service deletion lives in Profile → Delete Account)</li>
          <li><strong>About:</strong> app version, operator entity, season reset date</li>
          <li>Settings are <strong>saved on this device</strong> (not synced to your account); the audio engine starts after your first tap per browser autoplay rules</li>
        </ul>
      </InfoCard>
      <InfoCard title="🛡️ Identity Change Policy (Leaderboard Integrity)" accent="text-amber-300">
        <p className="mb-1.5">To prevent leaderboard and championship abuse, identity changes are <strong>rate-limited</strong>:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Challenger Handle (Name):</strong> Can only be changed once every <strong>30 days</strong></li>
          <li><strong>Faction Region (Country):</strong> Can only be changed once every <strong>7 days</strong></li>
          <li>Your <strong>VM-XXXXXX tag is permanent</strong> and can never be changed — it is your true identity</li>
          <li>Avatar, socials, and cosmetics can be changed <strong>anytime</strong> (no cooldown)</li>
          <li>If you try to change during a cooldown, the save will be blocked with remaining time shown</li>
        </ul>
        <p className="mt-1.5 text-amber-200/80 text-[10px]">⚠️ Leaderboards show your <strong>current</strong> name and country (live, not historical). Your VM-XXXXXX tag remains constant across all leaderboards. See Section 16 (Agent Profile) for full details.</p>
      </InfoCard>
    </Section>
  );
}
