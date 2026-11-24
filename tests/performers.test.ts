/**
 * 0.22.0: the Bard and the Dancer, and performances (songs and dances that play again each turn).
 */
import { describe, it, expect } from 'vitest';
import { JOBS } from '../src/data/jobs';
import { MapData } from '../src/data/maps';
import { JobSystem, JOB_MASTERY, VETERAN_PASSIVES } from '../src/core/JobSystem';
import { CombatEngine, BENEFICIAL_STATUSES } from '../src/core/CombatEngine';
import { BattleGrid } from '../src/core/Grid';
import { TurnManager } from '../src/core/TurnManager';
import { planTurn, unitsInBlast } from '../src/core/EnemyAI';
import { ENCORE_SUPPORT_BONUS, ENCORE_TURNS, encoreDue, encoreTurns, endPerformance, performedBy, startPerformance } from '../src/core/Performance';
import { buildTrialFloor } from '../src/core/Trials';
import { Ability, Unit } from '../src/core/types';

function unit(job: string, team: 'player' | 'enemy' = 'player', x = 0, z = 0, level = 6): Unit {
  const u = JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
  for (const a of JOBS[job].abilities) u.unlockedAbilities[a.id] = true;
  return u;
}
const ab = (id: string) => JobSystem.findAbility(id) as Ability;
const fc = (a: Unit, t: Unit, x: Ability) => CombatEngine.getForecast(a, t, x, 1, 1, 'grass');
const act = (a: Unit, t: Unit, x: Ability, rng: () => number = () => 0.999) => CombatEngine.executeAttack(fc(a, t, x), rng);
function map(size = 9): BattleGrid {
  const tiles = [];
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) tiles.push({ x, z, height: 1, terrain: 'grass', walkable: true });
  return new BattleGrid({ id: 'flat', name: 'Flat', width: size, depth: size, tiles } as unknown as MapData);
}
const has = (u: Unit, t: string) => u.statuses.some((s) => s.type === t);

describe('the Bard and the Dancer', () => {
  it('are third-tier jobs with a full kit, mastery and a veteran reaction', () => {
    expect(JOBS.bard.prerequisites).toEqual([{ jobId: 'archer', level: 2 }, { jobId: 'white_mage', level: 2 }]);
    expect(JOBS.dancer.prerequisites).toEqual([{ jobId: 'thief', level: 2 }, { jobId: 'monk', level: 2 }]);
    for (const id of ['bard', 'dancer']) {
      const types = JOBS[id].abilities.map((a) => a.type);
      expect(types.filter((t) => t === 'action').length, id).toBe(4);
      expect(types.filter((t) => t === 'reaction').length, id).toBe(1);
      expect(types.filter((t) => t === 'support').length, id).toBe(1);
      expect(JOB_MASTERY[id], id).toBeTruthy();
      const vet = VETERAN_PASSIVES[id];
      expect(JOBS[id].abilities.some((a) => a.id === vet.reaction), id).toBe(true);
    }
    // A unit that meets the needs can switch; one that doesn't can't
    const u = unit('squire');
    expect(JobSystem.canChangeJob(u, 'bard')).toBe(false);
    JobSystem.grantPrerequisites(u, 'bard');
    expect(JobSystem.canChangeJob(u, 'bard')).toBe(true);
  });

  it('every performance is centred on the performer: range 0, an area, a song or a dance', () => {
    const perfs = [...JOBS.bard.abilities, ...JOBS.dancer.abilities].filter((a) => a.performance);
    expect(perfs.map((a) => a.id).sort()).toEqual(['bd_battle_hymn', 'bd_mending_air', 'bd_quickening', 'dn_blade_waltz', 'dn_leaden_reel', 'dn_veil_of_silks']);
    for (const a of perfs) {
      expect(a.type).toBe('action');
      expect(a.range, a.id).toBe(0);
      expect(a.aoe, a.id).toBeGreaterThan(0);
      expect(a.isSelfOnly, a.id).toBeFalsy();
    }
    // Bard songs help, Dancer dances harm
    for (const a of perfs) expect(CombatEngine.isSupportive(a), a.id).toBe(a.jobId === 'bard');
  });

  it('a song reaches the performer and allies within 2; a dance reaches foes within 2, never allies', () => {
    const bard = unit('bard', 'player', 4, 4);
    const near = unit('knight', 'player', 4, 6), far = unit('archer', 'player', 4, 7), foe = unit('knight', 'enemy', 5, 4);
    const units = [bard, near, far, foe];
    const hymn = ab('bd_battle_hymn');
    expect(unitsInBlast(bard, hymn, bard.x, bard.z, units).map((u) => u.id).sort()).toEqual([bard.id, near.id].sort());
    const dancer = unit('dancer', 'player', 4, 4);
    const waltz = ab('dn_blade_waltz');
    expect(unitsInBlast(dancer, waltz, dancer.x, dancer.z, [dancer, near, foe, far]).map((u) => u.id)).toEqual([foe.id]);
  });

  it('Resonance carries a performance a tile further; nothing else changes', () => {
    const bard = unit('bard');
    expect(performedBy(bard, ab('bd_battle_hymn')).aoe).toBe(2);
    bard.equippedAbilities.support = 'bd_resonance';
    expect(performedBy(bard, ab('bd_battle_hymn')).aoe).toBe(3);
    expect(performedBy(bard, ab('bd_discord'))).toBe(ab('bd_discord'));
  });
});

