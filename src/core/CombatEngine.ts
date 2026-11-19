import { Unit, Ability, CombatForecast, ActiveStatus, StatusEffectType, TerrainType } from './types';
import { JobSystem } from './JobSystem';

export interface ReactionTrigger {
  name: string;
  type: 'counter_attack' | 'auto_potion' | 'speed_save' | 'dragonheart' | 'critical_quick' | 'parry' | 'earthen_ward';
  target: Unit;
  damage?: number;
  heal?: number;
  description: string;
}

export interface AttackResult {
  hit: boolean;
  damageDealt: number;
  isCrit: boolean;
  isHeal: boolean;
  appliedStatus?: string;
  reaction?: ReactionTrigger;
  secondStrike?: {
    hit: boolean;
    damageDealt: number;
    isCrit: boolean;
  };
  /** Set when this hit pushed a boss below 50% HP and into its enrage phase. */
  bossEnraged?: boolean;
}

/** Statuses that help the unit carrying them (cast on allies, never on foes). */
export const BENEFICIAL_STATUSES: StatusEffectType[] = ['haste', 'protect', 'focus'];

/** How long each status lasts, in the affected unit's turns. */
export const STATUS_DURATION: Record<StatusEffectType, number> = {
  haste: 3,
  slow: 3,
  protect: 3,
  immobilize: 2,
  poison: 3,
  focus: 4
};

/** Damage scale factors. Tuned so a same-level basic attack from the front kills in 2-4 hits. */
const PHYSICAL_SCALE = 5;
const MAGIC_SCALE = 3;

export class CombatEngine {
  /** True for heals and buffs: abilities meant for the caster's own side. */
  public static isSupportive(ability: Ability): boolean {
    return ability.power < 0 || (!!ability.appliesStatus && BENEFICIAL_STATUSES.includes(ability.appliesStatus) && ability.power === 0);
  }

  /**
   * Determines whether an attack hits from the Front, Flank (Side), or Back.
   */
  public static getFacingType(attackerX: number, attackerZ: number, target: Unit): 'front' | 'flank' | 'back' {
    const dx = attackerX - target.x;
    const dz = attackerZ - target.z;

    let fx = 0;
    let fz = 0;
    switch (target.facing) {
      case 'N': fz = -1; break;
      case 'S': fz = 1; break;
      case 'E': fx = 1; break;
      case 'W': fx = -1; break;
    }

    const len = Math.hypot(dx, dz) || 1;
    const dot = fx * (dx / len) + fz * (dz / len);

    if (dot > 0.3) return 'front';
    if (dot < -0.3) return 'back';
    return 'flank';
  }

  /**
   * Generates a combat forecast for battle preview.
   */
  public static getForecast(
    attacker: Unit,
    target: Unit,
    ability: Ability,
    attackerHeight: number,
    targetHeight: number,
    targetTerrain?: TerrainType,
    /** True when the target is on the edge of an area spell rather than the aimed tile (60% damage). */
    isSplash: boolean = false
  ): CombatForecast {
    const isSelf = attacker.id === target.id;
    const facingType = isSelf ? 'front' : this.getFacingType(attacker.x, attacker.z, target);
    const heightAdvantage = attackerHeight - targetHeight;
    const supportive = this.isSupportive(ability);

    // Base hit chance, modified by facing, elevation and the target's gear evasion
    let hitChance = 80;
    if (facingType === 'flank') hitChance += 15;
    if (facingType === 'back') hitChance += 30;
    if (heightAdvantage > 0) hitChance += 5;
    if (heightAdvantage < 0) hitChance -= 10;
    if (ability.element === 'physical' && facingType !== 'back') {
      hitChance -= Math.max(0, target.evasion - 5);
    }

    // Reaction ability: Ninja Reflexes / Vanish
    if (target.equippedAbilities.reaction === 'ni_shadow_clone' && !supportive) {
      hitChance = Math.max(15, hitChance - 35);
    }

    hitChance = Math.min(100, Math.max(10, hitChance));

    let baseDamage = 0;
    if (ability.id === 'tm_gravity') {
      // Gravity shears 25% of current HP; bosses resist it (12%).
      baseDamage = Math.max(1, Math.round(target.currentHp * (target.isBoss ? 0.12 : 0.25)));
    } else if (supportive && ability.power === 0) {
      baseDamage = 0;
      hitChance = 100;
    } else if (ability.element === 'physical') {
      baseDamage = JobSystem.getAttackPower(attacker) * ability.power * PHYSICAL_SCALE;
    } else {
      baseDamage = JobSystem.getMagicPower(attacker) * Math.abs(ability.power) * MAGIC_SCALE;
    }

    if (ability.power > 0 && ability.id !== 'tm_gravity') {
      // Support abilities
      if (attacker.equippedAbilities.support === 'bm_arcane_strength' && ability.element !== 'physical') {
        baseDamage *= 1.25;
      }
      if (attacker.equippedAbilities.support === 'geo_attack_up' && ability.element === 'physical') {
        baseDamage *= 1.2;
      }

      // Protect reduces physical damage taken by 30%
      if (target.statuses.some((s) => s.type === 'protect') && ability.element === 'physical') {
        baseDamage *= 0.7;
      }

      // Facing and height only matter for physical strikes; spells land the same from any side
      if (ability.element === 'physical') {
        if (facingType === 'flank') baseDamage *= 1.15;
        if (facingType === 'back') baseDamage *= 1.3;
        if (heightAdvantage > 0) baseDamage *= 1.1;
      }
    }

    if (isSplash && ability.power > 0) baseDamage *= 0.6;

    const willDualWield = attacker.equippedAbilities.support === 'ni_dual_wield' && ability.id === 'basic_attack';

    if (ability.power < 0) {
      hitChance = 100;
      baseDamage = -Math.round(baseDamage);
    } else if (ability.power > 0) {
      baseDamage = Math.max(1, Math.round(baseDamage));
    }

    return {
      attacker,
      target,
      ability,
      hitChance,
      expectedDamage: baseDamage,
      facingType,
      heightAdvantage,
      willDualWield,
      targetTerrain
    };
  }

