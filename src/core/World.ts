/**
 * The world map between missions: its locations, the roads between them, and which battles are
 * open given how far the campaign has come. Pure data and rules; the screen is ui/WorldMap.ts.
 */
import { CAMPAIGN_CHAPTERS } from '../data/campaign';
import { StoryChoice } from './types';
import { SKIRMISHES, skirmishOpen } from './Skirmish';

export type WorldNodeKind = 'mission' | 'market' | 'trials' | 'skirmish';

export interface WorldNode {
  id: string;
  name: string;
  kind: WorldNodeKind;
  /** Position on the map, 0 to 1 from the left and from the top. */
  x: number;
  y: number;
  /** The campaign battle fought here (mission nodes). */
  chapterId?: string;
  /** The side battle fought here (skirmish nodes): optional and replayable. */
  skirmishId?: string;
  blurb: string;
}

export const WORLD_NODES: WorldNode[] = [
  { id: 'market', name: 'Larkmoor Market', kind: 'market', x: 0.15, y: 0.4, blurb: 'Stalls and smithies at the crossroads. Buy and sell gear and supplies here.' },
  { id: 'ruins', name: 'Riverside Ruins', kind: 'mission', chapterId: 'chapter_1', x: 0.31, y: 0.67, blurb: 'Broken pillars on the river bank, a bandit haunt.' },
  { id: 'mire', name: 'Gloomy Mire', kind: 'mission', chapterId: 'chapter_2a', x: 0.52, y: 0.79, blurb: 'Sunken crypts in a poisoned bog.' },
  { id: 'battlement', name: 'Night Battlement', kind: 'mission', chapterId: 'chapter_2b', x: 0.55, y: 0.36, blurb: 'The northern fortress, under siege.' },
  { id: 'summit', name: 'Zodiac Summit', kind: 'mission', chapterId: 'chapter_3', x: 0.8, y: 0.56, blurb: 'The mountain where the seals sleep.' },
  { id: 'trials', name: 'Gate of Trials', kind: 'trials', x: 0.88, y: 0.24, blurb: 'Twelve more seals stir behind this gate: endless battles, rare gear.' },
  { id: 'harbor', name: 'Emberwick Harbor', kind: 'mission', chapterId: 'chapter_4', x: 0.14, y: 0.78, blurb: 'The realm\'s western port, its quay lined with warehouses.' },
  { id: 'isle', name: 'Greywatch Isle', kind: 'mission', chapterId: 'chapter_5', x: 0.13, y: 0.14, blurb: 'A lighthouse on a bare rock, a morning\'s sail from the market.' },
  { id: 'cape', name: 'Stormbreak Cape', kind: 'mission', chapterId: 'chapter_6', x: 0.6, y: 0.1, blurb: 'The northern point, where the old kingdom built an altar to the sea.' },
  { id: 'thornwood', name: SKIRMISHES.thornwood.name, kind: 'skirmish', skirmishId: 'thornwood', x: 0.37, y: 0.21, blurb: 'A river crossing in the northern woods, held by bandits.' },
  { id: 'shrine', name: SKIRMISHES.shrine.name, kind: 'skirmish', skirmishId: 'shrine', x: 0.66, y: 0.68, blurb: 'A flooded chapel at the edge of the mire, where a cult gathers.' },
  { id: 'ridge', name: SKIRMISHES.ridge.name, kind: 'skirmish', skirmishId: 'ridge', x: 0.88, y: 0.78, blurb: 'An old watch-fort on the cliffs below the summit, its signal fire still kept.' }
];

/** Roads the party walks between locations. */
export const WORLD_ROADS: [string, string][] = [
  ['market', 'ruins'],
  ['market', 'battlement'],
  ['ruins', 'mire'],
  ['ruins', 'battlement'],
  ['mire', 'summit'],
  ['battlement', 'summit'],
  ['summit', 'trials'],
  ['market', 'thornwood'],
  ['thornwood', 'battlement'],
  ['mire', 'shrine'],
  ['summit', 'ridge'],
  ['ruins', 'harbor'],
  ['market', 'harbor'],
  ['market', 'isle'],
  ['thornwood', 'cape']
];

