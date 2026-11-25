import { TileData, Unit } from './types';
import { isFoe } from './Sides';
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

  /** Movement cost to enter a tile: water and swamp cost 2 unless the unit has Water Walk. */
  public enterCost(unit: Unit, tile: TileData): number {
    // Water, swamp and deep snow (0.34.0) cost 2 to enter; Water Walk crosses water and swamp
    if (tile.terrain === 'snow' || ((tile.terrain === 'water' || tile.terrain === 'swamp') && unit.equippedAbilities.movement !== 'ni_water_walk')) {
      return 2;
    }
    return 1;
  }

  /**
   * Computes all reachable tiles for a unit given their Move and Jump attributes.
   * Dijkstra over the tile grid: height differences above Jump are impassable, enemies block,
   * allies can be passed through but not stopped on, and water/swamp cost 2 Move.
   * Units with the Teleport movement ability blink to any open tile within Move + 1.
   */
  public getReachableTiles(unit: Unit, allUnits: Unit[]): PathNode[] {
    const startTile = this.getTile(unit.x, unit.z);
    if (!startTile || unit.move <= 0) return [];

    const occupiedMap = new Map<string, Unit>();
    for (const u of allUnits) {
      if (!u.isDead) occupiedMap.set(this.key(u.x, u.z), u);
    }

    if (unit.equippedAbilities.movement === 'tm_teleport') {
      const range = unit.move + 1;
      const out: PathNode[] = [];
      for (const tile of this.mapData.tiles) {
        const dist = Math.abs(tile.x - unit.x) + Math.abs(tile.z - unit.z);
        if (dist === 0 || dist > range || !tile.walkable) continue;
        if (occupiedMap.has(this.key(tile.x, tile.z))) continue;
        out.push({ x: tile.x, z: tile.z, height: tile.height, cost: dist });
      }
      return out;
    }

    const { best, startKey } = this.flood(unit, occupiedMap);

    const reachable: PathNode[] = [];
    for (const [key, node] of best) {
      if (key === startKey) continue;
      if (occupiedMap.has(key)) continue; // can pass through allies, not stop on them
      reachable.push(node);
    }
    return reachable;
  }

  /**
   * The tiles a unit walks through to reach (tx, tz), start and end included, following the same
   * rules as getReachableTiles. Null if it can't walk there (or teleports).
   */
  public findPath(unit: Unit, allUnits: Unit[], tx: number, tz: number): { x: number; z: number }[] | null {
    if (unit.equippedAbilities.movement === 'tm_teleport') return null;
    const occupiedMap = new Map<string, Unit>();
    for (const u of allUnits) if (!u.isDead && u !== unit) occupiedMap.set(this.key(u.x, u.z), u);
    const { best, parent } = this.flood(unit, occupiedMap);
    let k = this.key(tx, tz);
    if (!best.has(k)) return null;
    const path: { x: number; z: number }[] = [];
    for (let guard = 0; k && guard < 400; guard++) {
      const n = best.get(k)!;
      path.unshift({ x: n.x, z: n.z });
      k = parent.get(k)!;
    }
    return path;
  }

  /** Dijkstra over walkable tiles within the unit's Move, respecting Jump and enemy blocking. */
  private flood(unit: Unit, occupiedMap: Map<string, Unit>): { best: Map<string, PathNode>; parent: Map<string, string>; startKey: string } {
    const startTile = this.getTile(unit.x, unit.z)!;
    const parent = new Map<string, string>();
    const best = new Map<string, PathNode>();
    const startKey = this.key(unit.x, unit.z);
    best.set(startKey, { x: unit.x, z: unit.z, height: startTile.height, cost: 0 });
    const frontier: PathNode[] = [best.get(startKey)!];

    const neighbors = [
      { dx: 1, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -1 }
    ];

    while (frontier.length > 0) {
      // Grids are at most a few hundred tiles, so a linear min-scan is fast enough.
      let minIdx = 0;
      for (let i = 1; i < frontier.length; i++) {
        if (frontier[i].cost < frontier[minIdx].cost) minIdx = i;
      }
      const current = frontier.splice(minIdx, 1)[0];
      if (current.cost > (best.get(this.key(current.x, current.z))?.cost ?? Infinity)) continue;

      for (const offset of neighbors) {
        const nx = current.x + offset.dx;
        const nz = current.z + offset.dz;
        const nextTile = this.getTile(nx, nz);
        if (!nextTile || !nextTile.walkable) continue;
        if (Math.abs(nextTile.height - current.height) > unit.jump) continue;

        const nextOccupant = occupiedMap.get(this.key(nx, nz));
        if (nextOccupant && isFoe(nextOccupant, unit)) continue; // Enemies block movement

        const newCost = current.cost + this.enterCost(unit, nextTile);
        if (newCost > unit.move) continue;

        const key = this.key(nx, nz);
        const prev = best.get(key);
        if (!prev || newCost < prev.cost) {
          const node = { x: nx, z: nz, height: nextTile.height, cost: newCost };
          best.set(key, node);
          parent.set(key, this.key(current.x, current.z));
          frontier.push(node);
        }
      }
    }
    return { best, parent, startKey };
  }

  /**
   * Whether `ability` cast from (ox, oz) can reach (tx, tz): within range and height tolerance.
   * Heals and buffs may also target the caster's own tile.
   */
  public canTarget(ox: number, oz: number, tx: number, tz: number, range: number, heightTolerance: number, allowSelf: boolean): boolean {
    const origin = this.getTile(ox, oz);
    const target = this.getTile(tx, tz);
    if (!origin || !target) return false;
    const dist = Math.abs(tx - ox) + Math.abs(tz - oz);
    if (dist === 0) return allowSelf;
    if (dist > range) return false;
    return Math.abs(target.height - origin.height) <= heightTolerance;
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
