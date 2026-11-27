// AUTO holds back (0.45.0): a squad member with nothing in reach won't walk alone into a spot
// where it would likely fall. Enemies keep pressing forward, as the difficulty sets them.
import { describe, it, expect } from 'vitest';
import { BattleGrid } from '../src/core/Grid';
import { JobSystem } from '../src/core/JobSystem';
import { LETHAL_MARGIN, planTurn, threatMap } from '../src/core/EnemyAI';
import type { MapData } from '../src/data/maps';

const field = (): MapData => {
  const tiles = [];
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) tiles.push({ x, z, height: 1, terrain: 'grass' as const, walkable: true });
  return { id: 'test', name: 'Test', theme: 'day', width: 16, depth: 16, tiles };
};

function setup() {
  const grid = new BattleGrid(field());
  // A squire alone at the south edge; three archers whose reach ends just in front of it: every
  // step forward is deadly, and nothing is close enough to hit this turn
  const squire = JobSystem.createUnit('p1', 'Lone', 'player', 'squire', 7, 15, 'N', 5);
  const archers = [6, 7, 8].map((x, i) => JobSystem.createUnit(`e${i}`, 'Archer', 'enemy', 'archer', x, 5, 'S', 12));
  return { grid, squire, units: [squire, ...archers] };
}

describe('AUTO holds back (0.45.0)', () => {
  it('with holdBack, never ends a walk where it would likely fall', () => {
    const { grid, squire, units } = setup();
    const threat = threatMap(squire, units, grid);
    const plan = planTurn(squire, units, grid, { caution: 'full', holdBack: true });
    expect(plan.ability).toBeNull(); // nothing in reach: it walks
    expect(threat(plan.moveTo.x, plan.moveTo.z) * LETHAL_MARGIN).toBeLessThan(squire.currentHp);
  });

  it('without it (an enemy, or the old AUTO) a healthy unit walks on into reach', () => {
    const { grid, squire, units } = setup();
    const threat = threatMap(squire, units, grid);
    const plan = planTurn(squire, units, grid, { caution: 'full' });
    const held = planTurn(squire, units, grid, { caution: 'full', holdBack: true });
    // it walks into the archers' reach, where it would very likely fall; held back, it waits
    expect(plan.moveTo.z).toBeLessThan(held.moveTo.z);
    expect(threat(plan.moveTo.x, plan.moveTo.z)).toBeGreaterThan(squire.currentHp);
    expect(threat(held.moveTo.x, held.moveTo.z)).toBe(0);
  });
});
