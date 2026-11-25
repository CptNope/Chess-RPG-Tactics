/**
 * 0.37.0: reserve training. Squad members who sat a win out earn half a share of the spoils.
 */
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { PARTY_EXP, PARTY_JP, RESERVE_EXP, RESERVE_JP, reserveOf, trainReserve } from '../src/core/Reserve';

const make = (id: string, job = 'squire', level = 5) => JobSystem.createUnit(id, id, 'player', job, 0, 0, 'N', level);

describe('reserve training', () => {
  it('is half a surviving party member\'s share', () => {
    expect(RESERVE_EXP).toBe(PARTY_EXP / 2);
    expect(RESERVE_JP).toBe(PARTY_JP / 2);
  });

  it('trains only those who sat the battle out', () => {
    const squad = [make('a'), make('b'), make('c')];
    expect(reserveOf(squad, ['a', 'c']).map((u) => u.id)).toEqual(['b']);
    const jpBefore = squad.map((u) => u.jobPoints.squire), expBefore = squad.map((u) => u.exp);
    const gains = trainReserve(squad, ['a', 'c']);
    expect(gains.map((g) => g.unit.id)).toEqual(['b']);
    expect(squad[1].jobPoints.squire).toBe(jpBefore[1] + RESERVE_JP);
    expect(squad[1].exp).toBe(expBefore[1] + RESERVE_EXP);
    // The party's spoils are handed out elsewhere: trainReserve leaves them alone
    expect(squad[0].jobPoints.squire).toBe(jpBefore[0]);
    expect(squad[2].exp).toBe(expBefore[2]);
  });

  it('puts JP into the current job, counts JP Boost, and reports level-ups', () => {
    const u = make('k', 'knight');
    u.exp = 90;
    u.equippedAbilities.support = 'sq_jp_boost';
    const knightJp = u.jobPoints.knight || 0, squireJp = u.jobPoints.squire || 0;
    const [g] = trainReserve([u], []);
    expect(u.jobPoints.knight).toBe(knightJp + Math.round(RESERVE_JP * 1.5));
    expect(u.jobPoints.squire).toBe(squireJp);
    expect(g.levels).toBe(1);
    expect(u.level).toBe(6);
  });

  it('a full party leaves nobody to train', () => {
    const squad = [make('a'), make('b')];
    expect(trainReserve(squad, ['a', 'b'])).toEqual([]);
  });
});
