/**
 * Workshop scenarios: a custom battlefield plus enemies, story and rules, stored as plain JSON.
 *
 * Everything that comes from outside the game (an imported file, a share link, localStorage)
 * goes through `sanitizeScenario`, which rebuilds the scenario field by field, clamps every
 * number, drops unknown ids and trims text, so a hostile file can't break or inject into the game.
 */
import { MapData, MAPS, MapBuilder, spawnsFor } from '../data/maps';
import { JOBS } from '../data/jobs';
import { ITEMS } from '../data/items';
import { CampaignChapter, DialogueLine, EnemySpawn, BattleObjective, TerrainType, TileData, FacingDirection } from './types';

export const SCENARIO_FORMAT = 'chess-rpg-tactics/scenario';
export const MIN_SIZE = 8;
export const MAX_SIZE = 24;
export const MAX_HEIGHT = 6;
export const MAX_ENEMIES = 16;
export const MAX_SPAWNS = 6;
export const MAX_LINES = 40;

export const TERRAINS: TerrainType[] = ['grass', 'stone', 'dirt', 'water', 'wood', 'swamp', 'parapet'];

/** Map "looks": lighting, sky and weather presets. */
export const LOOKS: { id: string; name: string; theme: MapData['theme'] }[] = [
  { id: 'day', name: 'Daylight', theme: 'day' },
  { id: 'night', name: 'Moonlit night', theme: 'night' },
  { id: 'swamp', name: 'Misty swamp', theme: 'swamp' },
  { id: 'zodiac_summit', name: 'Zodiac summit', theme: 'night' }
];

/** Named characters with drawn portraits (job portraits cover everyone else). */
export const NAMED_PORTRAITS: { id: string; name: string }[] = [
  { id: 'rowan', name: 'Rowan' },
  { id: 'maren', name: 'Maren' },
  { id: 'tobin', name: 'Tobin' },
  { id: 'corvin', name: 'Corvin' },
  { id: 'bria', name: 'Bria' }
];

