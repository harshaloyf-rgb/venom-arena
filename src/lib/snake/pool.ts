// ============================================================================
// Venom Arena — Object Pools & Path Buffer
// Zero-allocation data structures for the server tick loop.
// Pre-allocated typed arrays. No GC pressure in hot path.
// ============================================================================

// ── Path Buffer ──────────────────────────────────────────────────────────────
// Stores snake body path as a circular Float32Array (stride 3: x, y, angle).
// prepend() and trimTail() are O(1). No array allocation in hot path.

export class PathBuffer {
  private data: Float32Array;
  private start: number = 0;
  private count: number = 0;
  readonly capacity: number;
  private static readonly STRIDE = 3;

  constructor(maxPoints: number) {
    this.capacity = maxPoints;
    this.data = new Float32Array(maxPoints * PathBuffer.STRIDE);
  }

  /** Current number of valid points */
  get length(): number { return this.count; }

  /** Get x of point i (0 = head) */
  getX(i: number): number {
    return this.data[((this.start + i) % this.capacity) * PathBuffer.STRIDE];
  }

  /** Get y of point i */
  getY(i: number): number {
    return this.data[((this.start + i) % this.capacity) * PathBuffer.STRIDE + 1];
  }

  /** Get angle of point i */
  getAngle(i: number): number {
    return this.data[((this.start + i) % this.capacity) * PathBuffer.STRIDE + 2];
  }

  /** Get x and y of last point (tail). Zero-alloc. */
  tailX(): number {
    if (this.count === 0) return 0;
    return this.getX(this.count - 1);
  }

  /** Get y of last point (tail). Zero-alloc. */
  tailY(): number {
    if (this.count === 0) return 0;
    return this.getY(this.count - 1);
  }

  /**
   * Prepend a new head point. O(1). Zero allocation.
   * The new point becomes index 0 (head).
   */
  prepend(x: number, y: number, angle: number): void {
    this.start = (this.start - 1 + this.capacity) % this.capacity;
    const idx = this.start * PathBuffer.STRIDE;
    this.data[idx] = x;
    this.data[idx + 1] = y;
    this.data[idx + 2] = angle;
    if (this.count < this.capacity) this.count++;
  }

  /**
   * Trim N points from the tail. O(1). Zero allocation.
   * IMPORTANT: In this circular buffer, `start` points to the HEAD (index 0).
   * The tail is at index (count-1). To trim the tail, we only decrement count.
   * We must NOT change `start` — that would trim the HEAD instead.
   */
  trimTail(n: number): void {
    const trim = Math.min(n, this.count);
    // Only shrink the window — do NOT move start (that would trim head!)
    this.count = Math.max(0, this.count - trim);
  }

  /** Reset the buffer to empty. */
  reset(): void {
    this.start = 0;
    this.count = 0;
  }

  /**
   * Fill with initial straight-line path (for spawning).
   * Head at index 0, tail at index count-1.
   */
  fillInitial(headX: number, headY: number, angle: number, count: number, spacing: number): void {
    this.reset();
    const actualCount = Math.min(count, this.capacity);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let i = 0; i < actualCount; i++) {
      const bufIdx = ((this.capacity - actualCount + i) % this.capacity) * PathBuffer.STRIDE;
      this.data[bufIdx] = headX - cos * i * spacing;
      this.data[bufIdx + 1] = headY - sin * i * spacing;
      this.data[bufIdx + 2] = angle;
    }
    this.start = (this.capacity - actualCount) % this.capacity;
    this.count = actualCount;
  }

  /**
   * Downsample path into pre-allocated Float32Arrays for network snapshots.
   * Returns the number of points written.
   */
  downsample(outX: Float32Array, outY: Float32Array, maxPoints: number): number {
    if (this.count === 0) return 0;
    const step = Math.max(1, Math.floor(this.count / maxPoints));
    let written = 0;
    for (let i = 0; i < this.count && written < maxPoints; i += step) {
      outX[written] = this.getX(i);
      outY[written] = this.getY(i);
      written++;
    }
    // Always include the last point (tail)
    if (written > 0 && written < maxPoints) {
      const lastIdx = this.count - 1;
      outX[written] = this.getX(lastIdx);
      outY[written] = this.getY(lastIdx);
      written++;
    }
    return written;
  }

  /**
   * Compute max path points from config.
   * Call this once to determine PathBuffer capacity.
   */
  static maxPathPoints(maxScore: number, ptsPerSegment: number, segSpacing: number): number {
    return Math.ceil((maxScore * ptsPerSegment) / segSpacing) + 50;
  }
}

// ── Generic Object Pool ─────────────────────────────────────────────────────
// Reuses objects to avoid GC pressure. Not for the innermost math
// (that uses typed arrays), but for FoodOrb, StarChip, etc.

export class ObjectPool<T> {
  private free: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 0) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) {
      this.free.push(factory());
    }
  }

  /** Acquire an object from the pool (or create new if empty) */
  acquire(): T {
    return this.free.length > 0 ? this.free.pop()! : this.factory();
  }

  /** Release an object back to the pool */
  release(obj: T): void {
    this.reset(obj);
    this.free.push(obj);
  }

  /** Release multiple objects */
  releaseAll(objs: T[]): void {
    for (let i = 0; i < objs.length; i++) {
      this.reset(objs[i]);
      this.free.push(objs[i]);
    }
  }

  /** Number of available objects in the pool */
  get available(): number { return this.free.length; }
}

// ── Scratch Vec2 (reusable, avoids allocation in tight loops) ────────────────
// NOT thread-safe. Only use in sequential single-snake processing.

export const scratchVec2 = { x: 0, y: 0 };

// ── Pre-allocated Float32Array for snapshot downsampling ─────────────────────
// Reuse across all snakes in an arena to avoid per-snake allocation.

export class SnapshotBufferPool {
  private xBuffers: Float32Array[] = [];
  private yBuffers: Float32Array[] = [];
  private size: number;
  private idx = 0;

  constructor(maxSnakes: number, pointsPerSnake: number) {
    this.size = maxSnakes;
    for (let i = 0; i < maxSnakes; i++) {
      this.xBuffers.push(new Float32Array(pointsPerSnake));
      this.yBuffers.push(new Float32Array(pointsPerSnake));
    }
  }

  /** Get the next buffer pair for downsampling */
  acquire(): { x: Float32Array; y: Float32Array } {
    const i = this.idx % this.size;
    this.idx++;
    return { x: this.xBuffers[i], y: this.yBuffers[i] };
  }

  /** Reset the acquisition index */
  resetIndex(): void { this.idx = 0; }
}
