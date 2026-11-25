import { EnemySpawn, CampaignChapter } from './types';
import { MAPS } from '../data/maps';
import { RARE_DROP_POOL } from '../data/items';

/**
 * Trials of the Zodiac: the post-game endless mode. Each floor is a generated battle whose
 * map, roster and levels are derived from the floor number with a seeded RNG, so a given
 * floor is always the same fight (handy for sharing "I beat floor 12" and for tests).
 */

/** Small, fast, seedable PRNG (mulberry32). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TRIAL_MAP_ROTATION = ['river_ruins', 'gloomy_swamp', 'night_fortress', 'zodiac_summit'];
const TRIAL_JOBS = ['knight', 'archer', 'black_mage', 'white_mage', 'dragoon', 'ninja', 'time_mage', 'geomancer', 'squire', 'monk', 'thief', 'summoner', 'oracle', 'paladin', 'spellblade', 'chemist', 'bard', 'dancer', 'gunner'];
const ZODIAC_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const TITLES: Record<string, string> = {
  knight: 'Sentinel', archer: 'Stalker', black_mage: 'Hexer', white_mage: 'Acolyte', dragoon: 'Lancer',
  ninja: 'Shade', time_mage: 'Seer', geomancer: 'Warden', squire: 'Recruit',
  monk: 'Fist', thief: 'Cutpurse', summoner: 'Caller', oracle: 'Augur', paladin: 'Templar', spellblade: 'Duelist', chemist: 'Alchemist',
  bard: 'Minstrel', dancer: 'Bladedancer', gunner: 'Musketeer',
  wolf: 'Hound', wyvern: 'Drake', ooze: 'Ooze', wisp: 'Wisp', brute: 'Brute',
  basilisk: 'Basilisk', bone_knight: 'Bone Knight', thornling: 'Thornling'
};
/** Monsters on the Trials' floors (0.26.0), from this floor up. */
const TRIAL_MONSTERS = ['wolf', 'wyvern', 'ooze', 'wisp', 'brute'];
export const TRIAL_MONSTERS_FROM = 3;
/** Deeper down, the Briar Barrow's monsters join them (0.32.0). Shallower floors don't change. */
const TRIAL_MONSTERS_DEEP = [...TRIAL_MONSTERS, 'basilisk', 'bone_knight', 'thornling'];
export const TRIAL_DEEP_MONSTERS_FROM = 8;

/** Bosses appear every fifth floor. */
export function isBossFloor(floor: number): boolean {
  return floor % 5 === 0;
}

/** Builds the chapter definition for a Trials floor (floor >= 1). */
export function buildTrialFloor(floor: number): CampaignChapter {
  const rng = seededRng(floor * 7919 + 17);
  const mapId = TRIAL_MAP_ROTATION[(floor - 1) % TRIAL_MAP_ROTATION.length];
  const map = MAPS[mapId]();
  const sign = ZODIAC_SIGNS[(floor - 1) % ZODIAC_SIGNS.length];
  const level = 3 + floor;
  const count = Math.min(6, 4 + Math.floor((floor - 1) / 4));

  // Enemies deploy on the northern quarter of the map, on walkable tiles, never stacked
  const zone = Math.max(3, Math.floor(map.depth / 4));
  const spawnTiles = map.tiles.filter((t) => t.walkable && t.z <= zone);
  const used = new Set<string>();
  const pickTile = () => {
    for (let tries = 0; tries < 200; tries++) {
      const t = spawnTiles[Math.floor(rng() * spawnTiles.length)];
      const k = `${t.x},${t.z}`;
      if (!used.has(k)) {
        used.add(k);
        return t;
      }
    }
    return spawnTiles.find((t) => !used.has(`${t.x},${t.z}`))!;
  };

  const roster: EnemySpawn[] = [];
  const boss = isBossFloor(floor);
  // From floor 3, about one enemy in three is a monster (0.26.0). Its own seed, so the rest of a
  // floor is the same fight it always was
  const beasts = seededRng(floor * 31337 + 5);
  for (let i = 0; i < count; i++) {
    let jobId = TRIAL_JOBS[Math.floor(rng() * TRIAL_JOBS.length)];
    const t = pickTile();
    const isLeader = boss && i === 0;
    const pool = floor >= TRIAL_DEEP_MONSTERS_FROM ? TRIAL_MONSTERS_DEEP : TRIAL_MONSTERS;
    if (!isLeader && floor >= TRIAL_MONSTERS_FROM && beasts() < 0.3) jobId = pool[Math.floor(beasts() * pool.length)];
    roster.push({
      name: isLeader ? `${sign} Warden` : `${sign} ${TITLES[jobId]}`,
      jobId: isLeader ? 'dragoon' : jobId,
      level: isLeader ? level + 1 : level,
      x: t.x,
      z: t.z,
      isBoss: isLeader
    });
  }

  return {
    id: `trial_${floor}`,
    title: `TRIAL ${floor}`,
    subtitle: boss ? `Seal of ${sign}: The Warden Wakes` : `Seal of ${sign}`,
    mapId,
    introDialogue: [],
    victoryDialogue: [],
    enemyRoster: roster
  };
}

/** One random armory item the squad does not own yet (or null if they own everything). */
export function rollTrialDrop(floor: number, owned: string[]): string | null {
  const rng = seededRng(floor * 104729 + 3);
  const pool = RARE_DROP_POOL.filter((id) => !owned.includes(id));
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}
