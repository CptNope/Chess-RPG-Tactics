/**
 * 0.21.0: the travelling merchant, camp scenes, and side-battle trophies.
 */
import { describe, it, expect } from 'vitest';
import { ITEMS, MERCHANT_ITEMS, RARE_DROP_POOL, STARTING_ARMORY } from '../src/data/items';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { CAMP_SCENES, campMemories, pendingCamp, sanitizeCampSeen } from '../src/data/camp';
import { SHOP_PRICE_CAP, UNIQUE_ITEMS, gearSaleBlock, shopStock } from '../src/core/Economy';
import { EARLY_MARKUP, merchantStops, merchantVisit, merchantVisitIndex } from '../src/core/Merchant';
import { SKIRMISHES, missingTrophies, skirmishOpen } from '../src/core/Skirmish';
import { SEA_PORTS, WORLD_NODES, WORLD_ROADS, farShoreOpen, regionOf, route, worldNode } from '../src/core/World';
import { SaveManager } from '../src/core/SaveManager';
import { JobSystem } from '../src/core/JobSystem';
import { portraitForSpeaker } from '../src/graphics/CharacterArt';

const ACT1 = ['chapter_1', 'chapter_2a', 'chapter_3'];

describe('travelling merchant (0.21.0)', () => {
  it('stays away until the first battle is won, then sets up at a won or side-battle place', () => {
    expect(merchantVisit([], {}, 0, STARTING_ARMORY)).toBeNull();
    for (let n = 1; n <= ACT1.length; n++) {
      const cleared = ACT1.slice(0, n);
      const v = merchantVisit(cleared, {}, 1, STARTING_ARMORY)!;
      expect(v).not.toBeNull();
      const node = worldNode(v.nodeId)!;
      expect(['skirmish', 'mission']).toContain(node.kind);
      if (node.kind === 'mission') expect(cleared).toContain(node.chapterId);
      expect(merchantStops(cleared)).toContain(v.nodeId);
    }
  });

  it('moves on after every win, story or side battle', () => {
    const a = merchantVisitIndex(['chapter_1'], {});
    expect(merchantVisitIndex(['chapter_1'], { thornwood: 2 })).toBe(a + 2);
    expect(merchantVisitIndex(['chapter_1', 'chapter_2a'], {})).toBe(a + 1);
    // Over a run of visits she doesn't sit in one place
    const places = new Set<string>();
    for (let w = 0; w < 6; w++) places.add(merchantVisit(ACT1, { thornwood: w }, 2, STARTING_ARMORY)!.nodeId);
    expect(places.size).toBeGreaterThan(2);
  });

  it('sells one piece from the next shelf at a markup, and one of her own goods', () => {
    const v = merchantVisit(['chapter_1'], {}, 1, STARTING_ARMORY)!;
    const early = v.wares.find((w) => w.kind === 'early')!;
    const own = v.wares.find((w) => w.kind === 'own')!;
    expect(ITEMS[early.id].price).toBeGreaterThan(SHOP_PRICE_CAP[1]);
    expect(ITEMS[early.id].price).toBeLessThanOrEqual(SHOP_PRICE_CAP[2]);
    expect(early.price).toBe(Math.round((ITEMS[early.id].price * EARLY_MARKUP) / 10) * 10);
    expect(shopStock(1).map((i) => i.id)).not.toContain(early.id);
    expect(MERCHANT_ITEMS).toContain(own.id);
    expect(own.price).toBe(ITEMS[own.id].price);
  });

  it('never offers what the squad owns, relics or trophies; once the shelves are all open, only her own goods', () => {
    const everything = Object.keys(ITEMS).filter((id) => !MERCHANT_ITEMS.includes(id));
    const late = merchantVisit(ACT1, {}, 3, STARTING_ARMORY)!;
    expect(late.wares.map((w) => w.kind)).toEqual(['own']);
    expect(merchantVisit(ACT1, {}, 2, [...everything, ...MERCHANT_ITEMS])).toBeNull();
    for (let visit = 0; visit < 12; visit++) {
      const v = merchantVisit(ACT1, { thornwood: visit }, 1, ['lucky_coin'])!;
      for (const w of v.wares) {
        expect(UNIQUE_ITEMS).not.toContain(w.id);
        expect(w.id).not.toBe('lucky_coin');
      }
    }
  });

  it("her own goods are real gear the market and the Trials don't stock, and can be sold back", () => {
    for (const id of MERCHANT_ITEMS) {
      expect(ITEMS[id], id).toBeTruthy();
      expect(shopStock(3).map((i) => i.id)).not.toContain(id);
      expect(RARE_DROP_POOL).not.toContain(id);
      expect(gearSaleBlock(id, [id], [])).toBeNull();
    }
  });
});

