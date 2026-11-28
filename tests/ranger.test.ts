// The Ranger (0.49.0): traps hidden on the field, sprung by the first foe to walk into them.
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { ActionContext, runAction, walkInto } from '../src/core/Action';
import { Battle } from '../src/core/Battle';
import { planTurn } from '../src/core/EnemyAI';
import { seededRng } from '../src/core/Rng';
import { CAMPAIGN_RULES } from '../src/core/Rules';
import { MAX_TRAPS, TRAPSMITH_MAX, setTraps, trapOnPath } from '../src/core/Traps';
import { SKIRMISHES, buildSkirmish } from '../src/core/Skirmish';
import { JOBS, PLAYER_JOB_IDS } from '../src/data/jobs';
import { JOB_GEAR } from '../src/data/gear-rules';
import { SIGNATURES } from '../src/data/signatures';
import { RECRUIT_JOBS, RECRUIT_PITCH } from '../src/core/Recruits';
import type { MapData } from '../src/data/maps';
import type { Unit } from '../src/core/types';

const field = (): MapData => {
  const tiles = [];
  for (let z = 0; z < 10; z++) for (let x = 0; x < 10; x++) tiles.push({ x, z, height: 1, terrain: 'grass' as const, walkable: true });
  return { id: 'test', name: 'Test', theme: 'day', width: 10, depth: 10, tiles };
};

/** A Ranger who knows everything at (2, 2); a foe up north at (2, 8). */
function scene() {
  const rg = JobSystem.createUnit('p1', 'Hawk', 'player', 'ranger', 2, 2, 'N', 10);
  for (const a of JOBS.ranger.abilities) rg.unlockedAbilities[a.id] = true;
  const foe = JobSystem.createUnit('e1', 'Brute', 'enemy', 'knight', 2, 8, 'S', 10);
  const units = [rg, foe];
  const ctx: ActionContext = { units, grid: new BattleGrid(field()), rng: seededRng(4), rules: CAMPAIGN_RULES, pouchOf: () => ({}) };
  return { rg, foe, units, ctx };
}
const action = (u: Unit, id: string) => JobSystem.getCombatActionAbilities(u).find((a) => a.id === id)!;

