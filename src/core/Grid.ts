import { TileData, Unit } from './types';
import { MapData } from '../data/maps';

export interface PathNode {
  x: number;
  z: number;
  height: number;
  cost: number;
}

export class BattleGrid {
  public mapData: MapData;
  private tileMap: Map<string, TileData> = new Map();

  constructor(mapData: MapData) {
    this.mapData = mapData;
    for (const tile of mapData.tiles) {
      this.tileMap.set(this.key(tile.x, tile.z), tile);
    }
  }

  public key(x: number, z: number): string {
    return `${x},${z}`;
  }

  public getTile(x: number, z: number): TileData | undefined {
    return this.tileMap.get(this.key(x, z));
  }

  public getHeight(x: number, z: number): number {
    const tile = this.getTile(x, z);
    return tile ? tile.height : 0;
  }

  public isWalkable(x: number, z: number): boolean {
    const tile = this.getTile(x, z);
    return tile ? tile.walkable : false;
  }

  /**
   * Computes all reachable tiles for a unit given their Move and Jump attributes.
   * Uses Dijkstra/BFS with height difference constraint.
   */
  public getReachableTiles(unit: Unit, allUnits: Unit[]): PathNode[] {
    const startTile = this.getTile(unit.x, unit.z);
    if (!startTile) return [];

    const reachable: PathNode[] = [];
    const visited = new Map<string, number>();
    const queue: PathNode[] = [{ x: unit.x, z: unit.z, height: startTile.height, cost: 0 }];

    // Occupied tiles map
    const occupiedMap = new Map<string, Unit>();
    for (const u of allUnits) {
      if (!u.isDead) {
        occupiedMap.set(this.key(u.x, u.z), u);
      }
    }

    visited.set(this.key(unit.x, unit.z), 0);

    const neighbors = [
      { dx: 1, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -1 }
    ];

    while (queue.length > 0) {
      // Sort queue by lowest cost
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift()!;

      // Add to reachable if not the origin and not occupied by another unit
      const occupant = occupiedMap.get(this.key(current.x, current.z));
      if (!(current.x === unit.x && current.z === unit.z)) {
        if (!occupant) {
          reachable.push(current);
        }
      }

      if (current.cost >= unit.move) continue;

      for (const offset of neighbors) {
        const nx = current.x + offset.dx;
        const nz = current.z + offset.dz;
        const nextTile = this.getTile(nx, nz);

        if (!nextTile || !nextTile.walkable) continue;

        // Height difference check (Jump constraint)
        const heightDiff = Math.abs(nextTile.height - current.height);
        if (heightDiff > unit.jump) continue;

        // Blocked by enemy
        const nextOccupant = occupiedMap.get(this.key(nx, nz));
        if (nextOccupant && nextOccupant.team !== unit.team) {
          continue; // Enemies block movement completely
        }

        const newCost = current.cost + 1;
        const key = this.key(nx, nz);

        if (!visited.has(key) || newCost < visited.get(key)!) {
          visited.set(key, newCost);
          queue.push({
            x: nx,
            z: nz,
            height: nextTile.height,
            cost: newCost
          });
        }
      }
    }

    return reachable;
  }

  /**
   * Calculates valid target tiles for an attack or ability based on Range and Height Tolerance.
   */
  public getTargetableTiles(originX: number, originZ: number, range: number, heightTolerance: number): TileData[] {
    const originTile = this.getTile(originX, originZ);
    if (!originTile) return [];

    const targetables: TileData[] = [];

    for (const tile of this.mapData.tiles) {
      // Manhattan distance
      const dist = Math.abs(tile.x - originX) + Math.abs(tile.z - originZ);
      if (dist > 0 && dist <= range) {
        const heightDiff = Math.abs(tile.height - originTile.height);
        if (heightDiff <= heightTolerance) {
          targetables.push(tile);
        }
      }
    }

    return targetables;
  }

  /**
   * Computes splash area of effect around center tile.
   */
  public getAoeTiles(centerX: number, centerZ: number, aoe: number): TileData[] {
    const results: TileData[] = [];
    for (const tile of this.mapData.tiles) {
      const dist = Math.abs(tile.x - centerX) + Math.abs(tile.z - centerZ);
      if (dist <= aoe) {
        results.push(tile);
      }
    }
    return results;
  }
}
