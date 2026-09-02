// Venom Arena — Binary WebSocket Protocol Definition

// ── Opcodes (u8) ──────────────────────────────────────────────────────────────

export const OP = {
  AUTH: 0x01,
  AUTH_OK: 0x02,
  AUTH_FAIL: 0x03,

  JOIN: 0x10,
  JOINED: 0x11,
  JOIN_ERROR: 0x12,

  INPUT: 0x20,
  SNAPSHOT: 0x21,

  EXTRACT: 0x30,
  KILLED: 0x31,
  MATCH_END: 0x32,
  EXTRACT_FAIL: 0x33,
  ERROR: 0x34,

  CUSTOM_SKIN: 0x40,
  STRING_TABLE: 0x41,

  STATS_REQ: 0x50,
  STATS_RESP: 0x51,

  // FIX H5: heartbeat. Client pings every 10s; server pongs immediately.
  // Lets the server detect ghost (backgrounded) connections via activity
  // timestamps, and lets the client detect zombie sockets (OPEN but dead).
  PING: 0x60,
  PONG: 0x61,
} as const;

// ── StringTable ───────────────────────────────────────────────────────────────

/** Maps strings to u16 indices for compact binary encoding. */
export class StringTable {
  strings: string[] = [];
  private _index: Map<string, number> = new Map();

  /** Food radius lookup table: index → actual radius value */
  static FOOD_RADII_LOOKUP = [1.5, 2.0, 3.0];

  /** Reverse lookup: radius value → index (returns 0 if not found) */
  static RADIUS_TO_INDEX(r: number): number {
    const idx = StringTable.FOOD_RADII_LOOKUP.indexOf(r);
    return idx >= 0 ? idx : 0;
  }

  /** Return existing index for a string, or assign a new one. */
  getOrAdd(str: string): number {
    const existing = this._index.get(str);
    if (existing !== undefined) return existing;
    const idx = this.strings.length;
    this.strings.push(str);
    this._index.set(str, idx);
    return idx;
  }

  /** Return string at index, or empty string if out of bounds. */
  get(idx: number): string {
    return idx >= 0 && idx < this.strings.length ? this.strings[idx] : '';
  }

  /** Encode a STRING_TABLE delta message containing only the given new indices. */
  encodeDelta(newIndices: number[]): ArrayBuffer {
    const wb = new WriteBuffer(2 + newIndices.length * 3); // OP + count + avg string
    wb.writeU8(OP.STRING_TABLE);
    wb.writeU16(newIndices.length);
    for (const idx of newIndices) {
      wb.writeU16(idx);
      const str = this.strings[idx] ?? '';
      wb.writeStringWithLen(str);
    }
    return wb.toBuffer();
  }
}

// ── WriteBuffer ───────────────────────────────────────────────────────────────

/** Growable binary buffer for building protocol messages. */
export class WriteBuffer {
  private buf: ArrayBuffer;
  private view: DataView;
  private u8: Uint8Array;
  private pos: number;

  constructor(initialCapacity = 256) {
    this.buf = new ArrayBuffer(initialCapacity);
    this.view = new DataView(this.buf);
    this.u8 = new Uint8Array(this.buf);
    this.pos = 0;
  }

  private _ensure(needed: number): void {
    if (this.pos + needed <= this.buf.byteLength) return;
    let newCap = this.buf.byteLength;
    while (newCap < this.pos + needed) newCap *= 2;
    const newBuf = new ArrayBuffer(newCap);
    const newU8 = new Uint8Array(newBuf);
    newU8.set(this.u8);
    this.buf = newBuf;
    this.view = new DataView(newBuf);
    this.u8 = newU8;
  }

  reset(): void {
    this.pos = 0;
  }

  writeU8(v: number): this {
    this._ensure(1);
    this.view.setUint8(this.pos, v & 0xff);
    this.pos += 1;
    return this;
  }

  writeU16(v: number): this {
    this._ensure(2);
    this.view.setUint16(this.pos, v & 0xffff, true); // little-endian
    this.pos += 2;
    return this;
  }

