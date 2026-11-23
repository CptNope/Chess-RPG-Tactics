/**
 * 0.14.0: job levels and the job tree, gil and the shop, and the two advanced jobs
 * (Paladin, Spellblade).
 */
import { describe, it, expect } from 'vitest';
import { JOBS } from '../src/data/jobs';
import { ITEMS, STARTING_ARMORY } from '../src/data/items';
import { JobSystem, JOB_LEVEL_JP, MAX_JOB_LEVEL } from '../src/core/JobSystem';
import { CombatEngine } from '../src/core/CombatEngine';
import {
  STARTING_GIL, UNIQUE_ITEMS, SHOP_PRICE_CAP, shopProgress, shopStock, nextShopCap, bountyFor, victoryGil, resaleValue
} from '../src/core/Economy';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { Ability, Unit } from '../src/core/types';

const ab = (id: string) => JobSystem.findAbility(id) as Ability;
const hitNoCrit = () => { let i = 0; return () => (i++ % 2 === 0 ? 0 : 0.99); };
function unit(job: string, team: 'player' | 'enemy' = 'player', x = 0, z = 0, level = 5): Unit {
  const u = JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
  for (const a of JOBS[job].abilities) u.unlockedAbilities[a.id] = true;
  return u;
}
const fc = (a: Unit, t: Unit, ability: Ability) => CombatEngine.getForecast(a, t, ability, 1, 1, 'grass');

describe('job levels', () => {
  it('rise with lifetime JP and stop at Master', () => {
    const u = unit('squire');
    u.jobJpEarned = {};
    expect(JobSystem.jobLevel(u, 'squire')).toBe(1);
    JOB_LEVEL_JP.forEach((jp, i) => {
      u.jobJpEarned!.squire = jp;
      expect(JobSystem.jobLevel(u, 'squire')).toBe(i + 1);
    });
    u.jobJpEarned.squire = 99999;
    expect(JobSystem.jobLevel(u, 'squire')).toBe(MAX_JOB_LEVEL);
    expect(JobSystem.jobLevelProgress(u, 'squire').need).toBe(0);
  });

  it('spending JP never lowers a job level', () => {
    const u = unit('squire');
    JobSystem.gainJp(u, 300);
    const lv = JobSystem.jobLevel(u, 'squire');
    u.unlockedAbilities = { basic_attack: true };
    expect(JobSystem.learnAbility(u, 'sq_focus', 'squire')).toBe(true);
    expect(JobSystem.jobLevel(u, 'squire')).toBe(lv);
  });

  it('gainJp banks spendable JP, reports the level-up and the jobs it unlocks', () => {
    const u = unit('squire');
    expect(JobSystem.canChangeJob(u, 'monk')).toBe(false); // needs Squire Lv 3
    const jp = u.jobPoints.squire;
    const need = JOB_LEVEL_JP[2] - u.jobJpEarned!.squire;
    expect(JobSystem.gainJp(u, need - 1)).toEqual({ unlocked: [] });
    const gain = JobSystem.gainJp(u, 1);
    expect(gain.leveledTo).toBe(3);
    expect(gain.unlocked).toEqual(['monk']);
    expect(u.jobPoints.squire).toBe(jp + need);
  });
});