describe('side-battle trophies (0.21.0)', () => {
  it('every side battle has its own trophy: real gear, never sold, never a Trials drop', () => {
    const trophies = Object.values(SKIRMISHES).map((d) => d.trophy);
    expect(new Set(trophies).size).toBe(trophies.length);
    for (const id of trophies) {
      expect(ITEMS[id], id).toBeTruthy();
      expect(UNIQUE_ITEMS).toContain(id);
      expect(RARE_DROP_POOL).not.toContain(id);
      expect(gearSaleBlock(id, [id], [])).toBe('Relic');
    }
  });

  it('an old save with side-battle wins is owed exactly those trophies', () => {
    expect(missingTrophies({}, STARTING_ARMORY)).toEqual([]);
    expect(missingTrophies({ thornwood: 3 }, STARTING_ARMORY)).toEqual(['fordwarden_bow']);
    expect(missingTrophies({ thornwood: 3, ridge: 1 }, [...STARTING_ARMORY, 'fordwarden_bow'])).toEqual(['watchfire_helm']);
  });
});

describe('camp scenes (0.21.0)', () => {
  it('one scene after every story battle, and only squad members speak', () => {
    // Since 0.35.0 the finale has one too, waiting on the map after the epilogue
    const story = Object.keys(CAMPAIGN_CHAPTERS);
    expect(Object.keys(CAMP_SCENES).sort()).toEqual(story.sort());
    const joins: Record<string, string[]> = { chapter_2a: ['Bria'], chapter_2b: ['Bria'], chapter_3: ['Bria'], chapter_4: ['Bria', 'Sable'], chapter_5: ['Bria', 'Sable'], chapter_6: ['Bria', 'Sable'], chapter_7: ['Bria', 'Sable', 'Kestrel'], chapter_8: ['Bria', 'Sable', 'Kestrel'], chapter_9: ['Bria', 'Sable', 'Kestrel'] };
    for (const scene of Object.values(CAMP_SCENES)) {
      expect(scene.lines.length).toBeGreaterThanOrEqual(4);
      const cast = ['Rowan', 'Maren', 'Tobin', 'Corvin', ...(joins[scene.chapterId] || [])];
      for (const l of scene.lines) {
        expect(cast, `${scene.chapterId}: ${l.speaker}`).toContain(l.speaker);
        expect(l.portrait || portraitForSpeaker(l.speaker), l.speaker).toBeTruthy();
      }
    }
  });

  it('plays the earliest unseen scene, once', () => {
    expect(pendingCamp([], [])).toBeNull();
    expect(pendingCamp(['chapter_1'], [])?.chapterId).toBe('chapter_1');
    expect(pendingCamp(['chapter_1', 'chapter_2b'], ['chapter_1'])?.chapterId).toBe('chapter_2b');
    expect(pendingCamp(['chapter_1', 'chapter_2b'], ['chapter_1', 'chapter_2b'])).toBeNull();
    expect(pendingCamp(['chapter_1', 'chapter_2a', 'chapter_3', 'chapter_4', 'chapter_5', 'chapter_6'], Object.keys(CAMP_SCENES))).toBeNull();
  });

  it('an old save gets its latest scene, not a backlog; junk is dropped', () => {
    expect(sanitizeCampSeen(undefined, ACT1)).toEqual(['chapter_1', 'chapter_2a']);
    expect(pendingCamp(ACT1, sanitizeCampSeen(undefined, ACT1))?.chapterId).toBe('chapter_3');
    expect(sanitizeCampSeen(['chapter_1', 'chapter_1', '__proto__', 7, 'chapter_99', 'nope'], ACT1)).toEqual(['chapter_1']);
  });

  it('remembers every camp night seen, in story order, through New Game+ (0.39.0)', () => {
    // A save from before 0.39 remembers what it has seen this playthrough
    expect(campMemories(undefined, ['chapter_2a', 'chapter_1'])).toEqual(['chapter_1', 'chapter_2a']);
    // New Game+ clears campSeen but not the memories
    const kept = campMemories(['chapter_1', 'chapter_2a', 'chapter_3'], []);
    expect(kept).toEqual(['chapter_1', 'chapter_2a', 'chapter_3']);
    expect(campMemories(kept, ['chapter_2b'])).toEqual(['chapter_1', 'chapter_2a', 'chapter_2b', 'chapter_3']);
    // Junk and duplicates are dropped
    expect(campMemories(['chapter_1', 'chapter_1', '__proto__', 7, 'chapter_99'], [])).toEqual(['chapter_1']);
  });

  it('the JP a scene pays goes into the job the unit is in', () => {
    const u = JobSystem.createUnit('u', 'Rowan', 'player', 'squire', 0, 0, 'N', 3);
    const before = u.jobPoints.squire;
    JobSystem.gainJp(u, 30);
    expect(u.jobPoints.squire).toBe(before + 30);
  });

  it('saves and imports keep the list', () => {
    const save = JSON.stringify({ version: '0.21.0', currentChapterId: 'chapter_3', units: [JobSystem.createUnit('u', 'Rowan', 'player', 'squire', 0, 0, 'N', 3)], campSeen: ['chapter_1', 'x'.repeat(50), 3] });
    expect(SaveManager.parseImport(save).campSeen).toEqual(['chapter_1']);
  });
});

