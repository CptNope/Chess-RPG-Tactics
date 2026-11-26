// Scenario chains (0.42.0): mini campaigns built from Workshop scenarios.
import { describe, it, expect, beforeEach } from 'vitest';
import { blankScenario, scenarioFromChapter } from '../src/core/Scenario';
import {
  CHAIN_FORMAT, MAX_CHAIN, addBattle, blankChain, chainStep, decodeChainShare, encodeChainShare, isChainLike, moveBattle,
  parseChain, refreshFromLibrary, removeBattle, sanitizeChain, validateChain, ChainLibrary, ChainProgress
} from '../src/core/Chain';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
beforeEach(() => { (globalThis as any).localStorage = new MemoryStorage(); });

/** A playable scenario: a campaign chapter remixed. */
const battle = (title: string) => {
  const s = scenarioFromChapter(CAMPAIGN_CHAPTERS.chapter_1);
  s.title = title;
  return s;
};

const threeBattles = () => {
  const c = blankChain();
  c.title = 'The Long Road';
  for (const t of ['Ford', 'Ridge', 'Keep']) addBattle(c, battle(t));
  return c;
};

describe('scenario chains (0.42.0)', () => {
  it('adds copies, moves and removes battles, and stops at the limit', () => {
    const c = threeBattles();
    const keep = c.scenarios[2];
    moveBattle(c, 2, -1);
    expect(c.scenarios.map((s) => s.title)).toEqual(['Ford', 'Keep', 'Ridge']);
    moveBattle(c, 0, -1); // nothing above the first
    expect(c.scenarios[0].title).toBe('Ford');
    removeBattle(c, 1);
    expect(c.scenarios.map((s) => s.title)).toEqual(['Ford', 'Ridge']);
    expect(c.scenarios).not.toContain(keep);

    const src = battle('Copy me');
    addBattle(c, src);
    src.title = 'Changed later';
    expect(c.scenarios[2].title).toBe('Copy me'); // a chain keeps its own copy
    while (addBattle(c, battle('More')));
    expect(c.scenarios.length).toBe(MAX_CHAIN);
  });

  it('checks every battle, and needs at least one', () => {
    const c = blankChain();
    expect(validateChain(c).some((i) => i.level === 'error')).toBe(true);
    addBattle(c, battle('Only'));
    expect(validateChain(c)).toEqual([{ level: 'warning', text: 'Only one battle: add more to make it a chain.' }]);
    const broken = blankScenario();
    broken.map.playerSpawns = []; // nowhere to deploy
    broken.title = 'Empty field';
    addBattle(c, broken);
    const errs = validateChain(c).filter((i) => i.level === 'error');
    expect(errs[0].text).toMatch(/^Battle 2 \(Empty field\):/);
  });

  it('goes on to the next battle, retries a loss, and ends after the last', () => {
    const c = threeBattles();
    expect(chainStep(c, 0, true)).toEqual({ kind: 'next', index: 1 });
    expect(chainStep(c, 1, false)).toEqual({ kind: 'retry', index: 1 });
    expect(chainStep(c, 2, true)).toEqual({ kind: 'complete' });
  });

  it('updates battles from newer library versions only', () => {
    const c = threeBattles();
    const newer = JSON.parse(JSON.stringify(c.scenarios[1]));
    newer.title = 'Ridge (revised)';
    newer.updatedAt = c.scenarios[1].updatedAt + 1000;
    const older = JSON.parse(JSON.stringify(c.scenarios[2]));
    older.title = 'Keep (old)';
    older.updatedAt = c.scenarios[2].updatedAt - 1000;
    expect(refreshFromLibrary(c, [newer, older])).toBe(1);
    expect(c.scenarios.map((s) => s.title)).toEqual(['Ford', 'Ridge (revised)', 'Keep']);
  });

  it('survives a share link and a file round trip, and repairs what it can', async () => {
    const c = threeBattles();
    c.author = 'Jeremy';
    c.blurb = 'Three fights to the keep.';
    const back = await decodeChainShare(await encodeChainShare(c));
    expect(back.title).toBe('The Long Road');
    expect(back.scenarios.map((s) => s.title)).toEqual(['Ford', 'Ridge', 'Keep']);
    expect(back.scenarios[0].map.tiles).toEqual(c.scenarios[0].map.tiles);
    expect(parseChain(JSON.stringify(c)).blurb).toBe('Three fights to the keep.');

    // garbage battles are dropped, overlong text trimmed, the limit kept
    const messy = sanitizeChain({ format: CHAIN_FORMAT, title: 'x'.repeat(200), scenarios: [42, 'no', ...Array(12).fill(c.scenarios[0])] });
    expect(messy.title.length).toBe(48);
    expect(messy.scenarios.length).toBe(MAX_CHAIN - 2);
    expect(() => sanitizeChain({ map: {} })).toThrow('Not a scenario chain.');
    expect(isChainLike(c.scenarios[0])).toBe(false);
    await expect(decodeChainShare('zgarbage')).rejects.toThrow('damaged');
  });

  it('keeps chains and where you got to in this browser', () => {
    const c = threeBattles();
    expect(ChainLibrary.save(c)).toBe(true);
    expect(ChainLibrary.list().map((x) => x.title)).toEqual(['The Long Road']);
    expect(ChainProgress.get(c)).toBe(0);
    ChainProgress.set(c.id, 2);
    expect(ChainProgress.get(c)).toBe(2);
    // a chain that got shorter starts over
    removeBattle(c, 2);
    expect(ChainProgress.get(c)).toBe(0);
    ChainLibrary.remove(c.id);
    expect(ChainLibrary.list()).toEqual([]);
    expect(ChainProgress.all()[c.id]).toBeUndefined();
  });
});
