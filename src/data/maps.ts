import { TileData, TerrainType } from '../core/types';

export interface MapData {
  id: string;
  name: string;
  theme: 'day' | 'night' | 'swamp' | 'desert' | 'snow';
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

/**
 * Emberwick Harbor (16×16): a stone quay with warehouses in the south, and three piers running
 * north over deep water to a moored corsair ship. The sea can't be crossed: the piers are the
 * only way aboard, and the cross-pier lets a flank get round.
 */
export function createHarborMap(): MapData {
  const b = new MapBuilder(16, 16, 1, 'stone');

  // Deep water north of the quay
  b.rect(0, 0, 15, 8, 0.4, 'water', false);
  // Shallows along the quay wall (wadeable, slow)
  b.rect(0, 8, 15, 8, 0.7, 'water', true);

  // Piers: west, centre (wide), east, and a cross-pier joining them
  b.rect(2, 3, 3, 8, 1.0, 'wood', true);
  b.rect(7, 2, 8, 8, 1.0, 'wood', true);
  b.rect(12, 3, 13, 8, 1.0, 'wood', true);
  b.rect(2, 4, 13, 5, 1.0, 'wood', true);

  // The corsair ship across the north, with a raised stern deck and gangways down to the piers
  b.rect(3, 0, 12, 1, 1.5, 'wood', true);
  b.rect(10, 0, 12, 1, 2.2, 'wood', true);
  b.set(2, 2, 1.2, 'wood', true).set(3, 2, 1.2, 'wood', true).set(12, 2, 1.2, 'wood', true).set(13, 2, 1.2, 'wood', true);
  b.set(5, 0, 4.0, 'wood', false); // mast

  // Quay: a road, a customs house you can climb, warehouses and crates for cover
  b.rect(0, 12, 15, 12, undefined, 'dirt');
  b.rect(11, 10, 14, 11, 2.0, 'stone', true);
  b.set(10, 10, 1.5, 'stone', true);
  b.rect(0, 10, 2, 11, 3.2, 'stone', false);
  for (const [x, z] of [[5, 10], [6, 13], [9, 13], [4, 5], [11, 4]]) b.set(x, z, 1.9, 'wood', false);

  return b.build('ember_harbor', 'Emberwick Harbor', 'day', SOUTH_SPAWNS);
}

/**
 * Greywatch Isle (16×16): a rock in the sea. A landing beach in the south, tidal shallows on
 * both sides, and terraces climbing north to the lighthouse. High ground all the way up.
 */
export function createGreywatchMap(): MapData {
  const b = new MapBuilder(16, 16, 0.4, 'water');
  b.each((t) => { t.walkable = false; });

  // Landing beach and the causeway up from it
  b.rect(3, 12, 12, 15, 1.0, 'dirt', true);
  b.rect(6, 9, 9, 11, 1.0, 'stone', true);
  // Tidal shallows: slow going, but they let a flank through
  b.rect(1, 9, 5, 11, 0.7, 'water', true);
  b.rect(10, 9, 14, 11, 0.7, 'water', true);
  // Side ledges
  b.rect(0, 6, 2, 8, 1.2, 'dirt', true);
  b.rect(13, 6, 15, 8, 1.2, 'dirt', true);

  // Terraces
  b.rect(3, 5, 12, 8, 1.5, 'grass', true);
  b.rect(4, 3, 11, 4, 2.5, 'stone', true);
  b.rect(5, 0, 10, 2, 3.5, 'parapet', true);
  // The lighthouse itself, and its door step
  b.rect(7, 0, 8, 0, 7.0, 'stone', false);
  b.set(7, 1, 4.0, 'stone', true).set(8, 1, 4.0, 'stone', true);

  // Rocks
  for (const [x, z] of [[4, 13], [11, 13], [5, 7], [10, 6], [2, 7], [13, 7]]) b.set(x, z, 2.4, 'stone', false);

  return b.build('greywatch_isle', 'Greywatch Isle', 'night', SOUTH_SPAWNS);
}

/**
 * Stormbreak Cape (16×16): a meadow, then cliffs stepping up to a sea altar on the point. A
 * chasm splits the middle shelf, so the climb goes up one flank or the other; tide pools sit
 * beside the altar.
 */
export function createCapeMap(): MapData {
  const b = new MapBuilder(16, 16, 1, 'grass');

  b.rect(0, 9, 15, 11, 1.5, 'dirt');
  b.rect(0, 6, 15, 8, 2.5, 'stone');
  // The chasm, with one rope bridge across its narrowest point
  b.rect(6, 6, 9, 8, 0.4, 'water', false);
  b.rect(6, 7, 9, 7, 2.5, 'wood', true);
  b.rect(0, 3, 15, 5, 3.5, 'parapet');
  // The altar on the point
  b.rect(5, 0, 10, 2, 4.5, 'stone');
  b.rect(7, 0, 8, 0, 5.2, 'stone');
  // Tide pools either side
  b.rect(0, 0, 2, 2, 3.0, 'water');
  b.rect(13, 0, 15, 2, 3.0, 'water');
  // Standing stones
  for (const [x, z] of [[2, 4], [13, 4], [5, 2], [10, 2], [4, 10], [11, 10]]) b.set(x, z, 5.4, 'stone', false);
  // Meadow path
  b.rect(7, 12, 8, 15, undefined, 'dirt');

  return b.build('stormbreak_cape', 'Stormbreak Cape', 'night', SOUTH_SPAWNS);
}

/**
 * The Saltglass Shore (16×16, 0.34.0): the drowned kingdom's old harbour on the Far Shore. The
 * squad lands on the beach in the south; dunes roll up to the broken quay and the ruined port in
 * the north, where the Tide Court holds the high stones. The sea runs along the west, a tidal
 * channel cuts the middle, and a wrecked hull lies on the east sands.
 */
export function createSaltglassMap(): MapData {
  const b = new MapBuilder(16, 16, 1, 'sand');
  // The sea along the west and the shallows of the landing
  b.rect(0, 0, 1, 15, 0.4, 'water');
  b.rect(2, 12, 3, 15, 0.6, 'water');
  b.set(2, 11, 0.6, 'water');
  // Dunes
  b.rect(10, 11, 14, 13, 1.5);
  b.rect(11, 12, 13, 12, 2.0);
  b.rect(4, 8, 6, 10, 1.6);
  b.rect(5, 9, 5, 9, 2.2);
  b.rect(12, 5, 15, 7, 2.0);
  b.rect(14, 4, 15, 5, 2.6);
  // The tidal channel through the middle, with a sandbar ford
  b.rect(7, 6, 9, 7, 0.5, 'water');
  b.rect(8, 6, 8, 7, 0.8, 'sand');
  // The broken quay and the port on the high stones
  b.rect(3, 3, 12, 5, 2.4, 'stone');
  b.rect(4, 0, 11, 2, 3.2, 'stone');
  b.rect(6, 0, 9, 0, 3.8, 'stone');
  b.rect(7, 5, 8, 5, 1.8, 'stone'); // steps up from the channel
  b.rect(2, 3, 2, 5, 1.2, 'wood'); // the old jetty
  // Fallen columns and the wreck
  for (const [x, z] of [[4, 1], [11, 1], [3, 4], [12, 3], [6, 10]]) b.set(x, z, 5.0, 'stone', false);
  b.rect(12, 8, 14, 9, 1.6, 'wood');
  b.set(13, 8, 3.2, 'wood', false); // the mast stump
  return b.build('saltglass_shore', 'Saltglass Shore', 'desert', SOUTH_SPAWNS);
}

/**
 * Frostfang Pass (16×16, 0.34.0): a pass climbing north into the mountains, walled by cliffs.
 * The squad starts in the snowfield at the foot; the road climbs in terraces to the Court's fort
 * at the top. A ledge path on the west climbs faster, pines stand in the drifts, and a frozen
 * pool lies on the east side. Deep snow costs 2 to cross.
 */
export function createFrostfangMap(): MapData {
  const b = new MapBuilder(16, 16, 1, 'snow');
  // The cliffs either side
  b.rect(0, 0, 1, 11, 7.0, 'stone', false);
  b.rect(14, 0, 15, 11, 7.0, 'stone', false);
  // Terraces of the road, climbing north
  b.rect(2, 9, 13, 11, 1.6);
  b.rect(2, 6, 13, 8, 2.6);
  b.rect(2, 3, 13, 5, 3.6);
  b.rect(2, 0, 13, 2, 4.6);
  // The beaten road up the middle (packed: normal going)
  b.rect(7, 3, 8, 15, undefined, 'dirt');
  // The west ledge: a steep shortcut along the cliff
  b.rect(2, 2, 3, 11, undefined, 'stone');
  for (let z = 2; z <= 11; z++) b.set(2, z, 1.2 + (11 - z) * 0.5);
  // The Court's fort at the top
  b.rect(4, 0, 11, 1, 5.2, 'parapet');
  b.rect(7, 1, 8, 1, 4.8, 'parapet');
  // A frozen pool and the pines
  b.rect(11, 7, 12, 8, 2.4, 'water');
  for (const [x, z] of [[4, 10], [12, 10], [5, 6], [10, 4], [4, 3], [12, 13], [3, 14]]) b.set(x, z, 4.2, 'wood', false);
  return b.build('frostfang_pass', 'Frostfang Pass', 'snow', SOUTH_SPAWNS);
}

/**
 * The Drowned City (16×16, 0.35.0): the drowned kingdom's capital, risen from the bay. The squad
 * comes up the causeway from the south. Streets of pale stone run between canals the sea left
 * behind, silted with weed; broken towers stand on the corners. A plaza in the middle, then a
 * wide stair to the palace dais in the north, where the Pale Heir waits. The east canal is
 * spanned by one bridge; the west street is long but dry.
 */
export function createDrownedCityMap(): MapData {
  const b = new MapBuilder(16, 16, 1.2, 'stone');
  // The bay still lapping at the edges, and the causeway the squad comes up
  b.rect(0, 13, 15, 15, 0.4, 'water');
  b.rect(5, 13, 10, 15, 1.0, 'stone');
  b.rect(6, 12, 9, 12, 1.1, 'stone');
  b.rect(0, 0, 0, 12, 0.4, 'water');
  b.rect(15, 0, 15, 12, 0.4, 'water');
  // The canals, silted with weed: wading is slow
  b.rect(1, 9, 5, 10, 0.8, 'swamp');
  b.rect(10, 9, 14, 10, 0.8, 'swamp');
  b.rect(11, 3, 12, 8, 0.6, 'water');
  b.rect(11, 5, 12, 5, 1.6, 'wood'); // the one bridge over the east canal
  // Sand drifted into the low streets
  b.rect(1, 11, 4, 12, 1.0, 'sand');
  b.rect(12, 11, 14, 12, 1.0, 'sand');
  // The plaza
  b.rect(5, 5, 10, 8, 1.8, 'stone');
  // The stair and the palace dais
  b.rect(4, 3, 10, 4, 2.6, 'stone');
  b.rect(3, 0, 10, 2, 3.6, 'parapet');
  b.rect(6, 0, 7, 1, 4.2, 'parapet');
  // Broken towers (impassable) on the corners of the streets
  for (const [x, z] of [[2, 6], [13, 1], [4, 11], [9, 10], [14, 7], [1, 2]]) b.set(x, z, 5.0, 'stone', false);
  return b.build('drowned_city', 'The Drowned City', 'night', SOUTH_SPAWNS);
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
  zodiac_summit: createZodiacSummitMap,
  ember_harbor: createHarborMap,
  greywatch_isle: createGreywatchMap,
  stormbreak_cape: createCapeMap,
  saltglass_shore: createSaltglassMap,
  frostfang_pass: createFrostfangMap,
  drowned_city: createDrownedCityMap
};