export interface Scenario {
  format: typeof SCENARIO_FORMAT;
  version: 1;
  id: string;
  title: string;
  subtitle: string;
  author: string;
  map: MapData;
  enemies: EnemySpawn[];
  intro: DialogueLine[];
  victory: DialogueLine[];
  objective: BattleObjective;
  rewardItemIds: string[];
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export const newScenarioId = () => 'ws_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** A flat field with the squad's deploy zone along the southern rows. */
export function blankScenario(width = 16, depth = 16, look = 'day', terrain: TerrainType = 'grass'): Scenario {
  width = clampInt(width, MIN_SIZE, MAX_SIZE, 16);
  depth = clampInt(depth, MIN_SIZE, MAX_SIZE, 16);
  const lk = LOOKS.find((l) => l.id === look) || LOOKS[0];
  const b = new MapBuilder(width, depth, 1, TERRAINS.includes(terrain) ? terrain : 'grass');
  const cx = Math.floor(width / 2);
  const spawns = [
    { x: cx - 1, z: depth - 2 }, { x: cx, z: depth - 2 }, { x: cx + 1, z: depth - 2 },
    { x: cx - 1, z: depth - 1 }, { x: cx, z: depth - 1 }, { x: cx + 1, z: depth - 1 }
  ];
  const map = b.build('custom', 'Untitled field', lk.theme, spawns);
  map.look = lk.id;
  return {
    format: SCENARIO_FORMAT,
    version: 1,
    id: newScenarioId(),
    title: 'Untitled Scenario',
    subtitle: 'A Workshop battle',
    author: '',
    map,
    enemies: [{ name: 'Bandit Chief', jobId: 'knight', level: 3, x: cx, z: 1, isBoss: true, facing: 'S' }],
    intro: [],
    victory: [],
    objective: { type: 'rout' },
    rewardItemIds: [],
    updatedAt: Date.now()
  };
}

/** A scenario that starts from one of the built-in battlefields (no enemies yet). */
export function scenarioFromMap(mapId: string): Scenario {
  const make = MAPS[mapId] || MAPS.river_ruins;
  const map = clone(make());
  map.look = map.look || map.id;
  map.playerSpawns = spawnsFor(map).slice(0, MAX_SPAWNS);
  const s = blankScenario(map.width, map.depth);
  s.map = { ...map, id: 'custom', name: `${map.name} (copy)` };
  s.title = `${map.name} Skirmish`;
  s.enemies = [];
  return s;
}

/** A scenario copied from a campaign chapter: map, enemies, dialogue and rewards. */
export function scenarioFromChapter(ch: CampaignChapter): Scenario {
  const s = scenarioFromMap(ch.mapId);
  s.title = `${ch.title} (remix)`;
  s.subtitle = ch.subtitle;
  s.enemies = clone(ch.enemyRoster);
  s.intro = clone(ch.introDialogue);
  s.victory = clone(ch.victoryDialogue);
  s.rewardItemIds = [...(ch.rewardItemIds || [])];
  s.objective = ch.objective ? clone(ch.objective) : { type: 'rout' };
  return s;
}

/** Turns a scenario into a playable chapter (ids are namespaced so they never clash with the campaign). */
export function scenarioToChapter(s: Scenario): CampaignChapter {
  return {
    id: `custom:${s.id}`,
    title: s.title,
    subtitle: s.subtitle,
    mapId: 'custom',
    mapData: clone(s.map),
    introDialogue: clone(s.intro),
    victoryDialogue: clone(s.victory),
    enemyRoster: clone(s.enemies),
    rewardItemIds: [...s.rewardItemIds],
    objective: clone(s.objective)
  };
}

// ---------------------------------------------------------------------------
// Validation (problems the author should fix before playing)
// ---------------------------------------------------------------------------

export interface Issue {
  level: 'error' | 'warning';
  text: string;
}

export function validateScenario(s: Scenario): Issue[] {
  const issues: Issue[] = [];
  const at = (x: number, z: number) => s.map.tiles[z * s.map.width + x];
  const spawns = s.map.playerSpawns || [];

  if (spawns.length === 0) issues.push({ level: 'error', text: 'Place at least one squad deploy tile (Units → Squad spawn).' });
  if (spawns.length < 4) issues.push({ level: 'warning', text: `Only ${spawns.length} deploy tile${spawns.length === 1 ? '' : 's'}: extra squad members will deploy on the nearest open southern tile.` });
  for (const p of spawns) if (!at(p.x, p.z)?.walkable) issues.push({ level: 'error', text: `Deploy tile (${p.x}, ${p.z}) is blocked.` });

  if (s.enemies.length === 0 && s.objective.type !== 'survive') issues.push({ level: 'error', text: 'Add at least one enemy (Units → Enemy).' });
  const spawnKeys = new Set(spawns.map((p) => `${p.x},${p.z}`));
  for (const e of s.enemies) {
    if (!at(e.x, e.z)?.walkable) issues.push({ level: 'error', text: `${e.name} stands on a blocked tile (${e.x}, ${e.z}).` });
    if (spawnKeys.has(`${e.x},${e.z}`)) issues.push({ level: 'error', text: `${e.name} is on a squad deploy tile.` });
  }

  if (s.objective.type === 'boss' && !s.enemies.some((e) => e.isBoss)) {
    issues.push({ level: 'error', text: 'The "Defeat the boss" objective needs an enemy marked as boss.' });
  }
  if (s.objective.type === 'survive' && s.enemies.length === 0) {
    issues.push({ level: 'warning', text: 'Nothing attacks you: the survive objective will be an easy win.' });
  }

  // Reachability: every enemy should be reachable on foot (Jump 3) from the first deploy tile
  if (spawns[0] && at(spawns[0].x, spawns[0].z)?.walkable) {
    const seen = new Set([`${spawns[0].x},${spawns[0].z}`]);
    const queue = [spawns[0]];
    while (queue.length) {
      const c = queue.shift()!;
      const h = at(c.x, c.z).height;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = c.x + dx, z = c.z + dz;
        if (x < 0 || z < 0 || x >= s.map.width || z >= s.map.depth) continue;
        const t = at(x, z);
        if (!t.walkable || seen.has(`${x},${z}`) || Math.abs(t.height - h) > 3) continue;
        seen.add(`${x},${z}`);
        queue.push({ x, z });
      }
    }
    const cut = s.enemies.filter((e) => !seen.has(`${e.x},${e.z}`));
    if (cut.length) issues.push({ level: 'warning', text: `Melee units can't walk to: ${cut.map((e) => e.name).join(', ')}. (Archers, mages and jumpers still can.)` });
  }
  return issues;
}

export const isPlayable = (s: Scenario) => !validateScenario(s).some((i) => i.level === 'error');

// ---------------------------------------------------------------------------
// Sanitising untrusted input
// ---------------------------------------------------------------------------

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : dflt;
  return Math.min(max, Math.max(min, n));
}

function clampNum(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : dflt;
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}

/** Plain text only: strips control characters and caps the length. */
function text(v: unknown, max: number, dflt = ''): string {
  if (typeof v !== 'string') return dflt;
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  return t.slice(0, max) || dflt;
}

const own = (o: object, k: unknown) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const FACINGS: FacingDirection[] = ['N', 'E', 'S', 'W'];
const PORTRAIT_IDS = new Set([...NAMED_PORTRAITS.map((p) => p.id), ...Object.keys(JOBS), ...Object.keys(JOBS).map((j) => `foe_${j}`)]);

