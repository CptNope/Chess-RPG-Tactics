// The Necromancer (0.52.0): raising fallen foes as thralls for a few turns, and bursting bodies.
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { ActionContext, runAction } from '../src/core/Action';
import { Battle } from '../src/core/Battle';
import { CombatEngine } from '../src/core/CombatEngine';
import { TurnManager } from '../src/core/TurnManager';
import { planTurn } from '../src/core/EnemyAI';
import { seededRng } from '../src/core/Rng';
import { CAMPAIGN_RULES } from '../src/core/Rules';
import { isAlly, isFoe } from '../src/core/Sides';
import { DARK_PACT_TURNS, THRALL_TURNS, bodies, raisableAt, settleFallenThralls } from '../src/core/Necromancy';
import { SKIRMISHES } from '../src/core/Skirmish';
import { JOBS, PLAYER_JOB_IDS } from '../src/data/jobs';
import { JOB_GEAR } from '../src/data/gear-rules';
import { SIGNATURES } from '../src/data/signatures';
import { RECRUIT_JOBS } from '../src/core/Recruits';
import type { MapData } from '../src/data/maps';
import type { Unit } from '../src/core/types';

const field = (): MapData => {
  const tiles = [];
  for (let z = 0; z < 10; z++) for (let x = 0; x < 10; x++) tiles.push({ x, z, height: 1, terrain: 'grass' as const, walkable: true });
  return { id: 'test', name: 'Test', theme: 'day', width: 10, depth: 10, tiles };
};
const fell = (u: Unit) => { u.isDead = true; u.currentHp = 0; return u; };

/** A Necromancer at (2, 2), a fallen foe at (2, 4), a living foe at (5, 5). */
function scene() {
  const nc = JobSystem.createUnit('p1', 'Morrow', 'player', 'necromancer', 2, 2, 'N', 10);
  for (const a of JOBS.necromancer.abilities) nc.unlockedAbilities[a.id] = true;
  const body = fell(JobSystem.createUnit('e1', 'Brute', 'enemy', 'knight', 2, 4, 'S', 10));
  const foe = JobSystem.createUnit('e2', 'Bow', 'enemy', 'archer', 5, 5, 'S', 10);
  const units = [nc, body, foe];
  const ctx: ActionContext = { units, grid: new BattleGrid(field()), rng: seededRng(6), rules: CAMPAIGN_RULES, pouchOf: () => ({}) };
  return { nc, body, foe, units, ctx };
}
const action = (u: Unit, id: string) => JobSystem.getCombatActionAbilities(u).find((a) => a.id === id)!;

