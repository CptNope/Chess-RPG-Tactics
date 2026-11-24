/**
 * 0.24.0: summons. Every Summoner call gets its own creature on screen, and three grand summons
 * (Cinderwing, Tidewyrm, Elder Wyrm) arrive at the start of the caster's next turn.
 */
import { describe, it, expect } from 'vitest';
import { JOBS } from '../src/data/jobs';
import { SIGNATURES } from '../src/data/signatures';
import { MapData } from '../src/data/maps';
import { JobSystem } from '../src/core/JobSystem';
import { CombatEngine } from '../src/core/CombatEngine';
import { BattleGrid } from '../src/core/Grid';
import { TurnManager } from '../src/core/TurnManager';
import { planTurn, summonVictims } from '../src/core/EnemyAI';
import { noFalloff } from '../src/core/Performance';
import {
  CALLING_TURNS, ENEMY_GRAND_SUMMON_LEVEL, breakCall, callArea, callDue, callHolds, callsLandingOn, rebirthOf, startCall
} from '../src/core/Summons';
import { SUMMON_EFFECTS } from '../src/renderer/fx/summons/index.js';
import { createFx, createFrame } from '../src/vendor/pixelfx/registry.js';
import { Ability, Unit } from '../src/core/types';

function unit(job: string, team: 'player' | 'enemy' = 'player', x = 0, z = 0, level = 8): Unit {
  const u = JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
  for (const a of JOBS[job].abilities) u.unlockedAbilities[a.id] = true;
  return u;
}
const ab = (id: string) => JobSystem.findAbility(id) as Ability;
function map(size = 11): BattleGrid {
  const tiles = [];
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) tiles.push({ x, z, height: 1, terrain: 'grass', walkable: true });
  return new BattleGrid({ id: 'flat', name: 'Flat', width: size, depth: size, tiles } as unknown as MapData);
}
const GRAND = ['su_cinderwing', 'su_tidewyrm', 'su_elder_wyrm'];

describe('summon data', () => {
  it('every Summoner call and Celestial Call names a creature that has an effect', () => {
    const summons = JOBS.summoner.abilities.filter((a) => a.type === 'action');
    expect(summons.length).toBe(8);
    for (const a of [...summons, SIGNATURES.summoner]) {
      expect(a.summon, a.id).toBeTruthy();
      expect(SUMMON_EFFECTS[`summon/${a.summon}`], a.id).toBeTruthy();
    }
    expect(Object.keys(SUMMON_EFFECTS).length).toBe(9);
  });

  it('the grand summons are charged, cost the most and need the most JP', () => {
    const grand = JOBS.summoner.abilities.filter((a) => a.charge).map((a) => a.id);
    expect(grand).toEqual(GRAND);
    const others = JOBS.summoner.abilities.filter((a) => a.type === 'action' && !a.charge);
    for (const id of GRAND) {
      const a = ab(id);
      expect(a.mpCost, id).toBeGreaterThan(Math.max(...others.map((o) => o.mpCost)));
      expect(a.jpCost, id).toBeGreaterThan(Math.max(...others.map((o) => o.jpCost)));
      expect(noFalloff(a), id).toBe(true);
    }
    expect(ab('su_tidewyrm').aoe).toBe(3);
    expect(ab('su_cinderwing').rebirth).toBeGreaterThan(0);
  });

  it('enemies call grand summons only from level 6', () => {
    for (const [level, has] of [[ENEMY_GRAND_SUMMON_LEVEL - 1, false], [ENEMY_GRAND_SUMMON_LEVEL, true]] as const) {
      const e = JobSystem.createUnit('e', 'Caller', 'enemy', 'summoner', 0, 0, 'S', level);
      JobSystem.equipVeteranPassives(e);
      expect(!!e.unlockedAbilities.su_tidewyrm, `level ${level}`).toBe(has);
      expect(!!e.unlockedAbilities.su_salamander, `level ${level}`).toBe(true);
    }
  });
});