  /** Applies (or refreshes) a status effect on a unit. */
  public static applyStatus(unit: Unit, type: StatusEffectType): void {
    const duration = STATUS_DURATION[type];
    const existing = unit.statuses.find((s) => s.type === type);
    if (existing) {
      existing.duration = duration;
    } else {
      const status: ActiveStatus = { type, duration };
      unit.statuses.push(status);
    }
    JobSystem.recalculateDerivedStats(unit);
  }

  private static damage(target: Unit, amount: number): void {
    target.currentHp = Math.max(0, target.currentHp - amount);
    if (target.currentHp === 0) target.isDead = true;
  }

  /**
   * Executes the attack and returns result details.
   * `rng` is injectable so tests can make rolls deterministic.
   */
  public static executeAttack(forecast: CombatForecast, rng: () => number = Math.random): AttackResult {
    const { attacker, target, ability } = forecast;
    const roll = rng() * 100;
    const hit = roll <= forecast.hitChance;

    // Knight Weapon Guard: 30% chance to parry a physical strike from the front
    if (
      ability.element === 'physical' &&
      ability.power > 0 &&
      forecast.facingType === 'front' &&
      attacker.id !== target.id &&
      target.equippedAbilities.reaction === 'kn_parry' &&
      rng() * 100 <= 30
    ) {
      return {
        hit: false,
        damageDealt: 0,
        isCrit: false,
        isHeal: false,
        reaction: {
          name: 'Weapon Guard',
          type: 'parry',
          target: attacker,
          description: `${target.name} parried the strike with their blade!`
        }
      };
    }

    if (!hit) {
      return { hit: false, damageDealt: 0, isCrit: false, isHeal: false };
    }

    let appliedStatusName: string | undefined;
    if (ability.appliesStatus) {
      this.applyStatus(target, ability.appliesStatus);
      appliedStatusName = ability.appliesStatus.toUpperCase();
    }

    if (ability.power < 0) {
      const healAmount = Math.abs(forecast.expectedDamage);
      target.currentHp = Math.min(target.maxHp, target.currentHp + healAmount);
      return { hit: true, damageDealt: healAmount, isCrit: false, isHeal: true, appliedStatus: appliedStatusName };
    }

    if (forecast.expectedDamage === 0) {
      return { hit: true, damageDealt: 0, isCrit: false, isHeal: false, appliedStatus: appliedStatusName };
    }

    // Critical roll
    let critChance = 5;
    if (forecast.facingType === 'flank') critChance += 10;
    if (forecast.facingType === 'back') critChance += 25;

    const isCrit = rng() * 100 <= critChance;
    let finalDamage = forecast.expectedDamage;
    if (isCrit) finalDamage = Math.round(finalDamage * 1.5);

    this.damage(target, finalDamage);

    const reactionTrigger = this.checkReaction(forecast, rng);

    // Second strike for Dual Wield
    let secondStrikeResult: AttackResult['secondStrike'];
    if (forecast.willDualWield && !target.isDead) {
      if (rng() * 100 <= forecast.hitChance) {
        const isCrit2 = rng() * 100 <= critChance;
        let dmg2 = Math.round(forecast.expectedDamage * 0.9);
        if (isCrit2) dmg2 = Math.round(dmg2 * 1.5);
        this.damage(target, dmg2);
        secondStrikeResult = { hit: true, damageDealt: dmg2, isCrit: isCrit2 };
      } else {
        secondStrikeResult = { hit: false, damageDealt: 0, isCrit: false };
      }
    }

    // Boss enrage: the first time a boss drops to 50% HP it gains Haste and +20% power
    let bossEnraged = false;
    if (target.isBoss && !target.isDead && !target.isEnraged && target.currentHp <= target.maxHp / 2) {
      target.isEnraged = true;
      target.statuses = target.statuses.filter((s) => s.type !== 'slow' && s.type !== 'immobilize');
      target.statuses.push({ type: 'haste', duration: 99 });
      JobSystem.recalculateDerivedStats(target);
      bossEnraged = true;
    }

    return {
      hit: true,
      damageDealt: finalDamage,
      isCrit,
      isHeal: false,
      appliedStatus: appliedStatusName,
      reaction: reactionTrigger,
      secondStrike: secondStrikeResult,
      bossEnraged
    };
  }

