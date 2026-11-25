/**
 * Recruiting (0.25.0): hiring units at the market and choosing who fights.
 *
 * The market's recruiting board shows three hopefuls. Like the travelling merchant, the board
 * changes after every battle won on the map, and everything about it is worked out from progress
 * the save already records; the save only remembers which of this board's hopefuls were hired.
 *
 * The squad can grow to ten. Six deploy: when there are more, the player picks the party before a
 * battle. Rowan leads and always deploys, and a story recruit always fights the battle they join.
 *
 * Pure rules; the market panel, the party screen and the battle setup call them.
 */
import { Unit } from './types';
import { JOBS } from '../data/jobs';
import { JobSystem } from './JobSystem';

/** Most units the squad can hold. */
export const MAX_SQUAD = 10;
/** Most units that deploy to a battle (every battlefield has six spawn tiles). */
export const PARTY_SIZE = 6;
/** The squad's leader: always deploys, can't be dismissed. */
export const LEADER_ID = 'p1';
/** How many hopefuls the board shows. */
export const BOARD_SIZE = 3;
/** Ids of units hired at the market start with this; only they can be dismissed. */
export const HIRED_PREFIX = 'hire-';

/** Jobs on the board, opening up as the story goes on (by chapters won). */
export const RECRUIT_JOBS: { from: number; jobs: string[] }[] = [
  { from: 0, jobs: ['squire', 'knight', 'archer', 'black_mage', 'white_mage', 'monk', 'thief', 'chemist'] },
  { from: 2, jobs: ['dragoon', 'geomancer', 'ninja', 'time_mage', 'oracle', 'summoner', 'tamer'] },
  { from: 4, jobs: ['paladin', 'spellblade', 'bard', 'dancer', 'gunner'] }
];

/** Original names for hopefuls (none belongs to a story character). */
export const RECRUIT_NAMES = [
  'Alden', 'Brisa', 'Caspar', 'Delia', 'Edric', 'Fenna', 'Garrick', 'Hesper', 'Ivo', 'Jessamy',
  'Kael', 'Liesl', 'Merrit', 'Nessa', 'Orrin', 'Petra', 'Quill', 'Rosalind', 'Silas', 'Tamsin',
  'Ulric', 'Vesna', 'Wren', 'Ysolde', 'Ansel', 'Briar', 'Cordelia', 'Dacey', 'Emrys', 'Fallon',
  'Gideon', 'Hollis', 'Ilse', 'Jory', 'Kellan', 'Linnet', 'Mabry', 'Niall', 'Odile', 'Perrin'
];

/** What each job's hopeful says for themselves. */
export const RECRUIT_PITCH: Record<string, string> = {
  squire: 'Carried a lord\'s banner for three summers. Ready to carry my own.',
  knight: 'I held the ford at Fordwarden for a week. Pay me and I\'ll hold your line.',
  archer: 'I can hit a gull on the wing from the lighthouse steps. Most days.',
  black_mage: 'Burned down my master\'s tower by accident. I\'m much better now.',
  white_mage: 'I\'ve patched up worse than you. Keep me behind the shields and I\'ll keep you standing.',
  monk: 'No sword, no armor, no problem.',
  thief: 'I only take from people who deserve it. You look honest. Mostly.',
  chemist: 'Every bottle in this bag has a label. Most of the labels are right.',
  dragoon: 'Give me high ground and a long spear, and I\'ll give you the sky.',
  geomancer: 'The land talks if you listen. Lately it has been shouting.',
  ninja: 'You didn\'t see me come in. That\'s the point.',
  time_mage: 'I\'ll be quick. Quicker than you, at least.',
  oracle: 'I saw you coming. I also saw you paying me.',
  summoner: 'My salamander sleeps in this lantern. Please don\'t knock it over.',
  paladin: 'An oath to the light and a shield to back it.',
  spellblade: 'Steel or sorcery? Why choose?',
  bard: 'Every company needs a song. Yours is about to get better.',
  dancer: 'They watch my feet. They never see the blades.',
  tamer: 'The last wolf that bit me follows me home now. Point me at the next one.',
  gunner: 'Keep your heads down and your ears covered. I hit what I point at.'
};

export interface RecruitOffer {
  /** Board slot, 0 to BOARD_SIZE - 1. */
  slot: number;
  /** Which board this is (battles won on the map). */
  visit: number;
  name: string;
  jobId: string;
  level: number;
  price: number;
  pitch: string;
  /** Hired from this board already: stays on show, marked hired. */
  hired?: boolean;
}

/** What was hired from the board, and on which visit: the save keeps this. */
export interface RecruitHires {
  visit: number;
  slots: number[];
}

