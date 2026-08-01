import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Simple in-memory cooldown per player for clan chat
const chatCooldowns = new Map<string, number>();
const CHAT_COOLDOWN_MS = 2000; // 2 seconds

// GET /api/clans/chat?tag=APEX   — last 50 messages
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const tag = String(url.searchParams.get('tag') || '').toUpperCase();
  if (!tag) return NextResponse.json({ error: 'tag required' }, { status: 400 });

  // membership check
  const me = await db.player.findUnique({ where: { id: session.playerId } });
  if (!me || me.clanTag !== tag) return NextResponse.json({ error: 'Not a member.' }, { status: 403 });

  const messages = await db.clanMessage.findMany({
    where: { clanTag: tag },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  // Return in chronological order (oldest first)
  messages.reverse();
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const tag = String(body.tag || '').toUpperCase();
    const message = String(body.message || '').trim().slice(0, 300);
    if (!tag || !message) return NextResponse.json({ error: 'Invalid message.' }, { status: 400 });

    // Rate limit: 1 message per 2 seconds per player
    const now = Date.now();
    const lastChat = chatCooldowns.get(session.playerId);
    if (lastChat && now - lastChat < CHAT_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Slow down. Wait before sending another message.' }, { status: 429 });
    }
    chatCooldowns.set(session.playerId, now);

    const me = await db.player.findUnique({ where: { id: session.playerId } });
    if (!me || me.clanTag !== tag) return NextResponse.json({ error: 'Not a member.' }, { status: 403 });

    // Strip HTML tags from message
    const sanitized = message.replace(/<[^>]*>/g, '');

    const created = await db.clanMessage.create({
      data: {
        clanTag: tag,
        senderTag: me.userTag,
        senderName: me.name,
        rank: me.clanRank || 'Viper',
        message: sanitized,
      },
    });

    // Update chat_activity challenge progress for current week
    const dayOfWeek = now.getDay ? new Date().getDay() : new Date().getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date();
    monday.setDate(new Date().getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString().split('T')[0];

    await db.clanChallenge.updateMany({
      where: { clanTag: tag, type: 'chat_activity', weekStart, claimed: false },
      data: { progress: { increment: 1 } },
    });

    return NextResponse.json({ ok: true, message: created });
  } catch (e) {
    console.error('[clans/chat] error', e);
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
  }
}