export const worldNode = (id: string): WorldNode | undefined => WORLD_NODES.find((n) => n.id === id);
export const nodeForChapter = (chapterId: string): WorldNode | undefined => WORLD_NODES.find((n) => n.chapterId === chapterId);

/** A battle the party can march to, and the orders (story choice) that send it there, if any. */
export interface Mission {
  chapterId: string;
  choice?: StoryChoice;
}

/**
 * The battles open right now.
 * - The chapter the campaign is at, until it's won (so a lost battle can be retried from the map).
 * - Once it's won, wherever its story choices lead. Taking one road closes the other: the walk
 *   follows the branch that was actually won, so an unchosen battle never reopens later.
 * - A won chapter with no choices ends the campaign: nothing is open.
 */
export function openMissions(currentChapterId: string, cleared: string[]): Mission[] {
  let at = CAMPAIGN_CHAPTERS[currentChapterId];
  if (!at || storyFinished(cleared)) return [];
  if (!cleared.includes(at.id)) return [{ chapterId: at.id }];
  for (let guard = 0; guard < 32; guard++) {
    const choices = at.choices || [];
    const taken = choices.find((c) => cleared.includes(c.nextChapterId) && CAMPAIGN_CHAPTERS[c.nextChapterId]);
    if (!taken) return choices.filter((c) => CAMPAIGN_CHAPTERS[c.nextChapterId]).map((c) => ({ chapterId: c.nextChapterId, choice: c }));
    at = CAMPAIGN_CHAPTERS[taken.nextChapterId];
  }
  return [];
}

const isFinale = (id: string): boolean => !!CAMPAIGN_CHAPTERS[id] && !(CAMPAIGN_CHAPTERS[id].choices || []).length;

/** True once a chapter that ends the story has been won. */
export const storyFinished = (cleared: string[]): boolean => cleared.some(isFinale);

/**
 * The cleared list for an old (pre-0.15) save that is already past the first act: its first and
 * last battle are certain, the branch in between is not recorded and stays unmarked.
 */
export function clearedAfterStory(): string[] {
  return ['chapter_1', FIRST_ACT_FINALE];
}

/**
 * The battle that ended the story before Act II (0.17.0). A save that says "campaign cleared"
 * without a list of won chapters finished here, and carries on into Chapter IV.
 */
export const FIRST_ACT_FINALE = 'chapter_3';

export type NodeState = 'open' | 'cleared' | 'locked';

/** How a location shows on the map. */
export function nodeState(node: WorldNode, currentChapterId: string, cleared: string[], trialsOpen: boolean): NodeState {
  if (node.kind === 'market') return 'open';
  if (node.kind === 'trials') return trialsOpen ? 'open' : 'locked';
  // Side battles never show as cleared: they can always be fought again
  if (node.kind === 'skirmish') return skirmishOpen(node.skirmishId!, cleared) ? 'open' : 'locked';
  if (cleared.includes(node.chapterId!)) return 'cleared';
  return openMissions(currentChapterId, cleared).some((m) => m.chapterId === node.chapterId) ? 'open' : 'locked';
}

/** The shortest walk along the roads from one location to another (both ends included). */
export function route(from: string, to: string): string[] {
  if (from === to) return [from];
  const prev = new Map<string, string>([[from, '']]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift()!;
    for (const [a, b] of WORLD_ROADS) {
      const next = a === at ? b : b === at ? a : null;
      if (!next || prev.has(next)) continue;
      prev.set(next, at);
      if (next === to) {
        const path = [to];
        for (let p = at; p; p = prev.get(p)!) path.unshift(p);
        return path;
      }
      queue.push(next);
    }
  }
  return [from, to];
}

/**
 * Saves from before 0.15.0 don't record which chapters were won. Work it out from the chapter
 * the save is at: everything on the way to it has been cleared (the branch taken is unknown).
 */
export function clearedBefore(currentChapterId: string): string[] {
  return currentChapterId === 'chapter_1' || !CAMPAIGN_CHAPTERS[currentChapterId] ? [] : ['chapter_1'];
}

/** Keeps only real chapter ids, once each. */
export function sanitizeCleared(raw: unknown, currentChapterId: string): string[] {
  if (!Array.isArray(raw)) return clearedBefore(currentChapterId);
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && !!CAMPAIGN_CHAPTERS[id]))];
}