  writeU32(v: number): this {
    this._ensure(4);
    this.view.setUint32(this.pos, v >>> 0, true);
    this.pos += 4;
    return this;
  }

  writeI16(v: number): this {
    this._ensure(2);
    this.view.setInt16(this.pos, v, true);
    this.pos += 2;
    return this;
  }

  writeF32(v: number): this {
    this._ensure(4);
    this.view.setFloat32(this.pos, v, true);
    this.pos += 4;
    return this;
  }

  /** Write raw UTF-8 bytes (no length prefix — caller handles length). */
  writeString(str: string): this {
    const bytes = new TextEncoder().encode(str);
    this._ensure(bytes.length);
    this.u8.set(bytes, this.pos);
    this.pos += bytes.length;
    return this;
  }

  /** Write u8 length prefix then UTF-8 bytes. */
  writeStringWithLen(str: string): this {
    const bytes = new TextEncoder().encode(str);
    this._ensure(1 + bytes.length);
    this.view.setUint8(this.pos, bytes.length & 0xff);
    this.pos += 1;
    this.u8.set(bytes, this.pos);
    this.pos += bytes.length;
    return this;
  }

  toBuffer(): ArrayBuffer {
    return this.buf.slice(0, this.pos);
  }

  byteLength(): number {
    return this.pos;
  }
}

// ── WSPlayerConnection ────────────────────────────────────────────────────────

/**
 * Wraps a Bun WebSocket to provide a `.emit(event, data)` drop-in API.
 * The game server's existing `player.socket.emit('snapshot', data)` calls
 * continue to work, but now encode to binary instead of JSON.
 */
export class WSPlayerConnection {
  ws: any; // Bun WebSocket
  id: string;
  stringTable: StringTable;
  private _alive = true;

  constructor(ws: any, id: string) {
    this.ws = ws;
    this.id = id;
    this.stringTable = new StringTable();
  }

  get alive(): boolean {
    return this._alive && this.ws.readyState === 1;
  }

  /** Drop-in replacement for socket.io's .emit() */
  emit(event: string, data?: any): void {
    if (!this.alive) return;
    switch (event) {
      case 'snapshot':
        this._sendSnapshot(data);
        break;
      case 'joined':
        this._sendJoined(data);
        break;
      case 'killed':
        this._sendKilled(data);
        break;
      case 'matchEnd':
        this._sendMatchEnd(data);
        break;
      case 'error':
        this._sendError(data);
        break;
      case 'customSkin':
        this._sendCustomSkin(data);
        break;
      case 'extractFailed':
        this._sendExtractFailed(data);
        break;
      default:
        console.warn('[WSConn] Unknown event:', event);
    }
  }

  // ── Private send methods ──────────────────────────────────────────────────

  private _sendSnapshot(data: any): void {
    try {
      // Dynamic import to avoid circular dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { encodeSnapshot } = require('./snapshot-encoder') as typeof import('./snapshot-encoder');
      const { buffer, newStrings } = encodeSnapshot(data, this.stringTable);

      // Send STRING_TABLE delta first if there are new strings
      if (newStrings.length > 0) {
        const delta = this.stringTable.encodeDelta(newStrings);
        this.send(delta);
      }

      this.send(buffer);
    } catch (e) {
      console.error('[WSConn] Failed to encode snapshot:', e);
    }
  }

  private _sendJoined(data: any): void {
    const wb = new WriteBuffer(64);
    const snakeId: string = data.snakeId ?? '';
    const mapHalf: number = data.config?.mapHalf ?? 2000;

    // Register strings in stringTable
    this.stringTable.getOrAdd(snakeId);
    this.stringTable.getOrAdd(String(mapHalf));

    wb.writeU8(OP.JOINED);
    wb.writeStringWithLen(snakeId);
    wb.writeF32(mapHalf);

    this.send(wb.toBuffer());
  }

