'use client';

/**
 * BUILD-11 — `PlayerProfilePanel` panel.
 *
 * Faithful replica of `/upload/extracted/src/components/PlayerProfile.tsx`
 * (1429 lines). Adapted to the BUILD-2 server-authoritative stack:
 *
 *  - Reads `player` and `refresh`/`logout` from `useAuth()`.
 *  - Identity changes persist via `PUT /api/player` with
 *    `{ name, country, avatar, instagram, youtube, twitch }` (server
 *    whitelists name/country/avatar; socials persist via localStorage).
 *  - Friends, match history, and identity logs persist to the same
 *    `localStorage` keys the original used (`venom_friends`,
 *    `venom_match_history`, `venom_identity_history_log`).
 *  - Co-Op Lobby Invite modal matches the original 1-to-1: arena-stakes
 *    list, eligibility pills (`"You can't afford" / "They can't afford"
 *    / "Eligible 🤝"`), counter-proposal speech bubble, and the
 *    `localStorage['venom_active_match_invite']` handshake consumed by
 *    `ArenaSelector`.
 *
 * Every text string (4 tabs, 8 stat cards, 3 tournament caps, FAQ, social
 * badges, ALL button labels and toast messages) is preserved verbatim from
 * AUDIT-C section D.
 */

import { useEffect, useState } from 'react';
import {
  Award,
  Check,
  Clock,
  Compass,
  Edit2,
  Eye,
  Globe,
  History,
  Landmark,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Target,
  Trash2,
  Trophy,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ARENA_TIERS, COUNTRIES, getCosmeticById } from '@/lib/game-config';
import type { PlayerProfile } from '@/lib/types';
import {
  PanelSkeleton,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';

interface PlayerProfilePanelProps {
  onToast?: ToastFn;
}

// ---------------------------------------------------------------------------
// FACTION_COUNTRIES — exact from original (AUDIT-C G)
// ---------------------------------------------------------------------------
const FACTION_COUNTRIES = COUNTRIES;

// ---------------------------------------------------------------------------
// PRESET_AVATARS — exact from original (AUDIT-C D.14)
// ---------------------------------------------------------------------------
const PRESET_AVATARS = [
  { id: 'av-viper', label: 'Venomous Viper', emoji: '🐍' },
  { id: 'av-skull', label: 'Syndicate Skull', emoji: '🏴‍☠️' },
  { id: 'av-invader', label: 'Pixel Invader', emoji: '👾' },
  { id: 'av-sentinel', label: 'Cyber Sentinel', emoji: '🤖' },
  { id: 'av-king', label: 'Midas King', emoji: '👑' },
  { id: 'av-storm', label: 'Storm Surge', emoji: '⚡' },
  { id: 'av-fury', label: 'Crimson Fury', emoji: '🔥' },
  { id: 'av-nebula', label: 'Cosmic Nebula', emoji: '🌌' },
];

// ---------------------------------------------------------------------------
// Friend + history + identity-log types
// ---------------------------------------------------------------------------
type FriendStatus = 'online' | 'idle' | 'in-match' | 'offline';

interface Friend {
  id: string;
  name: string;
  userTag: string;
  status: FriendStatus;
  level: number;
  skinColor: string;
  giftSentToday: boolean;
  giftReceivedToday: boolean;
}

interface MatchHistoryEntry {
  id: string;
  arenaName: string;
  isOnline: boolean;
  status: 'EXTRACTED' | 'COLLIDED';
  chipsEarned: number;
  chipsLost: number;
  kills: number;
  snakeLength: number;
  timestamp: string;
  durationSec: number;
}

interface IdentityLogEntry {
  id: string;
  previousName: string;
  newName: string;
  previousCountry: string;
  newCountry: string;
  timestamp: string;
  status: 'VERIFIED' | 'APPROVED' | 'FIRST_HANDSHAKE';
}

// ---------------------------------------------------------------------------
// Default seed data — exact from original (AUDIT-C D.12, D.13)
// ---------------------------------------------------------------------------
const INITIAL_FRIENDS: Friend[] = [
  {
    id: 'f-1',
    name: 'ApexViper',
    userTag: 'APEX-1029',
    status: 'online',
    level: 42,
    skinColor: '#10b981',
    giftSentToday: false,
    giftReceivedToday: true,
  },
  {
    id: 'f-2',
    name: 'ShadowSlinker',
    userTag: 'SLNK-9281',
    status: 'in-match',
    level: 18,
    skinColor: '#a855f7',
    giftSentToday: false,
    giftReceivedToday: false,
  },
  {
    id: 'f-3',
    name: 'CoinGobbler',
    userTag: 'COIN-5432',
    status: 'offline',
    level: 29,
    skinColor: '#eab308',
    giftSentToday: true,
    giftReceivedToday: false,
  },
  {
    id: 'f-4',
    name: 'VenomKing',
    userTag: 'VNOM-0001',
    status: 'idle',
    level: 55,
    skinColor: '#ef4444',
    giftSentToday: false,
    giftReceivedToday: false,
  },
];

const SAMPLE_MATCHES: MatchHistoryEntry[] = [
  {
    id: 'match-mock1',
    arenaName: 'Slum Alley',
    isOnline: false,
    status: 'EXTRACTED',
    chipsEarned: 180,
    chipsLost: 0,
    kills: 3,
    snakeLength: 22,
    timestamp: new Date(Date.now() - 4 * 3_600_000).toISOString(),
    durationSec: 85,
  },
  {
    id: 'match-mock2',
    arenaName: 'Neon Grid',
    isOnline: true,
    status: 'COLLIDED',
    chipsEarned: 0,
    chipsLost: 50,
    kills: 1,
    snakeLength: 14,
    timestamp: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    durationSec: 42,
  },
  {
    id: 'match-mock3',
    arenaName: 'Viper Syndicate',
    isOnline: true,
    status: 'EXTRACTED',
    chipsEarned: 640,
    chipsLost: 0,
    kills: 6,
    snakeLength: 35,
    timestamp: new Date(Date.now() - 48 * 3_600_000).toISOString(),
    durationSec: 164,
  },
];

// ---------------------------------------------------------------------------
// Local-storage helpers — never crash on parse error
// ---------------------------------------------------------------------------
function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota errors silently ignored */
  }
}

