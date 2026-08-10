/**
 * Zero-allocation object pool system for the snake game engine.
 *
 * Hot paths (PathBuffer prepend/pop/getX/getY) never allocate.
 *
 * @module pool
 */

// ─── IPathBuffer ────────────────────────────────────────────────────────────

/** Minimal read/write contract for snake path history. */
export interface IPathBuffer {
  /** Number of active segments (≤ capacity). */
  readonly length: number;
  /** X coordinate of segment at logical index `i` (0 = head). */
  getX(i: number): number;
  /** Y coordinate of segment at logical index `i` (0 = head). */
  getY(i: number): number;
  /** Set X coordinate of segment at logical index `i` (0 = head). */
  setX(i: number, x: number): void;
  /** Set Y coordinate of segment at logical index `i` (0 = head). */
  setY(i: number, y: number): void;
  /** X coordinate of the head (most recent segment). */
  readonly headX: number;
  /** Y coordinate of the head (most recent segment). */
  readonly headY: number;
  /** Prepend a new head segment. */
  prepend(x: number, y: number): void;
  /** Append a segment at the tail (growth). */
  appendTail(x: number, y: number): void;
  /** Remove the tail segment. */
  pop(): void;
  /** Clear all segments without reallocating. */
  clear(): void;
  /** Trim tail to at most `maxLength` segments (O(1)). */
  trimTo(maxLength: number): void;
}

// ─── PathBuffer ─────────────────────────────────────────────────────────────

/**
 * Circular `Float32Array` buffer storing snake path history.
 *
 * Layout: `data = Float32Array [x0, y0, x1, y1, …]`
 * Logical index 0 = head (most recent), index N‑1 = tail.
 * `headSegIdx` is the circular index of the head segment in the buffer.
 *
 * **Zero-allocation guarantee**: `prepend`, `pop`, `getX`, `getY`, and all
 * getters perform no object allocation — they operate directly on the
 * underlying typed array.
 */
export class PathBuffer implements IPathBuffer {
  /** Raw float buffer. Capacity × 2 elements (interleaved x, y). */
  data: Float32Array;
  /** Maximum number of segments this buffer can hold. */
  capacity: number;
  /** Current active segment count (≤ capacity). */
  length = 0;
  /** Circular index of the head segment. */
  headSegIdx = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * 2);
  }

  /** O(1) head insertion. Moves headSegIdx backward (wrapping), writes x/y, grows buffer if needed. */
  prepend(x: number, y: number): void {
    if (this.length >= this.capacity) this.grow();
    this.headSegIdx = (this.headSegIdx - 1 + this.capacity) % this.capacity;
    const base = this.headSegIdx * 2;
    this.data[base] = x;
    this.data[base + 1] = y;
    this.length++;
  }

  /** Direct float access — no object creation. Returns 0 if out of range. */
  getX(index: number): number {
    if (index < 0 || index >= this.length) return 0;
    return this.data[((this.headSegIdx + index) % this.capacity) * 2];
  }

  /** Direct float access — no object creation. Returns 0 if out of range. */
  getY(index: number): number {
    if (index < 0 || index >= this.length) return 0;
    return this.data[((this.headSegIdx + index) % this.capacity) * 2 + 1];
  }

  /** X coordinate of the head segment. */
  get headX(): number {
    return this.data[this.headSegIdx * 2];
  }

  /** Y coordinate of the head segment. */
  get headY(): number {
    return this.data[this.headSegIdx * 2 + 1];
  }

  /** Set X of segment at logical index `i`. Zero-alloc. */
  setX(index: number, x: number): void {
    if (index < 0 || index >= this.length) return;
    this.data[((this.headSegIdx + index) % this.capacity) * 2] = x;
  }

  /** Set Y of segment at logical index `i`. Zero-alloc. */
  setY(index: number, y: number): void {
    if (index < 0 || index >= this.length) return;
    this.data[((this.headSegIdx + index) % this.capacity) * 2 + 1] = y;
  }

  /** Append a segment at the tail end (logical index = length). Used for growth. */
  appendTail(x: number, y: number): void {
    if (this.length >= this.capacity) this.grow();
    const physIdx = (this.headSegIdx + this.length) % this.capacity;
    this.data[physIdx * 2] = x;
    this.data[physIdx * 2 + 1] = y;
    this.length++;
  }

  /** O(1) tail removal. Decrements length; stale data is left in place. */
  pop(): void {
    if (this.length > 0) this.length--;
  }

  /** Clear all segments without reallocating. headSegIdx is preserved. */
  clear(): void {
    this.length = 0;
  }

  /** Trim the tail to at most `maxLength` segments.
   *  O(1) — just decrements length; stale data left in place.
   *  Prevents unbounded path growth for long-lived snakes. */
  trimTo(maxLength: number): void {
    if (this.length > maxLength) {
      this.length = maxLength;
    }
  }

  /** Reset to a single segment at (x, y). Resets headSegIdx to 0. */
  resetTo(x: number, y: number): void {
    this.length = 1;
    this.headSegIdx = 0;
    this.data[0] = x;
    this.data[1] = y;
  }

  /**
   * Double the capacity, copying existing data in logical order.
   * This is the **only** allocation point and should rarely be called.
   */
  grow(): void {
    const newCap = this.capacity * 2;
    const newData = new Float32Array(newCap * 2);
    for (let i = 0; i < this.length; i++) {
      const srcBase = ((this.headSegIdx + i) % this.capacity) * 2;
      const dstBase = i * 2;
      newData[dstBase] = this.data[srcBase];
      newData[dstBase + 1] = this.data[srcBase + 1];
    }
    this.data = newData;
    this.capacity = newCap;
    this.headSegIdx = 0;
  }

  /** Grow the buffer if `needed` exceeds current capacity. */
  ensureCapacity(needed: number): void {
    while (this.capacity < needed) this.grow();
  }
}

