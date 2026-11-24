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
 * How far the campaign has come: 0 = Chapter I, 1 = Chapter II, 2 = Chapter III,
 * 3 = campaign cleared (and the Trials). The shop's shelves grow with it.
 */
export type ShopProgress = 0 | 1 | 2 | 3;

/** The dearest item the shop stocks at each stage of the campaign. */
export const SHOP_PRICE_CAP: Record<ShopProgress, number> = { 0: 380, 1: 480, 2: 580, 3: Infinity };

const CHAPTER_PROGRESS: Record<string, ShopProgress> = { chapter_1: 0, chapter_2a: 1, chapter_2b: 1, chapter_3: 2, chapter_4: 3, chapter_5: 3, chapter_6: 3 };

/**
 * @param chapterWon the chapter the campaign is at has been won (the squad is on the world map,
 *   between missions): the next shelf opens as soon as the battle is over, not at the next one.
 */
export function shopProgress(campaignChapterId: string, campaignCleared: boolean, inTrials: boolean, chapterWon = false): ShopProgress {
  if (campaignCleared || inTrials) return 3;
  const base = CHAPTER_PROGRESS[campaignChapterId] ?? 0;
  return (chapterWon ? Math.min(3, base + 1) : base) as ShopProgress;
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

/** What kind of battle is being fought. */
export type BattleMode = 'campaign' | 'trials' | 'custom' | 'skirmish';

/** Gil for defeating one enemy: 20 + 10 per level, tripled for a boss. */
export function bountyFor(enemy: Unit): number {
  return (20 + enemy.level * 10) * (enemy.isBoss ? 3 : 1);
}

/** Bonus for winning the battle: 150 in the campaign, 100 + 20 per floor in the Trials. */
export function clearBonus(mode: BattleMode, trialsFloor: number): number {
  if (mode === 'custom' || mode === 'skirmish') return 0; // side battles add their own bonus (Skirmish.skirmishBonus)
  return mode === 'trials' ? 100 + trialsFloor * 20 : 150;
}

/** Gil for winning a battle. Workshop battles pay nothing, so they can't be farmed. */
export function victoryGil(enemies: Unit[], mode: BattleMode, trialsFloor: number): number {
  if (mode === 'custom') return 0;
  return enemies.reduce((n, e) => n + (e.isDead ? bountyFor(e) : 0), 0) + clearBonus(mode, trialsFloor);
}

/** What the market (or a fence) pays for anything: half its price. */
export function resaleValue(item: { price: number }): number {
  return Math.round(item.price / 2);
}

/**
 * Why a piece of gear can't be sold, or null when it can: relics are never sold, and nobody
 * sells the gear off a comrade's back.
 */
export function gearSaleBlock(id: string, armory: string[], squad: Unit[]): string | null {
  if (!armory.includes(id) || !ITEMS[id]) return 'Not owned';
  if (UNIQUE_ITEMS.includes(id)) return 'Relic';
  const wearer = squad.find((u) => Object.values(u.equipment).some((it) => it?.id === id));
  return wearer ? `Worn by ${wearer.name}` : null;
}
