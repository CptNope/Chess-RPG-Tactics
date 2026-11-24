/**
 * 0.28.0: the Beast Tamer. Tame wins a weakened monster over; it fights for the squad and joins it.
 */
import { describe, it, expect } from 'vitest';
import { JOBS, PLAYER_JOB_IDS } from '../src/data/jobs';
import { ITEMS } from '../src/data/items';
import { SIGNATURES } from '../src/data/signatures';
import { JobSystem, JOB_MASTERY } from '../src/core/JobSystem';
import { CombatEngine } from '../src/core/CombatEngine';
import { recruitJobs } from '../src/core/Recruits';
import { BEAST_PREFIX, beastFromTamed, beastName, canTame, isBeast, tameChance } from '../src/core/Taming';
import { Unit } from '../src/core/types';

const make = (job: string, team: 'player' | 'enemy', x = 0, z = 0, level = 5): Unit =>
  JobSystem.createUnit(`${team}-${job}-${x}-${z}`, job, team, job, x, z, team === 'player' ? 'N' : 'S', level);
const ability = (id: string) => JOBS.tamer.abilities.find((a) => a.id === id)!;
const tamer = (x = 0, z = 0) => {
  const u = make('tamer', 'player', x, z);
  for (const a of JOBS.tamer.abilities) u.unlockedAbilities[a.id] = true;
  return u;
};
const forecast = (a: Unit, t: Unit, id: string) => CombatEngine.getForecast(a, t, ability(id), 1, 1);

