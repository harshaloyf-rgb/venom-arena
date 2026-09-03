import { OP, StringTable, StringTable as ST, WriteBuffer } from './protocol';

// Re-export RADIUS_TO_INDEX for convenience
const { RADIUS_TO_INDEX } = ST;

interface SnapshotData {
  t: number;           // tick
  br: number;          // boundaryRadius
  s: any[];            // snakes array
  f: any[];            // flat food array [x, y, radius, color, magnetized, ...]
  ps: number;          // playerScore
  pk: number;          // playerKills
  st: number[];        // flat star array [x, y, value, id, radius, ...]
  pc: number;          // playerCarriedChips
  m: number[];         // flat minimap array [x, y, score, isBot, ...]
  mode?: 'head-only';  // optional mode flag
}

// ── Singleton WriteBuffer (avoids per-tick allocation) ───────────────────────

let _wb: WriteBuffer | null = null;
function getWriteBuffer(): WriteBuffer {
  if (!_wb) _wb = new WriteBuffer(65536); // 64KB initial
  _wb.reset();
  return _wb;
}

// ── UTF-8 encoder singleton ──────────────────────────────────────────────────

const _encoder = new TextEncoder();

// ── Helpers ──────────────────────────────────────────────────────────────────

function clampI16(v: number): number {
  return v < -32768 ? -32768 : v > 32767 ? 32767 : v | 0;
}

// ── Main encoder ─────────────────────────────────────────────────────────────

/**
 * Encode a snapshot object into a binary ArrayBuffer.
 * Uses the stringTable to convert strings to u16 indices.
 * Returns the new string indices that were added (for STRING_TABLE delta).
 */
