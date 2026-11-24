/**
 * 0.20.0: the enemy planner walks around cliffs, faces its foes, respects parries and drops
 * healers and buffers first.
 */
import { describe, it, expect } from 'vitest';
import { JOBS } from '../src/data/jobs';
import { MapData } from '../src/data/maps';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { faceTowards, isSupportCaster, planTurn, walkingDistances } from '../src/core/EnemyAI';
import { Unit } from '../src/core/types';

function unit(job: string, team: 'player' | 'enemy' = 'player', x = 0, z = 0, level = 5): Unit {
  const u = JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
  for (const a of JOBS[job].abilities) u.unlockedAbilities[a.id] = true;
  return u;
}

type Tile = { x: number; z: number; height: number; terrain: string; walkable: boolean };
function map(size: number, edit: (t: Tile) => void = () => {}): BattleGrid {
  const tiles: Tile[] = [];
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) {
    const t = { x, z, height: 1, terrain: 'grass', walkable: true };
    edit(t);
    tiles.push(t);
  }
  return new BattleGrid({ id: 't', name: 'T', width: size, depth: size, tiles } as unknown as MapData);
}

describe('walking distance (0.20.0)', () => {
  it('goes around a cliff rather than through it', () => {
    // A wall of height 8 along x = 2, with one gap at z = 5
    const grid = map(6, (t) => { if (t.x === 2 && t.z !== 5) t.height = 8; });
    const walker = unit('knight', 'enemy', 4, 0);
    const d = walkingDistances(grid, { x: 0, z: 0 }, walker);
    expect(d.get('1,0')).toBe(1);
    expect(d.get('2,0')).toBeUndefined(); // the cliff top can't be reached
    expect(d.get('4,0')).toBe(5 + 4 + 5); // down to the gap, across, back up
  });

  it('a shallow step within Jump costs nothing extra; water costs double unless the unit water-walks', () => {
    const grid = map(5, (t) => { if (t.z === 0 && t.x === 2) t.terrain = 'water'; if (t.z === 0 && t.x === 3) t.height = 2; });
    const walker = unit('knight', 'enemy', 4, 0);
    expect(walkingDistances(grid, { x: 0, z: 0 }, walker).get('4,0')).toBe(5);
    walker.equippedAbilities.movement = 'ni_water_walk';
    expect(walkingDistances(grid, { x: 0, z: 0 }, walker).get('4,0')).toBe(4);
  });
});

describe('enemy planner (0.20.0)', () => {
  it('ends its turn facing the closest foe', () => {
    const grid = map(10);
    const foe = unit('knight', 'player', 1, 8);
    const knight = unit('knight', 'enemy', 8, 1);
    const plan = planTurn(knight, [knight, foe], grid);
    expect(plan.facing).toBe(faceTowards(plan.moveTo.x, plan.moveTo.z, foe.x, foe.z));
  });

  it('approaches along the path, not toward a foe behind a cliff it cannot climb', () => {
    // The foe stands just past a cliff; the only way round is the gap at z = 9
    const grid = map(10, (t) => { if (t.x === 5 && t.z !== 9) t.height = 9; });
    const foe = unit('archer', 'player', 6, 0);
    const knight = unit('knight', 'enemy', 2, 0);
    const plan = planTurn(knight, [knight, foe], grid);
    expect(plan.moveTo.z).toBeGreaterThan(0); // heads for the gap instead of hugging the wall
  });

  it('values a frontal blow on a parrying knight less', () => {
    const grid = map(6);
    const scoreVs = (parry: boolean) => {
      const knight = unit('knight', 'player', 2, 3);
      knight.facing = 'N'; // the attacker stands to the north: a frontal hit
      knight.equippedAbilities.reaction = parry ? 'kn_parry' : '';
      const attacker = JobSystem.createUnit('a', 'A', 'enemy', 'squire', 2, 2, 'S', 5);
      attacker.unlockedAbilities = {}; // a plain Attack only
      attacker.move = 0;
      return planTurn(attacker, [attacker, knight], grid).score;
    };
    expect(scoreVs(true)).toBeLessThan(scoreVs(false));
  });

  it('recognises healers and buffers while they can still cast', () => {
    const wm = unit('white_mage', 'enemy');
    expect(isSupportCaster(wm)).toBe(true);
    expect(isSupportCaster(unit('time_mage', 'enemy'))).toBe(true);
    expect(isSupportCaster(unit('knight', 'enemy'))).toBe(false); // Bulwark guards only itself
    wm.statuses.push({ type: 'silence', duration: 2 } as Unit['statuses'][number]);
    expect(isSupportCaster(wm)).toBe(false);
    wm.statuses = [];
    wm.currentMp = 0;
    expect(isSupportCaster(wm)).toBe(false);
  });

  it('given two otherwise identical targets, shoots the one that can still heal', () => {
    for (const healerOnLeft of [true, false]) {
      const grid = map(9);
      const left = unit('white_mage', 'player', 2, 6);
      const right = unit('white_mage', 'player', 6, 6);
      (healerOnLeft ? right : left).currentMp = 0;
      const archer = unit('archer', 'enemy', 4, 1);
      const plan = planTurn(archer, [archer, left, right], grid);
      expect(plan.ability).not.toBeNull();
      expect(plan.targetTile).toEqual(healerOnLeft ? { x: 2, z: 6 } : { x: 6, z: 6 });
    }
  });
});

describe('Chapter III roster (0.20.0)', () => {
  it('the Summit keeps its boss and medic but no longer stacks a Haste caster on top', () => {
    const jobs = CAMPAIGN_CHAPTERS.chapter_3.enemyRoster.map((e) => e.jobId);
    expect(jobs).toContain('dragoon');
    expect(jobs).toContain('white_mage');
    expect(jobs).not.toContain('time_mage');
    expect(CAMPAIGN_CHAPTERS.chapter_3.enemyRoster.filter((e) => e.isBoss)).toHaveLength(1);
  });
});

describe('text size setting (0.20.0)', () => {
  it('cycles Normal → Large → Larger → Normal and ignores junk from storage', async () => {
    const { nextTextSize, sanitizeTextSize } = await import('../src/ui/TextSize');
    expect(nextTextSize('normal')).toBe('large');
    expect(nextTextSize('large')).toBe('larger');
    expect(nextTextSize('larger')).toBe('normal');
    for (const junk of [null, '', 'huge', 3, '__proto__']) expect(sanitizeTextSize(junk)).toBe('normal');
    expect(sanitizeTextSize('larger')).toBe('larger');
  });

  it('every fixed UI font size in the stylesheet scales with the setting', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    const fixed = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].filter((m) => Number(m[1]) <= 22);
    expect(fixed.map((m) => m[0])).toEqual([]);
    expect(css).toMatch(/html\[data-text-size="larger"\]\s*\{\s*--ts:/);
  });
});
