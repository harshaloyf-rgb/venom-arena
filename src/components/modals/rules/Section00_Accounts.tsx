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
            <li>Set a <strong>4-digit Security PIN</strong> (needed for password recovery)</li>
            <li>Receive a unique <strong>VM-XXXXXX</strong> tag (your permanent ID)</li>
            <li>Start with <strong>150 starter chips</strong> (free!)</li>
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
            <li><strong>No email needed</strong> — one-click to play</li>
            <li>Also starts with <strong>150 starter chips</strong></li>
            <li>Gets a random VM-XXXXXX tag</li>
            <li>Guest accounts can <strong>upgrade to registered</strong> later (in Profile panel)</li>
            <li>All progress carries over when upgrading</li>
          </ul>
        </div>
      </div>
      <InfoCard title="Chip Economy Basics" accent="text-amber-300">
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Chips are <strong>free in-game currency</strong> — no real-world value</li>
          <li>Start with 150 chips. Earn more by: extracting from arenas, daily login rewards, chip store, or gifting from friends (+25 per friend)</li>
          <li>Buy into arenas costs chips. If you die, you lose your carried chips. If you extract, you bank them!</li>
          <li>Need more chips? Visit the Chip Store (free packs) or claim Daily Rewards</li>
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