describe('performances', () => {
  it('play again on the next three turns, then stop', () => {
    const bard = unit('bard');
    startPerformance(bard, ab('bd_battle_hymn'));
    expect(bard.performing).toBe('bd_battle_hymn');
    expect(has(bard, 'encore')).toBe(true);
    let encores = 0;
    for (let turn = 0; turn < 8; turn++) {
      TurnManager.tickStatuses(bard); // end of the turn it was used on, then each later one
      if (encoreDue(bard)) encores++;
    }
    expect(encores).toBe(ENCORE_TURNS);
    expect(bard.performing).toBeUndefined();
    expect(has(bard, 'encore')).toBe(false);
  });

  it("the Dancer's Encore support makes them last two turns longer", () => {
    const d = unit('dancer');
    expect(encoreTurns(d)).toBe(ENCORE_TURNS);
    d.equippedAbilities.support = 'dn_encore';
    expect(encoreTurns(d)).toBe(ENCORE_TURNS + ENCORE_SUPPORT_BONUS);
    startPerformance(d, ab('dn_blade_waltz'));
    let encores = 0;
    for (let turn = 0; turn < 10; turn++) { TurnManager.tickStatuses(d); if (encoreDue(d)) encores++; }
    expect(encores).toBe(ENCORE_TURNS + ENCORE_SUPPORT_BONUS);
  });

  it('end when the performer is put to sleep, silenced or falls, or stops by choice', () => {
    for (const end of ['sleep', 'silence', 'dead', 'stop'] as const) {
      const bard = unit('bard');
      startPerformance(bard, ab('bd_mending_air'));
      if (end === 'dead') { bard.isDead = true; bard.currentHp = 0; }
      else if (end === 'stop') expect(endPerformance(bard)).toBe(true);
      else CombatEngine.applyStatus(bard, end);
      expect(encoreDue(bard), end).toBeNull();
      expect(bard.performing, end).toBeUndefined();
      expect(has(bard, 'encore'), end).toBe(false);
    }
    expect(endPerformance(unit('bard'))).toBe(false); // nothing to stop
  });

  it('Encore is a buff (never cleansed), and a new battle or a raise clears it', () => {
    expect(BENEFICIAL_STATUSES).toContain('encore');
    const bard = unit('bard');
    startPerformance(bard, ab('bd_battle_hymn'));
    CombatEngine.cleanse(bard);
    expect(has(bard, 'encore')).toBe(true);
    JobSystem.resetForBattle(bard, 0, 0);
    expect(bard.performing).toBeUndefined();
    expect(has(bard, 'encore')).toBe(false);
  });

  it('everyone caught in a performance takes its full effect (no splash reduction)', () => {
    const d = unit('dancer', 'player', 4, 4), foe = unit('knight', 'enemy', 4, 6, 6);
    const waltz = ab('dn_blade_waltz');
    const full = CombatEngine.getForecast(d, foe, waltz, 1, 1, 'grass', false).expectedDamage;
    expect(full).toBeGreaterThan(0);
    // The planner and the battle screen pass isSplash = false for performances: check the rule they follow
    expect(waltz.performance && waltz.aoe > 0).toBe(true);
  });
});

