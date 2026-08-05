'use client';

/**
 * Card Branding & Rendering — Canvas API drawing functions for share cards.
 * Extracted from share-card for maintainability.
 */

import { countryFlag } from '../game-config';
import { formatChipsIndian as formatChips } from '../format-chips';

// ── Types (re-exported) ──

export interface MatchCardData {
  playerName: string;
  userTag: string;
  country: string;
  level: number;
  clanTag?: string | null;
  arenaName: string;
  outcome: 'extract' | 'death';
  chipsEarned: number;
  chipsLost: number;
  kills: number;
  snakeLength: number;
  durationSec: number;
  isOnline: boolean;
}

export interface ProfileCardData {
  playerName: string;
  userTag: string;
  country: string;
  level: number;
  bankedChips: number;
  clanTag?: string | null;
  lifetimeKills: number;
  lifetimeExtracts: number;
  lifetimeDeaths: number;
  biggestExtract: number;
  bestStreak: number;
  totalEarned: number;
  totalLost: number;
}

export interface MilestoneCardData {
  playerName: string;
  userTag: string;
  country: string;
  tierName: string;
  tierBadge: string;
  chipsMilestone: number;
  currentChips: number;
}

// ── Constants ──

const W = 1080;
const H = 1080;

// ── Canvas Helpers ──

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawFlag(ctx: CanvasRenderingContext2D, code: string, x: number, y: number, size: number) {
  const flag = countryFlag(code);
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(flag, x, y);
}

// ── Background renderer ──

function drawBackground(ctx: CanvasRenderingContext2D) {
  // Dark gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0e17');
  grad.addColorStop(0.5, '#0f1623');
  grad.addColorStop(1, '#0a0e17');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += 60) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
  }
  for (let i = 0; i < H; i += 60) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
  }

  // Accent glow circles
  const radGrad = ctx.createRadialGradient(900, 200, 0, 900, 200, 400);
  radGrad.addColorStop(0, 'rgba(220, 38, 38, 0.08)');
  radGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, W, H);

  const radGrad2 = ctx.createRadialGradient(180, 800, 0, 180, 800, 350);
  radGrad2.addColorStop(0, 'rgba(139, 92, 246, 0.06)');
  radGrad2.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad2;
  ctx.fillRect(0, 0, W, H);
}

export function drawBranding(ctx: CanvasRenderingContext2D) {
  // Top bar
  ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
  ctx.fillRect(0, 0, W, 80);
  ctx.fillStyle = 'rgba(220, 38, 38, 0.3)';
  ctx.fillRect(0, 78, W, 2);

  // Logo text
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ef4444';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐍 VENOM ARENA', 40, 40);

  // Right side badge
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = '#f87171';
  ctx.textAlign = 'right';
  ctx.fillText('MATCH HIGHLIGHT', W - 40, 34);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Multiplayer Snake Battle', W - 40, 56);

  // Bottom bar
  ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.fillRect(0, H - 60, W, 60);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
  ctx.fillRect(0, H - 62, W, 2);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText('play · extract · dominate', W / 2, H - 28);
}

// ── Match Result Card ──

export async function renderMatchCard(data: MatchCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  drawBackground(ctx);

  // Outcome banner
  const isWin = data.outcome === 'extract';
  const bannerColor = isWin ? '#059669' : '#dc2626';
  const bannerText = isWin ? '✅ EXTRACTED SUCCESSFULLY' : '💀 ELIMINATED';

  ctx.fillStyle = bannerColor + '20';
  roundRect(ctx, 40, 100, W - 80, 60, 16);
  ctx.fill();
  ctx.strokeStyle = bannerColor + '60';
  ctx.lineWidth = 2;
  roundRect(ctx, 40, 100, W - 80, 60, 16);
  ctx.stroke();

  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = bannerColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bannerText, W / 2, 130);

  // Arena name
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(data.isOnline ? `🌐 ${data.arenaName}` : `🎮 ${data.arenaName} (Practice)`, W / 2, 185);

  // Player info section
  const py = 240;
  drawFlag(ctx, data.country, 100, py + 40, 56);

  ctx.textAlign = 'left';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(data.playerName, 160, py + 25);

  ctx.font = '20px monospace';
  ctx.fillStyle = '#94a3b8';
  let tagLine = `#${data.userTag}`;
  if (data.clanTag) tagLine += `  [${data.clanTag}]`;
  ctx.fillText(tagLine, 160, py + 60);

  // Level badge
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = '#a78bfa';
  ctx.textAlign = 'right';
  ctx.fillText(`LVL ${data.level}`, W - 50, py + 25);

  // Divider
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, py + 100); ctx.lineTo(W - 60, py + 100); ctx.stroke();

  // Stats grid — 2x2
  const stats = [
    {
      label: 'CHIPS ' + (isWin ? 'EARNED' : 'LOST'),
      value: (isWin ? '+' : '-') + formatChips(isWin ? data.chipsEarned : data.chipsLost) + ' c',
      color: isWin ? '#34d399' : '#f87171',
      icon: '💰',
    },
    { label: 'ELIMINATIONS', value: String(data.kills), color: '#fbbf24', icon: '💀' },
    { label: 'SNAKE LENGTH', value: String(data.snakeLength), color: '#60a5fa', icon: '🐍' },
    { label: 'SURVIVAL TIME', value: formatDuration(data.durationSec), color: '#c084fc', icon: '⏱️' },
  ];

  const gridStart = py + 130;
  const cellW = (W - 120) / 2;
  const cellH = 150;

  stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = 60 + col * cellW;
    const cy = gridStart + row * (cellH + 20);

    // Card bg
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    roundRect(ctx, cx, cy, cellW - 16, cellH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    roundRect(ctx, cx, cy, cellW - 16, cellH, 16);
    ctx.stroke();

    // Icon
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.icon, cx + (cellW - 16) / 2, cy + 42);

    // Value
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = s.color;
    ctx.fillText(s.value, cx + (cellW - 16) / 2, cy + 90);

    // Label
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.letterSpacing = '2px';
    ctx.fillText(s.label, cx + (cellW - 16) / 2, cy + 125);
    ctx.letterSpacing = '0px';
  });

  // Branding
  drawBranding(ctx);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
  });
}

