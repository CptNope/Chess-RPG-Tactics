/**
 * Earthworks (0.54.0): the Sapper reshapes the battlefield.
 *
 * - Barricade: a wooden wall on an empty tile for BARRICADE_ROUNDS rounds. Nobody can walk
 *   through or stand on it; the tile's own height, terrain and hazard come back when it falls.
 * - Raise: a walkable tile climbs RAISE_STEP for the rest of the battle (whoever stands on it rises
 *   with it). Water filled in this way becomes dirt.
 * - Lower: a walkable tile sinks RAISE_STEP (the blow that does it hurts whoever stands there).
 * - Demolish: a blast that brings down any barricade in its area.
 *
 * Shots are judged by height difference only (no line of sight), so a barricade stops feet, not
 * arrows; raising and lowering change who can reach whom. Pure rules on tiles; the battle screen,
 * the balance sim, the AI and a server call them.
 */
import { Ability, TerrainType, TileData, Unit } from './types';

export type WorkKind = 'barricade' | 'raise' | 'lower' | 'collapse';

/** One tile a Sapper changed, or a barricade that fell. */
export interface WorkChange {
  x: number;
  z: number;
  kind: WorkKind;
  height: number;
}

export const BARRICADE_ROUNDS = 3;
export const BARRICADE_HEIGHT = 1.5;
export const RAISE_STEP = 1;
export const MAX_WORK_HEIGHT = 6;
export const MIN_WORK_HEIGHT = 0.5;
/** Fieldworks (support): barricades stand longer and earth rises higher. */
export const FIELDWORKS = 'sp_fieldworks';
export const FIELDWORKS_ROUNDS = 5;
export const FIELDWORKS_STEP = 1.5;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** True when the tile is a standing barricade. */
export const isBarricade = (t: TileData | undefined): boolean => !!t?.works;

/** A barricade goes on free ground: walkable, and nobody on it, fallen or standing. */
export function canBuildAt(tile: TileData | undefined, units: readonly Unit[]): boolean {
  return !!tile && tile.walkable && !units.some((u) => u.x === tile.x && u.z === tile.z && (!u.isDead || !u.spent));
}

/** Whether earth can go up (or down) here: walkable ground within the height limits. */
export function canShape(tile: TileData | undefined, kind: 'raise' | 'lower'): boolean {
  if (!tile || !tile.walkable) return false;
  return kind === 'raise' ? tile.height < MAX_WORK_HEIGHT : tile.height > MIN_WORK_HEIGHT;
}

/** True for abilities that reshape tiles (the aim goes on ground, not on a unit). */
export const shapesGround = (a: Ability): boolean => !!a.earthwork;

/** Puts up a barricade, remembering what the tile was. */
export function buildBarricade(tile: TileData, rounds: number): void {
  tile.works = { rounds, height: tile.height, terrain: tile.terrain };
  tile.walkable = false;
  tile.height = round1(tile.height + BARRICADE_HEIGHT);
  tile.terrain = 'wood';
}

/** Brings a barricade down: the tile is as it was. */
export function collapse(tile: TileData): void {
  if (!tile.works) return;
  tile.height = tile.works.height;
  tile.terrain = tile.works.terrain as TerrainType;
  tile.walkable = true;
  delete tile.works;
}

/**
 * Does an ability's earthwork (and any demolition) over its area around (tx, tz). Returns what
 * changed. `units` decides where a barricade has room.
 */
export function doWorks(caster: Unit, ability: Ability, getTile: (x: number, z: number) => TileData | undefined, units: readonly Unit[], tx: number, tz: number): WorkChange[] {
  if (!ability.earthwork && !ability.demolish) return [];
  const fieldworks = caster.equippedAbilities.support === FIELDWORKS;
  const out: WorkChange[] = [];
  for (let dz = -ability.aoe; dz <= ability.aoe; dz++) for (let dx = -ability.aoe; dx <= ability.aoe; dx++) {
    if (Math.abs(dx) + Math.abs(dz) > ability.aoe) continue;
    const t = getTile(tx + dx, tz + dz);
    if (!t) continue;
    if (ability.demolish && t.works) {
      collapse(t);
      out.push({ x: t.x, z: t.z, kind: 'collapse', height: t.height });
      continue;
    }
    if (ability.earthwork === 'barricade') {
      if (!canBuildAt(t, units)) continue;
      buildBarricade(t, fieldworks ? FIELDWORKS_ROUNDS : BARRICADE_ROUNDS);
      out.push({ x: t.x, z: t.z, kind: 'barricade', height: t.height });
    } else if (ability.earthwork === 'raise' && canShape(t, 'raise')) {
      t.height = round1(Math.min(MAX_WORK_HEIGHT, t.height + (fieldworks ? FIELDWORKS_STEP : RAISE_STEP)));
      if (t.terrain === 'water') t.terrain = 'dirt'; // filled in
      out.push({ x: t.x, z: t.z, kind: 'raise', height: t.height });
    } else if (ability.earthwork === 'lower' && canShape(t, 'lower')) {
      t.height = round1(Math.max(MIN_WORK_HEIGHT, t.height - (fieldworks ? FIELDWORKS_STEP : RAISE_STEP)));
      out.push({ x: t.x, z: t.z, kind: 'lower', height: t.height });
    }
  }
  return out;
}

/** At the end of a round: barricades count down, and fall when their time is up. */
export function tickWorks(tiles: readonly TileData[]): WorkChange[] {
  const out: WorkChange[] = [];
  for (const t of tiles) {
    if (!t.works) continue;
    t.works.rounds--;
    if (t.works.rounds > 0) continue;
    collapse(t);
    out.push({ x: t.x, z: t.z, kind: 'collapse', height: t.height });
  }
  return out;
}
