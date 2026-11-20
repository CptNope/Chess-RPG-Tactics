import { TileData, TerrainType } from '../core/types';

export interface MapData {
  id: string;
  name: string;
  theme: 'day' | 'night' | 'swamp';
  width: number;
  depth: number;
  tiles: TileData[];
  /** Where the player's squad deploys, in squad order. Falls back to the southern rows. */
  playerSpawns?: { x: number; z: number }[];
  /** Atmosphere preset id when it differs from the map id (custom maps pick a look). */
  look?: string;
}

/**
 * Small authoring helper: start from a flat field, then paint regions. North (z = 0) is the
 * enemy side, south (z = depth - 1) is where the squad deploys.
 */
export class MapBuilder {
  private grid: TileData[][];

  constructor(public width: number, public depth: number, height = 1, terrain: TerrainType = 'grass') {
    this.grid = [];
    for (let z = 0; z < depth; z++) {
      const row: TileData[] = [];
      for (let x = 0; x < width; x++) row.push({ x, z, height, terrain, walkable: true });
      this.grid.push(row);
    }
  }

  in(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.width && z < this.depth;
  }

  get(x: number, z: number): TileData | undefined {
    return this.in(x, z) ? this.grid[z][x] : undefined;
  }

  /** Sets fields on one tile (ignored when out of bounds). */
  set(x: number, z: number, h?: number, t?: TerrainType, walkable?: boolean): this {
    const tile = this.get(x, z);
    if (!tile) return this;
    if (h !== undefined) tile.height = h;
    if (t !== undefined) tile.terrain = t;
    if (walkable !== undefined) tile.walkable = walkable;
    return this;
  }

  /** Inclusive rectangle. */
  rect(x0: number, z0: number, x1: number, z1: number, h?: number, t?: TerrainType, walkable?: boolean): this {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, z, h, t, walkable);
    }
    return this;
  }

  each(fn: (t: TileData) => void): this {
    for (const row of this.grid) for (const t of row) fn(t);
    return this;
  }

  build(id: string, name: string, theme: MapData['theme'], playerSpawns: { x: number; z: number }[]): MapData {
    return { id, name, theme, width: this.width, depth: this.depth, tiles: this.grid.flat(), playerSpawns };
  }
}

const SOUTH_SPAWNS = [
  { x: 6, z: 14 }, { x: 8, z: 14 }, { x: 7, z: 15 }, { x: 5, z: 15 }, { x: 9, z: 15 }, { x: 7, z: 13 }
];

/**
 * Riverside Ruins (16×16): a winding river with two bridges and a shallow ford, a ruined
 * hilltop temple in the north-east, a western ridge, boulders and a dirt road from the south.
 */
export function createRuinsMap(): MapData {
  const b = new MapBuilder(16, 16, 1, 'grass');

  // Rolling hills
  b.rect(0, 10, 3, 15, 1.5);
  b.rect(0, 4, 2, 9, 2.0);
  b.rect(0, 4, 0, 7, 2.5);

  // Dirt road from the south toward the lower bridge, then north along the east bank
  b.rect(4, 11, 4, 15, undefined, 'dirt');
  b.rect(4, 11, 8, 11, undefined, 'dirt');

  // Winding river, two tiles wide
  for (let z = 0; z < 16; z++) {
    const cx = 9 + Math.round(Math.sin(z * 0.45) * 1.5);
    b.rect(cx - 1, z, cx, z, 0.6, 'water');
  }
  // Bridges and a shallow ford
  for (let x = 0; x < 16; x++) {
    if (b.get(x, 3)?.terrain === 'water') b.set(x, 3, 1.0, 'wood');
    if (b.get(x, 11)?.terrain === 'water') b.set(x, 11, 1.0, 'wood');
    if (b.get(x, 7)?.terrain === 'water') b.set(x, 7, 0.8);
  }

  // Ruined temple (north-east): plinth, inner court, altar, broken pillars, stairs
  b.rect(11, 0, 15, 5, 2.0, 'stone');
  b.rect(12, 1, 14, 3, 2.5, 'stone');
  b.set(13, 2, 3.0, 'stone');
  b.set(11, 0, 3.4, 'stone', false).set(15, 0, 3.4, 'stone', false).set(15, 5, 3.4, 'stone', false);
  b.set(11, 6, 1.5, 'stone').set(12, 6, 1.5, 'stone');
  b.rect(11, 7, 14, 8, undefined, 'dirt');

  // Boulders
  for (const [x, z] of [[4, 6], [6, 2], [14, 10], [2, 13]]) b.set(x, z, 1.9, 'stone', false);

  return b.build('river_ruins', 'Riverside Ruins', 'day', [
    { x: 5, z: 14 }, { x: 6, z: 14 }, { x: 4, z: 13 }, { x: 6, z: 13 }, { x: 5, z: 15 }, { x: 3, z: 14 }
  ]);
}

/**
 * Night Battlement (16×16): an outer courtyard, a curtain wall with a gatehouse, corner
 * towers, a moat on the east, and the keep with ramparts in the north.
 */
