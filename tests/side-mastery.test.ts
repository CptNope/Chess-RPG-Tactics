/**
 * 0.16.0: side battles on the world map, job mastery bonuses, and the White Mage's Raise.
 */
import { describe, it, expect } from 'vitest';
import { JOBS } from '../src/data/jobs';
import { MAPS, MapData } from '../src/data/maps';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { CONSUMABLES, consumableAbility } from '../src/data/consumables';
import { JobSystem, JOB_LEVEL_JP, JOB_MASTERY, MAX_JOB_LEVEL, VETERAN_JOB_LEVEL, masteryLabel } from '../src/core/JobSystem';
import { CombatEngine } from '../src/core/CombatEngine';
import { BattleGrid } from '../src/core/Grid';
import { planTurn, unitsInBlast } from '../src/core/EnemyAI';
import { clearBonus, victoryGil } from '../src/core/Economy';
import {
  SKIRMISHES, SKIRMISH_MAX_HEAT, buildSkirmish, sanitizeSkirmishWins, skirmishBonus, skirmishLevel, skirmishOpen
} from '../src/core/Skirmish';
import { WORLD_NODES, nodeState, openMissions, route, worldNode } from '../src/core/World';
import { Ability, Unit } from '../src/core/types';

function unit(job: string, team: 'player' | 'enemy' = 'player', x = 0, z = 0, level = 5): Unit {
  const u = JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
  for (const a of JOBS[job].abilities) u.unlockedAbilities[a.id] = true;
  return u;
}
function flatMap(size = 8): MapData {
  const tiles = [];
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) tiles.push({ x, z, height: 1, terrain: 'grass' as const, walkable: true });
  return { id: 'flat', name: 'Flat', width: size, depth: size, tiles } as unknown as MapData;
}
const raiseSpell = () => JobSystem.findAbility('wm_raise') as Ability;
const cast = (caster: Unit, target: Unit, ability: Ability) =>
  CombatEngine.executeAttack(CombatEngine.getForecast(caster, target, ability, 1, 1, 'grass'), () => 0.999);

