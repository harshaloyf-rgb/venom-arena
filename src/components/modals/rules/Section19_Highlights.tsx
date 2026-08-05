/* Section 19 — Highlights (Clips & Match Cards) */
'use client';

import { Flame } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section19_Highlights() {
  return (
    <Section icon={<Flame className="w-4 h-4" />} title="19. HIGHLIGHTS (CLIPS &amp; MATCH CARDS)" accent="text-orange-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <InfoCard title="🔥 What Are Highlights?" accent="text-orange-300">
          <p className="mb-1.5">The <strong>Highlights</strong> tab is the community showcase where great matches and player-submitted clips live. Two types of content appear:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong className="text-emerald-300">Match Cards</strong> — Auto-generated stat cards from impressive matches. Instantly approved, always visible.</li>
            <li><strong className="text-amber-300">Video Clips</strong> — Player-submitted YouTube/Instagram/Twitch links. Require admin review before going live.</li>
          </ul>
        </InfoCard>
        <InfoCard title="🤖 Auto-Publishing (Match Cards)" accent="text-emerald-300">
          <p className="mb-1.5">The system automatically publishes a Match Card to the Highlights feed when your match meets <strong>any</strong> of these thresholds:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Extraction</strong> with <strong>5,000+ chips</strong> earned</li>
            <li><strong>Extraction</strong> with <strong>3+ kills</strong></li>
            <li><strong>Death</strong> with <strong>5+ kills</strong> (impressive even without extracting)</li>
          </ul>
          <p className="mt-1.5 text-slate-500">Match Cards are always <strong>auto-approved</strong> — no waiting. They show: arena name, chips earned/lost, kills, snake length, duration, and your clan tag.</p>
        </InfoCard>
        <InfoCard title="📹 Submitting Video Clips" accent="text-amber-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Click <strong>Upload Clip</strong> on the Highlights tab</li>
            <li>Choose platform: <strong>YouTube</strong>, <strong>Instagram</strong>, or <strong>Twitch</strong></li>
            <li>Paste the video URL — YouTube thumbnails are auto-extracted</li>
            <li>Title: 5-120 characters. Description: up to 300 characters</li>
            <li>Profanity filter applies (English + Hindi)</li>
            <li>Submitted clips enter <strong>&quot;Pending&quot;</strong> status — visible only to you until an admin approves or rejects them</li>
          </ul>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        <InfoCard title="🏆 Featured &quot;Top Play&quot; Spotlight" accent="text-amber-300">
          <p className="mb-1.5">The <strong>Top Play</strong> spotlight at the top of the feed shows the single best clip, selected by a 3-tier priority system:</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li><strong className="text-amber-300">Admin-Featured</strong> — An admin has manually pinned this clip as the Top Play</li>
            <li><strong className="text-emerald-300">Today&apos;s Best Match Card</strong> — The match-card from today with the most chips extracted (then most kills as tiebreaker)</li>
            <li><strong className="text-slate-300">Highest Upvoted Ever</strong> — The most upvoted approved clip of all time</li>
          </ol>
          <p className="mt-1.5 text-slate-500">Only approved clips are eligible. The spotlight updates when you refresh the page.</p>
        </InfoCard>
        <InfoCard title="👍 Upvoting" accent="text-rose-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Click the <strong>🔥 Flame</strong> button on any clip to upvote it</li>
            <li><strong>One vote per player per clip</strong> — enforced at the database level</li>
            <li>Upvotes are <strong>not reversible</strong> — once you upvote, it&apos;s permanent</li>
            <li>Must be logged in to upvote</li>
            <li>Upvote count is used in the Top Play fallback (highest upvoted ever)</li>
          </ul>
        </InfoCard>
        <InfoCard title="📊 Live Stats Ticker" accent="text-cyan-300">
          <p className="mb-1.5">A stats bar at the top of the Highlights panel shows <strong>today&apos;s live activity</strong>:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Matches</strong> played today</li>
            <li><strong>Extractions</strong> completed today</li>
            <li><strong>Chips earned</strong> by all players today</li>
            <li><strong>Kills</strong> across all matches today</li>
            <li><strong>Total players</strong> registered on the platform</li>
          </ul>
        </InfoCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <InfoCard title="🔍 Feed Controls" accent="text-emerald-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>My Clips</strong> toggle — Filter to show only your own clips (including pending ones)</li>
            <li><strong>Type Filter</strong> — All, Match Cards only, or Video Clips only</li>
            <li><strong>Infinite scroll</strong> — 20 clips per page, auto-loads as you scroll down</li>
            <li>Click a player&apos;s name to <strong>inspect their profile</strong></li>
            <li>Video clips show a <strong>Watch</strong> link that opens the video on the original platform</li>
          </ul>
        </InfoCard>
        <InfoCard title="🛡️ Content Rules &amp; Moderation" accent="text-amber-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Submitted clips are reviewed by admins before going public</li>
            <li>Profanity, spam, and inappropriate content will be <strong>rejected</strong></li>
            <li>Rejected clips are hidden from the public feed but preserved for audit</li>
            <li>Auto-generated Match Cards bypass moderation (system-verified data)</li>
            <li>Admins can <strong>feature</strong> any approved clip to pin it as the Top Play spotlight</li>
            <li>Target review time: within <strong>24 hours</strong> of submission</li>
          </ul>
        </InfoCard>
      </div>
    </Section>
  );
}
