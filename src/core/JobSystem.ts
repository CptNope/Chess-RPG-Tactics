import { Unit, Team, FacingDirection, EquippedAbilities, EquippedGear, Item, EquipmentSlot, Ability, StatusEffectType } from './types';
import { JOBS, BASIC_ATTACK } from '../data/jobs';
import { ITEMS } from '../data/items';
import { SIGNATURES } from '../data/signatures';

import { STATUS_DURATION } from './CombatEngine';
import { ENEMY_GRAND_SUMMON_LEVEL } from './Summons';

/** Signature passives veteran enemies of each job fight with. */
export const VETERAN_PASSIVES: Record<string, { reaction?: string; support?: string }> = {
  knight: { reaction: 'kn_parry' },
  white_mage: { reaction: 'wm_auto_potion' },
  black_mage: { support: 'bm_arcane_strength' },
  ninja: { support: 'ni_dual_wield' },
  dragoon: { reaction: 'dr_dragonheart' },
  geomancer: { reaction: 'geo_earthen_ward' },
  monk: { reaction: 'mo_iron_will', support: 'mo_brawler' },
  thief: { reaction: 'th_quick_hands', support: 'th_backstab' },
  summoner: { reaction: 'su_mana_spring' },
  oracle: { reaction: 'or_hex_ward', support: 'or_hex_mastery' },
  paladin: { reaction: 'pa_divine_grace', support: 'pa_zeal' },
  spellblade: { reaction: 'sb_runic', support: 'sb_arcane_edge' },
  chemist: { reaction: 'ch_field_dressing' },
  bard: { reaction: 'bd_refrain' },
  dancer: { reaction: 'dn_captivate' }
};

/** Lifetime JP needed for each job level (index 0 = level 1). The last level is "Master". */
export const JOB_LEVEL_JP = [0, 100, 250, 450, 700, 1000, 1400, 1900];
export const MAX_JOB_LEVEL = JOB_LEVEL_JP.length;

/**
 * Job mastery (0.16.0): a small permanent bonus for sticking with a job. A unit earns the first
 * step at job level 5 (Veteran) and the full bonus at level 8 (Master), and keeps it in every
 * job from then on. The amounts are totals, not steps: Master replaces Veteran.
 */
export type MasteryStat = 'hp' | 'mp' | 'attack' | 'magic' | 'speed' | 'evasion' | 'jump';
export const VETERAN_JOB_LEVEL = 5;
export const JOB_MASTERY: Record<string, { stat: MasteryStat; veteran: number; master: number }> = {
  squire: { stat: 'hp', veteran: 10, master: 25 },
  knight: { stat: 'hp', veteran: 15, master: 35 },
  archer: { stat: 'attack', veteran: 1, master: 2 },
  black_mage: { stat: 'magic', veteran: 1, master: 2 },
  white_mage: { stat: 'mp', veteran: 8, master: 20 },
  dragoon: { stat: 'jump', veteran: 1, master: 2 },
  ninja: { stat: 'evasion', veteran: 4, master: 8 },
  geomancer: { stat: 'mp', veteran: 6, master: 15 },
  time_mage: { stat: 'speed', veteran: 1, master: 2 },
  monk: { stat: 'attack', veteran: 1, master: 2 },
  thief: { stat: 'evasion', veteran: 3, master: 6 },
  summoner: { stat: 'magic', veteran: 1, master: 2 },
  oracle: { stat: 'mp', veteran: 8, master: 20 },
  paladin: { stat: 'hp', veteran: 12, master: 30 },
  spellblade: { stat: 'magic', veteran: 1, master: 2 },
  chemist: { stat: 'hp', veteran: 8, master: 20 },
  bard: { stat: 'mp', veteran: 8, master: 20 },
  dancer: { stat: 'speed', veteran: 1, master: 2 }
};
const MASTERY_NAMES: Record<MasteryStat, string> = { hp: 'HP', mp: 'MP', attack: 'ATK', magic: 'MAG', speed: 'Speed', evasion: 'Evasion', jump: 'Jump' };
/** "+10 HP", "+1 ATK"… */
export const masteryLabel = (stat: MasteryStat, amount: number): string => `+${amount} ${MASTERY_NAMES[stat]}`;