  private _sendKilled(data: any): void {
    const wb = new WriteBuffer(128);
    const killerName: string = data.killerName ?? '';
    const killerIsBot: boolean = data.killerIsBot ?? false;
    const killerTag: string = data.killerTag ?? '';

    // flags bit 0: killerIsBot
    const flags: number = killerIsBot ? 0x01 : 0x00;

    // Field order MUST match the client parser (game-socket.ts handleKilled):
    //   killerName → killerTag (ALWAYS written, may be empty) → flags
    wb.writeU8(OP.KILLED);
    wb.writeStringWithLen(killerName);
    wb.writeStringWithLen(killerTag);
    wb.writeU8(flags);

    this.send(wb.toBuffer());
  }

  private _sendMatchEnd(data: any): void {
    const wb = new WriteBuffer(128);
    const outcome: string = data.outcome ?? 'death';
    const score: number = data.score ?? 0;
    const kills: number = data.kills ?? 0;
    const duration: number = data.durationSeconds ?? 0;

    wb.writeU8(OP.MATCH_END);

    if (outcome === 'extract') {
      // Extract outcome
      const carriedChips: number = data.carriedChips ?? 0;
      const commission: number = data.commission ?? 0;
      const bankedAmount: number = data.bankedAmount ?? 0;
      const chipsEarned: number = data.chipsEarned ?? 0;

      wb.writeU8(0x01); // outcome = extract
      wb.writeU32(score);
      wb.writeU16(kills);
      wb.writeU32(duration);
      wb.writeF32(carriedChips);
      wb.writeF32(commission);
      wb.writeF32(bankedAmount);
      wb.writeF32(chipsEarned);
    } else {
      // Death outcome
      const reason: string = data.reason ?? '';
      const killerTag: string = data.killerTag ?? '';
      const killerIsBot: boolean = data.killerIsBot ?? false;
      const chipsLost: number = data.chipsLost ?? 0;

      wb.writeU8(0x00); // outcome = death
      wb.writeU32(score);
      wb.writeU16(kills);
      wb.writeU32(duration);
      wb.writeStringWithLen(reason);
      wb.writeStringWithLen(killerTag);
      // flags bit 0: killerIsBot — MUST reflect the real value (client reads it)
      wb.writeU8(killerIsBot ? 0x01 : 0x00);
      wb.writeF32(chipsLost);
    }

    this.send(wb.toBuffer());
  }

  private _sendError(data: any): void {
    const wb = new WriteBuffer(256);
    const message: string = data.message ?? 'Unknown error';

    wb.writeU8(OP.ERROR);
    wb.writeStringWithLen(message);

    this.send(wb.toBuffer());
  }

  private _sendCustomSkin(data: any): void {
    const wb = new WriteBuffer(1024);
    const snakeId: string = data.snakeId ?? '';
    const skinId: string = data.skinId ?? '';
    const skinData: any = data.data ?? {};

    // Serialize skin data as JSON string
    const jsonStr: string = JSON.stringify(skinData);
    const jsonBytes = new TextEncoder().encode(jsonStr);

    wb.writeU8(OP.CUSTOM_SKIN);
    wb.writeStringWithLen(snakeId);
    wb.writeStringWithLen(skinId);
    wb.writeU16(jsonBytes.length);
    wb.writeString(jsonStr);

    this.send(wb.toBuffer());
  }

  private _sendExtractFailed(data: any): void {
    const wb = new WriteBuffer(256);
    const reason: string = data.reason ?? 'Extraction failed';

    wb.writeU8(OP.EXTRACT_FAIL);
    wb.writeStringWithLen(reason);

    this.send(wb.toBuffer());
  }

  /** Send raw binary buffer (for STRING_TABLE deltas, etc.) */
  send(buf: ArrayBuffer): void {
    if (this.alive) {
      try {
        this.ws.send(buf);
      } catch {}
    }
  }

  disconnect(_force?: boolean): void {
    this.close();
  }

  close(): void {
    this._alive = false;
    try {
      this.ws.close();
    } catch {}
  }
}