describe('calling a grand summon', () => {
  it('lands at the start of the caster\'s next turn, once', () => {
    const s = unit('summoner');
    startCall(s, ab('su_tidewyrm'), 5, 6);
    expect(s.calling).toEqual({ abilityId: 'su_tidewyrm', x: 5, z: 6 });
    expect(s.statuses.find((x) => x.type === 'calling')?.duration).toBe(CALLING_TURNS);
    // the turn it was called on ends
    TurnManager.tickStatuses(s);
    expect(callHolds(s)).toBe(true);
    const due = callDue(s);
    expect(due).not.toBe('broken');
    expect(due && due !== 'broken' && due.ability.id).toBe('su_tidewyrm');
    expect(due && due !== 'broken' && [due.x, due.z]).toEqual([5, 6]);
    expect(s.calling).toBeUndefined();
    expect(s.statuses.some((x) => x.type === 'calling')).toBe(false);
    expect(callDue(s)).toBeNull();
  });

  it('is broken by Sleep, Silence or a KO', () => {
    for (const how of ['sleep', 'silence', 'ko'] as const) {
      const s = unit('summoner');
      startCall(s, ab('su_elder_wyrm'), 3, 3);
      if (how === 'ko') {
        s.isDead = true;
        expect(callHolds(s), how).toBe(false);
        expect(callDue(s), how).toBe('broken');
      } else {
        CombatEngine.applyStatus(s, how);
        expect(s.calling, how).toBeUndefined();
        expect(callDue(s), how).toBeNull();
      }
    }
    const s = unit('summoner');
    startCall(s, ab('su_tidewyrm'), 1, 1);
    expect(breakCall(s)).toBe(true);
    expect(breakCall(s)).toBe(false);
  });

  it('a raised caller has no call left, and a new battle starts clean', () => {
    const s = unit('summoner');
    startCall(s, ab('su_tidewyrm'), 1, 1);
    s.isDead = true;
    s.currentHp = 0;
    const w = unit('white_mage');
    CombatEngine.executeAttack(CombatEngine.getForecast(w, s, ab('wm_raise'), 1, 1, 'grass'), () => 0.5);
    expect(s.isDead).toBe(false);
    expect(s.calling).toBeUndefined();
    startCall(s, ab('su_tidewyrm'), 1, 1);
    JobSystem.resetForBattle(s, 0, 0);
    expect(s.calling).toBeUndefined();
  });

  it('marks the tiles within its radius, on the board', () => {
    const s = unit('summoner');
    startCall(s, ab('su_tidewyrm'), 5, 5);
    expect(callArea(s, 11, 11).length).toBe(25);
    startCall(s, ab('su_tidewyrm'), 0, 0);
    expect(callArea(s, 11, 11).length).toBe(10);
    startCall(s, ab('su_elder_wyrm'), 5, 5);
    expect(callArea(s, 11, 11).length).toBe(13);
  });

  it('only a foe\'s damaging call counts as danger', () => {
    const caller = unit('summoner', 'enemy', 8, 8);
    const ally = unit('knight', 'enemy', 1, 1);
    const foe = unit('knight', 'player', 2, 2);
    const units = [caller, ally, foe];
    startCall(caller, ab('su_elder_wyrm'), 2, 2);
    expect(callsLandingOn(foe, 2, 3, units)).toBe(1);
    expect(callsLandingOn(foe, 6, 6, units)).toBe(0);
    expect(callsLandingOn(ally, 2, 3, units)).toBe(0); // its own side's call
    startCall(caller, ab('su_cinderwing'), 2, 2);
    expect(callsLandingOn(foe, 2, 2, units)).toBe(0); // a healing call is no threat
  });

  it('hits everyone in the area at full force, and rarely misses', () => {
    const s = unit('summoner');
    const t = unit('knight', 'enemy');
    const centre = CombatEngine.getForecast(s, t, ab('su_tidewyrm'), 1, 1, 'grass', false);
    const edge = CombatEngine.getForecast(s, t, ab('su_tidewyrm'), 1, 1, 'grass', noFalloff(ab('su_tidewyrm')) ? false : true);
    expect(edge.expectedDamage).toBe(centre.expectedDamage);
    const plain = CombatEngine.getForecast(s, t, { ...ab('su_tidewyrm'), charge: undefined }, 1, 1, 'grass', false);
    expect(centre.hitChance).toBe(Math.min(100, plain.hitChance + 30));
  });
});