describe('world map places (0.21.0)', () => {
  it('the merchant never sets up at the market or the Gate', () => {
    const stops = merchantStops(Object.keys(CAMPAIGN_CHAPTERS));
    for (const id of stops) expect(['market', 'trials']).not.toContain(worldNode(id)!.kind);
    expect(stops.length).toBe(WORLD_NODES.filter((n) => !n.region && (n.kind === 'mission' || n.kind === 'skirmish')).length);
  });

  it('ships sail for the Far Shore once Chapter VI is won (0.34.0)', () => {
    expect(farShoreOpen(['chapter_5'])).toBe(false);
    expect(farShoreOpen(['chapter_6'])).toBe(true);
    for (const id of ['chapter_7', 'chapter_8']) expect(regionOf(WORLD_NODES.find((n) => n.chapterId === id)!.id)).toBe('shore');
    expect(regionOf(SEA_PORTS.realm)).toBe('realm');
    expect(regionOf(SEA_PORTS.shore)).toBe('shore');
    // The Far Shore's places join up by road, and no road crosses the sea
    expect(route('anchorage', 'frostfang').at(-1)).toBe('frostfang');
    for (const [a, b] of WORLD_ROADS) expect(regionOf(a), `${a}-${b}`).toBe(regionOf(b));
    // The merchant keeps to the realm
    for (const id of merchantStops(Object.keys(CAMPAIGN_CHAPTERS))) expect(regionOf(id)).toBe('realm');
  });

  it('the Far Shore has the finale and a side battle (0.35.0)', () => {
    expect(regionOf(WORLD_NODES.find((n) => n.chapterId === 'chapter_9')!.id)).toBe('shore');
    expect(route('anchorage', 'drowned_city').at(-1)).toBe('drowned_city');
    const glass = WORLD_NODES.find((n) => n.skirmishId === 'glasswing')!;
    expect(regionOf(glass.id)).toBe('shore');
    expect(route('anchorage', glass.id).at(-1)).toBe(glass.id);
    expect(skirmishOpen('glasswing', ['chapter_6'])).toBe(false);
    expect(skirmishOpen('glasswing', ['chapter_7'])).toBe(true);
    // Its trophy and the finale's crown are relics: never sold, found nowhere else
    for (const id of ['glasswing_lance', 'tidecrown']) expect(UNIQUE_ITEMS).toContain(id);
  });
});

describe('merchant route (0.21.0)', () => {
  it('visits every stop in turn, whatever their number', () => {
    for (const cleared of [['chapter_1'], ['chapter_1', 'chapter_2a'], ACT1, Object.keys(CAMPAIGN_CHAPTERS)]) {
      const stops = merchantStops(cleared);
      const seen = new Set<string>();
      for (let w = 0; w < stops.length; w++) seen.add(merchantVisit(cleared, { thornwood: w }, 3, STARTING_ARMORY)!.nodeId);
      expect(seen.size, cleared.join()).toBe(stops.length);
    }
  });

  it('a hand-edited save cannot smuggle "__proto__" in as a won chapter', async () => {
    const { sanitizeCleared } = await import('../src/core/World');
    expect(sanitizeCleared(['chapter_1', '__proto__', 'constructor'], 'chapter_1')).toEqual(['chapter_1']);
  });
});

describe('merchant sales (0.21.0)', () => {
  it('a ware bought stays on the blanket as sold, and nothing new appears until she moves on', async () => {
    const { merchantVisitIndex, sanitizeMerchantSales } = await import('../src/core/Merchant');
    const before = merchantVisit(['chapter_1'], {}, 1, STARTING_ARMORY)!;
    const bought = before.wares[0].id;
    const visit = merchantVisitIndex(['chapter_1'], {});
    const after = merchantVisit(['chapter_1'], {}, 1, [...STARTING_ARMORY, bought], { visit, ids: [bought] })!;
    expect(after.wares.map((w) => w.id)).toEqual(before.wares.map((w) => w.id));
    expect(after.wares.find((w) => w.id === bought)?.sold).toBe(true);
    // Next visit: the sale is forgotten and the owned piece is no longer offered
    const next = merchantVisit(['chapter_1'], { thornwood: 1 }, 1, [...STARTING_ARMORY, bought], { visit, ids: [bought] })!;
    expect(next.wares.map((w) => w.id)).not.toContain(bought);
    expect(next.wares.some((w) => w.sold)).toBe(false);
    expect(sanitizeMerchantSales({ visit: 2.7, ids: ['lucky_coin', '__proto__', 5] })).toEqual({ visit: 2, ids: ['lucky_coin'] });
    expect(sanitizeMerchantSales({ visit: -1, ids: [] })).toBeUndefined();
    expect(sanitizeMerchantSales('nope')).toBeUndefined();
  });
});
