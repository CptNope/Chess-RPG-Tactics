/**
 * 0.18.0: difficulty, save slots, and importing a save from a file someone handed you.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { JOBS } from '../src/data/jobs';
import { ITEMS } from '../src/data/items';
import { JobSystem } from '../src/core/JobSystem';
import { DIFFICULTIES, DIFFICULTY_ORDER, enemyLevel, sanitizeDifficulty, scaleBoss } from '../src/core/Difficulty';
import { SaveManager, SAVE_SLOTS, MAX_IMPORT_BYTES, cleanName } from '../src/core/SaveManager';
import { MAX_SQUAD } from '../src/core/Recruits';

// A small in-memory localStorage (the tests run in Node)
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
beforeEach(() => { (globalThis as any).localStorage = new MemoryStorage(); });

const squad = () => {
  const a = JobSystem.createUnit('p1', 'Rowan', 'player', 'knight', 0, 0, 'N', 6);
  const b = JobSystem.createUnit('p2', 'Maren', 'player', 'white_mage', 0, 0, 'N', 7);
  b.unlockedAbilities.wm_raise = true;
  b.equipment.accessory = ITEMS.warding_amulet;
  return [a, b];
};

describe('difficulty', () => {
  it('runs easy → normal → hard on every dial', () => {
    expect(DIFFICULTY_ORDER).toEqual(['easy', 'normal', 'hard']);
    const [e, n, h] = DIFFICULTY_ORDER.map((d) => DIFFICULTIES[d]);
    expect(e.levelShift).toBeLessThan(n.levelShift);
    expect(n.levelShift).toBeLessThan(h.levelShift);
    expect(e.raiseCap).toBeLessThan(n.raiseCap);
    expect(n.raiseCap).toBeLessThan(h.raiseCap);
    expect(e.bossHp).toBeLessThan(n.bossHp);
    expect(n.bossHp).toBeLessThan(h.bossHp);
    expect(n).toMatchObject({ levelShift: 0, raiseCap: 1, bossHp: 1 }); // Normal is the game as tuned
  });

  it('shifts enemy levels, never below 1, and old saves play on Normal', () => {
    expect(enemyLevel(5, 'easy')).toBe(4);
    expect(enemyLevel(5, 'normal')).toBe(5);
    expect(enemyLevel(5, 'hard')).toBe(6);
    expect(enemyLevel(1, 'easy')).toBe(1);
    expect(sanitizeDifficulty(undefined)).toBe('normal');
    expect(sanitizeDifficulty('HARD')).toBe('normal');
    expect(sanitizeDifficulty('hard')).toBe('hard');
  });

  it('scales a boss\'s HP and nobody else\'s', () => {
    const make = () => { const u = JobSystem.createUnit('b', 'Boss', 'enemy', 'paladin', 0, 0, 'S', 9); JobSystem.makeBoss(u); return u; };
    const normal = make().maxHp;
    const easy = make(); scaleBoss(easy, 'easy');
    const hard = make(); scaleBoss(hard, 'hard');
    expect(easy.maxHp).toBeLessThan(normal);
    expect(hard.maxHp).toBeGreaterThan(normal);
    expect(easy.currentHp).toBe(easy.maxHp);
    const grunt = JobSystem.createUnit('g', 'Grunt', 'enemy', 'knight', 0, 0, 'S', 9);
    const hp = grunt.maxHp;
    scaleBoss(grunt, 'easy');
    expect(grunt.maxHp).toBe(hp);
  });
});

describe('save slots', () => {
  it('slot 1 is the save every earlier version wrote', () => {
    localStorage.setItem('chess_rpg_tactics_save_v1', JSON.stringify({ version: '0.14.0', timestamp: 1, currentChapterId: 'chapter_2a', units: squad() }));
    expect(SaveManager.hasSave(1)).toBe(true);
    expect(SaveManager.loadGame(1)?.currentChapterId).toBe('chapter_2a');
    expect(SaveManager.loadGame()?.currentChapterId).toBe('chapter_2a');
    expect(SaveManager.slotsInUse()).toEqual([1]);
  });

  it('slots are independent; Continue picks the newest; New Game the first empty', () => {
    expect(SAVE_SLOTS).toBe(3);
    expect(SaveManager.hasSave()).toBe(false);
    expect(SaveManager.latestSlot()).toBeNull();
    expect(SaveManager.firstEmptySlot()).toBe(1);
    expect(SaveManager.saveGame('chapter_1', squad(), { gil: 100 }, 1)).toBe(true);
    expect(SaveManager.saveGame('chapter_4', squad(), { gil: 900, difficulty: 'hard' }, 3)).toBe(true);
    expect(SaveManager.slotsInUse()).toEqual([1, 3]);
    expect(SaveManager.firstEmptySlot()).toBe(2);
    expect(SaveManager.loadGame(3)).toMatchObject({ currentChapterId: 'chapter_4', gil: 900, difficulty: 'hard' });
    expect(SaveManager.loadGame(2)).toBeNull();
    // Newest wins
    const s1 = JSON.parse(localStorage.getItem('chess_rpg_tactics_save_v1')!);
    s1.timestamp = Date.now() + 60_000;
    localStorage.setItem('chess_rpg_tactics_save_v1', JSON.stringify(s1));
    expect(SaveManager.latestSlot()).toBe(1);
    SaveManager.saveGame('chapter_2b', squad(), {}, 2);
    expect(SaveManager.firstEmptySlot()).toBeNull();
    SaveManager.clearSave(1);
    expect(SaveManager.slotsInUse()).toEqual([2, 3]);
    expect(SaveManager.latestSlot()).not.toBe(1);
  });

  it('ignores slot numbers that don\'t exist', () => {
    for (const bad of [0, 4, -1, 1.5, NaN]) {
      expect(SaveManager.saveGame('chapter_1', squad(), {}, bad)).toBe(false);
      expect(SaveManager.loadGame(bad)).toBeNull();
      expect(SaveManager.hasSave(bad)).toBe(false);
      expect(SaveManager.exportSave(bad)).toBeNull();
    }
    expect(localStorage.length).toBe(0);
  });
});

describe('importing a save', () => {
  const exported = () => {
    SaveManager.saveGame('chapter_4', squad(), {
      armory: ['iron_sword', 'warding_amulet'], gil: 1234, inventory: { potion: 3 }, clearedChapters: ['chapter_1', 'chapter_2a', 'chapter_3'],
      onWorldMap: true, worldLocation: 'harbor', skirmishWins: { thornwood: 2 }, difficulty: 'easy', campaignCleared: false
    }, 2);
    return SaveManager.exportSave(2)!;
  };

  it('round-trips an exported save', () => {
    const d = SaveManager.parseImport(exported());
    expect(d).toMatchObject({ currentChapterId: 'chapter_4', gil: 1234, inventory: { potion: 3 }, onWorldMap: true, worldLocation: 'harbor', skirmishWins: { thornwood: 2 }, difficulty: 'easy', mode: 'campaign' });
    expect(d.clearedChapters).toEqual(['chapter_1', 'chapter_2a', 'chapter_3']);
    expect(d.armory).toEqual(['iron_sword', 'warding_amulet']);
    expect(d.units.map((u) => [u.name, u.jobId, u.level])).toEqual([['Rowan', 'knight', 6], ['Maren', 'white_mage', 7]]);
    expect(d.units[1].unlockedAbilities.wm_raise).toBe(true);
    expect(d.units[1].equipment.accessory?.id).toBe('warding_amulet');
    expect(SaveManager.writeSlot(3, d)).toBe(true);
    expect(SaveManager.loadGame(3)?.units[0].name).toBe('Rowan');
  });

  it('refuses things that aren\'t saves, with a message a player can read', () => {
    for (const bad of ['', '   ', 'hello', '[]', '42', 'null', '{"units": []}', '{"units": [], "currentChapterId": "chapter_1"}', '{"units": [{"team": "enemy"}], "currentChapterId": "chapter_1"}']) {
      expect(() => SaveManager.parseImport(bad), bad).toThrow(/save|import/i);
    }
    expect(() => SaveManager.parseImport('x'.repeat(MAX_IMPORT_BYTES + 1))).toThrow(/too large/);
  });

  it('keeps only what the game knows from a hostile file', () => {
    const evil = {
      currentChapterId: 'chapter_1', version: '<b>9</b>'.repeat(10), timestamp: 'soon', gil: 1e15, trialsFloor: -5, mode: 'god',
      difficulty: 'nightmare', armory: ['iron_sword', 'not_an_item', 12, '__proto__'], inventory: { potion: 1e9, '<img src=x>': 3, ether: -4 },
      units: [
        { team: 'player', jobId: '__proto__', name: 'Proto', level: 2, equipment: { weapon: { id: '__proto__' } } },
        { team: 'player', id: '"><svg onload=alert(1)>', name: '<img src=x onerror=alert(1)>Rowan', jobId: 'god_emperor', level: 1e6, exp: -50,
          baseStats: { hp: 1e9, mp: 'lots', attack: -3, magic: 5, speed: NaN },
          jobPoints: { knight: 1e12, __proto__: 5, wizard: 9 }, unlockedAbilities: { wm_raise: true, delete_everything: true, kn_parry: 'yes' },
          equippedAbilities: { secondaryJobId: 'wizard', reaction: 'kn_parry', support: 'delete_everything' },
          equipment: { weapon: { id: 'not_an_item' }, head: { id: 'iron_sword' }, accessory: { id: 'warding_amulet', stats: { attack: 9999 } } } },
        ...Array.from({ length: 20 }, (_, i) => ({ team: 'player', name: `U${i}`, jobId: 'archer', level: 3 }))
      ]
    };
    const d = SaveManager.parseImport(JSON.stringify(evil));
    expect(d.units.length).toBe(MAX_SQUAD); // a squad (the barracks hold 10, 0.25.0), not an army
    expect(d.units[0].jobId).toBe('squire'); // a job id that would reach Object.prototype
    expect(d.units[0].equipment.weapon?.id).not.toBe('__proto__');
    const u = d.units[1];
    expect(u.name).toBe('img srcx onerror'); // tags and symbols gone, cut to 16
    expect(u.name).not.toMatch(/[<>"=()]/);
    expect(u.id).toBe('imported-1');
    expect(u.jobId).toBe('squire');
    expect(u.level).toBe(99);
    expect(u.exp).toBe(0);
    expect(u.baseStats.hp).toBe(9999);
    expect(u.baseStats.attack).toBe(1);
    expect(u.jobPoints.knight).toBe(999_999);
    expect(Object.keys(u.jobPoints).every((k) => !!JOBS[k])).toBe(true);
    expect(u.unlockedAbilities.wm_raise).toBe(true);
    expect(u.unlockedAbilities.delete_everything).toBeUndefined();
    expect(u.unlockedAbilities.kn_parry).toBeFalsy(); // 'yes' isn't true
    expect(u.equippedAbilities.secondaryJobId).toBeNull();
    expect(u.equippedAbilities.reaction).toBeNull(); // not learned
    expect(u.equippedAbilities.support).toBeNull();
    expect(u.equipment.weapon?.id).not.toBe('not_an_item');
    expect(u.equipment.head?.id).not.toBe('iron_sword'); // a sword isn't a hat
    expect(u.equipment.accessory).toBe(ITEMS.warding_amulet); // the real item, not the file's stats
    expect(d.gil).toBe(9_999_999);
    expect(d.trialsFloor).toBe(0);
    expect(d.mode).toBe('campaign');
    expect(d.difficulty).toBe('normal');
    expect(d.armory).toEqual(['iron_sword']);
    expect(d.inventory).toEqual({ potion: 999, ether: 0 });
    expect(d.version.length).toBeLessThanOrEqual(12);
    expect(typeof d.timestamp).toBe('number');
    expect(({} as any).polluted).toBeUndefined();
  });

  it('cleans names down to plain text', () => {
    expect(cleanName('Sable', 'x')).toBe('Sable');
    expect(cleanName("O'Brien-Smith Jr.", 'x')).toBe("O'Brien-Smith Jr");
    expect(cleanName('Éowyn', 'x')).toBe('Éowyn');
    expect(cleanName('<script>', 'Ally')).toBe('script');
    expect(cleanName('<>', 'Ally')).toBe('Ally');
    expect(cleanName(42, 'Ally')).toBe('Ally');
    expect(cleanName('a'.repeat(40), 'x').length).toBe(16);
  });
});
