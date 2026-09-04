import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { db } from './db';
import bcrypt from 'bcryptjs';
import { ensureYearRollover } from './year-rollover';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required');
  return secret;
}
const COOKIE_NAME = 'va_session';
const SESSION_DAYS = 30;

export interface SessionPayload {
  playerId: string;
  userTag: string;
  role: 'player' | 'admin';
  tokenVersion?: number;
  // Audit A2: 'session' tokens are full API credentials (cookie-bound);
  // 'game' tokens are 1h WS-only credentials and must never be accepted
  // as session cookies. signSession defaults to 'session'.
  scope?: 'session' | 'game';
  iat?: number;
  exp?: number;
}

export async function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>, expiresIn?: string): Promise<string> {
  // Security (audit A1): ALWAYS embed the player's current tokenVersion so the
  // revocation check in getSession() actually fires. Previously no route
  // included the claim, so password changes / account deletion could not
  // invalidate existing sessions (revocation was a silent no-op).
  const claims: SessionPayload = { ...payload };
  if (claims.tokenVersion === undefined) {
    const p = await db.player.findUnique({
      where: { id: payload.playerId },
      select: { tokenVersion: true },
    });
    claims.tokenVersion = p?.tokenVersion ?? 0;
  }
  // Audit A2: default scope is full session. The game-token route is the only
  // caller that overrides this to 'game' (WS-only credential).
  if (claims.scope === undefined) claims.scope = 'session';
  // @ts-expect-error jwt.sign overload mismatch with SessionPayload
  return jwt.sign(claims, getJwtSecret(), { expiresIn: expiresIn || `${SESSION_DAYS}d` });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;

  // Jan 1 wallet rollover (locked spec): lazy, idempotent, memoized to one
  // integer compare per process per year — see lib/year-rollover.ts.
  await ensureYearRollover();

  // Invalidate session for banned players and token version mismatches
  // Also refresh role from DB (source of truth) so promotions/demotions take effect immediately
  const player = await db.player.findUnique({ where: { id: payload.playerId }, select: { banned: true, tokenVersion: true, role: true } });
  if (player?.banned === true) return null;
  // Security (audit A1): tokens WITHOUT a tokenVersion claim are legacy
  // pre-hardening tokens — reject them outright so revocation is airtight.
  if (payload.tokenVersion === undefined) return null;
  if (player && payload.tokenVersion !== player.tokenVersion) return null;
  // Security (audit A2): a 1h game-scoped token must never act as a session
  // cookie (same signing key — without this check it was a full credential).
  // Tokens without a scope claim are legacy pre-hardening — reject as well.
  if (payload.scope !== 'session') return null;
  // Always use DB role as source of truth
  payload.role = (player?.role as 'player' | 'admin') || 'player';

  return payload;
}

export async function setSessionCookie(token: string, maxAgeSeconds?: number) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeSeconds ?? SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Generate a unique alphanumeric user tag like VM-ha45462
export function generateUserTag(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `VM-${code}`;
}

export async function generateUniqueUserTag(): Promise<string> {
  // Try up to 20 times to find a non-colliding tag
  for (let i = 0; i < 20; i++) {
    const tag = generateUserTag();
    const existing = await db.player.findUnique({ where: { userTag: tag } });
    if (!existing) return tag;
  }
  // Fallback: add extra random chars
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let extra = '';
  for (let i = 0; i < 4; i++) extra += chars[Math.floor(Math.random() * chars.length)];
  return `VM-${Math.random().toString(36).slice(2, 8)}${extra}`;
}
