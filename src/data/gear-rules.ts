/**
 * Equipment rules (0.30.0): what each job can use.
 *
 * - **Weapons** go by type: each job lists the types it fights with. Fists always work.
 * - **Shields** only for the jobs that carry one.
 * - **Heavy armor** (mail, plate) and **helms** only for the front line.
 * - **Robes** only for spellcasters.
 * - Everything else is light: clothes, caps, hats, circlets and every accessory, for anyone.
 *
 * Beasts (0.28.0) follow their own rule: beast gear only (see JobSystem.canEquip).
 */
import { Item, WeaponType } from '../core/types';
import { JOBS } from './jobs';

export interface JobGear {
  weapons: WeaponType[];
  shield?: boolean;
  /** Heavy armor and helms. */
  heavy?: boolean;
  /** Robes. */
  robe?: boolean;
}

export const JOB_GEAR: Record<string, JobGear> = {
  squire: { weapons: ['sword', 'dagger'], shield: true, heavy: true },
  knight: { weapons: ['sword', 'spear'], shield: true, heavy: true },
  archer: { weapons: ['bow', 'dagger'] },
  black_mage: { weapons: ['staff'], robe: true },
  white_mage: { weapons: ['staff'], robe: true },
  dragoon: { weapons: ['spear'], heavy: true },
  ninja: { weapons: ['dagger'] },
  geomancer: { weapons: ['staff', 'sword'], heavy: true, robe: true },
  time_mage: { weapons: ['staff'], robe: true },
  chemist: { weapons: ['dagger', 'staff'] },
  monk: { weapons: ['knuckles'] },
  thief: { weapons: ['dagger', 'knuckles'] },
  summoner: { weapons: ['staff'], robe: true },
  oracle: { weapons: ['staff'], robe: true },
  paladin: { weapons: ['sword'], shield: true, heavy: true },
  spellblade: { weapons: ['sword', 'dagger'], shield: true, robe: true },
  bard: { weapons: ['bow', 'staff'], robe: true },
  dancer: { weapons: ['dagger', 'whip'] },
  tamer: { weapons: ['whip', 'dagger', 'bow'] },
  gunner: { weapons: ['gun', 'dagger'] },
  dark_knight: { weapons: ['sword', 'spear'], heavy: true },
  shaman: { weapons: ['staff'], robe: true }
};

/** What kind of gear an item is, as the rules see it. */
export type GearKind = WeaponType | 'shield' | 'heavy' | 'robe' | 'light';

export function gearKind(item: Item): GearKind {
  if (item.slot === 'weapon') return item.weaponType || 'sword';
  if (item.slot === 'shield') return 'shield';
  if (item.armor) return item.armor;
  return 'light';
}

/** True when a person in this job can use the item (beast gear never). */
export function jobCanUse(jobId: string, item: Item): boolean {
  if (item.beast) return false;
  const g = JOB_GEAR[jobId];
  if (!g) return true; // a job without rules (a Workshop oddity) wears anything
  const kind = gearKind(item);
  if (item.slot === 'weapon') return g.weapons.includes(kind as WeaponType);
  if (kind === 'shield') return !!g.shield;
  if (kind === 'heavy') return !!g.heavy;
  if (kind === 'robe') return !!g.robe;
  return true;
}

/** The jobs (by name) that can use the item, or null when everyone can. */
export function whoCanUse(item: Item): string[] | null {
  if (item.beast) return ['Tamed beasts'];
  const ids = Object.keys(JOB_GEAR);
  const can = ids.filter((id) => jobCanUse(id, item));
  return can.length === ids.length ? null : can.map((id) => JOBS[id]?.name || id);
}

const KIND_NAME: Record<GearKind, string> = {
  sword: 'Swords', spear: 'Spears', bow: 'Bows', staff: 'Staves & rods', dagger: 'Daggers', knuckles: 'Knuckles', whip: 'Whips', gun: 'Guns',
  shield: 'Shields', heavy: 'Heavy armor & helms', robe: 'Robes', light: 'Light gear'
};

/** One line for a job's gear, e.g. "Swords, Spears · Shields · Heavy armor & helms". */
export function jobGearText(jobId: string): string {
  const g = JOB_GEAR[jobId];
  if (!g) return 'Anything';
  return [g.weapons.map((w) => KIND_NAME[w]).join(', '), g.shield && 'Shields', g.heavy && KIND_NAME.heavy, g.robe && KIND_NAME.robe].filter(Boolean).join(' · ');
}

/** The rules' name for an item's kind, e.g. "Heavy armor & helms". */
export const gearKindName = (item: Item): string => KIND_NAME[gearKind(item)];
