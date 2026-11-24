/**
 * Performances (0.22.0): Bard songs and Dancer dances.
 *
 * A performance is an area centred on the performer. When it is used, it takes effect at once and
 * the performer gains Encore: at the start of each of their next turns (three, or five with the
 * Dancer's Encore support) it plays again, for free, before they act. It ends early when the
 * performer moves, uses any other action, falls asleep, is silenced or falls.
 *
 * Pure rules on units; the battle screen calls them and shows what happened.
 */
import { Ability, Unit } from './types';
import { JOBS } from '../data/jobs';

/**
 * True for an area around the caster rather than at a target: songs, dances and centred
 * signatures. Aimed at the caster's own tile, never range-checked, and with no splash falloff
 * (nobody stands at the aimed tile but the caster).
 */
export function isCentered(ability: Ability): boolean {
  return !!(ability.performance || ability.centered);
}

/** Turns a performance plays again after the one it was started on. */
export const ENCORE_TURNS = 3;
/** Extra turns with the Dancer's support ability. */
export const ENCORE_SUPPORT_BONUS = 2;

const findAbility = (id: string): Ability | undefined => {
  for (const job of Object.values(JOBS)) {
    const a = job.abilities.find((x) => x.id === id);
    if (a) return a;
  }
  return undefined;
};

/** How many turns a unit's performance repeats. */
export function encoreTurns(unit: Unit): number {
  return ENCORE_TURNS + (unit.equippedAbilities.support === 'dn_encore' ? ENCORE_SUPPORT_BONUS : 0);
}

/** A performance as this unit gives it: the Bard's Resonance carries it a tile further. */
export function performedBy(unit: Unit, ability: Ability): Ability {
  if (!ability.performance || unit.equippedAbilities.support !== 'bd_resonance') return ability;
  return { ...ability, aoe: ability.aoe + 1 };
}

/**
 * Starts (or restarts) a performance. The Encore status counts down at the end of each of the
 * unit's turns, so it is set one higher than the number of repeats: the turn it starts on uses one.
 */
export function startPerformance(unit: Unit, ability: Ability): void {
  if (!ability.performance) return;
  unit.performing = ability.id;
  const duration = encoreTurns(unit) + 1;
  const existing = unit.statuses.find((s) => s.type === 'encore');
  if (existing) existing.duration = duration;
  else unit.statuses.push({ type: 'encore', duration });
}

/** Ends a performance, if there is one. Returns true when one was playing. */
export function endPerformance(unit: Unit): boolean {
  const was = !!unit.performing || unit.statuses.some((s) => s.type === 'encore');
  unit.performing = undefined;
  unit.statuses = unit.statuses.filter((s) => s.type !== 'encore');
  return was;
}

/**
 * The performance due to play again at the start of this unit's turn, or null. A performer who
 * can no longer keep it up (fallen, asleep, silenced) stops instead.
 */
export function encoreDue(unit: Unit): Ability | null {
  if (!unit.performing) return null;
  if (!unit.statuses.some((s) => s.type === 'encore')) {
    unit.performing = undefined;
    return null;
  }
  if (unit.isDead || unit.statuses.some((s) => s.type === 'sleep' || s.type === 'silence')) {
    endPerformance(unit);
    return null;
  }
  const ability = findAbility(unit.performing);
  if (!ability?.performance) {
    endPerformance(unit);
    return null;
  }
  return performedBy(unit, ability);
}
