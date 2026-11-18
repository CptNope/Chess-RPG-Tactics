import { Unit, Ability, CombatForecast, ActiveStatus } from './types';

export interface AttackResult {
  hit: boolean;
  damageDealt: number;
  isCrit: boolean;
  isHeal: boolean;
  appliedStatus?: string;
  secondStrike?: {
    hit: boolean;
    damageDealt: number;
    isCrit: boolean;
  };
}

export class CombatEngine {
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
    const ndx = dx / len;
    const ndz = dz / len;

    const dot = fx * ndx + fz * ndz;

    if (dot > 0.3) {
      return 'front';
    } else if (dot < -0.3) {
      return 'back';
    } else {
      return 'flank';
    }
  }

  /**
   * Generates a combat forecast for battle preview.
   */
  public static getForecast(
    attacker: Unit,
    target: Unit,
    ability: Ability,
    attackerHeight: number,
    targetHeight: number
  ): CombatForecast {
    const facingType = this.getFacingType(attacker.x, attacker.z, target);
    const heightAdvantage = attackerHeight - targetHeight;

    // Base Hit Chance
    let hitChance = 80;
    if (facingType === 'flank') hitChance += 15;
    if (facingType === 'back') hitChance += 30;
    if (heightAdvantage > 0) hitChance += 5;
    if (heightAdvantage < 0) hitChance -= 10;

    // Reaction ability: Ninja Reflexes / Vanish grants 40% evasion
    if (target.equippedAbilities.reaction === 'ni_shadow_clone') {
      hitChance = Math.max(15, hitChance - 35);
    }

    hitChance = Math.min(100, Math.max(10, hitChance));

    // Special: Gravity deals 25% of target current HP
    let baseDamage = 0;
    if (ability.id === 'tm_gravity') {
      baseDamage = Math.max(1, Math.round(target.currentHp * 0.25));
    } else if (ability.id === 'sq_focus') {
      baseDamage = 0;
      hitChance = 100;
    } else if (ability.appliesStatus && (ability.id === 'tm_haste' || ability.id === 'wm_protect')) {
      // Buffs on allies
      baseDamage = 0;
      hitChance = 100;
    } else if (ability.element === 'physical') {
      baseDamage = attacker.baseStats.attack * ability.power * 8;
    } else {
      baseDamage = attacker.baseStats.magic * Math.abs(ability.power) * 9;
    }

    // Support abilities modification
    if (attacker.equippedAbilities.support === 'bm_arcane_strength' && ability.element !== 'physical') {
      baseDamage *= 1.25;
    }

    // Status modifier: Protect reduces physical damage taken by 30%
    const hasProtect = target.statuses.some((s) => s.type === 'protect');
    if (hasProtect && ability.element === 'physical') {
      baseDamage *= 0.70;
    }

    // Facing multiplier
    if (facingType === 'flank') baseDamage *= 1.15;
    if (facingType === 'back') baseDamage *= 1.30;

    // Height modifier
    if (heightAdvantage > 0) baseDamage *= 1.10;

    // Dual Wield check
    const willDualWield = attacker.equippedAbilities.support === 'ni_dual_wield' && ability.id === 'basic_attack';

    // Healing spells have negative power
    if (ability.power < 0) {
      hitChance = 100;
      baseDamage = -Math.round(baseDamage);
    } else {
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
      willDualWield
    };
  }

  /**
   * Executes the attack and returns result details.
   */
  public static executeAttack(forecast: CombatForecast): AttackResult {
    const roll = Math.random() * 100;
    const hit = roll <= forecast.hitChance;

    // Self-buffs (e.g. Focus)
    if (forecast.ability.id === 'sq_focus') {
      forecast.attacker.baseStats.attack += 3;
      return { hit: true, damageDealt: 0, isCrit: false, isHeal: false, appliedStatus: 'Attack +3!' };
    }

    if (!hit) {
      return { hit: false, damageDealt: 0, isCrit: false, isHeal: false };
    }

    // Apply Status if ability carries one
    let appliedStatusName: string | undefined;
    if (forecast.ability.appliesStatus) {
      const type = forecast.ability.appliesStatus;
      const existing = forecast.target.statuses.find((s) => s.type === type);
      const duration = type === 'immobilize' ? 2 : 3;

      if (existing) {
        existing.duration = duration;
      } else {
        const newStatus: ActiveStatus = { type, duration };
        forecast.target.statuses.push(newStatus);
      }
      appliedStatusName = type.toUpperCase();
    }

    const isHeal = forecast.ability.power < 0;
    if (isHeal) {
      const healAmount = Math.abs(forecast.expectedDamage);
      forecast.target.currentHp = Math.min(forecast.target.maxHp, forecast.target.currentHp + healAmount);
      return { hit: true, damageDealt: healAmount, isCrit: false, isHeal: true, appliedStatus: appliedStatusName };
    }

    // Pure status buff
    if (forecast.expectedDamage === 0 && forecast.ability.appliesStatus) {
      return { hit: true, damageDealt: 0, isCrit: false, isHeal: false, appliedStatus: appliedStatusName };
    }

    // Critical roll
    let critChance = 5;
    if (forecast.facingType === 'flank') critChance += 10;
    if (forecast.facingType === 'back') critChance += 25;

    const isCrit = Math.random() * 100 <= critChance;
    let finalDamage = forecast.expectedDamage;
    if (isCrit) finalDamage = Math.round(finalDamage * 1.5);

    forecast.target.currentHp = Math.max(0, forecast.target.currentHp - finalDamage);
    if (forecast.target.currentHp === 0) {
      forecast.target.isDead = true;
    }

    // Second Strike for Dual Wield
    let secondStrikeResult: { hit: boolean; damageDealt: number; isCrit: boolean } | undefined;
    if (forecast.willDualWield && !forecast.target.isDead) {
      const roll2 = Math.random() * 100;
      const hit2 = roll2 <= forecast.hitChance;
      if (hit2) {
        const isCrit2 = Math.random() * 100 <= critChance;
        let dmg2 = Math.round(forecast.expectedDamage * 0.9);
        if (isCrit2) dmg2 = Math.round(dmg2 * 1.5);
        forecast.target.currentHp = Math.max(0, forecast.target.currentHp - dmg2);
        if (forecast.target.currentHp === 0) {
          forecast.target.isDead = true;
        }
        secondStrikeResult = { hit: true, damageDealt: dmg2, isCrit: isCrit2 };
      } else {
        secondStrikeResult = { hit: false, damageDealt: 0, isCrit: false };
      }
    }

    return {
      hit: true,
      damageDealt: finalDamage,
      isCrit,
      isHeal: false,
      appliedStatus: appliedStatusName,
      secondStrike: secondStrikeResult
    };
  }
}
