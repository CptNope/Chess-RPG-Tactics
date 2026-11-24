/**
 * 0.19.0: the Chemist job (Salve, Purge, Acid Flask, Smoke Bomb, Field Dressing, Pharmacology)
 * and two new supplies (Frost Flask, Elixir).
 */
import { describe, it, expect } from 'vitest';
import { JOBS } from '../src/data/jobs';
import { CONSUMABLES, consumableAbility } from '../src/data/consumables';
import { JobSystem, JOB_MASTERY } from '../src/core/JobSystem';
import { CombatEngine } from '../src/core/CombatEngine';
import { unitsInBlast } from '../src/core/EnemyAI';
import { buildTrialFloor } from '../src/core/Trials';
import { Ability, Unit } from '../src/core/types';

function unit(job: string, team: 'player' | 'enemy' = 'player', x = 0, z = 0, level = 6): Unit {
  const u = JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
  for (const a of JOBS[job].abilities) u.unlockedAbilities[a.id] = true;
  return u;
}
const ab = (id: string) => JobSystem.findAbility(id) as Ability;
const item = (id: string) => consumableAbility(CONSUMABLES[id]);
const hit = () => 0; // a roll of 0 always lands (and never crits on the 2nd roll here)
const fc = (a: Unit, t: Unit, x: Ability) => CombatEngine.getForecast(a, t, x, 1, 1, 'grass');
const act = (a: Unit, t: Unit, x: Ability, rng: () => number = () => 0.999) => CombatEngine.executeAttack(fc(a, t, x), rng);

describe('the Chemist', () => {
  it('is a second-tier job off the Squire with a full kit', () => {
    const job = JOBS.chemist;
    expect(job.prerequisites).toEqual([{ jobId: 'squire', level: 2 }]);
    const types = job.abilities.map((a) => a.type);
    expect(types.filter((t) => t === 'action').length).toBe(4);
    expect(types).toContain('reaction');
    expect(types).toContain('support');
    for (const a of job.abilities) expect(a.jobId).toBe('chemist');
    expect(JOB_MASTERY.chemist).toBeTruthy();
    const c = unit('chemist');
    expect(Object.values(c.equipment).filter(Boolean).length).toBeGreaterThanOrEqual(3);
    const sq = unit('squire');
    sq.jobJpEarned = { squire: 100 };
    expect(JobSystem.canChangeJob(sq, 'chemist')).toBe(true);
    sq.jobJpEarned = { squire: 0 };
    expect(JobSystem.canChangeJob(sq, 'chemist')).toBe(false);
  });

  it('Salve heals an ally from ATK for no MP, three tiles away', () => {
    const c = unit('chemist'), ally = unit('knight', 'player', 0, 3);
    ally.currentHp = 10;
    const salve = ab('ch_salve');
    expect(salve.mpCost).toBe(0);
    expect(salve.range).toBe(3);
    expect(CombatEngine.isSupportive(salve)).toBe(true);
    const f = fc(c, ally, salve);
    expect(f.expectedDamage).toBeLessThan(0);
    act(c, ally, salve);
    expect(ally.currentHp).toBeGreaterThan(10);
  });

  it('Purge lifts ailments; Acid Flask breaches; Smoke Bomb blinds foes and only foes', () => {
    const c = unit('chemist'), ally = unit('knight', 'player', 0, 1), foe = unit('knight', 'enemy', 0, 2), foe2 = unit('archer', 'enemy', 1, 2);
    ally.statuses = [{ type: 'poison', duration: 3 }, { type: 'blind', duration: 3 }];
    expect(act(c, ally, ab('ch_purge')).cleansed).toBe(2);
    expect(ally.statuses).toEqual([]);
    const acid = act(c, foe, ab('ch_acid_flask'), hit);
    expect(acid.hit).toBe(true);
    expect(foe.statuses.some((s) => s.type === 'breach')).toBe(true);
    const smoke = ab('ch_smoke_bomb');
    const caught = unitsInBlast(c, smoke, 0, 2, [c, ally, foe, foe2]).map((u) => u.id);
    expect(caught.sort()).toEqual([foe.id, foe2.id].sort());
    act(c, foe2, smoke, hit);
    expect(foe2.statuses.some((s) => s.type === 'blind')).toBe(true);
  });

  it('Field Dressing binds a wound only once a blow leaves you under half HP', () => {
    const c = unit('chemist'), foe = unit('squire', 'enemy', 0, 1, 1);
    c.equippedAbilities.reaction = 'ch_field_dressing';
    const strike = ab('basic_attack');
    c.currentHp = c.maxHp; // a scratch from full HP: no dressing
    const r1 = act(foe, c, strike, () => 0.5);
    expect(r1.hit).toBe(true);
    expect(c.currentHp).toBeGreaterThan(c.maxHp / 2);
    expect(r1.reaction).toBeUndefined();
    c.currentHp = Math.round(c.maxHp * 0.52); // this blow takes it under half
    const before = c.currentHp;
    const r2 = act(foe, c, strike, () => 0.5);
    expect(r2.hit).toBe(true);
    expect(r2.reaction?.name).toBe('Field Dressing');
    expect(r2.reaction?.heal).toBe(Math.round(c.maxHp * 0.15));
    expect(c.currentHp).toBe(before - r2.damageDealt + r2.reaction!.heal!);
  });

  it('Pharmacology makes every supply half again as strong', () => {
    const c = unit('chemist'), plain = unit('squire');
    c.equippedAbilities.support = 'ch_pharmacology';
    expect(JobSystem.itemPotency(c)).toBe(1.5);
    expect(JobSystem.itemPotency(plain)).toBe(1);
    const t1 = unit('knight', 'player', 0, 1), t2 = unit('knight', 'player', 0, 1);
    t1.currentHp = t2.currentHp = 1;
    expect(fc(c, t1, item('potion')).expectedDamage).toBe(-120);
    expect(act(c, t1, item('potion')).damageDealt).toBe(120);
    expect(act(plain, t2, item('potion')).damageDealt).toBe(80);
    const mage = unit('black_mage', 'player', 0, 1);
    mage.currentMp = 0;
    expect(act(c, mage, item('ether')).mpRestored).toBe(Math.min(60, mage.maxMp));
    const foe = unit('knight', 'enemy', 0, 1, 9);
    expect(act(c, foe, item('blast_flask')).damageDealt).toBe(105);
    const fallen = unit('archer', 'player', 0, 1);
    fallen.isDead = true; fallen.currentHp = 0;
    act(c, fallen, item('phoenix_feather'));
    expect(fallen.currentHp).toBe(Math.round(fallen.maxHp * 0.375));
  });

  it('turns up in the Trials', () => {
    const jobs = new Set<string>();
    for (let f = 1; f <= 40; f++) for (const e of buildTrialFloor(f).enemyRoster) jobs.add(e.jobId);
    expect(jobs.has('chemist')).toBe(true);
  });
});