describe('job tree', () => {
  it('every prerequisite names a real job and a reachable level, with no cycles', () => {
    for (const job of Object.values(JOBS)) {
      for (const p of job.prerequisites || []) {
        expect(JOBS[p.jobId], `${job.id} -> ${p.jobId}`).toBeTruthy();
        expect(p.level).toBeGreaterThanOrEqual(2);
        expect(p.level).toBeLessThanOrEqual(MAX_JOB_LEVEL);
      }
      // granting the chain terminates and unlocks the job
      const u = unit('squire');
      JobSystem.grantPrerequisites(u, job.id);
      expect(JobSystem.canChangeJob(u, job.id), job.id).toBe(true);
    }
  });

  it('a new recruit can take the base jobs but not the advanced ones', () => {
    const u = unit('squire');
    const open = JobSystem.unlockedJobs(u);
    expect(open).toEqual(expect.arrayContaining(['squire', 'knight', 'archer', 'black_mage', 'white_mage', 'geomancer']));
    for (const id of ['dragoon', 'ninja', 'time_mage', 'monk', 'thief', 'summoner', 'oracle', 'paladin', 'spellblade']) {
      expect(open, id).not.toContain(id);
      expect(JobSystem.missingPrerequisites(u, id).length, id).toBeGreaterThan(0);
    }
  });

  it('units created in an advanced job (recruits, enemies, the opening squad) meet its requirements', () => {
    for (const id of Object.keys(JOBS)) {
      const u = unit(id, 'enemy');
      expect(JobSystem.missingPrerequisites(u, id), id).toEqual([]);
    }
    const dragoon = unit('dragoon');
    expect(JobSystem.jobLevel(dragoon, 'knight')).toBeGreaterThanOrEqual(2);
  });

  it('a unit can always stay in the job it holds', () => {
    const u = unit('squire');
    u.jobId = 'oracle';
    u.jobJpEarned = {};
    expect(JobSystem.canChangeJob(u, 'oracle')).toBe(true);
    expect(JobSystem.canChangeJob(u, 'summoner')).toBe(false);
  });

  it('the Summoner needs both mage jobs, the Oracle needs the Time Weaver', () => {
    const u = unit('squire');
    u.jobJpEarned!.white_mage = JOB_LEVEL_JP[1];
    expect(JobSystem.missingPrerequisites(u, 'summoner').map((m) => m.jobId)).toEqual(['black_mage']);
    u.jobJpEarned!.black_mage = JOB_LEVEL_JP[1];
    expect(JobSystem.canChangeJob(u, 'summoner')).toBe(true);
    expect(JobSystem.canChangeJob(u, 'time_mage')).toBe(true);
    expect(JobSystem.canChangeJob(u, 'oracle')).toBe(false);
  });

  it('old saves keep the jobs they use and get levels for the JP already earned', () => {
    const u = unit('ninja');
    u.equippedAbilities.secondaryJobId = 'summoner';
    u.jobPoints.ninja = 500;
    u.unlockedAbilities = { basic_attack: true, ni_shuriken: true, ni_dual_wield: true };
    delete u.jobJpEarned;
    JobSystem.ensureJobPoints(u);
    expect(JobSystem.canChangeJob(u, 'ninja')).toBe(true);
    expect(JobSystem.missingPrerequisites(u, 'ninja')).toEqual([]);
    expect(JobSystem.missingPrerequisites(u, 'summoner')).toEqual([]);
    // 500 held + abilities bought − the 200 starting bank
    const spent = JOBS.ninja.abilities.filter((a) => ['ni_shuriken', 'ni_dual_wield'].includes(a.id)).reduce((n, a) => n + a.jpCost, 0);
    expect(u.jobJpEarned!.ninja).toBe(500 + spent - 200);
  });
});

