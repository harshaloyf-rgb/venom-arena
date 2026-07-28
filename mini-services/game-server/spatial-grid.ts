// ============================================================================
// spatial-grid.ts — Spatial hash grid for O(n)-ish collision & food queries.
// ----------------------------------------------------------------------------
// The OLD server ran an O(n²×m) nested loop every tick (every snake head vs
// every other snake's every body segment) which produced ~220M ops/sec at
// peak. This grid gives O(1) cell lookups so a head-vs-world query touches
// only ~9–25 nearby items. The grid is cleared and rebuilt once per tick
// (cheap: ~1000 items/arena × constant cells each). Mid-tick mutations use
// the `value=0` sentinel for food instead of removing items, so we never
// mutate a Map while iterating it.
// ============================================================================

export type GridItemKind = 'segment' | 'food';

/** A single spatial entry. Either a snake body segment or a food pellet. */
export interface GridItem {
  /** Stable unique id within this tick's grid (e.g. `${snakeId}:${segIdx}` or food id). */
  id: string;
  kind: GridItemKind;
  x: number;
  y: number;
  radius: number;
  /** Owning snake id when kind === 'segment'. */
  snakeId?: string;
  /** Segment index within the owning snake (0 = head). Used to skip head-to-head collisions. */
  segIdx?: number;
  /** Food value when kind === 'food'. Set to 0 as a "eaten" sentinel mid-tick. */
  value?: number;
  isStarChip?: boolean;
  color?: string;
  /** Reference to the actual Food object in room.foods, so eatFood can
   *  zero the REAL value (not just this grid copy) and replenishFood can
   *  filter it out. Without this, eaten food reappears every tick. */
  foodRef?: { value: number };
}

/**
 * SpatialHashGrid — buckets items into square cells of `cellSize` pixels.
 * An item is inserted into every cell its bounding circle overlaps, so a
 * query only needs to scan the cells under its query bounding box.
 */
export class SpatialHashGrid {
  private readonly cellSize: number;
  /** cellKey → (itemId → item). Using nested Maps for O(1) add/remove. */
  private readonly cells: Map<string, Map<string, GridItem>> = new Map();

  /**
   * @param cellSize Pixel size of each cell. ~120px is a good trade-off for
   *   a 6000px world with snake sizes ~8–20 and food sizes ~5–10: most
   *   queries touch only the 3×3 block around the query point.
   */
  constructor(cellSize = 120) {
    this.cellSize = cellSize;
  }

  private cellKey(cx: number, cy: number): string {
    return cx + ':' + cy;
  }

  /** Empty every cell. Called at the start of each tick before re-populating. */
  clear(): void {
    this.cells.clear();
  }

  /**
   * Insert an item into every cell its bounding circle overlaps.
   * The same item id may be referenced from multiple cells; that's expected.
   */
  insert(item: GridItem): void {
    const minCx = Math.floor((item.x - item.radius) / this.cellSize);
    const maxCx = Math.floor((item.x + item.radius) / this.cellSize);
    const minCy = Math.floor((item.y - item.radius) / this.cellSize);
    const maxCy = Math.floor((item.y + item.radius) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.cellKey(cx, cy);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = new Map();
          this.cells.set(key, bucket);
        }
        bucket.set(item.id, item);
      }
    }
  }

  /**
   * Return all items whose bounding circle could intersect the query circle.
   * The caller MUST do precise distance checks — this only narrows the
   * candidate set. Returns a fresh Map keyed by item id (so the same item
   * referenced from multiple cells is deduplicated).
   */
  queryRadius(x: number, y: number, r: number): Map<string, GridItem> {
    const out = new Map<string, GridItem>();
    const minCx = Math.floor((x - r) / this.cellSize);
    const maxCx = Math.floor((x + r) / this.cellSize);
    const minCy = Math.floor((y - r) / this.cellSize);
    const maxCy = Math.floor((y + r) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(this.cellKey(cx, cy));
        if (!bucket) continue;
        for (const [id, item] of bucket) {
          if (!out.has(id)) out.set(id, item);
        }
      }
    }
    return out;
  }
}
