// ============================================================================
// Venom Arena — Spatial Grid for O(n) Collision Detection
// Uses spatial hashing to avoid O(n²) snake-vs-snake checks.
// ============================================================================

import type { SnakeState } from '../../src/lib/snake/types';

export class SpatialGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private grid: Map<number, string[]>[];
  private mapRadius: number;
  private mapCenterX: number;
  private mapCenterY: number;
  private size: number;

  constructor(cellSize: number, mapRadius: number, centerX: number, centerY: number) {
    this.cellSize = cellSize;
    this.mapRadius = mapRadius;
    this.mapCenterX = centerX;
    this.mapCenterY = centerY;

    // Grid covers the bounding box of the circular map
    this.cols = Math.ceil((mapRadius * 2) / cellSize);
    this.rows = Math.ceil((mapRadius * 2) / cellSize);
    this.size = this.cols * this.rows;

    // Pre-allocate flat array of Maps
    this.grid = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      this.grid[i] = new Map();
    }
  }

  /** Convert world coords to cell index. Returns -1 if outside map. */
  private toCell(x: number, y: number): number {
    const col = Math.floor((x - (this.mapCenterX - this.mapRadius)) / this.cellSize);
    const row = Math.floor((y - (this.mapCenterY - this.mapRadius)) / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;
    return col + row * this.cols;
  }

  /** Insert a snake by head position. */
  insert(snakeId: string, x: number, y: number): void {
    const cell = this.toCell(x, y);
    if (cell < 0) return;
    this.grid[cell].set(snakeId, []);
  }

  /** Get all snake IDs in cells near (x, y) within range. */
  queryNearby(x: number, y: number, range: number): string[] {
    const result: string[] = [];
    const minCol = Math.floor((x - range - (this.mapCenterX - this.mapRadius)) / this.cellSize);
    const maxCol = Math.floor((x + range - (this.mapCenterX - this.mapRadius)) / this.cellSize);
    const minRow = Math.floor((y - range - (this.mapCenterY - this.mapRadius)) / this.cellSize);
    const maxRow = Math.floor((y + range - (this.mapCenterY - this.mapRadius)) / this.cellSize);

    const c0 = Math.max(0, minCol);
    const c1 = Math.min(this.cols - 1, maxCol);
    const r0 = Math.max(0, minRow);
    const r1 = Math.min(this.rows - 1, maxRow);

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = this.grid[c + r * this.cols];
        for (const id of cell.keys()) {
          result.push(id);
        }
      }
    }
    return result;
  }

  /** Clear all cells. */
  clear(): void {
    for (let i = 0; i < this.size; i++) {
      this.grid[i].clear();
    }
  }

  /** Rebuild the entire grid from current snake positions. Call once per tick. */
  rebuild(snakes: Map<string, SnakeState>): void {
    this.clear();
    for (const [id, snake] of snakes) {
      if (!snake.alive) continue;
      this.insert(id, snake.head.x, snake.head.y);
    }
  }
}
