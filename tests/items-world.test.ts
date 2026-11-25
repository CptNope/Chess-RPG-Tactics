/**
 * 0.15.0: battle items (the Item command), buying and selling, and the world map's rules.
 */
import { describe, it, expect } from 'vitest';
import { JOBS } from '../src/data/jobs';
import { ITEMS, STARTING_ARMORY } from '../src/data/items';
import {
  CONSUMABLES, MAX_STACK, STARTING_INVENTORY, ITEM_ABILITY_PREFIX, consumableAbility, consumableStock, sanitizeInventory
} from '../src/data/consumables';
import { JobSystem } from '../src/core/JobSystem';
import { CombatEngine } from '../src/core/CombatEngine';
import { unitsInBlast } from '../src/core/EnemyAI';
import { UNIQUE_ITEMS, gearSaleBlock, resaleValue, shopProgress } from '../src/core/Economy';
import {
  FIRST_ACT_FINALE, WORLD_NODES, WORLD_ROADS, clearedAfterStory, clearedBefore, nodeForChapter, nodeState, openMissions, route,
  sanitizeCleared, storyFinished, worldNode
} from '../src/core/World';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { Unit } from '../src/core/types';

function unit(job: string, team: 'player' | 'enemy' = 'player', x = 0, z = 0, level = 5): Unit {
  const u = JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
  for (const a of JOBS[job].abilities) u.unlockedAbilities[a.id] = true;
  return u;
}
const item = (id: string) => consumableAbility(CONSUMABLES[id]);
const use = (user: Unit, target: Unit, id: string, rng: () => number = () => 0.999) =>
  CombatEngine.executeAttack(CombatEngine.getForecast(user, target, item(id), 1, 1, 'grass'), rng);

