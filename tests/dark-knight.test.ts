// The Dark Knight (0.46.0): techniques paid for in HP.
import { describe, it, expect } from 'vitest';
import { JobSystem } from '../src/core/JobSystem';
import { BattleGrid } from '../src/core/Grid';
import { ActionContext, runAction } from '../src/core/Action';
import { CombatEngine } from '../src/core/CombatEngine';
import { planTurn } from '../src/core/EnemyAI';
import { seededRng } from '../src/core/Rng';
import { CAMPAIGN_RULES } from '../src/core/Rules';
import { JOBS, PLAYER_JOB_IDS } from '../src/data/jobs';
import { JOB_GEAR } from '../src/data/gear-rules';
import { SIGNATURES } from '../src/data/signatures';
import { RECRUIT_JOBS, RECRUIT_PITCH } from '../src/core/Recruits';
import type { MapData } from '../src/data/maps';
import type { Unit } from '../src/core/types';

const field = (): MapData => {
  const tiles = [];
  for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) tiles.push({ x, z, height: 1, terrain: 'grass' as const, walkable: true });
  return { id: 'test', name: 'Test', theme: 'day', width: 8, depth: 8, tiles };
};

/** A Dark Knight who knows everything, next to a foe. */
function duel() {
  const dk = JobSystem.createUnit('p1', 'Vale', 'player', 'dark_knight', 3, 4, 'N', 10);
  for (const a of JOBS.dark_knight.abilities) dk.unlockedAbilities[a.id] = true;
  const foe = JobSystem.createUnit('e1', 'Brute', 'enemy', 'knight', 3, 3, 'S', 10);
  const units = [dk, foe];
  const ctx: ActionContext = { units, grid: new BattleGrid(field()), rng: seededRng(5), rules: CAMPAIGN_RULES, pouchOf: () => ({}) };
  return { dk, foe, units, ctx };
}
const action = (u: Unit, id: string) => JobSystem.getCombatActionAbilities(u).find((a) => a.id === id)!;

describe('the Dark Knight (0.46.0)', () => {
  it('is an advanced job after Knight and Black Mage, with sword or spear and heavy armor', () => {
    const job = JOBS.dark_knight;
    expect(PLAYER_JOB_IDS).toContain('dark_knight');
    expect(job.prerequisites).toEqual([{ jobId: 'knight', level: 3 }, { jobId: 'black_mage', level: 2 }]);
    expect(JOB_GEAR.dark_knight).toEqual({ weapons: ['sword', 'spear'], heavy: true });
    expect(job.abilities.filter((a) => a.type === 'action').every((a) => a.hpCost && a.mpCost === 0)).toBe(true);
    expect(SIGNATURES.dark_knight.signature).toBe(true);
    expect(RECRUIT_JOBS.at(-1)!.jobs).toContain('dark_knight');
    expect(RECRUIT_PITCH.dark_knight).toBeTruthy();
    const fresh = JobSystem.createUnit('h', 'H', 'player', 'dark_knight', 0, 0, 'N', 5);
    expect(fresh.equipment.weapon?.weaponType).toBe('sword');
  });

  it('pays for a technique in HP, shown on the action, never down to 0', () => {
    const { dk, foe, ctx } = duel();
    const blade = action(dk, 'dk_shadow_blade');
    const price = JobSystem.hpCostFor(dk, blade);
    expect(price).toBe(Math.round(dk.maxHp * 0.06));
    const { steps } = runAction(ctx, dk, blade, foe.x, foe.z);
    expect(steps[0]).toMatchObject({ kind: 'start', hpPaid: price });
    expect(dk.currentHp).toBe(dk.maxHp - price);
    expect(dk.currentMp).toBe(dk.maxMp);

    dk.currentHp = price; // exactly the price: it would fall
    expect(JobSystem.canAfford(dk, blade)).toBe(false);
    dk.currentHp = price + 1;
    expect(JobSystem.canAfford(dk, blade)).toBe(true);
  });

  it('Blood Pact halves the price; Silence doesn\'t seal it', () => {
    const { dk } = duel();
    const full = JobSystem.hpCostFor(dk, action(dk, 'dk_night_ring'));
    dk.equippedAbilities.support = 'dk_blood_pact';
    expect(JobSystem.hpCostFor(dk, action(dk, 'dk_night_ring'))).toBe(Math.round(dk.maxHp * 0.05));
    expect(JobSystem.hpCostFor(dk, action(dk, 'dk_night_ring'))).toBeLessThan(full);
    dk.statuses.push({ type: 'silence', duration: 3 });
    expect(JobSystem.getCombatActionAbilities(dk).some((a) => a.id === 'dk_shadow_blade')).toBe(true);
  });

  it('Soul Rend drinks back what it deals; Black Oath trades HP for Haste', () => {
    const { dk, foe, ctx } = duel();
    dk.currentHp = Math.round(dk.maxHp * 0.6);
    const before = dk.currentHp;
    const rend = action(dk, 'dk_soul_rend');
    const { steps } = runAction(ctx, dk, rend, foe.x, foe.z);
    const hit = steps.find((s) => s.kind === 'hit');
    if (hit?.kind === 'hit' && hit.result.hit) expect(hit.result.drained).toBeGreaterThan(0);
    expect(dk.currentHp).not.toBe(before - JobSystem.hpCostFor(dk, rend)); // the drain came back
    runAction(ctx, dk, action(dk, 'dk_black_oath'), dk.x, dk.z);
    expect(dk.statuses.some((s) => s.type === 'haste')).toBe(true);
  });

  it('Vengeance strikes back below half HP, from next to it only', () => {
    const { dk, foe } = duel();
    dk.equippedAbilities.reaction = 'dk_vengeance';
    const blow = JobSystem.getCombatActionAbilities(foe).find((a) => a.id === 'basic_attack')!;
    const swing = (from = foe) => CombatEngine.executeAttack(CombatEngine.getForecast(from, dk, blow, 1, 1), () => 0.2); // hits, no crit
    // a scratch that leaves it above half: no answer
    const weakling = JobSystem.createUnit('e2', 'Pup', 'enemy', 'squire', 3, 5, 'N', 1);
    dk.currentHp = dk.maxHp;
    expect(swing(weakling).reaction).toBeUndefined();
    // from 2 tiles away, even when hurt: no answer
    const archer = JobSystem.createUnit('e3', 'Bow', 'enemy', 'archer', 3, 2, 'S', 1);
    dk.currentHp = Math.round(dk.maxHp * 0.4);
    expect(swing(archer).reaction).toBeUndefined();
    // hurt, struck from next to it: it answers
    dk.currentHp = Math.round(dk.maxHp * 0.4);
    const hpBefore = weakling.currentHp;
    const r = swing(weakling);
    expect(r.reaction?.name).toBe('Vengeance');
    expect(weakling.currentHp).toBeLessThan(hpBefore);
  });

  it('the AI uses its techniques when healthy and holds back when they would cost too much', () => {
    const { dk, foe, units, ctx } = duel();
    const healthy = planTurn(dk, units, ctx.grid);
    expect(healthy.ability?.hpCost).toBeTruthy();
    dk.currentHp = 2; // a blade would cost more than it has to give
    const desperate = planTurn(dk, units, ctx.grid);
    expect(desperate.ability?.hpCost).toBeFalsy();
    expect(foe.isDead).toBe(false);
  });
});
