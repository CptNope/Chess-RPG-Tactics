// The Shaman (0.47.0): totems that stand on the field and pulse at the start of turns.
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { ActionContext, runAction } from '../src/core/Action';
import { CombatEngine } from '../src/core/CombatEngine';
import { TurnManager } from '../src/core/TurnManager';
import { Battle } from '../src/core/Battle';
import { planTurn } from '../src/core/EnemyAI';
import { seededRng } from '../src/core/Rng';
import { CAMPAIGN_RULES } from '../src/core/Rules';
import { MAX_TOTEMS, TOTEM_TURNS, DEEP_ROOTS_TURNS, standingTotems } from '../src/core/Totems';
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

/** A Shaman who knows everything, a hurt ally beside it, and two foes. */
function scene() {
  const sh = JobSystem.createUnit('p1', 'Wren', 'player', 'shaman', 2, 2, 'N', 10);
  for (const a of JOBS.shaman.abilities) sh.unlockedAbilities[a.id] = true;
  const ally = JobSystem.createUnit('p2', 'Rowan', 'player', 'knight', 3, 2, 'N', 10);
  ally.currentHp = Math.round(ally.maxHp / 2);
  const foe = JobSystem.createUnit('e1', 'Brute', 'enemy', 'knight', 6, 2, 'S', 10);
  const far = JobSystem.createUnit('e2', 'Lookout', 'enemy', 'archer', 9, 9, 'S', 10);
  const units = [sh, ally, foe, far];
  const ctx: ActionContext = { units, grid: new BattleGrid(field()), rng: seededRng(3), rules: CAMPAIGN_RULES, pouchOf: () => ({}) };
  return { sh, ally, foe, far, units, ctx };
}
const action = (u: Unit, id: string) => JobSystem.getCombatActionAbilities(u).find((a) => a.id === id)!;

