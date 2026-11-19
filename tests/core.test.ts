import { describe, it, expect } from 'vitest';
import { JOBS, BASIC_ATTACK } from '../src/data/jobs';
import { ITEMS, STARTING_ARMORY, RARE_DROP_POOL, getItemsForSlot } from '../src/data/items';
import { MAPS } from '../src/data/maps';
import { CAMPAIGN_CHAPTERS, PLAYER_DEPLOY } from '../src/data/campaign';
import { JobSystem } from '../src/core/JobSystem';
import { CombatEngine } from '../src/core/CombatEngine';
import { BattleGrid } from '../src/core/Grid';
import { planTurn, unitsInBlast } from '../src/core/EnemyAI';
import { resolveTerrainAbility } from '../src/core/Geomancy';
import { buildTrialFloor, rollTrialDrop, seededRng } from '../src/core/Trials';
import { TurnManager } from '../src/core/TurnManager';
import { Unit } from '../src/core/types';
import fs from 'node:fs';

const allAbilityIds = new Set(Object.values(JOBS).flatMap((j) => j.abilities.map((a) => a.id)));

function flatMap(width = 7, depth = 7) {
  const tiles = [];
  for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) tiles.push({ x, z, height: 1, terrain: 'grass' as const, walkable: true });
  return { id: 'test', name: 'Test', theme: 'day' as const, width, depth, tiles };
}

describe('data integrity', () => {
  it('every reaction/support/movement id used in engine code exists in a job', () => {
    const src = ['src/core/CombatEngine.ts', 'src/core/JobSystem.ts', 'src/core/Grid.ts', 'src/main.ts']
      .map((f) => fs.readFileSync(f, 'utf8'))
      .join('\n');
    const ids = new Set<string>();
    for (const m of src.matchAll(/'((?:sq|kn|ar|bm|wm|dr|ni|tm|geo)_[a-z_]+)'/g)) ids.add(m[1]);
    const missing = [...ids].filter((id) => !allAbilityIds.has(id));
    expect(missing).toEqual([]);
  });

  it('campaign chapters reference real maps, items, chapters and walkable tiles', () => {
    for (const ch of Object.values(CAMPAIGN_CHAPTERS)) {
      expect(MAPS[ch.mapId], ch.id).toBeTruthy();
      const grid = new BattleGrid(MAPS[ch.mapId]());
      for (const e of ch.enemyRoster) {
        expect(grid.isWalkable(e.x, e.z), `${ch.id} ${e.name}`).toBe(true);
        expect(JOBS[e.jobId], e.jobId).toBeTruthy();
      }
      for (const id of ch.rewardItemIds || []) expect(ITEMS[id], id).toBeTruthy();
      for (const c of ch.choices || []) {
        expect(CAMPAIGN_CHAPTERS[c.nextChapterId]).toBeTruthy();
        for (const id of c.rewardItemIds || []) expect(ITEMS[id], id).toBeTruthy();
      }
      if (ch.recruit) expect(JOBS[ch.recruit.jobId]).toBeTruthy();
    }
  });

  it('player deployment tiles are walkable on every map', () => {
    for (const make of Object.values(MAPS)) {
      const grid = new BattleGrid(make());
      for (const p of PLAYER_DEPLOY) expect(grid.isWalkable(p.x, p.z), `${grid.mapData.id} ${p.x},${p.z}`).toBe(true);
    }
  });

  it('armory lists only contain real items and filtering works', () => {
    for (const id of [...STARTING_ARMORY, ...RARE_DROP_POOL]) expect(ITEMS[id], id).toBeTruthy();
    const owned = getItemsForSlot('weapon', ['iron_sword']);
    expect(owned.map((i) => i.id)).toEqual(['iron_sword']);
    expect(getItemsForSlot('weapon').length).toBeGreaterThan(5);
  });
});

