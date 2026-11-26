/**
 * The battle engine's turn loop (0.44.0): whose turn it is, what happens when a turn starts
 * (Poison and Regen, a grand summon landing, a song playing on), applying a turn's choices, the
 * round count, and who has won. No drawing and no waiting: the balance sim runs whole battles
 * with it, and every step is written to an event log, so a battle can be replayed from its seed
 * and the choices made in it.
 *
 * The game still drives its own turns in main.ts (with animation between the steps) but asks
 * this module who has won and when a round ends. Driving the game from these events is part 3
 * of the groundwork (docs/ONLINE_VERSUS.md).
 */
import type { Ability, BattleObjective, FacingDirection, Unit } from './types';
import type { BattleGrid } from './Grid';
import { TurnManager } from './TurnManager';
import { ActionContext, ActionEnd, ActionStep, runAction } from './Action';
import { callDue } from './Summons';
import { encoreDue, endPerformance, isCentered } from './Performance';
import { allianceOf, isFoe } from './Sides';
import { seededRng } from './Rng';
import { BattleRules } from './Rules';
import { CombatEngine } from './CombatEngine';

// ---------------------------------------------------------------------------
// Who has won
// ---------------------------------------------------------------------------

export interface BattleOutcome {
  /** The side that won, or null if nobody is left. */
  winner: string | null;
  reason: 'rout' | 'boss' | 'survive' | 'wiped';
}

/**
 * Who has won, or null while the battle goes on. `hero` is the side the objective is played for
 * (the squad, in the campaign). A tamed beast fights on, but can't win the battle on its own.
 */