export interface JpGain {
  /** The job's new level, when this gain raised it. */
  leveledTo?: number;
  /** The mastery bonus this gain earned ("+10 HP"), when it reached Veteran or Master. */
  mastery?: string;
  /** Jobs this gain unlocked (their prerequisites are now met). */
  unlocked: string[];
}

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
    } else if (jobId === 'monk') {
      initialGear.weapon = ITEMS.iron_knuckles;
      initialGear.head = ITEMS.leather_cap;
      initialGear.body = ITEMS.leather_vest;
    } else if (jobId === 'chemist') {
      initialGear.weapon = ITEMS.thief_knife;
      initialGear.head = ITEMS.leather_cap;
      initialGear.body = ITEMS.leather_vest;
      initialGear.accessory = ITEMS.mage_ring;
    } else if (jobId === 'thief') {
      initialGear.weapon = ITEMS.thief_knife;
      initialGear.head = ITEMS.leather_cap;
      initialGear.body = ITEMS.leather_vest;
      initialGear.accessory = ITEMS.feather_boots;
    } else if (jobId === 'paladin') {
      initialGear.weapon = ITEMS.iron_sword;
      initialGear.shield = ITEMS.buckler;
      initialGear.head = ITEMS.iron_helm;
      initialGear.body = ITEMS.chainmail;
    } else if (jobId === 'spellblade') {
      initialGear.weapon = ITEMS.iron_sword;
      initialGear.head = ITEMS.wizard_hat;
      initialGear.body = ITEMS.leather_vest;
      initialGear.accessory = ITEMS.mage_ring;
    } else if (jobId === 'summoner' || jobId === 'oracle') {
      initialGear.weapon = ITEMS.chrono_rod;
      initialGear.head = ITEMS.wizard_hat;
      initialGear.body = ITEMS.silk_robe;
    } else if (jobId === 'bard') {
      initialGear.weapon = ITEMS.hunting_bow;
      initialGear.head = ITEMS.wizard_hat;
      initialGear.body = ITEMS.silk_robe;
    } else if (jobId === 'dancer') {
      initialGear.weapon = ITEMS.thief_knife;
      initialGear.head = ITEMS.shinobi_band;
      initialGear.body = ITEMS.shinobi_garb;
      initialGear.accessory = ITEMS.feather_boots;
    }

    const jobLevels: Record<string, number> = {};

    // A small starting bank in every job, so a new job's first abilities are within reach
    const jobPoints: Record<string, number> = {};
    for (const id of Object.keys(JOBS)) jobPoints[id] = id === 'squire' ? 250 : 200;

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
      // Everyone has basic Squire training (Squire Lv 2), which opens Knight and Archer
      jobJpEarned: { squire: JOB_LEVEL_JP[1] },
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

    this.grantPrerequisites(unit, jobId);
    this.recalculateDerivedStats(unit);
    unit.currentHp = unit.maxHp;
    unit.currentMp = unit.maxMp;
    return unit;
  }

  // ---------------------------------------------------------------------------
  // Job levels and the job tree
  // ---------------------------------------------------------------------------

  /** A unit's level in a job (1 to MAX_JOB_LEVEL), from the lifetime JP it has earned there. */
  public static jobLevel(unit: Unit, jobId: string): number {
    const earned = unit.jobJpEarned?.[jobId] || 0;
    let level = 1;
    for (let i = 1; i < JOB_LEVEL_JP.length; i++) if (earned >= JOB_LEVEL_JP[i]) level = i + 1;
    return level;
  }

  /** JP earned into the current job level and JP the next level needs (need = 0 at Master). */
  public static jobLevelProgress(unit: Unit, jobId: string): { level: number; into: number; need: number } {
    const level = this.jobLevel(unit, jobId);
    const earned = unit.jobJpEarned?.[jobId] || 0;
    if (level >= MAX_JOB_LEVEL) return { level, into: 0, need: 0 };
    return { level, into: earned - JOB_LEVEL_JP[level - 1], need: JOB_LEVEL_JP[level] - JOB_LEVEL_JP[level - 1] };
  }

  /** Prerequisites the unit hasn't met yet for a job (empty = unlocked). */
  public static missingPrerequisites(unit: Unit, jobId: string): { jobId: string; level: number; have: number }[] {
    const out: { jobId: string; level: number; have: number }[] = [];
    for (const p of JOBS[jobId]?.prerequisites || []) {
      const have = this.jobLevel(unit, p.jobId);
      if (have < p.level) out.push({ jobId: p.jobId, level: p.level, have });
    }
    return out;
  }

  /** True when the unit may switch to the job: its prerequisites are met, or it already holds it. */
  public static canChangeJob(unit: Unit, jobId: string): boolean {
    if (!JOBS[jobId]) return false;
    return unit.jobId === jobId || this.missingPrerequisites(unit, jobId).length === 0;
  }

  /** Jobs the unit can switch to right now. */
  public static unlockedJobs(unit: Unit): string[] {
    return Object.keys(JOBS).filter((id) => this.canChangeJob(unit, id));
  }

  /**
   * Gives a unit the job levels a job requires, all the way down the tree. Used for units that
   * start in an advanced job (recruits, enemies, the opening squad) and for old saves.
   */
  public static grantPrerequisites(unit: Unit, jobId: string, seen: Set<string> = new Set()): void {
    if (seen.has(jobId)) return;
    seen.add(jobId);
    const earned = (unit.jobJpEarned ||= {});
    for (const p of JOBS[jobId]?.prerequisites || []) {
      earned[p.jobId] = Math.max(earned[p.jobId] || 0, JOB_LEVEL_JP[Math.min(p.level, MAX_JOB_LEVEL) - 1]);
      this.grantPrerequisites(unit, p.jobId, seen);
    }
  }

  /** Adds JP to the unit's current job: spendable and lifetime. Reports a level-up and any jobs it unlocks. */
  public static gainJp(unit: Unit, amount: number): JpGain {
    const jobId = unit.jobId;
    const before = this.jobLevel(unit, jobId);
    const lockedBefore = Object.keys(JOBS).filter((id) => !this.canChangeJob(unit, id));
    const earned = (unit.jobJpEarned ||= {});
    unit.jobPoints[jobId] = (unit.jobPoints[jobId] || 0) + amount;
    earned[jobId] = (earned[jobId] || 0) + amount;
    const after = this.jobLevel(unit, jobId);
    if (after === before) return { unlocked: [] };
    const gain: JpGain = { leveledTo: after, unlocked: lockedBefore.filter((id) => this.canChangeJob(unit, id)) };
    const m = JOB_MASTERY[jobId];
    const tierBefore = before >= MAX_JOB_LEVEL ? 2 : before >= VETERAN_JOB_LEVEL ? 1 : 0;
    const tierAfter = this.masteryTier(unit, jobId);
    if (m && tierAfter > tierBefore) {
      gain.mastery = masteryLabel(m.stat, tierAfter === 2 ? m.master : m.veteran);
      // The bonus counts at once. Max HP/MP grow; what the unit has right now is left alone
      this.recalculateDerivedStats(unit);
    }
    return gain;
  }

  /** How much stronger items are in this unit's hands (Pharmacology: ×1.5). */
  public static itemPotency(unit: Unit): number {
    return unit.equippedAbilities.support === 'ch_pharmacology' ? 1.5 : 1;
  }

  /** 0 = none yet, 1 = Veteran (job level 5), 2 = Master (job level 8). */
  public static masteryTier(unit: Unit, jobId: string): 0 | 1 | 2 {
    const lv = this.jobLevel(unit, jobId);
    return lv >= MAX_JOB_LEVEL ? 2 : lv >= VETERAN_JOB_LEVEL ? 1 : 0;
  }

  /** Everything the unit's mastered jobs add, summed per stat. It applies in whatever job the unit holds. */
  public static masteryBonus(unit: Unit): Record<MasteryStat, number> {
    const total: Record<MasteryStat, number> = { hp: 0, mp: 0, attack: 0, magic: 0, speed: 0, evasion: 0, jump: 0 };
    if (!unit.jobJpEarned) return total;
    for (const [jobId, m] of Object.entries(JOB_MASTERY)) {
      const tier = this.masteryTier(unit, jobId);
      if (tier) total[m.stat] += tier === 2 ? m.master : m.veteran;
    }
    return total;
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

    // Armor Mastery: HP from armor, helms and shields counts half again
    const armorMastery = unit.equippedAbilities.support === 'kn_heavy_armor';
    for (const item of Object.values(unit.equipment)) {
      if (item && item.stats) {
        if (item.stats.hp) gearHp += armorMastery && item.slot !== 'weapon' && item.slot !== 'accessory' ? Math.round(item.stats.hp * 1.5) : item.stats.hp;
        if (item.stats.mp) gearMp += item.stats.mp;
        if (item.stats.attack) gearAtk += item.stats.attack;
        if (item.stats.magic) gearMag += item.stats.magic;
        if (item.stats.speed) gearSpd += item.stats.speed;
        if (item.stats.move) gearMove += item.stats.move;
        if (item.stats.jump) gearJump += item.stats.jump;
        if (item.stats.evasion) gearEva += item.stats.evasion;
      }
    }

    // Apply job multipliers + gear + job mastery
    const mastery = this.masteryBonus(unit);
    unit.maxHp = Math.round(unit.baseStats.hp * job.statMultipliers.hp) + gearHp + mastery.hp;
    unit.maxMp = Math.round(unit.baseStats.mp * job.statMultipliers.mp) + gearMp + mastery.mp;
    // A lighter job or gear can't leave a unit holding more than its new maximum (0.22.0)
    if (typeof unit.currentHp === 'number' && unit.currentHp > unit.maxHp) unit.currentHp = unit.maxHp;
    if (typeof unit.currentMp === 'number' && unit.currentMp > unit.maxMp) unit.currentMp = unit.maxMp;

    // Speed calculation
    let spd = Math.round(unit.baseStats.speed * job.statMultipliers.speed) + gearSpd + mastery.speed;
    if (unit.statuses.some((s) => s.type === 'haste')) {
      spd = Math.round(spd * 1.5);
    }
    if (unit.statuses.some((s) => s.type === 'slow')) {
      spd = Math.max(2, Math.round(spd * 0.67));
    }
    unit.speed = Math.max(1, spd);

    // Movement & Jump
    let move = job.baseMove + gearMove;
    let jump = job.baseJump + gearJump + mastery.jump;

    if (unit.statuses.some((s) => s.type === 'immobilize')) {
      move = 0;
    } else if (unit.equippedAbilities.movement === 'sq_move_plus') {
      move += 1;
    }

    if (unit.equippedAbilities.movement === 'ar_jump_plus') {
      jump += 1;
    }
    if (unit.equippedAbilities.movement === 'th_fleet') {
      if (move > 0) move += 1;
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
    unit.evasion = gearEva + mastery.evasion;
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
    let atk = unit.baseStats.attack * job.statMultipliers.attack + this.gearStat(unit, 'attack') + this.masteryBonus(unit).attack;
    if (unit.statuses.some((s) => s.type === 'focus')) atk *= 1.25;
    if (unit.isEnraged) atk *= 1.2;
    return atk;
  }

  /** Effective magical power: base stat scaled by the current job, plus gear MAG. */
  public static getMagicPower(unit: Unit): number {
    const job = JOBS[unit.jobId] || JOBS.squire;
    let mag = unit.baseStats.magic * job.statMultipliers.magic + this.gearStat(unit, 'magic') + this.masteryBonus(unit).magic;
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
    unit.usedIronWill = false;
    unit.performing = undefined;
    unit.calling = undefined;
    unit.usedSignatures = [];
    unit.ct = 0;
    unit.hasMoved = false;
    unit.hasActed = false;
    unit.x = x;
    unit.z = z;
    unit.facing = 'N';
    this.recalculateDerivedStats(unit);
    unit.currentHp = unit.maxHp;
    unit.currentMp = unit.maxMp;
    this.applyGearStatuses(unit);
  }

  /**
   * Statuses the unit's gear grants at the start of a battle (Verdant Charm's Regen, Warding Amulet's
   * Protect and Shell...). Regen from gear lasts the whole battle; the rest run their normal course.
   */
  public static applyGearStatuses(unit: Unit): void {
    const start = new Set<StatusEffectType>();
    for (const it of Object.values(unit.equipment)) for (const s of it?.traits?.startStatus || []) start.add(s);
    for (const type of start) {
      const duration = type === 'regen' ? 99 : STATUS_DURATION[type];
      const cur = unit.statuses.find((s) => s.type === type);
      if (cur) cur.duration = Math.max(cur.duration, duration);
      else unit.statuses.push({ type, duration });
    }
    if (start.size) this.recalculateDerivedStats(unit);
  }

  /**
   * Gives veteran enemies (level 4+) their job's signature reaction/support and every action in
   * its skillset (grand summons from level 6), so they fight like the player's units. Shared by the game and the balance sim.
   */
  public static equipVeteranPassives(u: Unit): void {
    const p = VETERAN_PASSIVES[u.jobId] || {};
    if (u.level < 4) return;
    if (p.reaction) {
      u.unlockedAbilities[p.reaction] = true;
      u.equippedAbilities.reaction = p.reaction;
    }
    if (p.support) {
      u.unlockedAbilities[p.support] = true;
      u.equippedAbilities.support = p.support;
    }
    for (const a of JOBS[u.jobId]?.abilities || []) {
      // Grand summons only from level 6 (0.24.0)
      if (a.type === 'action' && !(a.charge && u.level < ENEMY_GRAND_SUMMON_LEVEL)) u.unlockedAbilities[a.id] = true;
    }
  }

  /**
   * Brings a unit from an older save up to date:
   * - banks the starting 200 JP for any job the save has never seen;
   * - rebuilds lifetime JP (0.14.0) from what the unit holds and has spent, so job levels reflect
   *   the play already done, and never locks the job or secondary skillset it's using.
   */
  public static ensureJobPoints(unit: Unit): void {
    for (const id of Object.keys(JOBS)) {
      if (unit.jobPoints[id] === undefined) unit.jobPoints[id] = 200;
    }
    if (!unit.jobJpEarned) {
      const earned: Record<string, number> = {};
      for (const job of Object.values(JOBS)) {
        const spent = job.abilities.reduce((n, a) => n + (unit.unlockedAbilities[a.id] ? a.jpCost : 0), 0);
        const start = job.id === 'squire' ? 250 : 200;
        earned[job.id] = Math.max(0, (unit.jobPoints[job.id] || 0) + spent - start);
      }
      earned.squire = Math.max(earned.squire, JOB_LEVEL_JP[1]);
      unit.jobJpEarned = earned;
    }
    this.grantPrerequisites(unit, unit.jobId);
    if (unit.equippedAbilities.secondaryJobId) this.grantPrerequisites(unit, unit.equippedAbilities.secondaryJobId);
  }

  /** MP an ability really costs this unit (Conserve halves it, rounding up). */
  public static mpCostFor(unit: Unit, ability: Ability): number {
    if (ability.mpCost > 0 && unit.equippedAbilities.support === 'su_conserve') return Math.ceil(ability.mpCost / 2);
    return ability.mpCost;
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
    return Object.values(SIGNATURES).find((a) => a.id === abilityId) || null;
  }

  /** Master signatures the unit has earned: one for every job it has mastered (0.23.0). */
  public static signaturesOf(unit: Unit): Ability[] {
    return Object.entries(SIGNATURES).filter(([jobId]) => this.masteryTier(unit, jobId) === 2).map(([, a]) => a);
  }

  /** Marks a signature as spent for this battle. */
  public static useSignature(unit: Unit, ability: Ability): void {
    if (!ability.signature) return;
    unit.usedSignatures = [...(unit.usedSignatures || []).filter((id) => id !== ability.id), ability.id];
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

    if (unit.equippedAbilities.secondaryJobId && unit.equippedAbilities.secondaryJobId !== unit.equippedAbilities.primaryJobId) {
      const secondaryJob = JOBS[unit.equippedAbilities.secondaryJobId];
      if (secondaryJob) {
        for (const a of secondaryJob.abilities) {
          if (a.type === 'action' && unit.unlockedAbilities[a.id]) {
            actions.push(a);
          }
        }
      }
    }

    // Master signatures, in any job, once per battle each (0.23.0)
    for (const sig of this.signaturesOf(unit)) {
      if (!(unit.usedSignatures || []).includes(sig.id)) actions.push(sig);
    }

    // Silence seals every ability that costs MP
    const silenced = unit.statuses.some((s) => s.type === 'silence');
    return actions
      .filter((a) => !silenced || a.mpCost === 0)
      .map((a) => {
        const mp = this.mpCostFor(unit, a);
        return mp === a.mpCost ? a : { ...a, mpCost: mp };
      });
  }
}
