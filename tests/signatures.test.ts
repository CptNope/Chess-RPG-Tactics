/**
 * 0.23.0: Master signatures, one per job, earned at job level 8 and usable once per battle in any job.
 */
import { describe, it, expect } from 'vitest';
import { JOBS } from '../src/data/jobs';
import { SIGNATURES } from '../src/data/signatures';
import { MapData } from '../src/data/maps';
import { JobSystem, JOB_LEVEL_JP, MAX_JOB_LEVEL } from '../src/core/JobSystem';
import { CombatEngine } from '../src/core/CombatEngine';
import { BattleGrid } from '../src/core/Grid';
import { planTurn, unitsInBlast } from '../src/core/EnemyAI';
import { isCentered } from '../src/core/Performance';
import { Unit } from '../src/core/types';

function unit(job: string, team: 'player' | 'enemy' = 'player', x = 0, z = 0, level = 8): Unit {
  const u = JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
  for (const a of JOBS[job].abilities) u.unlockedAbilities[a.id] = true;
  return u;
}
const master = (u: Unit, jobId: string) => { u.jobJpEarned = { ...(u.jobJpEarned || {}), [jobId]: JOB_LEVEL_JP[MAX_JOB_LEVEL - 1] }; };
const actions = (u: Unit) => JobSystem.getCombatActionAbilities(u).map((a) => a.id);
function map(size = 10): BattleGrid {
  const tiles = [];
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) tiles.push({ x, z, height: 1, terrain: 'grass', walkable: true });
  return new BattleGrid({ id: 'flat', name: 'Flat', width: size, depth: size, tiles } as unknown as MapData);
}

