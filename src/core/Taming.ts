/**
 * Taming (0.28.0): the Beast Tamer's Tame wins a monster over.
 *
 * A tamed monster changes sides on the spot and fights for the squad, under the player's orders,
 * for the rest of the battle. If it is still standing when the battle is won, it joins the squad
 * as a beast: it keeps its job and level and never changes job. Its fangs, hide and glow are its
 * gear (see data/monsters.ts); from 0.29.0 it can also wear beast gear, barding and a collar. With the squad full it goes back to the wild.
 *
 * Only monsters can be tamed, never a boss, and only by the player's side. The weaker the monster,
 * the likelier it gives in: a sleeping one is easier still, and Beast Lore helps.
 */
import { Unit } from './types';
import { JOBS } from '../data/jobs';
import { JobSystem } from './JobSystem';

/** Ids of beasts in the squad start with this. Like hired units, they can be let go. */
export const BEAST_PREFIX = 'beast-';

/** The support that makes a tamer better with beasts. */
export const BEAST_LORE = 'ta_beast_lore';

/** Names for beasts that join the squad, by monster. */
export const BEAST_NAMES: Record<string, string[]> = {
  wolf: ['Fang', 'Ashpaw', 'Moonjaw', 'Grizzle', 'Hush'],
  wyvern: ['Gale', 'Talon', 'Skyrend', 'Ember', 'Quill'],
  ooze: ['Gloop', 'Mudge', 'Burble', 'Sludgey', 'Wobble'],
  wisp: ['Flicker', 'Glim', 'Lantern', 'Will', 'Mote'],
  brute: ['Boulder', 'Crag', 'Rubble', 'Flint', 'Tor'],
  basilisk: ['Glare', 'Moss', 'Scute', 'Sunstone', 'Basil'],
  bone_knight: ['Sir Rattles', 'Marrow', 'Ossian', 'Grimsby', 'Sir Bones'],
  thornling: ['Bramble', 'Thistle', 'Nettle', 'Rosie', 'Burr']
};

const isMonster = (u: Unit) => !!JOBS[u.jobId]?.monster;

/** True when `caster` can try to tame `target` at all. */
export function canTame(caster: Unit, target: Unit): boolean {
  return caster.team === 'player' && target.team !== caster.team && isMonster(target)
    && !target.isBoss && !target.isDead && !target.tamed;
}

/**
 * The chance (10-95%) that Tame works: 15% on an unhurt monster, up to 90% on one nearly down.
 * Asleep +20, Beast Lore +15, from behind +10. 0 when the target can't be tamed.
 */
export function tameChance(caster: Unit, target: Unit, facing: 'front' | 'flank' | 'back' = 'front'): number {
  if (!canTame(caster, target)) return 0;
  const hurt = 1 - target.currentHp / Math.max(1, target.maxHp);
  let chance = 15 + Math.round(75 * hurt);
  if (target.statuses.some((s) => s.type === 'sleep')) chance += 20;
  if (caster.equippedAbilities.support === BEAST_LORE) chance += 15;
  if (facing === 'back') chance += 10;
  return Math.min(95, Math.max(10, chance));
}

/** Wins the monster over: it wakes, and fights for the caster's side from now on. */
export function tame(caster: Unit, target: Unit): void {
  target.team = caster.team;
  target.tamed = true;
  target.statuses = target.statuses.filter((s) => s.type !== 'sleep');
  JobSystem.recalculateDerivedStats(target);
}

/** True for a beast in the squad. */
export function isBeast(u: Pick<Unit, 'id'>): boolean {
  return u.id.startsWith(BEAST_PREFIX);
}

/** A name for a new beast: the first of its kind's names nobody in the squad has. */
export function beastName(jobId: string, taken: string[]): string {
  const names = BEAST_NAMES[jobId] || [JOBS[jobId]?.name || 'Beast'];
  for (const n of names) if (!taken.includes(n)) return n;
  for (let k = 2; ; k++) {
    const n = `${names[0]} ${k}`;
    if (!taken.includes(n)) return n;
  }
}

/** The squad member a tamed monster becomes: its job and level, a name, full health. */
export function beastFromTamed(tamed: Unit, squad: Pick<Unit, 'id' | 'name'>[]): Unit {
  const ids = squad.map((u) => u.id);
  let n = 1;
  while (ids.includes(`${BEAST_PREFIX}${n}`)) n++;
  const u = JobSystem.createUnit(`${BEAST_PREFIX}${n}`, beastName(tamed.jobId, squad.map((s) => s.name)), 'player', tamed.jobId, 0, 0, 'N', tamed.level);
  u.currentHp = u.maxHp;
  u.currentMp = u.maxMp;
  return u;
}
