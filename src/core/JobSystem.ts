import { Unit, Team, FacingDirection, EquippedAbilities } from './types';
import { JOBS, BASIC_ATTACK } from '../data/jobs';

export class JobSystem {
  /**
   * Creates a unit with proper base stats and job stat scaling.
   */
  public static createUnit(
    id: string,
    name: string,
    team: Team,
    jobId: string,
    x: number,
    z: number,
    facing: FacingDirection,
    level: number = 1
  ): Unit {
    const job = JOBS[jobId] || JOBS.squire;

    const baseStats = {
      hp: 100 + level * 14,
      mp: 30 + level * 5,
      attack: 9 + level * 1.8,
      magic: 8 + level * 1.6,
      speed: 8 + Math.floor(level / 3)
    };

    const maxHp = Math.round(baseStats.hp * job.statMultipliers.hp);
    const maxMp = Math.round(baseStats.mp * job.statMultipliers.mp);
    const speed = Math.round(baseStats.speed * job.statMultipliers.speed);

    const initialEquipped: EquippedAbilities = {
      primaryJobId: jobId,
      secondaryJobId: null,
      reaction: null,
      support: null,
      movement: null
    };

    const jobLevels: Record<string, number> = {
      squire: 2,
      chemist: 1
    };
    jobLevels[jobId] = 2;

    const jobPoints: Record<string, number> = {
      squire: 200,
      knight: 150,
      archer: 150,
      black_mage: 180,
      white_mage: 180
    };

    const unlockedAbilities: Record<string, boolean> = {
      basic_attack: true
    };

    // Unlock the first ability of the starting job for convenience
    if (job.abilities.length > 0) {
      unlockedAbilities[job.abilities[0].id] = true;
    }

    const unit: Unit = {
      id,
      name,
      team,
      level,
      exp: 0,
      jobId,
      jobLevels,
      jobPoints,
      unlockedAbilities,
      equippedAbilities: initialEquipped,
      baseStats,
      currentHp: maxHp,
      maxHp,
      currentMp: maxMp,
      maxMp,
      speed,
      ct: 0,
      move: job.baseMove,
      jump: job.baseJump,
      x,
      z,
      facing,
      isDead: false,
      hasMoved: false,
      hasActed: false
    };

    this.recalculateDerivedStats(unit);
    return unit;
  }

  /**
   * Recalculates stats whenever job or abilities change (e.g. Move +1 or Jump +1).
   */
  public static recalculateDerivedStats(unit: Unit): void {
    const job = JOBS[unit.jobId] || JOBS.squire;

    unit.maxHp = Math.round(unit.baseStats.hp * job.statMultipliers.hp);
    unit.maxMp = Math.round(unit.baseStats.mp * job.statMultipliers.mp);
    unit.speed = Math.round(unit.baseStats.speed * job.statMultipliers.speed);

    // Baseline move and jump from current job
    let move = job.baseMove;
    let jump = job.baseJump;

    // Movement ability modifiers
    if (unit.equippedAbilities.movement === 'sq_move_plus') {
      move += 1;
    }
    if (unit.equippedAbilities.movement === 'ar_jump_plus') {
      jump += 1;
    }

    unit.move = move;
    unit.jump = jump;
  }

  /**
   * Changes active job and recalculates stats.
   */
  public static changeJob(unit: Unit, newJobId: string): void {
    if (!JOBS[newJobId]) return;
    unit.jobId = newJobId;
    unit.equippedAbilities.primaryJobId = newJobId;
    this.recalculateDerivedStats(unit);
  }

  /**
   * Sets secondary action skillset (from any unlocked job).
   */
  public static setSecondarySkillset(unit: Unit, secondaryJobId: string | null): void {
    unit.equippedAbilities.secondaryJobId = secondaryJobId;
  }

  /**
   * Learns an ability with JP.
   */
  public static learnAbility(unit: Unit, abilityId: string, jobId: string): boolean {
    const job = JOBS[jobId];
    if (!job) return false;

    const ability = job.abilities.find((a) => a.id === abilityId);
    if (!ability) return false;

    const currentJp = unit.jobPoints[jobId] || 0;
    if (currentJp < ability.jpCost) return false;

    unit.jobPoints[jobId] -= ability.jpCost;
    unit.unlockedAbilities[abilityId] = true;
    return true;
  }

  /**
   * Gathers all action abilities available to a unit in combat (Attack + Primary + Secondary).
   */
  public static getCombatActionAbilities(unit: Unit) {
    const actions = [BASIC_ATTACK];

    // Primary Job abilities
    const primaryJob = JOBS[unit.equippedAbilities.primaryJobId];
    if (primaryJob) {
      for (const a of primaryJob.abilities) {
        if (a.type === 'action' && unit.unlockedAbilities[a.id]) {
          actions.push(a);
        }
      }
    }

    // Secondary Job abilities
    if (unit.equippedAbilities.secondaryJobId) {
      const secondaryJob = JOBS[unit.equippedAbilities.secondaryJobId];
      if (secondaryJob) {
        for (const a of secondaryJob.abilities) {
          if (a.type === 'action' && unit.unlockedAbilities[a.id]) {
            actions.push(a);
          }
        }
      }
    }

    return actions;
  }
}
