/**
 * Necromancy (0.52.0): the Necromancer works with the fallen.
 *
 * - **Raise Thrall** lifts a fallen foe back up on the caster's side, with part of its HP, for a
 *   few of its own turns (the `thrall` status counts them). When they run out, or it falls
 *   again, it crumbles: it lies dead once more, back on the side it came from, and can't be
 *   raised as a thrall again. An enemy Necromancer can do the same to your fallen.
 * - **Corpse Burst** makes a body explode, hurting those around it; the body is spent.
 *
 * A body can be worked when it lies on a tile nobody stands on. Bosses can't be raised.
 * Pure rules on units; the battle screen, the balance sim, the AI and a server call them.
 */
import { Ability, Unit } from './types';
import { allianceOf, isFoe, joinSide } from './Sides';
import { JobSystem } from './JobSystem';

/** Thralls rise with this share of max HP, for this many of their own turns (Dark Pact: more). */
export const THRALL_HP = 0.4;
export const THRALL_TURNS = 3;
export const DARK_PACT = 'nc_dark_pact';
export const DARK_PACT_HP = 0.6;
export const DARK_PACT_TURNS = 5;

/** Bodies (fallen units) lying on tiles nobody stands on, not yet spent. */
export function bodies(units: readonly Unit[]): Unit[] {
  return units.filter((u) => u.isDead && !u.spent && !units.some((o) => !o.isDead && o.x === u.x && o.z === u.z));
}

/** The body at (x, z), if one can be worked there. */
export function bodyAt(units: readonly Unit[], x: number, z: number): Unit | undefined {
  return bodies(units).find((u) => u.x === x && u.z === z);
}

/** True when `caster` can raise `body` as a thrall: a fallen foe, not a boss, never raised before. */
export function canRaise(caster: Unit, body: Unit, units: readonly Unit[]): boolean {
  return body.isDead && !body.isBoss && !body.spent && !body.tamed && isFoe(body, caster) && bodies(units).includes(body);
}

/** A body at (x, z) the caster can raise: two can lie on one tile, and only a foe's will rise. */
export function raisableAt(caster: Unit, units: readonly Unit[], x: number, z: number): Unit | undefined {
  return bodies(units).find((b) => b.x === x && b.z === z && canRaise(caster, b, units));
}

/** Raises a fallen foe on the caster's side. */
export function raiseThrall(caster: Unit, body: Unit): void {
  const pact = caster.equippedAbilities.support === DARK_PACT;
  body.thrall = { team: body.team, ...(body.alliance !== undefined ? { alliance: body.alliance } : {}) };
  joinSide(body, caster);
  body.isDead = false;
  body.statuses = [{ type: 'thrall', duration: pact ? DARK_PACT_TURNS : THRALL_TURNS }];
  body.calling = undefined;
  body.totems = undefined;
  JobSystem.recalculateDerivedStats(body);
  body.currentHp = Math.max(1, Math.round(body.maxHp * (pact ? DARK_PACT_HP : THRALL_HP)));
  body.ct = 0;
}

/** A thrall crumbles: dead again, back on its own side, never to be raised again. */
export function crumble(u: Unit): void {
  if (!u.thrall) return;
  joinSide(u, u.thrall);
  u.thrall = undefined;
  u.isDead = true;
  u.currentHp = 0;
  u.spent = true;
  u.statuses = [];
}

/** At the end of a thrall's turn: its time ran out (the status is gone) and it crumbles. */
export function settleThrall(u: Unit): boolean {
  if (!u.thrall || u.statuses.some((s) => s.type === 'thrall')) return false;
  crumble(u);
  return true;
}

/** The side a thrall really belongs to (its own for anyone else). */
export const homeSide = (u: Unit): string => (u.thrall ? (u.thrall.alliance ?? u.thrall.team) : allianceOf(u));

/** Every thrall that has fallen crumbles (run after anything that can fell a unit). Returns them. */
export function settleFallenThralls(units: readonly Unit[]): Unit[] {
  const out: Unit[] = [];
  for (const u of units) if (u.isDead && u.thrall) { crumble(u); out.push(u); }
  return out;
}

/** For a Corpse Burst: the body the ability is aimed at, which it spends. */
export function spendBody(units: readonly Unit[], x: number, z: number): Unit | undefined {
  const b = bodyAt(units, x, z);
  if (b) b.spent = true;
  return b;
}

/** Abilities that work on a body rather than on someone standing. */
export const worksOnBodies = (a: Pick<Ability, 'thrall' | 'corpseBurst'>): boolean => !!(a.thrall || a.corpseBurst);
