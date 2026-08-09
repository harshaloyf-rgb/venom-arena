// ============================================================================
// Spatial Hash — High-performance grid-based spatial hash.
//
// Key optimizations:
//   1. Numeric cell keys (no string concatenation on insert)
//   2. Flat typed arrays per cell (no Set/Map per cell)
//   3. Count-based clear (no Map.clear() → no GC)
//   4. Pre-allocated scratch entity for query (minimal alloc)
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
    const minCx = ((entity.x - r) * inv) | 0;
    const maxCx = ((entity.x + r) * inv) | 0;
    const minCy = ((entity.y - r) * inv) | 0;
    const maxCy = ((entity.y + r) * inv) | 0;

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

  /** Query all entities within a given radius of a point */
  query(x: number, y: number, radius: number): SpatialEntity[] {
    const inv = this.invCellSize;
    const minCx = ((x - radius) * inv) | 0;
    const maxCx = ((x + radius) * inv) | 0;
    const minCy = ((y - radius) * inv) | 0;
    const maxCy = ((y + radius) * inv) | 0;

    const result: SpatialEntity[] = [];
    const map = this.cellMap;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.toCellKey(cx, cy);
        const cell = map.get(key);
        if (!cell) continue;

        const count = cell.count;
        for (let i = 0; i < count; i++) {
          const dx = cell.xs[i] - x;
          const dy = cell.ys[i] - y;
          const threshold = radius + cell.rs[i];
          if (dx * dx + dy * dy <= threshold * threshold) {
            result.push({ x: cell.xs[i], y: cell.ys[i], radius: cell.rs[i], id: cell.ids[i] });
          }
        }
      }
    }

    return result;
  }

  /** Clear all entities — reset counts and prune empty cells to prevent unbounded memory growth */
  clear(): void {
    for (const [key, cell] of this.cellMap) {
      if (cell.count === 0) {
        this.cellMap.delete(key);
      } else {
        cell.count = 0;
      }
    }
  }

  /** Rebuild the hash from scratch with a new set of entities */
  rebuild(entities: SpatialEntity[]): void {
    this.clear();
    for (let i = 0; i < entities.length; i++) {
      this.insert(entities[i]);
    }
  }
}
