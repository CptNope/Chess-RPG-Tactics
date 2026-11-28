// The Knight after the mirror duels (0.58.0), and the squad's pace toward a hold zone.
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { planTurn } from '../src/core/EnemyAI';
import { zoneKeys } from '../src/core/Hazards';
import { JOBS } from '../src/data/jobs';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import type { MapData } from '../src/data/maps';
import type { TileData } from '../src/core/types';

const field = (paint: (t: TileData) => void = () => {}): MapData => {
  const tiles: TileData[] = [];
  for (let z = 0; z < 12; z++) for (let x = 0; x < 12; x++) { const t: TileData = { x, z, height: 1, terrain: 'grass', walkable: true }; paint(t); tiles.push(t); }
  return { id: 'test', name: 'Test', theme: 'day', width: 12, depth: 12, tiles };
};

describe('the Knight, after the mirror duels (0.58.0)', () => {
  it('moves 4 (it lost stand-up fights to anything with reach), still jumps 2 in plate', () => {
    expect(JOBS.knight.baseMove).toBe(4);
    expect(JOBS.knight.baseJump).toBe(2);
    const k = JobSystem.createUnit('k', 'Maren', 'player', 'knight', 6, 6, 'N', 5);
    expect(k.move).toBe(4);
    expect(CAMPAIGN_CHAPTERS.chapter_1.enemyRoster.find((e) => e.isBoss)).toMatchObject({ name: 'Bandit Chief', level: 2 });
  });

  it('the squad heads for a hold zone at the pace of the fight, not ahead of it', () => {
    // The zone is straight ahead, the foe off to the side: the walk splits the difference
    const grid = new BattleGrid(field((t) => { if (t.z <= 1 && t.x >= 5 && t.x <= 6) t.zone = true; }));
    const zone = zoneKeys(grid.mapData.tiles);
    const k = JobSystem.createUnit('k', 'Maren', 'player', 'knight', 5, 10, 'N', 5);
    const foe = JobSystem.createUnit('e', 'Foe', 'enemy', 'knight', 11, 9, 'S', 5);
    const plain = planTurn(k, [k, foe], grid);
    const holding = planTurn(k, [k, foe], grid, { zone });
    const toZone = (m: { x: number; z: number }) => Math.min(...[...zone].map((key) => { const [x, z] = key.split(',').map(Number); return Math.abs(x - m.x) + Math.abs(z - m.z); }));
    expect(toZone(holding.moveTo)).toBeLessThan(toZone(plain.moveTo)); // it does lean toward the zone...
    expect(toZone(holding.moveTo)).toBeGreaterThan(toZone({ x: 5, z: 6 })); // ...but doesn't race 4 tiles straight at it
  });
});