describe('Master signatures', () => {
  it('one per job: a free, unlearnable action of its own', () => {
    expect(Object.keys(SIGNATURES).sort()).toEqual(Object.keys(JOBS).sort());
    const jobAbilityIds = new Set(Object.values(JOBS).flatMap((j) => j.abilities.map((a) => a.id)));
    const ids = Object.values(SIGNATURES).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [jobId, a] of Object.entries(SIGNATURES)) {
      expect(a.jobId, a.id).toBe(jobId);
      expect(a.signature, a.id).toBe(true);
      expect(a.type).toBe('action');
      expect(a.mpCost, a.id).toBe(0);
      expect(a.jpCost, a.id).toBe(0);
      expect(jobAbilityIds.has(a.id), a.id).toBe(false);
      expect(JobSystem.findAbility(a.id), a.id).toBe(a);
      if (a.centered) { expect(a.range, a.id).toBe(0); expect(a.aoe, a.id).toBeGreaterThan(0); }
      expect(a.performance, a.id).toBeFalsy();
    }
  });

  it('are earned only by mastering the job, and then kept in every job', () => {
    const u = unit('squire');
    expect(actions(u).filter((id) => id.startsWith('sig_'))).toEqual([]);
    u.jobJpEarned = { ...(u.jobJpEarned || {}), knight: JOB_LEVEL_JP[MAX_JOB_LEVEL - 2] }; // one level short
    expect(actions(u)).not.toContain('sig_shield_wall');
    master(u, 'knight');
    expect(actions(u)).toContain('sig_shield_wall');
    master(u, 'squire');
    expect(JobSystem.signaturesOf(u).map((a) => a.id).sort()).toEqual(['sig_shield_wall', 'sig_valiant_charge']);
  });

  it('can be used once per battle; a new battle brings them back', () => {
    const u = unit('squire');
    master(u, 'monk');
    JobSystem.useSignature(u, SIGNATURES.monk);
    expect(actions(u)).not.toContain('sig_final_fist');
    JobSystem.resetForBattle(u, 0, 0);
    expect(actions(u)).toContain('sig_final_fist');
    JobSystem.useSignature(u, JobSystem.findAbility('sq_stone')!); // not a signature: nothing changes
    expect(u.usedSignatures).toEqual([]);
  });

  it('stay usable under Silence (they cost no MP)', () => {
    const u = unit('black_mage');
    master(u, 'black_mage');
    CombatEngine.applyStatus(u, 'silence');
    expect(actions(u)).toContain('sig_meteor');
  });

  it('centred signatures fill the area around the user: harm reaches foes, help reaches allies', () => {
    const geo = unit('geomancer', 'player', 4, 4), ally = unit('knight', 'player', 4, 5), foe = unit('knight', 'enemy', 4, 7), far = unit('archer', 'enemy', 4, 8);
    const quake = SIGNATURES.geomancer;
    expect(isCentered(quake)).toBe(true);
    expect(unitsInBlast(geo, quake, geo.x, geo.z, [geo, ally, foe, far]).map((u) => u.id)).toEqual([foe.id]);
    const wall = SIGNATURES.knight;
    expect(unitsInBlast(geo, wall, geo.x, geo.z, [geo, ally, foe]).map((u) => u.id).sort()).toEqual([geo.id, ally.id].sort());
  });

  it('Panacea heals and cleanses; Sanctuary heals and gives Regen', () => {
    const chem = unit('chemist'), ally = unit('knight', 'player', 0, 1);
    ally.currentHp = Math.round(ally.maxHp / 2);
    CombatEngine.applyStatus(ally, 'poison');
    const r = CombatEngine.executeAttack(CombatEngine.getForecast(chem, ally, SIGNATURES.chemist, 1, 1, 'grass'), () => 0.5);
    expect(r.isHeal).toBe(true);
    expect(ally.statuses.some((s) => s.type === 'poison')).toBe(false);
    const pal = unit('paladin'), hurt = unit('archer', 'player', 1, 0);
    hurt.currentHp = Math.round(hurt.maxHp / 2);
    const before = hurt.currentHp;
    CombatEngine.executeAttack(CombatEngine.getForecast(pal, hurt, SIGNATURES.paladin, 1, 1, 'grass'), () => 0.5);
    expect(hurt.currentHp).toBeGreaterThan(before);
    expect(hurt.statuses.some((s) => s.type === 'regen')).toBe(true);
  });

  it('hit harder than the job\'s everyday actions', () => {
    const pairs: [string, string][] = [['monk', 'basic_attack'], ['ninja', 'basic_attack'], ['archer', 'basic_attack'], ['squire', 'basic_attack']];
    for (const [job, plain] of pairs) {
      const u = unit(job), foe = unit('knight', 'enemy', 0, 1);
      const basic = JobSystem.getCombatActionAbilities(u).find((a) => a.id === plain)!;
      const sig = CombatEngine.getForecast(u, foe, SIGNATURES[job], 1, 1, 'grass').expectedDamage;
      expect(sig, job).toBeGreaterThan(CombatEngine.getForecast(u, foe, basic, 1, 1, 'grass').expectedDamage * 1.5);
    }
  });
});

describe('the planner and signatures', () => {
  it("doesn't spend one on a foe an ordinary blow finishes", () => {
    const grid = map();
    const monk = unit('monk', 'player', 4, 4);
    master(monk, 'monk');
    const foe = unit('archer', 'enemy', 4, 5, 1);
    foe.currentHp = 5;
    const plan = planTurn(monk, [monk, foe], grid);
    expect(plan.ability?.signature).toBeFalsy();
  });

  it('uses one when it catches a whole group', () => {
    const grid = map(12);
    const mage = unit('black_mage', 'player', 2, 6);
    mage.unlockedAbilities = { basic_attack: true }; // no spells of its own: only the signature reaches
    master(mage, 'black_mage');
    mage.move = 0;
    const foes = [unit('knight', 'enemy', 6, 6), unit('archer', 'enemy', 6, 7), unit('squire', 'enemy', 7, 6)];
    const plan = planTurn(mage, [mage, ...foes], grid);
    expect(plan.ability?.id).toBe('sig_meteor');
  });
});

describe('signature accuracy (0.23.0)', () => {
  it('lands far more often than an ordinary blow against an evasive foe', () => {
    const monk = unit('monk'), ninja = unit('ninja', 'enemy', 0, 1);
    const plain = CombatEngine.getForecast(monk, ninja, JobSystem.findAbility('basic_attack')!, 1, 1, 'grass').hitChance;
    const sig = CombatEngine.getForecast(monk, ninja, SIGNATURES.monk, 1, 1, 'grass').hitChance;
    expect(sig).toBe(Math.min(100, plain + 30));
  });
});