function sanitizeLines(v: unknown): DialogueLine[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_LINES).filter(isObj).map((l) => {
    const portrait = typeof l.portrait === 'string' && PORTRAIT_IDS.has(l.portrait) ? l.portrait : undefined;
    const line: DialogueLine = {
      speaker: text(l.speaker, 32, '???'),
      portraitClass: text(l.portraitClass, 4, '💬'),
      side: l.side === 'right' ? 'right' : 'left',
      text: text(l.text, 400, '…')
    };
    if (portrait) line.portrait = portrait;
    return line;
  });
}

/**
 * Rebuilds a scenario from untrusted JSON. Throws an Error with a readable message when the
 * input isn't a scenario at all; otherwise repairs whatever it can.
 */
export function sanitizeScenario(raw: unknown): Scenario {
  if (!isObj(raw)) throw new Error('Not a scenario file.');
  // Accept a bare map (the old editor's export) as well as a full scenario
  const rawMap = isObj(raw.map) ? raw.map : Array.isArray(raw.tiles) ? raw : null;
  if (!rawMap) throw new Error('The file has no battlefield.');

  const width = clampInt(rawMap.width, MIN_SIZE, MAX_SIZE, 16);
  const depth = clampInt(rawMap.depth, MIN_SIZE, MAX_SIZE, 16);
  const look = LOOKS.find((l) => l.id === rawMap.look) || LOOKS.find((l) => l.id === rawMap.theme) || LOOKS[0];

  // Start flat, then copy each valid tile in; missing/garbage tiles stay flat grass
  const tiles: TileData[] = [];
  for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) tiles.push({ x, z, height: 1, terrain: 'grass', walkable: true });
  const srcTiles = Array.isArray(rawMap.tiles) ? rawMap.tiles.slice(0, MAX_SIZE * MAX_SIZE * 2) : [];
  for (const t of srcTiles) {
    if (!isObj(t)) continue;
    const x = clampInt(t.x, -1, MAX_SIZE, -1), z = clampInt(t.z, -1, MAX_SIZE, -1);
    if (x < 0 || z < 0 || x >= width || z >= depth) continue;
    tiles[z * width + x] = {
      x, z,
      height: clampNum(t.height, 0, MAX_HEIGHT, 1),
      terrain: TERRAINS.includes(t.terrain as TerrainType) ? (t.terrain as TerrainType) : 'grass',
      walkable: t.walkable !== false
    };
  }

  const inside = (p: unknown): p is { x: number; z: number } =>
    isObj(p) && Number.isInteger(p.x) && Number.isInteger(p.z) && (p.x as number) >= 0 && (p.z as number) >= 0 && (p.x as number) < width && (p.z as number) < depth;

  const spawnSeen = new Set<string>();
  const playerSpawns = (Array.isArray(rawMap.playerSpawns) ? rawMap.playerSpawns : [])
    .filter(inside)
    .map((p) => ({ x: p.x, z: p.z }))
    .filter((p) => !spawnSeen.has(`${p.x},${p.z}`) && spawnSeen.add(`${p.x},${p.z}`))
    .slice(0, MAX_SPAWNS);

  const map: MapData = {
    id: 'custom',
    name: text(rawMap.name, 40, 'Custom field'),
    theme: look.theme,
    look: look.id,
    width,
    depth,
    tiles,
    playerSpawns
  };

  const enemySeen = new Set<string>();
  const enemies: EnemySpawn[] = (Array.isArray(raw.enemies) ? raw.enemies : [])
    .filter((e: unknown): e is Record<string, unknown> => inside(e) && typeof (e as Record<string, unknown>).jobId === 'string' && own(JOBS, (e as Record<string, unknown>).jobId))
    .filter((e) => !enemySeen.has(`${e.x},${e.z}`) && enemySeen.add(`${e.x},${e.z}`))
    .slice(0, MAX_ENEMIES)
    .map((e) => {
      const spawn: EnemySpawn = {
        name: text(e.name, 28, JOBS[e.jobId as string].name),
        jobId: e.jobId as string,
        level: clampInt(e.level, 1, 20, 3),
        x: e.x as number,
        z: e.z as number,
        facing: FACINGS.includes(e.facing as FacingDirection) ? (e.facing as FacingDirection) : 'S'
      };
      if (e.isBoss === true) spawn.isBoss = true;
      return spawn;
    });

  const o = isObj(raw.objective) ? raw.objective : {};
  const type = o.type === 'boss' || o.type === 'survive' ? o.type : 'rout';
  const objective: BattleObjective = type === 'survive' ? { type, rounds: clampInt(o.rounds, 2, 30, 6) } : { type };

  const rewards = Array.isArray(raw.rewardItemIds) ? raw.rewardItemIds : [];
  return {
    format: SCENARIO_FORMAT,
    version: 1,
    id: typeof raw.id === 'string' && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : newScenarioId(),
    title: text(raw.title, 48, 'Untitled Scenario'),
    subtitle: text(raw.subtitle, 64, 'A Workshop battle'),
    author: text(raw.author, 32),
    map,
    enemies,
    intro: sanitizeLines(raw.intro),
    victory: sanitizeLines(raw.victory),
    objective,
    rewardItemIds: [...new Set(rewards.filter((id): id is string => own(ITEMS, id)))].slice(0, 6),
    updatedAt: clampInt(raw.updatedAt, 0, 4102444800000, Date.now())
  };
}

