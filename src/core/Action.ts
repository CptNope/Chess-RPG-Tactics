/**
 * Resolving an action (0.41.0): what happens to the board when a unit uses an ability, with no
 * drawing and no waiting. The game, the balance sim and (later) a versus server all use it.
 *
 * `resolveAction` is a generator so the game can show each step as it happens: it yields a
 * `start` step (costs paid, the caster turned, a call begun), then one `hit` step per unit the
 * ability touches, rolled only when the game asks for the next step, and returns what the caster
 * earned. A headless caller just runs it to the end (`runAction`).
 */
import type { Ability, CombatForecast, Unit } from './types';
import type { BattleGrid } from './Grid';
import { AttackResult, CombatEngine } from './CombatEngine';
import { JobSystem, JpGain } from './JobSystem';
import { faceTowards, summonVictims, unitsInBlast } from './EnemyAI';
import { endPerformance, isCentered, noFalloff, startPerformance } from './Performance';
import { startCall } from './Summons';
import { plantTotem, pulsesOn, Totem, TotemPulse } from './Totems';
import { isAlly } from './Sides';
import { BattleRules, earnsProgress } from './Rules';

export interface ActionContext {
  units: Unit[];
  grid: BattleGrid;
  /** The battle's dice (Rng.ts). */
  rng: () => number;
  rules: BattleRules;
  /** Where a caster's supplies come from: an enemy's own pouch, or the squad's inventory. */
  pouchOf(caster: Unit): Record<string, number> | undefined;
}

export interface ActionOptions {
  /** A song or dance playing on by itself at the start of the performer's turn. */
  encore?: boolean;
  /** A grand summon landing, called on the caster's previous turn. */
  called?: boolean;
}

export interface ActionStart {
  kind: 'start';
  /** Everyone the ability will be rolled against, in order. */
  victims: Unit[];
  /** A grand summon's call begins: nothing lands until the caster's next turn. */
  calling: boolean;
  /** A summoned creature appears and its blows land now. */
  summoning: boolean;
  /** The caster turned to face the target. */
  faced: boolean;
  /** Using something else ended the caster's song or dance. */
  performanceEnded: boolean;
  /** HP the caster paid for a Dark Knight technique (0.46.0). */
  hpPaid: number;
  /** The totem a Shaman planted, and what it did at once to those in reach (0.47.0). */
  totem?: Totem;
  pulses?: { unit: Unit; pulses: TotemPulse[] }[];
}

export interface ActionHit {
  kind: 'hit';
  target: Unit;
  /** The ability as it applied to this target (Cinderwing heals the living, raises the fallen). */
  ability: Ability;
  forecast: CombatForecast;
  result: AttackResult;
  /** The target is down after this hit. */
  killed: boolean;
}

export type ActionStep = ActionStart | ActionHit;

export interface ActionEnd {
  anyKill: boolean;
  /** Units left down by this action. */
  kills: number;
  /** JP the caster earned for its job (0 when none). */
  jpGained: number;
  /** The job level and unlocks that JP brought, when it earned any. */
  jp?: JpGain;
  /** Levels the caster gained for acting and for kills. */
  levels: number;
  /** Levels a landing grand summon's kills brought (its JP came when it was called). */
  summonLevels: number;
}

/** Everyone an ability aimed at (tx, tz) touches. */
export function victimsFor(units: readonly Unit[], caster: Unit, ability: Ability, tx: number, tz: number): Unit[] {
  if (ability.isSelfOnly) return [caster];
  if (ability.totem) return []; // a totem lands on the tile, not on anyone (0.47.0)
  if (isCentered(ability)) return unitsInBlast(caster, ability, caster.x, caster.z, units as Unit[]);
  if (ability.aoe > 0) return summonVictims(caster, ability, tx, tz, units as Unit[]).map((v) => v.unit);
  const living = units.find((v) => !v.isDead && v.x === tx && v.z === tz);
  if (ability.revive) {
    // A fallen ally lying on the tile, unless someone is standing over them
    const fallen = units.find((v) => v.isDead && isAlly(v, caster) && v.x === tx && v.z === tz);
    return fallen && !living ? [fallen] : [];
  }
  return living ? [living] : [];
}

/** The forecast for one target: heights, terrain, and the 60% splash ring away from the aim. */
export function forecastFor(grid: BattleGrid, attacker: Unit, target: Unit, ability: Ability, aim?: { x: number; z: number }): CombatForecast {
  const isSplash = !!aim && ability.aoe > 0 && !noFalloff(ability) && (target.x !== aim.x || target.z !== aim.z);
  return CombatEngine.getForecast(
    attacker,
    target,
    ability,
    grid.getHeight(attacker.x, attacker.z),
    grid.getHeight(target.x, target.z),
    grid.getTile(target.x, target.z)?.terrain,
    isSplash
  );
}