/** Picks from a board's seed: the same numbers every time, for the same visit and slot. */
function rnd(visit: number, slot: number, salt: number): number {
  let h = Math.imul(visit + 1, 0x9e3779b1) ^ Math.imul(slot + 7, 0x85ebca6b) ^ Math.imul(salt + 13, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Jobs a hopeful can have, after this many chapters won. */
export function recruitJobs(chaptersWon: number): string[] {
  return RECRUIT_JOBS.filter((t) => chaptersWon >= t.from).flatMap((t) => t.jobs).filter((j) => !!JOBS[j]);
}

/** A hopeful's level: one below the squad's average, at least 1. */
export function recruitLevel(squadLevels: number[]): number {
  if (!squadLevels.length) return 1;
  const avg = squadLevels.reduce((a, b) => a + b, 0) / squadLevels.length;
  return Math.max(1, Math.round(avg) - 1);
}

/** What a hopeful costs: 200 G plus 90 a level, a quarter more for a job that needs others first. */
export function recruitPrice(jobId: string, level: number): number {
  const advanced = (JOBS[jobId]?.prerequisites?.length || 0) > 0;
  return Math.round(((200 + level * 90) * (advanced ? 1.25 : 1)) / 10) * 10;
}

/**
 * This visit's board. Names already in the squad are skipped, so nobody is hired twice under the
 * same name; jobs don't repeat on one board.
 */
export function recruitBoard(visit: number, chaptersWon: number, squad: Pick<Unit, 'name' | 'level'>[], hires?: RecruitHires): RecruitOffer[] {
  const jobs = recruitJobs(chaptersWon);
  const level = recruitLevel(squad.map((u) => u.level));
  const taken = new Set(squad.map((u) => u.name));
  const usedJobs = new Set<string>();
  const out: RecruitOffer[] = [];
  for (let slot = 0; slot < BOARD_SIZE; slot++) {
    let jobId = jobs[Math.floor(rnd(visit, slot, 1) * jobs.length)];
    for (let k = 0; usedJobs.has(jobId) && k < jobs.length; k++) jobId = jobs[(jobs.indexOf(jobId) + 1) % jobs.length];
    usedJobs.add(jobId);
    let n = Math.floor(rnd(visit, slot, 2) * RECRUIT_NAMES.length);
    for (let k = 0; taken.has(RECRUIT_NAMES[n]) && k < RECRUIT_NAMES.length; k++) n = (n + 1) % RECRUIT_NAMES.length;
    const name = RECRUIT_NAMES[n];
    taken.add(name);
    const lv = Math.max(1, level + (rnd(visit, slot, 3) < 0.3 ? 1 : 0));
    out.push({
      slot, visit, name, jobId, level: lv, price: recruitPrice(jobId, lv), pitch: RECRUIT_PITCH[jobId] || '',
      hired: hires?.visit === visit && hires.slots.includes(slot)
    });
  }
  return out;
}

/**
 * The unit a hopeful becomes: their job's gear and first ability, and some JP to spend in it.
 * `takenIds` keeps the id unique (New Game+ starts the boards over).
 */
export function hireRecruit(offer: RecruitOffer, takenIds: string[] = []): Unit {
  let id = `${HIRED_PREFIX}${offer.visit}-${offer.slot}`;
  for (let k = 2; takenIds.includes(id); k++) id = `${HIRED_PREFIX}${offer.visit}-${offer.slot}-${k}`;
  const u = JobSystem.createUnit(id, offer.name, 'player', offer.jobId, 0, 0, 'N', offer.level);
  JobSystem.gainJp(u, offer.level * 40);
  JobSystem.recalculateDerivedStats(u);
  u.currentHp = u.maxHp;
  u.currentMp = u.maxMp;
  return u;
}

/** True for a unit hired at the market (story characters can't be dismissed). */
export function isHired(u: Pick<Unit, 'id'>): boolean {
  return u.id.startsWith(HIRED_PREFIX);
}

/** Only well-formed hires from a real visit survive a save being loaded or imported. */
export function sanitizeRecruitHires(raw: unknown): RecruitHires | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.visit !== 'number' || !Number.isInteger(r.visit) || r.visit < 0 || r.visit > 9999 || !Array.isArray(r.slots)) return undefined;
  const slots = [...new Set(r.slots.filter((s): s is number => Number.isInteger(s) && s >= 0 && s < BOARD_SIZE))];
  return { visit: r.visit, slots };
}

/**
 * Who deploys. Everyone, when the squad fits; otherwise the leader and anyone `required` (a story
 * recruit in the battle they join), then the player's last pick in its order, then the rest of the
 * squad in order if no pick was made, up to PARTY_SIZE.
 */
export function chooseParty(squad: Pick<Unit, 'id'>[], picked: string[] | undefined, required: string[] = []): string[] {
  const ids = squad.map((u) => u.id);
  if (ids.length <= PARTY_SIZE) return ids;
  const out: string[] = [];
  const add = (id: string) => {
    if (out.length < PARTY_SIZE && ids.includes(id) && !out.includes(id)) out.push(id);
  };
  add(LEADER_ID);
  for (const id of required) add(id);
  for (const id of picked && picked.length ? picked : ids) add(id);
  return out;
}

/** A saved party pick: known-shaped ids only, at most a squad's worth. */
export function sanitizeParty(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return [...new Set(raw.filter((s): s is string => typeof s === 'string' && /^[\w-]{1,24}$/.test(s)))].slice(0, MAX_SQUAD);
}