// ── Profile Card ──

export async function renderProfileCard(data: ProfileCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  drawBackground(ctx);

  // Title
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PLAYER PROFILE CARD', W / 2, 50);

  // Player info
  const py = 110;
  drawFlag(ctx, data.country, W / 2, py + 45, 64);

  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(data.playerName, W / 2, py + 110);

  ctx.font = '22px monospace';
  ctx.fillStyle = '#f87171';
  let tagLine = `#${data.userTag}`;
  if (data.clanTag) tagLine += `  [${data.clanTag}]`;
  ctx.fillText(tagLine, W / 2, py + 150);

  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#a78bfa';
  ctx.fillText(`CHALLENGER  ·  LVL ${data.level}`, W / 2, py + 185);

  // Chips banner
  ctx.fillStyle = 'rgba(234, 179, 8, 0.1)';
  roundRect(ctx, 60, py + 220, W - 120, 70, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.3)';
  ctx.lineWidth = 2;
  roundRect(ctx, 60, py + 220, W - 120, 70, 16);
  ctx.stroke();

  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('BANKED CHIPS', W / 2, py + 248);
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillStyle = '#fde047';
  ctx.fillText(data.bankedChips.toLocaleString('en-IN') + ' c', W / 2, py + 278);

  // Stats grid
  const stats = [
    { label: 'ELIMINATIONS', value: data.lifetimeKills.toLocaleString(), icon: '💀', color: '#fbbf24' },
    { label: 'EXTRACTIONS', value: data.lifetimeExtracts.toLocaleString(), icon: '✅', color: '#34d399' },
    { label: 'DEATHS', value: data.lifetimeDeaths.toLocaleString(), icon: '☠️', color: '#f87171' },
    { label: 'BEST STREAK', value: String(data.bestStreak), icon: '🔥', color: '#fb923c' },
    { label: 'BIGGEST EXTRACT', value: formatChips(data.biggestExtract), icon: '🏆', color: '#fbbf24' },
    { label: 'TOTAL EARNED', value: formatChips(data.totalEarned), icon: '📈', color: '#34d399' },
  ];

  const gridStart = py + 320;
  const cols = 3;
  const cellW = (W - 120) / cols;
  const cellH = 120;

  stats.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = 60 + col * cellW;
    const cy = gridStart + row * (cellH + 12);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    roundRect(ctx, cx, cy, cellW - 12, cellH, 12);
    ctx.fill();

    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.icon, cx + (cellW - 12) / 2, cy + 35);

    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = s.color;
    ctx.fillText(s.value, cx + (cellW - 12) / 2, cy + 72);

    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(s.label, cx + (cellW - 12) / 2, cy + 100);
  });

  // Branding
  drawBranding(ctx);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
  });
}

// ── Milestone Card ──

export async function renderMilestoneCard(data: MilestoneCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  drawBackground(ctx);

  // Big congrats glow
  const radGrad = ctx.createRadialGradient(W / 2, 400, 0, W / 2, 400, 500);
  radGrad.addColorStop(0, 'rgba(234, 179, 8, 0.12)');
  radGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎉 MILESTONE UNLOCKED 🎉', W / 2, 140);

  // Tier badge
  const parts = data.tierBadge.split(' ');
  const badgeEmoji = parts[0] || '🏅';
  const badgeName = parts.slice(1).join(' ');

  ctx.font = '72px serif';
  ctx.fillText(badgeEmoji, W / 2, 280);

  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillStyle = '#fde047';
  ctx.fillText(badgeName, W / 2, 360);

  // Chips achieved
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Total Chips Banked', W / 2, 430);

  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillStyle = '#34d399';
  ctx.fillText(data.chipsMilestone.toLocaleString('en-IN') + ' c', W / 2, 500);

  // Player info
  drawFlag(ctx, data.country, W / 2, 600, 48);

  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(data.playerName, W / 2, 660);

  ctx.font = '20px monospace';
  ctx.fillStyle = '#f87171';
  ctx.fillText(`#${data.userTag}`, W / 2, 695);

  // CTA
  ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
  roundRect(ctx, W / 2 - 200, 760, 400, 56, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, W / 2 - 200, 760, 400, 56, 28);
  ctx.stroke();

  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#f87171';
  ctx.fillText('🐍  PLAY VENOM ARENA  🐍', W / 2, 788);

  // Branding
  drawBranding(ctx);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
  });
}
