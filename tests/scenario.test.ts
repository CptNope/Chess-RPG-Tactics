import { describe, it, expect } from 'vitest';
import {
  blankScenario, scenarioFromMap, scenarioFromChapter, scenarioToChapter, sanitizeScenario, parseScenario,
  validateScenario, isPlayable, encodeShare, decodeShare, MAX_SIZE, MAX_ENEMIES, MAX_HEIGHT
} from '../src/core/Scenario';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { MAPS } from '../src/data/maps';
import { BattleGrid } from '../src/core/Grid';

describe('Workshop scenarios', () => {
  it('a blank scenario is playable out of the box', () => {
    const s = blankScenario(12, 10, 'night', 'stone');
    expect(s.map.width).toBe(12);
    expect(s.map.depth).toBe(10);
    expect(s.map.theme).toBe('night');
    expect(s.map.tiles.every((t) => t.terrain === 'stone')).toBe(true);
    expect(isPlayable(s)).toBe(true);
  });

  it('every campaign chapter can be remixed into a playable scenario', () => {
    for (const ch of Object.values(CAMPAIGN_CHAPTERS)) {
      const s = scenarioFromChapter(ch);
      expect(validateScenario(s).filter((i) => i.level === 'error'), ch.id).toEqual([]);
      expect(s.enemies.length).toBe(ch.enemyRoster.length);
    }
  });

  it('copying a built-in map keeps its terrain but not its id', () => {
    const s = scenarioFromMap('night_fortress');
    expect(s.map.id).toBe('custom');
    expect(s.map.look).toBe('night_fortress');
    expect(s.map.tiles).toEqual(MAPS.night_fortress().tiles);
  });

  it('becomes a chapter with its own battlefield and objective', () => {
    const s = blankScenario();
    s.objective = { type: 'survive', rounds: 4 };
    const ch = scenarioToChapter(s);
    expect(ch.id.startsWith('custom:')).toBe(true);
    expect(ch.mapData?.width).toBe(16);
    expect(ch.objective).toEqual({ type: 'survive', rounds: 4 });
    // The chapter is a copy: editing it doesn't touch the scenario
    ch.mapData!.tiles[0].height = 5;
    expect(s.map.tiles[0].height).toBe(1);
    expect(() => new BattleGrid(ch.mapData!)).not.toThrow();
  });

  it('validation catches missing spawns, blocked tiles and a missing boss', () => {
    const s = blankScenario();
    s.map.playerSpawns = [];
    s.enemies[0].isBoss = undefined;
    s.objective = { type: 'boss' };
    s.map.tiles[s.enemies[0].z * s.map.width + s.enemies[0].x].walkable = false;
    const text = validateScenario(s).filter((i) => i.level === 'error').map((i) => i.text).join(' | ');
    expect(text).toMatch(/deploy tile/);
    expect(text).toMatch(/blocked tile/);
    expect(text).toMatch(/boss/);
  });

  it('warns when melee units cannot walk to an enemy', () => {
    const s = blankScenario();
    // Wall off the north with a cliff taller than anyone can jump
    for (let x = 0; x < s.map.width; x++) s.map.tiles[3 * s.map.width + x].height = 6;
    expect(validateScenario(s).some((i) => i.level === 'warning' && /can't walk/.test(i.text))).toBe(true);
  });

  it('sanitises hostile input: clamps sizes and numbers, drops unknown ids, keeps text plain', () => {
    const evil = {
      title: '<img src=x onerror=alert(1)>'.repeat(10),
      map: {
        width: 9999, depth: -5, look: 'nope',
        tiles: [{ x: 0, z: 0, height: 1e9, terrain: 'lava', walkable: false }, { x: 'a', z: 1 }, null, 42],
        playerSpawns: [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 999, z: 1 }, { x: 1.5, z: 2 }]
      },
      enemies: [
        { name: 'Ok', jobId: 'knight', level: 500, x: 2, z: 2, isBoss: 'yes', facing: 'Q' },
        { name: 'Bad job', jobId: '__proto__', level: 1, x: 3, z: 3 },
        { name: 'Dupe', jobId: 'archer', level: 1, x: 2, z: 2 },
        ...Array.from({ length: 40 }, (_, i) => ({ name: `E${i}`, jobId: 'ninja', level: 1, x: i % 8, z: 4 + Math.floor(i / 8) }))
      ],
      intro: [{ speaker: 'X'.repeat(200), text: 'hi\u0000there', side: 'up', portrait: 'javascript:alert(1)' }],
      objective: { type: 'survive', rounds: 9999 },
      rewardItemIds: ['excalibur_does_not_exist', 'gaia_staff', 'gaia_staff']
    };
    const s = sanitizeScenario(evil);
    expect(s.map.width).toBe(MAX_SIZE);
    expect(s.map.depth).toBe(8);
    expect(s.map.tiles.length).toBe(MAX_SIZE * 8);
    expect(s.map.look).toBe('day');
    expect(s.map.tiles[0]).toEqual({ x: 0, z: 0, height: MAX_HEIGHT, terrain: 'grass', walkable: false });
    expect(s.map.playerSpawns).toEqual([{ x: 0, z: 0 }]);
    expect(s.title.length).toBeLessThanOrEqual(48);
    expect(s.enemies.length).toBe(MAX_ENEMIES);
    expect(s.enemies[0]).toMatchObject({ jobId: 'knight', level: 20, facing: 'S' });
    expect(s.enemies[0].isBoss).toBeUndefined(); // only literal true counts
    expect(s.enemies.some((e) => e.name === 'Bad job' || e.name === 'Dupe')).toBe(false);
    expect(s.intro[0].speaker.length).toBe(32);
    expect(s.intro[0].text).toBe('hithere');
    expect(s.intro[0].side).toBe('left');
    expect(s.intro[0].portrait).toBeUndefined();
    expect(s.objective).toEqual({ type: 'survive', rounds: 30 });
    expect(s.rewardItemIds).toEqual(['gaia_staff']);
  });

  it('accepts a bare map exported by the old editor', () => {
    const s = parseScenario(JSON.stringify(MAPS.river_ruins()));
    expect(s.map.width).toBe(16);
    expect(s.map.tiles).toEqual(MAPS.river_ruins().tiles);
  });

  it('rejects things that are not scenarios with a readable message', () => {
    expect(() => parseScenario('not json')).toThrow(/valid JSON/);
    expect(() => parseScenario('[1,2,3]')).toThrow(/Not a scenario/);
    expect(() => parseScenario('{"title":"x"}')).toThrow(/battlefield/);
  });

  it('share links round-trip and stay short', async () => {
    const s = scenarioFromChapter(CAMPAIGN_CHAPTERS.chapter_3);
    const code = await encodeShare(s);
    expect(code).toMatch(/^[zj][\w-]+$/);
    expect(code.length).toBeLessThan(4000);
    const back = await decodeShare(code);
    expect(back.map.tiles).toEqual(s.map.tiles);
    expect(back.enemies).toEqual(sanitizeScenario(s).enemies);
    expect(back.intro).toEqual(s.intro);
    expect(back.title).toBe(s.title);
  });

  it('damaged share links fail cleanly', async () => {
    await expect(decodeShare('zAAAA')).rejects.toThrow(/damaged/);
    await expect(decodeShare('q123')).rejects.toThrow(/damaged/);
  });
});
