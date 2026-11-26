/**
 * The world map between missions: its locations, the roads between them, and which battles are
 * open given how far the campaign has come. Pure data and rules; the screen is ui/WorldMap.ts.
 */
import { CAMPAIGN_CHAPTERS } from '../data/campaign';
import { StoryChoice } from './types';
import { SKIRMISHES, skirmishOpen } from './Skirmish';

export type WorldNodeKind = 'mission' | 'market' | 'trials' | 'skirmish' | 'port' | 'story';

/**
 * The map has two regions (0.34.0): the realm, and the Far Shore across the sea, where Act III is
 * fought. Ships sail between Emberwick Harbor and the Anchorage once Chapter VI is won.
 */
export type Region = 'realm' | 'shore';

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
  /** The recruit's side story told here (story nodes, 0.43.0): optional, won once. */
  storyId?: string;
  blurb: string;
  /** Which map it's on (0.34.0). The realm when unset. */
  region?: Region;
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
  { id: 'ridge', name: SKIRMISHES.ridge.name, kind: 'skirmish', skirmishId: 'ridge', x: 0.88, y: 0.78, blurb: 'An old watch-fort on the cliffs below the summit, its signal fire still kept.' },
  { id: 'hollow', name: SKIRMISHES.hollow.name, kind: 'skirmish', skirmishId: 'hollow', x: 0.7, y: 0.38, blurb: 'A wooded hollow under the high pass, where the howling carries for miles.' },
  { id: 'barrow', name: SKIRMISHES.barrow.name, kind: 'skirmish', skirmishId: 'barrow', x: 0.42, y: 0.52, blurb: 'An old kings\' grave-mound gone to briars, between the ruins and the battlement.' },
  // Recruit side stories (0.43.0): shown once they open
  { id: 'fenhollow', name: 'Fenhollow', kind: 'story', storyId: 'fenhollow', x: 0.42, y: 0.9, blurb: "Bria's village on the edge of the mire, built on stilts around a spring." },
  { id: 'saltmere', name: 'Saltmere', kind: 'story', storyId: 'saltmere', x: 0.1, y: 0.6, blurb: 'A fishing village on the western shore. Half its houses are new timber, built over ash.' },
  // The Far Shore (0.34.0)
  { id: 'anchorage', name: 'The Anchorage', kind: 'port', region: 'shore', x: 0.2, y: 0.78, blurb: 'Where the ship from Emberwick rides at anchor, in the lee of a sea-glass spit.' },
  { id: 'saltglass', name: 'Saltglass Shore', kind: 'mission', chapterId: 'chapter_7', region: 'shore', x: 0.46, y: 0.62, blurb: 'The drowned kingdom\'s old harbour, half buried in glittering dunes.' },
  { id: 'frostfang', name: 'Frostfang Pass', kind: 'mission', chapterId: 'chapter_8', region: 'shore', x: 0.64, y: 0.24, blurb: 'The one road over the mountains, with the Court\'s fort at the top.' },
  { id: 'drowned_city', name: 'The Drowned City', kind: 'mission', chapterId: 'chapter_9', region: 'shore', x: 0.86, y: 0.66, blurb: 'The drowned kingdom\'s capital, standing up out of the bay with the sea still running off it.' },
  { id: 'dunehome', name: 'Dunehome', kind: 'story', storyId: 'dunehome', region: 'shore', x: 0.36, y: 0.88, blurb: "Kestrel's village in the dunes, burned for the Court's road." },
  { id: 'glasswing', name: SKIRMISHES.glasswing.name, kind: 'skirmish', skirmishId: 'glasswing', region: 'shore', x: 0.28, y: 0.4, blurb: 'Dunes of wind-polished glass where a wyvern nests, and the jackals that follow it.' }
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
  ['thornwood', 'cape'],
  ['battlement', 'hollow'],
  ['ruins', 'barrow'],
  ['barrow', 'battlement'],
  ['mire', 'fenhollow'],
  ['harbor', 'saltmere'],
  ['market', 'saltmere'],
  // The Far Shore (0.34.0): no road crosses the sea; ships sail between the two harbours
  ['anchorage', 'saltglass'],
  ['saltglass', 'frostfang'],
  ['frostfang', 'drowned_city'],
  ['anchorage', 'glasswing'],
  ['glasswing', 'saltglass'],
  ['anchorage', 'dunehome'],
  ['dunehome', 'saltglass']
];

/** The region a location is in. */
export const regionOf = (id: string): Region => WORLD_NODES.find((n) => n.id === id)?.region || 'realm';

/** Where ships sail from and to, by region (0.34.0). */
export const SEA_PORTS: Record<Region, string> = { realm: 'harbor', shore: 'anchorage' };

/** The chapter whose win opens the sea crossing. */
export const FAR_SHORE_OPENS_AFTER = 'chapter_6';

/** True once ships sail for the Far Shore. */
export const farShoreOpen = (cleared: string[]): boolean => cleared.includes(FAR_SHORE_OPENS_AFTER);

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
export function nodeState(node: WorldNode, currentChapterId: string, cleared: string[], trialsOpen: boolean, sideStories: Record<string, NodeState> = {}): NodeState {
  if (node.kind === 'market' || node.kind === 'port') return 'open';
  // A side story shows as worked out from the squad and the save (SideStory.sideStoryStates)
  if (node.kind === 'story') return sideStories[node.storyId!] || 'locked';
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
  // hasOwnProperty, so "__proto__" and friends from a hand-edited save aren't taken for chapters
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && Object.prototype.hasOwnProperty.call(CAMPAIGN_CHAPTERS, id)))];
}
