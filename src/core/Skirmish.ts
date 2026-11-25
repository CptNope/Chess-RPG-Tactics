/**
 * Side battles: optional, replayable fights at places on the world map. They pay gil, EXP and JP
 * every time, so a squad that is stuck (or chasing job mastery) has somewhere to train.
 *
 * A side battle is generated, like a Trials floor: the place fixes the battlefield, the kind of
 * enemy and the objective; the levels follow the squad, and each win there makes the next visit
 * a little harder (up to a cap).
 */
import { BattleObjective, CampaignChapter, EnemySpawn } from './types';
import { MAPS } from '../data/maps';
import { seededRng } from './Rng';

export interface SkirmishDef {
  id: string;
  /** The world-map place it is fought at. */
  name: string;
  mapId: string;
  /** Who you fight there, e.g. "Thornwood Bandits". */
  foe: string;
  /** Jobs the roster is drawn from, with the name each goes by. */
  jobs: [jobId: string, title: string][];
  /** Opens once any one of these chapters is won. */
  opensAfter: string[];
  objective?: BattleObjective;
  intro: string;
  /** Gear won the first time the place is cleared (0.21.0). A relic: never sold. */
  trophy: string;
  /** Enemies on a first visit (default 4); one more once the place is at full heat (0.35.0). */
  size?: number;
}

export const SKIRMISHES: Record<string, SkirmishDef> = {
  thornwood: {
    id: 'thornwood',
    name: 'Thornwood Ford',
    mapId: 'river_ruins',
    foe: 'Thornwood Bandits',
    jobs: [['thief', 'Cutpurse'], ['archer', 'Poacher'], ['squire', 'Footpad'], ['monk', 'Bruiser'], ['knight', 'Deserter']],
    opensAfter: ['chapter_1'],
    intro: 'Bandits hold the ford and rob everyone who crosses. Clear them out.',
    trophy: 'fordwarden_bow'
  },
  shrine: {
    id: 'shrine',
    name: 'Drowned Shrine',
    mapId: 'gloomy_swamp',
    foe: 'Mire Cultists',
    jobs: [['black_mage', 'Hexer'], ['oracle', 'Augur'], ['summoner', 'Caller'], ['time_mage', 'Seer'], ['white_mage', 'Acolyte'], ['ninja', 'Shade']],
    opensAfter: ['chapter_2a', 'chapter_2b', 'chapter_3'], // chapter_3 covers old saves that don't record which road was taken
    intro: 'Robed figures chant among the sunken stones. Break the circle before the rite is done.',
    trophy: 'chanting_censer'
  },
  ridge: {
    id: 'ridge',
    name: 'Watchfire Ridge',
    mapId: 'night_fortress',
    foe: 'Night Raiders',
    jobs: [['knight', 'Raider'], ['dragoon', 'Lancer'], ['archer', 'Marksman'], ['ninja', 'Shade'], ['spellblade', 'Duelist'], ['geomancer', 'Warden']],
    opensAfter: ['chapter_2a', 'chapter_2b', 'chapter_3'], // chapter_3 covers old saves that don't record which road was taken
    objective: { type: 'survive', rounds: 6 },
    intro: 'Raiders come up the ridge in the dark. Hold the watchfire until the garrison arrives.',
    trophy: 'watchfire_helm'
  },
  // Added in 0.26.0: monsters
  hollow: {
    id: 'hollow',
    name: 'Howling Hollow',
    mapId: 'zodiac_summit',
    foe: 'Wild Beasts',
    jobs: [['wolf', 'Pack Leader'], ['wolf', 'Dire Wolf'], ['wyvern', 'Wyvern'], ['ooze', 'Bog Ooze'], ['wisp', 'Marsh Wisp'], ['brute', 'Stonehide Brute']],
    opensAfter: ['chapter_1'],
    intro: 'Something has driven the beasts down from the high pass. Wolves first, by the sound of it. Stay together.',
    trophy: 'wolfpelt_mantle'
  },
  // Added in 0.32.0: more monsters
  barrow: {
    id: 'barrow',
    name: 'Briar Barrow',
    mapId: 'gloomy_swamp',
    foe: 'Barrow Things',
    jobs: [['bone_knight', 'Barrow Guard'], ['basilisk', 'Basilisk'], ['thornling', 'Thornling'], ['bone_knight', 'Bone Knight'], ['thornling', 'Briar Thornling'], ['wisp', 'Barrow Wisp']],
    opensAfter: ['chapter_3'],
    intro: 'The old kings\' barrow has gone to briars, and something in there is still standing guard. Watch for the lizard: don\'t meet its eyes.',
    trophy: 'basilisk_eye'
  },
  // Added in 0.35.0: the Far Shore
  glasswing: {
    id: 'glasswing',
    name: 'Glasswing Dunes',
    mapId: 'saltglass_shore',
    size: 5,
    foe: 'Dune Beasts',
    jobs: [['wyvern', 'Glasswing Wyvern'], ['basilisk', 'Dune Basilisk'], ['thornling', 'Sea Thornling'], ['wolf', 'Dune Jackal'], ['brute', 'Glass Golem'], ['bone_knight', 'Drowned Sentry']],
    opensAfter: ['chapter_7'],
    intro: 'Kestrel says the wyvern that nests in the glass dunes has started taking goats from the coast. It has jackals following it for the scraps. Mind the wind: it dives with it.',
    trophy: 'glasswing_lance'
  }
};

