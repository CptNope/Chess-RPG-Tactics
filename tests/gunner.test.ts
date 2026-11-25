/**
 * 0.36.0: the Gunner. A gun's shot reaches any height in range, and high ground neither helps nor
 * hurts it.
 */
import { describe, it, expect } from 'vitest';
import { JOBS, PLAYER_JOB_IDS } from '../src/data/jobs';
import { ITEMS } from '../src/data/items';
import { SIGNATURES } from '../src/data/signatures';
import { JobSystem, JOB_MASTERY, VETERAN_PASSIVES } from '../src/core/JobSystem';
import { CombatEngine } from '../src/core/CombatEngine';
import { recruitJobs } from '../src/core/Recruits';
import { jobCanUse } from '../src/data/gear-rules';
import { Unit } from '../src/core/types';

const make = (job: string, team: 'player' | 'enemy', x = 0, z = 0, level = 5): Unit =>
  JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
const attackOf = (u: Unit) => JobSystem.getCombatActionAbilities(u)[0];

describe('gunner', () => {
  it('is an advanced job after Archer and Thief, with a gun, a mastery bonus and a signature', () => {
    expect(PLAYER_JOB_IDS).toContain('gunner');
    expect(JOBS.gunner.prerequisites).toEqual([{ jobId: 'archer', level: 3 }, { jobId: 'thief', level: 2 }]);
    expect(JOB_MASTERY.gunner).toBeDefined();
    expect(SIGNATURES.gunner?.ignoresHeight).toBe(true);
    const u = make('gunner', 'player');
    expect(u.equipment.weapon?.weaponType).toBe('gun');
    expect(VETERAN_PASSIVES.gunner?.reaction).toBe('gu_return_fire'); // veteran enemy gunners shoot back
    // Guns are the Gunner's alone
    expect(jobCanUse('gunner', ITEMS.long_musket)).toBe(true);
    expect(jobCanUse('archer', ITEMS.long_musket)).toBe(false);
    expect(recruitJobs(3)).not.toContain('gunner');
    expect(recruitJobs(4)).toContain('gunner');
    // Every shot ignores height
    for (const a of JOBS.gunner.abilities.filter((x) => x.type === 'action')) expect(a.ignoresHeight, a.id).toBe(true);
  });

  it('shoots at any height in range; Long Barrel reaches 2 tiles further', () => {
    const g = make('gunner', 'player');
    const shot = attackOf(g);
    expect(shot.range).toBe(ITEMS.flintlock.range);
    expect(shot.heightTolerance).toBeGreaterThan(20);
    expect(shot.ignoresHeight).toBe(true);
    g.equippedAbilities.support = 'gu_long_barrel';
    expect(attackOf(g).range).toBe(ITEMS.flintlock.range! + 2);
    // A bow still minds the height
    const archer = make('archer', 'player');
    expect(attackOf(archer).ignoresHeight).toBeFalsy();
    expect(attackOf(archer).heightTolerance).toBeLessThan(10);
  });

  it('hits as hard and as often uphill as down; a bow does not', () => {
    const g = make('gunner', 'player', 0, 0), foe = make('knight', 'enemy', 0, 3);
    const up = CombatEngine.getForecast(g, foe, attackOf(g), 0, 4);
    const down = CombatEngine.getForecast(g, foe, attackOf(g), 4, 0);
    expect(up.expectedDamage).toBe(down.expectedDamage);
    expect(up.hitChance).toBe(down.hitChance);
    const a = make('archer', 'player', 0, 0);
    const bowUp = CombatEngine.getForecast(a, foe, attackOf(a), 0, 4);
    const bowDown = CombatEngine.getForecast(a, foe, attackOf(a), 4, 0);
    expect(bowDown.heightAdvantage).toBe(4);
    expect(bowDown.expectedDamage).toBeGreaterThan(bowUp.expectedDamage);
    expect(up.heightAdvantage).toBe(0);
  });

  it('returns fire at a ranged attacker in reach, never at a melee one', () => {
    const shoot = (dist: number) => {
      const g = make('gunner', 'player', 0, 0), foe = make('archer', 'enemy', 0, dist);
      g.currentHp = g.maxHp = 999;
      g.equippedAbilities.reaction = 'gu_return_fire';
      const f = CombatEngine.getForecast(foe, g, { ...JOBS.squire.abilities[0], power: 1, appliesStatus: undefined, range: 5 }, 1, 1);
      return CombatEngine.executeAttack({ ...f, hitChance: 100 }, () => 0).reaction;
    };
    expect(shoot(3)?.name).toBe('Return Fire');
    expect(shoot(1)?.name).not.toBe('Return Fire');
    expect(shoot(ITEMS.flintlock.range! + 1)?.name).not.toBe('Return Fire'); // out of the pistol's reach
  });
});
