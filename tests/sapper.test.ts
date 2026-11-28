// The Sapper (0.54.0): barricades, earth raised and lowered, demolition.
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { ActionContext, runAction } from '../src/core/Action';
import { Battle } from '../src/core/Battle';
import { CombatEngine } from '../src/core/CombatEngine';
import { planTurn, scoreWorks } from '../src/core/EnemyAI';
import { CAMPAIGN_RULES } from '../src/core/Rules';
import { BARRICADE_HEIGHT, BARRICADE_ROUNDS, FIELDWORKS_ROUNDS, MAX_WORK_HEIGHT, tickWorks } from '../src/core/Earthworks';
import { SKIRMISHES } from '../src/core/Skirmish';
import { RECRUIT_JOBS } from '../src/core/Recruits';
import { JOBS, PLAYER_JOB_IDS } from '../src/data/jobs';
import { JOB_GEAR } from '../src/data/gear-rules';
import { SIGNATURES } from '../src/data/signatures';
import type { MapData } from '../src/data/maps';
import type { TileData, Unit } from '../src/core/types';

const field = (paint: (t: TileData) => void = () => {}): MapData => {
  const tiles: TileData[] = [];
  for (let z = 0; z < 10; z++) for (let x = 0; x < 10; x++) { const t: TileData = { x, z, height: 1, terrain: 'grass', walkable: true }; paint(t); tiles.push(t); }
  return { id: 'test', name: 'Test', theme: 'day', width: 10, depth: 10, tiles };
};
const action = (u: Unit, id: string) => JobSystem.getCombatActionAbilities(u).find((a) => a.id === id)!;

function scene(paint?: (t: TileData) => void) {
  const sp = JobSystem.createUnit('p1', 'Brann', 'player', 'sapper', 4, 6, 'N', 10);
  for (const a of JOBS.sapper.abilities) sp.unlockedAbilities[a.id] = true;
  const foe = JobSystem.createUnit('e1', 'Brute', 'enemy', 'knight', 4, 4, 'S', 10);
  const units = [sp, foe];
  const grid = new BattleGrid(field(paint));
  const ctx: ActionContext = { units, grid, rng: () => 0.1, rules: CAMPAIGN_RULES, pouchOf: () => ({}) }; // every blow lands
  return { sp, foe, units, grid, ctx };
}

