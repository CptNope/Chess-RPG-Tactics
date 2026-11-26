/**
 * Scenario chains (0.42.0): Workshop scenarios strung together into a mini campaign, played in
 * order with the squad. A chain carries its own copies of its battles, so it can be exported or
 * shared as one link and still play the same anywhere. Nothing here needs a server.
 */
import {
  Issue, Scenario, decodePayload, encodePayload, packForShare, sanitizeScenario, unpackShare, validateScenario
} from './Scenario';

export const CHAIN_FORMAT = 'chess-rpg-tactics/chain';
/** Battles in one chain. */
export const MAX_CHAIN = 8;
/** Chains kept in one browser. */
export const MAX_CHAINS = 20;

export interface Chain {
  format: typeof CHAIN_FORMAT;
  version: 1;
  id: string;
  title: string;
  author: string;
  /** A line or two shown before the first battle and in the chain list. */
  blurb: string;
  /** The battles, in order. Each is a full copy; its id is the library scenario it came from. */
  scenarios: Scenario[];
  updatedAt: number;
}

export const newChainId = () => 'wc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number, dflt = '') => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : dflt);
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function blankChain(): Chain {
  return { format: CHAIN_FORMAT, version: 1, id: newChainId(), title: 'Untitled Chain', author: '', blurb: '', scenarios: [], updatedAt: Date.now() };
}

/** True when the JSON value looks like a chain rather than a scenario. */
export function isChainLike(raw: unknown): boolean {
  return isObj(raw) && (raw.format === CHAIN_FORMAT || (Array.isArray(raw.scenarios) && !isObj(raw.map)));
}

/**
 * Rebuilds a chain from untrusted JSON. Battles that aren't scenarios are dropped; the rest are
 * repaired the way a single scenario is. Throws a readable error when it isn't a chain at all.
 */
export function sanitizeChain(raw: unknown): Chain {
  if (!isChainLike(raw)) throw new Error('Not a scenario chain.');
  const r = raw as Record<string, unknown>;
  const scenarios: Scenario[] = [];
  for (const s of (r.scenarios as unknown[]).slice(0, MAX_CHAIN)) {
    try { scenarios.push(sanitizeScenario(unpackShare(s))); } catch { /* skip a broken battle */ }
  }
  return {
    format: CHAIN_FORMAT,
    version: 1,
    id: typeof r.id === 'string' && /^[\w-]{1,40}$/.test(r.id) ? r.id : newChainId(),
    title: text(r.title, 48, 'Untitled Chain') || 'Untitled Chain',
    author: text(r.author, 32),
    blurb: text(r.blurb, 240),
    scenarios,
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now()
  };
}

/** Parses JSON text into a clean chain. */
export function parseChain(json: string): Chain {
  if (json.length > 4_000_000) throw new Error('That file is too large to be a chain.');
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error("That isn't valid JSON."); }
  return sanitizeChain(raw);
}

/** What stops a chain from being played, and what's worth a second look. */
export function validateChain(c: Chain): Issue[] {
  const issues: Issue[] = [];
  if (c.scenarios.length === 0) issues.push({ level: 'error', text: 'Add at least one battle.' });
  else if (c.scenarios.length === 1) issues.push({ level: 'warning', text: 'Only one battle: add more to make it a chain.' });
  c.scenarios.forEach((s, i) => {
    const err = validateScenario(s).find((x) => x.level === 'error');
    if (err) issues.push({ level: 'error', text: `Battle ${i + 1} (${s.title}): ${err.text}` });
  });
  return issues;
}

export const isChainPlayable = (c: Chain) => !validateChain(c).some((i) => i.level === 'error');

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/** Adds a copy of a scenario at the end. False when the chain is full. */
export function addBattle(c: Chain, s: Scenario): boolean {
  if (c.scenarios.length >= MAX_CHAIN) return false;
  c.scenarios.push(copy(s));
  return true;
}