export function encodeSnapshot(
  data: SnapshotData,
  stringTable: StringTable,
): { buffer: ArrayBuffer; newStrings: number[] } {
  const snakes: any[] = data.s ?? [];
  const foods: any[] = data.f ?? [];
  const stars: number[] = data.st ?? [];
  const minimap: number[] = data.m ?? [];

  const snakeCount = snakes.length;
  const foodCount = Math.floor(foods.length / 5);
  const starCount = Math.floor(stars.length / 5);
  const minimapCount = Math.floor(minimap.length / 4);
  const isHeadOnly = data.mode === 'head-only';

  // ── Pass 1: Pre-register all strings and track NEW indices ────────────────

  const sizeBefore = stringTable.strings.length;

  // Snakes: id, name, color, sc (headColor), si (skinId), ra (rarity)
  for (const snake of snakes) {
    stringTable.getOrAdd(String(snake.id ?? ''));
    stringTable.getOrAdd(String(snake.name ?? ''));
    stringTable.getOrAdd(String(snake.color ?? ''));
    stringTable.getOrAdd(String(snake.sc ?? ''));
    if (snake.si != null) stringTable.getOrAdd(String(snake.si));
    if (snake.ra != null) stringTable.getOrAdd(String(snake.ra));
  }

  // Foods: color (every 5th element starting at index 3)
  for (let i = 0; i + 3 < foods.length; i += 5) {
    stringTable.getOrAdd(String(foods[i + 3] ?? ''));
  }

  // Collect newly added indices
  const newStrings: number[] = [];
  for (let i = sizeBefore; i < stringTable.strings.length; i++) {
    newStrings.push(i);
  }

  // ── Pass 2: Calculate buffer size and allocate ────────────────────────────

  // Header: 1(OP) + 4(tick) + 4(boundaryRadius) + 4(playerScore) + 2(playerKills)
  //       + 4(playerChips) + 1(flags) + 2(snakeCount) + 2(foodCount) + 2(starCount)
  //       + 2(minimapCount) = 28 bytes
  let totalSize = 28;

  // Per snake (full and head-only): 2+2+4+4+4+4+2+2+2+1+1+2+2 = 32 + optional 4 (carriedChips)
  for (const snake of snakes) {
    totalSize += 2 + 2 + 4 + 4 + 4 + 4 + 2 + 2 + 2 + 1 + 1 + 2 + 2; // 32
    if ((snake.cc ?? 0) > 0) totalSize += 4; // carriedChips
  }

  // Per food (stride 5): 4+4+1+2+1 = 12 bytes
  totalSize += foodCount * 12;

  // Per star (stride 5): 4+4+2+2+1 = 13 bytes
  totalSize += starCount * 15;

  // Per minimap (stride 4): 2+2+2+1 = 7 bytes
  totalSize += minimapCount * 7;

  // ── Pass 3: Write everything ──────────────────────────────────────────────

  const wb = getWriteBuffer();

  // Header
  wb.writeU8(OP.SNAPSHOT);
  wb.writeU32(data.t ?? 0);
  wb.writeF32(data.br ?? 2000);
  wb.writeF32(data.ps ?? 0);
  wb.writeU16(data.pk ?? 0);
  wb.writeF32(data.pc ?? 0);

  // flags byte: bit 1 = head-only mode (matches client parser)
  const flags = isHeadOnly ? 0x02 : 0x00;
  wb.writeU8(flags);

  wb.writeU16(snakeCount);
  wb.writeU16(foodCount);
  wb.writeU16(starCount);
  wb.writeU16(minimapCount);

  // ── Snakes ─────────────────────────────────────────────────────────────────

  const mapHalf = data.br ?? 2000; // boundaryRadius used as mapHalf for minimap

  for (const snake of snakes) {
    const snakeIdIdx = stringTable.getOrAdd(String(snake.id ?? ''));
    const nameIdx = stringTable.getOrAdd(String(snake.name ?? ''));
    const colorIdx = stringTable.getOrAdd(String(snake.color ?? ''));
    const headColIdx = stringTable.getOrAdd(String(snake.sc ?? ''));
    const hasCarriedChips = (snake.cc ?? 0) > 0;

    // flags: bit 0=isPlayer, bit 1=isBot, bit 2=boosting, bit 3=hasCarriedChips
    const snakeFlags: number =
      ((snake.ip ? 1 : 0) << 0) |
      ((snake.ib ? 1 : 0) << 1) |
      ((snake.bo ? 1 : 0) << 2) |
      (hasCarriedChips ? (1 << 3) : 0);

    const skinIdx = snake.si != null ? stringTable.getOrAdd(String(snake.si)) : 0xffff;
    const rarityIdx = snake.ra != null ? stringTable.getOrAdd(String(snake.ra)) : 0xffff;

    wb.writeU16(snakeIdIdx);
    wb.writeU16(nameIdx);
    wb.writeF32(snake.hx ?? 0);
    wb.writeF32(snake.hy ?? 0);
    wb.writeF32(snake.angle ?? 0);
    wb.writeU32(Math.trunc(snake.score ?? 0));

    // Always send colorIdx, headColIdx, bodyLen — order must match
    // the client binary parser in game-socket.ts exactly.
    wb.writeU16(colorIdx);
    wb.writeU16(headColIdx);
    wb.writeU16(snake.bl ?? 0);
    wb.writeU8(Math.round((snake.br ?? 1.2) * 10)); // bodyRadius * 10 for 0.1 precision
    wb.writeU8(snakeFlags);
    wb.writeU16(skinIdx);
    wb.writeU16(rarityIdx);

    if (hasCarriedChips) {
      wb.writeF32(snake.cc);
    }
  }

  // ── Food (stride 5) ───────────────────────────────────────────────────────

  for (let i = 0; i + 4 < foods.length; i += 5) {
    const x = Number(foods[i]) || 0;
    const y = Number(foods[i + 1]) || 0;
    const radius = Number(foods[i + 2]) || 1.5;
    const colorIdx = stringTable.getOrAdd(String(foods[i + 3] ?? ''));
    const magnetized = foods[i + 4] === 1 ? 1 : 0;

    wb.writeF32(x);
    wb.writeF32(y);
    wb.writeU8(RADIUS_TO_INDEX(radius));
    wb.writeU16(colorIdx);
    wb.writeU8(magnetized);
  }

  // ── Stars (stride 5) ──────────────────────────────────────────────────────

  for (let i = 0; i + 4 < stars.length; i += 5) {
    wb.writeF32(Number(stars[i]) || 0);       // x
    wb.writeF32(Number(stars[i + 1]) || 0);   // y
    // FIX O14: star value as f32 (was u16-clamped at 65535 — high-stakes
    // stars worth 80M+ chips were LABELED 65.5kc on the client while paying
    // their true value; 4 bytes/star keeps labels honest)
    wb.writeF32(Math.max(0, Number(stars[i + 2]) || 0));   // value
    wb.writeU16(Number(stars[i + 3]) || 0);   // id
    wb.writeU8(Number(stars[i + 4]) || 0);    // radius
  }

  // ── Minimap (stride 4) ────────────────────────────────────────────────────

  for (let i = 0; i + 3 < minimap.length; i += 4) {
    const mx = Number(minimap[i]) || 0;
    const my = Number(minimap[i + 1]) || 0;
    const mscore = Number(minimap[i + 2]) || 0;
    const misBot = minimap[i + 3] ? 1 : 0;

    // Compress coordinates to i16 using mapHalf
    const safeMapHalf = mapHalf > 0 ? mapHalf : 1;
    const cx = clampI16(Math.round((mx / safeMapHalf) * 32767));
    const cy = clampI16(Math.round((my / safeMapHalf) * 32767));

    wb.writeI16(cx);
    wb.writeI16(cy);
    // FIX H8: clamp score to u16 range. Ranked bots carry up to 100K score;
    // writeU16 silently wraps (v & 0xffff), so a 70,000 score displayed as
    // 4,464 on every client minimap. Clamp instead of wrap.
    wb.writeU16(Math.max(0, Math.min(65535, Math.trunc(mscore))));
    wb.writeU8(misBot);
  }

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    buffer: wb.toBuffer(),
    newStrings,
  };
}
