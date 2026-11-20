/**
 * Graphics quality tiers. "auto" picks Medium on phones/low-memory devices and High elsewhere;
 * the player can override it in Menu → Graphics (saved in localStorage).
 *
 * | Tier   | Shadows        | Bloom | MSAA | Decorations | Pixel ratio cap |
 * | High   | 2048 PCF soft  | yes   | 4x   | full        | 2               |
 * | Medium | 1024 PCF       | no    | —    | reduced     | 1.5             |
 * | Low    | off (blobs)    | no    | —    | none        | 1               |
 */
export type QualityLevel = 'high' | 'medium' | 'low';
export type QualitySetting = QualityLevel | 'auto';

export interface QualityProfile {
  level: QualityLevel;
  shadows: boolean;
  shadowMapSize: number;
  bloom: boolean;
  msaa: number;
  decorationDensity: number;
  pixelRatioCap: number;
  torches: boolean;
}

const KEY = 'chess_rpg_tactics_graphics_v1';

export const PROFILES: Record<QualityLevel, QualityProfile> = {
  high: { level: 'high', shadows: true, shadowMapSize: 2048, bloom: true, msaa: 4, decorationDensity: 1, pixelRatioCap: 2, torches: true },
  medium: { level: 'medium', shadows: true, shadowMapSize: 1024, bloom: false, msaa: 0, decorationDensity: 0.5, pixelRatioCap: 1.5, torches: true },
  low: { level: 'low', shadows: false, shadowMapSize: 512, bloom: false, msaa: 0, decorationDensity: 0, pixelRatioCap: 1, torches: false }
};

export function getQualitySetting(): QualitySetting {
  try {
    const v = localStorage.getItem(KEY) as QualitySetting | null;
    if (v === 'high' || v === 'medium' || v === 'low' || v === 'auto') return v;
  } catch {
    /* storage unavailable */
  }
  return 'auto';
}

export function setQualitySetting(v: QualitySetting): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage unavailable */
  }
}

/** Best guess for this device when the setting is "auto". */
export function detectQuality(): QualityLevel {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const lowMemory = (nav.deviceMemory ?? 8) <= 3;
  const fewCores = (nav.hardwareConcurrency ?? 8) <= 4;
  if (lowMemory || (coarse && fewCores)) return 'low';
  if (coarse) return 'medium';
  return 'high';
}

export function resolveQuality(setting: QualitySetting = getQualitySetting()): QualityProfile {
  return PROFILES[setting === 'auto' ? detectQuality() : setting];
}