export function battleOutcome(units: readonly Unit[], objective: BattleObjective | undefined, round: number, hero = 'player'): BattleOutcome | null {
  const standing = new Set(units.filter((u) => !u.isDead && !u.tamed).map(allianceOf));
  if (!standing.has(hero)) {
    const rest = [...standing];
    return { winner: rest.length === 1 ? rest[0] : null, reason: 'wiped' };
  }
  if (objective?.type === 'boss') {
    // The objective is the other side's boss: when every one of them is down, the rest flee
    const bosses = units.filter((u) => u.isBoss && isFoe(u, { team: hero as Unit['team'] }));
    if (bosses.length && bosses.every((b) => b.isDead)) return { winner: hero, reason: 'boss' };
  }
  if (objective?.type === 'survive' && round > (objective.rounds || 6)) return { winner: hero, reason: 'survive' };
  if (standing.size === 1) return { winner: hero, reason: 'rout' };
  return null;
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export interface RoundState {
  round: number;
  /** Units that have had a turn this round. */
  acted: Set<string>;
}

/**
 * A unit starts a fresh turn: a round ends once every unit still standing has had one. Returns
 * true when this turn begins a new round.
 */
export function noteTurn(state: RoundState, unit: Unit, units: readonly Unit[]): boolean {
  let fresh = false;
  if (units.filter((u) => !u.isDead).every((u) => state.acted.has(u.id))) {
    state.round++;
    state.acted.clear();
    fresh = true;
  }
  state.acted.add(unit.id);
  return fresh;
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

/** What a unit does with its turn: where it ends up, what it uses on which tile, and which way it faces. */
export interface TurnIntent {
  moveTo: { x: number; z: number };
  ability: Ability | null;
  target: { x: number; z: number } | null;
  facing: FacingDirection;
}

/** A hit, as it went into the log. */
export interface HitRecord {
  target: string;
  hit: boolean;
  damage: number;
  crit: boolean;
  reaction?: string;
  down: boolean;
}

export type BattleEvent =
  | { t: 'turn'; unit: string; round: number }
  | { t: 'tick'; unit: string; poison?: number; regen?: number; slept?: boolean; down?: boolean }
  | { t: 'call' | 'encore' | 'act'; unit: string; ability: string; x: number; z: number; hits: HitRecord[] }
  | { t: 'move'; unit: string; x: number; z: number }
  | { t: 'face'; unit: string; facing: FacingDirection }
  | { t: 'end'; outcome: BattleOutcome };

export interface BattleSetup {
  units: Unit[];
  grid: BattleGrid;
  seed: number;
  rules: BattleRules;
  objective?: BattleObjective;
  /** The side the objective is played for. */
  hero?: string;
  /** Where a caster's supplies come from. */
  pouchOf?: (caster: Unit) => Record<string, number> | undefined;
}

const record = (steps: ActionStep[]): HitRecord[] =>
  steps.flatMap((s) => (s.kind === 'hit' ? [{
    target: s.target.id, hit: s.result.hit, damage: s.result.damageDealt, crit: s.result.isCrit,
    ...(s.result.reaction ? { reaction: s.result.reaction.type } : {}), down: s.killed
  }] : []));

export class Battle {
  readonly units: Unit[];
  readonly grid: BattleGrid;
  readonly turns: TurnManager;
  readonly ctx: ActionContext;
  readonly events: BattleEvent[] = [];
  readonly rounds: RoundState = { round: 1, acted: new Set() };
  private readonly objective?: BattleObjective;
  private readonly hero: string;
  private over: BattleOutcome | null = null;

  constructor(setup: BattleSetup) {
    this.units = setup.units;
    this.grid = setup.grid;
    this.turns = new TurnManager(this.units);
    this.objective = setup.objective;
    this.hero = setup.hero || 'player';
    this.ctx = {
      units: this.units, grid: this.grid, rng: seededRng(setup.seed), rules: setup.rules,
      pouchOf: setup.pouchOf || ((c) => c.pouch)
    };
  }

  get outcome(): BattleOutcome | null {
    return this.over;
  }

  get active(): Unit | null {
    return this.turns.activeUnit;
  }

  /** Checks for a winner, and logs the end once. */
  private settle(): BattleOutcome | null {
    if (this.over) return this.over;
    const o = battleOutcome(this.units, this.objective, this.rounds.round, this.hero);
    if (o) {
      this.over = o;
      this.events.push({ t: 'end', outcome: o });
    }
    return o;
  }

  private act(kind: 'call' | 'encore' | 'act', unit: Unit, ability: Ability, x: number, z: number, opts = {}): ActionEnd {
    const { steps, end } = runAction(this.ctx, unit, ability, x, z, opts);
    this.events.push({ t: kind, unit: unit.id, ability: ability.id, x, z, hits: record(steps) });
    return end;
  }

  /**
   * Moves the clock on to the next unit that gets to choose what to do, playing out everything
   * that happens before it does. Returns that unit, or null once the battle is over.
   */
  nextTurn(): Unit | null {
    for (let guard = 0; guard < 500; guard++) {
      if (this.settle()) return null;
      const r = this.turns.advanceToNextActiveTurn();
      for (const t of this.turns.skipped) this.events.push({ t: 'tick', unit: t.unit.id, poison: t.poison, regen: t.regen, slept: t.slept, down: t.unit.isDead || undefined });
      this.turns.skipped = [];
      if (!r) { this.settle(); return null; }
      const u = r.activeUnit;
      if (r.poisonDamage || r.regenHeal) this.events.push({ t: 'tick', unit: u.id, poison: r.poisonDamage, regen: r.regenHeal, down: u.isDead || undefined });
      if (this.settle()) return null;
      if (noteTurn(this.rounds, u, this.units) && this.settle()) return null;
      this.events.push({ t: 'turn', unit: u.id, round: this.rounds.round });
      // A grand summon called last turn lands, then a song or dance plays on (0.22.0, 0.24.0)
      const call = callDue(u);
      if (call && call !== 'broken') this.act('call', u, call.ability, call.x, call.z, { called: true });
      if (this.settle()) return null;
      if (!u.isDead) {
        const encore = encoreDue(u);
        if (encore) this.act('encore', u, encore, u.x, u.z, { encore: true });
        if (this.settle()) return null;
      }
      if (u.isDead) { this.turns.endTurn(u); continue; }
      return u;
    }
    return null;
  }

  /** Why an intent can't be played by the active unit, or null when it can. */
  check(intent: TurnIntent): string | null {
    const u = this.active;
    if (!u || this.over) return 'No turn is in progress.';
    const { moveTo, ability, target } = intent;
    const moving = moveTo.x !== u.x || moveTo.z !== u.z;
    if (moving && (u.hasMoved || !this.grid.getReachableTiles(u, this.units).some((t) => t.x === moveTo.x && t.z === moveTo.z))) return 'Out of reach.';
    if (ability) {
      if (u.hasActed) return 'Already acted.';
      if (ability.mpCost > u.currentMp) return 'Not enough MP.';
      if (ability.item && !((this.ctx.pouchOf(u) || {})[ability.item] > 0)) return 'None left.';
      if (!target) return 'No target.';
      if (!ability.isSelfOnly && !isCentered(ability) &&
        !this.grid.canTarget(moveTo.x, moveTo.z, target.x, target.z, ability.range, ability.heightTolerance, CombatEngine.isSupportive(ability))) return 'Out of range.';
    }
    return null;
  }

  /**
   * Plays the active unit's turn: move, act, face, end the turn. Returns the events it made, or
   * throws when the intent isn't legal (see `check`).
   */
  apply(intent: TurnIntent): BattleEvent[] {
    const problem = this.check(intent);
    if (problem) throw new Error(problem);
    const u = this.active!;
    const from = this.events.length;
    if (intent.moveTo.x !== u.x || intent.moveTo.z !== u.z) {
      u.x = intent.moveTo.x;
      u.z = intent.moveTo.z;
      u.hasMoved = true;
      endPerformance(u); // walking off ends a song or dance
      this.events.push({ t: 'move', unit: u.id, x: u.x, z: u.z });
    }
    if (intent.ability && intent.target) this.act('act', u, intent.ability, intent.target.x, intent.target.z);
    if (!this.settle()) {
      if (!u.isDead) {
        u.facing = intent.facing;
        this.events.push({ t: 'face', unit: u.id, facing: u.facing });
      }
      this.turns.endTurn(u);
    }
    return this.events.slice(from);
  }
}

/** Something that decides a unit's turn: the AI, a recording, or (later) a player. */
export type Decide = (battle: Battle, unit: Unit) => TurnIntent;

/** Plays a battle to the end. Returns how it ended and every choice made, for a replay. */
export function runBattle(battle: Battle, decide: Decide, maxTurns = 400): { outcome: BattleOutcome | null; intents: TurnIntent[] } {
  const intents: TurnIntent[] = [];
  for (let i = 0; i < maxTurns; i++) {
    const u = battle.nextTurn();
    if (!u) break;
    const intent = decide(battle, u);
    intents.push(intent);
    battle.apply(intent);
  }
  return { outcome: battle.outcome, intents };
}

/** A decider that plays back recorded choices in order. */
export const replay = (intents: TurnIntent[]): Decide => {
  let i = 0;
  return () => {
    if (i >= intents.length) throw new Error('The recording ran out.');
    return intents[i++];
  };
};