// Mocked friend balance — original SocialPanel had `getFriendSimulatedChips`.
// We hardcode a friendly number for the co-op modal's eligibility math.
function getFriendSimulatedChips(friend: Friend): number {
  // Stable pseudo-random based on the friend id so each friend has a
  // believable bankroll that doesn't change on re-render.
  let h = 0;
  for (let i = 0; i < friend.id.length; i++) {
    h = (h * 31 + friend.id.charCodeAt(i)) & 0xffffffff;
  }
  return 750 + (Math.abs(h) % 9000);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
type ProfileTab = 'stats' | 'history' | 'friends' | 'identityLog';

type InviteStatusMessageType =
  | 'success'
  | 'warning'
  | 'error'
  | 'counter';
interface InviteStatusMessage {
  type: InviteStatusMessageType;
  text: string;
  counterArenaId?: string;
}

export function PlayerProfilePanel({ onToast }: PlayerProfilePanelProps) {
  const { player, loading, refresh, logout } = useAuth();

  if (loading) {
    return (
      <div className="space-y-4">
        <PanelSkeleton count={1} height="h-48" />
        <PanelSkeleton count={2} height="h-40" />
      </div>
    );
  }
  if (!player) return <NotSignedIn />;

  return (
    <ProfileContent
      player={player}
      onToast={onToast}
      onRefresh={refresh}
      onLogout={logout}
    />
  );
}

interface ProfileContentProps {
  player: PlayerProfile;
  onToast?: ToastFn;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}

function ProfileContent({
  player,
  onToast,
  onRefresh,
  onLogout,
}: ProfileContentProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('stats');

  // Co-Op Lobby Invite modal state
  const [activeInviteFriend, setActiveInviteFriend] = useState<Friend | null>(
    null,
  );
  const [inviteSelectedArenaId, setInviteSelectedArenaId] =
    useState<string>('tier-1');
  const [inviteStatusMessage, setInviteStatusMessage] =
    useState<InviteStatusMessage | null>(null);

  // Identity editing
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(player.name);
  const [selectedCountry, setSelectedCountry] = useState(
    player.country || 'US',
  );
  const [selectedAvatar, setSelectedAvatar] = useState(player.avatar || '');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [twitch, setTwitch] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Friends, matches, logs
  const [friends, setFriends] = useState<Friend[]>([]);
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);
  const [identityLogs, setIdentityLogs] = useState<IdentityLogEntry[]>([]);
  const [newFriendName, setNewFriendName] = useState('');

  // Load from localStorage + socials from player profile
  useEffect(() => {
    const storedFriends = readJSON<Friend[] | null>('venom_friends', null);
    if (storedFriends && Array.isArray(storedFriends)) {
      setFriends(storedFriends);
    } else {
      setFriends(INITIAL_FRIENDS);
      writeJSON('venom_friends', INITIAL_FRIENDS);
    }

    const storedMatches = readJSON<MatchHistoryEntry[] | null>(
      'venom_match_history',
      null,
    );
    if (storedMatches && Array.isArray(storedMatches) && storedMatches.length) {
      setMatches(storedMatches);
    } else {
      setMatches(SAMPLE_MATCHES);
      writeJSON('venom_match_history', SAMPLE_MATCHES);
    }

    const storedLogs = readJSON<IdentityLogEntry[] | null>(
      'venom_identity_history_log',
      null,
    );
    if (storedLogs && Array.isArray(storedLogs)) {
      setIdentityLogs(storedLogs);
    } else {
      const seed: IdentityLogEntry[] = [
        {
          id: 'log-1',
          previousName: 'Unregistered Agent',
          newName: player.name,
          previousCountry: 'None',
          newCountry: player.country || 'US',
          timestamp: new Date(Date.now() - 5 * 86_400_000).toISOString(),
          status: 'FIRST_HANDSHAKE',
        },
      ];
      setIdentityLogs(seed);
      writeJSON('venom_identity_history_log', seed);
    }

    // Socials persisted in localStorage
    const socials = readJSON<{
      instagram?: string;
      youtube?: string;
      twitch?: string;
    }>('venom_social_channels', {});
    setInstagram(socials.instagram || '');
    setYoutube(socials.youtube || '');
    setTwitch(socials.twitch || '');
  }, [player.name, player.country]);

  // -- derived values -------------------------------------------------------
  const xpNeeded = player.level * 200;
  const xpPercent = Math.min(100, Math.floor((player.xp / xpNeeded) * 100));
  const deathsCount = player.lifetimeDeaths || 1;
  const kdRatio = ((player.lifetimeKills || 0) / deathsCount).toFixed(2);
  const totalRuns =
    (player.lifetimeExtracts || 0) + (player.lifetimeDeaths || 0);
  const extractRate =
    totalRuns > 0
      ? `${Math.floor(((player.lifetimeExtracts || 0) / totalRuns) * 100)}%`
      : '0%';

  const activeSkin = getCosmeticById(player.currentSkin);
  const activeFlag = FACTION_COUNTRIES.find(
    (c) => c.code === (player.country || 'US'),
  );

  // -- avatar drag & drop handlers -----------------------------------------
  function processAvatarFile(file: File) {
    if (!file.type.startsWith('image/')) {
      notify('Please select a valid image file.', 'error', onToast);
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      notify(
        'Image size exceeds 1.5MB. Please choose a smaller file.',
        'error',
        onToast,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSelectedAvatar(event.target.result as string);
        notify(
          'Custom avatar selected! Save your handshake to lock it in.',
          'success',
          onToast,
        );
      }
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processAvatarFile(files[0]);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) processAvatarFile(files[0]);
  }

  // -- identity save --------------------------------------------------------
  function handleStartEditing() {
    setNewName(player.name);
    setSelectedCountry(player.country || 'US');
    setSelectedAvatar(player.avatar || '');
    setIsEditing(true);
  }

  async function handleSaveProfile() {
    const trimmed = newName.trim();
    if (!trimmed) {
      notify('Nickname cannot be empty!', 'error', onToast);
      return;
    }
    if (trimmed.length > 15) {
      notify('Nickname must be 15 characters or less.', 'error', onToast);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/player', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          country: selectedCountry,
          avatar:
            selectedAvatar && selectedAvatar.length <= 8
              ? selectedAvatar
              : undefined,
          instagram: instagram.trim(),
          youtube: youtube.trim(),
          twitch: twitch.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notify(data?.error || 'Failed to save profile.', 'error', onToast);
        return;
      }

      // Persist socials client-side (server whitelist doesn't include them)
      writeJSON('venom_social_channels', {
        instagram: instagram.trim(),
        youtube: youtube.trim(),
        twitch: twitch.trim(),
      });

      // Identity change log
      const nameChanged = trimmed !== player.name;
      const countryChanged = selectedCountry !== (player.country || 'US');
      if (nameChanged || countryChanged) {
        const newLog: IdentityLogEntry = {
          id: 'log-' + Math.random().toString(36).slice(2, 11),
          previousName: player.name,
          newName: trimmed,
          previousCountry: player.country || 'US',
          newCountry: selectedCountry,
          timestamp: new Date().toISOString(),
          status: 'VERIFIED',
        };
        const updatedLogs = [newLog, ...identityLogs];
        setIdentityLogs(updatedLogs);
        writeJSON('venom_identity_history_log', updatedLogs);
      }

      await onRefresh();
      setIsEditing(false);
      notify(
        'Handshake secure! Profile & Social links saved successfully! 🔒',
        'success',
        onToast,
      );
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    } finally {
      setSaving(false);
    }
  }

  // -- friend handlers ------------------------------------------------------
  function handleAddFriend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newFriendName.trim();
    if (!trimmed) return;

    if (
      friends.some(
        (f) => f.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      notify(`${trimmed} is already in your allied squad list!`, 'error', onToast);
      return;
    }

    const newFriend: Friend = {
      id: 'f-' + Math.random().toString(36).slice(2, 11),
      name: trimmed,
      userTag: 'VIPR-' + Math.floor(1000 + Math.random() * 9000),
      status: Math.random() > 0.5 ? 'online' : 'offline',
      level: Math.floor(5 + Math.random() * 45),
      skinColor: '#38bdf8',
      giftSentToday: false,
      giftReceivedToday: false,
    };

    const updated = [...friends, newFriend];
    setFriends(updated);
    writeJSON('venom_friends', updated);
    setNewFriendName('');
    notify(`${trimmed} has been synced into your ally list! 🔗`, 'success', onToast);
  }

  function handleRemoveFriend(id: string, name: string) {
    const updated = friends.filter((f) => f.id !== id);
    setFriends(updated);
    writeJSON('venom_friends', updated);
    notify(`Alliance with ${name} dismantled.`, 'info', onToast);
  }

  function handleSendGift(id: string, name: string) {
    const updated = friends.map((f) =>
      f.id === id ? { ...f, giftSentToday: true } : f,
    );
    setFriends(updated);
    writeJSON('venom_friends', updated);
    notify(`Deposited 25 tactical bonus Chips to ${name}! 🎁`, 'success', onToast);
  }

  // -- co-op invite handlers ------------------------------------------------
  function openInviteModal(friend: Friend) {
    setActiveInviteFriend(friend);
    setInviteSelectedArenaId('tier-1');
    setInviteStatusMessage(null);
  }

  function handleSendCoOpInvite() {
    if (!activeInviteFriend) return;
    const selectedTier =
      ARENA_TIERS.find((t) => t.id === inviteSelectedArenaId) || ARENA_TIERS[0];
    const friendChips = getFriendSimulatedChips(activeInviteFriend);
    const playerChips = player.bankedChips;

    if (playerChips < selectedTier.buyIn) {
      notify(
        `You do not have enough chips for ${selectedTier.name}!`,
        'error',
        onToast,
      );
      return;
    }

    if (friendChips < selectedTier.buyIn) {
      const affordableTiers = ARENA_TIERS.filter(
        (t) => friendChips >= t.buyIn && playerChips >= t.buyIn,
      );
      if (affordableTiers.length > 0) {
        const counterTier = affordableTiers[affordableTiers.length - 1];
        setInviteStatusMessage({
          type: 'counter',
          text: `Sorry! I don't have enough chips for ${selectedTier.name} (need ${selectedTier.buyIn.toLocaleString()} c, only have ${friendChips.toLocaleString()} c). Let's join the "${counterTier.name}" (Buy-In: ${counterTier.buyIn.toLocaleString()} c) instead! Re-invite me?`,
          counterArenaId: counterTier.id,
        });
        notify(
          'Co-op invitation rejected: Insufficient chips. Counter-proposal received!',
          'info',
          onToast,
        );
      } else {
        setInviteStatusMessage({
          type: 'error',
          text: `Ah, I'm super low on chips right now (${friendChips.toLocaleString()} c) and can't afford any of the available buy-ins. Send me a chip gift or invite me when I earn some more! 🐍`,
        });
        notify('Co-op invitation rejected: Insufficient chips.', 'error', onToast);
      }
      return;
    }

    writeJSON('venom_active_match_invite', {
      name: activeInviteFriend.name,
      skinColor: activeInviteFriend.skinColor,
      arenaId: selectedTier.id,
    });
    notify(
      `Co-op invite accepted by ${activeInviteFriend.name}! Staking buy-in... 🤝⚔️`,
      'success',
      onToast,
    );
    setActiveInviteFriend(null);
  }

  // -- logout ---------------------------------------------------------------
  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
      notify('Signed out.', 'info', onToast);
    } finally {
      setLoggingOut(false);
    }
  }

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 bg-slate-950/60 border border-slate-900 rounded-2xl shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-900 pb-6 mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-indigo-400/30 relative shadow-md overflow-hidden shrink-0">
            {player.avatar ? (
              player.avatar.startsWith('data:') ||
              player.avatar.startsWith('http') ? (
                <img
                  src={player.avatar}
                  alt={player.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-3xl select-none">{player.avatar}</span>
              )
            ) : (
              <span
                className="text-3xl select-none"
                title="EQuipped DNA Skin"
              >
                {activeSkin?.emoji || '🐍'}
              </span>
            )}
            <div className="absolute -bottom-1 -right-1 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-indigo-400 shadow">
              Lvl {player.level}
            </div>
          </div>

          {/* Name + tag + socials */}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white font-sans tracking-tight flex items-center gap-2">
                <span className="text-xl" title="Region flag">
                  {activeFlag?.flag || '🇺🇸'}
                </span>
                <span>{player.name}</span>
                <span className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-indigo-400 px-1.5 py-0.5 rounded uppercase">
                  {player.country || 'US'}
                </span>
              </h2>
              <button
                type="button"
                onClick={handleStartEditing}
                className="text-slate-400 hover:text-white p-1 transition cursor-pointer"
                title="Edit Identity"
                aria-label="Edit identity"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-1">
              Ledger Tag:{' '}
              <span className="font-mono text-slate-300 font-bold">
                #{player.userTag || 'STRK-8291'}
              </span>{' '}
              • Global Standing:{' '}
              <span className="text-amber-400 font-bold font-mono">
                #999
              </span>
            </p>

            {/* Socials */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {instagram && (
                <a
                  href={`https://instagram.com/${instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1.5 transition-all"
                >
                  📸 {instagram}
                </a>
              )}
              {youtube && (
                <a
                  href={
                    youtube.startsWith('http')
                      ? youtube
                      : `https://youtube.com/${youtube}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1.5 transition-all"
                >
                  🎥 YouTube
                </a>
              )}
              {twitch && (
                <a
                  href={`https://twitch.tv/${twitch}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1.5 transition-all"
                >
                  📱 Twitch
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Level progress */}
          <div className="w-full md:w-72 bg-slate-900/60 p-3 rounded-xl border border-slate-800 backdrop-blur-sm flex-1">
            <div className="flex justify-between items-center text-xs text-slate-400 font-sans mb-1.5">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />{' '}
                Level Progress
              </span>
              <span className="font-mono text-white font-bold">
                {player.xp} / {xpNeeded} XP
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-4 py-3 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow h-[52px] disabled:opacity-50"
            title="Logout Session"
          >
            <LogOut className="w-4 h-4" />
            <span className="whitespace-nowrap">Sign Out</span>
          </button>
        </div>
      </div>

      {/* TAB NAV */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-900 pb-3">
        {(
          [
            { id: 'stats', label: 'Records & Statistics', icon: Target },
            { id: 'history', label: 'Match History Ledger', icon: History },
            {
              id: 'friends',
              label: `Friends & Spectate (${friends.length})`,
              icon: Users,
            },
            {
              id: 'identityLog',
              label: 'Identity Anti-Tamper Logs',
              icon: Lock,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setIsEditing(false);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 shadow-lg'
                  : 'bg-transparent border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Identity editor */}
          {isEditing && (
            <IdentityEditor
              newName={newName}
              setNewName={setNewName}
              selectedCountry={selectedCountry}
              setSelectedCountry={setSelectedCountry}
              selectedAvatar={selectedAvatar}
              setSelectedAvatar={setSelectedAvatar}
              instagram={instagram}
              setInstagram={setInstagram}
              youtube={youtube}
              setYoutube={setYoutube}
              twitch={twitch}
              setTwitch={setTwitch}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              onDrop={handleDrop}
              onFileChange={handleFileChange}
              onCancel={() => setIsEditing(false)}
              onSave={handleSaveProfile}
              saving={saving}
            />
          )}

          {/* Statistics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard
              label="Banked Wallet"
              subLabel="Deposited Chips"
              value={player.bankedChips.toLocaleString()}
              icon={<Landmark className="w-4 h-4 text-emerald-400" />}
              valueClass="text-emerald-400"
            />
            <StatCard
              label="Tournament Kills"
              subLabel="Total Terminations"
              value={String(player.lifetimeKills)}
              icon={<Skull className="w-4 h-4 text-rose-400" />}
              valueClass="text-white"
            />
            <StatCard
              label="K/D Ratio"
              subLabel="Kill / Death Index"
              value={kdRatio}
              icon={<Target className="w-4 h-4 text-amber-400" />}
              valueClass="text-amber-400"
            />
            <StatCard
              label="Extraction Rate"
              subLabel="Successful Handshakes"
              value={extractRate}
              icon={<Compass className="w-4 h-4 text-cyan-400" />}
              valueClass="text-cyan-400"
            />
            <StatCard
              label="Survival Streak"
              subLabel="Consecutive Extractions"
              value={String(player.bestStreak)}
              icon={<Trophy className="w-4 h-4 text-yellow-500" />}
              valueClass="text-yellow-500"
            />
            <StatCard
              label="Record Extraction"
              subLabel="Max Retained in One Run"
              value={player.biggestExtract.toLocaleString()}
              icon={<Award className="w-4 h-4 text-indigo-400" />}
              valueClass="text-indigo-400"
            />
            <StatCard
              label="Lifetime Retained"
              subLabel="Cumulative Chip Profit"
              value={player.totalEarned.toLocaleString()}
              icon={<Landmark className="w-4 h-4 text-teal-400" />}
              valueClass="text-teal-400"
            />
            <StatCard
              label="Total Forfeited"
              subLabel="Forfeited in Crash Events"
              value={player.totalLost.toLocaleString()}
              icon={<RefreshCw className="w-4 h-4 text-red-400" />}
              valueClass="text-red-400"
            />
          </div>

          {/* Annual Tournament Guardrails */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                  Annual Tournament Guardrails &amp; Limit Allowances
                </h3>
              </div>
              <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                1-YEAR UTC TOURNAMENT CYCLE ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Matches cap */}
              <CapCard
                icon={<Swords className="w-3.5 h-3.5 text-indigo-400" />}
                label="Matches Allowed"
                value={`${(18).toLocaleString()} / 10,000`}
                barClass="from-indigo-500 to-purple-500"
                pct={Math.min(100, (18 / 10000) * 100)}
                leftLabel={`Completed: ${(18).toLocaleString()}`}
                rightLabel={`Remaining: ${(10000 - 18).toLocaleString()} matches`}
                rightClass="text-emerald-400 font-bold"
              />
              {/* 2. Annual buy cap */}
              <CapCard
                icon={<Landmark className="w-3.5 h-3.5 text-emerald-400" />}
                label="Annual Buy Cap (25L)"
                value={`${(0).toLocaleString()} / 25,00,000 c`}
                barClass="from-emerald-500 to-teal-400"
                pct={0}
                leftLabel="Bought: 0 c"
                rightLabel="Cap Remaining: 25,00,000 c"
                rightClass="text-emerald-400 font-bold"
              />
              {/* 3. Daily ad cap */}
              <CapCard
                icon={<Trophy className="w-3.5 h-3.5 text-amber-400" />}
                label="Rewarded Ads Today"
                value={`${0} / 12 Ads`}
                barClass="from-amber-500 to-yellow-400"
                pct={0}
                leftLabel="Watched: 0"
                rightLabel="Resets at 00:00 UTC"
                rightClass="text-amber-400 font-bold"
              />
            </div>
          </div>

          {/* Challenger Standing Rating banner */}
          <div className="p-4 rounded-xl border border-slate-900 bg-slate-900/10 flex items-center gap-4">
            <Shield className="w-8 h-8 text-indigo-500 shrink-0" />
            <div className="text-xs leading-relaxed text-slate-400">
              <span className="font-bold text-slate-200 uppercase block mb-0.5">
                CHALLENGER STANDING RATING
              </span>
              All tournament statistics are linked directly to your global
              challenger index handle. Altering your registry flag updates
              leaderboard feeds dynamically. Data verification handshakes run
              periodically to check metrics validity.
            </div>
          </div>
        </div>
      )}

      {/* TAB: HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" /> Match Run Records
              Ledger
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Showing last 25 operations
            </span>
          </div>

          {matches.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-900 rounded-2xl">
              <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                No matches found in the active ledger standing.
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Jump into any arena to log your first run data!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Arena Sector</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Chips Outcome</th>
                    <th className="py-3 px-4 text-center">Kills</th>
                    <th className="py-3 px-4 text-center">Tail Score</th>
                    <th className="py-3 px-4">Time Elapsed</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-xs">
                  {matches.map((match) => (
                    <tr key={match.id} className="hover:bg-slate-900/20 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{match.arenaName}</span>
                          <span
                            className={`text-[8px] font-mono px-1 rounded ${
                              match.isOnline
                                ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {match.isOnline ? 'ONLINE' : 'PRACTICE'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            match.status === 'EXTRACTED'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          }`}
                        >
                          {match.status}
                        </span>
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold ${
                          match.status === 'EXTRACTED'
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {match.status === 'EXTRACTED'
                          ? `+${match.chipsEarned.toLocaleString()} c`
                          : `-${match.chipsLost.toLocaleString()} c`}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-300">
                        {match.kills}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-medium text-indigo-300">
                        {match.snakeLength || 10}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{match.durationSec}s</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {new Date(match.timestamp).toLocaleDateString()}{' '}
                        {new Date(match.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: FRIENDS */}
      {activeTab === 'friends' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Friends &amp; Live
              Spectate Portal
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Add allies to build your roster. Send daily gifts, invite them to
              high-stakes co-op matches, or spectate their live runs in
              real-time when they are in-match!
            </p>
          </div>

          <form
            onSubmit={handleAddFriend}
            className="flex gap-2.5 max-w-md"
          >
            <div className="relative flex-1">
              <UserPlus className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Enter challenger alias..."
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                maxLength={15}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-sans"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Sync Ally
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {friends.map((friend) => {
              const statusText =
                friend.status === 'online'
                  ? 'Online'
                  : friend.status === 'idle'
                    ? 'Idle'
                    : friend.status === 'in-match'
                      ? 'In Match'
                      : 'Offline';
              return (
                <div
                  key={friend.id}
                  className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 flex items-center justify-between hover:border-slate-800 transition shadow"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800">
                        <span className="text-xl">🐍</span>
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                          friend.status === 'online'
                            ? 'bg-emerald-500'
                            : friend.status === 'idle'
                              ? 'bg-amber-500 animate-pulse'
                              : friend.status === 'in-match'
                                ? 'bg-fuchsia-500 animate-pulse'
                                : 'bg-slate-600'
                        }`}
                        title={statusText}
                      />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span className="truncate">{friend.name}</span>
                        <span className="text-[9px] font-mono text-slate-500 font-normal shrink-0">
                          #{friend.userTag}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Level {friend.level} •{' '}
                        <span
                          className={`text-[10px] uppercase font-mono font-bold ${
                            friend.status === 'online'
                              ? 'text-emerald-400'
                              : friend.status === 'idle'
                                ? 'text-amber-400'
                                : friend.status === 'in-match'
                                  ? 'text-fuchsia-400'
                                  : 'text-slate-500'
                          }`}
                        >
                          {friend.status}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {friend.status === 'in-match' && (
                      <button
                        type="button"
                        onClick={() =>
                          notify(
                            `Spectating ${friend.name}'s live match... (demo)`,
                            'info',
                            onToast,
                          )
                        }
                        className="px-2.5 py-1.5 bg-fuchsia-600/20 text-fuchsia-300 hover:bg-fuchsia-600 hover:text-white border border-fuchsia-500/30 rounded-xl transition cursor-pointer text-xs font-bold flex items-center gap-1.5 animate-pulse"
                        title="Spectate Match"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Spectate</span>
                      </button>
                    )}

                    {(friend.status === 'online' ||
                      friend.status === 'idle') && (
                      <button
                        type="button"
                        onClick={() => openInviteModal(friend)}
                        className="px-2.5 py-1.5 bg-violet-600/20 text-violet-300 hover:bg-violet-600 hover:text-white border border-violet-500/30 rounded-xl transition cursor-pointer text-xs font-bold flex items-center gap-1.5"
                        title="Invite to Match"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>Invite</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSendGift(friend.id, friend.name)}
                      disabled={friend.giftSentToday || friend.status === 'offline'}
                      className={`px-2.5 py-1.5 rounded-xl border transition cursor-pointer text-xs font-bold flex items-center gap-1 ${
                        friend.giftSentToday
                          ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                      title="Send Gift"
                    >
                      <Landmark className="w-4 h-4" />
                      <span>{friend.giftSentToday ? 'Gifted' : 'Gift'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveFriend(friend.id, friend.name)}
                      className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                      title="Dismantle Alliance"
                      aria-label="Dismantle alliance"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: IDENTITY LOGS */}
      {activeTab === 'identityLog' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-start gap-3.5 mb-2">
            <Lock className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs font-sans leading-relaxed text-slate-300">
              <strong className="text-white uppercase block mb-1">
                CHALLENGER REGISTRY LEDGER
              </strong>
              To maintain the integrity of global tournaments, all modifications
              to nickname tags or regional affiliations are permanently logged
              to this client audit ledger. Tampering or spoofing database
              records will immediately reset active tournament streak counts.
            </div>
          </div>

          <div className="border border-slate-900 rounded-2xl overflow-hidden bg-slate-950/20">
            {identityLogs.length === 0 ? (
              <p className="text-center py-8 text-slate-500 text-xs font-mono">
                No handshakes registered yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-900">
                {identityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">TAG REGISTERED:</span>
                        <span className="text-slate-300 font-bold">
                          {log.previousName}
                        </span>
                        <span className="text-slate-500">➜</span>
                        <span className="text-indigo-400 font-bold">
                          {log.newName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>REGION ALIGNMENT:</span>
                        <span className="text-slate-500 uppercase">
                          {log.previousCountry}
                        </span>
                        <span className="text-slate-500">➜</span>
                        <span className="text-emerald-400 uppercase font-bold">
                          {log.newCountry}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">
                          HANDSHAKE TIMESTAMP
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {new Date(log.timestamp).toLocaleDateString()}{' '}
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <span className="px-2 py-1 rounded text-[9px] font-bold tracking-widest bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase">
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CO-OP LOBBY INVITE MODAL */}
      {activeInviteFriend && (
        <CoOpInviteModal
          friend={activeInviteFriend}
          playerChips={player.bankedChips}
          selectedArenaId={inviteSelectedArenaId}
          setSelectedArenaId={setInviteSelectedArenaId}
          statusMessage={inviteStatusMessage}
          setStatusMessage={setInviteStatusMessage}
          onClose={() => setActiveInviteFriend(null)}
          onSend={handleSendCoOpInvite}
          onToast={onToast}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function StatCard({
  label,
  subLabel,
  value,
  icon,
  valueClass,
}: {
  label: string;
  subLabel: string;
  value: string;
  icon: React.ReactNode;
  valueClass: string;
}) {
  return (
    <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 flex flex-col justify-between hover:border-slate-800 transition shadow">
      <div className="flex items-center justify-between text-slate-400 mb-2">
        <span className="text-xs font-sans">{label}</span>
        {icon}
      </div>
      <div>
        <span
          className={`text-xl font-bold font-mono tracking-tight block ${valueClass}`}
        >
          {value}
        </span>
        <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">
          {subLabel}
        </span>
      </div>
    </div>
  );
}

function CapCard({
  icon,
  label,
  value,
  barClass,
  pct,
  leftLabel,
  rightLabel,
  rightClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  barClass: string;
  pct: number;
  leftLabel: string;
  rightLabel: string;
  rightClass: string;
}) {
  return (
    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-400 font-bold uppercase font-sans flex items-center gap-1">
          {icon} {label}
        </span>
        <span className="font-mono font-bold text-slate-300">{value}</span>
      </div>
      <div className="w-full h-2.5 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${barClass} rounded-full`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
        <span>{leftLabel}</span>
        <span className={rightClass}>{rightLabel}</span>
      </div>
    </div>
  );
}

interface IdentityEditorProps {
  newName: string;
  setNewName: (v: string) => void;
  selectedCountry: string;
  setSelectedCountry: (v: string) => void;
  selectedAvatar: string;
  setSelectedAvatar: (v: string) => void;
  instagram: string;
  setInstagram: (v: string) => void;
  youtube: string;
  setYoutube: (v: string) => void;
  twitch: string;
  setTwitch: (v: string) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}

function IdentityEditor(props: IdentityEditorProps) {
  const {
    newName,
    setNewName,
    selectedCountry,
    setSelectedCountry,
    selectedAvatar,
    setSelectedAvatar,
    instagram,
    setInstagram,
    youtube,
    setYoutube,
    twitch,
    setTwitch,
    isDragging,
    setIsDragging,
    onDrop,
    onFileChange,
    onCancel,
    onSave,
    saving,
  } = props;

  const isImageAvatar =
    selectedAvatar.startsWith('data:') || selectedAvatar.startsWith('http');

  return (
    <div className="border border-indigo-500/30 bg-slate-950/80 rounded-2xl p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
        <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
          <Lock className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white font-sans">
            Handshake Registration Protocol
          </h3>
          <p className="text-xs text-slate-400">
            Lock down your tournament handle and regional alignment. All
            changes are logged.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Nickname */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
            Challenger Handle
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={15}
            className="bg-slate-900 border border-slate-800 text-white font-sans text-sm px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all w-full"
            placeholder="Enter nickname"
          />
          <span className="text-[10px] text-slate-500">
            Max 15 characters. System validates non-duplicate handle signatures.
          </span>
        </div>

        {/* Country */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
            Faction Region (Flag)
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white font-sans text-sm px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all w-full cursor-pointer"
          >
            {FACTION_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.code})
              </option>
            ))}
          </select>
          <span className="text-[10px] text-slate-500">
            Associates your extraction chips to regional champion rankings.
          </span>
        </div>

        {/* Avatar customizer */}
        <div className="md:col-span-2 flex flex-col gap-3 border-t border-slate-900/60 pt-5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
            Profile Avatar / Identity Emblem
          </label>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Left: drag-drop */}
            <div className="md:col-span-5 flex flex-col gap-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() =>
                  document.getElementById('avatar-file-input')?.click()
                }
                className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 relative group h-44 ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/5'
                    : 'border-slate-800 bg-slate-900/40 hover:border-indigo-500/40 hover:bg-slate-900/60'
                }`}
              >
                <input
                  id="avatar-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                />

                {selectedAvatar && isImageAvatar ? (
                  <div className="absolute inset-0 p-1.5 flex flex-col items-center justify-center bg-slate-950/80 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Upload className="w-6 h-6 text-indigo-400 mb-1" />
                    <span className="text-[10px] text-white font-sans font-bold">
                      CHANGE IMAGE
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5">
                      Drag &amp; Drop or Click
                    </span>
                  </div>
                ) : null}

                {selectedAvatar ? (
                  isImageAvatar ? (
                    <div className="w-24 h-24 rounded-2xl border border-indigo-500/20 overflow-hidden relative shadow-lg">
                      <img
                        src={selectedAvatar}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-4xl mb-2 shadow-inner">
                        {selectedAvatar}
                      </div>
                      <span className="text-xs font-bold text-white font-sans">
                        Preset Selected
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 font-sans">
                        Click here to upload custom image instead
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-400 group-hover:text-indigo-400 transition-colors mb-2.5">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white font-sans">
                      Upload Custom Photo
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Drag &amp; Drop or click to browse
                    </span>
                    <span className="text-[9px] text-slate-500 mt-0.5">
                      PNG, JPG, WebP up to 1.5MB
                    </span>
                  </div>
                )}
              </div>

              {selectedAvatar && (
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('')}
                  className="py-1.5 px-3 bg-slate-900 hover:bg-red-950/40 hover:text-red-400 hover:border-red-500/20 border border-slate-800 text-slate-400 rounded-xl text-[10px] font-sans font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset to Skin Default
                </button>
              )}
            </div>

            {/* Right: preset grid */}
            <div className="md:col-span-7 flex flex-col gap-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                Choose Preset Emblem
              </span>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AVATARS.map((p) => {
                  const isSelected = selectedAvatar === p.emoji;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedAvatar(p.emoji)}
                      className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-1.5 group hover:scale-105 h-20 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-lg'
                          : 'border-slate-900 bg-slate-950/40 hover:border-slate-800'
                      }`}
                      title={p.label}
                    >
                      <span className="text-2xl select-none group-hover:scale-110 transition-transform">
                        {p.emoji}
                      </span>
                      <span className="text-[8.5px] font-sans font-semibold text-slate-400 group-hover:text-slate-200 truncate w-full text-center">
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Social channels */}
        <div className="md:col-span-2 flex flex-col gap-3 border-t border-slate-900/60 pt-5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-400" /> Creator Social
            Channels (Showcased on your Public Profile)
          </label>
          <p className="text-[11px] text-slate-400 font-sans">
            Link your Instagram handle, YouTube channel, and Twitch profile so
            other vipers and allies can follow you and watch your game clips!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-pink-400 font-sans uppercase">
                📸 Instagram Handle
              </label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@username (e.g. @hari_snake_god)"
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-pink-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-red-400 font-sans uppercase">
                🎥 YouTube Channel / Handle
              </label>
              <input
                type="text"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder="@channel or URL"
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-purple-400 font-sans uppercase">
                📱 Twitch Stream Handle
              </label>
              <input
                type="text"
                value={twitch}
                onChange={(e) => setTwitch(e.target.value)}
                placeholder="twitch_username"
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 p-3.5 bg-indigo-950/20 border border-indigo-500/10 rounded-xl flex items-start gap-3">
        <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs font-sans leading-relaxed text-slate-300">
          <strong className="text-indigo-300 block mb-0.5">
            CYBER HANDSHAKE WARNING:
          </strong>
          Changing your registered alias or territory updates global tournament
          indices. Immutable record logs are appended to the ledger below.
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2.5 border-t border-slate-900 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Check className="w-4 h-4" /> Save Handshake
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Co-Op Invite Modal
// ---------------------------------------------------------------------------
interface CoOpInviteModalProps {
  friend: Friend;
  playerChips: number;
  selectedArenaId: string;
  setSelectedArenaId: (id: string) => void;
  statusMessage: InviteStatusMessage | null;
  setStatusMessage: (m: InviteStatusMessage | null) => void;
  onClose: () => void;
  onSend: () => void;
  onToast?: ToastFn;
}

