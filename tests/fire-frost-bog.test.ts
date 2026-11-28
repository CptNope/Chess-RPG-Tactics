// Creatures of fire, frost and bog (0.51.0): each makes one kind of ground, and two thrive on theirs.
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { CombatEngine } from '../src/core/CombatEngine';
import { TurnManager } from '../src/core/TurnManager';
import { planTurn } from '../src/core/EnemyAI';
import { applyHazard, groundFrom } from '../src/core/Hazards';
import { BEAST_NAMES } from '../src/core/Taming';
import { buildTrialFloor, TRIAL_DEEPER_MONSTERS_FROM } from '../src/core/Trials';
import { SKIRMISHES } from '../src/core/Skirmish';
import { MONSTERS } from '../src/data/monsters';
import type { MapData } from '../src/data/maps';
import type { TileData } from '../src/core/types';

const NEW = ['salamander', 'frost_sprite', 'bog_lurker'];
const field = (paint: (t: TileData) => void = () => {}): MapData => {
  const tiles: TileData[] = [];
  for (let z = 0; z < 10; z++) for (let x = 0; x < 10; x++) { const t: TileData = { x, z, height: 1, terrain: 'grass', walkable: true }; paint(t); tiles.push(t); }
  return { id: 'test', name: 'Test', theme: 'day', width: 10, depth: 10, tiles };
};
const tile = (hazard: TileData['hazard']): TileData => ({ x: 0, z: 0, height: 1, terrain: 'stone', walkable: true, hazard });
const status = (u: Parameters<typeof CombatEngine.applyStatus>[0], s: Parameters<typeof CombatEngine.applyStatus>[1]) => CombatEngine.applyStatus(u, s);

describe('creatures of fire, frost and bog (0.51.0)', () => {
  it('each makes its own ground: the salamander embers, the sprite puts them out, the lurker miasma', () => {
    const ab = (m: string, id: string) => MONSTERS[m].abilities.find((a) => a.id === id)!;
    expect(groundFrom(ab('salamander', 'mon_flame_spit'))).toBe('embers');
    expect(groundFrom(ab('salamander', 'mon_kindle'))).toBe('embers');
    expect(groundFrom(ab('frost_sprite', 'mon_rime_burst'))).toBe('douse');
    expect(groundFrom(ab('frost_sprite', 'mon_hoarfrost'))).toBe('douse');
    expect(CombatEngine.isSupportive(ab('frost_sprite', 'mon_hoarfrost'))).toBe(true);
    expect(groundFrom(ab('bog_lurker', 'mon_venom_spit'))).toBe('miasma');
    for (const m of NEW) expect(MONSTERS[m].monster).toBe(true);
  });

  it('a salamander basks in embers and a lurker breathes miasma: healed, not hurt', () => {
    const sal = JobSystem.createUnit('e1', 'Sal', 'enemy', 'salamander', 0, 0, 'S', 8);
    sal.currentHp = Math.round(sal.maxHp / 2);
    const hp = sal.currentHp;
    const p = applyHazard(sal, tile('embers'), status)!;
    expect(p).toMatchObject({ kind: 'embers', thrives: true });
    expect(sal.currentHp).toBe(hp + p.heal!);
    const lurk = JobSystem.createUnit('e2', 'Lurk', 'enemy', 'bog_lurker', 0, 0, 'S', 8);
    lurk.currentHp = lurk.maxHp - 5;
    expect(applyHazard(lurk, tile('miasma'), status)).toMatchObject({ kind: 'miasma', heal: 5, thrives: true });
    expect(lurk.statuses.some((s) => s.type === 'poison')).toBe(false);
    // but embers still burn a lurker, and a full-health salamander gets nothing
    const before = lurk.currentHp;
    applyHazard(lurk, tile('embers'), status);
    expect(lurk.currentHp).toBeLessThan(before);
    sal.currentHp = sal.maxHp;
    expect(applyHazard(sal, tile('embers'), status)).toBeNull();
  });

  it('a hurt salamander heads for burning ground', () => {
    const grid = new BattleGrid(field((t) => { if (t.x === 3 && t.z === 2) t.hazard = 'embers'; }));
    const sal = JobSystem.createUnit('e1', 'Sal', 'enemy', 'salamander', 2, 2, 'S', 8);
    sal.currentHp = Math.round(sal.maxHp * 0.4);
    const far = JobSystem.createUnit('p1', 'Rowan', 'player', 'knight', 9, 9, 'N', 8);
    const plan = planTurn(sal, [sal, far], grid);
    expect(plan.moveTo).toMatchObject({ x: 3, z: 2 });
    const tick = TurnManager.startOfTurn(Object.assign(sal, { x: 3, z: 2 }), [sal, far], grid);
    expect(tick.hazard).toMatchObject({ thrives: true });
  });

  it('they can be tamed, join two side battles each... and the Trials from floor 13 only', () => {
    for (const m of NEW) expect(BEAST_NAMES[m]?.length).toBeGreaterThan(0);
    expect(SKIRMISHES.cinder.jobs.some(([j]) => j === 'salamander')).toBe(true);
    expect(SKIRMISHES.hollow.jobs.some(([j]) => j === 'bog_lurker')).toBe(true);
    expect(SKIRMISHES.barrow.jobs.some(([j]) => j === 'frost_sprite')).toBe(true);
    expect(TRIAL_DEEPER_MONSTERS_FROM).toBe(13);
    const jobsOn = (f: number) => buildTrialFloor(f).enemyRoster.map((e) => e.jobId);
    for (let f = 1; f < TRIAL_DEEPER_MONSTERS_FROM; f++) expect(jobsOn(f).some((j) => NEW.includes(j)), `floor ${f}`).toBe(false);
    const deeper = Array.from({ length: 12 }, (_, i) => jobsOn(TRIAL_DEEPER_MONSTERS_FROM + i)).flat();
    expect(deeper.some((j) => NEW.includes(j))).toBe(true);
  });
});
