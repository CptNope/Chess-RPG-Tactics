// Hazards and zones (0.48.0): ground that works on whoever starts a turn on it, and the hold objective.
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { Battle, battleOutcome, runBattle } from '../src/core/Battle';
import { CombatEngine } from '../src/core/CombatEngine';
import { TurnManager } from '../src/core/TurnManager';
import { planTurn } from '../src/core/EnemyAI';
import { CAMPAIGN_RULES } from '../src/core/Rules';
import { applyHazard, hazardFor, zoneHolder, zoneKeys, HOLD_ROUNDS } from '../src/core/Hazards';
import { blankScenario, packForShare, sanitizeScenario, unpackShare, validateScenario } from '../src/core/Scenario';
import { SKIRMISHES, buildSkirmish } from '../src/core/Skirmish';
import { WORLD_NODES, WORLD_ROADS } from '../src/core/World';
import { MAPS } from '../src/data/maps';
import { ITEMS } from '../src/data/items';
import type { MapData } from '../src/data/maps';
import type { TileData } from '../src/core/types';

const field = (paint: (t: TileData) => void = () => {}): MapData => {
  const tiles: TileData[] = [];
  for (let z = 0; z < 10; z++) for (let x = 0; x < 10; x++) { const t: TileData = { x, z, height: 1, terrain: 'grass', walkable: true }; paint(t); tiles.push(t); }
  return { id: 'test', name: 'Test', theme: 'day', width: 10, depth: 10, tiles };
};
const status = (u: Parameters<typeof CombatEngine.applyStatus>[0], s: Parameters<typeof CombatEngine.applyStatus>[1]) => CombatEngine.applyStatus(u, s);

describe('hazards (0.48.0)', () => {
  it('embers burn 10%, miasma Poisons, a spring heals 12% and washes Poison off', () => {
    const u = JobSystem.createUnit('a', 'A', 'player', 'knight', 0, 0, 'N', 8);
    const tile = (hazard: TileData['hazard']): TileData => ({ x: 0, z: 0, height: 1, terrain: 'stone', walkable: true, hazard });
    const burn = applyHazard(u, tile('embers'), status)!;
    expect(burn.damage).toBe(Math.round(u.maxHp * 0.1));
    expect(u.currentHp).toBe(u.maxHp - burn.damage!);
    expect(applyHazard(u, tile('miasma'), status)).toEqual({ kind: 'miasma', status: 'poison' });
    expect(u.statuses.some((s) => s.type === 'poison')).toBe(true);
    const spring = applyHazard(u, tile('spring'), status)!;
    expect(spring).toMatchObject({ kind: 'spring', heal: Math.min(burn.damage!, Math.round(u.maxHp * 0.12)), cured: true });
    expect(u.statuses.some((s) => s.type === 'poison')).toBe(false);
    expect(hazardFor(u, tile('spring'))).toBeNull(); // full and clean: nothing to do
  });

  it('the Cinderwalk Charm keeps embers and miasma off; Poison-guarding gear keeps the miasma off', () => {
    const u = JobSystem.createUnit('a', 'A', 'player', 'knight', 0, 0, 'N', 8);
    u.equipment.accessory = ITEMS.cinderwalk_charm;
    for (const hazard of ['embers', 'miasma'] as const) expect(hazardFor(u, { x: 0, z: 0, height: 1, terrain: 'stone', walkable: true, hazard })).toBeNull();
    const v = JobSystem.createUnit('b', 'B', 'player', 'knight', 0, 0, 'N', 8);
    v.equipment.body = ITEMS.wolfpelt_mantle; // guards against Poison
    expect(applyHazard(v, { x: 0, z: 0, height: 1, terrain: 'swamp', walkable: true, hazard: 'miasma' }, status)).toBeNull();
  });

  it('works at the start of a turn, for either side, through the turn manager', () => {
    const grid = new BattleGrid(field((t) => { if (t.x === 2 && t.z === 2) t.hazard = 'embers'; }));
    const foe = JobSystem.createUnit('e', 'E', 'enemy', 'monk', 2, 2, 'S', 5);
    const tick = TurnManager.startOfTurn(foe, [foe], grid);
    expect(tick.hazard).toMatchObject({ kind: 'embers' });
    expect(foe.currentHp).toBeLessThan(foe.maxHp);
  });
});