/** Each win at a place raises its enemies by one level, up to this many. */
export const SKIRMISH_MAX_HEAT = 2;

/** True when the place can be fought at: one of the chapters that opens it is won. */
export function skirmishOpen(id: string, cleared: string[]): boolean {
  const def = SKIRMISHES[id];
  return !!def && def.opensAfter.some((c) => cleared.includes(c));
}

/**
 * Enemy level for a side battle: the squad's average level (rounded down, so the fight leans
 * the player's way the first time), plus one per earlier win there up to SKIRMISH_MAX_HEAT.
 */
export function skirmishLevel(squadLevels: number[], wins: number): number {
  const avg = squadLevels.length ? squadLevels.reduce((a, b) => a + b, 0) / squadLevels.length : 1;
  return Math.max(1, Math.floor(avg) + Math.min(SKIRMISH_MAX_HEAT, Math.max(0, Math.floor(wins))));
}

/** Gil bonus for winning a side battle (on top of bounties). The first win at a place pays double. */
export function skirmishBonus(wins: number): number {
  return wins > 0 ? 80 : 160;
}

/** Builds the battle for a side-battle place. The same place, level and win count always give the same fight. */
export function buildSkirmish(id: string, squadLevels: number[], wins: number): CampaignChapter {
  const def = SKIRMISHES[id];
  if (!def) throw new Error(`Unknown side battle: ${id}`);
  const level = skirmishLevel(squadLevels, wins);
  const rng = seededRng(hashId(id) + wins * 7919 + level * 31);
  const map = MAPS[def.mapId]();
  const count = (def.size ?? 4) + (wins >= SKIRMISH_MAX_HEAT ? 1 : 0);

  // Enemies deploy on the northern quarter of the map, on walkable tiles, never stacked
  const zone = Math.max(3, Math.floor(map.depth / 4));
  const spawnTiles = map.tiles.filter((t) => t.walkable && t.z <= zone);
  const used = new Set<string>();
  const pickTile = () => {
    for (let tries = 0; tries < 200; tries++) {
      const t = spawnTiles[Math.floor(rng() * spawnTiles.length)];
      const k = `${t.x},${t.z}`;
      if (!used.has(k)) { used.add(k); return t; }
    }
    return spawnTiles.find((t) => !used.has(`${t.x},${t.z}`))!;
  };

  const roster: EnemySpawn[] = [];
  for (let i = 0; i < count; i++) {
    // The first two slots are fixed so every visit has the place's signature enemies
    const [jobId, title] = i < 2 ? def.jobs[i] : def.jobs[Math.floor(rng() * def.jobs.length)];
    const t = pickTile();
    roster.push({ name: title, jobId, level: i === 0 ? level + 1 : level, x: t.x, z: t.z });
  }

  return {
    id: `skirmish_${id}`,
    title: 'SIDE BATTLE',
    subtitle: `${def.name}: ${def.foe}`,
    mapId: def.mapId,
    introDialogue: [{ speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: def.intro }],
    victoryDialogue: [],
    enemyRoster: roster,
    objective: def.objective
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Saved win counts made safe: known places only, whole numbers from 0 up. */
export function sanitizeSkirmishWins(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const id of Object.keys(SKIRMISHES)) {
    const n = Math.floor(Number((raw as Record<string, unknown>)[id]));
    if (Number.isFinite(n) && n > 0) out[id] = Math.min(999, n);
  }
  return out;
}

/**
 * Trophies a squad has earned but doesn't hold: a save from before 0.21.0 with wins at a place
 * gets its trophy when loaded.
 */
export function missingTrophies(wins: Record<string, number>, armory: string[]): string[] {
  return Object.values(SKIRMISHES).filter((d) => (wins[d.id] || 0) > 0 && !armory.includes(d.trophy)).map((d) => d.trophy);
}
