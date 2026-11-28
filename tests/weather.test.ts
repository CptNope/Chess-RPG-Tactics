// Weather (0.55.0): rain, snow and fog, set for a whole battle on its copy of the map.
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { ActionContext, forecastFor, runAction } from '../src/core/Action';
import { CAMPAIGN_RULES } from '../src/core/Rules';
import { applyWeather, FOG_PENALTY, weatherMove, weatherPower } from '../src/core/Weather';
import { buildSkirmish } from '../src/core/Skirmish';
import { buildTrialFloor, trialWeather } from '../src/core/Trials';
import { blankScenario, packForShare, sanitizeScenario, scenarioFromChapter, unpackShare } from '../src/core/Scenario';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { JOBS } from '../src/data/jobs';
import type { MapData } from '../src/data/maps';
import type { TileData, Unit } from '../src/core/types';

const field = (paint: (t: TileData) => void = () => {}): MapData => {
  const tiles: TileData[] = [];
  for (let z = 0; z < 10; z++) for (let x = 0; x < 10; x++) { const t: TileData = { x, z, height: 1, terrain: 'grass', walkable: true }; paint(t); tiles.push(t); }
  return { id: 'test', name: 'Test', theme: 'day', width: 10, depth: 10, tiles };
};
const learned = (u: Unit) => { for (const a of JOBS[u.jobId].abilities) u.unlockedAbilities[a.id] = true; return u; };
const spell = (u: Unit, el: string) => JobSystem.getCombatActionAbilities(u).find((a) => a.element === el && a.power > 0 && !a.aoe) ?? JobSystem.getCombatActionAbilities(u).find((a) => a.element === el && a.power > 0)!;

describe('weather (0.55.0)', () => {
  it('rain softens fire and sharpens lightning; snow sharpens ice; fog spoils blows from afar', () => {
    expect(weatherPower('rain', 'fire')).toBe(0.75);
    expect(weatherPower('rain', 'lightning')).toBe(1.25);
    expect(weatherPower('snow', 'ice')).toBe(1.25);
    expect(weatherPower(undefined, 'fire')).toBe(1);
    const mage = learned(JobSystem.createUnit('m', 'Mage', 'player', 'black_mage', 2, 2, 'N', 10));
    const foe = JobSystem.createUnit('e', 'Foe', 'enemy', 'knight', 2, 5, 'S', 10);
    const clear = new BattleGrid(field());
    const wet = new BattleGrid({ ...field(), weather: 'rain' });
    const fire = spell(mage, 'fire'), bolt = spell(mage, 'lightning');
    expect(forecastFor(wet, mage, foe, fire).expectedDamage).toBeLessThan(forecastFor(clear, mage, foe, fire).expectedDamage);
    expect(forecastFor(wet, mage, foe, bolt).expectedDamage).toBeGreaterThan(forecastFor(clear, mage, foe, bolt).expectedDamage);

    const archer = JobSystem.createUnit('a', 'Bow', 'player', 'archer', 2, 2, 'N', 10);
    const shot = JobSystem.getCombatActionAbilities(archer).find((a) => a.id === 'basic_attack')!;
    const foggy = new BattleGrid({ ...field(), weather: 'fog' });
    const far = forecastFor(foggy, archer, foe, shot).hitChance, farClear = forecastFor(clear, archer, foe, shot).hitChance;
    expect(farClear - far).toBeGreaterThan(0); // up to FOG_PENALTY: the chance is capped at 100 before fog comes off
    expect(farClear - far).toBeLessThanOrEqual(FOG_PENALTY);
    foe.z = 3; // 1 tile away: fog doesn't matter
    expect(forecastFor(foggy, archer, foe, shot).hitChance).toBe(forecastFor(clear, archer, foe, shot).hitChance);
  });

  it('snow takes a point of Move (never below 2)', () => {
    expect(weatherMove('snow', 4)).toBe(3);
    expect(weatherMove('snow', 2)).toBe(2);
    const u = JobSystem.createUnit('k', 'K', 'player', 'knight', 5, 5, 'N', 5);
    const reach = (g: BattleGrid) => Math.max(...g.getReachableTiles(u, [u]).map((t) => Math.abs(t.x - 5) + Math.abs(t.z - 5)));
    expect(reach(new BattleGrid({ ...field(), weather: 'snow' }))).toBe(reach(new BattleGrid(field())) - 1);
  });

  it('nothing burns in the rain: no embers from fire, and the map\'s own are out', () => {
    const map = field((t) => { if (t.x === 0) t.hazard = 'embers'; if (t.x === 9) t.hazard = 'spring'; });
    applyWeather(map, 'rain');
    expect(map.tiles.some((t) => t.hazard === 'embers')).toBe(false);
    expect(map.tiles.filter((t) => t.hazard === 'spring')).toHaveLength(10);
    const grid = new BattleGrid(map);
    const mage = learned(JobSystem.createUnit('m', 'Mage', 'player', 'black_mage', 2, 2, 'N', 20));
    const foe = JobSystem.createUnit('e', 'Foe', 'enemy', 'knight', 2, 5, 'S', 10);
    const ctx: ActionContext = { units: [mage, foe], grid, rng: () => 0.1, rules: CAMPAIGN_RULES, pouchOf: () => ({}) };
    const area = JobSystem.getCombatActionAbilities(mage).find((a) => a.element === 'fire' && a.aoe >= 1 && a.power > 0)!;
    expect(runAction(ctx, mage, area, 2, 5).end.ground).toBeUndefined();
    applyWeather(map, undefined);
    expect(map.weather).toBeUndefined();
  });

  it('where it falls: Stormbreak Cape and Frostfang Pass, two side battles, half the deep Trials floors', () => {
    expect(CAMPAIGN_CHAPTERS.chapter_6.weather).toBe('rain');
    expect(CAMPAIGN_CHAPTERS.chapter_8.weather).toBe('snow');
    expect(Object.values(CAMPAIGN_CHAPTERS).filter((c) => c.weather).length).toBe(2);
    expect(buildSkirmish('ridge', [4, 4, 4, 4], 0).weather).toBe('rain');
    expect(buildSkirmish('barrow', [6, 6, 6, 6], 0).weather).toBe('fog');
    expect(buildSkirmish('cinder', [7, 7, 7, 7], 0).weather).toBeUndefined(); // the caldera's fires stay lit
    expect([1, 2, 3, 4].map(trialWeather)).toEqual([undefined, undefined, undefined, undefined]);
    expect([7, 9, 11, 12].map(trialWeather)).toEqual(['rain', 'fog', 'snow', undefined]);
    expect(buildTrialFloor(7).weather).toBe('rain');
  });

  it('the Workshop keeps a scenario\'s weather in files and links, and a remix keeps the chapter\'s', () => {
    const s = blankScenario(8, 8);
    s.map.weather = 'snow';
    expect(sanitizeScenario(JSON.parse(JSON.stringify(s))).map.weather).toBe('snow');
    expect(sanitizeScenario(unpackShare(JSON.parse(JSON.stringify(packForShare(s))))).map.weather).toBe('snow');
    expect(sanitizeScenario({ ...JSON.parse(JSON.stringify(s)), map: { ...s.map, weather: 'hail' } }).map.weather).toBeUndefined();
    expect(scenarioFromChapter(CAMPAIGN_CHAPTERS.chapter_6).map.weather).toBe('rain');
  });
});