describe('Cinderwing', () => {
  it('heals the living and raises the fallen in its area', () => {
    const s = unit('summoner', 'player', 0, 0);
    const hurt = unit('knight', 'player', 4, 4);
    hurt.currentHp = Math.round(hurt.maxHp / 3);
    const fallen = unit('archer', 'player', 5, 4);
    fallen.isDead = true;
    fallen.currentHp = 0;
    const far = unit('monk', 'player', 9, 9);
    far.isDead = true;
    const foe = unit('knight', 'enemy', 4, 5);
    const cw = ab('su_cinderwing');
    const victims = summonVictims(s, cw, 4, 4, [s, hurt, fallen, far, foe]);
    expect(victims.map((v) => v.unit.id).sort()).toEqual([hurt.id, fallen.id].sort());
    const raise = victims.find((v) => v.unit === fallen)!.ability;
    expect(raise.revive).toBe(cw.rebirth);
    expect(rebirthOf(cw)?.power).toBe(0);
    const before = hurt.currentHp;
    for (const v of victims) CombatEngine.executeAttack(CombatEngine.getForecast(s, v.unit, v.ability, 1, 1, 'grass'), () => 0.5);
    expect(hurt.currentHp).toBeGreaterThan(before);
    expect(fallen.isDead).toBe(false);
    expect(fallen.currentHp).toBe(Math.round(fallen.maxHp * cw.rebirth!));
    expect(far.isDead).toBe(true);
  });
});

describe('the AI and grand summons', () => {
  it('walks out of the area a foe\'s grand summon is about to land on', () => {
    const grid = map();
    const caller = unit('summoner', 'player', 0, 10);
    const knight = unit('knight', 'enemy', 5, 5);
    const target = unit('archer', 'player', 10, 0);
    const units = [caller, knight, target];
    startCall(caller, ab('su_elder_wyrm'), 5, 5);
    const plan = planTurn(knight, units, grid);
    expect(Math.abs(plan.moveTo.x - 5) + Math.abs(plan.moveTo.z - 5)).toBeGreaterThan(2);
  });

  it('a veteran enemy Summoner calls a grand summon on a crowd', () => {
    const grid = map();
    const caller = unit('summoner', 'enemy', 1, 1, 9);
    JobSystem.equipVeteranPassives(caller);
    caller.currentMp = caller.maxMp;
    const squad = [[5, 5], [5, 6], [6, 5], [4, 5], [5, 4]].map(([x, z], i) => {
      const u = unit(['knight', 'archer', 'monk', 'white_mage', 'squire'][i], 'player', x, z, 6);
      return u;
    });
    const plan = planTurn(caller, [caller, ...squad], grid);
    expect(plan.ability?.summon).toBeTruthy();
  });

  it('never counts a raise it is not allowed', () => {
    const grid = map();
    const caller = unit('summoner', 'enemy', 1, 1, 9);
    JobSystem.equipVeteranPassives(caller);
    const fallen = unit('knight', 'enemy', 3, 3);
    fallen.isDead = true;
    const foe = unit('archer', 'player', 9, 9);
    const plan = planTurn(caller, [caller, fallen, foe], grid, { noRevive: true });
    expect(plan.ability?.rebirth).toBeFalsy();
  });
});

describe('summon effects', () => {
  it('every creature draws from start to finish, lands within its duration and covers its area', () => {
    for (const [id, mod] of Object.entries(SUMMON_EFFECTS)) {
      const meta = mod.meta as { size: [number, number]; origin: [number, number]; duration: number; impact: number };
      expect(meta.impact, id).toBeGreaterThan(0.5);
      expect(meta.impact, id).toBeLessThan(meta.duration);
      const [w, h] = meta.size;
      for (const radius of [2, 3]) {
        const fx = createFx(mod, { x: meta.origin[0], y: meta.origin[1], radius });
        const frame = createFrame(w, h);
        let lit = 0;
        for (let t = 0; t < meta.duration; t += 0.2) {
          fx.update(0.2);
          frame.color.fill(0);
          frame.light.fill(0);
          fx.draw(frame, 'front');
          lit += frame.color.reduce((n: number, c: number) => n + (c ? 1 : 0), 0);
        }
        expect(lit, id).toBeGreaterThan(1000);
        expect(fx.done(), id).toBe(true);
      }
    }
  });
});
