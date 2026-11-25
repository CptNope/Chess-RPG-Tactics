import { sanitizeMerchantSales } from './Merchant';
import { MAX_SQUAD, sanitizeParty, sanitizeRecruitHires } from './Recruits';
import { Unit } from './types';
import { MapData } from '../data/maps';
import { JOBS } from '../data/jobs';
import { ITEMS } from '../data/items';
import { JobSystem } from './JobSystem';
import { Difficulty } from './Difficulty';

export interface GameSaveData {
  version: string;
  timestamp: number;
  currentChapterId: string;
  units: Unit[];
  customMaps?: Record<string, MapData>;
  /** Owned item ids (added in 0.7.0; older saves rebuild it from equipped gear). */
  armory?: string[];
  /** 'campaign' or 'trials' (added in 0.7.0). */
  mode?: 'campaign' | 'trials';
  trialsFloor?: number;
  campaignCleared?: boolean;
  /** Added in 0.14.0; older saves start with the new-game purse. */
  gil?: number;
  /** Consumables carried (0.15.0): item id to count. */
  inventory?: Record<string, number>;
  /** Campaign chapters won, in order (0.15.0). */
  clearedChapters?: string[];
  /** True when the save was made on the world map, between missions (0.15.0). */
  onWorldMap?: boolean;
  /** The world-map location the party stands at (0.15.0). */
  worldLocation?: string;
  /** Added in 0.16.0: wins at each side-battle place. */
  skirmishWins?: Record<string, number>;
  /** Added in 0.18.0; older saves play on Normal. */
  difficulty?: Difficulty;
  /** Camp scenes played this playthrough (0.21.0): the chapter ids they follow. */
  campSeen?: string[];
  /** What was bought from the travelling merchant on her current visit (0.21.0). */
  merchantSales?: { visit: number; ids: string[] };
  /** The party the player last picked, by unit id, when the squad outgrew it (0.25.0). */
  party?: string[];
  /** Who was hired from the market's current recruiting board (0.25.0). */
  recruitHires?: { visit: number; slots: number[] };
}

const BEST_FLOOR_KEY = 'chess_rpg_tactics_best_trial_v1';

/** Slot 1 keeps the key every earlier version used, so existing saves are simply slot 1. */
const STORAGE_KEY = 'chess_rpg_tactics_save_v1';
export const SAVE_SLOTS = 3;
const slotKey = (slot: number) => (slot <= 1 ? STORAGE_KEY : `${STORAGE_KEY}_slot${slot}`);
const validSlot = (slot: number) => Number.isInteger(slot) && slot >= 1 && slot <= SAVE_SLOTS;
/** Largest save file accepted by import (a real one is around 40 KB). */
export const MAX_IMPORT_BYTES = 512 * 1024;
const CUSTOM_MAPS_KEY = 'chess_rpg_tactics_custom_maps_v1';

export class SaveManager {
  /**
   * Serializes current campaign and squad progress to localStorage.
   */
  public static saveGame(
    chapterId: string,
    playerUnits: Unit[],
    extra: Pick<GameSaveData, 'armory' | 'mode' | 'trialsFloor' | 'campaignCleared' | 'gil' | 'inventory' | 'clearedChapters' | 'onWorldMap' | 'worldLocation' | 'skirmishWins' | 'difficulty' | 'campSeen' | 'merchantSales' | 'party' | 'recruitHires'> = {},
    slot = 1
  ): boolean {
    if (!validSlot(slot)) return false;
    try {
      const saveData: GameSaveData = {
        version: '0.38.0',
        timestamp: Date.now(),
        currentChapterId: chapterId,
        units: playerUnits,
        ...extra
      };

      localStorage.setItem(slotKey(slot), JSON.stringify(saveData));
      return true;
    } catch (e) {
      console.error('Failed to save game to localStorage:', e);
      return false;
    }
  }

  /**
   * Retrieves saved game data from localStorage.
   */
  public static loadGame(slot = 1): GameSaveData | null {
    if (!validSlot(slot)) return null;
    try {
      const raw = localStorage.getItem(slotKey(slot));
      if (!raw) return null;
      const data = JSON.parse(raw) as GameSaveData;
      return data;
    } catch (e) {
      console.error('Failed to load game from localStorage:', e);
      return null;
    }
  }

  /**
   * Checks whether a save file exists.
   */
  public static hasSave(slot?: number): boolean {
    if (slot === undefined) return this.slotsInUse().length > 0;
    if (!validSlot(slot)) return false;
    try {
      return localStorage.getItem(slotKey(slot)) !== null;
    } catch {
      return false;
    }
  }