describe('beast tamer', () => {
  it('is an advanced job after Archer and Chemist, with a whip, a mastery bonus and a signature', () => {
    expect(PLAYER_JOB_IDS).toContain('tamer');
    expect(JOBS.tamer.prerequisites).toEqual([{ jobId: 'archer', level: 2 }, { jobId: 'chemist', level: 2 }]);
    expect(JOBS.tamer.abilities[0].id).toBe('ta_tame');
    expect(JOB_MASTERY.tamer).toBeDefined();
    expect(SIGNATURES.tamer?.signature).toBe(true);
    const u = make('tamer', 'player');
    expect(u.equipment.weapon?.id).toBe('drovers_whip');
    expect(ITEMS.drovers_whip.range).toBe(2);
    expect(recruitJobs(1)).not.toContain('tamer');
    expect(recruitJobs(2)).toContain('tamer');
  });

  it('can tame a monster, never a person, a boss, or for the enemy', () => {
    const t = tamer(), wolf = make('wolf', 'enemy', 0, 1), knight = make('knight', 'enemy', 0, 1);
    expect(canTame(t, wolf)).toBe(true);
    expect(canTame(t, knight)).toBe(false);
    expect(forecast(t, knight, 'ta_tame').hitChance).toBe(0);
    const boss = make('brute', 'enemy', 0, 1);
    JobSystem.makeBoss(boss);
    expect(canTame(t, boss)).toBe(false);
    const foeTamer = make('tamer', 'enemy', 0, 2), myWolf = make('wolf', 'player', 0, 3);
    expect(canTame(foeTamer, myWolf)).toBe(false);
  });

  it('works more often the more hurt the monster is, and asleep', () => {
    const t = tamer(), wolf = make('wolf', 'enemy', 0, 1);
    const fresh = tameChance(t, wolf);
    wolf.currentHp = Math.round(wolf.maxHp * 0.2);
    const hurt = tameChance(t, wolf);
    expect(fresh).toBe(15);
    expect(hurt).toBeGreaterThan(70);
    wolf.statuses.push({ type: 'sleep', duration: 2 });
    expect(tameChance(t, wolf)).toBe(Math.min(95, hurt + 20));
    t.equippedAbilities.support = 'ta_beast_lore';
    expect(tameChance(t, wolf)).toBe(95);
    expect(forecast(t, wolf, 'ta_tame').hitChance).toBe(95);
  });

  it('turns a tamed monster to the squad\'s side, awake', () => {
    const t = tamer(), wisp = make('wisp', 'enemy', 0, 1);
    wisp.statuses.push({ type: 'sleep', duration: 2 });
    const r = CombatEngine.executeAttack(forecast(t, wisp, 'ta_tame'), () => 0);
    expect(r.hit).toBe(true);
    expect(r.tamed).toBe(true);
    expect(wisp.team).toBe('player');
    expect(wisp.tamed).toBe(true);
    expect(wisp.statuses.some((s) => s.type === 'sleep')).toBe(false);
    expect(canTame(t, wisp)).toBe(false); // already on our side
    // A failed roll changes nothing
    const ooze = make('ooze', 'enemy', 0, 1);
    const miss = CombatEngine.executeAttack(forecast(t, ooze, 'ta_tame'), () => 0.99);
    expect(miss.hit).toBe(false);
    expect(ooze.team).toBe('enemy');
  });

  it('is better with beasts: Snare and Soothe land more, Treat heals more, Beast Lore hits harder', () => {
    const t = tamer(), wolf = make('wolf', 'enemy', 0, 2), monk = make('monk', 'enemy', 0, 2);
    monk.evasion = wolf.evasion = 0;
    monk.facing = wolf.facing = 'N'; // face the tamer
    expect(forecast(t, wolf, 'ta_soothe').hitChance - forecast(t, monk, 'ta_soothe').hitChance).toBeGreaterThanOrEqual(50);
    expect(forecast(t, wolf, 'ta_snare').hitChance).toBeGreaterThan(forecast(t, monk, 'ta_snare').hitChance);
    const pet = make('wolf', 'player', 0, 1), friend = make('monk', 'player', 0, 1);
    expect(Math.abs(forecast(t, pet, 'ta_treat').expectedDamage)).toBe(2 * Math.abs(forecast(t, friend, 'ta_treat').expectedDamage));
    const plain = CombatEngine.getForecast(t, wolf, { ...ability('ta_snare'), beasts: undefined }, 1, 1).expectedDamage;
    t.equippedAbilities.support = 'ta_beast_lore';
    const lore = CombatEngine.getForecast(t, wolf, { ...ability('ta_snare'), beasts: undefined }, 1, 1).expectedDamage;
    expect(lore).toBeGreaterThan(plain);
  });

  it('snarls back at melee attackers', () => {
    const t = tamer(0, 0), foe = make('squire', 'enemy', 0, 1);
    t.equippedAbilities.reaction = 'ta_snarl';
    t.currentHp = t.maxHp = 999;
    const f = CombatEngine.getForecast(foe, t, { ...JOBS.squire.abilities[0], power: 1, appliesStatus: undefined }, 1, 1);
    const r = CombatEngine.executeAttack({ ...f, hitChance: 100 }, () => 0);
    expect(r.reaction?.type).toBe('snarl');
    expect(foe.statuses.some((s) => s.type === 'slow')).toBe(true);
  });

  it('a tamed monster becomes a beast in the squad: same kind and level, a name, no gear, no job change', () => {
    const wolf = make('wolf', 'enemy', 0, 0, 7);
    wolf.name = 'Dire Wolf';
    const squad = [make('squire', 'player'), { ...make('archer', 'player'), id: `${BEAST_PREFIX}1`, name: 'Fang' }];
    const beast = beastFromTamed(wolf, squad);
    expect(beast.id).toBe(`${BEAST_PREFIX}2`);
    expect(isBeast(beast)).toBe(true);
    expect(beast.team).toBe('player');
    expect(beast.jobId).toBe('wolf');
    expect(beast.level).toBe(7);
    expect(beast.name).toBe('Ashpaw'); // Fang is taken
    expect(beast.currentHp).toBe(beast.maxHp);
    expect(Object.values(beast.equipment).every((it) => !it)).toBe(true);
    JobSystem.equipItem(beast, ITEMS.iron_sword);
    expect(beast.equipment.weapon).toBeNull();
    expect(JobSystem.canChangeJob(beast, 'squire')).toBe(false);
    expect(JobSystem.unlockedJobs(beast)).toEqual(['wolf']);
    JobSystem.changeJob(beast, 'knight');
    expect(beast.jobId).toBe('wolf');
    expect(JOBS.wolf.abilities.every((a) => beast.unlockedAbilities[a.id])).toBe(true);
  });

  it('names run out gracefully', () => {
    expect(beastName('ooze', [])).toBe('Gloop');
    expect(beastName('ooze', ['Gloop', 'Mudge', 'Burble', 'Sludgey', 'Wobble'])).toBe('Gloop 2');
  });
});