describe('consumables', () => {
  it('are well formed: priced, described, in reach, and each does exactly one job', () => {
    for (const [id, c] of Object.entries(CONSUMABLES)) {
      expect(c.id).toBe(id);
      expect(c.price).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(8);
      expect(c.range).toBeGreaterThanOrEqual(1);
      // One job each, except the Elixir (HP and MP); a flask's ailment rides on its damage
      const effects = [c.heal, c.mp, c.cleanse, c.revive, c.damage].filter(Boolean).length;
      expect(effects, id).toBe(id === 'elixir' ? 2 : 1);
      if (c.inflicts) expect(c.damage, id).toBeGreaterThan(0);
      const a = consumableAbility(c);
      expect(a.id).toBe(ITEM_ABILITY_PREFIX + id);
      expect(a.mpCost).toBe(0);
      expect(a.item).toBeTruthy();
    }
    for (const id of Object.keys(STARTING_INVENTORY)) expect(CONSUMABLES[id], id).toBeTruthy();
  });

  it('never share an id with a job ability', () => {
    const ids = new Set(Object.values(JOBS).flatMap((j) => j.abilities.map((a) => a.id)));
    for (const c of Object.values(CONSUMABLES)) expect(ids.has(consumableAbility(c).id)).toBe(false);
  });

  it('the market stocks the basics from the start and the rest after the first victory', () => {
    const early = consumableStock(0).map((c) => c.id);
    expect(early).toEqual(['potion', 'remedy', 'phoenix_feather']);
    expect(consumableStock(1).map((c) => c.id).sort()).toEqual(['blast_flask', 'ether', 'hi_potion', 'phoenix_feather', 'potion', 'remedy']);
    expect(consumableStock(2).map((c) => c.id)).toContain('frost_flask');
    expect(consumableStock(2).map((c) => c.id)).not.toContain('elixir');
    expect(consumableStock(3).length).toBe(Object.keys(CONSUMABLES).length);
    const prices = consumableStock(3).map((c) => c.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('the next shelf opens the moment a chapter is won', () => {
    expect(shopProgress('chapter_1', false, false, false)).toBe(0);
    expect(shopProgress('chapter_1', false, false, true)).toBe(1);
    expect(shopProgress('chapter_2b', false, false, true)).toBe(2);
    expect(shopProgress('chapter_3', false, false, true)).toBe(3);
    expect(shopProgress('chapter_1', true, false, true)).toBe(3);
    // So the first visit to the market already sells Hi-Potions, Ethers and Blast Flasks
    expect(consumableStock(shopProgress('chapter_1', false, false, true)).map((c) => c.id)).toContain('hi_potion');
  });

  it('sell back for half price', () => {
    expect(resaleValue(CONSUMABLES.potion)).toBe(20);
    expect(resaleValue(CONSUMABLES.phoenix_feather)).toBe(125);
  });
});

describe('using items in battle', () => {
  it('a Potion always lands and heals a fixed amount, capped at max HP', () => {
    const user = unit('squire'), ally = unit('black_mage', 'player', 0, 1);
    ally.currentHp = 10;
    const f = CombatEngine.getForecast(user, ally, item('potion'), 1, 1, 'grass');
    expect(f.hitChance).toBe(100);
    expect(f.expectedDamage).toBe(-80);
    const r = use(user, ally, 'potion'); // the worst roll still lands
    expect(r).toMatchObject({ hit: true, isHeal: true, damageDealt: 80, isCrit: false });
    expect(ally.currentHp).toBe(90);
    ally.currentHp = ally.maxHp - 5;
    expect(use(user, ally, 'potion').damageDealt).toBe(5);
    expect(ally.currentHp).toBe(ally.maxHp);
  });

  it('heals the same in anyone\'s hands', () => {
    const a = unit('white_mage'), b = unit('knight');
    const t1 = unit('squire', 'player', 0, 1), t2 = unit('squire', 'player', 0, 1);
    t1.currentHp = t2.currentHp = 1;
    expect(use(a, t1, 'hi_potion').damageDealt).toBe(use(b, t2, 'hi_potion').damageDealt);
  });

  it('an Ether restores MP and not HP', () => {
    const user = unit('squire'), mage = unit('black_mage', 'player', 0, 1);
    mage.currentMp = 0; mage.currentHp = 20;
    const r = use(user, mage, 'ether');
    expect(r.mpRestored).toBe(Math.min(40, mage.maxMp));
    expect(mage.currentMp).toBe(r.mpRestored);
    expect(mage.currentHp).toBe(20);
    mage.currentMp = mage.maxMp;
    expect(use(user, mage, 'ether').mpRestored).toBe(0);
  });

  it('a Remedy lifts ailments and leaves boons', () => {
    const user = unit('squire'), ally = unit('knight', 'player', 0, 1);
    ally.statuses = [{ type: 'poison', duration: 3 }, { type: 'silence', duration: 3 }, { type: 'haste', duration: 3 }];
    const r = use(user, ally, 'remedy');
    expect(r.cleansed).toBe(2);
    expect(ally.statuses.map((s) => s.type)).toEqual(['haste']);
  });

  it('a Phoenix Feather raises the fallen at a quarter HP with a clean slate, and only the fallen', () => {
    const user = unit('squire'), ally = unit('knight', 'player', 0, 1);
    const feather = item('phoenix_feather');
    expect(CombatEngine.itemCanTarget(feather, ally)).toBe(false);
    expect(use(user, ally, 'phoenix_feather').hit).toBe(false); // wasted on the living: nothing happens
    ally.currentHp = 0; ally.isDead = true; ally.ct = 80; ally.statuses = [{ type: 'poison', duration: 3 }];
    expect(CombatEngine.itemCanTarget(feather, ally)).toBe(true);
    expect(CombatEngine.itemCanTarget(item('potion'), ally)).toBe(false);
    expect(use(user, ally, 'potion').hit).toBe(false);
    const r = use(user, ally, 'phoenix_feather');
    expect(r.revived).toBe(true);
    expect(ally.isDead).toBe(false);
    expect(ally.currentHp).toBe(Math.max(1, Math.round(ally.maxHp * 0.25)));
    expect(ally.statuses).toEqual([]);
    expect(ally.ct).toBe(0);
  });

  it('a Blast Flask deals fixed fire damage, wakes sleepers and can fell a unit', () => {
    const user = unit('squire'), foe = unit('knight', 'enemy', 0, 1);
    const hp = foe.currentHp;
    foe.statuses = [{ type: 'sleep', duration: 3 }];
    const f = CombatEngine.getForecast(user, foe, item('blast_flask'), 1, 1, 'grass');
    expect(f.hitChance).toBe(100);
    expect(f.expectedDamage).toBe(70);
    const r = CombatEngine.executeAttack(f, () => 0.999);
    expect(r).toMatchObject({ hit: true, isHeal: false, damageDealt: 70, woke: true });
    expect(foe.currentHp).toBe(hp - 70);
    expect(foe.statuses.some((s) => s.type === 'sleep')).toBe(false);
    foe.currentHp = 30;
    expect(use(user, foe, 'blast_flask').damageDealt).toBe(30);
    expect(foe.isDead).toBe(true);
    expect(CONSUMABLES.blast_flask.aoe).toBe(1);
  });

  it('items draw no reaction: no parry, no counter', () => {
    const user = unit('squire'), foe = unit('knight', 'enemy', 0, 1);
    foe.equippedAbilities.reaction = 'kn_parry';
    const r = use(user, foe, 'blast_flask', () => 0); // a roll of 0 would trigger every reaction
    expect(r.hit).toBe(true);
    expect(r.reaction).toBeUndefined();
  });

  it('support items count as friendly, the flask as an attack', () => {
    expect(CombatEngine.isSupportive(item('potion'))).toBe(true);
    expect(CombatEngine.isSupportive(item('remedy'))).toBe(true);
    expect(CombatEngine.isSupportive(item('phoenix_feather'))).toBe(true);
    expect(CombatEngine.isSupportive(item('blast_flask'))).toBe(false);
  });

  it('blast areas ignore the fallen, except for a revive; flasks spare allies', () => {
    const user = unit('squire'), ally = unit('knight', 'player', 1, 1), fallenAlly = unit('archer', 'player', 1, 2);
    const foe = unit('knight', 'enemy', 2, 1), fallenFoe = unit('archer', 'enemy', 1, 0);
    for (const u of [fallenAlly, fallenFoe]) { u.isDead = true; u.currentHp = 0; }
    const all = [user, ally, fallenAlly, foe, fallenFoe];
    expect(unitsInBlast(user, item('blast_flask'), 1, 1, all).map((u) => u.id)).toEqual([foe.id]);
    expect(unitsInBlast(user, item('phoenix_feather'), 1, 2, all).map((u) => u.id)).toEqual([fallenAlly.id]);
    expect(unitsInBlast(user, item('potion'), 1, 2, all)).toEqual([]);
  });
});

describe('inventory', () => {
  it('old saves get the starting kit', () => {
    expect(sanitizeInventory(undefined)).toEqual(STARTING_INVENTORY);
    expect(sanitizeInventory('potion')).toEqual(STARTING_INVENTORY);
    expect(sanitizeInventory(undefined)).not.toBe(STARTING_INVENTORY);
  });

  it('keeps known items as whole counts within the carry limit', () => {
    expect(sanitizeInventory({ potion: 4, ether: 2.9, remedy: 0, phoenix_feather: -3, hi_potion: 500, elixir_of_cheating: 9, blast_flask: 'x' }))
      .toEqual({ potion: 4, ether: 2, hi_potion: MAX_STACK });
    expect(sanitizeInventory({})).toEqual({});
  });
});

describe('selling gear', () => {
  it('worn gear and relics stay; spare gear sells for half', () => {
    const a = unit('squire'), b = unit('knight', 'player', 1, 0);
    a.name = 'Tobin';
    const armory = [...STARTING_ARMORY, 'flame_rod', ...UNIQUE_ITEMS];
    const worn = Object.values(a.equipment).find(Boolean)!;
    expect(gearSaleBlock(worn.id, armory, [a, b])).toBe('Worn by Tobin');
    expect(gearSaleBlock('flame_rod', armory, [a, b])).toBeNull();
    expect(resaleValue(ITEMS.flame_rod)).toBe(Math.round(ITEMS.flame_rod.price / 2));
    for (const id of UNIQUE_ITEMS) expect(gearSaleBlock(id, armory, [a, b])).toBe('Relic');
    expect(gearSaleBlock('flame_rod', STARTING_ARMORY.filter((id) => id !== 'flame_rod'), [a, b])).toBe('Not owned');
    expect(gearSaleBlock('no_such_thing', [...armory, 'no_such_thing'], [a, b])).toBe('Not owned');
  });
});

describe('the world map', () => {
  it('has a location for every campaign chapter, a market and the Trials, all joined by roads', () => {
    for (const id of Object.keys(CAMPAIGN_CHAPTERS)) expect(nodeForChapter(id), id).toBeTruthy();
    expect(WORLD_NODES.filter((n) => n.kind === 'market').length).toBe(1);
    expect(WORLD_NODES.filter((n) => n.kind === 'trials').length).toBe(1);
    for (const n of WORLD_NODES) {
      expect(n.x).toBeGreaterThan(0.05); expect(n.x).toBeLessThan(0.95);
      expect(n.y).toBeGreaterThan(0.05); expect(n.y).toBeLessThan(0.95);
      expect(route('market', n.id).at(-1)).toBe(n.id);
    }
    for (const [a, b] of WORLD_ROADS) { expect(worldNode(a)).toBeTruthy(); expect(worldNode(b)).toBeTruthy(); }
  });

  it('routes follow the roads, both ends included', () => {
    expect(route('ruins', 'ruins')).toEqual(['ruins']);
    const path = route('market', 'trials');
    expect(path[0]).toBe('market');
    expect(path.at(-1)).toBe('trials');
    for (let i = 1; i < path.length; i++) {
      expect(WORLD_ROADS.some(([a, b]) => (a === path[i - 1] && b === path[i]) || (b === path[i - 1] && a === path[i]))).toBe(true);
    }
  });

  it('a new game has one battle open', () => {
    expect(openMissions('chapter_1', [])).toEqual([{ chapterId: 'chapter_1' }]);
    expect(nodeState(worldNode('ruins')!, 'chapter_1', [], false)).toBe('open');
    expect(nodeState(worldNode('mire')!, 'chapter_1', [], false)).toBe('locked');
    expect(nodeState(worldNode('market')!, 'chapter_1', [], false)).toBe('open');
    expect(nodeState(worldNode('trials')!, 'chapter_1', [], false)).toBe('locked');
    expect(nodeState(worldNode('trials')!, 'chapter_1', [], true)).toBe('open');
  });

  it('winning the first battle opens both roads, each with its orders', () => {
    const open = openMissions('chapter_1', ['chapter_1']);
    expect(open.map((m) => m.chapterId).sort()).toEqual(['chapter_2a', 'chapter_2b']);
    for (const m of open) expect(m.choice?.nextChapterId).toBe(m.chapterId);
    expect(nodeState(worldNode('ruins')!, 'chapter_1', ['chapter_1'], false)).toBe('cleared');
  });

  it('marching down one road closes the other, through defeat and after victory', () => {
    // Marched to the mire, not yet won (or lost and back on the map)
    expect(openMissions('chapter_2a', ['chapter_1'])).toEqual([{ chapterId: 'chapter_2a' }]);
    expect(nodeState(worldNode('battlement')!, 'chapter_2a', ['chapter_1'], false)).toBe('locked');
    // Won it: on to the summit, the battlement stays shut
    const cleared = ['chapter_1', 'chapter_2a'];
    expect(openMissions('chapter_2a', cleared).map((m) => m.chapterId)).toEqual(['chapter_3']);
    expect(nodeState(worldNode('battlement')!, 'chapter_2a', cleared, false)).toBe('locked');
    // Even if the save's chapter pointer were stale, the walk follows the branch that was won
    expect(openMissions('chapter_1', cleared).map((m) => m.chapterId)).toEqual(['chapter_3']);
  });

  it('nothing is open once the story is won', () => {
    const cleared = ['chapter_1', 'chapter_2b', 'chapter_3', 'chapter_4', 'chapter_5', 'chapter_6', 'chapter_7', 'chapter_8', 'chapter_9'];
    expect(storyFinished(cleared)).toBe(true);
    expect(storyFinished(cleared.slice(0, 8))).toBe(false); // Frostfang Pass was the end in 0.34 only
    expect(storyFinished(cleared.slice(0, 6))).toBe(false); // the Regent is no longer the end (0.34.0)
    expect(storyFinished(['chapter_1', 'chapter_2b'])).toBe(false);
    expect(storyFinished(['chapter_1', 'chapter_2b', 'chapter_3'])).toBe(false); // the Summit is no longer the end
    expect(openMissions('chapter_9', cleared)).toEqual([]);
    expect(openMissions('chapter_1', cleared)).toEqual([]);
    expect(nodeState(worldNode('mire')!, 'chapter_6', cleared, true)).toBe('locked');
    expect(nodeState(worldNode('summit')!, 'chapter_6', cleared, true)).toBe('cleared');
    expect(nodeState(worldNode('cape')!, 'chapter_6', cleared, true)).toBe('cleared');
    expect(openMissions('not_a_chapter', [])).toEqual([]);
  });

  it('old saves: the chapters on the way are taken as won', () => {
    expect(clearedBefore('chapter_1')).toEqual([]);
    expect(clearedBefore('chapter_2b')).toEqual(['chapter_1']);
    expect(sanitizeCleared(undefined, 'chapter_3')).toEqual(['chapter_1']);
    expect(openMissions('chapter_3', sanitizeCleared(undefined, 'chapter_3'))).toEqual([{ chapterId: 'chapter_3' }]);
    expect(sanitizeCleared(['chapter_1', 'chapter_1', 'bogus', 7, 'chapter_2a'], 'chapter_2a')).toEqual(['chapter_1', 'chapter_2a']);
    // A pre-0.15 save that had finished the first act stands at the Summit with Chapter IV ahead
    expect(clearedAfterStory()).toEqual(['chapter_1', FIRST_ACT_FINALE]);
    expect(storyFinished(clearedAfterStory())).toBe(false);
    expect(openMissions(FIRST_ACT_FINALE, clearedAfterStory()).map((m) => m.chapterId)).toEqual(['chapter_4']);
  });
});