  /** Slots that hold a save, 1-based. */
  public static slotsInUse(): number[] {
    const out: number[] = [];
    for (let s = 1; s <= SAVE_SLOTS; s++) if (this.hasSave(s)) out.push(s);
    return out;
  }

  /** The slot saved to most recently, or null when every slot is empty. */
  public static latestSlot(): number | null {
    let best: { slot: number; t: number } | null = null;
    for (const s of this.slotsInUse()) {
      const t = this.loadGame(s)?.timestamp || 0;
      if (!best || t > best.t) best = { slot: s, t };
    }
    return best ? best.slot : null;
  }

  /** The first empty slot, or null when all are in use. */
  public static firstEmptySlot(): number | null {
    for (let s = 1; s <= SAVE_SLOTS; s++) if (!this.hasSave(s)) return s;
    return null;
  }

  /** The save in a slot as text, for export. */
  public static exportSave(slot: number): string | null {
    if (!validSlot(slot)) return null;
    try {
      const raw = localStorage.getItem(slotKey(slot));
      return raw ? JSON.stringify(JSON.parse(raw), null, 1) : null;
    } catch {
      return null;
    }
  }

  /**
   * Reads a save someone pasted or picked as a file. The file may have come from anywhere, so
   * only what the game understands is kept: units are rebuilt from scratch with known jobs,
   * abilities and items, names are cut down to plain text, and numbers are clamped. Throws
   * with a short player-facing message when the text isn't a save.
   */
  public static parseImport(text: string): GameSaveData {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Nothing to import.');
    if (text.length > MAX_IMPORT_BYTES) throw new Error('That file is too large to be a save.');
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('That is not a Chess RPG Tactics save file.');
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('That is not a Chess RPG Tactics save file.');
    const d = raw as Record<string, unknown>;
    if (!Array.isArray(d.units) || typeof d.currentChapterId !== 'string') throw new Error('That is not a Chess RPG Tactics save file.');
    const units = d.units.slice(0, MAX_SQUAD).map((u, i) => importUnit(u, i)).filter((u): u is Unit => !!u);
    if (units.length === 0) throw new Error('That save has no squad in it.');
    const strings = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length <= 40).slice(0, max) : undefined);
    const counts = (v: unknown) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
      const out: Record<string, number> = {};
      for (const [k, n] of Object.entries(v as Record<string, unknown>).slice(0, 64)) if (/^[a-z0-9_]{1,40}$/.test(k) && !UNSAFE_KEYS.has(k) && typeof n === 'number' && Number.isFinite(n)) out[k] = Math.max(0, Math.min(999, Math.floor(n)));
      return out;
    };
    return {
      version: typeof d.version === 'string' ? d.version.slice(0, 12) : '0',
      timestamp: typeof d.timestamp === 'number' && Number.isFinite(d.timestamp) ? d.timestamp : Date.now(),
      currentChapterId: d.currentChapterId.slice(0, 40),
      units,
      armory: strings(d.armory, 200)?.filter((id) => own(ITEMS, id)),
      mode: d.mode === 'trials' ? 'trials' : 'campaign',
      trialsFloor: typeof d.trialsFloor === 'number' && Number.isFinite(d.trialsFloor) ? Math.max(0, Math.min(9999, Math.floor(d.trialsFloor))) : 0,
      campaignCleared: d.campaignCleared === true,
      gil: typeof d.gil === 'number' && Number.isFinite(d.gil) ? Math.max(0, Math.min(9_999_999, Math.floor(d.gil))) : undefined,
      inventory: counts(d.inventory),
      clearedChapters: strings(d.clearedChapters, 32),
      onWorldMap: d.onWorldMap === true,
      worldLocation: typeof d.worldLocation === 'string' ? d.worldLocation.slice(0, 40) : undefined,
      skirmishWins: counts(d.skirmishWins),
      difficulty: d.difficulty === 'easy' || d.difficulty === 'hard' ? d.difficulty : 'normal',
      campSeen: strings(d.campSeen, 32),
      merchantSales: sanitizeMerchantSales(d.merchantSales),
      party: sanitizeParty(d.party),
      recruitHires: sanitizeRecruitHires(d.recruitHires)
    };
  }

  /** Writes an already-checked save into a slot. */
  public static writeSlot(slot: number, data: GameSaveData): boolean {
    if (!validSlot(slot)) return false;
    try {
      localStorage.setItem(slotKey(slot), JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  /** Highest Trials of the Zodiac floor ever cleared on this browser. */
  public static getBestTrialFloor(): number {
    try {
      return parseInt(localStorage.getItem(BEST_FLOOR_KEY) || '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  public static recordTrialFloor(floor: number): boolean {
    if (floor <= this.getBestTrialFloor()) return false;
    try {
      localStorage.setItem(BEST_FLOOR_KEY, String(floor));
    } catch {
      /* storage unavailable (private mode / embedded iframe) */
    }
    return true;
  }

  /**
   * Clears saved game from localStorage.
   */
  public static clearSave(slot = 1): void {
    if (!validSlot(slot)) return;
    try {
      localStorage.removeItem(slotKey(slot));
    } catch {
      /* ignore */
    }
  }

  /**
   * Persists custom sculpted map to browser storage.
   */
  public static saveCustomMap(mapId: string, mapData: MapData): void {
    try {
      const existingRaw = localStorage.getItem(CUSTOM_MAPS_KEY);
      const maps: Record<string, MapData> = existingRaw ? JSON.parse(existingRaw) : {};
      maps[mapId] = mapData;
      localStorage.setItem(CUSTOM_MAPS_KEY, JSON.stringify(maps));
    } catch (e) {
      console.error('Failed to save custom map:', e);
    }
  }

  /**
   * Retrieves all user sculpted maps from browser storage.
   */
  public static loadCustomMaps(): Record<string, MapData> {
    try {
      const raw = localStorage.getItem(CUSTOM_MAPS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('Failed to load custom maps:', e);
      return {};
    }
  }
}

/** Keys that would reach an object's prototype if copied blindly. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const own = (o: object, k: string) => !UNSAFE_KEYS.has(k) && Object.prototype.hasOwnProperty.call(o, k);

/** Plain-text name: letters, digits, spaces and a little punctuation, at most 16 characters. */
export function cleanName(raw: unknown, fallback: string): string {
  const s = typeof raw === 'string' ? raw.replace(/[^\p{L}\p{N} '.-]/gu, '').trim().slice(0, 16) : '';
  return s || fallback;
}

const num = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt);

/** Rebuilds one squad member from imported data, keeping only fields the game knows. */
function importUnit(raw: unknown, i: number): Unit | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  if (r.team !== 'player') return null;
  const jobId = typeof r.jobId === 'string' && own(JOBS, r.jobId) ? r.jobId : 'squire';
  const id = typeof r.id === 'string' && /^[\w-]{1,24}$/.test(r.id) ? r.id : `imported-${i}`;
  const level = Math.floor(num(r.level, 1, 99, 1));
  const u = JobSystem.createUnit(id, cleanName(r.name, `Ally ${i + 1}`), 'player', jobId, 0, 0, 'N', level);
  u.exp = Math.floor(num(r.exp, 0, 99, 0));
  if (r.baseStats && typeof r.baseStats === 'object') {
    for (const k of Object.keys(u.baseStats) as (keyof Unit['baseStats'])[]) u.baseStats[k] = num(r.baseStats[k], 1, 9999, u.baseStats[k]);
  }
  const knownAbility = (a: unknown) => typeof a === 'string' && !UNSAFE_KEYS.has(a) && !!JobSystem.findAbility(a);
  for (const field of ['jobPoints', 'jobJpEarned'] as const) {
    const src = r[field];
    if (!src || typeof src !== 'object') continue;
    const out: Record<string, number> = {};
    for (const job of Object.keys(JOBS)) if (own(src, job) && typeof src[job] === 'number') out[job] = Math.floor(num(src[job], 0, 999_999, 0));
    (u as any)[field] = { ...(u as any)[field], ...out };
  }
  if (r.unlockedAbilities && typeof r.unlockedAbilities === 'object') {
    for (const [a, on] of Object.entries(r.unlockedAbilities)) if (on === true && knownAbility(a)) u.unlockedAbilities[a] = true;
  }
  const eq = r.equippedAbilities || {};
  if (typeof eq.secondaryJobId === 'string' && own(JOBS, eq.secondaryJobId)) u.equippedAbilities.secondaryJobId = eq.secondaryJobId;
  for (const slot of ['reaction', 'support', 'movement'] as const) {
    if (knownAbility(eq[slot]) && u.unlockedAbilities[eq[slot]]) u.equippedAbilities[slot] = eq[slot];
  }
  if (r.equipment && typeof r.equipment === 'object') {
    for (const slot of Object.keys(u.equipment) as (keyof Unit['equipment'])[]) {
      const it = r.equipment[slot];
      const item = it && typeof it.id === 'string' && own(ITEMS, it.id) ? ITEMS[it.id] : undefined;
      // Only what this unit may wear: beasts wear only beast gear (0.28.0, 0.29.0)
      if (item && item.slot === slot && JobSystem.canEquip(u, item)) u.equipment[slot] = item;
    }
  }
  JobSystem.recalculateDerivedStats(u);
  u.currentHp = u.maxHp;
  u.currentMp = u.maxMp;
  return u;
}
