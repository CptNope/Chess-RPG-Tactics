/**
 * Hazards and zones (0.48.0): ground that does something.
 *
 * A tile can carry a hazard that works on whoever starts a turn on it, on either side:
 * - Embers: burning ground, 10% of max HP.
 * - Miasma: bog gas, Poisons (gear that guards against Poison keeps it off).
 * - Spring: a healing spring, 12% of max HP, and Poison washed off.
 * A monster that thrives on a kind (0.51.0) is healed 10% by it instead.
 *
 * Tiles can also be marked as a zone, for the "hold" objective: when a round ends with the hero's
 * side on the zone and no foe on it, the hold counts one round. Hold it for the objective's
 * rounds (not necessarily in a row) and the battle is won.
 *
 * Pure rules on units and tiles; the battle screen, the balance sim, the AI and a server call them.
 */
import { BattleObjective, StatusEffectType, TileData, Unit } from './types';
import { allianceOf } from './Sides';
import { JOBS } from '../data/jobs';

export type HazardKind = 'embers' | 'miasma' | 'spring';
export const HAZARD_KINDS: HazardKind[] = ['embers', 'miasma', 'spring'];

export const HAZARDS: Record<HazardKind, { name: string; blurb: string }> = {
  embers: { name: 'Embers', blurb: 'Burning ground: 10% of max HP at the start of a turn here.' },
  miasma: { name: 'Miasma', blurb: 'Bog gas: Poisons whoever starts a turn here.' },
  spring: { name: 'Spring', blurb: 'A healing spring: 12% of max HP and Poison washed off at the start of a turn here.' },
};

export const EMBERS_SHARE = 0.1;
export const SPRING_SHARE = 0.12;
/** Rounds a "hold" objective needs when it doesn't say. */
export const HOLD_ROUNDS = 3;

/** What a hazard did to a unit starting its turn on it. */
export interface HazardPulse {
  kind: HazardKind;
  damage?: number;
  heal?: number;
  status?: StatusEffectType;
  /** The spring washed Poison off. */
  cured?: boolean;
  /** A creature that thrives on this ground was healed by it (0.51.0). */
  thrives?: boolean;
}

const has = (u: Unit, s: StatusEffectType) => u.statuses.some((x) => x.type === s);

/** What the tile's hazard would do to the unit, without doing it. Null when nothing. */
export function hazardFor(unit: Unit, tile: TileData | undefined): HazardPulse | null {
  const kind = tile?.hazard;
  if (!kind || unit.isDead) return null;
  // A creature that thrives on it (0.51.0): an Emberback basks in embers, a Bog Lurker breathes miasma
  if (JOBS[unit.jobId]?.innate?.thrives?.includes(kind)) {
    const heal = Math.min(unit.maxHp - unit.currentHp, Math.max(1, Math.round(unit.maxHp * EMBERS_SHARE)));
    return heal > 0 ? { kind, heal, thrives: true } : null;
  }
  // Gear that keeps the ground off (the Cinderwalk Charm)
  if (Object.values(unit.equipment).some((it) => it?.traits?.hazardproof?.includes(kind))) return null;
  if (kind === 'embers') return { kind, damage: Math.max(1, Math.round(unit.maxHp * EMBERS_SHARE)) };
  if (kind === 'miasma') return has(unit, 'poison') ? null : { kind, status: 'poison' };
  const heal = Math.min(unit.maxHp - unit.currentHp, Math.max(1, Math.round(unit.maxHp * SPRING_SHARE)));
  const cured = has(unit, 'poison');
  return heal > 0 || cured ? { kind, ...(heal > 0 ? { heal } : {}), ...(cured ? { cured } : {}) } : null;
}

/** Applies the tile's hazard to a unit starting its turn on it. Returns what it did, or null. */
export function applyHazard(unit: Unit, tile: TileData | undefined, applyStatus: (u: Unit, s: StatusEffectType) => boolean): HazardPulse | null {
  const p = hazardFor(unit, tile);
  if (!p) return null;
  if (p.damage) {
    unit.currentHp = Math.max(0, unit.currentHp - p.damage);
    if (unit.currentHp === 0) unit.isDead = true;
  }
  if (p.heal) unit.currentHp = Math.min(unit.maxHp, unit.currentHp + p.heal);
  if (p.cured) unit.statuses = unit.statuses.filter((s) => s.type !== 'poison');
  if (p.status && !applyStatus(unit, p.status)) return null; // its gear kept the Poison off
  return p;
}

/** The zone's tiles as "x,z" keys. */
export function zoneKeys(tiles: readonly TileData[]): Set<string> {
  return new Set(tiles.filter((t) => t.zone).map((t) => `${t.x},${t.z}`));
}

