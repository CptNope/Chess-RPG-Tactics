import { Unit } from './types';
import { MapData } from '../data/maps';

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
}

const BEST_FLOOR_KEY = 'chess_rpg_tactics_best_trial_v1';

const STORAGE_KEY = 'chess_rpg_tactics_save_v1';
const CUSTOM_MAPS_KEY = 'chess_rpg_tactics_custom_maps_v1';

export class SaveManager {
  /**
   * Serializes current campaign and squad progress to localStorage.
   */
  public static saveGame(
    chapterId: string,
    playerUnits: Unit[],
    extra: Pick<GameSaveData, 'armory' | 'mode' | 'trialsFloor' | 'campaignCleared'> = {}
  ): boolean {
    try {
      const saveData: GameSaveData = {
        version: '0.7.0',
        timestamp: Date.now(),
        currentChapterId: chapterId,
        units: playerUnits,
        ...extra
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      return true;
    } catch (e) {
      console.error('Failed to save game to localStorage:', e);
      return false;
    }
  }

  /**
   * Retrieves saved game data from localStorage.
   */
  public static loadGame(): GameSaveData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
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
  public static hasSave(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
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
  public static clearSave(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
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
