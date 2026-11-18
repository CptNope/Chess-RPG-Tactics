import { Unit } from './types';
import { JobSystem } from './JobSystem';

export class TurnManager {
  public units: Unit[];
  public activeUnit: Unit | null = null;

  constructor(units: Unit[]) {
    this.units = units;
  }

  /**
   * Advances the CT clock until at least one unit reaches CT >= 100.
   */
  public advanceToNextActiveTurn(): { activeUnit: Unit; poisonDamage?: number } | null {
    if (this.activeUnit && !this.activeUnit.isDead && (!this.activeUnit.hasMoved || !this.activeUnit.hasActed)) {
      return { activeUnit: this.activeUnit };
    }

    const aliveUnits = this.units.filter((u) => !u.isDead);
    if (aliveUnits.length === 0) return null;

    let iterations = 0;
    while (iterations < 1000) {
      iterations++;

      const readyUnits = aliveUnits.filter((u) => u.ct >= 100);
      if (readyUnits.length > 0) {
        readyUnits.sort((a, b) => b.ct - a.ct || b.speed - a.speed);
        const nextActive = readyUnits[0];

        this.activeUnit = nextActive;
        nextActive.hasMoved = false;
        nextActive.hasActed = false;

        // Process Poison damage at start of turn
        let poisonDmg: number | undefined;
        if (nextActive.statuses.some((s) => s.type === 'poison')) {
          poisonDmg = Math.max(1, Math.round(nextActive.maxHp * 0.10));
          nextActive.currentHp = Math.max(0, nextActive.currentHp - poisonDmg);
          if (nextActive.currentHp === 0) {
            nextActive.isDead = true;
            this.activeUnit = null;
            return this.advanceToNextActiveTurn();
          }
        }

        return { activeUnit: nextActive, poisonDamage: poisonDmg };
      }

      // Tick all units according to current speed
      for (const u of aliveUnits) {
        u.ct += u.speed;
      }
    }

    return null;
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

    // Tick down status durations
    for (let i = unit.statuses.length - 1; i >= 0; i--) {
      unit.statuses[i].duration--;
      if (unit.statuses[i].duration <= 0) {
        unit.statuses.splice(i, 1);
      }
    }

    JobSystem.recalculateDerivedStats(unit);

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
