/**
 * Consumable items: potions and the like, used with the Item command in battle.
 *
 * Unlike gear (a shared armory of unique pieces), consumables are counted: the squad carries a
 * stock of each, every use spends one, and they can be bought and sold at the market.
 */
import { Ability, Element } from '../core/types';
import { ShopProgress } from '../core/Economy';

export interface Consumable {
  id: string;
  name: string;
  description: string;
  price: number;
  /** How far it can be thrown (Manhattan tiles). */
  range: number;
  /** Radius of effect (0 = one unit). */
  aoe?: number;
  /** HP restored. */
  heal?: number;
  /** MP restored. */
  mp?: number;
  /** Removes every ailment. */
  cleanse?: boolean;
  /** Raises a fallen ally with this share of max HP. */
  revive?: number;
  /** Fixed damage dealt to foes. */
  damage?: number;
  element?: Element;
  /** The market stocks it from this point in the campaign. */
  stockedFrom: ShopProgress;
}

export const CONSUMABLES: Record<string, Consumable> = {
  potion: {
    id: 'potion', name: 'Potion', price: 40, range: 2, heal: 80, stockedFrom: 0,
    description: 'Restores 80 HP.'
  },
  hi_potion: {
    id: 'hi_potion', name: 'Hi-Potion', price: 150, range: 2, heal: 200, stockedFrom: 1,
    description: 'Restores 200 HP.'
  },
  ether: {
    id: 'ether', name: 'Ether', price: 120, range: 2, mp: 40, stockedFrom: 1,
    description: 'Restores 40 MP.'
  },
  remedy: {
    id: 'remedy', name: 'Remedy', price: 60, range: 2, cleanse: true, stockedFrom: 0,
    description: 'Cures every ailment: Poison, Slow, Blind, Silence, Sleep, binding and Breach.'
  },
  phoenix_feather: {
    id: 'phoenix_feather', name: 'Phoenix Feather', price: 250, range: 2, revive: 0.25, stockedFrom: 0,
    description: 'Raises a fallen ally with a quarter of their HP.'
  },
  blast_flask: {
    id: 'blast_flask', name: 'Blast Flask', price: 110, range: 3, aoe: 1, damage: 70, element: 'fire', stockedFrom: 1,
    description: 'Bursts for 70 fire damage on the target and every foe beside it.'
  }
};

/** The most of one consumable the squad can carry. */
export const MAX_STACK = 9;

/** What a new squad sets out with. */
export const STARTING_INVENTORY: Record<string, number> = { potion: 3, phoenix_feather: 1 };

export const ITEM_ABILITY_PREFIX = 'item:';

/**
 * The battle action for using a consumable. Items are resolved by the same engine as abilities:
 * this builds the Ability the Item command hands to it.
 */
export function consumableAbility(c: Consumable): Ability {
  return {
    id: ITEM_ABILITY_PREFIX + c.id,
    name: c.name,
    jobId: 'item',
    type: 'action',
    description: c.description,
    jpCost: 0,
    mpCost: 0,
    range: c.range,
    heightTolerance: 2.5,
    aoe: c.aoe || 0,
    power: 0,
    element: c.element || 'physical',
    item: c.id,
    ...(c.heal ? { fixedHeal: c.heal } : {}),
    ...(c.mp ? { fixedMp: c.mp } : {}),
    ...(c.cleanse ? { cleanse: true } : {}),
    ...(c.revive ? { revive: c.revive } : {}),
    ...(c.damage ? { fixedDamage: c.damage } : {})
  };
}

/** A saved inventory made safe: known items only, whole counts from 0 to MAX_STACK. Old saves get the starting kit. */
export function sanitizeInventory(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return { ...STARTING_INVENTORY };
  const out: Record<string, number> = {};
  for (const id of Object.keys(CONSUMABLES)) {
    const n = Math.floor(Number((raw as Record<string, unknown>)[id]));
    if (Number.isFinite(n) && n > 0) out[id] = Math.min(MAX_STACK, n);
  }
  return out;
}

/** The consumables the market sells at this stage, cheapest first. */
export function consumableStock(progress: ShopProgress): Consumable[] {
  return Object.values(CONSUMABLES).filter((c) => c.stockedFrom <= progress).sort((a, b) => a.price - b.price);
}
