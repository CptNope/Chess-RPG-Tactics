/**
 * 0.30.0: equipment rules. Each job uses its own weapon types; shields, heavy armor and robes belong
 * to some jobs; light gear and accessories suit anyone.
 */
import { describe, it, expect } from 'vitest';
import { JOBS, PLAYER_JOB_IDS } from '../src/data/jobs';
import { ITEMS } from '../src/data/items';
import { JOB_GEAR, gearKind, jobCanUse, jobGearText, whoCanUse } from '../src/data/gear-rules';
import { JobSystem } from '../src/core/JobSystem';
import { SaveManager } from '../src/core/SaveManager';
import { Unit } from '../src/core/types';

const make = (job: string, team: 'player' | 'enemy' = 'player', level = 5): Unit => JobSystem.createUnit(`${team}-${job}`, job, team, job, 0, 0, 'N', level);

describe('equipment rules', () => {
  it('cover every job, and every job starts in gear it can use', () => {
    expect(Object.keys(JOB_GEAR).sort()).toEqual([...PLAYER_JOB_IDS].sort());
    for (const id of PLAYER_JOB_IDS) {
      for (const team of ['player', 'enemy'] as const) {
        const u = make(id, team);
        expect(JobSystem.removeForbiddenGear(u).map((it) => it.id), `${id} ${team}`).toEqual([]);
      }
      expect(JOB_GEAR[id].weapons.length, id).toBeGreaterThan(0);
    }
  });

  it('leave no piece of gear without a wearer', () => {
    for (const item of Object.values(ITEMS)) {
      if (item.beast) continue;
      const who = whoCanUse(item);
      expect(who === null || who.length > 0, item.id).toBe(true);
    }
    // every accessory and light piece suits anyone
    for (const item of Object.values(ITEMS).filter((i) => !i.beast && (i.slot === 'accessory' || ((i.slot === 'head' || i.slot === 'body') && !i.armor)))) {
      expect(whoCanUse(item), item.id).toBeNull();
    }
  });

  it('keep mages out of mail and fighters out of robes', () => {
    const mage = make('black_mage'), knight = make('knight'), monk = make('monk');
    for (const id of ['iron_sword', 'buckler', 'chainmail', 'iron_helm']) expect(JobSystem.canEquip(mage, ITEMS[id]), id).toBe(false);
    for (const id of ['chrono_rod', 'silk_robe', 'wizard_hat', 'leather_vest', 'feather_boots']) expect(JobSystem.canEquip(mage, ITEMS[id]), id).toBe(true);
    for (const id of ['silk_robe', 'hunting_bow', 'chrono_rod']) expect(JobSystem.canEquip(knight, ITEMS[id]), id).toBe(false);
    for (const id of ['platinum_blade', 'halberd', 'aegis_shield', 'platinum_armor', 'barbute']) expect(JobSystem.canEquip(knight, ITEMS[id]), id).toBe(true);
    expect(JobSystem.canEquip(monk, ITEMS.tiger_claws)).toBe(true);
    expect(JobSystem.canEquip(monk, ITEMS.iron_sword)).toBe(false);
    expect(gearKind(ITEMS.platinum_armor)).toBe('heavy');
    expect(gearKind(ITEMS.summoner_robe)).toBe('robe');
    expect(jobCanUse('tamer', ITEMS.drovers_whip)).toBe(true);
    expect(jobGearText('knight')).toBe('Swords, Spears · Shields · Heavy armor & helms');
  });

  it('a refused piece stays off', () => {
    const mage = make('white_mage');
    const before = mage.equipment.weapon;
    JobSystem.equipItem(mage, ITEMS.platinum_blade);
    expect(mage.equipment.weapon).toBe(before);
  });

  it('changing job takes off what the new job can\'t use', () => {
    const u = make('knight');
    JobSystem.grantPrerequisites(u, 'black_mage');
    const off = JobSystem.changeJob(u, 'black_mage');
    expect(off.map((it) => it.id).sort()).toEqual(['buckler', 'chainmail', 'iron_sword'].sort());
    expect(u.equipment.weapon).toBeNull();
    expect(u.equipment.shield).toBeNull();
    expect(u.equipment.body).toBeNull();
    expect(u.currentHp).toBeLessThanOrEqual(u.maxHp);
    // nothing to take off going back
    expect(JobSystem.changeJob(u, 'knight')).toEqual([]);
  });

  it('a save keeps only gear the job can use', () => {
    const mage = make('black_mage');
    mage.equipment.body = ITEMS.platinum_armor;
    mage.equipment.accessory = ITEMS.power_wrist;
    const d = SaveManager.parseImport(JSON.stringify({ version: '0.30.0', currentChapterId: 'chapter_2a', units: [mage] }));
    const u = d.units[0];
    expect(u.equipment.body?.id).not.toBe('platinum_armor');
    expect(u.equipment.accessory?.id).toBe('power_wrist');
    expect(JOBS[u.jobId].name).toBe('Black Mage');
  });
});

describe('after a job change', () => {
  it('the best owned piece the new job can use fills the emptied slots', () => {
    const u = make('knight');
    JobSystem.grantPrerequisites(u, 'black_mage');
    const off = JobSystem.changeJob(u, 'black_mage');
    const owned = ['chrono_rod', 'sage_staff', 'iron_sword', 'silk_robe', 'summoner_robe', 'chainmail', 'aegis_shield'].map((id) => ITEMS[id]);
    const on = JobSystem.fillSlots(u, [...new Set(off.map((it) => it.slot))], owned);
    expect(on.map((it) => it.id).sort()).toEqual(['sage_staff', 'summoner_robe'].sort());
    expect(u.equipment.shield).toBeNull(); // no shield a mage can carry
  });
});
