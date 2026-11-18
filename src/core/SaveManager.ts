import { Unit } from './types';
import { MapData } from '../data/maps';

export interface GameSaveData {
  version: string;
  timestamp: number;
  currentChapterId: string;
  units: Unit[];
  customMaps?: Record<string, MapData>;
}

const STORAGE_KEY = 'chess_rpg_tactics_save_v1';
const CUSTOM_MAPS_KEY = 'chess_rpg_tactics_custom_maps_v1';

export class SaveManager {
  /**
   * Serializes current campaign and squad progress to localStorage.
   */
  public static saveGame(chapterId: string, playerUnits: Unit[]): boolean {
    try {
      const saveData: GameSaveData = {
        version: '0.6.0',
        timestamp: Date.now(),
        currentChapterId: chapterId,
        units: playerUnits
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
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Clears saved game from localStorage.
   */
  public static clearSave(): void {
    localStorage.removeItem(STORAGE_KEY);
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
