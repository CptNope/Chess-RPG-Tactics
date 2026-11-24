/**
 * The travelling merchant (0.21.0): Wenna, a pedlar who follows the squad around the realm.
 *
 * She sets up at a different place on the world map after every battle won there (story or side
 * battle) and sells two things the market doesn't: one piece of gear from the market's next
 * shelf, early and at a markup, and one of her own goods that nobody else stocks. Everything is
 * worked out from progress the save already records, so she needs no save data of her own:
 * buying a piece simply takes it off her blanket.
 */
import { ITEMS, MERCHANT_ITEMS } from '../data/items';
import { SHOP_PRICE_CAP, ShopProgress, UNIQUE_ITEMS } from './Economy';
import { WORLD_NODES } from './World';
import { skirmishOpen } from './Skirmish';

export const MERCHANT_NAME = 'Wenna the Pedlar';

/** Early gear costs this much more than it will on the market's shelves. */
export const EARLY_MARKUP = 1.25;

export interface MerchantWare {
  id: string;
  price: number;
  /** Bought on this visit: it stays on show, marked sold, rather than making room for another. */
  sold?: boolean;
  /** 'early': the market will stock it after the next chapter. 'own': only she sells it. */
  kind: 'early' | 'own';
}

export interface MerchantVisit {
  /** World-map place she is at. */
  nodeId: string;
  wares: MerchantWare[];
}

/** How many times she has moved on: one per battle won on the map. */
export function merchantVisitIndex(cleared: string[], skirmishWins: Record<string, number>): number {
  return cleared.length + Object.values(skirmishWins).reduce((a, b) => a + Math.max(0, Math.floor(b) || 0), 0);
}

/**
 * Places she can set up at: open side-battle camps and story battlefields already won (never
 * the market, which has its own stalls, nor a battle still to be fought), in map order.
 */
export function merchantStops(cleared: string[]): string[] {
  return WORLD_NODES.filter((n) =>
    (n.kind === 'skirmish' && skirmishOpen(n.skirmishId!, cleared)) || (n.kind === 'mission' && cleared.includes(n.chapterId!))
  ).map((n) => n.id);
}

const roundTo10 = (n: number) => Math.round(n / 10) * 10;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const stride = (n: number) => [3, 5, 7, 2, 1].find((k) => k < n && gcd(k, n) === 1) ?? 1;

/** What was bought from her, and on which visit: the save keeps this so a ware sold stays sold. */
export interface MerchantSales {
  visit: number;
  ids: string[];
}

/**
 * Where she is and what she sells, or null before the first battle is won (and when she has
 * nothing left the squad doesn't own). Wares bought on this visit stay on her blanket as sold, so
 * buying one never brings out the next: she has two things to sell each time, not a whole shop.
 */
export function merchantVisit(cleared: string[], skirmishWins: Record<string, number>, progress: ShopProgress, ownedNow: string[], sales?: MerchantSales): MerchantVisit | null {
  const stops = merchantStops(cleared);
  if (stops.length === 0) return null;
  const visit = merchantVisitIndex(cleared, skirmishWins);
  const soldHere = sales && sales.visit === visit ? sales.ids : [];
  const owned = ownedNow.filter((id) => !soldHere.includes(id));
  // Step through the stops with a stride that shares no factor with their number, so she visits
  // every one in turn without just walking to the neighbouring pin each time
  const nodeId = stops[(visit * stride(stops.length)) % stops.length];
  const wares: MerchantWare[] = [];

  if (progress < 3) {
    const low = SHOP_PRICE_CAP[progress];
    const high = SHOP_PRICE_CAP[(progress + 1) as ShopProgress];
    const early = Object.values(ITEMS)
      .filter((it) => it.price > low && it.price <= high && !owned.includes(it.id) && !UNIQUE_ITEMS.includes(it.id) && !MERCHANT_ITEMS.includes(it.id))
      .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
    if (early.length) {
      const it = early[visit % early.length];
      wares.push({ id: it.id, price: roundTo10(it.price * EARLY_MARKUP), kind: 'early' });
    }
  }

  const own = MERCHANT_ITEMS.filter((id) => !owned.includes(id));
  if (own.length) {
    const id = own[visit % own.length];
    wares.push({ id, price: ITEMS[id].price, kind: 'own' });
  }

  for (const w of wares) if (soldHere.includes(w.id)) w.sold = true;
  return wares.length ? { nodeId, wares } : null;
}

/** Saved sales made safe: a whole visit number and known merchant wares only. */
export function sanitizeMerchantSales(raw: unknown): MerchantSales | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const visit = Math.floor(Number(r.visit));
  if (!Number.isFinite(visit) || visit < 0 || !Array.isArray(r.ids)) return undefined;
  const ids = r.ids.filter((id): id is string => typeof id === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, id)).slice(0, 4);
  return { visit: Math.min(99999, visit), ids };
}
