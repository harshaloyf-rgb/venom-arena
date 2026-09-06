/* Section 18 — Friends, Search & Social */
'use client';

import { MessageSquare } from 'lucide-react';
import { Section, InfoCard } from './_helpers';

export function Section18_Social() {
  return (
    <Section icon={<MessageSquare className="w-4 h-4" />} title="18. FRIENDS, SEARCH &amp; SOCIAL" accent="text-violet-400">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <InfoCard title="🤝 Overview — 6 Sub-Tabs" accent="text-violet-300">
          <p className="mb-1.5">The Social panel is your hub for connecting with other players. It contains <strong>6 sub-tabs</strong>:</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li><strong>My Friends</strong> — Friend list, requests, blocking, gifting, and your recent matches</li>
            <li><strong>Followers</strong> — Players who follow you (one-way follow system)</li>
            <li><strong>Following</strong> — Players you follow</li>
            <li><strong>Rivals</strong> — Tracked nemesis list with W/L stats</li>
            <li><strong>Search Players</strong> — Find any player by name, tag, or country</li>
            <li><strong>Gift History</strong> — Log of all sent and received chip gifts</li>
          </ol>
          <p className="mt-1.5">An <strong>Add Friend</strong> input bar is always visible at the top of the panel — enter a player tag (e.g. VM-89BE44) to send a request directly.</p>
        </InfoCard>

        <InfoCard title="👥 My Friends Tab" accent="text-emerald-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Incoming Requests:</strong> Shown at top with Accept / Decline buttons and player details (name, tag, level)</li>
            <li><strong>Outgoing Requests:</strong> Listed below with a &quot;Pending&quot; badge</li>
            <li><strong>Friend Cards:</strong> Each card shows name (clickable to inspect), VENOM tag, clan tag, online/offline status, level, and two action buttons:</li>
          </ul>
          <ul className="list-disc pl-6 space-y-0.5 mt-0.5">
            <li><strong>Gift +25c</strong> — Sends 25 chips to the friend (30-second cooldown per friend)</li>
            <li><strong>Block</strong> — Removes from friends and blocks future requests</li>
          </ul>
          <p className="mt-1.5"><strong>Your Recent Matches</strong> appear at the bottom — last 5 matches showing arena, mode (Online/Practice), chips gained/lost, kills, and time ago.</p>
        </InfoCard>

        <InfoCard title="🔎 Search Players Tab" accent="text-cyan-300">
          <p className="mb-1.5">A powerful player directory with real-time search:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Search:</strong> Type a name or tag — results auto-update after 300ms debounce</li>
            <li><strong>Country Filter:</strong> Dropdown lists all 197 countries with player counts. Select one to browse players from that nation</li>
            <li><strong>Results per page:</strong> 20 players, with a &quot;Load More&quot; button for pagination</li>
            <li><strong>Sort order:</strong> By banked chips (when searching by name/tag) or by last seen (when browsing by country only)</li>
            <li><strong>Blocked players are excluded</strong> from all search results</li>
            <li>Each result shows: flag, name (clickable to inspect), online dot, tag, clan tag, chips, and level</li>
          </ul>
        </InfoCard>

        <InfoCard title="🏷️ Search Relation Badges" accent="text-amber-300">
          <p className="mb-1.5">Each search result shows a status badge based on your relationship with that player:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>&quot;You&quot;</strong> — Your own profile (gray, non-interactive)</li>
            <li><strong>&quot;Connected&quot;</strong> — Already accepted friends (green, with ✓ icon)</li>
            <li><strong>&quot;Sent&quot;</strong> — You sent a pending request (amber, with clock icon)</li>
            <li><strong>&quot;Accept&quot;</strong> — They sent you a pending request (blue, with + icon)</li>
            <li><strong>&quot;Connect&quot;</strong> — No relationship yet (violet button — click to send a friend request)</li>
          </ul>
        </InfoCard>

        <InfoCard title="🎁 Gifting System" accent="text-amber-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Send <strong>25 chips</strong> to any accepted friend via the &quot;Gift +25c&quot; button</li>
            <li><strong>30-second cooldown</strong> per friend (UI-enforced, button shows &quot;Cooldown…&quot;)</li>
            <li>Gifts are <strong>atomic transactions</strong>: chips are deducted from you and credited to them instantly</li>
            <li>You <strong>cannot gift yourself</strong> and can only gift <strong>accepted friends</strong> (not pending)</li>
            <li>All gifts are tracked in the <strong>Gift History</strong> tab — filterable by All / Sent / Received</li>
            <li>Each entry shows: direction (📤 Sent / 📥 Received), player name + tag, time ago, and amount</li>
          </ul>
        </InfoCard>

        <InfoCard title="🚫 Blocking" accent="text-rose-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Block any friend from their friend card — this <strong>removes them from your friends list</strong> and blocks them</li>
            <li>Blocked players <strong>cannot send you friend requests</strong></li>
            <li>Blocked players are <strong>hidden from Search Players results</strong></li>
            <li>View and manage blocked players via the expandable &quot;Blocked Players&quot; section on the Friends tab</li>
            <li>Click <strong>Unblock</strong> to allow them to send requests again (does NOT re-add as friend)</li>
          </ul>
        </InfoCard>

        <InfoCard title="👤 Followers &amp; Following (One-Way Follow)" accent="text-sky-300">
          <p className="mb-1.5">Separate from the mutual friend system — following is one-way:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Followers tab:</strong> Shows everyone who follows you. Click &quot;Follow Back&quot; to follow them back (or &quot;Following&quot; badge if already following)</li>
            <li><strong>Following tab:</strong> Shows everyone you follow, with an &quot;Unfollow&quot; button</li>
            <li>Follow can be done from: the Followers tab, player inspector modal, or Rivals tab</li>
            <li>Following someone does <strong>NOT</strong> make them your friend — friend requests are separate</li>
          </ul>
        </InfoCard>

        <InfoCard title="⚔️ Rivals" accent="text-orange-300">
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Rivals are <strong>cosmetic tracking</strong> — no gameplay effect or bonus</li>
            <li>Add a rival by clicking <strong>&quot;Add Rival&quot;</strong> on a game-over kill screen or from the Player Inspector</li>
            <li>Each rival card shows: name (clickable to inspect), tag, <strong>W/L record</strong> (times they killed you vs. you killed them), and <strong>win rate %</strong></li>
            <li>Actions per rival: <strong>+Friend</strong> (send friend request) and <strong>Remove</strong> (remove from rivals list)</li>
          </ul>
        </InfoCard>

        <InfoCard title="💬 Ways to Connect with Players" accent="text-pink-300">
          <p className="mb-1.5">There are <strong>4 ways</strong> to interact with other players:</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li><strong>Add Friend bar</strong> — Enter a player&apos;s VM tag (VM-XXXXXX) at the top of the Social panel to send a direct request</li>
            <li><strong>Search Players tab</strong> — Find anyone by name/tag/country and click &quot;Connect&quot;</li>
            <li><strong>Game-Over Kill Screen</strong> — When killed by a real player, buttons appear: View Profile, Add Rival, Add Friend</li>
            <li><strong>Player Inspector</strong> — Click any player name (leaderboards, friends, search) to open their profile, then follow or send friend request</li>
          </ol>
        </InfoCard>
      </div>
    </Section>
  );
}