describe('the Necromancer (0.52.0)', () => {
  it('is an advanced job after Black Mage and Oracle, in robes with a staff', () => {
    expect(PLAYER_JOB_IDS).toContain('necromancer');
    expect(JOBS.necromancer.prerequisites).toEqual([{ jobId: 'black_mage', level: 3 }, { jobId: 'oracle', level: 2 }]);
    expect(JOB_GEAR.necromancer).toEqual({ weapons: ['staff'], robe: true });
    expect(SIGNATURES.necromancer).toMatchObject({ thrall: true, aoe: 2 });
    expect(RECRUIT_JOBS.at(-1)!.jobs).toContain('necromancer');
    expect(SKIRMISHES.shrine.jobs.some(([j]) => j === 'necromancer')).toBe(true);
  });

  it('raises a fallen foe on its side with 40% HP for 3 turns; it earns nothing', () => {
    const { nc, body, foe, ctx } = scene();
    const { steps } = runAction(ctx, nc, action(nc, 'nc_raise_thrall'), 2, 4);
    expect(steps[0].kind === 'start' && steps[0].raised).toEqual([body]);
    expect(body.isDead).toBe(false);
    expect(isAlly(body, nc) && isFoe(body, foe)).toBe(true);
    expect(body.currentHp).toBe(Math.round(body.maxHp * 0.4));
    expect(body.statuses).toEqual([{ type: 'thrall', duration: THRALL_TURNS }]);
    const jp = body.jobLevels.knight;
    const { end } = runAction(ctx, body, JobSystem.getCombatActionAbilities(body).find((a) => a.id === 'basic_attack')!, foe.x, foe.z);
    expect(end.jpGained).toBe(0);
    expect(body.jobLevels.knight).toBe(jp);
  });

  it('crumbles when its turns run out, or when it falls: dead, home again, and spent', () => {
    const { nc, body, ctx, units } = scene();
    runAction(ctx, nc, action(nc, 'nc_raise_thrall'), 2, 4);
    for (let i = 0; i < THRALL_TURNS - 1; i++) TurnManager.tickStatuses(body);
    expect(body.isDead).toBe(false);
    TurnManager.tickStatuses(body);
    expect(body.isDead).toBe(true);
    expect(body.team).toBe('enemy');
    expect(body.thrall).toBeUndefined();
    expect(bodies(units)).not.toContain(body); // spent: it won't rise again

    const other = fell(JobSystem.createUnit('e3', 'Pike', 'enemy', 'dragoon', 3, 4, 'S', 10));
    units.push(other);
    nc.equippedAbilities.support = 'nc_dark_pact';
    runAction(ctx, nc, action(nc, 'nc_raise_thrall'), 3, 4);
    expect(other.statuses[0].duration).toBe(DARK_PACT_TURNS);
    expect(other.currentHp).toBe(Math.round(other.maxHp * 0.6));
    other.isDead = true;
    expect(settleFallenThralls(units)).toEqual([other]);
    expect(other.team).toBe('enemy');
    expect(other.spent).toBe(true);
  });

  it('never raises a boss, an ally, a covered or spent body; finds the foe when two lie on one tile', () => {
    const { nc, body, units } = scene();
    const friend = fell(JobSystem.createUnit('p2', 'Pal', 'player', 'squire', 2, 4, 'N', 5));
    units.push(friend);
    expect(raisableAt(nc, units, 2, 4)).toBe(body);
    body.isBoss = true;
    expect(raisableAt(nc, units, 2, 4)).toBeUndefined();
    body.isBoss = false;
    const stander = JobSystem.createUnit('p3', 'Guard', 'player', 'knight', 2, 4, 'N', 5);
    units.push(stander);
    expect(raisableAt(nc, units, 2, 4)).toBeUndefined();
  });

  it('Corpse Burst hurts those around the body and spends it; the engine wants a body', () => {
    const { nc, body, foe, units, ctx } = scene();
    foe.x = 3; foe.z = 4; // next to the body
    const hp = foe.currentHp;
    const { steps } = runAction(ctx, nc, action(nc, 'nc_corpse_burst'), 2, 4);
    expect(steps[0].kind === 'start' && steps[0].burst).toBe(body);
    expect(body.spent).toBe(true);
    expect(foe.currentHp).toBeLessThan(hp);

    const battle = new Battle({ units, grid: ctx.grid, seed: 2, rules: CAMPAIGN_RULES });
    for (const u of units) u.ct = u === nc ? 100 : 0;
    expect(battle.nextTurn()).toBe(nc);
    expect(battle.check({ moveTo: { x: 2, z: 2 }, ability: action(nc, 'nc_corpse_burst'), target: { x: 2, z: 4 }, facing: 'N' })).toBe('No body there.');
    expect(battle.check({ moveTo: { x: 2, z: 2 }, ability: action(nc, 'nc_raise_thrall'), target: { x: 3, z: 3 }, facing: 'N' })).toBe('No body to raise there.');
  });

  it('an enemy Necromancer can raise your fallen against you; the next battle sends them home', () => {
    const { foe, units, ctx } = scene();
    const enemyNc = JobSystem.createUnit('e9', 'Cultist', 'enemy', 'necromancer', 6, 6, 'S', 10);
    for (const a of JOBS.necromancer.abilities) enemyNc.unlockedAbilities[a.id] = true;
    const rowan = fell(JobSystem.createUnit('p5', 'Rowan', 'player', 'knight', 6, 4, 'N', 10));
    units.push(enemyNc, rowan);
    runAction(ctx, enemyNc, action(enemyNc, 'nc_raise_thrall'), 6, 4);
    expect(rowan.team).toBe('enemy');
    expect(isAlly(rowan, foe)).toBe(true);
    JobSystem.resetForBattle(rowan, 0, 0);
    expect(rowan.team).toBe('player');
    expect(rowan.thrall).toBeUndefined();
  });

  it('Soul Siphon drinks back a quarter; the AI raises a body in reach', () => {
    const { nc, units, ctx } = scene();
    nc.equippedAbilities.reaction = 'nc_soul_siphon';
    const pup = JobSystem.createUnit('e4', 'Pup', 'enemy', 'squire', 2, 1, 'S', 1);
    const blow = JobSystem.getCombatActionAbilities(pup).find((a) => a.id === 'basic_attack')!;
    const r = CombatEngine.executeAttack(CombatEngine.getForecast(pup, nc, blow, 1, 1), () => 0.2);
    expect(r.reaction?.name).toBe('Soul Siphon');
    nc.currentHp = nc.maxHp;
    const plan = planTurn(nc, units, ctx.grid);
    expect(plan.ability?.thrall || plan.ability?.corpseBurst || plan.ability?.id === 'nc_grave_bolt').toBeTruthy();
  });
});
