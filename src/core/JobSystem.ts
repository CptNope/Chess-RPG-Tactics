import { Unit, Team, FacingDirection, EquippedAbilities, EquippedGear, Item, EquipmentSlot } from './types';
import { JOBS, BASIC_ATTACK } from '../data/jobs';
import { ITEMS } from '../data/items';

export class JobSystem {
  /**
   * Creates a unit with proper base stats, job stat scaling, and equipped gear.
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

    const initialEquipped: EquippedAbilities = {
      primaryJobId: jobId,
      secondaryJobId: null,
      reaction: null,
      support: null,
      movement: null
    };

    const initialGear: EquippedGear = {
      weapon: null,
      shield: null,
      head: null,
      body: null,
      accessory: null
    };

    // Default starting equipment based on job class
    if (jobId === 'knight' || jobId === 'squire') {
      initialGear.weapon = ITEMS.iron_sword;
      initialGear.shield = ITEMS.buckler;
      initialGear.body = ITEMS.chainmail;
    } else if (jobId === 'dragoon') {
      initialGear.weapon = ITEMS.dragon_lance;
      initialGear.head = ITEMS.iron_helm;
      initialGear.body = ITEMS.chainmail;
      initialGear.accessory = ITEMS.battle_boots;
    } else if (jobId === 'ninja') {
      initialGear.weapon = ITEMS.assassin_daggers;
      initialGear.head = ITEMS.shinobi_band;
      initialGear.body = ITEMS.shinobi_garb;
      initialGear.accessory = ITEMS.hermes_shoes;
    } else if (jobId === 'archer') {
      initialGear.weapon = ITEMS.hunting_bow;
      initialGear.head = ITEMS.shinobi_band;
      initialGear.accessory = ITEMS.feather_boots;
    } else if (jobId === 'black_mage' || jobId === 'time_mage') {
      initialGear.weapon = ITEMS.chrono_rod;
      initialGear.head = ITEMS.wizard_hat;
      initialGear.body = ITEMS.silk_robe;
      initialGear.accessory = ITEMS.mage_ring;
    } else if (jobId === 'white_mage') {
      initialGear.weapon = ITEMS.chrono_rod;
      initialGear.body = ITEMS.silk_robe;
      initialGear.accessory = ITEMS.mage_ring;
    }

    const jobLevels: Record<string, number> = {
      squire: 2,
      chemist: 1
    };
    jobLevels[jobId] = 2;

    const jobPoints: Record<string, number> = {
      squire: 250,
      knight: 200,
      archer: 200,
      black_mage: 200,
      white_mage: 200,
      dragoon: 200,
      ninja: 200,
      time_mage: 200
    };

    const unlockedAbilities: Record<string, boolean> = {
      basic_attack: true
    };

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
      equipment: initialGear,
      baseStats,
      currentHp: 100,
      maxHp: 100,
      currentMp: 30,
      maxMp: 30,
      speed: 8,
      ct: 0,
      move: job.baseMove,
      jump: job.baseJump,
      evasion: 5,
      statuses: [],
      x,
      z,
      facing,
      isDead: false,
      hasMoved: false,
      hasActed: false
    };

    this.recalculateDerivedStats(unit);
    unit.currentHp = unit.maxHp;
    unit.currentMp = unit.maxMp;
    return unit;
  }

  /**
   * Recalculates stats whenever job, abilities, or equipment change.
   */
  public static recalculateDerivedStats(unit: Unit): void {
    const job = JOBS[unit.jobId] || JOBS.squire;

    // Calculate gear stat sums
    let gearHp = 0;
    let gearMp = 0;
    let gearAtk = 0;
    let gearMag = 0;
    let gearSpd = 0;
    let gearMove = 0;
    let gearJump = 0;
    let gearEva = 5;

    for (const item of Object.values(unit.equipment)) {
      if (item && item.stats) {
        if (item.stats.hp) gearHp += item.stats.hp;
        if (item.stats.mp) gearMp += item.stats.mp;
        if (item.stats.attack) gearAtk += item.stats.attack;
        if (item.stats.magic) gearMag += item.stats.magic;
        if (item.stats.speed) gearSpd += item.stats.speed;
        if (item.stats.move) gearMove += item.stats.move;
        if (item.stats.jump) gearJump += item.stats.jump;
        if (item.stats.evasion) gearEva += item.stats.evasion;
      }
    }

    // Apply job multipliers + gear
    unit.maxHp = Math.round(unit.baseStats.hp * job.statMultipliers.hp) + gearHp;
    unit.maxMp = Math.round(unit.baseStats.mp * job.statMultipliers.mp) + gearMp;

    // Speed calculation
    let spd = Math.round(unit.baseStats.speed * job.statMultipliers.speed) + gearSpd;
    if (unit.statuses.some((s) => s.type === 'haste')) {
      spd = Math.round(spd * 1.5);
    }
    if (unit.statuses.some((s) => s.type === 'slow')) {
      spd = Math.max(2, Math.round(spd * 0.67));
    }
    unit.speed = Math.max(1, spd);

    // Movement & Jump
    let move = job.baseMove + gearMove;
    let jump = job.baseJump + gearJump;

    if (unit.statuses.some((s) => s.type === 'immobilize')) {
      move = 0;
    } else if (unit.equippedAbilities.movement === 'sq_move_plus') {
      move += 1;
    }

    if (unit.equippedAbilities.movement === 'ar_jump_plus') {
      jump += 1;
    }
    if (unit.equippedAbilities.movement === 'dr_ignore_height') {
      jump = 99;
    }

    unit.move = Math.max(0, move);
    unit.jump = Math.max(1, jump);
    unit.evasion = gearEva;
  }

  public static equipItem(unit: Unit, item: Item): void {
    unit.equipment[item.slot] = item;
    this.recalculateDerivedStats(unit);
  }

  public static unequipItem(unit: Unit, slot: EquipmentSlot): void {
    unit.equipment[slot] = null;
    this.recalculateDerivedStats(unit);
  }

  public static changeJob(unit: Unit, newJobId: string): void {
    if (!JOBS[newJobId]) return;
    unit.jobId = newJobId;
    unit.equippedAbilities.primaryJobId = newJobId;
    this.recalculateDerivedStats(unit);
  }

  public static setSecondarySkillset(unit: Unit, secondaryJobId: string | null): void {
    unit.equippedAbilities.secondaryJobId = secondaryJobId;
  }

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

  public static getCombatActionAbilities(unit: Unit) {
    const actions = [BASIC_ATTACK];

    // If unit is equipped with a spear or bow, update basic attack range!
    if (unit.equipment.weapon) {
      if (unit.equipment.weapon.range && unit.equipment.weapon.range > 1) {
        actions[0] = {
          ...BASIC_ATTACK,
          range: unit.equipment.weapon.range,
          heightTolerance: unit.equipment.weapon.weaponType === 'bow' ? 4.0 : 2.0
        };
      }
    }

    const primaryJob = JOBS[unit.equippedAbilities.primaryJobId];
    if (primaryJob) {
      for (const a of primaryJob.abilities) {
        if (a.type === 'action' && unit.unlockedAbilities[a.id]) {
          actions.push(a);
        }
      }
    }

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