describe('new supplies', () => {
  it('a Frost Flask chills and Slows every foe it hits, and spares allies', () => {
    const user = unit('squire'), foe = unit('knight', 'enemy', 1, 1, 9), ally = unit('archer', 'player', 1, 2);
    const flask = item('frost_flask');
    expect(flask.appliesStatus).toBe('slow');
    expect(CombatEngine.isSupportive(flask)).toBe(false);
    expect(unitsInBlast(user, flask, 1, 1, [user, foe, ally]).map((u) => u.id)).toEqual([foe.id]);
    const hp = foe.currentHp;
    const r = act(user, foe, flask);
    expect(r.damageDealt).toBe(45);
    expect(foe.currentHp).toBe(hp - 45);
    expect(r.appliedStatus).toBe('SLOW');
    expect(foe.statuses.some((s) => s.type === 'slow')).toBe(true);
    const weak = unit('archer', 'enemy', 1, 1, 1);
    weak.currentHp = 10;
    expect(act(user, weak, flask).appliedStatus).toBeUndefined(); // nothing to slow once it falls
  });

  it('an Elixir fills HP and MP to the top', () => {
    const user = unit('squire'), ally = unit('white_mage', 'player', 0, 1);
    ally.currentHp = 1; ally.currentMp = 0;
    const r = act(user, ally, item('elixir'));
    expect(ally.currentHp).toBe(ally.maxHp);
    expect(ally.currentMp).toBe(ally.maxMp);
    expect(r.mpRestored).toBe(ally.maxMp);
    expect(CONSUMABLES.elixir.price).toBeGreaterThan(CONSUMABLES.hi_potion.price + CONSUMABLES.ether.price);
  });
});