describe('the Ranger (0.49.0)', () => {
  it('is an advanced job after Archer and Thief, with bow or dagger', () => {
    expect(PLAYER_JOB_IDS).toContain('ranger');
    expect(JOBS.ranger.prerequisites).toEqual([{ jobId: 'archer', level: 3 }, { jobId: 'thief', level: 2 }]);
    expect(JOB_GEAR.ranger).toEqual({ weapons: ['bow', 'dagger'] });
    expect(JOBS.ranger.abilities.filter((a) => a.trap).map((a) => a.trap)).toEqual(['snare', 'spikes', 'smoke', 'slumber']);
    expect(JOBS.ranger.abilities[0].id).toBe('rg_snare'); // what a young enemy Ranger knows
    expect(SIGNATURES.ranger).toMatchObject({ trap: 'spikes', aoe: 1 });
    expect(RECRUIT_JOBS.at(-1)!.jobs).toContain('ranger');
    expect(RECRUIT_PITCH.ranger).toBeTruthy();
  });

  it('hides a trap on free ground, hits nobody, and keeps three (Trapsmith: five)', () => {
    const { rg, ctx } = scene();
    const { steps } = runAction(ctx, rg, action(rg, 'rg_snare'), 2, 5);
    expect(steps[0].kind === 'start' && steps[0].trapsSet).toEqual([{ kind: 'snare', x: 2, z: 5 }]);
    expect(steps.some((s) => s.kind === 'hit')).toBe(false);
    for (const x of [3, 4, 5]) runAction(ctx, rg, action(rg, 'rg_snare'), x, 5);
    expect(rg.traps!.map((t) => t.x)).toEqual([3, 4, 5]);
    expect(rg.traps).toHaveLength(MAX_TRAPS);
    rg.equippedAbilities.support = 'rg_trapsmith';
    for (const x of [6, 7, 8]) runAction(ctx, rg, action(rg, 'rg_snare'), x, 5);
    expect(rg.traps).toHaveLength(TRAPSMITH_MAX);
  });

  it('a foe walking through stops on the trap and is caught; an ally walks over it', () => {
    const { rg, foe, units, ctx } = scene();
    runAction(ctx, rg, action(rg, 'rg_snare'), 2, 6);
    const ally = JobSystem.createUnit('p2', 'Pal', 'player', 'squire', 1, 6, 'N', 5);
    units.push(ally);
    expect(trapOnPath(ally, [{ x: 1, z: 6 }, { x: 2, z: 6 }, { x: 3, z: 6 }], units)).toBeNull();
    const t = walkInto(ctx, foe, { x: 2, z: 5 })!; // a Knight moves 3: through (2, 7) and (2, 6)
    expect(t.stopAt).toEqual({ x: 2, z: 6 });
    expect({ x: foe.x, z: foe.z }).toEqual({ x: 2, z: 6 });
    expect(t.sprung).toMatchObject({ kind: 'snare', status: 'immobilize' });
    expect(foe.statuses.some((s) => s.type === 'immobilize')).toBe(true);
    expect(rg.traps).toHaveLength(0); // spent
    expect(walkInto(ctx, foe, { x: 2, z: 5 })).toBeNull(); // nothing left on the way
  });

  it('spikes hurt by the setter\'s attack; Ambush shoots the foe that springs one in reach', () => {
    const { rg, foe, ctx } = scene();
    rg.equippedAbilities.reaction = 'rg_ambush';
    runAction(ctx, rg, action(rg, 'rg_spike_trap'), 2, 6);
    const hp = foe.currentHp;
    const t = walkInto(ctx, foe, { x: 2, z: 5 })!;
    expect(t.sprung.damage).toBeGreaterThan(0);
    expect(t.ambush).toBeTruthy();
    expect(foe.currentHp).toBe(hp - t.sprung.damage! - (t.ambush!.hit ? t.ambush!.damageDealt : 0));
  });

  it('the battle engine springs a trap on the way and drops an action the foe can no longer make', () => {
    const { rg, foe, units, ctx } = scene();
    runAction(ctx, rg, action(rg, 'rg_slumber_trap'), 2, 6);
    const battle = new Battle({ units, grid: ctx.grid, seed: 2, rules: CAMPAIGN_RULES });
    for (const u of units) u.ct = u === foe ? 100 : 0;
    expect(battle.nextTurn()).toBe(foe);
    const strike = JobSystem.getCombatActionAbilities(foe).find((a) => a.id === 'basic_attack')!;
    rg.x = 2; rg.z = 4; // the foe means to walk up to (2, 5) and strike
    const ev = battle.apply({ moveTo: { x: 2, z: 5 }, ability: strike, target: { x: rg.x, z: rg.z }, facing: 'S' });
    expect(ev.find((e) => e.t === 'trap')).toMatchObject({ unit: 'e1', owner: 'p1', kind: 'slumber', status: 'sleep' });
    expect(ev.some((e) => e.t === 'act')).toBe(false); // asleep on the trap, far from its target
    expect({ x: foe.x, z: foe.z }).toEqual({ x: 2, z: 6 });
  });

  it('Battle.check wants free ground; the Killing Field spikes every free tile around', () => {
    const { rg, foe, units, ctx } = scene();
    const battle = new Battle({ units, grid: ctx.grid, seed: 3, rules: CAMPAIGN_RULES });
    for (const u of units) u.ct = u === rg ? 100 : 0;
    battle.nextTurn();
    foe.x = 2; foe.z = 4;
    expect(battle.check({ moveTo: { x: 2, z: 2 }, ability: action(rg, 'rg_snare'), target: { x: 2, z: 4 }, facing: 'N' })).toBe('No room for a trap there.');
    expect(battle.check({ moveTo: { x: 2, z: 2 }, ability: action(rg, 'rg_snare'), target: { x: 3, z: 4 }, facing: 'N' })).toBeNull();
    rg.usedSignatures = [];
    const sig = { ...SIGNATURES.ranger };
    runAction(ctx, rg, sig, 2, 5);
    expect(rg.traps!.map((t) => `${t.x},${t.z}`).sort()).toEqual(['1,5', '2,5', '2,6', '3,5']); // (2, 4) has the foe on it
    expect(setTraps(units)).toHaveLength(4);
  });

  it('the AI hides a trap where a foe will walk when nothing is in reach, never on a foe\'s', () => {
    const { rg, units, ctx } = scene();
    const enemyRanger = JobSystem.createUnit('e2', 'Trapper', 'enemy', 'ranger', 6, 9, 'S', 10);
    for (const a of JOBS.ranger.abilities) enemyRanger.unlockedAbilities[a.id] = true;
    units.push(enemyRanger);
    rg.x = 2; rg.z = 0;
    const plan = planTurn(enemyRanger, units, ctx.grid);
    expect(plan.ability?.trap).toBeTruthy();
    expect(units.some((u) => u.x === plan.targetTile!.x && u.z === plan.targetTile!.z)).toBe(false);
    expect(SKIRMISHES.thornwood.jobs[1][0]).toBe('ranger');
    expect(buildSkirmish('thornwood', [3, 3, 3, 3], 0).enemyRoster.some((e) => e.jobId === 'ranger')).toBe(true);
  });
});
