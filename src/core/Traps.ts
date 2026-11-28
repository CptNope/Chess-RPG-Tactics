/**
 * Traps (0.49.0): the Ranger hides them on the field.
 *
 * A trap sits on an empty tile until a foe of the one who set it walks into it. The foe stops
 * there, on the trap, and it springs:
 * - Snare: Immobilize. Spikes: physical damage (the setter's ATK). Slumber: Sleep. Smoke: Blind.
 *
 * Traps are hidden from the other side: the battle screen draws only the squad's own, and the AI
 * never looks at a foe's traps. A Ranger keeps up to MAX_TRAPS (Trapsmith: more); past that the
 * oldest is pulled up. A trap stays when its Ranger falls (it's a thing in the ground) and is gone
 * once sprung. Allies walk over their side's traps safely.
 *
 * Pure rules on units; the battle screen, the balance sim, the AI and a server call them.
 */
import { Ability, StatusEffectType, Unit } from './types';
import { isFoe } from './Sides';

export type TrapKind = 'snare' | 'spikes' | 'slumber' | 'smoke';

export interface Trap {
  kind: TrapKind;
  x: number;
  z: number;
}

/** What a trap did to the foe who walked into it. */
export interface TrapSprung {
  kind: TrapKind;
  /** The Ranger whose trap it was. */
  owner: Unit;
  x: number;
  z: number;
  damage?: number;
  status?: StatusEffectType;
}

export const MAX_TRAPS = 3;
/** Trapsmith (support) keeps this many. */
export const TRAPSMITH = 'rg_trapsmith';
export const TRAPSMITH_MAX = 5;
/** Spikes hit for the setter's attack power × this (Protect cuts it). */
export const SPIKES_POWER = 2.4;

export const TRAP_STATUS: Partial<Record<TrapKind, StatusEffectType>> = { snare: 'immobilize', slumber: 'sleep', smoke: 'blind' };

const key = (x: number, z: number) => `${x},${z}`;

/** Every set trap, with whose it is. */
export function setTraps(units: readonly Unit[]): { owner: Unit; trap: Trap }[] {
  return units.flatMap((owner) => (owner.traps ?? []).map((trap) => ({ owner, trap })));
}

/** True when a trap (anyone's) already sits on (x, z). */
export function trapAt(units: readonly Unit[], x: number, z: number): boolean {
  return setTraps(units).some(({ trap }) => trap.x === x && trap.z === z);
}

/** How many traps a Ranger can keep. */
export const trapLimit = (owner: Unit) => (owner.equippedAbilities.support === TRAPSMITH ? TRAPSMITH_MAX : MAX_TRAPS);

/**
 * Sets the ability's traps around (x, z): one on the tile, or on every free tile within `aoe`
 * steps (the Killing Field). `free` says whether a tile can take one (walkable, empty, no trap).
 */
export function setTrapsAt(owner: Unit, ability: Ability, x: number, z: number, free: (x: number, z: number) => boolean): Trap[] {
  const kind = ability.trap!;
  const laid: Trap[] = [];
  for (let dz = -ability.aoe; dz <= ability.aoe; dz++) {
    for (let dx = -ability.aoe; dx <= ability.aoe; dx++) {
      if (Math.abs(dx) + Math.abs(dz) > ability.aoe) continue;
      if (free(x + dx, z + dz)) laid.push({ kind, x: x + dx, z: z + dz });
    }
  }
  const mine = [...(owner.traps ?? []), ...laid];
  const keep = Math.max(trapLimit(owner), laid.length);
  owner.traps = mine.slice(Math.max(0, mine.length - keep));
  return laid;
}

/**
 * The first foe's trap on a walk, after the first step. Null when the walk is clear.
 * `path` runs from where the unit stands to where it means to stop.
 */
export function trapOnPath(mover: Unit, path: readonly { x: number; z: number }[], units: readonly Unit[]): { owner: Unit; trap: Trap; index: number } | null {
  const traps = new Map(setTraps(units).filter(({ owner }) => isFoe(mover, owner)).map((t) => [key(t.trap.x, t.trap.z), t]));
  if (!traps.size) return null;
  for (let i = 1; i < path.length; i++) {
    const t = traps.get(key(path[i].x, path[i].z));
    if (t) return { ...t, index: i };
  }
  return null;
}

/** What the trap would do, given the victim's statuses. */
export function trapEffect(trap: Trap, victim: Unit, attackPower: number): Omit<TrapSprung, 'owner' | 'x' | 'z'> {
  if (trap.kind === 'spikes') {
    const protect = victim.statuses.some((s) => s.type === 'protect') ? 0.67 : 1;
    return { kind: 'spikes', damage: Math.max(1, Math.round(attackPower * SPIKES_POWER * protect)) };
  }
  return { kind: trap.kind, status: TRAP_STATUS[trap.kind] };
}

/**
 * Springs a trap on the foe standing on it: removes it from its Ranger and applies it.
 * A status the foe's gear guards against doesn't land (the trap is spent all the same).
 */
export function springTrap(owner: Unit, trap: Trap, victim: Unit, attackPower: number, applyStatus: (u: Unit, s: StatusEffectType) => boolean): TrapSprung {
  owner.traps = (owner.traps ?? []).filter((t) => t !== trap);
  const e = trapEffect(trap, victim, attackPower);
  if (e.damage) {
    victim.currentHp = Math.max(0, victim.currentHp - e.damage);
    if (victim.currentHp === 0) victim.isDead = true;
  }
  const landed = e.status && !victim.isDead ? applyStatus(victim, e.status) : false;
  return { owner, x: trap.x, z: trap.z, kind: e.kind, ...(e.damage ? { damage: e.damage } : {}), ...(landed ? { status: e.status } : {}) };
}
