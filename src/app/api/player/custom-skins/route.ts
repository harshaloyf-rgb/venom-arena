import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CustomSkinEntry {
  id: string;           // unique ID for this saved skin slot
  name: string;         // user-given name
  colors: string[];     // color sequence
  bodyStyle: string;    // BodyStyle
  taperStyle: string;   // TaperStyle
  glow: boolean;
  createdAt: string;    // ISO date
}

const MAX_CUSTOM_SKINS = 5;

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCustomSkins(raw: string | null): CustomSkinEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidEntry);
  } catch {
    return [];
  }
}

function isValidEntry(e: unknown): e is CustomSkinEntry {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.colors) &&
    o.colors.every((c: unknown) => typeof c === 'string') &&
    typeof o.bodyStyle === 'string' &&
    typeof o.taperStyle === 'string' &&
    typeof o.glow === 'boolean' &&
    typeof o.createdAt === 'string'
  );
}

// ─── GET /api/player/custom-skins ──────────────────────────────────────────

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const p = await db.player.findUnique({ where: { id: session.playerId } });
    if (!p) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const skins = parseCustomSkins(p.customSkins);
    return NextResponse.json({ skins });
  } catch (e) {
    console.error('[custom-skins] GET error', e);
    return NextResponse.json({ error: 'Failed to load custom skins.' }, { status: 500 });
  }
}

// ─── POST /api/player/custom-skins ─────────────────────────────────────────
// body: { name, colors, bodyStyle, taperStyle, glow, id? }
// If id is provided, it updates that slot. Otherwise creates new.

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 30);
  const colors = (body.colors || []).filter((c: unknown) => typeof c === 'string');
  const bodyStyle = String(body.bodyStyle || 'smooth');
  const taperStyle = String(body.taperStyle || 'natural');
  const glow = Boolean(body.glow);
  const updateId = body.id ? String(body.id) : null;

  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (colors.length === 0 || colors.length > 24) {
    return NextResponse.json({ error: 'Colors must have 1-24 entries.' }, { status: 400 });
  }

  try {
    const p = await db.player.findUnique({ where: { id: session.playerId } });
    if (!p) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    let skins = parseCustomSkins(p.customSkins);

    if (updateId) {
      // Update existing
      const idx = skins.findIndex((s) => s.id === updateId);
      if (idx === -1) {
        return NextResponse.json({ error: 'Skin not found in inventory.' }, { status: 404 });
      }
      skins[idx] = { ...skins[idx], name, colors, bodyStyle, taperStyle, glow };
    } else {
      // Create new
      if (skins.length >= MAX_CUSTOM_SKINS) {
        return NextResponse.json({
          error: `Inventory full! Max ${MAX_CUSTOM_SKINS} custom skins. Delete one first.`,
        }, { status: 400 });
      }
      skins.push({
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        colors,
 bodyStyle,
        taperStyle,
        glow,
        createdAt: new Date().toISOString(),
      });
    }

    await db.player.update({
      where: { id: session.playerId },
      data: { customSkins: JSON.stringify(skins) },
    });

    return NextResponse.json({ skins });
  } catch (e) {
    console.error('[custom-skins] POST error', e);
    return NextResponse.json({ error: 'Failed to save custom skin.' }, { status: 500 });
  }
}

// ─── DELETE /api/player/custom-skins ───────────────────────────────────────
// body: { id: string }

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ error: 'Skin ID required.' }, { status: 400 });

  try {
    const p = await db.player.findUnique({ where: { id: session.playerId } });
    if (!p) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    let skins = parseCustomSkins(p.customSkins);
    const before = skins.length;
    skins = skins.filter((s) => s.id !== id);

    if (skins.length === before) {
      return NextResponse.json({ error: 'Skin not found.' }, { status: 404 });
    }

    await db.player.update({
      where: { id: session.playerId },
      data: { customSkins: JSON.stringify(skins) },
    });

    return NextResponse.json({ skins });
  } catch (e) {
    console.error('[custom-skins] DELETE error', e);
    return NextResponse.json({ error: 'Failed to delete custom skin.' }, { status: 500 });
  }
}
