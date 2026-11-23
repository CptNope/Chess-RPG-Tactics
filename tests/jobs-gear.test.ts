/**
 * 0.13.0: the Monk, Thief, Summoner and Oracle, the new statuses (Shell, Regen, Blind, Silence,
 * Sleep, Breach), ability flags (cleanse, drain, steal, ATK-scaled heals) and gear traits.
 */
import { describe, it, expect } from 'vitest';
import { JOBS } from '../src/data/jobs';
import { ITEMS, STARTING_ARMORY, RARE_DROP_POOL } from '../src/data/items';
import { JobSystem, VETERAN_PASSIVES } from '../src/core/JobSystem';
import { CombatEngine, HARMFUL_STATUSES, BENEFICIAL_STATUSES, STATUS_DURATION } from '../src/core/CombatEngine';
import { TurnManager } from '../src/core/TurnManager';
import { BattleGrid } from '../src/core/Grid';
import { planTurn } from '../src/core/EnemyAI';
import { Ability, Unit } from '../src/core/types';

/** Every roll succeeds (hits land, chance-based reactions fire). */
const always = () => 0;
/** Alternates: the hit roll lands, the next roll (crit) fails, and so on. */
const hitNoCrit = () => { let i = 0; return () => (i++ % 2 === 0 ? 0 : 0.99); };
const ab = (id: string) => JobSystem.findAbility(id) as Ability;

function unit(job: string, team: 'player' | 'enemy', x: number, z: number, level = 5): Unit {
  const u = JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
  for (const a of JOBS[job].abilities) u.unlockedAbilities[a.id] = true;
  return u;
}
const fc = (a: Unit, t: Unit, ability: Ability) => CombatEngine.getForecast(a, t, ability, 1, 1, 'grass');

function flatGrid(w = 8, d = 8) {
  const tiles = [];
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) tiles.push({ x, z, height: 1, terrain: 'grass' as const, walkable: true });
  return new BattleGrid({ id: 't', name: 'T', theme: 'day' as const, width: w, depth: d, tiles });
}

