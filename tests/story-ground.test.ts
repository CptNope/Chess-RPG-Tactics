// Ground in the story (0.53.0): hazards on story maps, Chapter II-B's gate to hold, traps the
// defenders laid with the map, and the Workshop's trap painting.
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { ActionContext, walkInto } from '../src/core/Action';
import { planTurn } from '../src/core/EnemyAI';
import { seededRng } from '../src/core/Rng';
import { CAMPAIGN_RULES } from '../src/core/Rules';
import { zoneKeys } from '../src/core/Hazards';
import { layMapTraps } from '../src/core/Traps';
import { blankScenario, packForShare, sanitizeScenario, unpackShare, validateScenario } from '../src/core/Scenario';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { MAPS } from '../src/data/maps';
import type { MapData } from '../src/data/maps';
import type { TileData } from '../src/core/types';

const field = (paint: (t: TileData) => void = () => {}): MapData => {
  const tiles: TileData[] = [];
  for (let z = 0; z < 10; z++) for (let x = 0; x < 10; x++) { const t: TileData = { x, z, height: 1, terrain: 'grass', walkable: true }; paint(t); tiles.push(t); }
  return { id: 'test', name: 'Test', theme: 'day', width: 10, depth: 10, tiles };
};
const tilesWith = (mapId: string, f: (t: TileData) => boolean) => MAPS[mapId]().tiles.filter(f);

