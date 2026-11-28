import { Unit } from './types';
import { JobSystem } from './JobSystem';
import { CombatEngine } from './CombatEngine';
import { pulsesOn, tickTotems, TotemPulse } from './Totems';

/** What happened at the start of a unit's turn. */
export interface TurnTick {
  unit: Unit;
  poison?: number;
  regen?: number;
  /** What the totems standing around it did (0.47.0). */
  totems?: TotemPulse[];
  /** The unit was asleep and lost the turn. */
  slept?: boolean;
}

export class TurnManager {
  public units: Unit[];
  public activeUnit: Unit | null = null;

  constructor(units: Unit[]) {
    this.units = units;
  }

  /** Turns that passed without the unit acting (asleep), with their start-of-turn ticks, for the battle log. */
  public skipped: TurnTick[] = [];

  /**
   * Advances the CT clock until a unit that can act reaches CT >= 100. Start-of-turn effects
   * (Poison, Regen) resolve here. A sleeping unit's turn passes without it acting.
   */
  public advanceToNextActiveTurn(): { activeUnit: Unit; poisonDamage?: number; regenHeal?: number; totems?: TotemPulse[] } | null {
    if (this.activeUnit && !this.activeUnit.isDead && (!this.activeUnit.hasMoved || !this.activeUnit.hasActed)) {
      return { activeUnit: this.activeUnit };
    }
    this.skipped = [];

    let iterations = 0;
    while (iterations < 2000) {
      iterations++;
      const aliveUnits = this.units.filter((u) => !u.isDead);
      if (aliveUnits.length === 0) return null;

      const readyUnits = aliveUnits.filter((u) => u.ct >= 100);
      if (readyUnits.length === 0) {
        // Tick all units according to current speed
        for (const u of aliveUnits) u.ct += u.speed;
        continue;
      }

      readyUnits.sort((a, b) => b.ct - a.ct || b.speed - a.speed);
      const next = readyUnits[0];
      next.hasMoved = false;
      next.hasActed = false;
      const tick = TurnManager.startOfTurn(next, this.units);

      if (next.isDead) {
        this.skipped.push(tick);
        continue;
      }
      if (next.statuses.some((s) => s.type === 'sleep')) {
        tick.slept = true;
        this.skipped.push(tick);
        next.ct = Math.max(0, next.ct - 100);
        TurnManager.tickStatuses(next);
        continue;
      }

      this.activeUnit = next;
      return { activeUnit: next, poisonDamage: tick.poison, regenHeal: tick.regen, totems: tick.totems };
    }

    return null;
  }

  /** Poison (10% max HP), Regen (8% max HP) and nearby totems at the start of a unit's turn. */
  public static startOfTurn(unit: Unit, units: readonly Unit[] = []): TurnTick {
    const tick: TurnTick = { unit };
    if (unit.statuses.some((s) => s.type === 'poison')) {
      tick.poison = Math.max(1, Math.round(unit.maxHp * 0.1));
      unit.currentHp = Math.max(0, unit.currentHp - tick.poison);
      if (unit.currentHp === 0) unit.isDead = true;
    }
    if (!unit.isDead && unit.statuses.some((s) => s.type === 'regen') && unit.currentHp < unit.maxHp) {
      tick.regen = Math.min(unit.maxHp - unit.currentHp, Math.max(1, Math.round(unit.maxHp * 0.08)));
      unit.currentHp += tick.regen;
    }
    if (!unit.isDead) {
      const pulses = pulsesOn(unit, units, (u, s) => CombatEngine.applyStatus(u, s));
      if (pulses.length) {
        tick.totems = pulses;
        JobSystem.recalculateDerivedStats(unit); // Slow changes speed
      }
    }
    return tick;
  }

  /** Counts down every status one turn and drops the expired ones. */
  public static tickStatuses(unit: Unit): void {
    tickTotems(unit); // a Shaman's totems count its turns too (0.47.0)
    for (let i = unit.statuses.length - 1; i >= 0; i--) {
      unit.statuses[i].duration--;
      if (unit.statuses[i].duration <= 0) unit.statuses.splice(i, 1);
    }
    JobSystem.recalculateDerivedStats(unit);
  }

  /**
   * Concludes the active unit's turn and calculates CT refund based on FFT rules.
   */
  public endTurn(unit: Unit): void {
    if (unit.hasMoved && unit.hasActed) {
      unit.ct = Math.max(0, unit.ct - 100);
    } else if (unit.hasMoved || unit.hasActed) {
      unit.ct = 20; // 20% CT refund for only doing one action
    } else {
      unit.ct = 40; // 40% CT refund for taking no action (pure wait)
    }

    TurnManager.tickStatuses(unit);

    unit.hasMoved = false;
    unit.hasActed = false;
    this.activeUnit = null;
  }

  /**
   * Simulates upcoming turns without modifying state to build the top Turn Order Timeline.
   */
  public predictTurnTimeline(count: number = 8): Unit[] {
    const aliveUnits = this.units.filter((u) => !u.isDead);
    if (aliveUnits.length === 0) return [];

    const sim = aliveUnits.map((u) => ({
      unit: u,
      ct: u.ct,
      speed: u.speed
    }));

    const queue: Unit[] = [];
    let safetyCounter = 0;

    while (queue.length < count && safetyCounter < 500) {
      safetyCounter++;

      const ready = sim.filter((s) => s.ct >= 100);
      if (ready.length > 0) {
        ready.sort((a, b) => b.ct - a.ct || b.speed - a.speed);
        const top = ready[0];
        queue.push(top.unit);
        top.ct -= 100;
      } else {
        for (const s of sim) {
          s.ct += s.speed;
        }
      }
    }

    return queue;
  }
}
