// The battle engine's turn loop (0.44.0): who has won, rounds, and whole battles replayed.
import { describe, it, expect } from 'vitest';
import { Battle, Decide, battleOutcome, noteTurn, replay, runBattle } from '../src/core/Battle';
import { BattleGrid } from '../src/core/Grid';
import { JobSystem } from '../src/core/JobSystem';
import { planTurn } from '../src/core/EnemyAI';
import { CAMPAIGN_RULES } from '../src/core/Rules';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { MAPS, spawnsFor } from '../src/data/maps';
import type { Unit } from '../src/core/types';

const unit = (id: string, team: 'player' | 'enemy', job = 'squire', level = 5) => JobSystem.createUnit(id, id, team, job, 0, 0, 'N', level);

/** Chapter I with a squad of four at level 5: a fresh copy every time. */
function chapterOne(seed: number, rules: { progressionTeams: readonly string[] } = { progressionTeams: [] }): Battle {
  const ch = CAMPAIGN_CHAPTERS.chapter_1;
  const map = MAPS[ch.mapId]();
  const squad = [unit('p1', 'player', 'squire'), unit('p2', 'player', 'knight'), unit('p3', 'player', 'archer'), unit('p4', 'player', 'white_mage')];
  const spawns = spawnsFor(map);
  squad.forEach((u, i) => JobSystem.resetForBattle(u, spawns[i].x, spawns[i].z));
  const foes = ch.enemyRoster.map((e, i) => {
    const u = JobSystem.createUnit(`e${i}`, e.name, 'enemy', e.jobId, e.x, e.z, e.facing || 'S', e.level);
    if (e.isBoss) JobSystem.makeBoss(u);
    return u;
  });
  return new Battle({ units: [...squad, ...foes], grid: new BattleGrid(map), seed, rules, objective: ch.objective });
}

const ai: Decide = (b, u) => {
  const p = planTurn(u, b.units, b.grid);
  return { moveTo: p.moveTo, ability: p.ability, target: p.targetTile, facing: p.facing };
};

describe('who has won (0.44.0)', () => {
  it('the last side standing wins; a wiped squad loses', () => {
    const [a, b] = [unit('a', 'player'), unit('b', 'enemy')];
    expect(battleOutcome([a, b], undefined, 1)).toBeNull();
    b.isDead = true;
    expect(battleOutcome([a, b], undefined, 1)).toEqual({ winner: 'player', reason: 'rout' });
    b.isDead = false;
    a.isDead = true;
    expect(battleOutcome([a, b], undefined, 1)).toEqual({ winner: 'enemy', reason: 'wiped' });
  });

  it('a tamed beast can\'t win alone; a fallen boss ends it; holding out wins a survive battle', () => {
    const hero = unit('a', 'player');
    const beast = unit('w', 'player', 'wolf');
    beast.tamed = true;
    const boss = unit('boss', 'enemy');
    boss.isBoss = true;
    const grunt = unit('g', 'enemy');
    hero.isDead = true;
    expect(battleOutcome([hero, beast, boss, grunt], undefined, 1)?.winner).toBe('enemy');
    hero.isDead = false;
    boss.isDead = true;
    expect(battleOutcome([hero, beast, boss, grunt], undefined, 1)).toBeNull(); // rout: the grunt fights on
    expect(battleOutcome([hero, beast, boss, grunt], { type: 'boss' }, 1)).toEqual({ winner: 'player', reason: 'boss' });
    boss.isDead = false;
    expect(battleOutcome([hero, boss], { type: 'survive', rounds: 4 }, 4)).toBeNull();
    expect(battleOutcome([hero, boss], { type: 'survive', rounds: 4 }, 5)).toEqual({ winner: 'player', reason: 'survive' });
  });

  it('allied teams win together', () => {
    const [a, b, c] = [unit('a', 'player'), unit('b', 'enemy'), unit('c', 'enemy')];
    b.alliance = 'player'; // b fights with a
    expect(battleOutcome([a, b, c], undefined, 1)).toBeNull();
    c.isDead = true;
    expect(battleOutcome([a, b, c], undefined, 1)).toEqual({ winner: 'player', reason: 'rout' });
  });

  it('a round ends once everyone standing has had a turn', () => {
    const us: Unit[] = [unit('a', 'player'), unit('b', 'enemy'), unit('c', 'enemy')];
    const st = { round: 1, acted: new Set<string>() };
    expect(noteTurn(st, us[0], us)).toBe(false);
    expect(noteTurn(st, us[1], us)).toBe(false);
    us[2].isDead = true; // c fell before its turn: the round is over without it
    expect(noteTurn(st, us[0], us)).toBe(true);
    expect(st.round).toBe(2);
  });
});

describe('a whole battle in the engine (0.44.0)', () => {
  it('plays to the end, the same way twice with the same seed', () => {
    const one = chapterOne(42);
    const r1 = runBattle(one, ai);
    expect(r1.outcome).not.toBeNull();
    expect(one.events.at(-1)).toEqual({ t: 'end', outcome: r1.outcome });
    expect(one.events.filter((e) => e.t === 'turn').length).toBeGreaterThan(5);

    const two = chapterOne(42);
    runBattle(two, ai);
    expect(two.events).toEqual(one.events);
  });

  it('replays from its seed and the recorded choices, event for event', () => {
    const live = chapterOne(7);
    const { intents } = runBattle(live, ai);
    const again = chapterOne(7);
    runBattle(again, replay(intents));
    expect(again.events).toEqual(live.events);
    // A different seed with the same choices plays out differently (or the recording stops fitting)
    const other = chapterOne(8);
    let diverged = false;
    try { runBattle(other, replay(intents)); diverged = JSON.stringify(other.events) !== JSON.stringify(live.events); } catch { diverged = true; }
    expect(diverged).toBe(true);
  });

  it('refuses a move out of reach, an attack out of range, and a spell without the MP', () => {
    const b = chapterOne(1);
    const u = b.nextTurn()!;
    const stay = { moveTo: { x: u.x, z: u.z }, ability: null, target: null, facing: u.facing };
    expect(b.check({ ...stay, moveTo: { x: u.x + 9, z: u.z - 9 } })).toBe('Out of reach.');
    const strike = JobSystem.getCombatActionAbilities(u).find((a) => a.id === 'basic_attack')!;
    expect(b.check({ ...stay, ability: strike, target: { x: (u.x + 8) % 16, z: (u.z + 8) % 16 } })).toBe('Out of range.');
    expect(b.check({ ...stay, ability: { ...strike, mpCost: u.currentMp + 1 }, target: { x: u.x, z: u.z } })).toBe('Not enough MP.');
    expect(() => b.apply({ ...stay, moveTo: { x: u.x + 9, z: u.z - 9 } })).toThrow('Out of reach.');
    expect(b.check(stay)).toBeNull();
    b.apply(stay);
    expect(b.active).toBeNull(); // the turn is over
  });

  it('the campaign rules grant JP through the engine too', () => {
    const jp = (b: Battle) => b.units.filter((u) => u.team === 'player').reduce((n, u) => n + Object.values(u.jobPoints).reduce((a, x) => a + x, 0), 0);
    const plain = chapterOne(3);
    const before = jp(plain);
    runBattle(plain, ai);
    expect(jp(plain)).toBe(before); // the sim's rules: nobody grows mid-battle
    const campaign = chapterOne(3, CAMPAIGN_RULES);
    runBattle(campaign, ai);
    expect(jp(campaign)).toBeGreaterThan(before);
  });
});