/**
 * Resolves an ability step by step. Pays its costs once (MP, the supply, a signature's one use),
 * starts or ends performances, turns the caster, begins a grand summon's call, rolls it against
 * every unit it touches, and grants JP and EXP under the battle's rules.
 */
export function* resolveAction(ctx: ActionContext, caster: Unit, ability: Ability, tx: number, tz: number, opts: ActionOptions = {}): Generator<ActionStep, ActionEnd, void> {
  const victims = victimsFor(ctx.units, caster, ability, tx, tz);
  const raise = ability.rebirth ? summonVictims(caster, ability, tx, tz, ctx.units) : null;
  const asFor = (u: Unit): Ability => raise?.find((v) => v.unit === u)?.ability ?? ability;
  const encore = !!opts.encore;
  const called = !!opts.called;
  const calling = !encore && !called && !!ability.charge;
  let performanceEnded = false;
  let hpPaid = 0;
  let kills = 0;

  if (!encore && !called) {
    caster.currentMp = Math.max(0, caster.currentMp - ability.mpCost);
    // A Dark Knight pays in blood (0.46.0), never down to 0
    if (ability.hpCost) {
      hpPaid = Math.min(JobSystem.hpCostFor(caster, ability), caster.currentHp - 1);
      caster.currentHp -= hpPaid;
    }
    caster.hasActed = true;
    if (ability.item) {
      const pouch = ctx.pouchOf(caster);
      if (pouch) pouch[ability.item] = Math.max(0, (pouch[ability.item] || 0) - 1);
    }
    JobSystem.useSignature(caster, ability); // once per battle (0.23.0)
    // Any other action ends a song or dance; using one starts (or restarts) it (0.22.0)
    if (ability.performance) startPerformance(caster, ability);
    else performanceEnded = endPerformance(caster);
  }

  const faced = !ability.isSelfOnly && !isCentered(ability);
  if (faced) caster.facing = faceTowards(caster.x, caster.z, tx, tz);
  if (calling) startCall(caster, ability, tx, tz);
  const summoning = !!ability.summon && !encore && !calling;
  let totem: Totem | undefined;
  let pulses: { unit: Unit; pulses: TotemPulse[] }[] | undefined;
  if (ability.totem) {
    totem = plantTotem(caster, ability, tx, tz);
    pulses = [];
    for (const u of ctx.units) {
      const p = pulsesOn(u, ctx.units, (v, s) => CombatEngine.applyStatus(v, s), totem);
      if (p.length) {
        pulses.push({ unit: u, pulses: p });
        JobSystem.recalculateDerivedStats(u);
      }
    }
    if (pulses.some((p) => p.unit.isDead)) kills += pulses.filter((p) => p.unit.isDead).length;
  }

  yield { kind: 'start', victims, calling, summoning, faced, performanceEnded, hpPaid, totem, pulses };

  for (const target of calling ? [] : victims) {
    const a = asFor(target);
    if (target.isDead && !a.revive) continue;
    const forecast = forecastFor(ctx.grid, caster, target, a, { x: tx, z: tz });
    const result = CombatEngine.executeAttack(forecast, ctx.rng);
    if (target.isDead) kills++;
    yield { kind: 'hit', target, ability: a, forecast, result, killed: target.isDead };
    if (caster.isDead) break; // felled by a counter
  }

  const end: ActionEnd = { anyKill: kills > 0, kills, jpGained: 0, levels: 0, summonLevels: 0 };
  if (!earnsProgress(ctx.rules, caster) || caster.isDead) return end;
  if (called && end.anyKill) {
    // A grand summon that lands pays out for its kills (the JP came when it was called)
    end.summonLevels = JobSystem.grantExp(caster, 20);
  }
  if (!encore && !called) {
    // Using a supply isn't practising a job: no JP and no EXP for the act, only for a kill it makes
    end.jpGained = ability.item ? 0 : Math.round(24 * (caster.equippedAbilities.support === 'sq_jp_boost' ? 1.5 : 1));
    if (end.jpGained > 0) end.jp = JobSystem.gainJp(caster, end.jpGained);
    end.levels = JobSystem.grantExp(caster, (ability.item ? 0 : 10) + (end.anyKill ? 20 : 0));
  }
  return end;
}

/** Runs an action to the end with nothing to show: for the sim, tests and a server. */
export function runAction(ctx: ActionContext, caster: Unit, ability: Ability, tx: number, tz: number, opts: ActionOptions = {}): { steps: ActionStep[]; end: ActionEnd } {
  const steps: ActionStep[] = [];
  const run = resolveAction(ctx, caster, ability, tx, tz, opts);
  for (let step = run.next(); ; step = run.next()) {
    if (step.done) return { steps, end: step.value };
    steps.push(step.value);
  }
}