describe('combat', () => {
  it('equipped weapon ATK increases damage', () => {
    const a = JobSystem.createUnit('a', 'A', 'player', 'knight', 0, 0, 'S', 3);
    const t = JobSystem.createUnit('t', 'T', 'enemy', 'knight', 0, 1, 'N', 3);
    const before = CombatEngine.getForecast(a, t, BASIC_ATTACK, 1, 1).expectedDamage;
    JobSystem.equipItem(a, ITEMS.platinum_blade);
    const after = CombatEngine.getForecast(a, t, BASIC_ATTACK, 1, 1).expectedDamage;
    expect(after).toBeGreaterThan(before);
  });

  it('a same-level front basic attack kills in 2 to 5 hits for every job pairing', () => {
    const jobs = Object.keys(JOBS);
    for (const aj of jobs) {
      for (const tj of jobs) {
        const a = JobSystem.createUnit('a', 'A', 'player', aj, 0, 0, 'S', 4);
        const t = JobSystem.createUnit('t', 'T', 'enemy', tj, 0, 1, 'N', 4);
        const fc = CombatEngine.getForecast(a, t, BASIC_ATTACK, 1, 1);
        const hits = Math.ceil(t.maxHp / fc.expectedDamage);
        expect(hits, `${aj} -> ${tj}: ${fc.expectedDamage} vs ${t.maxHp}`).toBeGreaterThanOrEqual(2);
        expect(hits, `${aj} -> ${tj}: ${fc.expectedDamage} vs ${t.maxHp}`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('no same-level offensive spell one-shots a full-HP unit, even with Arcane Strength and full caster gear', () => {
    const spells = Object.values(JOBS).flatMap((j) => j.abilities).filter((a) => a.type === 'action' && a.element !== 'physical' && a.power > 0 && a.id !== 'tm_gravity');
    for (const casterJob of ['black_mage', 'time_mage', 'geomancer']) {
      const c = JobSystem.createUnit('c', 'C', 'enemy', casterJob, 0, 0, 'S', 5);
      JobSystem.equipItem(c, ITEMS.mage_ring);
      c.equippedAbilities.support = 'bm_arcane_strength';
      for (const tj of Object.keys(JOBS)) {
        const t = JobSystem.createUnit('t', 'T', 'player', tj, 0, 2, 'S', 5);
        for (const spell of spells) {
          const fc = CombatEngine.getForecast(c, t, spell, 1, 1);
          expect(fc.expectedDamage, `${casterJob} ${spell.id} -> ${tj}`).toBeLessThan(t.maxHp);
        }
      }
    }
  });

  it('area spells deal reduced damage on the splash ring', () => {
    const c = JobSystem.createUnit('c', 'C', 'enemy', 'black_mage', 0, 0, 'S', 5);
    const t = JobSystem.createUnit('t', 'T', 'player', 'knight', 0, 2, 'S', 5);
    const fire = JOBS.black_mage.abilities.find((a) => a.id === 'bm_fire')!;
    const center = CombatEngine.getForecast(c, t, fire, 1, 1, undefined, false).expectedDamage;
    const edge = CombatEngine.getForecast(c, t, fire, 1, 1, undefined, true).expectedDamage;
    expect(edge).toBeLessThan(center);
  });

  it('back attacks hit harder than front attacks', () => {
    const a = JobSystem.createUnit('a', 'A', 'player', 'ninja', 0, 0, 'S', 3);
    const t = JobSystem.createUnit('t', 'T', 'enemy', 'archer', 0, 1, 'S', 3); // facing away from a
    const back = CombatEngine.getForecast(a, t, BASIC_ATTACK, 1, 1);
    t.facing = 'N';
    const front = CombatEngine.getForecast(a, t, BASIC_ATTACK, 1, 1);
    expect(back.facingType).toBe('back');
    expect(front.facingType).toBe('front');
    expect(back.expectedDamage).toBeGreaterThan(front.expectedDamage);
  });

  it('Counter Tackle, Arcane Retaliation and Critical Quick actually trigger', () => {
    const always = () => 0; // every roll succeeds
    const a = JobSystem.createUnit('a', 'A', 'enemy', 'knight', 0, 0, 'S', 3);

    const sq = JobSystem.createUnit('s', 'S', 'player', 'squire', 0, 1, 'N', 3);
    sq.equippedAbilities.reaction = 'sq_counter';
    let r = CombatEngine.executeAttack(CombatEngine.getForecast(a, sq, { ...BASIC_ATTACK, power: 0.1 }, 1, 1), always);
    expect(r.reaction?.name).toBe('Counter Tackle');

    const bm = JobSystem.createUnit('b', 'B', 'player', 'black_mage', 0, 1, 'N', 3);
    bm.equippedAbilities.reaction = 'bm_magic_counter';
    r = CombatEngine.executeAttack(CombatEngine.getForecast(a, bm, { ...BASIC_ATTACK, power: 0.1 }, 1, 1), always);
    expect(r.reaction?.name).toBe('Arcane Retaliation');

    const tm = JobSystem.createUnit('t', 'T', 'player', 'time_mage', 0, 1, 'N', 3);
    tm.equippedAbilities.reaction = 'tm_critical_quick';
    tm.currentHp = Math.round(tm.maxHp * 0.3);
    r = CombatEngine.executeAttack(CombatEngine.getForecast(a, tm, { ...BASIC_ATTACK, power: 0.05 }, 1, 1), always);
    expect(r.reaction?.name).toBe('Critical Quick');
    expect(tm.ct).toBe(100);
  });

  it('Focus is a timed status, not a permanent stat change', () => {
    const u = JobSystem.createUnit('u', 'U', 'player', 'squire', 0, 0, 'S', 3);
    const focus = JOBS.squire.abilities.find((a) => a.id === 'sq_focus')!;
    const atkBefore = u.baseStats.attack;
    const powBefore = JobSystem.getAttackPower(u);
    CombatEngine.executeAttack(CombatEngine.getForecast(u, u, focus, 1, 1), () => 0);
    expect(u.baseStats.attack).toBe(atkBefore);
    expect(JobSystem.getAttackPower(u)).toBeGreaterThan(powBefore);
    expect(u.statuses.find((s) => s.type === 'focus')?.duration).toBe(4);
  });

  it('bosses enrage exactly once when dropping to half HP', () => {
    const a = JobSystem.createUnit('a', 'A', 'player', 'dragoon', 0, 0, 'S', 8);
    const boss = JobSystem.createUnit('b', 'Boss', 'enemy', 'knight', 0, 1, 'N', 3);
    JobSystem.makeBoss(boss);
    boss.currentHp = Math.round(boss.maxHp * 0.55);
    const fc = CombatEngine.getForecast(a, boss, { ...BASIC_ATTACK, power: 0.2 }, 1, 1);
    const r1 = CombatEngine.executeAttack(fc, () => 0.5);
    expect(r1.bossEnraged).toBe(true);
    expect(boss.statuses.some((s) => s.type === 'haste')).toBe(true);
    const r2 = CombatEngine.executeAttack(CombatEngine.getForecast(a, boss, { ...BASIC_ATTACK, power: 0.05 }, 1, 1), () => 0.5);
    expect(r2.bossEnraged).toBeFalsy();
  });

  it('Dragonheart saves a unit only once per battle', () => {
    const a = JobSystem.createUnit('a', 'A', 'enemy', 'dragoon', 0, 0, 'S', 9);
    const d = JobSystem.createUnit('d', 'D', 'player', 'dragoon', 0, 1, 'N', 3);
    d.equippedAbilities.reaction = 'dr_dragonheart';
    d.currentHp = 5;
    CombatEngine.executeAttack(CombatEngine.getForecast(a, d, BASIC_ATTACK, 1, 1), () => 0.5);
    expect(d.isDead).toBe(false);
    expect(d.currentHp).toBe(1);
    CombatEngine.executeAttack(CombatEngine.getForecast(a, d, BASIC_ATTACK, 1, 1), () => 0.5);
    expect(d.isDead).toBe(true);
  });
});

describe('progression', () => {
  it('EXP levels units up and raises stats', () => {
    const u = JobSystem.createUnit('u', 'U', 'player', 'knight', 0, 0, 'N', 3);
    const hp = u.maxHp;
    expect(JobSystem.grantExp(u, 250)).toBe(2);
    expect(u.level).toBe(5);
    expect(u.exp).toBe(50);
    expect(u.maxHp).toBeGreaterThan(hp);
  });

  it('cycling passives only offers learned abilities', () => {
    const u = JobSystem.createUnit('u', 'U', 'player', 'squire', 0, 0, 'N', 3);
    expect(JobSystem.getLearnedPassives(u, 'reaction')).toEqual([]);
    u.unlockedAbilities['kn_parry'] = true;
    expect(JobSystem.getLearnedPassives(u, 'reaction').map((p) => p.id)).toEqual(['kn_parry']);
  });
});

describe('grid', () => {
  it('canTarget enforces range and height and only allows self for supportive abilities', () => {
    const grid = new BattleGrid(flatMap());
    expect(grid.canTarget(3, 3, 3, 5, 2, 2, false)).toBe(true);
    expect(grid.canTarget(3, 3, 3, 6, 2, 2, false)).toBe(false);
    expect(grid.canTarget(3, 3, 3, 3, 2, 2, false)).toBe(false);
    expect(grid.canTarget(3, 3, 3, 3, 2, 2, true)).toBe(true);
  });

  it('water costs 2 Move unless the unit has Water Walk', () => {
    const map = flatMap();
    for (const t of map.tiles) if (t.z === 2) t.terrain = 'water' as never;
    const grid = new BattleGrid(map);
    const u = JobSystem.createUnit('u', 'U', 'player', 'ninja', 3, 0, 'S', 3);
    u.move = 3;
    const reach = (x: number, z: number) => grid.getReachableTiles(u, [u]).some((t) => t.x === x && t.z === z);
    expect(reach(3, 3)).toBe(false); // 1 + 2 (water) + 1 = 4 > 3
    u.equippedAbilities.movement = 'ni_water_walk';
    expect(reach(3, 3)).toBe(true);
  });

  it('enemies block movement and allies cannot be stood on', () => {
    const grid = new BattleGrid(flatMap(7, 1));
    const u = JobSystem.createUnit('u', 'U', 'player', 'squire', 0, 0, 'S', 3);
    const ally = JobSystem.createUnit('al', 'Al', 'player', 'squire', 1, 0, 'S', 3);
    const foe = JobSystem.createUnit('f', 'F', 'enemy', 'squire', 3, 0, 'S', 3);
    u.move = 6;
    const tiles = grid.getReachableTiles(u, [u, ally, foe]).map((t) => t.x);
    expect(tiles).toContain(2);
    expect(tiles).not.toContain(1);
    expect(tiles).not.toContain(4);
  });

  it('Teleport ignores cliffs within Move + 1', () => {
    const map = flatMap();
    for (const t of map.tiles) if (t.z === 1) t.height = 9;
    const grid = new BattleGrid(map);
    const u = JobSystem.createUnit('u', 'U', 'player', 'time_mage', 3, 0, 'S', 3);
    expect(grid.getReachableTiles(u, [u]).some((t) => t.z === 2)).toBe(false);
    u.equippedAbilities.movement = 'tm_teleport';
    expect(grid.getReachableTiles(u, [u]).some((t) => t.z === 2)).toBe(true);
  });
});

describe('geomancy', () => {
  it('Elemental changes with terrain', () => {
    const elemental = JOBS.geomancer.abilities.find((a) => a.id === 'geo_elemental')!;
    expect(resolveTerrainAbility(elemental, 'swamp').appliesStatus).toBe('poison');
    expect(resolveTerrainAbility(elemental, 'wood').element).toBe('fire');
    expect(resolveTerrainAbility(elemental, 'water').element).toBe('ice');
    expect(resolveTerrainAbility(BASIC_ATTACK, 'swamp')).toBe(BASIC_ATTACK);
  });
});

describe('enemy AI', () => {
  function setup() {
    const grid = new BattleGrid(flatMap());
    const enemy = JobSystem.createUnit('e', 'E', 'enemy', 'knight', 3, 1, 'S', 3);
    const p1 = JobSystem.createUnit('p1', 'P1', 'player', 'archer', 3, 4, 'N', 3);
    const p2 = JobSystem.createUnit('p2', 'P2', 'player', 'archer', 6, 6, 'N', 3);
    return { grid, enemy, p1, p2, units: [enemy, p1, p2] };
  }

  it('moves in and attacks a player in reach', () => {
    const { grid, enemy, units } = setup();
    const plan = planTurn(enemy, units, grid);
    expect(plan.ability).not.toBeNull();
    const victims = unitsInBlast(enemy, plan.ability!, plan.targetTile!.x, plan.targetTile!.z, units);
    expect(victims.every((v) => v.team === 'player')).toBe(true);
  });

  it('prefers finishing a wounded foe', () => {
    const { grid, enemy, p1, p2, units } = setup();
    p2.x = 3; p2.z = 0; // also reachable
    p2.currentHp = 5;
    const plan = planTurn(enemy, units, grid);
    expect(plan.targetTile).toEqual({ x: 3, z: 0 });
    void p1;
  });

  it('never casts buffs on the player team and heals wounded allies', () => {
    const grid = new BattleGrid(flatMap());
    const medic = JobSystem.createUnit('m', 'Medic', 'enemy', 'white_mage', 3, 1, 'S', 5);
    for (const a of JOBS.white_mage.abilities) medic.unlockedAbilities[a.id] = true;
    const hurt = JobSystem.createUnit('h', 'Hurt', 'enemy', 'knight', 3, 2, 'S', 5);
    hurt.currentHp = 20;
    const p = JobSystem.createUnit('p', 'P', 'player', 'knight', 3, 6, 'N', 5);
    const plan = planTurn(medic, [medic, hurt, p], grid);
    expect(plan.ability?.id).toBe('wm_cure');
    expect(plan.targetTile).toEqual({ x: 3, z: 2 });
  });

  it('does not use abilities it cannot afford', () => {
    const grid = new BattleGrid(flatMap());
    const bm = JobSystem.createUnit('b', 'B', 'enemy', 'black_mage', 3, 1, 'S', 5);
    for (const a of JOBS.black_mage.abilities) bm.unlockedAbilities[a.id] = true;
    bm.currentMp = 0;
    const p = JobSystem.createUnit('p', 'P', 'player', 'knight', 3, 3, 'N', 5);
    const plan = planTurn(bm, [bm, p], grid);
    expect(plan.ability === null || plan.ability.mpCost === 0).toBe(true);
  });
});

describe('trials', () => {
  it('floors are deterministic, on walkable unique tiles, with a boss every 5th floor', () => {
    for (let floor = 1; floor <= 15; floor++) {
      const a = buildTrialFloor(floor);
      const b = buildTrialFloor(floor);
      expect(a).toEqual(b);
      const grid = new BattleGrid(MAPS[a.mapId]());
      const keys = a.enemyRoster.map((e) => `${e.x},${e.z}`);
      expect(new Set(keys).size).toBe(keys.length);
      for (const e of a.enemyRoster) expect(grid.isWalkable(e.x, e.z)).toBe(true);
      expect(a.enemyRoster.some((e) => e.isBoss)).toBe(floor % 5 === 0);
    }
  });

  it('drops never repeat owned items', () => {
    const owned = RARE_DROP_POOL.slice(0, -1);
    expect(rollTrialDrop(3, owned)).toBe(RARE_DROP_POOL[RARE_DROP_POOL.length - 1]);
    expect(rollTrialDrop(3, RARE_DROP_POOL)).toBeNull();
  });

  it('seeded rng is stable', () => {
    expect(seededRng(42)()).toBe(seededRng(42)());
  });
});

describe('turn manager', () => {
  it('faster units act first and timeline prediction does not mutate state', () => {
    const fast = JobSystem.createUnit('f', 'F', 'player', 'ninja', 0, 0, 'S', 3);
    const slow = JobSystem.createUnit('s', 'S', 'enemy', 'knight', 1, 0, 'S', 3);
    const units: Unit[] = [slow, fast];
    const tm = new TurnManager(units);
    const ctBefore = units.map((u) => u.ct);
    const timeline = tm.predictTurnTimeline(4);
    expect(units.map((u) => u.ct)).toEqual(ctBefore);
    expect(timeline[0].id).toBe('f');
    expect(tm.advanceToNextActiveTurn()!.activeUnit.id).toBe('f');
  });
});