function CoOpInviteModal({
  friend,
  playerChips,
  selectedArenaId,
  setSelectedArenaId,
  statusMessage,
  setStatusMessage,
  onClose,
  onSend,
  onToast,
}: CoOpInviteModalProps) {
  const friendChips = getFriendSimulatedChips(friend);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: friend.skinColor }}
        />

        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Swords className="w-5 h-5 text-violet-400 animate-pulse" />
            <div>
              <h3 className="font-bold text-white text-sm font-sans">
                Co-Op Lobby Invite
              </h3>
              <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                Assemble a squad with your allies
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl flex flex-col gap-1 text-center">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-sans">
              Your Balance
            </span>
            <span className="text-sm font-bold font-mono text-indigo-400">
              {playerChips.toLocaleString()}{' '}
              <span className="text-xs font-sans text-slate-500">c</span>
            </span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl flex flex-col gap-1 text-center">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-sans">
              {friend.name}
            </span>
            <span className="text-sm font-bold font-mono text-emerald-400">
              {friendChips.toLocaleString()}{' '}
              <span className="text-xs font-sans text-slate-500">c</span>
            </span>
          </div>
        </div>

        {/* Arena selector */}
        <div className="flex flex-col gap-2 my-4">
          <label className="text-[10px] text-slate-400 font-bold uppercase font-sans tracking-wide">
            Select Arena Stakes
          </label>
          <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1 va-scroll">
            {ARENA_TIERS.map((tier) => {
              const isSelected = tier.id === selectedArenaId;
              const friendAffords = friendChips >= tier.buyIn;
              const youAfford = playerChips >= tier.buyIn;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    setSelectedArenaId(tier.id);
                    setStatusMessage(null);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 border-indigo-500 shadow-md'
                      : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: tier.accentColor }}
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {tier.name}
                      </span>
                      <span className="text-[9px] text-slate-400 font-sans mt-0.5 leading-none">
                        Buy-In: {tier.buyIn.toLocaleString()} c
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {!youAfford ? (
                      <span className="text-[8px] bg-rose-950/80 text-rose-400 border border-rose-900/40 px-1.5 py-0.5 rounded font-bold font-sans">
                        You can&apos;t afford
                      </span>
                    ) : !friendAffords ? (
                      <span className="text-[8px] bg-amber-950/80 text-amber-300 border border-amber-900/40 px-1.5 py-0.5 rounded font-bold font-sans">
                        They can&apos;t afford
                      </span>
                    ) : (
                      <span className="text-[8px] bg-emerald-950/80 text-emerald-300 border border-emerald-900/40 px-1.5 py-0.5 rounded font-bold font-sans">
                        Eligible 🤝
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Speech bubble */}
        {statusMessage && (
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex flex-col gap-2 my-4">
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  backgroundColor: `${friend.skinColor}33`,
                  color: friend.skinColor,
                }}
              >
                💬
              </div>
              <span className="text-[10px] font-bold text-slate-300">
                {friend.name} responds:
              </span>
            </div>
            <p className="text-xs italic text-slate-300 leading-relaxed pl-7">
              &quot;{statusMessage.text}&quot;
            </p>

            {statusMessage.type === 'counter' &&
              statusMessage.counterArenaId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedArenaId(statusMessage.counterArenaId!);
                    setStatusMessage(null);
                    notify(
                      'Switched buy-in to match counter-proposal!',
                      'info',
                      onToast,
                    );
                  }}
                  className="mt-1 ml-7 self-start px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-[10px] font-bold font-sans transition cursor-pointer"
                >
                  🤝 Accept Proposal &amp; Invite
                </button>
              )}
          </div>
        )}

        {/* Modal actions */}
        <div className="flex items-center gap-2 border-t border-slate-800/60 pt-4 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-white rounded-xl text-xs font-bold font-sans transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSend}
            className="flex-1 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border border-violet-500/30 text-white rounded-xl text-xs font-bold font-sans transition cursor-pointer"
          >
            Send Co-Op Invite
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlayerProfilePanel;
