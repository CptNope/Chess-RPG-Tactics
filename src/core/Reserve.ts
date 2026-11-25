/**
 * Reserve training (0.37.0): squad members who sat a battle out drill at camp while the party
 * fights, and earn a share of each win's spoils. Before 0.37 they earned nothing, so a big squad's
 * bench fell further behind with every battle.
 */
import { JobSystem, JpGain } from './JobSystem';
import type { Unit } from './types';

/** EXP and JP a survivor in the party earns for a win (the spoils screen's base amounts). */
export const PARTY_EXP = 40;
export const PARTY_JP = 60;

/**
 * The reserve's share of a surviving party member's spoils: half, with no kill bonus. A party
 * member who fell takes the same half share, so sitting out never pays better than falling.
 */
export const RESERVE_SHARE = 0.5;
export const RESERVE_EXP = Math.round(PARTY_EXP * RESERVE_SHARE);
export const RESERVE_JP = Math.round(PARTY_JP * RESERVE_SHARE);

export interface ReserveGain {
  unit: Unit;
  exp: number;
  jp: number;
  /** Character levels gained. */
  levels: number;
  /** What the JP did for the unit's current job (a level, mastery, a job unlocked). */
  job: JpGain;
}

/** The squad members who sat this battle out. */
export function reserveOf(squad: Unit[], deployedIds: string[]): Unit[] {
  return squad.filter((u) => !deployedIds.includes(u.id));
}

/**
 * Trains the reserve after a win: each unit not in the party earns RESERVE_EXP and RESERVE_JP
 * (JP into its current job; JP Boost still counts, as it would on the field).
 */
export function trainReserve(squad: Unit[], deployedIds: string[]): ReserveGain[] {
  return reserveOf(squad, deployedIds).map((unit) => {
    const jp = Math.round(RESERVE_JP * (unit.equippedAbilities.support === 'sq_jp_boost' ? 1.5 : 1));
    const job = JobSystem.gainJp(unit, jp);
    const levels = JobSystem.grantExp(unit, RESERVE_EXP);
    return { unit, exp: RESERVE_EXP, jp, levels, job };
  });
}
