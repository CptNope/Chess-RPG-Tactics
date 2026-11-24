/**
 * Enemy item pouches (0.31.0). Some enemies carry a few consumables and use them like the
 * player does: a Potion when hurt, a Remedy for a sleeping friend, a Phoenix Feather for a
 * fallen one (which counts against the side's raises). What they don't use, the squad
 * salvages after a victory.
 *
 * Easy: nobody carries anything. Normal: bosses, Chemists and every third enemy (by its place
 * in the roster) carry a Potion or two. Hard: every enemy does, and Chemists bring more.
 * Monsters never carry items. From level 9 Potions become Hi-Potions.
 */
import { Unit } from './types';
import { Difficulty } from './Difficulty';
import { JOBS } from '../data/jobs';
import { MAX_STACK } from '../data/consumables';

export type Pouch = Record<string, number>;

/**
 * How far ahead enemies think (0.31.0): not on Easy; on Normal they steer clear of spots where
 * they'd likely fall; on Hard they also pick safer spots and pull hurt units back.
 */
export function enemyCaution(difficulty: Difficulty): false | 'light' | 'full' {
  return difficulty === 'easy' ? false : difficulty === 'hard' ? 'full' : 'light';
}

export function enemyPouch(u: Unit, index: number, difficulty: Difficulty): Pouch {
  if (difficulty === 'easy' || JOBS[u.jobId]?.monster) return {};
  const hard = difficulty === 'hard';
  const potion = u.level >= 9 ? 'hi_potion' : 'potion';
  const p: Pouch = {};
  if (u.isBoss) p[potion] = hard ? 2 : 1;
  else if (u.jobId === 'chemist') {
    p[potion] = 2;
    p.remedy = 1;
    if (hard) { p.phoenix_feather = 1; if (u.level >= 6) p.blast_flask = 1; }
  } else if (hard || index % 3 === 0) p[potion] = 1;
  return p;
}

/** A one-line list for the unit card, e.g. "Potion ×2, Remedy". Empty when nothing is left. */
export function pouchText(pouch: Pouch | undefined, names: Record<string, { name: string }>): string {
  return Object.entries(pouch || {}).filter(([, n]) => n > 0).map(([id, n]) => `${names[id]?.name || id}${n > 1 ? ` ×${n}` : ''}`).join(', ');
}

/** Adds what fallen enemies didn't use to the squad's supplies; returns what was added. */
export function salvage(enemies: Unit[], inventory: Record<string, number>): Pouch {
  const got: Pouch = {};
  for (const e of enemies) {
    if (!e.isDead || e.team !== 'enemy') continue;
    for (const [id, n] of Object.entries(e.pouch || {})) {
      const room = MAX_STACK - (inventory[id] || 0);
      const take = Math.min(n, room);
      if (take <= 0) continue;
      inventory[id] = (inventory[id] || 0) + take;
      got[id] = (got[id] || 0) + take;
    }
  }
  return got;
}