describe('the planner and performances', () => {
  it('an enemy Bard beside its wounded allies sings, centred on itself', () => {
    const grid = map();
    const bard = unit('bard', 'enemy', 4, 2);
    const a1 = unit('knight', 'enemy', 4, 3), a2 = unit('archer', 'enemy', 3, 2);
    a1.currentHp = Math.round(a1.maxHp * 0.4); a2.currentHp = Math.round(a2.maxHp * 0.4);
    const foe = unit('knight', 'player', 4, 8);
    bard.move = 0;
    const plan = planTurn(bard, [bard, a1, a2, foe], grid);
    expect(plan.ability?.performance).toBe(true);
    expect(plan.targetTile).toEqual({ x: bard.x, z: bard.z });
  });

  it('a performer still playing holds its ground rather than wander toward a foe out of reach', () => {
    const grid = map(14);
    const foe = unit('knight', 'player', 4, 13);
    const d = unit('dancer', 'enemy', 4, 2);
    expect(planTurn(d, [d, foe], grid).moveTo).not.toEqual({ x: 4, z: 2 }); // not performing: it advances
    startPerformance(d, ab('dn_blade_waltz'));
    expect(planTurn(d, [d, foe], grid).moveTo).toEqual({ x: 4, z: 2 });
  });

  it('but a performer still breaks off for a clearly better blow', () => {
    const grid = map();
    const d = unit('dancer', 'enemy', 4, 2);
    startPerformance(d, ab('dn_blade_waltz'));
    const foe = unit('archer', 'player', 4, 6, 1);
    foe.currentHp = 5;
    const plan = planTurn(d, [d, foe], grid);
    expect(plan.ability).not.toBeNull();
    expect(plan.moveTo).not.toEqual({ x: 4, z: 2 }); // leaves the spot to finish the wounded archer
  });
});

describe('the new reactions', () => {
  it('Healing Refrain: a blow may bring Regen, never twice', () => {
    const bard = unit('bard'), foe = unit('squire', 'enemy', 0, 1, 1);
    bard.equippedAbilities.reaction = 'bd_refrain';
    const r = act(foe, bard, ab('basic_attack'), () => 0);
    expect(r.reaction?.type).toBe('refrain');
    expect(has(bard, 'regen')).toBe(true);
    const again = act(foe, bard, ab('basic_attack'), () => 0);
    expect(again.reaction).toBeUndefined();
  });

  it('Captivate: a melee attacker may fall asleep; a ranged one never does', () => {
    const d = unit('dancer', 'player', 0, 0), melee = unit('squire', 'enemy', 0, 1, 1), archer = unit('archer', 'enemy', 0, 4, 1);
    d.equippedAbilities.reaction = 'dn_captivate';
    const r = act(melee, d, ab('basic_attack'), () => 0);
    expect(r.reaction?.type).toBe('captivate');
    expect(has(melee, 'sleep')).toBe(true);
    const shot = CombatEngine.executeAttack(CombatEngine.getForecast(archer, d, ab('basic_attack'), 1, 1, 'grass'), () => 0);
    expect(shot.reaction?.type).not.toBe('captivate');
    expect(has(archer, 'sleep')).toBe(false);
  });
});

describe('the Trials', () => {
  it('Bards and Dancers turn up among the enemies', () => {
    const jobs = new Set<string>();
    for (let f = 1; f <= 60; f++) for (const e of buildTrialFloor(f).enemyRoster) jobs.add(e.jobId);
    expect(jobs.has('bard')).toBe(true);
    expect(jobs.has('dancer')).toBe(true);
  });
});

describe('job changes (0.22.0)', () => {
  it('a unit never holds more HP or MP than its new job allows', () => {
    const u = unit('knight');
    u.currentHp = u.maxHp; u.currentMp = u.maxMp;
    JobSystem.grantPrerequisites(u, 'dancer');
    JobSystem.changeJob(u, 'dancer');
    expect(u.currentHp).toBeLessThanOrEqual(u.maxHp);
    expect(u.currentMp).toBeLessThanOrEqual(u.maxMp);
  });
});
