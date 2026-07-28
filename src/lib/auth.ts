import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { db } from './db';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'venom-arena-dev-secret-change-in-prod';
const COOKIE_NAME = 'va_session';
const SESSION_DAYS = 30;

export interface SessionPayload {
  playerId: string;
  userTag: string;
  role: 'player' | 'admin';
  iat?: number;
  exp?: number;
}

export async function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
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

// Generate a unique user tag like VENOM-8291
export function generateUserTag(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `VENOM-${n}`;
}

export async function generateUniqueUserTag(): Promise<string> {
  // Try up to 20 times to find a non-colliding tag
  for (let i = 0; i < 20; i++) {
    const tag = generateUserTag();
    const existing = await db.player.findUnique({ where: { userTag: tag } });
    if (!existing) return tag;
  }
  // Fallback: use a longer random
  return `VENOM-${Math.floor(Math.random() * 10000000)}`;
}
