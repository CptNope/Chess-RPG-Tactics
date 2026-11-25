// The battle-engine groundwork (0.41.0): sides, seeded dice, rules and the action resolver.
import { describe, it, expect } from 'vitest';
import { BattleGrid } from '../src/core/Grid';
import { JobSystem } from '../src/core/JobSystem';
import { ActionContext, resolveAction, runAction, victimsFor } from '../src/core/Action';
import { allianceOf, isAlly, isFoe, joinSide, sidesStanding } from '../src/core/Sides';
import { seededRng } from '../src/core/Rng';
import { seededRng as trialsRng } from '../src/core/Trials';
import { BattleRules, CAMPAIGN_RULES, earnsProgress } from '../src/core/Rules';
import { CONSUMABLES, consumableAbility } from '../src/data/consumables';
import type { MapData } from '../src/data/maps';
import type { Ability, Unit } from '../src/core/types';

const field = (): MapData => {
  const tiles = [];
  for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) tiles.push({ x, z, height: 1, terrain: 'grass' as const, walkable: true });
  return { id: 'test', name: 'Test', theme: 'day', width: 8, depth: 8, tiles };
};

/** A squire facing a knight one tile north, both level 5, on flat grass. */
function duel(seed = 1, rules: BattleRules = CAMPAIGN_RULES) {
  const hero = JobSystem.createUnit('p1', 'Rowan', 'player', 'squire', 3, 4, 'N', 5);
  const foe = JobSystem.createUnit('e1', 'Brute', 'enemy', 'knight', 3, 3, 'S', 5);
  const units = [hero, foe];
  const inventory: Record<string, number> = { potion: 2 };
  const ctx: ActionContext = {
    units,
    grid: new BattleGrid(field()),
    rng: seededRng(seed),
    rules,
    pouchOf: (c) => (c.team === 'enemy' ? c.pouch : inventory)
  };
  return { hero, foe, units, ctx, inventory };
}

const attack = (u: Unit): Ability => JobSystem.getCombatActionAbilities(u).find((a) => a.id === 'basic_attack') as Ability;

describe('sides (0.41.0)', () => {
  it('a team is its own side until it is given an alliance', () => {
    const a = JobSystem.createUnit('a', 'A', 'player', 'squire', 0, 0, 'N', 1);
    const b = JobSystem.createUnit('b', 'B', 'enemy', 'squire', 0, 0, 'N', 1);
    expect(isFoe(a, b)).toBe(true);
    expect(isAlly(a, a)).toBe(true);
    // two teams on one alliance (a 2v2) are allies
    a.alliance = 'north';
    b.alliance = 'north';
    expect(isAlly(a, b)).toBe(true);
    expect(allianceOf(a)).toBe('north');
  });

  it('a tamed unit joins its tamer\'s side, alliance and all', () => {
    const tamer = JobSystem.createUnit('t', 'T', 'player', 'squire', 0, 0, 'N', 1);
    const beast = JobSystem.createUnit('m', 'M', 'enemy', 'squire', 0, 0, 'N', 1);
    beast.alliance = 'wild';
    joinSide(beast, tamer);
    expect(beast.team).toBe('player');
    expect(beast.alliance).toBeUndefined();
    expect(isAlly(beast, tamer)).toBe(true);
  });

  it('lists the sides still standing', () => {
    const { hero, foe, units } = duel();
    expect([...sidesStanding(units)].sort()).toEqual(['enemy', 'player']);
    foe.isDead = true;
    expect([...sidesStanding(units)]).toEqual([allianceOf(hero)]);
  });
});

describe('dice (0.41.0)', () => {
  it('the same seed gives the same rolls; Trials keeps its import', () => {
    const a = seededRng(42), b = seededRng(42), c = seededRng(43);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect(c()).not.toBe(xs[0]);
    expect(trialsRng).toBe(seededRng);
  });
});

describe('resolveAction (0.41.0)', () => {
  it('the same seed resolves an action the same way', () => {
    const outcome = (seed: number) => {
      const { hero, foe, ctx } = duel(seed);
      const { steps } = runAction(ctx, hero, attack(hero), foe.x, foe.z);
      return { hp: foe.currentHp, hits: steps.filter((s) => s.kind === 'hit').map((s) => s.kind === 'hit' && [s.result.hit, s.result.damageDealt, s.result.isCrit]) };
    };
    expect(outcome(7)).toEqual(outcome(7));
    // and across many seeds the dice do vary
    const hps = new Set(Array.from({ length: 40 }, (_, i) => outcome(i).hp));
    expect(hps.size).toBeGreaterThan(1);
  });

  it('pays costs and turns the caster first, and rolls a blow only when asked', () => {
    const { hero, foe, ctx } = duel();
    const run = resolveAction(ctx, hero, attack(hero), foe.x, foe.z);
    const start = run.next().value;
    expect(start).toMatchObject({ kind: 'start', calling: false, faced: true });
    expect(hero.hasActed).toBe(true);
    expect(hero.facing).toBe('N');
    expect(foe.currentHp).toBe(foe.maxHp); // nothing rolled yet
    const hit = run.next().value;
    expect(hit).toMatchObject({ kind: 'hit', target: foe });
    const end = run.next();
    expect(end.done).toBe(true);
  });

  it('grants JP and EXP only to the teams the rules name', () => {
    const campaign = duel(3);
    const { end } = runAction(campaign.ctx, campaign.hero, attack(campaign.hero), campaign.foe.x, campaign.foe.z);
    expect(end.jpGained).toBe(24);
    expect(campaign.hero.jobPoints.squire).toBeGreaterThanOrEqual(24);

    const versus = duel(3, { progressionTeams: [] });
    const jp = versus.hero.jobPoints.squire || 0;
    const r = runAction(versus.ctx, versus.hero, attack(versus.hero), versus.foe.x, versus.foe.z);
    expect(r.end.jpGained).toBe(0);
    expect(versus.hero.jobPoints.squire || 0).toBe(jp);
    expect(earnsProgress(CAMPAIGN_RULES, versus.foe)).toBe(false);
  });

  it('a supply comes out of the caster\'s side\'s pouch and earns no JP', () => {
    const { hero, ctx, inventory } = duel();
    hero.currentHp = 10;
    const potion = consumableAbility(CONSUMABLES.potion);
    const { end } = runAction(ctx, hero, potion, hero.x, hero.z);
    expect(inventory.potion).toBe(1);
    expect(hero.currentHp).toBeGreaterThan(10);
    expect(end.jpGained).toBe(0);
  });

  it('a revive aims only at a fallen ally', () => {
    const { hero, foe, units } = duel();
    foe.isDead = true;
    const raise = { ...attack(hero), revive: true } as Ability;
    expect(victimsFor(units, hero, raise, foe.x, foe.z)).toEqual([]);
    const ally = JobSystem.createUnit('p2', 'Maren', 'player', 'knight', 5, 5, 'N', 5);
    ally.isDead = true;
    expect(victimsFor([...units, ally], hero, raise, 5, 5)).toEqual([ally]);
  });
});
