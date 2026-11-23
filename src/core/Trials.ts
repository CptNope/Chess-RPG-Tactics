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
const TRIAL_JOBS = ['knight', 'archer', 'black_mage', 'white_mage', 'dragoon', 'ninja', 'time_mage', 'geomancer', 'squire', 'monk', 'thief', 'summoner', 'oracle', 'paladin', 'spellblade'];
const ZODIAC_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const TITLES: Record<string, string> = {
  knight: 'Sentinel', archer: 'Stalker', black_mage: 'Hexer', white_mage: 'Acolyte', dragoon: 'Lancer',
  ninja: 'Shade', time_mage: 'Seer', geomancer: 'Warden', squire: 'Recruit',
  monk: 'Fist', thief: 'Cutpurse', summoner: 'Caller', oracle: 'Augur', paladin: 'Templar', spellblade: 'Duelist'
};

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
  for (let i = 0; i < count; i++) {
    const jobId = TRIAL_JOBS[Math.floor(rng() * TRIAL_JOBS.length)];
    const t = pickTile();
    const isLeader = boss && i === 0;
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