describe('ground in the story (0.53.0)', () => {
  it('the Gloomy Mire has the warlock\'s miasma and a clean spring; the harbor burns', () => {
    expect(tilesWith('gloomy_swamp', (t) => t.hazard === 'miasma').length).toBeGreaterThanOrEqual(4);
    expect(tilesWith('gloomy_swamp', (t) => t.hazard === 'spring').length).toBeGreaterThanOrEqual(1);
    const embers = tilesWith('ember_harbor', (t) => t.hazard === 'embers');
    expect(embers.length).toBeGreaterThanOrEqual(4);
    for (const t of [...embers, ...tilesWith('gloomy_swamp', (t) => !!t.hazard)]) expect(t.walkable).toBe(true);
  });

  it('Chapter II-B asks the squad to hold the gate, where the defenders dug in traps', () => {
    expect(CAMPAIGN_CHAPTERS.chapter_2b.objective).toEqual({ type: 'hold', rounds: 3 });
    const zone = tilesWith('night_fortress', (t) => !!t.zone);
    expect(zone.length).toBe(4);
    expect(zone.every((t) => t.walkable)).toBe(true);
    const traps = tilesWith('night_fortress', (t) => !!t.trap);
    expect(traps.map((t) => t.trap).sort()).toEqual(['snare', 'spikes']);
    expect(traps.every((t) => t.walkable && !t.zone)).toBe(true);
    // ... and no other chapter's objective changed
    expect(Object.values(CAMPAIGN_CHAPTERS).filter((c) => c.objective?.type === 'hold').map((c) => c.id)).toEqual(['chapter_2b']);
  });

  it('the boss keeps the map\'s traps (else the first enemy), and the squad walks into them', () => {
    const grid = new BattleGrid(field((t) => { if (t.x === 4 && t.z === 6) t.trap = 'snare'; if (t.x === 1 && t.z === 1) { t.trap = 'spikes'; t.walkable = false; } }));
    const grunt = JobSystem.createUnit('e1', 'Grunt', 'enemy', 'knight', 8, 0, 'S', 5);
    const boss = JobSystem.createUnit('e2', 'Boss', 'enemy', 'dragoon', 7, 0, 'S', 5);
    JobSystem.makeBoss(boss);
    expect(layMapTraps([grunt, boss], grid.mapData.tiles)).toBe(1); // the blocked tile's is left out
    expect(boss.traps).toEqual([{ kind: 'snare', x: 4, z: 6 }]);
    expect(grunt.traps).toBeUndefined();
    const lone = JobSystem.createUnit('e3', 'Lone', 'enemy', 'archer', 0, 0, 'S', 5);
    layMapTraps([lone], grid.mapData.tiles);
    expect(lone.traps).toHaveLength(1);
    expect(layMapTraps([], grid.mapData.tiles)).toBe(0);

    const rowan = JobSystem.createUnit('p1', 'Rowan', 'player', 'knight', 4, 8, 'N', 5);
    const units = [rowan, grunt, boss];
    const ctx: ActionContext = { units, grid, rng: seededRng(3), rules: CAMPAIGN_RULES, pouchOf: () => ({}) };
    expect(walkInto(ctx, grunt, { x: 4, z: 5 })).toBeNull(); // the defenders walk over their own
    const step = walkInto(ctx, rowan, { x: 4, z: 5 })!;
    expect(step.stopAt).toEqual({ x: 4, z: 6 });
    expect(step.sprung.kind).toBe('snare');
    expect(boss.traps).toEqual([]);
  });

  it('defenders don\'t rush a hold zone; the squad still does', () => {
    const grid = new BattleGrid(field((t) => { if (t.x <= 1 && t.z >= 8) t.zone = true; }));
    const zone = zoneKeys(grid.mapData.tiles);
    const toZone = (m: { x: number; z: number }) => Math.min(...[...zone].map((k) => { const [x, z] = k.split(',').map(Number); return Math.abs(x - m.x) + Math.abs(z - m.z); }));
    const guard = JobSystem.createUnit('e', 'Guard', 'enemy', 'knight', 3, 3, 'S', 5);
    const squad = JobSystem.createUnit('p', 'P', 'player', 'knight', 9, 3, 'N', 5);
    const rushing = planTurn(guard, [guard, squad], grid, { zone });
    const guarding = planTurn(guard, [guard, squad], grid, { zone, guardZone: true });
    const plain = planTurn(guard, [guard, squad], grid);
    expect(toZone(rushing.moveTo)).toBeLessThan(toZone(guarding.moveTo));
    expect(guarding.moveTo).toEqual(plain.moveTo);
  });

  it('Workshop traps survive files and share links; old links load; blocked tiles drop them', () => {
    const s = blankScenario(8, 8);
    s.map.tiles[9].trap = 'snare';
    s.map.tiles[10].trap = 'smoke';
    s.map.tiles[10].hazard = 'embers';
    s.map.tiles[10].zone = true;
    s.map.tiles[11].trap = 'spikes';
    s.map.tiles[11].walkable = false;
    const viaFile = sanitizeScenario(JSON.parse(JSON.stringify(s)));
    expect(viaFile.map.tiles.slice(9, 12).map((t) => t.trap)).toEqual(['snare', 'smoke', undefined]);
    const viaLink = sanitizeScenario(unpackShare(JSON.parse(JSON.stringify(packForShare(s)))));
    expect(viaLink.map.tiles.slice(9, 11).map((t) => [t.trap, t.hazard, !!t.zone])).toEqual([['snare', undefined, false], ['smoke', 'embers', true]]);
    expect((packForShare(s) as { map: { rows: string[] } }).map.rows[1].split(',')[2]).toBe('10ge*^s');
    expect(sanitizeScenario({ ...JSON.parse(JSON.stringify(s)), map: { ...s.map, tiles: [{ x: 0, z: 0, height: 1, terrain: 'grass', walkable: true, trap: 'landmine' }] } }).map.tiles[0].trap).toBeUndefined();
    const old = unpackShare({ map: { width: 1, depth: 1, rows: ['10ge*'] } }) as { map: { tiles: TileData[] } };
    expect(old.map.tiles[0]).toEqual({ x: 0, z: 0, height: 1, terrain: 'grass', walkable: true, hazard: 'embers', zone: true });

    const spawn = s.map.playerSpawns![0];
    s.map.tiles[spawn.z * 8 + spawn.x].trap = 'slumber';
    expect(validateScenario(s).some((i) => i.level === 'warning' && /trap sits on deploy tile/.test(i.text))).toBe(true);
    s.enemies = [];
    s.objective = { type: 'survive', rounds: 3 };
    expect(validateScenario(s).some((i) => /Traps need an enemy/.test(i.text))).toBe(true);
  });
});
