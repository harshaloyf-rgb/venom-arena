// ============================================================================
// Spatial Hash — Grid-based spatial hash for O(1) collision queries.
// Handles 1200 food + 1000 snakes efficiently.
// ============================================================================

import { SPATIAL_CELL_SIZE } from './config';

/** An entity stored in the spatial hash */
export interface SpatialEntity {
  x: number;
  y: number;
  radius: number;
  id: number | string;
}

type CellKey = string;

export class SpatialHash {
  private cellSize: number;
  private cells: Map<CellKey, Set<SpatialEntity>>;

  constructor(cellSize: number = SPATIAL_CELL_SIZE) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  private toCellKey(cx: number, cy: number): CellKey {
    return `${cx},${cy}`;
  }

  /** Insert an entity into the hash */
  insert(entity: SpatialEntity): void {
    const r = entity.radius;
    const minCx = Math.floor((entity.x - r) / this.cellSize);
    const maxCx = Math.floor((entity.x + r) / this.cellSize);
    const minCy = Math.floor((entity.y - r) / this.cellSize);
    const maxCy = Math.floor((entity.y + r) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.toCellKey(cx, cy);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = new Set();
          this.cells.set(key, cell);
        }
        cell.add(entity);
      }
    }
  }

  /** Query all entities within a given radius of a point */
  query(x: number, y: number, radius: number): SpatialEntity[] {
    const result: SpatialEntity[] = [];
    const seen = new Set<SpatialEntity>();

    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.toCellKey(cx, cy);
        const cell = this.cells.get(key);
        if (!cell) continue;

        for (const entity of cell) {
          if (seen.has(entity)) continue;
          seen.add(entity);

          const dx = entity.x - x;
          const dy = entity.y - y;
          const distSq = dx * dx + dy * dy;
          const maxDist = radius + entity.radius;
          if (distSq <= maxDist * maxDist) {
            result.push(entity);
          }
        }
      }
    }

    return result;
  }

  /** Clear all entities */
  clear(): void {
    this.cells.clear();
  }

  /** Rebuild the hash from scratch with a new set of entities */
  rebuild(entities: SpatialEntity[]): void {
    this.clear();
    for (let i = 0; i < entities.length; i++) {
      this.insert(entities[i]);
    }
  }
}
