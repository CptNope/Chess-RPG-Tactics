/**
 * Difficulty (0.18.0). One setting per save, changeable at any time from the Menu; it applies
 * from the next battle. Workshop scenarios ignore it: their author set the levels.
 */
import { Unit } from './types';
import { JobSystem } from './JobSystem';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyRules {
  label: string;
  /** Added to every enemy's level (never below 1). */
  levelShift: number;
  /** Fallen enemies the enemy side may raise per battle. */
  raiseCap: number;
  /** Multiplies a boss's max HP (bosses already have 1.6× a normal unit's). */
  bossHp: number;
  /** One line for the menu and the new-game screen. */
  blurb: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyRules> = {
  easy: { label: 'Easy', levelShift: -1, raiseCap: 0, bossHp: 0.7, blurb: 'Enemies are a level lower, bosses have less HP, and nobody raises the fallen. For enjoying the story.' },
  normal: { label: 'Normal', levelShift: 0, raiseCap: 1, bossHp: 1, blurb: 'The game as designed. Enemy healers can raise one ally per battle.' },
  hard: { label: 'Hard', levelShift: 1, raiseCap: 2, bossHp: 1.15, blurb: 'Enemies are a level higher, bosses are tougher, and healers can raise two allies per battle.' }
};

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];

export function sanitizeDifficulty(raw: unknown): Difficulty {
  return raw === 'easy' || raw === 'hard' ? raw : 'normal';
}

/** An enemy's level at this difficulty. */
export function enemyLevel(level: number, difficulty: Difficulty): number {
  return Math.max(1, Math.round(level) + DIFFICULTIES[difficulty].levelShift);
}

/** Applies the difficulty's boss HP to a unit that has just been made a boss. */
export function scaleBoss(u: Unit, difficulty: Difficulty): void {
  const f = DIFFICULTIES[difficulty].bossHp;
  if (!u.isBoss || f === 1) return;
  u.baseStats.hp = Math.max(1, Math.round(u.baseStats.hp * f));
  JobSystem.recalculateDerivedStats(u);
  u.currentHp = u.maxHp;
}
