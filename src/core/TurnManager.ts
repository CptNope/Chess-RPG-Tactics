import { Unit } from './types';

export class TurnManager {
  public units: Unit[];
  public activeUnit: Unit | null = null;

  constructor(units: Unit[]) {
    this.units = units;
  }

  /**
   * Advances the CT clock until at least one unit reaches CT >= 100.
   */
  public advanceToNextActiveTurn(): Unit | null {
    // If there is already an active unit that hasn't finished, return it
    if (this.activeUnit && !this.activeUnit.isDead && (!this.activeUnit.hasMoved || !this.activeUnit.hasActed)) {
      return this.activeUnit;
    }

    const aliveUnits = this.units.filter((u) => !u.isDead);
    if (aliveUnits.length === 0) return null;

    let iterations = 0;
    while (iterations < 1000) {
      iterations++;

      // Check if any unit has reached CT >= 100
      const readyUnits = aliveUnits.filter((u) => u.ct >= 100);
      if (readyUnits.length > 0) {
        // Sort by highest CT, then by Speed
        readyUnits.sort((a, b) => b.ct - a.ct || b.speed - a.speed);
        const nextActive = readyUnits[0];

        // Start active unit turn
        this.activeUnit = nextActive;
        nextActive.hasMoved = false;
        nextActive.hasActed = false;
        return nextActive;
      }

      // Tick all units
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

    // Clone simulated CT states
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
        // Assume full turn action (ct - 100)
        top.ct -= 100;
      } else {
        // Advance tick
        for (const s of sim) {
          s.ct += s.speed;
        }
      }
    }

    return queue;
  }
}
