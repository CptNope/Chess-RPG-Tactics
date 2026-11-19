import { Ability, Element, StatusEffectType, TerrainType } from './types';

interface TerrainSpell {
  name: string;
  element: Element;
  status?: StatusEffectType;
  /** Damage multiplier relative to the base Elemental power. */
  powerScale: number;
}

/**
 * What a Geomancer's terrain-driven abilities become on each kind of ground.
 * Shared by the player's action menu, the battle forecast and the enemy AI.
 */
export const TERRAIN_SPELLS: Record<TerrainType, TerrainSpell> = {
  grass: { name: 'Hell Ivy', element: 'dark', status: 'immobilize', powerScale: 0.85 },
  stone: { name: 'Rockslide', element: 'physical', powerScale: 1.15 },
  parapet: { name: 'Rockslide', element: 'physical', powerScale: 1.15 },
  dirt: { name: 'Sandstorm', element: 'physical', status: 'slow', powerScale: 0.85 },
  water: { name: 'Torrent', element: 'ice', powerScale: 1.05 },
  swamp: { name: 'Quicksand', element: 'dark', status: 'poison', powerScale: 0.8 },
  wood: { name: 'Wildfire', element: 'fire', powerScale: 1.1 }
};

/**
 * Returns the concrete ability a terrain-driven ability turns into when cast from `terrain`.
 * Non-terrain abilities are returned unchanged.
 */
export function resolveTerrainAbility(ability: Ability, terrain: TerrainType | undefined): Ability {
  if (!ability.terrainDriven) return ability;
  const spell = TERRAIN_SPELLS[terrain || 'grass'] || TERRAIN_SPELLS.grass;
  return {
    ...ability,
    name: `${ability.name}: ${spell.name}`,
    element: spell.element,
    appliesStatus: spell.status,
    power: Math.round(ability.power * spell.powerScale * 100) / 100
  };
}
