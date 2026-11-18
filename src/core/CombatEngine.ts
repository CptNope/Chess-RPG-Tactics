import { Unit, Ability, CombatForecast } from './types';

export class CombatEngine {
  /**
   * Determines whether an attack hits from the Front, Flank (Side), or Back.
   */
  public static getFacingType(attackerX: number, attackerZ: number, target: Unit): 'front' | 'flank' | 'back' {
    const dx = attackerX - target.x;
    const dz = attackerZ - target.z;

    // Target facing directional vector
    let fx = 0;
    let fz = 0;
    switch (target.facing) {
      case 'N': fz = -1; break;
      case 'S': fz = 1; break;
      case 'E': fx = 1; break;
      case 'W': fx = -1; break;
    }

    // Dot product between facing vector and vector pointing toward attacker
    // Normalize attacker vector
    const len = Math.hypot(dx, dz) || 1;
    const ndx = dx / len;
    const ndz = dz / len;

    const dot = fx * ndx + fz * ndz;

    // dot > 0.5 means attacker is in front (within 60 degrees of target gaze)
    // dot < -0.5 means attacker is behind target (backstab!)
    // otherwise it's a flank attack
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
    hitChance = Math.min(100, Math.max(10, hitChance));

    // Damage Calculation
    let baseDamage = 0;
    if (ability.element === 'physical') {
      baseDamage = attacker.baseStats.attack * ability.power * 8;
    } else {
      // Magic damage
      baseDamage = attacker.baseStats.magic * Math.abs(ability.power) * 9;
    }

    // Support abilities modification
    if (attacker.equippedAbilities.support === 'bm_arcane_strength' && ability.element !== 'physical') {
      baseDamage *= 1.25;
    }

    // Facing multiplier
    if (facingType === 'flank') baseDamage *= 1.15;
    if (facingType === 'back') baseDamage *= 1.30;

    // Height modifier
    if (heightAdvantage > 0) baseDamage *= 1.10;

    // Healing spells have negative power
    if (ability.power < 0) {
      hitChance = 100; // White magic on allies always connects
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
      heightAdvantage
    };
  }

  /**
   * Executes the attack and returns result details.
   */
  public static executeAttack(
    forecast: CombatForecast
  ): { hit: boolean; damageDealt: number; isCrit: boolean; isHeal: boolean } {
    const roll = Math.random() * 100;
    const hit = roll <= forecast.hitChance;

    if (!hit) {
      return { hit: false, damageDealt: 0, isCrit: false, isHeal: false };
    }

    const isHeal = forecast.ability.power < 0;
    if (isHeal) {
      const healAmount = Math.abs(forecast.expectedDamage);
      forecast.target.currentHp = Math.min(forecast.target.maxHp, forecast.target.currentHp + healAmount);
      return { hit: true, damageDealt: healAmount, isCrit: false, isHeal: true };
    }

    // Critical roll (higher from rear)
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

    return { hit: true, damageDealt: finalDamage, isCrit, isHeal: false };
  }
}
