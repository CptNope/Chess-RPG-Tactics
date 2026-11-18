import { TileData, TerrainType } from '../core/types';

export interface MapData {
  id: string;
  name: string;
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

      tiles.push({
        x,
        z,
        height,
        terrain,
        walkable
      });
    }
  }

  return {
    id: 'river_ruins',
    name: 'Ruins by the River',
    width,
    depth,
    tiles
  };
}
