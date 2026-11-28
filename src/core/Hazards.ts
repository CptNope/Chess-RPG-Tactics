/**
 * Hazards and zones (0.48.0): ground that does something.
 *
 * A tile can carry a hazard that works on whoever starts a turn on it, on either side:
 * - Embers: burning ground, 10% of max HP.
 * - Miasma: bog gas, Poisons (gear that guards against Poison keeps it off).
 * - Spring: a healing spring, 12% of max HP, and Poison washed off.
 *
 * Tiles can also be marked as a zone, for the "hold" objective: when a round ends with the hero's
 * side on the zone and no foe on it, the hold counts one round. Hold it for the objective's
 * rounds (not necessarily in a row) and the battle is won.
 *
 * Pure rules on units and tiles; the battle screen, the balance sim, the AI and a server call them.
 */
import { BattleObjective, StatusEffectType, TileData, Unit } from './types';
import { allianceOf } from './Sides';

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
}

const has = (u: Unit, s: StatusEffectType) => u.statuses.some((x) => x.type === s);

/** What the tile's hazard would do to the unit, without doing it. Null when nothing. */
export function hazardFor(unit: Unit, tile: TileData | undefined): HazardPulse | null {
  const kind = tile?.hazard;
  if (!kind || unit.isDead) return null;
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