describe('gil and the shop', () => {
  it('stock grows with the campaign, never sells relics, and is sorted by slot then price', () => {
    let last = 0;
    for (const p of [0, 1, 2, 3] as const) {
      const stock = shopStock(p);
      expect(stock.length).toBeGreaterThan(last);
      last = stock.length;
      for (const it of stock) {
        expect(it.price).toBeLessThanOrEqual(SHOP_PRICE_CAP[p]);
        expect(UNIQUE_ITEMS).not.toContain(it.id);
      }
      const slots = stock.map((i) => i.slot);
      expect(slots.indexOf('accessory')).toBeGreaterThan(slots.lastIndexOf('weapon'));
    }
    expect(shopStock(3).length).toBe(Object.keys(ITEMS).length - UNIQUE_ITEMS.length);
    for (const id of UNIQUE_ITEMS) expect(ITEMS[id], id).toBeTruthy();
    expect(nextShopCap(0)).toBe(SHOP_PRICE_CAP[1]);
    expect(nextShopCap(3)).toBeNull();
  });

  it('shop progress follows the chapter, and the Trials open everything', () => {
    expect(shopProgress('chapter_1', false, false)).toBe(0);
    expect(shopProgress('chapter_2a', false, false)).toBe(1);
    expect(shopProgress('chapter_2b', false, false)).toBe(1);
    expect(shopProgress('chapter_3', false, false)).toBe(2);
    expect(shopProgress('chapter_1', true, false)).toBe(3);
    expect(shopProgress('chapter_1', false, true)).toBe(3);
    for (const id of Object.keys(CAMPAIGN_CHAPTERS)) expect(shopProgress(id, false, false)).toBeGreaterThanOrEqual(0);
  });

  it('the first shelves have new gear in every slot, some of it within the starting purse', () => {
    const fresh = shopStock(0).filter((i) => !STARTING_ARMORY.includes(i.id));
    for (const slot of ['weapon', 'shield', 'head', 'body', 'accessory']) {
      expect(fresh.some((i) => i.slot === slot), slot).toBe(true);
    }
    expect(fresh.filter((i) => i.price <= STARTING_GIL).length).toBeGreaterThanOrEqual(3);
  });

  it('bounties scale with level, triple for bosses, and only count the fallen', () => {
    const grunt = unit('squire', 'enemy', 0, 0, 3), boss = unit('knight', 'enemy', 1, 0, 3);
    JobSystem.makeBoss(boss);
    expect(bountyFor(grunt)).toBe(50);
    expect(bountyFor(boss)).toBe(150);
    grunt.isDead = true;
    expect(victoryGil([grunt, boss], 'campaign', 0)).toBe(50 + 150);
    boss.isDead = true;
    expect(victoryGil([grunt, boss], 'campaign', 0)).toBe(50 + 150 + 150);
    expect(victoryGil([grunt, boss], 'trials', 5)).toBe(200 + 100 + 100);
    expect(victoryGil([grunt, boss], 'custom', 0)).toBe(0);
  });

  it('a campaign chapter pays enough to buy something, not everything', () => {
    for (const ch of Object.values(CAMPAIGN_CHAPTERS)) {
      const foes = ch.enemyRoster.map((e, i) => {
        const u = JobSystem.createUnit(`e${i}`, e.name, 'enemy', e.jobId, e.x, e.z, 'S', e.level);
        if (e.isBoss) JobSystem.makeBoss(u);
        u.isDead = true;
        return u;
      });
      const gil = victoryGil(foes, 'campaign', 0);
      expect(gil, ch.id).toBeGreaterThanOrEqual(400);
      expect(gil, ch.id).toBeLessThanOrEqual(900);
    }
  });

  it('fenced loot pays half price', () => {
    expect(resaleValue(ITEMS.hermes_shoes)).toBe(200);
  });
});

