/**
 * Gil and the shop.
 *
 * The armory is a set of item ids that the whole squad shares, so buying an item once outfits
 * everyone. Gil comes from bounties on defeated enemies, a bonus for clearing a battle, and from
 * stealing gear the squad already owns (it's fenced for half its price).
 */
import { ITEMS } from '../data/items';
import { Item, Unit, EquipmentSlot } from './types';

export const STARTING_GIL = 300;

/** Relics that are only ever won, never sold. */
export const UNIQUE_ITEMS = ['zodiac_blade', 'ribbon', 'dragon_mail'];

/**
 * How far the campaign has come: 0 = Chapter I, 1 = Chapter II, 2 = the Final Chapter,
 * 3 = campaign cleared (and the Trials). The shop's shelves grow with it.
 */
export type ShopProgress = 0 | 1 | 2 | 3;

/** The dearest item the shop stocks at each stage of the campaign. */
export const SHOP_PRICE_CAP: Record<ShopProgress, number> = { 0: 380, 1: 480, 2: 580, 3: Infinity };

const CHAPTER_PROGRESS: Record<string, ShopProgress> = { chapter_1: 0, chapter_2a: 1, chapter_2b: 1, chapter_3: 2 };

export function shopProgress(campaignChapterId: string, campaignCleared: boolean, inTrials: boolean): ShopProgress {
  if (campaignCleared || inTrials) return 3;
  return CHAPTER_PROGRESS[campaignChapterId] ?? 0;
}

const SLOT_ORDER: EquipmentSlot[] = ['weapon', 'shield', 'head', 'body', 'accessory'];

/** Everything on the shelves at this stage, by slot then price. Owned items stay listed (marked owned). */
export function shopStock(progress: ShopProgress): Item[] {
  const cap = SHOP_PRICE_CAP[progress];
  return Object.values(ITEMS)
    .filter((it) => it.price <= cap && !UNIQUE_ITEMS.includes(it.id))
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.price - b.price);
}

/** The lowest price cap above the current one, for "more stock after the next chapter" hints. */
export function nextShopCap(progress: ShopProgress): number | null {
  return progress < 3 ? SHOP_PRICE_CAP[(progress + 1) as ShopProgress] : null;
}

/** Gil for defeating one enemy: 20 + 10 per level, tripled for a boss. */
export function bountyFor(enemy: Unit): number {
  return (20 + enemy.level * 10) * (enemy.isBoss ? 3 : 1);
}

/** Bonus for winning the battle: 150 in the campaign, 100 + 20 per floor in the Trials. */
export function clearBonus(mode: 'campaign' | 'trials' | 'custom', trialsFloor: number): number {
  if (mode === 'custom') return 0;
  return mode === 'trials' ? 100 + trialsFloor * 20 : 150;
}

/** Gil for winning a battle. Workshop battles pay nothing, so they can't be farmed. */
export function victoryGil(enemies: Unit[], mode: 'campaign' | 'trials' | 'custom', trialsFloor: number): number {
  if (mode === 'custom') return 0;
  return enemies.reduce((n, e) => n + (e.isDead ? bountyFor(e) : 0), 0) + clearBonus(mode, trialsFloor);
}

/** What a fence pays for gear the squad already owns. */
export function resaleValue(item: Item): number {
  return Math.round(item.price / 2);
}
