/**
 * 0.26.0: monsters. Enemies with bodies and abilities of their own, never a squad member's job.
 */
import { describe, it, expect } from 'vitest';
import { JOBS, PLAYER_JOB_IDS, isMonsterJob } from '../src/data/jobs';
import { MONSTERS } from '../src/data/monsters';
import { ITEMS } from '../src/data/items';
import { MapData } from '../src/data/maps';
import { JobSystem } from '../src/core/JobSystem';
import { CombatEngine, guardsAgainst } from '../src/core/CombatEngine';
import { BattleGrid } from '../src/core/Grid';
import { planTurn } from '../src/core/EnemyAI';
import { SKIRMISHES, buildSkirmish, skirmishOpen } from '../src/core/Skirmish';
import { WORLD_NODES, WORLD_ROADS } from '../src/core/World';
import { UNIQUE_ITEMS } from '../src/core/Economy';
import { TRIAL_MONSTERS_FROM, buildTrialFloor } from '../src/core/Trials';
import { recruitJobs } from '../src/core/Recruits';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { Unit } from '../src/core/types';

const IDS = ['wolf', 'wyvern', 'ooze', 'wisp', 'brute', 'basilisk', 'bone_knight', 'thornling', 'salamander', 'frost_sprite', 'bog_lurker'];
const make = (job: string, team: 'player' | 'enemy', x = 0, z = 0, level = 5): Unit => {
  const u = JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
  if (team === 'enemy') { JobSystem.equipVeteranPassives(u); JobSystem.applyGearStatuses(u); }
  return u;
};
function map(size = 10): BattleGrid {
  const tiles = [];
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) tiles.push({ x, z, height: 1, terrain: 'grass', walkable: true });
  return new BattleGrid({ id: 'flat', name: 'Flat', width: size, depth: size, tiles } as unknown as MapData);
}

describe('monsters', () => {
  it('are jobs marked as monsters, never a squad member\'s', () => {
    expect(Object.keys(MONSTERS)).toEqual(IDS);
    for (const id of IDS) {
      expect(JOBS[id]?.monster, id).toBe(true);
      expect(isMonsterJob(id)).toBe(true);
      expect(PLAYER_JOB_IDS).not.toContain(id);
    }
    expect(isMonsterJob('knight')).toBe(false);
    const squire = make('squire', 'player');
    for (const id of IDS) {
      JobSystem.grantPrerequisites(squire, id);
      expect(JobSystem.canChangeJob(squire, id), id).toBe(false);
    }
    expect(JobSystem.unlockedJobs(squire).some(isMonsterJob)).toBe(false);
    expect(recruitJobs(99).some(isMonsterJob)).toBe(false);
    expect(Object.keys(squire.jobPoints).some(isMonsterJob)).toBe(false);
  });

  it('know every action from level 1, wear nothing and can pay for something', () => {
    for (const id of IDS) {
      const u = JobSystem.createUnit('m', 'M', 'enemy', id, 0, 0, 'S', 1);
      const actions = JOBS[id].abilities;
      expect(actions.length, id).toBe(3);
      for (const a of actions) {
        expect(a.type, a.id).toBe('action');
        expect(a.jobId, a.id).toBe(id);
        expect(u.unlockedAbilities[a.id], a.id).toBe(true);
        expect(JobSystem.findAbility(a.id)?.id, a.id).toBe(a.id);
      }
      expect(Object.values(u.equipment).every((it) => !it), id).toBe(true);
      expect(actions.some((a) => a.mpCost <= u.maxMp), id).toBe(true);
      expect(JobSystem.canChangeJob(u, id), id).toBe(true); // it stays what it is
    }
  });

  it('have innate statuses and immunities in place of gear traits', () => {
    const ooze = make('ooze', 'enemy');
    expect(ooze.statuses.some((s) => s.type === 'regen')).toBe(true);
    expect(guardsAgainst(ooze, 'poison')).toBe(true);
    expect(CombatEngine.applyStatus(ooze, 'sleep')).toBe(false);
    expect(make('brute', 'enemy').statuses.some((s) => s.type === 'protect')).toBe(true);
    expect(CombatEngine.applyStatus(make('wisp', 'enemy'), 'sleep')).toBe(false);
    expect(CombatEngine.applyStatus(make('wyvern', 'enemy'), 'immobilize')).toBe(false);
    const wolf = make('wolf', 'enemy');
    expect(CombatEngine.applyStatus(wolf, 'slow')).toBe(true);
  });

  it('fight with their own kit: the wolf bites, the wisp burns from afar, the brute pounds a crowd', () => {
    const grid = map();
    const wolf = make('wolf', 'enemy', 5, 5);
    const knight = make('knight', 'player', 5, 7);
    const plan = planTurn(wolf, [wolf, knight], grid);
    expect(plan.ability?.jobId).toBe('wolf');
    expect(plan.targetTile).toEqual({ x: 5, z: 7 });

    const wisp = make('wisp', 'enemy', 1, 1);
    const archer = make('archer', 'player', 1, 5);
    const p2 = planTurn(wisp, [wisp, archer], grid);
    expect(['mon_wisp_flame', 'mon_lure', 'mon_drain_light']).toContain(p2.ability?.id);

    const brute = make('brute', 'enemy', 5, 5);
    const ring = [[4, 5], [6, 5], [5, 4]].map(([x, z], i) => make(['knight', 'monk', 'squire'][i], 'player', x, z));
    const p3 = planTurn(brute, [brute, ...ring], grid);
    expect(p3.ability?.id).toBe('mon_ground_pound');
  });
});

