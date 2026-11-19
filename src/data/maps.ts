import { TileData, TerrainType } from '../core/types';

export interface MapData {
  id: string;
  name: string;
  theme: 'day' | 'night' | 'swamp';
  width: number;
  depth: number;
  tiles: TileData[];
}

export function createRuinsMap(): MapData {
  const width = 11;
  const depth = 11;
  const tiles: TileData[] = [];

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      let height = 1.0;
      let terrain: TerrainType = 'grass';
      let walkable = true;

      // River running through x = 2 to 3
      if (x === 2 || (x === 3 && z > 3)) {
        height = 0.0;
        terrain = 'water';
      }
      // Raised ridge / hill on the east side (x >= 7)
      else if (x >= 7 && z <= 7) {
        height = 2.0;
        terrain = 'dirt';
        // Fortress ruins platform (x between 8 and 10, z between 1 and 4)
        if (x >= 8 && z >= 1 && z <= 4) {
          height = 3.0;
          terrain = 'stone';
        }
        // Watchtower peak (x = 9, z = 2)
        if (x === 9 && z === 2) {
          height = 4.0;
          terrain = 'stone';
        }
      }
      // Stepping stone bridge over river
      if (x === 2 && z === 5) {
        height = 0.8;
        terrain = 'stone';
      }
      // Small boulder/stone obstacle (not walkable)
      if (x === 5 && z === 6) {
        height = 1.5;
        terrain = 'stone';
      }

      tiles.push({ x, z, height, terrain, walkable });
    }
  }

  return {
    id: 'river_ruins',
    name: 'Ruins by the River',
    theme: 'day',
    width,
    depth,
    tiles
  };
}

export function createFortressNightMap(): MapData {
  const width = 11;
  const depth = 11;
  const tiles: TileData[] = [];

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      let height = 1.0;
      let terrain: TerrainType = 'parapet';
      let walkable = true;

      // High outer ramparts (z <= 3)
      if (z <= 3) {
        height = 3.0;
        terrain = 'parapet';
        // Twin Archer Bastions
        if ((x === 2 || x === 8) && z === 1) {
          height = 4.5;
          terrain = 'stone';
        }
      } else if (z === 4) {
        // Fortress moat / drainage canal
        height = 0.2;
        terrain = 'water';
      } else if (z === 5 && (x === 4 || x === 5 || x === 6)) {
        // Drawbridge entrance
        height = 1.0;
        terrain = 'wood';
      } else {
        // Lower courtyard
        height = 1.0;
        terrain = 'parapet';
      }

      tiles.push({ x, z, height, terrain, walkable });
    }
  }

  return {
    id: 'night_fortress',
    name: 'Night Battlement',
    theme: 'night',
    width,
    depth,
    tiles
  };
}

export function createSwampMap(): MapData {
  const width = 11;
  const depth = 11;
  const tiles: TileData[] = [];

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      let height = 0.6;
      let terrain: TerrainType = 'swamp';
      let walkable = true;

      // Deep toxic bog pools
      if ((x === 3 && z === 3) || (x === 7 && z === 7) || (x === 2 && z === 8)) {
        height = 0.1;
        terrain = 'swamp';
      }
      // Wooden boardwalks crossing the mire
      else if (x === 5 || z === 5) {
        height = 1.0;
        terrain = 'wood';
      }
      // Dry island hummocks
      else if ((x >= 8 && z <= 3) || (x <= 2 && z >= 8)) {
        height = 2.0;
        terrain = 'dirt';
        if (x === 9 && z === 1) {
          height = 3.0;
          terrain = 'grass';
        }
      }

      tiles.push({ x, z, height, terrain, walkable });
    }
  }

  return {
    id: 'gloomy_swamp',
    name: 'Gloomy Mire & Marsh',
    theme: 'swamp',
    width,
    depth,
    tiles
  };
}

/**
 * Zodiac Summit (added in 0.7.0): a stepped mountaintop shrine for the final battle.
 * Terraces climb from the southern meadow (player deployment) to the Zodiac altar at the
 * north, flanked by starlit pools and two crumbling obelisks that block line of approach.
 */
export function createZodiacSummitMap(): MapData {
  const width = 11;
  const depth = 11;
  const tiles: TileData[] = [];

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      let height = 1.0;
      let terrain: TerrainType = 'grass';
      let walkable = true;

      const dx = Math.abs(x - 5);

      if (z >= 7) {
        // Southern alpine meadow where the squad deploys
        height = 1.0;
        terrain = z === 10 && (x === 0 || x === 10) ? 'stone' : 'grass';
      } else if (z === 6) {
        // First terrace: packed earth switchback
        height = 1.5;
        terrain = 'dirt';
      } else if (z === 5) {
        height = 2.0;
        terrain = dx <= 1 ? 'stone' : 'dirt';
      } else if (z === 4) {
        // Starlit pools on the flanks, stone stair in the middle
        if (dx >= 4) {
          height = 1.4;
          terrain = 'water';
        } else {
          height = 2.5;
          terrain = 'stone';
        }
      } else if (z === 3) {
        height = 3.0;
        terrain = 'parapet';
      } else {
        // Upper sanctum (z 0-2) rises toward the altar
        height = 3.5 + (2 - z) * 0.5;
        terrain = 'parapet';
        if (dx >= 4) {
          height = 3.0;
          terrain = 'stone';
        }
      }

      // The Zodiac altar
      if (x === 5 && z === 1) {
        height = 5.0;
        terrain = 'stone';
      }

      // Broken obelisks: impassable pillars
      if ((x === 2 && z === 5) || (x === 8 && z === 5)) {
        height = 4.0;
        terrain = 'stone';
        walkable = false;
      }

      // A wooden rope bridge across the west pool
      if (x <= 1 && z === 4) {
        height = 1.8;
        terrain = 'wood';
      }

      tiles.push({ x, z, height, terrain, walkable });
    }
  }

  return {
    id: 'zodiac_summit',
    name: 'Zodiac Summit',
    theme: 'night',
    width,
    depth,
    tiles
  };
}

export const MAPS: Record<string, () => MapData> = {
  river_ruins: createRuinsMap,
  night_fortress: createFortressNightMap,
  gloomy_swamp: createSwampMap,
  zodiac_summit: createZodiacSummitMap
};
