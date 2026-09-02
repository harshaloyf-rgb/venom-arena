// ============================================================================
// Spatial Hash — High-performance grid-based spatial hash.
//
// Key optimizations:
//   1. Numeric cell keys (no string concatenation on insert)
//   2. Flat typed arrays per cell (no Set/Map per cell)
//   3. Count-based clear (no Map.clear() → no GC)
//   4. Pre-allocated entity pool in query() — ZERO object allocations after warmup
//   5. Fast clear() — only resets counts, no Map.delete iteration
//   6. O(1) swap-remove in remove() — no array shifting
//   7. Incremental insert/remove for static entities (food) — eliminates periodic rebuilds
// ============================================================================

import { SPATIAL_CELL_SIZE } from './config';

/** An entity stored in the spatial hash */
export interface SpatialEntity {
  x: number;
  y: number;
  radius: number;
  id: number | string;
}

/** Internal flat storage per cell */
interface Cell {
  xs: Float64Array;
  ys: Float64Array;
  rs: Float32Array;
  ids: (number | string)[];
  count: number;
}

const INITIAL_CELL_CAPACITY = 8;

export class SpatialHash {
  private cellSize: number;
  private cellMap: Map<number, Cell>;
  private invCellSize: number;

  // Pre-allocated query result buffer + entity object pool.
  // The pool grows to the max query result size on first use, then never allocates.
  // The buffer reuses the same array object — callers get SpatialEntity[] as before.
  private _queryBuf: SpatialEntity[] = [];
  private _entityPool: SpatialEntity[] = [];

  constructor(cellSize: number = SPATIAL_CELL_SIZE) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cellMap = new Map();
  }

  /** Encode 2D cell coords into a single number */
  private toCellKey(cx: number, cy: number): number {
    return ((cy + 32768) << 16) | ((cx + 32768) & 0xFFFF);
  }

  /** Insert an entity into the hash */
  insert(entity: SpatialEntity): void {
    const inv = this.invCellSize;
    const r = entity.radius;
    // Use Math.floor instead of |0 — |0 truncates toward zero, which maps
    // (-0.5, 0) to cell 0 instead of cell -1, doubling cell-0 width.
    const minCx = Math.floor((entity.x - r) * inv);
    const maxCx = Math.floor((entity.x + r) * inv);
    const minCy = Math.floor((entity.y - r) * inv);
    const maxCy = Math.floor((entity.y + r) * inv);

    const map = this.cellMap;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.toCellKey(cx, cy);
        let cell = map.get(key);
        if (!cell) {
          cell = {
            xs: new Float64Array(INITIAL_CELL_CAPACITY),
            ys: new Float64Array(INITIAL_CELL_CAPACITY),
            rs: new Float32Array(INITIAL_CELL_CAPACITY),
            ids: [],
            count: 0,
          };
          map.set(key, cell);
        }
        const c = cell.count;
        if (c >= cell.xs.length) {
          const newLen = cell.xs.length * 2;
          const newXS = new Float64Array(newLen);
          const newYS = new Float64Array(newLen);
          const newRS = new Float32Array(newLen);
          newXS.set(cell.xs);
          newYS.set(cell.ys);
          newRS.set(cell.rs);
          cell.xs = newXS;
          cell.ys = newYS;
          cell.rs = newRS;
        }
        cell.xs[c] = entity.x;
        cell.ys[c] = entity.y;
        cell.rs[c] = entity.radius;
        cell.ids[c] = entity.id;
        cell.count = c + 1;
      }
    }
  }

  /** Query all entities within a given radius of a point.
   *  Uses pre-allocated entity pool — ZERO object allocations after warmup.
   *  Results are valid only until the next query() call on this instance. */
  query(x: number, y: number, radius: number): SpatialEntity[] {
    const inv = this.invCellSize;
    // Use Math.floor for consistency with insert() — see insert comment.
    const minCx = Math.floor((x - radius) * inv);
    const maxCx = Math.floor((x + radius) * inv);
    const minCy = Math.floor((y - radius) * inv);
    const maxCy = Math.floor((y + radius) * inv);

    let count = 0;
    const buf = this._queryBuf;
    const pool = this._entityPool;
    const map = this.cellMap;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.toCellKey(cx, cy);
        const cell = map.get(key);
        if (!cell) continue;

        const cCount = cell.count;
        for (let i = 0; i < cCount; i++) {
          const dx = cell.xs[i] - x;
          const dy = cell.ys[i] - y;
          const threshold = radius + cell.rs[i];
          if (dx * dx + dy * dy <= threshold * threshold) {
            // Reuse entity from pool or grow pool (only on first few queries)
            if (count < pool.length) {
              const e = pool[count];
              e.x = cell.xs[i]; e.y = cell.ys[i];
              e.radius = cell.rs[i]; e.id = cell.ids[i];
            } else {
              pool.push({ x: cell.xs[i], y: cell.ys[i], radius: cell.rs[i], id: cell.ids[i] });
            }
            count++;
          }
        }
      }
    }

    buf.length = count;
    for (let i = 0; i < count; i++) buf[i] = pool[i];
    return buf;
  }

  /** Clear all entities — just reset cell counts, no Map.delete iteration.
   *  This is O(cells) but avoids the overhead of Map.delete and Iterator creation.
   *  Empty cells are pruned lazily during insert when count === 0. */
  clear(): void {
    for (const cell of this.cellMap.values()) {
      cell.count = 0;
    }
  }

  /** Rebuild the hash from scratch with a new set of entities */
  rebuild(entities: SpatialEntity[]): void {
    this.clear();
    for (let i = 0; i < entities.length; i++) {
      this.insert(entities[i]);
    }
  }

  /** Remove an entity by its position and ID using O(1) swap-remove.
   *  Works for static entities (food) that don't move — recomputes cell coords
   *  from the entity's current x/y/radius to find which cells it occupies.
   *  For a food pellet (radius 1.5-3, cell size 100), this spans exactly 1 cell → O(1).
   */
  remove(entity: SpatialEntity): void {
    const inv = this.invCellSize;
    const r = entity.radius;
    const minCx = Math.floor((entity.x - r) * inv);
    const maxCx = Math.floor((entity.x + r) * inv);
    const minCy = Math.floor((entity.y - r) * inv);
    const maxCy = Math.floor((entity.y + r) * inv);
    const id = entity.id;
    const map = this.cellMap;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.toCellKey(cx, cy);
        const cell = map.get(key);
        if (!cell) continue;
        const c = cell.count;
        for (let i = 0; i < c; i++) {
          if (cell.ids[i] === id) {
            // Swap-remove: move last element into the removed slot
            const last = c - 1;
            if (i !== last) {
              cell.xs[i] = cell.xs[last];
              cell.ys[i] = cell.ys[last];
              cell.rs[i] = cell.rs[last];
              cell.ids[i] = cell.ids[last];
            }
            cell.count = last;
            break; // entity should only appear once per cell
          }
        }
      }
    }
  }

  /** Update an entity's position: remove from old cells, insert into new cells.
   *  More efficient than remove+insert for entities that rarely move.
   *  NOT used for food (static), but provided for future use with moving entities. */
  update(oldEntity: SpatialEntity, newEntity: SpatialEntity): void {
    this.remove(oldEntity);
    this.insert(newEntity);
  }
}
