// Spells that change the ground (0.50.0): fire leaves embers, ice puts them out, poison lingers.
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { Battle } from '../src/core/Battle';
import { TurnManager } from '../src/core/TurnManager';
import { groundWorth } from '../src/core/EnemyAI';
import { CAMPAIGN_RULES } from '../src/core/Rules';
import { DOUSE_ROUNDS, SCORCH_ROUNDS, changeGround, groundFrom, tickGround } from '../src/core/Hazards';
import { JOBS } from '../src/data/jobs';
import type { MapData } from '../src/data/maps';
import type { Ability, TileData } from '../src/core/types';

const field = (paint: (t: TileData) => void = () => {}): MapData => {
  const tiles: TileData[] = [];
  for (let z = 0; z < 10; z++) for (let x = 0; x < 10; x++) { const t: TileData = { x, z, height: 1, terrain: 'grass', walkable: true }; paint(t); tiles.push(t); }
  return { id: 'test', name: 'Test', theme: 'day', width: 10, depth: 10, tiles };
};
const ab = (job: string, id: string): Ability => JOBS[job].abilities.find((a) => a.id === id)!;

describe('spells that change the ground (0.50.0)', () => {
  it('by rule: fire with an area burns, ice with an area douses, Poison lingers, the rest leave it be', () => {
    expect(groundFrom(ab('black_mage', 'bm_fire'))).toBe('embers');
    expect(groundFrom(ab('black_mage', 'bm_firestorm'))).toBe('embers');
    expect(groundFrom(ab('black_mage', 'bm_blizzard'))).toBe('douse');
    expect(groundFrom(ab('black_mage', 'bm_poison'))).toBe('miasma');
    expect(groundFrom(ab('spellblade', 'sb_flame_edge'))).toBeNull(); // fire, but on one foe
    expect(groundFrom(ab('white_mage', 'wm_cure'))).toBeNull();
  });

  it('fire leaves embers over its area for 2 rounds, never on water, snow or a spring', () => {
    const grid = new BattleGrid(field((t) => {
      if (t.x === 4 && t.z === 5) t.terrain = 'water';
      if (t.x === 6 && t.z === 5) t.hazard = 'spring';
    }));
    const changed = changeGround((x, z) => grid.getTile(x, z), ab('black_mage', 'bm_fire'), 5, 5);
    expect(changed.map((c) => `${c.x},${c.z}`).sort()).toEqual(['5,4', '5,5', '5,6']);
    expect(grid.getTile(6, 5)!.hazard).toBe('spring');
    for (let r = 0; r < SCORCH_ROUNDS - 1; r++) expect(tickGround(grid.mapData.tiles)).toEqual([]);
    expect(tickGround(grid.mapData.tiles)).toHaveLength(3);
    expect(grid.getTile(5, 5)!.hazard).toBeUndefined();
  });

  it("ice puts out even a map's own embers for 3 rounds, then they come back", () => {
    const grid = new BattleGrid(field((t) => { if (t.z === 2) t.hazard = 'embers'; }));
    const out = changeGround((x, z) => grid.getTile(x, z), ab('black_mage', 'bm_blizzard'), 3, 2);
    expect(out).toHaveLength(3); // (2,2) (3,2) (4,2): only the burning tiles
    expect(grid.getTile(3, 2)!.hazard).toBeUndefined();
    for (let r = 0; r < DOUSE_ROUNDS; r++) tickGround(grid.mapData.tiles);
    expect(grid.getTile(3, 2)!.hazard).toBe('embers');
    expect(grid.getTile(3, 2)!.temp).toBeUndefined();
  });

  it('a Poison cloud lingers as miasma, but not over fire', () => {
    const grid = new BattleGrid(field((t) => { if (t.x === 1) t.hazard = 'embers'; }));
    expect(changeGround((x, z) => grid.getTile(x, z), ab('black_mage', 'bm_poison'), 5, 5)).toEqual([{ x: 5, z: 5, hazard: 'miasma' }]);
    expect(changeGround((x, z) => grid.getTile(x, z), ab('black_mage', 'bm_poison'), 1, 5)).toEqual([]);
  });

  it('a cast Fire marks the ground, the engine records it, and the embers burn whoever starts a turn there', () => {
    const grid = new BattleGrid(field());
    const mage = JobSystem.createUnit('p1', 'Vivi', 'player', 'black_mage', 5, 1, 'S', 8);
    mage.unlockedAbilities.bm_fire = true;
    const foe = JobSystem.createUnit('e1', 'Brute', 'enemy', 'knight', 5, 4, 'N', 8);
    const units = [mage, foe];
    const battle = new Battle({ units, grid, seed: 5, rules: CAMPAIGN_RULES });
    for (const u of units) u.ct = u === mage ? 100 : 0;
    expect(battle.nextTurn()).toBe(mage);
    const fire = JobSystem.getCombatActionAbilities(mage).find((a) => a.id === 'bm_fire')!;
    const ev = battle.apply({ moveTo: { x: 5, z: 1 }, ability: fire, target: { x: 5, z: 4 }, facing: 'S' });
    expect(ev.find((e) => e.t === 'ground')).toBeTruthy();
    expect(grid.getTile(5, 4)!.hazard).toBe('embers');
    const hp = foe.currentHp;
    const tick = TurnManager.startOfTurn(foe, units, grid);
    expect(tick.hazard?.kind).toBe('embers');
    expect(foe.currentHp).toBeLessThan(hp);
  });

  it("the AI counts a spell's mark: embers under foes a little, under allies a cost", () => {
    const grid = new BattleGrid(field());
    const mage = JobSystem.createUnit('e1', 'Hexer', 'enemy', 'black_mage', 5, 0, 'S', 8);
    const foe = JobSystem.createUnit('p1', 'Rowan', 'player', 'knight', 5, 5, 'N', 8);
    const pal = JobSystem.createUnit('e2', 'Guard', 'enemy', 'knight', 5, 6, 'N', 8);
    const fire = ab('black_mage', 'bm_fire');
    expect(groundWorth(mage, fire, 5, 4, [mage, foe, pal], grid)).toBeGreaterThan(0);
    expect(groundWorth(mage, fire, 5, 6, [mage, foe, pal], grid)).toBeLessThan(0);
  });
});