  /** Resolves the defender's equipped reaction ability after taking damage. */
  private static checkReaction(forecast: CombatForecast, rng: () => number): ReactionTrigger | undefined {
    const { attacker, target, ability } = forecast;
    const reaction = target.equippedAbilities.reaction;
    if (!reaction || attacker.id === target.id) return undefined;

    // Dragoon Dragonheart: survive a fatal blow once per battle with 1 HP and Protect
    if (target.isDead) {
      if (reaction === 'dr_dragonheart' && !target.usedDragonheart) {
        target.usedDragonheart = true;
        target.isDead = false;
        target.currentHp = 1;
        this.applyStatus(target, 'protect');
        return {
          name: 'Dragonheart',
          type: 'dragonheart',
          target,
          description: `${target.name}'s Dragonheart defied death with 1 HP remaining!`
        };
      }
      return undefined;
    }

    const dist = Math.abs(attacker.x - target.x) + Math.abs(attacker.z - target.z);

    switch (reaction) {
      case 'wm_auto_potion': {
        const healAmt = 30;
        target.currentHp = Math.min(target.maxHp, target.currentHp + healAmt);
        return {
          name: 'Auto-Potion',
          type: 'auto_potion',
          target,
          heal: healAmt,
          description: `${target.name} drank an Auto-Potion, recovering +${healAmt} HP!`
        };
      }
      case 'ar_speed_save': {
        target.speed += 2;
        return {
          name: 'Speed Save',
          type: 'speed_save',
          target,
          description: `${target.name}'s Speed increased by +2!`
        };
      }
      case 'sq_counter': {
        if (ability.element !== 'physical' || dist > 1) return undefined;
        const counterDmg = Math.max(1, Math.round(JobSystem.getAttackPower(target) * 3.5));
        this.damage(attacker, counterDmg);
        return {
          name: 'Counter Tackle',
          type: 'counter_attack',
          target: attacker,
          damage: counterDmg,
          description: `${target.name} retaliated with Counter Tackle for ${counterDmg} DMG!`
        };
      }
      case 'bm_magic_counter': {
        if (rng() * 100 > 50) return undefined; // 50% trigger chance
        const counterDmg = Math.max(1, Math.round(JobSystem.getMagicPower(target) * 3));
        this.damage(attacker, counterDmg);
        return {
          name: 'Arcane Retaliation',
          type: 'counter_attack',
          target: attacker,
          damage: counterDmg,
          description: `${target.name} retaliated with Arcane Retaliation for ${counterDmg} DMG!`
        };
      }
      case 'tm_critical_quick': {
        if (target.currentHp / target.maxHp > 0.35) return undefined;
        target.ct = 100;
        return {
          name: 'Critical Quick',
          type: 'critical_quick',
          target,
          description: `${target.name} accelerated time! CT instantly charged to 100!`
        };
      }
      case 'geo_earthen_ward': {
        const t = forecast.targetTerrain;
        if (t !== 'stone' && t !== 'dirt' && t !== 'parapet') return undefined;
        if (target.statuses.some((s) => s.type === 'protect')) return undefined;
        this.applyStatus(target, 'protect');
        return {
          name: 'Earthen Ward',
          type: 'earthen_ward',
          target,
          description: `The ground hardens around ${target.name}: Protect!`
        };
      }
      default:
        return undefined;
    }
  }
}