describe('advanced jobs', () => {
  it('Paladin and Spellblade need two jobs each and have a full kit', () => {
    for (const id of ['paladin', 'spellblade']) {
      expect(JOBS[id].prerequisites!.length).toBe(2);
      expect(JOBS[id].abilities.filter((a) => a.type === 'action').length).toBeGreaterThanOrEqual(3);
      expect(JOBS[id].abilities.some((a) => a.type === 'reaction')).toBe(true);
      expect(JOBS[id].abilities.some((a) => a.type === 'support')).toBe(true);
      expect(unit(id).equipment.weapon).toBeTruthy();
    }
  });

  it('elemental blade skills hit with ATK at weapon scale, ignore Protect and facing, and respect Shell', () => {
    const sb = unit('spellblade', 'player', 0, 1), t = unit('squire', 'enemy', 0, 0);
    const edge = fc(sb, t, ab('sb_flame_edge')).expectedDamage;
    expect(edge).toBe(Math.round(JobSystem.getAttackPower(sb) * 1.1 * 5));
    t.facing = 'N'; // attacked from behind
    expect(fc(sb, t, ab('sb_flame_edge')).expectedDamage).toBe(edge);
    CombatEngine.applyStatus(t, 'protect');
    expect(fc(sb, t, ab('sb_flame_edge')).expectedDamage).toBe(edge);
    CombatEngine.applyStatus(t, 'shell');
    expect(fc(sb, t, ab('sb_flame_edge')).expectedDamage).toBeLessThan(edge * 0.75);
  });

  it('Lay on Hands heals from ATK, and Zeal and Dawnbringer strengthen holy', () => {
    const p = unit('paladin', 'player', 0, 1), ally = unit('squire', 'player', 0, 0), foe = unit('squire', 'enemy', 0, 2);
    const heal = -fc(p, ally, ab('pa_lay_on_hands')).expectedDamage;
    expect(heal).toBe(Math.round(JobSystem.getAttackPower(p) * 1.3 * 3));
    const blade = fc(p, foe, ab('pa_holy_blade')).expectedDamage;
    p.equippedAbilities.support = 'pa_zeal';
    expect(-fc(p, ally, ab('pa_lay_on_hands')).expectedDamage).toBeGreaterThan(heal * 1.15);
    expect(fc(p, foe, ab('pa_holy_blade')).expectedDamage).toBeGreaterThan(blade * 1.15);
    const zeal = fc(p, foe, ab('pa_holy_blade')).expectedDamage;
    const atkBefore = JobSystem.getAttackPower(p);
    p.equipment.weapon = { ...ITEMS.dawn_blade, stats: { ...p.equipment.weapon!.stats } }; // same stats, holy boost
    expect(JobSystem.getAttackPower(p)).toBe(atkBefore);
    expect(fc(p, foe, ab('pa_holy_blade')).expectedDamage).toBeGreaterThan(zeal * 1.2);
  });

  it('Rebuke silences and Aegis shells the line', () => {
    expect(ab('pa_rebuke').appliesStatus).toBe('silence');
    expect(CombatEngine.isSupportive(ab('pa_aegis'))).toBe(true);
    expect(ab('pa_aegis').aoe).toBe(1);
  });

  it('Arcane Edge adds MAG to the basic Attack only', () => {
    const sb = unit('spellblade', 'player', 0, 1), t = unit('squire', 'enemy', 0, 0);
    const attack = fc(sb, t, ab('basic_attack')).expectedDamage, edge = fc(sb, t, ab('sb_flame_edge')).expectedDamage;
    sb.equippedAbilities.support = 'sb_arcane_edge';
    expect(fc(sb, t, ab('basic_attack')).expectedDamage).toBe(Math.round(attack + JobSystem.getMagicPower(sb) * 1.5));
    expect(fc(sb, t, ab('sb_flame_edge')).expectedDamage).toBe(edge);
  });

  it('Runic answers spells with MP, not blows; Divine Grace can heal when struck', () => {
    const sb = unit('spellblade', 'player', 0, 1), mage = unit('black_mage', 'enemy', 0, 0), knight = unit('knight', 'enemy', 1, 1);
    sb.equippedAbilities.reaction = 'sb_runic';
    sb.currentMp = 0;
    expect(CombatEngine.executeAttack(fc(knight, sb, ab('basic_attack')), hitNoCrit()).reaction).toBeUndefined();
    sb.currentHp = sb.maxHp;
    const r = CombatEngine.executeAttack(fc(mage, sb, ab('bm_fire')), hitNoCrit());
    expect(r.reaction?.type).toBe('runic');
    expect(sb.currentMp).toBe(Math.round(sb.maxMp * 0.2));

    const p = unit('paladin', 'player', 3, 3);
    p.equippedAbilities.reaction = 'pa_divine_grace';
    const hpBefore = p.currentHp;
    const res = CombatEngine.executeAttack(fc(knight, p, ab('basic_attack')), () => 0.01);
    expect(res.reaction?.type).toBe('divine_grace');
    expect(p.currentHp).toBe(hpBefore - res.damageDealt + res.reaction!.heal!);
  });
});
