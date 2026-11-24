/**
 * 0.29.0: beast gear. Barding and collars that only tamed beasts wear, and the only gear they wear.
 */
import { describe, it, expect } from 'vitest';
import { ITEMS, getItemsForSlot } from '../src/data/items';
import { JobSystem, BEAST_SLOTS } from '../src/core/JobSystem';
import { shopStock } from '../src/core/Economy';
import { SaveManager } from '../src/core/SaveManager';
import { beastFromTamed } from '../src/core/Taming';
import { Unit } from '../src/core/types';

const BEAST_GEAR = ['leather_collar', 'hide_barding', 'spiked_collar', 'glowstone_charm', 'chain_barding', 'runed_barding'];
const make = (job: string, level = 6): Unit => JobSystem.createUnit(`p-${job}`, job, 'player', job, 0, 0, 'N', level);
const beast = (job = 'wolf', level = 6): Unit => beastFromTamed(JobSystem.createUnit('e1', job, 'enemy', job, 0, 0, 'S', level), []);

describe('beast gear', () => {
  it('is six pieces of barding and collars, marked for beasts', () => {
    const marked = Object.values(ITEMS).filter((it) => it.beast).map((it) => it.id);
    expect(marked.sort()).toEqual([...BEAST_GEAR].sort());
    for (const id of BEAST_GEAR) expect(BEAST_SLOTS).toContain(ITEMS[id].slot);
    expect(getItemsForSlot('body').some((it) => it.beast)).toBe(true);
    expect(getItemsForSlot('accessory').some((it) => it.beast)).toBe(true);
  });

  it('only beasts wear it, and beasts wear nothing else', () => {
    const knight = make('knight'), wolf = beast();
    for (const id of BEAST_GEAR) {
      expect(JobSystem.canEquip(wolf, ITEMS[id]), id).toBe(true);
      expect(JobSystem.canEquip(knight, ITEMS[id]), id).toBe(false);
    }
    for (const id of ['iron_sword', 'buckler', 'iron_helm', 'chainmail', 'feather_boots', 'wolfpelt_mantle']) {
      expect(JobSystem.canEquip(wolf, ITEMS[id]), id).toBe(false);
      expect(JobSystem.canEquip(knight, ITEMS[id]), id).toBe(true);
    }
    JobSystem.equipItem(knight, ITEMS.spiked_collar);
    expect(knight.equipment.accessory?.id).not.toBe('spiked_collar');
  });

  it('makes a beast stronger on top of its natural stats', () => {
    const wolf = beast();
    const hp = wolf.maxHp, atk = JobSystem.getAttackPower(wolf);
    JobSystem.equipItem(wolf, ITEMS.chain_barding);
    JobSystem.equipItem(wolf, ITEMS.spiked_collar);
    expect(wolf.equipment.body?.id).toBe('chain_barding');
    expect(wolf.equipment.accessory?.id).toBe('spiked_collar');
    expect(wolf.maxHp).toBe(hp + 50);
    expect(JobSystem.getAttackPower(wolf)).toBeGreaterThan(atk);
  });

  it('Runed Barding guards against Sleep and Silence', () => {
    const wisp = beast('wisp');
    JobSystem.equipItem(wisp, ITEMS.runed_barding);
    expect(ITEMS.runed_barding.traits?.guard).toEqual(['sleep', 'silence']);
    expect(wisp.equipment.body?.id).toBe('runed_barding');
  });

  it('sits on its own shelf at the end of the market', () => {
    const stock = shopStock(3);
    const first = stock.findIndex((it) => it.beast);
    expect(first).toBeGreaterThan(0);
    expect(stock.slice(first).every((it) => it.beast)).toBe(true);
    expect(shopStock(0).map((it) => it.id)).toEqual(expect.arrayContaining(['leather_collar', 'hide_barding', 'spiked_collar', 'glowstone_charm']));
  });

  it('a save keeps beast gear on beasts and off people', () => {
    const wolf = beast();
    wolf.equipment.body = ITEMS.hide_barding;
    wolf.equipment.weapon = ITEMS.iron_sword; // not allowed
    const knight = make('knight');
    knight.equipment.accessory = ITEMS.spiked_collar; // not allowed
    const d = SaveManager.parseImport(JSON.stringify({ version: '0.29.0', currentChapterId: 'chapter_2a', units: [knight, wolf] }));
    const [k, w] = d.units;
    expect(w.jobId).toBe('wolf');
    expect(w.equipment.body?.id).toBe('hide_barding');
    expect(w.equipment.weapon).toBeNull();
    expect(k.equipment.accessory?.id).not.toBe('spiked_collar');
  });
});
