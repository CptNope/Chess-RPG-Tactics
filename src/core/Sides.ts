/**
 * Who fights whom (0.41.0). Every "is that an enemy?" question in the rules goes through here, so
 * a battle with more than two sides, or with allied sides, only has to change what a unit's
 * alliance is.
 *
 * A unit's alliance is its team unless it is given one: the campaign never sets it (the squad and
 * the enemy are two sides). Versus will give, say, two teams one alliance for a 2v2.
 */
import type { Team, Unit } from './types';

type Sided = Pick<Unit, 'team' | 'alliance'>;

/** The side a unit fights for. */
export function allianceOf(u: Sided): string {
  return u.alliance ?? u.team;
}

/** True when the two fight on the same side (a unit is its own ally). */
export function isAlly(a: Sided, b: Sided): boolean {
  return allianceOf(a) === allianceOf(b);
}

/** True when the two fight on opposite sides. */
export function isFoe(a: Sided, b: Sided): boolean {
  return allianceOf(a) !== allianceOf(b);
}

/** Moves a unit to another unit's side (Tame): its team and its alliance. */
export function joinSide(unit: Unit, side: Sided): void {
  unit.team = side.team as Team;
  if (side.alliance === undefined) delete unit.alliance;
  else unit.alliance = side.alliance;
}

/** The alliances that still have someone standing. */
export function sidesStanding(units: readonly (Sided & Pick<Unit, 'isDead'>)[]): Set<string> {
  const out = new Set<string>();
  for (const u of units) if (!u.isDead) out.add(allianceOf(u));
  return out;
}