describe('the Shaman (0.47.0)', () => {
  it('is an advanced job after White Mage and Geomancer, with a staff and robes', () => {
    expect(PLAYER_JOB_IDS).toContain('shaman');
    expect(JOBS.shaman.prerequisites).toEqual([{ jobId: 'white_mage', level: 3 }, { jobId: 'geomancer', level: 2 }]);
    expect(JOB_GEAR.shaman).toEqual({ weapons: ['staff'], robe: true });
    expect(JOBS.shaman.abilities.filter((a) => a.totem).map((a) => a.totem)).toEqual(['mending', 'warding', 'binding', 'storm']);
    expect(SIGNATURES.shaman.totem).toBe('ancestral');
    expect(RECRUIT_JOBS.at(-1)!.jobs).toContain('shaman');
    expect(RECRUIT_PITCH.shaman).toBeTruthy();
  });

  it('plants a totem on a tile: it pulses at once on allies in reach, and hits nobody', () => {
    const { sh, ally, foe, ctx } = scene();
    const before = ally.currentHp;
    const { steps } = runAction(ctx, sh, action(sh, 'sh_mending_totem'), 3, 3);
    const start = steps[0];
    expect(start.kind === 'start' && start.totem).toMatchObject({ kind: 'mending', x: 3, z: 3, radius: 2, turns: TOTEM_TURNS });
    expect(steps.some((s) => s.kind === 'hit')).toBe(false);
    expect(ally.currentHp).toBe(before + Math.round(ally.maxHp * 0.08));
    expect(foe.currentHp).toBe(foe.maxHp); // a foe out of reach, and Mending helps only allies anyway
    expect(sh.totems).toHaveLength(1);
  });

  it('keeps two totems: the same kind moves, a third kind replaces the oldest', () => {
    const { sh, ctx } = scene();
    runAction(ctx, sh, action(sh, 'sh_mending_totem'), 2, 3);
    runAction(ctx, sh, action(sh, 'sh_warding_totem'), 3, 3);
    runAction(ctx, sh, action(sh, 'sh_mending_totem'), 2, 4);
    expect(sh.totems!.map((t) => `${t.kind}@${t.x},${t.z}`)).toEqual(['warding@3,3', 'mending@2,4']);
    runAction(ctx, sh, action(sh, 'sh_binding_totem'), 4, 2);
    expect(sh.totems).toHaveLength(MAX_TOTEMS);
    expect(sh.totems!.map((t) => t.kind)).toEqual(['mending', 'binding']);
  });

  it('counts down on the Shaman\'s turns (longer with Deep Roots) and fades when it falls', () => {
    const { sh, units, ctx } = scene();
    runAction(ctx, sh, action(sh, 'sh_warding_totem'), 3, 3);
    for (let i = 0; i < TOTEM_TURNS - 1; i++) TurnManager.tickStatuses(sh);
    expect(sh.totems).toHaveLength(1);
    TurnManager.tickStatuses(sh);
    expect(sh.totems).toHaveLength(0);

    sh.equippedAbilities.support = 'sh_deep_roots';
    runAction(ctx, sh, action(sh, 'sh_warding_totem'), 3, 3);
    expect(sh.totems![0].turns).toBe(TOTEM_TURNS + DEEP_ROOTS_TURNS);
    sh.isDead = true;
    expect(standingTotems(units)).toHaveLength(0);
  });

  it('pulses on whoever starts a turn in reach: Binding Slows a foe, Storm strikes it', () => {
    const { sh, foe, units, ctx } = scene();
    runAction(ctx, sh, action(sh, 'sh_binding_totem'), 5, 2); // the foe is 1 step away: Slowed at once
    expect(foe.statuses.some((s) => s.type === 'slow')).toBe(true);
    foe.statuses = [];
    const tick = TurnManager.startOfTurn(foe, units);
    expect(tick.totems).toEqual([{ kind: 'binding', status: 'slow' }]);

    runAction(ctx, sh, action(sh, 'sh_storm_totem'), 6, 3);
    const hp = foe.currentHp;
    const storm = TurnManager.startOfTurn(foe, units);
    const hit = storm.totems!.find((p) => p.kind === 'storm')!;
    expect(hit.damage).toBeGreaterThan(0);
    expect(foe.currentHp).toBe(hp - hit.damage!);
  });

  it('Spirit Ward mends the Shaman when struck in reach of its own totem', () => {
    const { sh, foe, ctx } = scene();
    sh.equippedAbilities.reaction = 'sh_spirit_ward';
    const pup = JobSystem.createUnit('e3', 'Pup', 'enemy', 'squire', 2, 1, 'S', 1);
    const blow = JobSystem.getCombatActionAbilities(pup).find((a) => a.id === 'basic_attack')!;
    const swing = () => CombatEngine.executeAttack(CombatEngine.getForecast(pup, sh, blow, 1, 1), () => 0.2);
    expect(swing().reaction).toBeUndefined(); // no totem yet
    runAction(ctx, sh, action(sh, 'sh_warding_totem'), 2, 3);
    expect(swing().reaction?.name).toBe('Spirit Ward');
    expect(foe.isDead).toBe(false);
  });

  it('the AI plants a Mending Totem by hurt allies, and the battle engine plays and records it', () => {
    const { sh, ally, units, ctx } = scene();
    ally.currentHp = Math.round(ally.maxHp * 0.3);
    const plan = planTurn(sh, units, ctx.grid);
    expect(plan.ability?.totem).toBeTruthy();

    const battle = new Battle({ units, grid: ctx.grid, seed: 1, rules: CAMPAIGN_RULES });
    for (const u of units) u.ct = u === sh ? 100 : 0;
    expect(battle.nextTurn()).toBe(sh);
    const mend = action(sh, 'sh_mending_totem');
    expect(battle.check({ moveTo: { x: sh.x, z: sh.z }, ability: mend, target: { x: sh.x, z: sh.z }, facing: 'N' })).toBeNull();
  });
});
