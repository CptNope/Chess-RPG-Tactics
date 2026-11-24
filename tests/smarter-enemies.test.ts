/**
 * 0.31.0: smarter enemies. A threat map lets the planner think a turn ahead, and some enemies
 * carry items they use like the player does.
 */
import { describe, it, expect } from 'vitest';
import { JOBS } from '../src/data/jobs';
import { MapData } from '../src/data/maps';
import { MAX_STACK } from '../src/data/consumables';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { planTurn, threatMap } from '../src/core/EnemyAI';
import { enemyCaution, enemyPouch, pouchText, salvage } from '../src/core/EnemyPouch';
import { CONSUMABLES } from '../src/data/consumables';
import { Unit } from '../src/core/types';

function unit(job: string, team: 'player' | 'enemy' = 'player', x = 0, z = 0, level = 5): Unit {
  const u = JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
  for (const a of JOBS[job].abilities) u.unlockedAbilities[a.id] = true;
  return u;
}
function map(size: number): BattleGrid {
  const tiles = [];
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) tiles.push({ x, z, height: 1, terrain: 'grass', walkable: true });
  return new BattleGrid({ id: 't', name: 'T', width: size, depth: size, tiles } as unknown as MapData);
}

describe('the threat map', () => {
  it('marks where a foe can reach next turn, and leaves the rest safe', () => {
    const grid = map(12);
    const me = unit('archer', 'enemy', 11, 11);
    const knight = unit('knight', 'player', 2, 2);
    const threat = threatMap(me, [me, knight], grid);
    expect(threat(2, 3)).toBeGreaterThan(0);
    expect(threat(11, 11)).toBe(0);
    expect(threat(2, 3, new Set([knight.id]))).toBe(0); // a foe about to fall threatens nothing
  });

  it('ignores sleeping foes and adds up the rest', () => {
    const grid = map(10);
    const me = unit('archer', 'enemy', 5, 5);
    const a = unit('knight', 'player', 4, 4), b = unit('knight', 'player', 6, 6);
    const both = threatMap(me, [me, a, b], grid)(5, 5);
    const one = threatMap(me, [me, a], grid)(5, 5);
    expect(both).toBeGreaterThan(one);
    b.statuses.push({ type: 'sleep', duration: 2 });
    expect(threatMap(me, [me, a, b], grid)(5, 5)).toBeCloseTo(one);
  });
});

describe('thinking a turn ahead', () => {
  it('a hurt archer shoots from out of reach instead of walking into the knights', () => {
    const grid = map(14);
    const archer = unit('archer', 'enemy', 6, 2);
    archer.currentHp = Math.round(archer.maxHp * 0.3);
    const knights = [unit('knight', 'player', 5, 10), unit('knight', 'player', 6, 10), unit('knight', 'player', 7, 10)];
    const units = [archer, ...knights];
    const threat = threatMap(archer, units, grid);
    const careful = planTurn(archer, units, grid, { caution: 'full' });
    expect(threat(careful.moveTo.x, careful.moveTo.z)).toBeLessThan(archer.currentHp);
    // 'light' caution does the same once the unit is below half HP
    const light = planTurn(archer, units, grid, { caution: 'light' });
    expect(threat(light.moveTo.x, light.moveTo.z)).toBeLessThan(archer.currentHp);
  });

  it('light caution leaves a healthy unit as bold as before', () => {
    const grid = map(10);
    const squire = unit('squire', 'enemy', 4, 2);
    const foes = [unit('knight', 'player', 4, 6), unit('monk', 'player', 5, 6)];
    const bold = planTurn(squire, [squire, ...foes], grid);
    const light = planTurn(squire, [squire, ...foes], grid, { caution: 'light' });
    expect(light.moveTo).toEqual(bold.moveTo);
    expect(light.ability?.id).toBe(bold.ability?.id);
  });
});

describe('enemy items', () => {
  it('a hurt enemy with nothing to hit drinks a Potion; a healthy one keeps it', () => {
    const grid = map(16);
    const bandit = unit('squire', 'enemy', 1, 1);
    const far = unit('knight', 'player', 14, 14);
    bandit.currentHp = Math.round(bandit.maxHp * 0.3);
    const plan = planTurn(bandit, [bandit, far], grid, { pouch: { potion: 1 } });
    expect(plan.ability?.item).toBe('potion');
    expect(planTurn(bandit, [bandit, far], grid).ability?.item).toBeUndefined();
    bandit.currentHp = bandit.maxHp;
    expect(planTurn(bandit, [bandit, far], grid, { pouch: { potion: 1 } }).ability?.item).toBeUndefined();
    expect(planTurn(bandit, [bandit, far], grid, { pouch: { potion: 0 } }).ability?.item).toBeUndefined();
  });

  it('a Phoenix Feather raises a fallen ally, unless the side is out of raises', () => {
    const grid = map(16);
    const chemist = unit('chemist', 'enemy', 3, 3);
    chemist.unlockedAbilities = {};
    const fallen = unit('knight', 'enemy', 3, 4);
    fallen.isDead = true; fallen.currentHp = 0;
    const far = unit('knight', 'player', 15, 15);
    const units = [chemist, fallen, far];
    expect(planTurn(chemist, units, grid, { pouch: { phoenix_feather: 1 } }).ability?.item).toBe('phoenix_feather');
    expect(planTurn(chemist, units, grid, { pouch: { phoenix_feather: 1 }, noRevive: true }).ability?.item).toBeUndefined();
  });

  it('who carries what, by difficulty', () => {
    const grunt = unit('squire', 'enemy', 0, 0, 5), chem = unit('chemist', 'enemy', 0, 0, 7), wolf = unit('wolf', 'enemy', 0, 0, 5);
    const boss = unit('knight', 'enemy', 0, 0, 10); JobSystem.makeBoss(boss);
    expect(enemyPouch(grunt, 0, 'easy')).toEqual({});
    expect(enemyPouch(boss, 1, 'easy')).toEqual({});
    expect(enemyPouch(wolf, 0, 'hard')).toEqual({});
    expect(enemyPouch(grunt, 0, 'normal')).toEqual({ potion: 1 });
    expect(enemyPouch(grunt, 1, 'normal')).toEqual({});
    expect(enemyPouch(grunt, 1, 'hard')).toEqual({ potion: 1 });
    expect(enemyPouch(chem, 1, 'normal')).toEqual({ potion: 2, remedy: 1 });
    expect(enemyPouch(chem, 1, 'hard')).toEqual({ potion: 2, remedy: 1, phoenix_feather: 1, blast_flask: 1 });
    expect(enemyPouch(boss, 1, 'normal')).toEqual({ hi_potion: 1 });
    expect(enemyCaution('easy')).toBe(false);
    expect(enemyCaution('normal')).toBe('light');
    expect(enemyCaution('hard')).toBe('full');
    expect(pouchText({ potion: 2, remedy: 1, ether: 0 }, CONSUMABLES)).toBe('Potion ×2, Remedy');
  });

  it('the squad salvages what fallen enemies never used, up to the stack limit', () => {
    const a = unit('squire', 'enemy'), b = unit('chemist', 'enemy'), alive = unit('squire', 'enemy');
    a.isDead = b.isDead = true;
    a.pouch = { potion: 1 }; b.pouch = { potion: 2, remedy: 1 }; alive.pouch = { potion: 3 };
    const inv: Record<string, number> = { potion: MAX_STACK - 1 };
    const got = salvage([a, b, alive], inv);
    expect(got).toEqual({ potion: 1, remedy: 1 });
    expect(inv).toEqual({ potion: MAX_STACK, remedy: 1 });
  });
});