/** Moves battle i up (-1) or down (+1). */
export function moveBattle(c: Chain, i: number, d: -1 | 1): void {
  const j = i + d;
  if (i < 0 || j < 0 || i >= c.scenarios.length || j >= c.scenarios.length) return;
  [c.scenarios[i], c.scenarios[j]] = [c.scenarios[j], c.scenarios[i]];
}

export function removeBattle(c: Chain, i: number): void {
  if (i >= 0 && i < c.scenarios.length) c.scenarios.splice(i, 1);
}

/**
 * Replaces each battle with the library's newer version of the same scenario, if there is one.
 * Returns how many were updated.
 */
export function refreshFromLibrary(c: Chain, library: Scenario[]): number {
  let n = 0;
  c.scenarios = c.scenarios.map((s) => {
    const latest = library.find((x) => x.id === s.id);
    if (!latest || latest.updatedAt <= s.updatedAt) return s;
    n++;
    return copy(latest);
  });
  return n;
}

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

export type ChainStep = { kind: 'next'; index: number } | { kind: 'complete' } | { kind: 'retry'; index: number };

/** What comes after battle `index` ends. */
export function chainStep(c: Chain, index: number, won: boolean): ChainStep {
  if (!won) return { kind: 'retry', index };
  return index + 1 < c.scenarios.length ? { kind: 'next', index: index + 1 } : { kind: 'complete' };
}

// ---------------------------------------------------------------------------
// Files and links
// ---------------------------------------------------------------------------

/** The compact form used in links and the library: each battle's tiles packed as rows. */
export function packChain(c: Chain): unknown {
  return { ...c, scenarios: c.scenarios.map(packForShare) };
}

/** Encodes a chain for the `#c=` share link. */
export async function encodeChainShare(c: Chain): Promise<string> {
  return encodePayload(packChain(c));
}

/** Decodes a `#c=` value back into a clean chain. */
export async function decodeChainShare(code: string): Promise<Chain> {
  return sanitizeChain(await decodePayload(code, 600_000));
}

// ---------------------------------------------------------------------------
// Library and progress (this browser)
// ---------------------------------------------------------------------------

const LIBRARY_KEY = 'chess_rpg_tactics_chains_v1';
const PROGRESS_KEY = 'chess_rpg_tactics_chain_progress_v1';

export const ChainLibrary = {
  list(): Chain[] {
    try {
      const raw = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      const out: Chain[] = [];
      for (const r of raw.slice(0, MAX_CHAINS)) {
        try { out.push(sanitizeChain(r)); } catch { /* skip broken entries */ }
      }
      return out.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  },
  save(c: Chain): boolean {
    try {
      c.updatedAt = Date.now();
      const all = [c, ...ChainLibrary.list().filter((x) => x.id !== c.id)].slice(0, MAX_CHAINS);
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(all.map(packChain)));
      return true;
    } catch {
      return false;
    }
  },
  remove(id: string): void {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(ChainLibrary.list().filter((x) => x.id !== id).map(packChain)));
    } catch { /* storage unavailable */ }
    ChainProgress.clear(id);
  }
};

/** The next battle to play in each chain, so a chain can be put down and picked up again. */
export const ChainProgress = {
  all(): Record<string, number> {
    try {
      const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      return isObj(raw) ? Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'number' && v >= 0 && v < MAX_CHAIN)) as Record<string, number> : {};
    } catch {
      return {};
    }
  },
  /** The battle to resume at (0 when none is saved or the chain has since got shorter). */
  get(c: Chain): number {
    const i = ChainProgress.all()[c.id] || 0;
    return i < c.scenarios.length ? i : 0;
  },
  set(id: string, index: number): void {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...ChainProgress.all(), [id]: index })); } catch { /* storage unavailable */ }
  },
  clear(id: string): void {
    const all = ChainProgress.all();
    delete all[id];
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)); } catch { /* storage unavailable */ }
  }
};