describe('the Sapper (0.54.0)', () => {
  it('is an advanced job after Chemist and Geomancer, in heavy armor with a sword', () => {
    expect(PLAYER_JOB_IDS).toContain('sapper');
    expect(JOBS.sapper.prerequisites).toEqual([{ jobId: 'chemist', level: 3 }, { jobId: 'geomancer', level: 2 }]);
    expect(JOB_GEAR.sapper).toEqual({ weapons: ['sword', 'dagger'], heavy: true });
    expect(SIGNATURES.sapper).toMatchObject({ earthwork: 'raise', aoe: 1 });
    expect(RECRUIT_JOBS.at(-1)!.jobs).toContain('sapper');
    expect(SKIRMISHES.ridge.jobs.some(([j]) => j === 'sapper')).toBe(true);
  });

  it('a barricade blocks the way for 3 rounds, then the tile is as it was', () => {
    const { sp, grid, ctx } = scene((t) => { if (t.x === 4 && t.z === 5) t.hazard = 'embers'; });
    const before = { ...grid.getTile(4, 5)! };
    const { end } = runAction(ctx, sp, action(sp, 'sp_barricade'), 4, 5);
    expect(end.works).toEqual([{ x: 4, z: 5, kind: 'barricade', height: 1 + BARRICADE_HEIGHT }]);
    const t = grid.getTile(4, 5)!;
    expect(t.walkable).toBe(false);
    expect(grid.findPath(sp, ctx.units, 4, 3)?.some((s) => s.x === 4 && s.z === 5)).toBeFalsy();
    for (let r = 1; r < BARRICADE_ROUNDS; r++) expect(tickWorks(grid.mapData.tiles)).toEqual([]);
    expect(tickWorks(grid.mapData.tiles)).toEqual([{ x: 4, z: 5, kind: 'collapse', height: 1 }]);
    expect(grid.getTile(4, 5)).toEqual(before);
  });

  it('earth rises under whoever stands there (filling water), and sinks under a foe it hurts', () => {
    const { sp, foe, grid, ctx } = scene((t) => { if (t.x === 5 && t.z === 6) t.terrain = 'water'; });
    runAction(ctx, sp, action(sp, 'sp_earthwork'), 4, 6); // its own tile
    expect(grid.getHeight(4, 6)).toBe(2);
    runAction(ctx, sp, action(sp, 'sp_earthwork'), 5, 6);
    expect(grid.getTile(5, 6)).toMatchObject({ height: 2, terrain: 'dirt' });
    sp.x = 4; sp.z = 5; grid.getTile(4, 5)!.height = 2;
    const hp = foe.currentHp;
    const { steps, end } = runAction(ctx, sp, action(sp, 'sp_undermine'), 4, 4);
    expect(steps.some((s) => s.kind === 'hit' && s.result.hit)).toBe(true);
    expect(foe.currentHp).toBeLessThan(hp);
    expect(end.works).toEqual([{ x: 4, z: 4, kind: 'lower', height: 0.5 }]);
    // Up on a ledge: the Sapper on (3, 4), a foe on (2, 4), the tile ahead already as high as it goes
    for (const t of grid.mapData.tiles) if (t.x >= 2 && t.x <= 3 && t.z >= 3 && t.z <= 5) t.height = MAX_WORK_HEIGHT - 1;
    grid.getTile(3, 3)!.height = MAX_WORK_HEIGHT;
    sp.x = 3; sp.z = 4; foe.x = 2; foe.z = 4;
    const battle = new Battle({ units: ctx.units, grid, seed: 1, rules: CAMPAIGN_RULES });
    for (const u of ctx.units) u.ct = u === sp ? 100 : 0;
    expect(battle.nextTurn()).toBe(sp);
    expect(battle.check({ moveTo: { x: 3, z: 4 }, ability: action(sp, 'sp_earthwork'), target: { x: 3, z: 3 }, facing: 'N' })).toBe("The ground can't go higher there.");
    expect(battle.check({ moveTo: { x: 3, z: 4 }, ability: action(sp, 'sp_barricade'), target: { x: 2, z: 4 }, facing: 'N' })).toBe('No room for a barricade there.');
    expect(battle.check({ moveTo: { x: 3, z: 4 }, ability: action(sp, 'sp_barricade'), target: { x: 3, z: 4 }, facing: 'N' })).toBe('No room for a barricade there.');
    expect(battle.check({ moveTo: { x: 3, z: 5 }, ability: action(sp, 'sp_barricade'), target: { x: 3, z: 4 }, facing: 'N' })).toBeNull(); // stepping off frees it
    // Undermine on ground that can't sink any further still strikes (the mirror duels found it refused, 0.57.0)
    grid.getTile(2, 4)!.height = 0.5; grid.getTile(3, 4)!.height = 0.5;
    expect(battle.check({ moveTo: { x: 3, z: 4 }, ability: action(sp, 'sp_undermine'), target: { x: 2, z: 4 }, facing: 'W' })).toBeNull();
  });

  it('Fieldworks: barricades stand 5 rounds and earth moves 1.5; Blasting Charge brings walls down and burns', () => {
    const { sp, foe, grid, ctx } = scene();
    sp.equippedAbilities.support = 'sp_fieldworks';
    runAction(ctx, sp, action(sp, 'sp_barricade'), 5, 5);
    expect(grid.getTile(5, 5)!.works?.rounds).toBe(FIELDWORKS_ROUNDS);
    runAction(ctx, sp, action(sp, 'sp_earthwork'), 3, 6);
    expect(grid.getHeight(3, 6)).toBe(2.5);
    foe.x = 5; foe.z = 4;
    const hp = foe.currentHp;
    const { end } = runAction(ctx, sp, action(sp, 'sp_blasting_charge'), 5, 4);
    expect(end.works).toEqual([{ x: 5, z: 5, kind: 'collapse', height: 1 }]);
    expect(grid.getTile(5, 5)!.walkable).toBe(true);
    expect(end.ground?.some((g) => g.hazard === 'embers')).toBe(true);
    expect(foe.currentHp).toBeLessThan(hp);
  });

  it('Dig In: a physical blow gives Protect, a spell doesn\'t', () => {
    const { sp } = scene();
    sp.equippedAbilities.reaction = 'sp_dig_in';
    const brute = JobSystem.createUnit('e2', 'Brute', 'enemy', 'knight', 4, 5, 'S', 1);
    const r = CombatEngine.executeAttack(CombatEngine.getForecast(brute, sp, action(brute, 'basic_attack'), 1, 1), () => 0.2);
    expect(r.reaction?.name).toBe('Dig In');
    expect(sp.statuses.some((s) => s.type === 'protect')).toBe(true);
    const mage = JobSystem.createUnit('e3', 'Mage', 'enemy', 'black_mage', 4, 3, 'S', 5);
    for (const a of JOBS.black_mage.abilities) mage.unlockedAbilities[a.id] = true;
    sp.statuses = [];
    const fire = JobSystem.getCombatActionAbilities(mage).find((a) => a.element === 'fire' && a.power > 0)!;
    const r2 = CombatEngine.executeAttack(CombatEngine.getForecast(mage, sp, fire, 1, 1), () => 0.2);
    expect(r2.reaction?.name).not.toBe('Dig In');
  });

  it('the AI walls off a foe from a hurt ally in a corridor, and raises ground under an archer', () => {
    // A corridor two tiles wide, x 4-5; the ally at the top, the foe below
    const { sp, foe, units, grid } = scene((t) => { if (t.x < 4 || t.x > 5) t.walkable = false; });
    const mage = JobSystem.createUnit('p2', 'Mira', 'player', 'black_mage', 4, 1, 'S', 10);
    mage.currentHp = Math.round(mage.maxHp * 0.3);
    units.push(mage);
    sp.x = 5; sp.z = 1; foe.x = 4; foe.z = 5;
    expect(scoreWorks(sp, action(sp, 'sp_barricade'), 4, 2, units, grid, { x: 5, z: 1 })).toBeGreaterThan(8);
    const archer = JobSystem.createUnit('p3', 'Tobin', 'player', 'archer', 5, 0, 'S', 10);
    units.push(archer);
    expect(scoreWorks(sp, action(sp, 'sp_earthwork'), 5, 0, units, grid, { x: 5, z: 1 })).toBe(10); // the foe is in the archer's reach
    expect(scoreWorks(sp, action(sp, 'sp_earthwork'), 4, 5, units, grid, { x: 5, z: 1 })).toBe(0); // never under a foe
    const plan = planTurn(sp, units, grid);
    expect(plan.ability?.earthwork ?? plan.ability?.id).toBeTruthy();
  });
});