/** The side holding the zone: the only alliance with someone standing on it. Null if empty or contested. */
export function zoneHolder(units: readonly Unit[], zone: ReadonlySet<string>): string | null {
  const sides = new Set(units.filter((u) => !u.isDead && !u.tamed && zone.has(`${u.x},${u.z}`)).map(allianceOf));
  return sides.size === 1 ? [...sides][0] : null;
}

/** Rounds a hold objective needs. */
export const holdGoal = (objective: BattleObjective | undefined): number => objective?.rounds || HOLD_ROUNDS;

// ---------------------------------------------------------------------------
// Spells that change the ground (0.50.0)
// ---------------------------------------------------------------------------

/** Rounds a spell's embers or miasma last; rounds embers stay out once doused. */
export const SCORCH_ROUNDS = 2;
export const DOUSE_ROUNDS = 3;

/** A tile's ground after a change: its hazard now (none when undefined). */
export interface GroundChange {
  x: number;
  z: number;
  hazard?: HazardKind;
}

/**
 * What an ability does to the ground it lands on, by rule so new spells join in:
 * a fire spell with an area leaves embers, an ice spell with an area douses embers, and a
 * Poison cloud leaves miasma. Totems, traps, heals and items leave the ground alone.
 */
export function groundFrom(ability: { element: string; aoe: number; power: number; appliesStatus?: string; totem?: unknown; trap?: unknown; item?: unknown }): 'embers' | 'miasma' | 'douse' | null {
  if (ability.totem || ability.trap || ability.item || ability.power < 0) return null;
  if (ability.element === 'fire' && ability.aoe >= 1 && ability.power > 0) return 'embers';
  if (ability.element === 'ice' && ability.aoe >= 1) return 'douse';
  if (ability.appliesStatus === 'poison') return 'miasma';
  return null;
}

/** Sets a lasting-for-now hazard on a tile, remembering what the map had there. */
function setTemp(tile: TileData, hazard: HazardKind | undefined, rounds: number): void {
  if (!tile.temp) tile.temp = { rounds, ...(tile.hazard ? { was: tile.hazard } : {}) };
  else tile.temp.rounds = rounds;
  if (hazard) tile.hazard = hazard;
  else delete tile.hazard;
}

/**
 * Applies an ability's ground effect over its area: every tile within `aoe` steps of (cx, cz).
 * Embers never take on water or snow, nothing overwrites a spring, and `spare` (the caster, for a
 * burst around itself) is left alone. Returns the tiles changed.
 */
export function changeGround(getTile: (x: number, z: number) => TileData | undefined, ability: Parameters<typeof groundFrom>[0], cx: number, cz: number, spare?: { x: number; z: number }): GroundChange[] {
  const effect = groundFrom(ability);
  if (!effect) return [];
  const out: GroundChange[] = [];
  for (let dz = -ability.aoe; dz <= ability.aoe; dz++) for (let dx = -ability.aoe; dx <= ability.aoe; dx++) {
    if (Math.abs(dx) + Math.abs(dz) > ability.aoe) continue;
    const t = getTile(cx + dx, cz + dz);
    if (!t || !t.walkable || t.hazard === 'spring') continue;
    if (spare && t.x === spare.x && t.z === spare.z) continue; // a burst around its caster spares the caster's tile
    if (effect === 'embers') {
      if (t.terrain === 'water' || t.terrain === 'snow') continue;
      setTemp(t, 'embers', SCORCH_ROUNDS);
    } else if (effect === 'miasma') {
      if (t.hazard === 'embers') continue; // the gas burns off over fire
      setTemp(t, 'miasma', SCORCH_ROUNDS);
    } else {
      if (t.hazard !== 'embers') continue;
      setTemp(t, undefined, DOUSE_ROUNDS);
    }
    out.push({ x: t.x, z: t.z, ...(t.hazard ? { hazard: t.hazard } : {}) });
  }
  return out;
}

/** At the end of a round: counts the spells' ground down, and puts the map's own back when it runs out. */
export function tickGround(tiles: readonly TileData[]): GroundChange[] {
  const out: GroundChange[] = [];
  for (const t of tiles) {
    if (!t.temp) continue;
    t.temp.rounds--;
    if (t.temp.rounds > 0) continue;
    if (t.temp.was) t.hazard = t.temp.was;
    else delete t.hazard;
    delete t.temp;
    out.push({ x: t.x, z: t.z, ...(t.hazard ? { hazard: t.hazard } : {}) });
  }
  return out;
}