/** Parses JSON text (a file or pasted text) into a clean scenario. */
export function parseScenario(json: string): Scenario {
  if (json.length > 2_000_000) throw new Error('That file is too large to be a scenario.');
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("That isn't valid JSON.");
  }
  return sanitizeScenario(raw);
}

// ---------------------------------------------------------------------------
// Compact share links: #s=<base64url(deflate(json))>
// ---------------------------------------------------------------------------

/** Compact form for links: tiles become one string per row (height*10, terrain letter, ! for blocked). */
function packForShare(s: Scenario): unknown {
  const letter: Record<TerrainType, string> = { grass: 'g', stone: 's', dirt: 'd', water: 'w', wood: 'o', swamp: 'm', parapet: 'p' };
  const rows: string[] = [];
  for (let z = 0; z < s.map.depth; z++) {
    const row: string[] = [];
    for (let x = 0; x < s.map.width; x++) {
      const t = s.map.tiles[z * s.map.width + x];
      row.push(`${Math.round(t.height * 10)}${letter[t.terrain]}${t.walkable ? '' : '!'}`);
    }
    rows.push(row.join(','));
  }
  return { ...s, map: { ...s.map, tiles: undefined, rows } };
}

function unpackShare(raw: unknown): unknown {
  if (!isObj(raw) || !isObj(raw.map) || !Array.isArray(raw.map.rows)) return raw;
  const byLetter: Record<string, TerrainType> = { g: 'grass', s: 'stone', d: 'dirt', w: 'water', o: 'wood', m: 'swamp', p: 'parapet' };
  const tiles: unknown[] = [];
  raw.map.rows.slice(0, MAX_SIZE).forEach((row, z) => {
    if (typeof row !== 'string') return;
    row.split(',').slice(0, MAX_SIZE).forEach((cell, x) => {
      const m = /^(\d{1,3})([a-z])(!?)$/.exec(cell);
      if (m) tiles.push({ x, z, height: Number(m[1]) / 10, terrain: byLetter[m[2]] || 'grass', walkable: m[3] !== '!' });
    });
  });
  return { ...raw, map: { ...raw.map, tiles } };
}

const toB64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Encodes a scenario for the `#s=` share link. */
export async function encodeShare(s: Scenario): Promise<string> {
  const json: Uint8Array<ArrayBuffer> = new TextEncoder().encode(JSON.stringify(packForShare(s)));
  if (typeof CompressionStream === 'undefined') return 'j' + toB64Url(json);
  return 'z' + toB64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

/** Decodes a `#s=` value back into a clean scenario (throws on garbage). */
export async function decodeShare(code: string): Promise<Scenario> {
  if (code.length > 200_000) throw new Error('Share link is too long.');
  let raw: unknown;
  try {
    const kind = code[0];
    let bytes = fromB64Url(code.slice(1));
    if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (kind !== 'j') throw new Error('bad prefix');
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('That share link is damaged.');
  }
  return sanitizeScenario(unpackShare(raw));
}

// ---------------------------------------------------------------------------
// Library (this browser)
// ---------------------------------------------------------------------------

const LIBRARY_KEY = 'chess_rpg_tactics_workshop_v1';

export const Library = {
  list(): Scenario[] {
    try {
      const raw = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      const out: Scenario[] = [];
      for (const r of raw.slice(0, 100)) {
        try { out.push(sanitizeScenario(r)); } catch { /* skip broken entries */ }
      }
      return out.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  },
  save(s: Scenario): boolean {
    try {
      const all = Library.list().filter((x) => x.id !== s.id);
      s.updatedAt = Date.now();
      all.unshift(s);
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(all.slice(0, 50)));
      return true;
    } catch {
      return false;
    }
  },
  remove(id: string): void {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(Library.list().filter((x) => x.id !== id)));
    } catch { /* storage unavailable */ }
  }
};
