import { Unit, Team, FacingDirection, EquippedAbilities, EquippedGear, Item, EquipmentSlot, Ability } from './types';
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
      hp: 120 + level * 18,
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
    } else if (jobId === 'geomancer') {
      initialGear.weapon = ITEMS.gaia_staff;
      initialGear.head = ITEMS.shinobi_band;
      initialGear.body = ITEMS.chainmail;
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
      geomancer: 200,
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
    if (unit.equippedAbilities.movement === 'geo_stride') {
      jump += 2;
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

  /** Sum of a stat across all equipped gear. */
  public static gearStat(unit: Unit, stat: keyof Item['stats']): number {
    let total = 0;
    for (const item of Object.values(unit.equipment)) {
      if (item && item.stats && item.stats[stat]) total += item.stats[stat]!;
    }
    return total;
  }

  /**
   * Effective physical power: base stat scaled by the current job, plus weapon/gear ATK.
   * Focus (+25%) and a boss enrage (+20%) are battle-only multipliers, never written to baseStats.
   */
  public static getAttackPower(unit: Unit): number {
    const job = JOBS[unit.jobId] || JOBS.squire;
    let atk = unit.baseStats.attack * job.statMultipliers.attack + this.gearStat(unit, 'attack');
    if (unit.statuses.some((s) => s.type === 'focus')) atk *= 1.25;
    if (unit.isEnraged) atk *= 1.2;
    return atk;
  }

  /** Effective magical power: base stat scaled by the current job, plus gear MAG. */
  public static getMagicPower(unit: Unit): number {
    const job = JOBS[unit.jobId] || JOBS.squire;
    let mag = unit.baseStats.magic * job.statMultipliers.magic + this.gearStat(unit, 'magic');
    if (unit.isEnraged) mag *= 1.2;
    return mag;
  }

  /** EXP needed for each level. Kept flat so level-ups arrive every battle or two. */
  public static readonly EXP_PER_LEVEL = 100;

  /**
   * Awards EXP and applies any level-ups. Returns the number of levels gained.
   * Each level adds +18 HP, +5 MP, +1.8 ATK, +1.6 MAG; Speed rises every third level.
   */
  public static grantExp(unit: Unit, amount: number): number {
    unit.exp += Math.max(0, Math.round(amount));
    let gained = 0;
    while (unit.exp >= this.EXP_PER_LEVEL && unit.level < 99) {
      unit.exp -= this.EXP_PER_LEVEL;
      unit.level++;
      gained++;
      unit.baseStats.hp += 18;
      unit.baseStats.mp += 5;
      unit.baseStats.attack = Math.round((unit.baseStats.attack + 1.8) * 10) / 10;
      unit.baseStats.magic = Math.round((unit.baseStats.magic + 1.6) * 10) / 10;
      unit.baseStats.speed = 8 + Math.floor(unit.level / 3);
    }
    if (gained > 0) {
      const hpRatio = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 1;
      this.recalculateDerivedStats(unit);
      unit.currentHp = Math.max(1, Math.round(unit.maxHp * hpRatio));
    }
    return gained;
  }

  /** Turns a unit into a boss: +60% HP, +15% ATK/MAG, a fixed reaction, and an enrage phase. */
  public static makeBoss(unit: Unit): void {
    unit.isBoss = true;
    unit.isEnraged = false;
    unit.baseStats.hp = Math.round(unit.baseStats.hp * 1.6);
    unit.baseStats.attack = Math.round(unit.baseStats.attack * 1.15 * 10) / 10;
    unit.baseStats.magic = Math.round(unit.baseStats.magic * 1.15 * 10) / 10;
    this.recalculateDerivedStats(unit);
    unit.currentHp = unit.maxHp;
    unit.currentMp = unit.maxMp;
  }

  /** Restores a squad member between battles and places them on a deployment tile. */
  public static resetForBattle(unit: Unit, x: number, z: number): void {
    unit.isDead = false;
    unit.statuses = [];
    unit.isEnraged = false;
    unit.usedDragonheart = false;
    unit.ct = 0;
    unit.hasMoved = false;
    unit.hasActed = false;
    unit.x = x;
    unit.z = z;
    unit.facing = 'N';
    this.recalculateDerivedStats(unit);
    unit.currentHp = unit.maxHp;
    unit.currentMp = unit.maxMp;
  }

  /** Passive abilities (reaction / support / movement) the unit has learned from any job. */
  public static getLearnedPassives(unit: Unit, type: 'reaction' | 'support' | 'movement'): { id: string; name: string }[] {
    const out: { id: string; name: string }[] = [];
    for (const job of Object.values(JOBS)) {
      for (const a of job.abilities) {
        if (a.type === type && unit.unlockedAbilities[a.id]) out.push({ id: a.id, name: a.name });
      }
    }
    return out;
  }

  /** Looks up any ability by id across all jobs (or the basic attack). */
  public static findAbility(abilityId: string | null): Ability | null {
    if (!abilityId) return null;
    if (abilityId === BASIC_ATTACK.id) return BASIC_ATTACK;
    for (const job of Object.values(JOBS)) {
      const a = job.abilities.find((ab) => ab.id === abilityId);
      if (a) return a;
    }
    return null;
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
