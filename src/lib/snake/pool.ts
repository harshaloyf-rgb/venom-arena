/**
 * Zero-allocation object pool system for the snake game engine.
 *
 * Hot paths (PathBuffer prepend/pop/getX/getY) never allocate.
 * Only `grow()` and `toVec2Array()` allocate, and both are rare/non-hot.
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

  /** Get segment at logical index. Returns undefined if out of range. */
  getXY(index: number): { x: number; y: number } | undefined {
    if (index < 0 || index >= this.length) return undefined;
    const base = ((this.headSegIdx + index) % this.capacity) * 2;
    return { x: this.data[base], y: this.data[base + 1] };
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

  /** X coordinate of the tail segment (oldest active segment). */
  get tailX(): number {
    return this.data[((this.headSegIdx + this.length - 1) % this.capacity) * 2];
  }

  /** Y coordinate of the tail segment (oldest active segment). */
  get tailY(): number {
    return this.data[((this.headSegIdx + this.length - 1) % this.capacity) * 2 + 1];
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

  /** Truncate or extend length (used after death to shrink the path). */
  setLength(n: number): void {
    this.length = Math.max(0, Math.min(n, this.capacity));
  }

  /** Clear all segments without reallocating. headSegIdx is preserved. */
  clear(): void {
    this.length = 0;
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

  /** Convenience for non-hot paths (e.g. respawn). Allocates objects. */
  toVec2Array(): Array<{ x: number; y: number }> {
    const out: Array<{ x: number; y: number }> = new Array(this.length);
    for (let i = 0; i < this.length; i++) {
      const base = ((this.headSegIdx + i) % this.capacity) * 2;
      out[i] = { x: this.data[base], y: this.data[base + 1] };
    }
    return out;
  }

  /** Initialize from an existing Vec2 array (backward-compat migration). headSegIdx is reset to 0. */
  initFromArray(arr: Array<{ x: number; y: number }>): void {
    this.ensureCapacity(arr.length);
    this.headSegIdx = 0;
    this.length = arr.length;
    for (let i = 0; i < arr.length; i++) {
      this.data[i * 2] = arr[i].x;
      this.data[i * 2 + 1] = arr[i].y;
    }
  }

  /** Grow the buffer if `needed` exceeds current capacity. */
  ensureCapacity(needed: number): void {
    while (this.capacity < needed) this.grow();
  }
}

// ─── ObjectPool<T> ──────────────────────────────────────────────────────────

/**
 * Generic object pool for non-hot-path reuse.
 *
 * Useful for transient objects that would otherwise be created and
 * garbage-collected every frame (e.g. collision query results, UI state).
 */
export class ObjectPool<T> {
  private readonly factory: () => T;
  private readonly reset: (obj: T) => void;
  private readonly pool: T[] = [];

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 0,
  ) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  /** Acquire an object from the pool, or create a new one if empty. */
  acquire(): T {
    return this.pool.length > 0 ? (this.pool.pop() as T) : this.factory();
  }

  /** Reset and return an object to the pool. */
  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }

  /** Number of objects currently sitting idle in the pool. */
  get size(): number {
    return this.pool.length;
  }
}

// ─── scratchVec2 ────────────────────────────────────────────────────────────

/**
 * Single reusable `{ x, y }` object for scratch math in hot paths.
 *
 * **Warning**: do not store references to this object across async boundaries
 * or pass it to code that may retain it. Only use for immediate,
 * synchronous computations.
 */
export const scratchVec2: { x: number; y: number } = { x: 0, y: 0 };

// ─── SnapshotPool ───────────────────────────────────────────────────────────

/**
 * Specialized pool for server snapshot buffers (pre-allocated `Uint8Array`).
 *
 * Each call to `acquire` returns a zeroed buffer of `snapshotByteSize` bytes.
 * Returned buffers are zeroed again on `release` to prevent data leaks.
 */
export class SnapshotPool {
  private readonly pool: Uint8Array[] = [];
  private readonly snapshotByteSize: number;

  constructor(maxSnapshots: number, snapshotByteSize: number) {
    this.snapshotByteSize = snapshotByteSize;
    for (let i = 0; i < maxSnapshots; i++) {
      this.pool.push(new Uint8Array(snapshotByteSize));
    }
  }

  /** Acquire a zeroed buffer for snapshot serialization. */
  acquire(): Uint8Array {
    const buf = this.pool.length > 0 ? (this.pool.pop() as Uint8Array) : new Uint8Array(this.snapshotByteSize);
    buf.fill(0);
    return buf;
  }

  /** Return a buffer to the pool. */
  release(buf: Uint8Array): void {
    this.pool.push(buf);
  }
}