export function createFortressNightMap(): MapData {
  const b = new MapBuilder(16, 16, 1, 'stone');

  // Outer courtyard paving and a dirt approach
  b.rect(5, 12, 10, 15, 1, 'dirt');

  // Moat along the east side, with a drawbridge
  b.rect(14, 0, 15, 15, 0.5, 'water');
  b.rect(14, 12, 15, 12, 1, 'wood');

  // Curtain wall (row 8) with a two-tile gate and walkable wall-walk
  b.rect(0, 8, 13, 8, 3.0, 'parapet');
  b.rect(7, 8, 8, 8, 1.0, 'stone');
  // Stairs up to the wall-walk
  b.set(2, 9, 2.0, 'stone').set(3, 9, 1.5, 'stone');
  b.set(12, 9, 2.0, 'stone').set(11, 9, 1.5, 'stone');

  // Corner towers (unwalkable spires with a walkable base ring)
  b.set(0, 8, 4.5, 'parapet', false).set(13, 8, 4.5, 'parapet', false);

  // Inner bailey and the keep
  b.rect(0, 0, 13, 7, 1.5, 'stone');
  b.rect(4, 0, 9, 3, 3.5, 'parapet');
  b.rect(5, 0, 8, 1, 4.0, 'parapet');
  b.rect(4, 4, 9, 4, 2.5, 'stone');
  b.rect(5, 5, 8, 5, 2.0, 'stone');
  // Rampart towers flanking the keep
  b.rect(0, 0, 1, 1, 3.5, 'parapet');
  b.rect(12, 0, 13, 1, 3.5, 'parapet');
  b.set(1, 2, 2.5, 'stone').set(12, 2, 2.5, 'stone');

  // Barracks rubble
  b.set(2, 5, 2.4, 'stone', false).set(11, 6, 2.4, 'stone', false);

  return b.build('night_fortress', 'Night Battlement', 'night', SOUTH_SPAWNS);
}

/**
 * Gloomy Mire (16×16): a poisonous bog crossed by plank boardwalks, grassy islands, dead-tree
 * stumps, and a raised witch's shrine in the north-west.
 */
export function createSwampMap(): MapData {
  const b = new MapBuilder(16, 16, 0.6, 'swamp');

  // Grassy islands
  b.rect(0, 12, 4, 15, 1.2, 'grass');
  b.rect(10, 11, 15, 15, 1.2, 'grass');
  b.rect(11, 0, 15, 4, 1.4, 'grass');
  b.rect(5, 6, 8, 8, 1.3, 'grass');
  b.rect(0, 5, 2, 7, 1.0, 'grass');

  // Boardwalks: a long north–south walk and two east–west branches
  b.rect(7, 0, 7, 15, 1.0, 'wood');
  b.rect(2, 10, 13, 10, 1.0, 'wood');
  b.rect(3, 3, 11, 3, 1.0, 'wood');

  // Witch's shrine in the north-west
  b.rect(0, 0, 4, 2, 1.8, 'dirt');
  b.rect(1, 0, 3, 1, 2.4, 'stone');
  b.set(2, 0, 3.0, 'stone');

  // Dead-tree stumps and a pond
  for (const [x, z] of [[4, 8], [10, 7], [13, 6], [2, 13], [9, 13]]) b.set(x, z, 2.2, 'dirt', false);
  b.rect(11, 8, 13, 9, 0.4, 'water');

  return b.build('gloomy_swamp', 'Gloomy Mire', 'swamp', [
    { x: 6, z: 14 }, { x: 7, z: 14 }, { x: 8, z: 14 }, { x: 7, z: 15 }, { x: 6, z: 15 }, { x: 8, z: 15 }
  ]);
}

/**
 * Zodiac Summit (16×16): terraces climb from the southern meadow past starlit pools and broken
 * obelisks to the Zodiac altar in the north, with a rope bridge across the west pool.
 */
export function createZodiacSummitMap(): MapData {
  const b = new MapBuilder(16, 16, 1, 'grass');

  // Terraces rising northward
  b.rect(0, 10, 15, 11, 1.5, 'dirt');
  b.rect(0, 8, 15, 9, 2.0, 'dirt');
  b.rect(6, 8, 9, 11, undefined, 'stone'); // central stair
  b.rect(0, 6, 15, 7, 2.5, 'stone');
  b.rect(0, 4, 15, 5, 3.0, 'parapet');
  b.rect(0, 0, 15, 3, 3.5, 'parapet');
  b.rect(5, 0, 10, 2, 4.0, 'parapet');

  // Starlit pools on both flanks, with a rope bridge on the west
  b.rect(0, 6, 3, 9, 1.4, 'water');
  b.rect(12, 6, 15, 9, 1.4, 'water');
  b.rect(0, 7, 3, 7, 1.8, 'wood');

  // The Zodiac altar
  b.rect(7, 1, 8, 1, 5.0, 'stone');

  // Broken obelisks
  for (const [x, z] of [[4, 5], [11, 5], [3, 1], [12, 1], [5, 9], [10, 9]]) b.set(x, z, 4.6, 'stone', false);

  // Meadow corners
  b.set(0, 15, 1, 'stone').set(15, 15, 1, 'stone');

  return b.build('zodiac_summit', 'Zodiac Summit', 'night', SOUTH_SPAWNS);
}

/** The squad's deployment tiles on a map (map-defined, else the southern rows). */
export function spawnsFor(map: MapData): { x: number; z: number }[] {
  if (map.playerSpawns && map.playerSpawns.length > 0) return map.playerSpawns;
  const cx = Math.floor(map.width / 2);
  const z = map.depth - 2;
  return [-1, 1, 0, -2, 2, 0].map((dx, i) => ({ x: cx + dx, z: i < 2 ? z : i === 5 ? z - 1 : z + 1 }));
}

export const MAPS: Record<string, () => MapData> = {
  river_ruins: createRuinsMap,
  night_fortress: createFortressNightMap,
  gloomy_swamp: createSwampMap,
  zodiac_summit: createZodiacSummitMap
};
