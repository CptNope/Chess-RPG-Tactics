/**
 * Grand summons (0.24.0): the Summoner's biggest calls take a turn to arrive.
 *
 * Using one spends the MP and the action at once, marks the area and gives the caster Calling.
 * At the start of the caster's next turn the creature arrives and hits whoever is standing in the
 * marked area then, before the caster acts. Foes can see it coming and get out of the way; allies
 * can step in for a heal. The call is broken if the caster falls, is put to sleep or is silenced.
 *
 * Pure rules on units; the battle screen, the balance sim and the AI call them.
 */
import { Ability, Unit } from './types';
import { isAlly } from './Sides';
import { JOBS } from '../data/jobs';

/**
 * Calling counts down at the end of each of the caster's turns: set to 2 when the call begins,
 * it is at 1 when their next turn starts, which is when the creature arrives.
 */
export const CALLING_TURNS = 2;

/** Enemies call grand summons only from this level up (a veteran's other spells come at 4). */
export const ENEMY_GRAND_SUMMON_LEVEL = 6;

const findAbility = (id: string): Ability | undefined => {
  for (const job of Object.values(JOBS)) {
    const a = job.abilities.find((x) => x.id === id);
    if (a) return a;
  }
  return undefined;
};

/** True for a summon that arrives on the caster's next turn. */
export function isGrandSummon(ability: Ability | null | undefined): boolean {
  return !!ability?.charge;
}

/** Begins a grand summon aimed at (x, z). */
export function startCall(unit: Unit, ability: Ability, x: number, z: number): void {
  if (!ability.charge) return;
  unit.calling = { abilityId: ability.id, x, z };
  const existing = unit.statuses.find((s) => s.type === 'calling');
  if (existing) existing.duration = CALLING_TURNS;
  else unit.statuses.push({ type: 'calling', duration: CALLING_TURNS });
}

/** Drops a call on its way, if there is one. Returns true when one was. */
export function breakCall(unit: Unit): boolean {
  const was = !!unit.calling || unit.statuses.some((s) => s.type === 'calling');
  unit.calling = undefined;
  unit.statuses = unit.statuses.filter((s) => s.type !== 'calling');
  return was;
}

/** A call that can still arrive: the caster is up, awake and able to speak. */
export function callHolds(unit: Unit): boolean {
  return !!unit.calling && !unit.isDead && !unit.statuses.some((s) => s.type === 'sleep' || s.type === 'silence');
}

export type CallOutcome = { ability: Ability; x: number; z: number } | 'broken' | null;

/**
 * At the start of the caster's turn: the summon that arrives now, 'broken' if the call was lost
 * since it began, or null when nothing was on its way. Either way the call is over afterwards.
 */
export function callDue(unit: Unit): CallOutcome {
  if (!unit.calling) return null;
  const { abilityId, x, z } = unit.calling;
  const holds = callHolds(unit);
  breakCall(unit);
  const ability = findAbility(abilityId);
  if (!holds || !ability?.charge) return 'broken';
  return { ability, x, z };
}

/** The tiles a call will land on: everything within its radius of the aim, on the board. */
export function callArea(unit: Unit, width: number, depth: number): { x: number; z: number }[] {
  if (!unit.calling) return [];
  const ability = findAbility(unit.calling.abilityId);
  if (!ability) return [];
  const { x: cx, z: cz } = unit.calling;
  const out: { x: number; z: number }[] = [];
  for (let x = cx - ability.aoe; x <= cx + ability.aoe; x++) {
    for (let z = cz - ability.aoe; z <= cz + ability.aoe; z++) {
      if (x < 0 || z < 0 || x >= width || z >= depth) continue;
      if (Math.abs(x - cx) + Math.abs(z - cz) <= ability.aoe) out.push({ x, z });
    }
  }
  return out;
}

/** The ability a unit is calling, if any. */
export function callingAbility(unit: Unit): Ability | undefined {
  return unit.calling ? findAbility(unit.calling.abilityId) : undefined;
}

/**
 * How dangerous it is to stand on (x, z) for `unit`: the number of foes' damaging calls that will
 * land there. The planner steers away from these tiles (0.24.0).
 */
export function callsLandingOn(unit: Unit, x: number, z: number, units: Unit[]): number {
  let n = 0;
  for (const c of units) {
    if (isAlly(c, unit) || !callHolds(c)) continue;
    const a = callingAbility(c);
    if (!a || a.power <= 0) continue;
    if (Math.abs(x - c.calling!.x) + Math.abs(z - c.calling!.z) <= a.aoe) n++;
  }
  return n;
}

/** The raise half of a summon that brings fallen allies back (Cinderwing). */
export function rebirthOf(ability: Ability): Ability | null {
  if (!ability.rebirth) return null;
  return { ...ability, power: 0, appliesStatus: undefined, revive: ability.rebirth, rebirth: undefined };
}