describe('where monsters are met', () => {
  it('the story: from Chapter II every battle has a monster, and someone warns you about it', () => {
    expect(CAMPAIGN_CHAPTERS.chapter_1.enemyRoster.some((e) => isMonsterJob(e.jobId))).toBe(false); // the tutorial stays human
    for (const id of ['chapter_2a', 'chapter_2b', 'chapter_3', 'chapter_4', 'chapter_5', 'chapter_6']) {
      const ch = CAMPAIGN_CHAPTERS[id];
      const beasts = ch.enemyRoster.filter((e) => isMonsterJob(e.jobId));
      expect(beasts.length, id).toBeGreaterThan(0);
      expect(beasts.some((e) => e.isBoss), id).toBe(false);
      const talk = ch.introDialogue.map((l) => l.text.toLowerCase()).join(' ');
      expect(/wisp|mud|wyvern|stone|bilge|lights/.test(talk), id).toBe(true);
      // never two enemies on one tile
      expect(new Set(ch.enemyRoster.map((e) => `${e.x},${e.z}`)).size, id).toBe(ch.enemyRoster.length);
    }
  });

  it('a monster stands up to a geared enemy of its level: natural stats in place of gear', () => {
    const wisp = make('wisp', 'enemy', 0, 0, 6), mage = make('black_mage', 'enemy', 0, 0, 6);
    expect(JobSystem.getMagicPower(wisp)).toBeGreaterThan(JobSystem.getMagicPower(mage) * 0.85);
    expect(make('wolf', 'enemy').evasion).toBeGreaterThan(10);
    expect(make('brute', 'enemy').maxHp).toBeGreaterThan(make('knight', 'enemy').maxHp);
    const lure = JobSystem.findAbility('mon_lure')!;
    expect(lure.accuracy).toBeLessThan(0);
    const target = make('knight', 'player', 0, 2);
    const plain = CombatEngine.getForecast(wisp, target, { ...lure, accuracy: undefined }, 1, 1);
    expect(CombatEngine.getForecast(wisp, target, lure, 1, 1).hitChance).toBe(Math.max(10, plain.hitChance + lure.accuracy!));
  });

  it('the Howling Hollow: a side battle of beasts after Chapter I, with a trophy of its own', () => {
    const def = SKIRMISHES.hollow;
    expect(def.jobs.every(([j]) => isMonsterJob(j))).toBe(true);
    expect(new Set(def.jobs.map(([j]) => j))).toEqual(new Set([...IDS.slice(0, 5), 'bog_lurker'])); // the lurker since 0.51.0
    expect(skirmishOpen('hollow', [])).toBe(false);
    expect(skirmishOpen('hollow', ['chapter_1'])).toBe(true);
    expect(ITEMS[def.trophy]).toBeTruthy();
    expect(UNIQUE_ITEMS).toContain(def.trophy);
    const node = WORLD_NODES.find((n) => n.skirmishId === 'hollow')!;
    expect(node).toBeTruthy();
    expect(WORLD_ROADS.some((r) => r.includes(node.id))).toBe(true);
    const battle = buildSkirmish('hollow', [4, 4, 4, 4], 0);
    expect(battle.enemyRoster.length).toBe(4);
    expect(battle.enemyRoster[0].jobId).toBe('wolf');
    expect(battle.enemyRoster.every((e) => isMonsterJob(e.jobId))).toBe(true);
  });

  it('the Trials: monsters join the floors from floor 3, and a floor is always the same fight', () => {
    for (let f = 1; f < TRIAL_MONSTERS_FROM; f++) expect(buildTrialFloor(f).enemyRoster.some((e) => isMonsterJob(e.jobId)), `floor ${f}`).toBe(false);
    const floors = Array.from({ length: 30 }, (_, i) => buildTrialFloor(TRIAL_MONSTERS_FROM + i));
    const counts = floors.map((f) => f.enemyRoster.filter((e) => isMonsterJob(e.jobId)).length);
    expect(counts.filter((n) => n > 0).length).toBeGreaterThan(10);
    for (const f of floors) {
      for (const e of f.enemyRoster) if (isMonsterJob(e.jobId)) { expect(e.isBoss).toBeFalsy(); expect(e.name).not.toMatch(/undefined/); }
    }
    expect(buildTrialFloor(7)).toEqual(buildTrialFloor(7));
  });
});