describe('side battles', () => {
  it('every place is well formed and sits on the world map', () => {
    for (const [id, def] of Object.entries(SKIRMISHES)) {
      expect(def.id).toBe(id);
      expect(MAPS[def.mapId], id).toBeTruthy();
      expect(def.jobs.length).toBeGreaterThanOrEqual(4);
      for (const [job, title] of def.jobs) { expect(JOBS[job], `${id}/${job}`).toBeTruthy(); expect(title.length).toBeGreaterThan(2); }
      for (const c of def.opensAfter) expect(CAMPAIGN_CHAPTERS[c], `${id}/${c}`).toBeTruthy();
      const node = WORLD_NODES.find((n) => n.skirmishId === id);
      expect(node?.kind).toBe('skirmish');
      expect(node!.name).toBe(def.name);
      expect(route('market', node!.id).at(-1)).toBe(node!.id);
    }
    for (const n of WORLD_NODES.filter((w) => w.kind === 'skirmish')) expect(SKIRMISHES[n.skirmishId!]).toBeTruthy();
    // No two places share a spot (labels would collide)
    for (const a of WORLD_NODES) for (const b of WORLD_NODES) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}/${b.id}`).toBeGreaterThan(0.12);
  });

  it('open once the story reaches them, lock nothing, and never count as cleared', () => {
    expect(skirmishOpen('thornwood', [])).toBe(false);
    expect(skirmishOpen('thornwood', ['chapter_1'])).toBe(true);
    expect(skirmishOpen('shrine', ['chapter_1'])).toBe(false);
    expect(skirmishOpen('shrine', ['chapter_1', 'chapter_2b'])).toBe(true); // either road opens it
    expect(skirmishOpen('ridge', ['chapter_1', 'chapter_2a'])).toBe(true);
    expect(skirmishOpen('nowhere', ['chapter_1'])).toBe(false);
    const thornwood = worldNode('thornwood')!;
    expect(nodeState(thornwood, 'chapter_1', [], false)).toBe('locked');
    expect(nodeState(thornwood, 'chapter_1', ['chapter_1'], false)).toBe('open');
    expect(nodeState(thornwood, 'chapter_3', ['chapter_1', 'chapter_2a', 'chapter_3'], true)).toBe('open'); // still there after the story
  });

  it('follow the squad\'s level and heat up with each win, to a cap', () => {
    expect(skirmishLevel([3, 3, 3, 3], 0)).toBe(3);
    expect(skirmishLevel([3, 4, 4, 5], 0)).toBe(4);
    expect(skirmishLevel([5, 5, 5, 5], 1)).toBe(6);
    expect(skirmishLevel([5, 5, 5, 5], 99)).toBe(5 + SKIRMISH_MAX_HEAT);
    expect(skirmishLevel([], 0)).toBe(1);
    expect(skirmishBonus(0)).toBeGreaterThan(skirmishBonus(1));
    expect(skirmishBonus(1)).toBe(skirmishBonus(7));
  });

  it('build a fair, repeatable fight on walkable, unshared tiles', () => {
    for (const id of Object.keys(SKIRMISHES)) {
      for (const wins of [0, 1, 2, 5]) {
        const squad = [4, 4, 5, 5];
        const a = buildSkirmish(id, squad, wins), b = buildSkirmish(id, squad, wins);
        expect(a).toEqual(b);
        expect(a.id).toBe(`skirmish_${id}`);
        expect(a.introDialogue.length).toBe(1);
        expect(a.enemyRoster.length).toBe(wins >= SKIRMISH_MAX_HEAT ? 5 : 4);
        const map = MAPS[a.mapId]();
        const seen = new Set<string>();
        const level = skirmishLevel(squad, wins);
        a.enemyRoster.forEach((e, i) => {
          expect(JOBS[e.jobId]).toBeTruthy();
          expect(e.isBoss).toBeFalsy(); // side battles have a leader, not a boss
          expect(e.level).toBe(i === 0 ? level + 1 : level);
          const tile = map.tiles.find((t) => t.x === e.x && t.z === e.z);
          expect(tile?.walkable, `${id} ${e.x},${e.z}`).toBe(true);
          expect(seen.has(`${e.x},${e.z}`)).toBe(false);
          seen.add(`${e.x},${e.z}`);
        });
        // The place's two signature enemies are always there
        expect(a.enemyRoster.slice(0, 2).map((e) => e.jobId)).toEqual(SKIRMISHES[id].jobs.slice(0, 2).map((j) => j[0]));
      }
    }
    expect(buildSkirmish('ridge', [3], 0).objective).toEqual({ type: 'survive', rounds: 6 });
    expect(buildSkirmish('thornwood', [3], 0).objective).toBeUndefined();
    expect(() => buildSkirmish('nowhere', [3], 0)).toThrow();
    expect(buildSkirmish('thornwood', [3, 3], 0)).not.toEqual(buildSkirmish('thornwood', [3, 3], 1));
  });

  it('pay bounties plus their own bonus, not the campaign clear bonus', () => {
    expect(clearBonus('skirmish', 0)).toBe(0);
    const foes = [unit('thief', 'enemy', 0, 0, 3), unit('archer', 'enemy', 1, 0, 3)];
    for (const f of foes) f.isDead = true;
    const bounty = victoryGil(foes, 'skirmish', 0);
    expect(bounty).toBe(100); // 2 × (20 + 3 × 10)
    expect(bounty + skirmishBonus(0)).toBeLessThan(victoryGil(foes, 'campaign', 0) + 200); // not a better deal than the story
  });

  it('saved win counts are clamped to known places', () => {
    expect(sanitizeSkirmishWins(undefined)).toEqual({});
    expect(sanitizeSkirmishWins({ thornwood: 2.7, shrine: -1, ridge: 'x', atlantis: 9 })).toEqual({ thornwood: 2 });
    expect(sanitizeSkirmishWins({ ridge: 1e9 }).ridge).toBe(999);
  });
});

describe('job mastery', () => {
  it('every job has a bonus that grows from Veteran to Master', () => {
    expect(Object.keys(JOB_MASTERY).sort()).toEqual(Object.keys(JOBS).sort());
    for (const [job, m] of Object.entries(JOB_MASTERY)) {
      expect(m.veteran, job).toBeGreaterThan(0);
      expect(m.master, job).toBeGreaterThan(m.veteran);
    }
    expect(VETERAN_JOB_LEVEL).toBeGreaterThan(3); // past every job requirement
    expect(VETERAN_JOB_LEVEL).toBeLessThan(MAX_JOB_LEVEL);
    expect(masteryLabel('hp', 10)).toBe('+10 HP');
    expect(masteryLabel('attack', 2)).toBe('+2 ATK');
  });

  it('is earned at job level 5 and 8, once each, and reported by gainJp', () => {
    const u = unit('knight');
    u.jobJpEarned = { knight: JOB_LEVEL_JP[VETERAN_JOB_LEVEL - 1] - 10 };
    expect(JobSystem.masteryTier(u, 'knight')).toBe(0);
    const hp = u.maxHp;
    const g1 = JobSystem.gainJp(u, 10);
    expect(g1).toMatchObject({ leveledTo: VETERAN_JOB_LEVEL, mastery: '+15 HP' });
    expect(JobSystem.masteryTier(u, 'knight')).toBe(1);
    expect(u.maxHp).toBe(hp + 15);
    expect(JobSystem.gainJp(u, 10).mastery).toBeUndefined(); // same level: nothing new
    u.jobJpEarned.knight = JOB_LEVEL_JP[5] - 1;
    expect(JobSystem.gainJp(u, 1)).toMatchObject({ leveledTo: 6 }); // a level without a tier
    expect(JobSystem.gainJp(u, 1).mastery).toBeUndefined();
    u.jobJpEarned.knight = JOB_LEVEL_JP[MAX_JOB_LEVEL - 1] - 1;
    expect(JobSystem.gainJp(u, 1)).toMatchObject({ leveledTo: MAX_JOB_LEVEL, mastery: '+35 HP' });
    expect(u.maxHp).toBe(hp + 35); // Master replaces Veteran, it doesn't stack with it
  });

  it('stays with the unit in every job, and bonuses from several jobs add up', () => {
    const u = unit('squire');
    const base = { hp: u.maxHp, mp: u.maxMp, spd: u.speed, eva: u.evasion, jump: u.jump, atk: JobSystem.getAttackPower(u), mag: JobSystem.getMagicPower(u) };
    const master = JOB_LEVEL_JP[MAX_JOB_LEVEL - 1], veteran = JOB_LEVEL_JP[VETERAN_JOB_LEVEL - 1];
    u.jobJpEarned = { squire: master, knight: veteran, archer: master, black_mage: veteran, white_mage: master, time_mage: master, ninja: veteran, dragoon: master };
    JobSystem.recalculateDerivedStats(u);
    expect(JobSystem.masteryBonus(u)).toEqual({ hp: 25 + 15, mp: 20, attack: 2, magic: 1, speed: 2, evasion: 4, jump: 2 });
    expect(u.maxHp).toBe(base.hp + 40);
    expect(u.maxMp).toBe(base.mp + 20);
    expect(u.speed).toBe(base.spd + 2);
    expect(u.evasion).toBe(base.eva + 4);
    expect(u.jump).toBe(base.jump + 2);
    expect(JobSystem.getAttackPower(u)).toBeCloseTo(base.atk + 2);
    expect(JobSystem.getMagicPower(u)).toBeCloseTo(base.mag + 1);
    // Change job: the multipliers change, the mastery bonus comes along
    JobSystem.changeJob(u, 'black_mage');
    const withMastery = { mag: JobSystem.getMagicPower(u), hp: u.maxHp };
    u.jobJpEarned = {};
    JobSystem.recalculateDerivedStats(u);
    expect(withMastery.mag - JobSystem.getMagicPower(u)).toBeCloseTo(1);
    expect(withMastery.hp - u.maxHp).toBe(40);
  });

  it('fresh units and enemies have none', () => {
    for (const job of Object.keys(JOBS)) {
      const e = unit(job, 'enemy', 0, 0, 9);
      expect(Object.values(JobSystem.masteryBonus(e)).every((v) => v === 0), job).toBe(true);
    }
    const noRecord = unit('squire');
    delete noRecord.jobJpEarned;
    expect(JobSystem.masteryBonus(noRecord).hp).toBe(0);
  });
});

describe('Raise', () => {
  it('is a White Mage action that costs MP and counts as support', () => {
    const raise = raiseSpell();
    expect(raise.jobId).toBe('white_mage');
    expect(raise.type).toBe('action');
    expect(raise.mpCost).toBeGreaterThan(0);
    expect(raise.revive).toBeGreaterThan(0.25); // better than a Phoenix Feather, which costs no MP
    expect(CombatEngine.isSupportive(raise)).toBe(true);
  });

  it('always works on a fallen ally and does nothing to the living', () => {
    const wm = unit('white_mage'), ally = unit('knight', 'player', 0, 1);
    expect(cast(wm, ally, raiseSpell()).hit).toBe(false);
    expect(ally.isDead).toBe(false);
    ally.currentHp = 0; ally.isDead = true; ally.ct = 60; ally.statuses = [{ type: 'slow', duration: 2 }];
    const f = CombatEngine.getForecast(wm, ally, raiseSpell(), 1, 1, 'grass');
    expect(f.hitChance).toBe(100);
    const r = CombatEngine.executeAttack(f, () => 0.999);
    expect(r).toMatchObject({ hit: true, revived: true, isHeal: true });
    expect(r.reaction).toBeUndefined();
    expect(ally.isDead).toBe(false);
    expect(ally.currentHp).toBe(Math.max(1, Math.round(ally.maxHp * raiseSpell().revive!)));
    expect(ally.statuses).toEqual([]);
    expect(ally.ct).toBe(0);
  });

  it('never brings back a boss, by spell or by feather', () => {
    const wm = unit('white_mage', 'enemy'), boss = unit('knight', 'enemy', 0, 1);
    boss.isBoss = true; boss.isDead = true; boss.currentHp = 0;
    expect(CombatEngine.itemCanTarget(raiseSpell(), boss)).toBe(false);
    expect(cast(wm, boss, raiseSpell()).hit).toBe(false);
    expect(cast(wm, boss, consumableAbility(CONSUMABLES.phoenix_feather)).hit).toBe(false);
    expect(boss.isDead).toBe(true);
    expect(unitsInBlast(wm, raiseSpell(), 0, 1, [wm, boss])).toEqual([]);
  });

  it('cannot raise someone a living unit is standing over', () => {
    const wm = unit('white_mage'), fallen = unit('knight', 'player', 2, 2), stander = unit('thief', 'enemy', 2, 2);
    fallen.isDead = true; fallen.currentHp = 0;
    expect(unitsInBlast(wm, raiseSpell(), 2, 2, [wm, fallen, stander])).toEqual([]);
    stander.x = 3;
    expect(unitsInBlast(wm, raiseSpell(), 2, 2, [wm, fallen, stander]).map((u) => u.id)).toEqual([fallen.id]);
  });

  it('the AI (and AUTO) raises a fallen ally in reach, when it can pay for it', () => {
    const grid = new BattleGrid(flatMap());
    const wm = unit('white_mage', 'player', 3, 6);
    const fallen = unit('knight', 'player', 3, 5), healthy = unit('archer', 'player', 4, 6), foe = unit('knight', 'enemy', 3, 0);
    fallen.isDead = true; fallen.currentHp = 0;
    const units = [wm, fallen, healthy, foe];
    const plan = planTurn(wm, units, grid);
    expect(plan.ability?.id).toBe('wm_raise');
    expect(plan.targetTile).toEqual({ x: 3, z: 5 });
    wm.currentMp = 0;
    expect(planTurn(wm, units, grid).ability?.id).not.toBe('wm_raise');
  });
});

describe('Act II (0.17.0)', () => {
  const firstAct = ['chapter_1', 'chapter_2a', 'chapter_3'];

  it('the story runs on from the Summit to a single new finale', () => {
    const order: string[] = [];
    let at = CAMPAIGN_CHAPTERS.chapter_3;
    for (let i = 0; i < 10 && at.choices?.length; i++) {
      expect(at.choices.length, at.id).toBe(1); // Act II is one road
      at = CAMPAIGN_CHAPTERS[at.choices[0].nextChapterId];
      order.push(at.id);
    }
    expect(order).toEqual(['chapter_4', 'chapter_5', 'chapter_6']);
    expect(CAMPAIGN_CHAPTERS.chapter_6.choices).toBeUndefined();
    expect(Object.values(CAMPAIGN_CHAPTERS).filter((c) => !c.choices?.length).map((c) => c.id)).toEqual(['chapter_6']);
    expect(Object.values(CAMPAIGN_CHAPTERS).filter((c) => /FINAL/.test(c.title)).map((c) => c.id)).toEqual(['chapter_6']);
  });

  it('a squad that finished the first act finds Chapter IV waiting, and nothing behind it reopens', () => {
    expect(openMissions('chapter_3', firstAct).map((m) => m.chapterId)).toEqual(['chapter_4']);
    expect(openMissions('chapter_3', firstAct)[0].choice?.rewardItemIds).toEqual(['moonfang']);
    expect(nodeState(worldNode('harbor')!, 'chapter_3', firstAct, true)).toBe('open');
    expect(nodeState(worldNode('isle')!, 'chapter_3', firstAct, true)).toBe('locked');
    expect(nodeState(worldNode('battlement')!, 'chapter_3', firstAct, true)).toBe('locked');
    expect(openMissions('chapter_4', [...firstAct, 'chapter_4']).map((m) => m.chapterId)).toEqual(['chapter_5']);
    expect(openMissions('chapter_5', [...firstAct, 'chapter_4']).map((m) => m.chapterId)).toEqual(['chapter_5']); // marched, not yet won
  });

  it('each new battlefield can be climbed from the deployment tiles to every enemy', () => {
    for (const id of ['chapter_4', 'chapter_5', 'chapter_6']) {
      const ch = CAMPAIGN_CHAPTERS[id];
      const map = MAPS[ch.mapId]();
      const at = (x: number, z: number) => map.tiles.find((t) => t.x === x && t.z === z);
      // Flood from the first deployment tile over walkable tiles a Jump of 2 can climb
      const start = map.playerSpawns![0];
      const seen = new Set([`${start.x},${start.z}`]);
      const queue = [start];
      while (queue.length) {
        const c = queue.shift()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = at(c.x + dx, c.z + dz), here = at(c.x, c.z)!;
          if (!n || !n.walkable || seen.has(`${n.x},${n.z}`) || Math.abs(n.height - here.height) > 2) continue;
          seen.add(`${n.x},${n.z}`);
          queue.push({ x: n.x, z: n.z });
        }
      }
      for (const s of map.playerSpawns!) expect(at(s.x, s.z)?.walkable, `${id} spawn ${s.x},${s.z}`).toBe(true);
      for (const e of ch.enemyRoster) expect(seen.has(`${e.x},${e.z}`), `${id}: ${e.name} at ${e.x},${e.z} is cut off`).toBe(true);
      // Nobody deploys on top of anybody else
      const spots = [...map.playerSpawns!.map((s) => `${s.x},${s.z}`), ...ch.enemyRoster.map((e) => `${e.x},${e.z}`)];
      expect(new Set(spots).size, id).toBe(spots.length);
      expect(map.playerSpawns!.length).toBeGreaterThanOrEqual(6); // the squad is six strong once Sable joins
    }
  });

  it('gets harder chapter by chapter, with one boss each and a recruit in Chapter IV', () => {
    const avg = (id: string) => { const r = CAMPAIGN_CHAPTERS[id].enemyRoster; return r.reduce((n, e) => n + e.level, 0) / r.length; };
    expect(avg('chapter_4')).toBeGreaterThan(avg('chapter_3'));
    expect(avg('chapter_5')).toBeGreaterThan(avg('chapter_4'));
    expect(avg('chapter_6')).toBeGreaterThan(avg('chapter_5'));
    for (const id of ['chapter_4', 'chapter_5', 'chapter_6']) expect(CAMPAIGN_CHAPTERS[id].enemyRoster.filter((e) => e.isBoss).length, id).toBe(1);
    expect(CAMPAIGN_CHAPTERS.chapter_4.recruit).toMatchObject({ id: 'sable', jobId: 'thief' });
    const sable = JobSystem.createUnit('sable', 'Sable', 'player', 'thief', 0, 0, 'N', 6);
    expect(JobSystem.canChangeJob(sable, 'thief')).toBe(true);
  });
});