describe('new jobs and data', () => {
  it('adds the Monk, Thief, Summoner and Oracle with a full kit each', () => {
    for (const id of ['monk', 'thief', 'summoner', 'oracle']) {
      const j = JOBS[id];
      expect(j, id).toBeTruthy();
      expect(j.abilities.filter((a) => a.type === 'action').length, id).toBeGreaterThanOrEqual(3);
      expect(j.abilities.some((a) => a.type === 'reaction'), id).toBe(true);
      expect(j.abilities.some((a) => a.type === 'support'), id).toBe(true);
      for (const p of j.prerequisites || []) expect(JOBS[p.jobId]).toBeTruthy();
    }
  });

  it('ability ids are unique and every status has a duration and a side', () => {
    const ids = Object.values(JOBS).flatMap((j) => j.abilities.map((a) => a.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of Object.keys(STATUS_DURATION)) {
      expect(HARMFUL_STATUSES.includes(s as never) !== BENEFICIAL_STATUSES.includes(s as never), s).toBe(true);
    }
  });

  it('veteran passives and trait statuses point at real abilities and statuses', () => {
    for (const [job, p] of Object.entries(VETERAN_PASSIVES)) {
      expect(JOBS[job]).toBeTruthy();
      if (p.reaction) expect(ab(p.reaction)?.type).toBe('reaction');
      if (p.support) expect(ab(p.support)?.type).toBe('support');
    }
    for (const it of Object.values(ITEMS)) {
      for (const s of [...(it.traits?.startStatus || []), ...(it.traits?.guard || [])]) expect(STATUS_DURATION[s], `${it.id} ${s}`).toBeTruthy();
    }
  });

  it('new starting gear exists and every new job has a weapon in the starting armory', () => {
    for (const id of STARTING_ARMORY) expect(ITEMS[id], id).toBeTruthy();
    expect(new Set(RARE_DROP_POOL).size).toBe(RARE_DROP_POOL.length);
    for (const id of ['monk', 'thief', 'summoner', 'oracle']) {
      const u = unit(id, 'player', 0, 0);
      expect(u.equipment.weapon, id).toBeTruthy();
      expect(STARTING_ARMORY).toContain(u.equipment.weapon!.id);
    }
  });

  it('old saves get JP banked for jobs they have never seen', () => {
    const u = unit('squire', 'player', 0, 0);
    delete u.jobPoints.monk;
    delete u.jobPoints.oracle;
    JobSystem.ensureJobPoints(u);
    expect(u.jobPoints.monk).toBe(200);
    expect(u.jobPoints.oracle).toBe(200);
    expect(u.jobPoints.squire).toBe(250);
  });
});

describe('new statuses', () => {
  it('Breach makes physical blows land harder and Protect softer', () => {
    const a = unit('knight', 'player', 0, 1), t = unit('squire', 'enemy', 0, 0);
    const base = fc(a, t, ab('basic_attack')).expectedDamage;
    CombatEngine.applyStatus(t, 'breach');
    expect(fc(a, t, ab('basic_attack')).expectedDamage).toBeGreaterThan(base * 1.2);
    expect(ab('kn_rend_armor').appliesStatus).toBe('breach');
  });

  it('Shell cuts spell damage but not physical damage', () => {
    const mage = unit('black_mage', 'player', 0, 2), knight = unit('knight', 'player', 0, 1), t = unit('squire', 'enemy', 0, 0);
    const spell = fc(mage, t, ab('bm_fire')).expectedDamage, blow = fc(knight, t, ab('basic_attack')).expectedDamage;
    CombatEngine.applyStatus(t, 'shell');
    expect(fc(mage, t, ab('bm_fire')).expectedDamage).toBeLessThan(spell * 0.75);
    expect(fc(knight, t, ab('basic_attack')).expectedDamage).toBe(blow);
  });

  it('Blind costs 40 points of physical accuracy, not spell accuracy', () => {
    const a = unit('knight', 'player', 0, 1), m = unit('black_mage', 'player', 1, 1), t = unit('squire', 'enemy', 0, 0);
    const hit = fc(a, t, ab('basic_attack')).hitChance, spell = fc(m, t, ab('bm_fire')).hitChance;
    CombatEngine.applyStatus(a, 'blind');
    CombatEngine.applyStatus(m, 'blind');
    expect(fc(a, t, ab('basic_attack')).hitChance).toBe(Math.max(10, hit - 40));
    expect(fc(m, t, ab('bm_fire')).hitChance).toBe(spell);
  });

  it('Silence seals every ability that costs MP', () => {
    const u = unit('summoner', 'player', 0, 0);
    expect(JobSystem.getCombatActionAbilities(u).some((a) => a.mpCost > 0)).toBe(true);
    CombatEngine.applyStatus(u, 'silence');
    const left = JobSystem.getCombatActionAbilities(u);
    expect(left.every((a) => a.mpCost === 0)).toBe(true);
    expect(left.map((a) => a.id)).toContain('basic_attack');
  });

  it('a sleeping unit loses its turns until struck, and cannot dodge', () => {
    const sleeper = unit('squire', 'enemy', 0, 0), other = unit('squire', 'player', 3, 3);
    sleeper.speed = 20; other.speed = 5;
    CombatEngine.applyStatus(sleeper, 'sleep');
    const tm = new TurnManager([sleeper, other]);
    const r = tm.advanceToNextActiveTurn()!;
    expect(r.activeUnit).toBe(other);
    expect(tm.skipped.some((t) => t.unit === sleeper && t.slept)).toBe(true);

    const a = unit('knight', 'player', 0, 1);
    CombatEngine.applyStatus(sleeper, 'sleep');
    const f = fc(a, sleeper, ab('basic_attack'));
    expect(f.hitChance).toBe(100);
    const res = CombatEngine.executeAttack(f, hitNoCrit());
    expect(res.woke).toBe(true);
    expect(sleeper.statuses.some((s) => s.type === 'sleep')).toBe(false);
  });

  it('Sleep wears off on its own even if nobody hits the sleeper', () => {
    const sleeper = unit('squire', 'enemy', 0, 0), other = unit('squire', 'player', 3, 3);
    CombatEngine.applyStatus(sleeper, 'sleep');
    const tm = new TurnManager([sleeper, other]);
    let sleeperActed = false;
    for (let i = 0; i < 12 && !sleeperActed; i++) {
      const r = tm.advanceToNextActiveTurn()!;
      if (r.activeUnit === sleeper) sleeperActed = true;
      r.activeUnit.hasMoved = r.activeUnit.hasActed = true;
      tm.endTurn(r.activeUnit);
    }
    expect(sleeperActed).toBe(true);
  });

  it('Regen heals 8% at the start of each turn and never overheals', () => {
    const u = unit('squire', 'player', 0, 0);
    u.currentHp = u.maxHp - 5;
    CombatEngine.applyStatus(u, 'regen');
    const tick = TurnManager.startOfTurn(u);
    expect(tick.regen).toBe(5);
    expect(u.currentHp).toBe(u.maxHp);
    u.currentHp = Math.round(u.maxHp / 2);
    expect(TurnManager.startOfTurn(u).regen).toBe(Math.round(u.maxHp * 0.08));
  });
});

describe('new ability effects', () => {
  it('cleansing removes ailments and leaves buffs alone', () => {
    const monk = unit('monk', 'player', 0, 0);
    monk.currentHp = 50;
    for (const s of ['poison', 'blind', 'slow', 'haste'] as const) CombatEngine.applyStatus(monk, s);
    const res = CombatEngine.executeAttack(fc(monk, monk, ab('mo_chakra')), always);
    expect(res.isHeal).toBe(true);
    expect(res.cleansed).toBe(3);
    expect(monk.statuses.map((s) => s.type)).toEqual(['haste']);
    expect(monk.currentHp).toBeGreaterThan(50);
  });

  it('Chakra heals from ATK, so a Monk heals better than its MAG alone would allow', () => {
    const monk = unit('monk', 'player', 0, 0);
    const heal = -fc(monk, monk, ab('mo_chakra')).expectedDamage;
    const fromMag = Math.round(JobSystem.getMagicPower(monk) * 0.7 * 3);
    expect(heal).toBeGreaterThan(fromMag);
  });

  it('Soul Drain heals the caster for half the damage dealt', () => {
    const o = unit('oracle', 'player', 0, 1), t = unit('knight', 'enemy', 0, 0);
    o.currentHp = 10;
    const res = CombatEngine.executeAttack(fc(o, t, ab('or_soul_drain')), hitNoCrit());
    expect(res.drained).toBe(Math.max(1, Math.round(res.damageDealt * 0.5)));
    expect(o.currentHp).toBe(10 + res.drained!);
  });

  it('Steal lifts gear off the target (accessory first) and needs gear to work', () => {
    const th = unit('thief', 'player', 0, 1), t = unit('ninja', 'enemy', 0, 0);
    const res = CombatEngine.executeAttack(fc(th, t, ab('th_steal')), always);
    expect(res.stolen?.id).toBe('hermes_shoes');
    expect(t.equipment.accessory).toBeNull();
    expect(res.damageDealt).toBe(0);
    for (const k of Object.keys(t.equipment) as (keyof typeof t.equipment)[]) t.equipment[k] = null;
    expect(fc(th, t, ab('th_steal')).hitChance).toBe(0);
  });

  it('Steal is harder than a blow, and harder still against a boss', () => {
    const th = unit('thief', 'player', 0, 1), t = unit('knight', 'enemy', 0, 0), b = unit('knight', 'enemy', 1, 0);
    JobSystem.makeBoss(b);
    const blow = fc(th, t, ab('basic_attack')).hitChance;
    expect(fc(th, t, ab('th_steal')).hitChance).toBeLessThan(blow);
    expect(fc(th, b, ab('th_steal')).hitChance).toBeLessThan(fc(th, t, ab('th_steal')).hitChance);
  });

  it('Conserve halves MP costs (rounding up) everywhere the ability list is read', () => {
    const s = unit('summoner', 'player', 0, 0);
    s.equippedAbilities.support = 'su_conserve';
    const sal = JobSystem.getCombatActionAbilities(s).find((a) => a.id === 'su_salamander')!;
    expect(sal.mpCost).toBe(12);
    expect(ab('su_salamander').mpCost).toBe(24); // the shared data is untouched
  });

  it('summons reach a radius of 2', () => {
    for (const id of ['su_salamander', 'su_undine', 'su_storm_roc', 'su_sylph', 'su_golem']) expect(ab(id).aoe).toBe(2);
  });
});

describe('new reactions and supports', () => {
  it('Iron Will fires once, at half HP', () => {
    const a = unit('knight', 'enemy', 0, 0), m = unit('monk', 'player', 0, 1, 3);
    m.equippedAbilities.reaction = 'mo_iron_will';
    m.currentHp = Math.round(m.maxHp * 0.55);
    const f = fc(a, m, ab('basic_attack'));
    f.expectedDamage = Math.round(m.maxHp * 0.1);
    const r1 = CombatEngine.executeAttack(f, hitNoCrit());
    expect(r1.reaction?.type).toBe('iron_will');
    expect(m.statuses.map((s) => s.type)).toEqual(expect.arrayContaining(['focus', 'protect']));
    const r2 = CombatEngine.executeAttack({ ...f }, hitNoCrit());
    expect(r2.reaction).toBeUndefined();
  });

  it('Mana Spring restores 15% MP when struck', () => {
    const a = unit('knight', 'enemy', 0, 0), s = unit('summoner', 'player', 0, 1);
    s.equippedAbilities.reaction = 'su_mana_spring';
    s.currentMp = 0;
    const r = CombatEngine.executeAttack(fc(a, s, ab('basic_attack')), hitNoCrit());
    expect(r.reaction?.type).toBe('mana_spring');
    expect(s.currentMp).toBe(Math.round(s.maxMp * 0.15));
  });

  it('Hex Ward can blind the attacker', () => {
    const a = unit('knight', 'enemy', 0, 0), o = unit('oracle', 'player', 0, 1);
    o.equippedAbilities.reaction = 'or_hex_ward';
    const r = CombatEngine.executeAttack(fc(a, o, ab('basic_attack')), () => 0.01);
    expect(r.reaction?.type).toBe('hex_ward');
    expect(a.statuses.some((s) => s.type === 'blind')).toBe(true);
  });

  it('Brawler boosts unarmed and knuckle Attacks only', () => {
    const m = unit('monk', 'player', 0, 1), t = unit('squire', 'enemy', 0, 0);
    const plain = fc(m, t, ab('basic_attack')).expectedDamage;
    m.equippedAbilities.support = 'mo_brawler';
    expect(fc(m, t, ab('basic_attack')).expectedDamage).toBeGreaterThan(plain * 1.25);
    m.equipment.weapon = ITEMS.iron_sword;
    const sword = fc(m, t, ab('basic_attack')).expectedDamage;
    m.equippedAbilities.support = null;
    expect(fc(m, t, ab('basic_attack')).expectedDamage).toBe(sword);
  });

  it('Backstab adds to flank and back damage, not front', () => {
    const th = unit('thief', 'player', 0, 1), t = unit('squire', 'enemy', 0, 0);
    t.facing = 'N'; // facing away from a thief to the south: a back attack
    const back = fc(th, t, ab('basic_attack')).expectedDamage;
    th.equippedAbilities.support = 'th_backstab';
    expect(fc(th, t, ab('basic_attack')).expectedDamage).toBeGreaterThan(back * 1.2);
    t.facing = 'S';
    const front = fc(th, t, ab('basic_attack')).expectedDamage;
    th.equippedAbilities.support = null;
    expect(fc(th, t, ab('basic_attack')).expectedDamage).toBe(front);
  });

  it('Armor Mastery adds half again the HP from armor, helms and shields', () => {
    const k = unit('knight', 'player', 0, 0);
    const before = k.maxHp;
    k.equippedAbilities.support = 'kn_heavy_armor';
    JobSystem.recalculateDerivedStats(k);
    const armorHp = (k.equipment.body?.stats.hp || 0) + (k.equipment.head?.stats.hp || 0) + (k.equipment.shield?.stats.hp || 0);
    expect(k.maxHp - before).toBe(Math.round((k.equipment.body?.stats.hp || 0) * 1.5) - (k.equipment.body?.stats.hp || 0)
      + Math.round((k.equipment.head?.stats.hp || 0) * 1.5) - (k.equipment.head?.stats.hp || 0)
      + Math.round((k.equipment.shield?.stats.hp || 0) * 1.5) - (k.equipment.shield?.stats.hp || 0));
    expect(armorHp).toBeGreaterThan(0);
  });

  it('Fleet Foot adds 1 Move and 1 Jump', () => {
    const t = unit('thief', 'player', 0, 0);
    const { move, jump } = t;
    t.equippedAbilities.movement = 'th_fleet';
    JobSystem.recalculateDerivedStats(t);
    expect([t.move, t.jump]).toEqual([move + 1, jump + 1]);
  });
});

describe('gear traits', () => {
  it('guard traits stop ailments and the AI does not waste a turn on them', () => {
    const o = unit('oracle', 'enemy', 0, 2), t = unit('knight', 'player', 0, 0);
    t.equipment.accessory = ITEMS.ribbon;
    const res = CombatEngine.executeAttack(fc(o, t, ab('or_hush')), always);
    expect(res.resisted).toBe(true);
    expect(t.statuses).toEqual([]);
    expect(CombatEngine.applyStatus(t, 'sleep')).toBe(false);
    expect(CombatEngine.applyStatus(t, 'haste')).toBe(true); // buffs still land
  });

  it('start-of-battle statuses come from gear; gear Regen lasts the whole battle', () => {
    const u = unit('squire', 'player', 0, 0);
    u.equipment.accessory = ITEMS.verdant_charm;
    u.equipment.shield = ITEMS.mirror_shield;
    JobSystem.resetForBattle(u, 0, 0);
    const regen = u.statuses.find((s) => s.type === 'regen');
    expect(regen?.duration).toBeGreaterThan(50);
    expect(u.statuses.find((s) => s.type === 'shell')?.duration).toBe(STATUS_DURATION.shell);
  });

  it('element boosts strengthen only their element', () => {
    const m = unit('black_mage', 'player', 0, 1), t = unit('squire', 'enemy', 0, 0);
    m.equipment.weapon = ITEMS.frost_rod;
    const fire = fc(m, t, ab('bm_fire')).expectedDamage, ice = fc(m, t, ab('bm_blizzard')).expectedDamage;
    m.equipment.weapon = ITEMS.flame_rod; // same stats, different element
    expect(fc(m, t, ab('bm_fire')).expectedDamage).toBeGreaterThan(fire * 1.2);
    expect(fc(m, t, ab('bm_blizzard')).expectedDamage).toBeLessThan(ice);
  });
});

describe('AI with the new kit', () => {
  it('never tries to Steal and never casts an ailment the target is guarded against', () => {
    const grid = flatGrid();
    const thief = unit('thief', 'enemy', 3, 3, 6), oracle = unit('oracle', 'enemy', 4, 1, 6);
    const p = unit('knight', 'player', 3, 4, 6);
    p.equipment.accessory = ITEMS.ribbon;
    const units = [thief, oracle, p];
    expect(planTurn(thief, units, grid).ability?.id).not.toBe('th_steal');
    const plan = planTurn(oracle, units, grid);
    expect(['or_dim_sight', 'or_hush', 'or_lullaby']).not.toContain(plan.ability?.id);
  });
});