describe('the hold objective (0.48.0)', () => {
  const zoned = () => new BattleGrid(field((t) => { if (t.x >= 4 && t.x <= 5 && t.z >= 4 && t.z <= 5) t.zone = true; }));

  it('a zone is held only by a side standing on it alone', () => {
    const grid = zoned();
    const zone = zoneKeys(grid.mapData.tiles);
    const p = JobSystem.createUnit('p', 'P', 'player', 'knight', 4, 4, 'N', 5);
    const e = JobSystem.createUnit('e', 'E', 'enemy', 'knight', 0, 0, 'S', 5);
    expect(zoneHolder([p, e], zone)).toBe('player');
    e.x = 5; e.z = 5;
    expect(zoneHolder([p, e], zone)).toBeNull(); // contested
    p.x = 0;
    expect(zoneHolder([p, e], zone)).toBe('enemy');
    expect(battleOutcome([p, e], { type: 'hold' }, 5, 'player', HOLD_ROUNDS - 1)).toBeNull();
    expect(battleOutcome([p, e], { type: 'hold' }, 5, 'player', HOLD_ROUNDS)).toEqual({ winner: 'player', reason: 'hold' });
  });

  it('the battle engine counts rounds ended on the zone and wins on the last one', () => {
    const grid = zoned();
    const p = JobSystem.createUnit('p', 'P', 'player', 'knight', 4, 4, 'N', 5);
    const e = JobSystem.createUnit('e', 'E', 'enemy', 'knight', 0, 9, 'S', 5);
    e.statuses.push({ type: 'immobilize', duration: 99 });
    const b = new Battle({ units: [p, e], grid, seed: 1, rules: CAMPAIGN_RULES, objective: { type: 'hold', rounds: 2 } });
    const { outcome } = runBattle(b, (_b, u) => ({ moveTo: { x: u.x, z: u.z }, ability: null, target: null, facing: u.facing }));
    expect(outcome).toEqual({ winner: 'player', reason: 'hold' });
    expect(b.events.filter((ev) => ev.t === 'hold').map((ev) => ev.t === 'hold' && ev.held)).toEqual([1, 2]);
  });

  it('the AI steps off embers when it can, and heads for a hold objective\'s ground', () => {
    const grid = new BattleGrid(field((t) => { if (t.x === 3 && t.z === 3) t.hazard = 'embers'; }));
    const u = JobSystem.createUnit('e', 'E', 'enemy', 'knight', 3, 3, 'S', 5);
    const far = JobSystem.createUnit('p', 'P', 'player', 'knight', 9, 9, 'N', 5);
    const plan = planTurn(u, [u, far], grid);
    expect(grid.getTile(plan.moveTo.x, plan.moveTo.z)?.hazard).toBeUndefined();

    const g2 = zoned();
    const w = JobSystem.createUnit('w', 'W', 'player', 'knight', 4, 9, 'N', 5);
    const foe = JobSystem.createUnit('f', 'F', 'enemy', 'knight', 9, 0, 'S', 5);
    const plain = planTurn(w, [w, foe], g2);
    const holding = planTurn(w, [w, foe], g2, { zone: zoneKeys(g2.mapData.tiles) });
    const toZone = (m: { x: number; z: number }) => Math.min(...[...zoneKeys(g2.mapData.tiles)].map((k) => { const [x, z] = k.split(',').map(Number); return Math.abs(x - m.x) + Math.abs(z - m.z); }));
    expect(toZone(holding.moveTo)).toBeLessThan(toZone(plain.moveTo) + 0.5);
    expect(toZone(holding.moveTo)).toBeLessThanOrEqual(1);
  });
});

describe('Workshop scenarios and the Cinder Spring (0.48.0)', () => {
  it('hazards, the zone and the Hold objective survive a share link; old links still load', () => {
    const s = blankScenario(8, 8);
    s.map.tiles[9].hazard = 'embers';
    s.map.tiles[10].hazard = 'spring';
    s.map.tiles[10].zone = true;
    s.map.tiles[11].hazard = 'miasma';
    s.objective = { type: 'hold', rounds: 4 };
    const back = sanitizeScenario(unpackShare(JSON.parse(JSON.stringify(packForShare(s)))));
    expect(back.map.tiles.slice(9, 12).map((t) => [t.hazard, !!t.zone])).toEqual([['embers', false], ['spring', true], ['miasma', false]]);
    expect(back.objective).toEqual({ type: 'hold', rounds: 4 });
    const old = unpackShare({ map: { width: 2, depth: 1, rows: ['10g,15s!'] } }) as { map: { tiles: TileData[] } };
    expect(old.map.tiles).toEqual([{ x: 0, z: 0, height: 1, terrain: 'grass', walkable: true }, { x: 1, z: 0, height: 1.5, terrain: 'stone', walkable: false }]);
    expect(sanitizeScenario({ ...JSON.parse(JSON.stringify(s)), objective: { type: 'hold', rounds: 99 } }).objective).toEqual({ type: 'hold', rounds: 10 });
    s.map.tiles[10].zone = false;
    expect(validateScenario(s).some((i) => i.level === 'error' && /hold zone/.test(i.text))).toBe(true);
  });

  it('the Cinder Spring: a caldera with a spring to hold, after Chapter IV, on the world map', () => {
    const def = SKIRMISHES.cinder;
    expect(def.objective).toEqual({ type: 'hold', rounds: 3 });
    expect(def.opensAfter).toEqual(['chapter_4']);
    const map = MAPS[def.mapId]();
    expect(map.tiles.filter((t) => t.zone)).toHaveLength(16);
    expect(map.tiles.filter((t) => t.hazard === 'spring').every((t) => t.zone)).toBe(true);
    expect(map.tiles.some((t) => t.hazard === 'embers') && map.tiles.some((t) => t.hazard === 'miasma')).toBe(true);
    const ch = buildSkirmish('cinder', [7, 7, 7, 7], 0);
    expect(ch.enemyRoster).toHaveLength(4); // 5 in 0.48, 4 since 0.51
    expect(ch.enemyRoster[0].jobId).toBe('shaman');
    expect(ch.enemyRoster.every((e) => !map.tiles.find((t) => t.x === e.x && t.z === e.z)!.hazard)).toBe(true);
    expect(WORLD_NODES.some((n) => n.skirmishId === 'cinder')).toBe(true);
    expect(WORLD_ROADS).toContainEqual(['ridge', 'cinder']);
  });
});
