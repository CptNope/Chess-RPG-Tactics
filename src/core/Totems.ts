/**
 * Totems (0.47.0): the Shaman plants spirits on the field.
 *
 * A totem stands on a tile for a few of its Shaman's turns. Whoever starts a turn within its
 * radius feels it: Mending heals allies, Warding gives them Protect, Binding Slows foes and Storm
 * strikes foes with lightning. It also pulses once on everyone in range when it is planted.
 *
 * - A Shaman keeps up to MAX_TOTEMS. Planting a kind it already has moves that one; past the
 *   limit, the oldest crumbles.
 * - Totems count down at the end of each of the Shaman's turns (Deep Roots adds two) and crumble
 *   when the Shaman falls.
 * - They block nothing: units walk through and stand on a totem's tile.
 *
 * Pure rules on units; the battle screen, the balance sim, the AI and a server call them.
 */
import { Ability, StatusEffectType, Unit } from './types';
import { isAlly } from './Sides';
import { JobSystem } from './JobSystem';

export type TotemKind = 'mending' | 'warding' | 'binding' | 'storm' | 'ancestral';

export interface Totem {
  kind: TotemKind;
  x: number;
  z: number;
  /** Tiles (steps) it reaches from where it stands. */
  radius: number;
  /** The Shaman's turn-ends left before it crumbles. */
  turns: number;
}

/** What a totem did to one unit. */
export interface TotemPulse {
  kind: TotemKind;
  heal?: number;
  damage?: number;
  status?: StatusEffectType;
}

export const MAX_TOTEMS = 2;
export const TOTEM_TURNS = 3;
/** Deep Roots (support) lets totems stand this much longer. */
export const DEEP_ROOTS = 'sh_deep_roots';
export const DEEP_ROOTS_TURNS = 2;

/** Mending (and the Ancestral totem) heals this share of max HP. */
export const MENDING_SHARE = 0.08;
/** Storm strikes with this share of a spell's force (MAG × 3). */
export const STORM_POWER = 0.5;

/** Who a kind of totem helps: its Shaman's side, or the other one. */
const KIND_HELPS: Record<TotemKind, 'allies' | 'foes' | 'both'> = {
  mending: 'allies',
  warding: 'allies',
  binding: 'foes',
  storm: 'foes',
  ancestral: 'both',
};

const has = (u: Unit, s: StatusEffectType) => u.statuses.some((x) => x.type === s);
const steps = (ax: number, az: number, bx: number, bz: number) => Math.abs(ax - bx) + Math.abs(az - bz);

/** True when (x, z) is within the totem's reach. */
export function inReach(t: Totem, x: number, z: number): boolean {
  return steps(t.x, t.z, x, z) <= t.radius;
}

/** Every standing totem of a living Shaman, with its Shaman. */
export function standingTotems(units: readonly Unit[]): { owner: Unit; totem: Totem }[] {
  return units.flatMap((owner) => (owner.isDead ? [] : (owner.totems ?? []).map((totem) => ({ owner, totem }))));
}

/** Plants a totem for `ability` at (x, z). Returns the totem. */
export function plantTotem(owner: Unit, ability: Ability, x: number, z: number): Totem {
  const kind = ability.totem!;
  const turns = TOTEM_TURNS + (owner.equippedAbilities.support === DEEP_ROOTS ? DEEP_ROOTS_TURNS : 0);
  const totem: Totem = { kind, x, z, radius: ability.aoe, turns };
  let mine = (owner.totems ?? []).filter((t) => t.kind !== kind);
  if (mine.length >= MAX_TOTEMS) mine = mine.slice(mine.length - MAX_TOTEMS + 1);
  owner.totems = [...mine, totem];
  return totem;
}

/** Counts a Shaman's totems down at the end of its turn; the spent ones crumble. */
export function tickTotems(owner: Unit): void {
  if (!owner.totems?.length) return;
  owner.totems = owner.totems.map((t) => ({ ...t, turns: t.turns - 1 })).filter((t) => t.turns > 0);
}

/** Clears a Shaman's totems (it fell, was raised, or a new battle starts). */
export function clearTotems(owner: Unit): void {
  owner.totems = undefined;
}

/** What one totem does to one unit, without doing it. Null when it leaves the unit be. */
export function pulseFor(owner: Unit, totem: Totem, unit: Unit): TotemPulse | null {
  if (unit.isDead || !inReach(totem, unit.x, unit.z)) return null;
  const friend = isAlly(unit, owner);
  const helps = KIND_HELPS[totem.kind];
  if ((helps === 'allies' && !friend) || (helps === 'foes' && friend)) return null;
  const kind = totem.kind;
  if (friend && (kind === 'mending' || kind === 'ancestral') && unit.currentHp < unit.maxHp) {
    const heal = Math.min(unit.maxHp - unit.currentHp, Math.max(1, Math.round(unit.maxHp * MENDING_SHARE)));
    return kind === 'ancestral' && !has(unit, 'protect') ? { kind, heal, status: 'protect' } : { kind, heal };
  }
  if (friend && (kind === 'warding' || kind === 'ancestral') && !has(unit, 'protect')) return { kind, status: 'protect' };
  if (!friend && (kind === 'binding' || kind === 'ancestral') && !has(unit, 'slow') && !has(unit, 'haste')) return { kind, status: 'slow' };
  if (!friend && kind === 'storm') {
    const shell = has(unit, 'shell') ? 0.7 : 1;
    return { kind, damage: Math.max(1, Math.round(JobSystem.getMagicPower(owner) * 3 * STORM_POWER * shell)) };
  }
  return null;
}

/** Applies a pulse. A harmful status that the unit's gear guards against doesn't land. */
export function applyPulse(unit: Unit, pulse: TotemPulse, applyStatus: (u: Unit, s: StatusEffectType) => boolean): TotemPulse | null {
  if (pulse.heal) unit.currentHp = Math.min(unit.maxHp, unit.currentHp + pulse.heal);
  if (pulse.damage) {
    unit.currentHp = Math.max(0, unit.currentHp - pulse.damage);
    if (unit.currentHp === 0) unit.isDead = true;
  }
  if (pulse.status && !applyStatus(unit, pulse.status)) {
    if (!pulse.heal && !pulse.damage) return null;
    return { ...pulse, status: undefined };
  }
  return pulse;
}

/** Every totem's pulse on a unit starting its turn (or standing in a new totem's reach). */
export function pulsesOn(unit: Unit, units: readonly Unit[], applyStatus: (u: Unit, s: StatusEffectType) => boolean, only?: Totem): TotemPulse[] {
  const out: TotemPulse[] = [];
  for (const { owner, totem } of standingTotems(units)) {
    if (only && totem !== only) continue;
    if (unit.isDead) break;
    const p = pulseFor(owner, totem, unit);
    if (!p) continue;
    const done = applyPulse(unit, p, applyStatus);
    if (done) out.push(done);
  }
  return out;
}

/** Totals for the battle log and the floating numbers. */
export function sumPulses(pulses: readonly TotemPulse[]): { heal: number; damage: number; statuses: StatusEffectType[] } {
  return {
    heal: pulses.reduce((s, p) => s + (p.heal ?? 0), 0),
    damage: pulses.reduce((s, p) => s + (p.damage ?? 0), 0),
    statuses: [...new Set(pulses.flatMap((p) => (p.status ? [p.status] : [])))],
  };
}
