import { Unit, Ability, CombatForecast, ActiveStatus, StatusEffectType, TerrainType, Item, EquipmentSlot } from './types';
import { JobSystem } from './JobSystem';

export interface ReactionTrigger {
  name: string;
  type: 'counter_attack' | 'auto_potion' | 'speed_save' | 'dragonheart' | 'critical_quick' | 'parry' | 'earthen_ward'
    | 'iron_will' | 'quick_hands' | 'mana_spring' | 'hex_ward' | 'divine_grace' | 'runic';
  target: Unit;
  damage?: number;
  heal?: number;
  /** A status the reaction put on `target` (for the effect and floating label). */
  status?: StatusEffectType;
  /** Floating label over `target`, e.g. "MP +12". */
  label?: string;
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
  /** The target's gear guarded against the ability's status. */
  resisted?: boolean;
  /** Number of ailments a cleansing ability removed. */
  cleansed?: number;
  /** HP the caster drained back (Soul Drain). */
  drained?: number;
  /** Gear lifted off the target by Steal. */
  stolen?: Item;
  /** The blow woke a sleeping target. */
  woke?: boolean;
  /** MP an item restored. */
  mpRestored?: number;
  /** The target was raised from the fallen. */
  revived?: boolean;
}

/** Statuses that help the unit carrying them (cast on allies, never on foes). */
export const BENEFICIAL_STATUSES: StatusEffectType[] = ['haste', 'protect', 'focus', 'shell', 'regen'];

/** Ailments: what cleansing removes and what gear can guard against. */
export const HARMFUL_STATUSES: StatusEffectType[] = ['slow', 'immobilize', 'poison', 'blind', 'silence', 'sleep', 'breach'];

/** How long each status lasts, in the affected unit's turns. */
export const STATUS_DURATION: Record<StatusEffectType, number> = {
  haste: 3,
  slow: 3,
  protect: 3,
  immobilize: 2,
  poison: 3,
  focus: 4,
  shell: 3,
  regen: 4,
  blind: 3,
  silence: 3,
  sleep: 2,
  breach: 3
};

/** Gear Steal tries first: the small, valuable pieces before weapons and armor. */
const STEAL_ORDER: EquipmentSlot[] = ['accessory', 'head', 'weapon', 'shield', 'body'];

/** True when the unit's gear guards it against `status`. */
export function guardsAgainst(unit: Unit, status: StatusEffectType): boolean {
  return Object.values(unit.equipment).some((it) => it?.traits?.guard?.includes(status));
}

/** True when the unit's gear strengthens `element`. */
function boosts(unit: Unit, element: string): boolean {
  return Object.values(unit.equipment).some((it) => it?.traits?.boost?.includes(element as never));
}

const has = (u: Unit, s: StatusEffectType) => u.statuses.some((x) => x.type === s);

/** Damage scale factors. Tuned so a same-level basic attack from the front kills in 2-4 hits. */
const PHYSICAL_SCALE = 5;
const MAGIC_SCALE = 3;

export class CombatEngine {
  /** True for heals and buffs: abilities meant for the caster's own side. */
  public static isSupportive(ability: Ability): boolean {
    if (ability.item) return !ability.fixedDamage;
    if (ability.power < 0) return true;
    if (ability.power !== 0 || ability.steal) return false;
    return !!ability.cleanse || (!!ability.appliesStatus && BENEFICIAL_STATUSES.includes(ability.appliesStatus));
  }

  /** The first piece of gear Steal would take, or null when there's nothing to take. */
  public static stealableItem(target: Unit): Item | null {
    for (const slot of STEAL_ORDER) if (target.equipment[slot]) return target.equipment[slot];
    return null;
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

    // Blind attackers flail at physical targets
    if (has(attacker, 'blind') && ability.element === 'physical' && !supportive) hitChance -= 40;
    // Hex Mastery: ailments land more often
    if (attacker.equippedAbilities.support === 'or_hex_mastery' && ability.appliesStatus && HARMFUL_STATUSES.includes(ability.appliesStatus)) {
      hitChance += 20;
    }
    // Steal is harder than a blow, and a boss keeps a firm grip on its gear
    if (ability.steal) hitChance -= target.isBoss ? 45 : 25;

    hitChance = Math.min(100, Math.max(10, hitChance));
    // A sleeper can't dodge
    if (has(target, 'sleep') && !supportive && !isSelf) hitChance = 100;
    if (ability.steal && !this.stealableItem(target)) hitChance = 0;
    // Items always work, and do the same whoever uses them
    if (ability.item) hitChance = 100;

    let baseDamage = 0;
    if (ability.item) {
      // Fixed amounts: negative = healing, like spells
      baseDamage = ability.fixedDamage || -(ability.fixedHeal || 0);
    } else if (ability.id === 'tm_gravity') {
      // Gravity shears 25% of current HP; bosses resist it (12%).
      baseDamage = Math.max(1, Math.round(target.currentHp * (target.isBoss ? 0.12 : 0.25)));
    } else if ((supportive && ability.power === 0) || ability.steal) {
      baseDamage = 0;
      if (supportive) hitChance = 100;
    } else {
      // Weapon skills scale with ATK, spells with MAG; heals always use the gentler spell scale
      const useAttack = ability.scalesWith ? ability.scalesWith === 'attack' : ability.element === 'physical';
      const stat = useAttack ? JobSystem.getAttackPower(attacker) : JobSystem.getMagicPower(attacker);
      const scale = useAttack && ability.power > 0 ? PHYSICAL_SCALE : MAGIC_SCALE;
      baseDamage = stat * Math.abs(ability.power) * scale;
    }

    // Gear that strengthens an element (rods, holy blades) boosts its damage and holy healing
    if (ability.power !== 0 && ability.id !== 'tm_gravity' && ability.element !== 'physical' && boosts(attacker, ability.element)) {
      baseDamage *= 1.25;
    }

    // Zeal: a Paladin's holy strikes and heals run hotter
    if (ability.power !== 0 && ability.element === 'holy' && attacker.equippedAbilities.support === 'pa_zeal') {
      baseDamage *= 1.2;
    }

    if (ability.power > 0 && ability.id !== 'tm_gravity' && !ability.item) {
      // Arcane Edge: the basic Attack carries the wielder's magic
      if (attacker.equippedAbilities.support === 'sb_arcane_edge' && ability.id === 'basic_attack') {
        baseDamage += JobSystem.getMagicPower(attacker) * 1.5;
      }
      // Support abilities
      if (attacker.equippedAbilities.support === 'bm_arcane_strength' && ability.element !== 'physical') {
        baseDamage *= 1.25;
      }
      if (attacker.equippedAbilities.support === 'geo_attack_up' && ability.element === 'physical') {
        baseDamage *= 1.2;
      }
      // Brawler: fists and knuckles hit harder
      if (
        attacker.equippedAbilities.support === 'mo_brawler' &&
        ability.id === 'basic_attack' &&
        (!attacker.equipment.weapon || attacker.equipment.weapon.weaponType === 'knuckles')
      ) {
        baseDamage *= 1.3;
      }

      // Protect cuts physical damage taken by 30%, Shell does the same for spells; Breach opens armor up (+25%)
      if (ability.element === 'physical') {
        if (has(target, 'protect')) baseDamage *= 0.7;
        if (has(target, 'breach')) baseDamage *= 1.25;
      } else if (has(target, 'shell')) {
        baseDamage *= 0.7;
      }

      // Facing and height only matter for physical strikes; spells land the same from any side
      if (ability.element === 'physical') {
        const backstab = attacker.equippedAbilities.support === 'th_backstab';
        if (facingType === 'flank') baseDamage *= backstab ? 1.15 * 1.15 : 1.15;
        if (facingType === 'back') baseDamage *= backstab ? 1.3 * 1.3 : 1.3;
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

  /** Applies (or refreshes) a status effect on a unit. Returns false when the unit's gear guards against it. */
  public static applyStatus(unit: Unit, type: StatusEffectType, duration: number = STATUS_DURATION[type]): boolean {
    if (HARMFUL_STATUSES.includes(type) && guardsAgainst(unit, type)) return false;
    const existing = unit.statuses.find((s) => s.type === type);
    if (existing) {
      existing.duration = duration;
    } else {
      const status: ActiveStatus = { type, duration };
      unit.statuses.push(status);
    }
    JobSystem.recalculateDerivedStats(unit);
    return true;
  }

  /** Removes every ailment from a unit. Returns how many were removed. */
  public static cleanse(unit: Unit): number {
    const before = unit.statuses.length;
    unit.statuses = unit.statuses.filter((s) => !HARMFUL_STATUSES.includes(s.type));
    JobSystem.recalculateDerivedStats(unit);
    return before - unit.statuses.length;
  }

  /** Deals damage. Returns true when the blow woke the unit from Sleep. */
  private static damage(target: Unit, amount: number): boolean {
    target.currentHp = Math.max(0, target.currentHp - amount);
    if (target.currentHp === 0) target.isDead = true;
    if (amount > 0 && has(target, 'sleep')) {
      target.statuses = target.statuses.filter((s) => s.type !== 'sleep');
      return true;
    }
    return false;
  }

  /**
   * Executes the attack and returns result details.
   * `rng` is injectable so tests can make rolls deterministic.
   */
  /** Boss enrage: the first time a boss drops to 50% HP it gains Haste and +20% power. */
  private static checkBossEnrage(target: Unit): boolean {
    if (!target.isBoss || target.isDead || target.isEnraged || target.currentHp > target.maxHp / 2) return false;
    target.isEnraged = true;
    target.statuses = target.statuses.filter((s) => s.type !== 'slow' && s.type !== 'immobilize');
    target.statuses.push({ type: 'haste', duration: 99 });
    JobSystem.recalculateDerivedStats(target);
    return true;
  }

  /** True when the item's action can do something for this unit (revives need the fallen; the rest, the living). */
  public static itemCanTarget(ability: Ability, target: Unit): boolean {
    return ability.revive ? target.isDead : !target.isDead;
  }

  /**
   * Resolves a consumable. Items never miss, crit or trigger reactions, and their amounts are
   * fixed: a Potion heals the same in anyone's hands.
   */
  private static useItem(forecast: CombatForecast): AttackResult {
    const { target, ability } = forecast;
    const none: AttackResult = { hit: false, damageDealt: 0, isCrit: false, isHeal: false };
    if (!this.itemCanTarget(ability, target)) return none;

    if (ability.revive) {
      target.isDead = false;
      target.statuses = [];
      target.ct = 0;
      JobSystem.recalculateDerivedStats(target);
      target.currentHp = Math.max(1, Math.round(target.maxHp * ability.revive));
      return { hit: true, damageDealt: target.currentHp, isCrit: false, isHeal: true, revived: true };
    }

    const cleansed = ability.cleanse ? this.cleanse(target) : undefined;
    let mpRestored: number | undefined;
    if (ability.fixedMp) {
      mpRestored = Math.min(ability.fixedMp, target.maxMp - target.currentMp);
      target.currentMp += mpRestored;
    }
    if (ability.fixedDamage) {
      const dealt = Math.min(target.currentHp, ability.fixedDamage);
      const woke = this.damage(target, ability.fixedDamage);
      return { hit: true, damageDealt: dealt, isCrit: false, isHeal: false, woke, bossEnraged: this.checkBossEnrage(target) };
    }
    const heal = ability.fixedHeal ? Math.min(ability.fixedHeal, target.maxHp - target.currentHp) : 0;
    target.currentHp += heal;
    return { hit: true, damageDealt: heal, isCrit: false, isHeal: heal > 0 || !!ability.fixedHeal, cleansed, mpRestored };
  }

  public static executeAttack(forecast: CombatForecast, rng: () => number = Math.random): AttackResult {
    const { attacker, target, ability } = forecast;
    if (ability.item) return this.useItem(forecast);
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

    // Steal: lift the first stealable piece of gear off the target
    if (ability.steal) {
      const item = this.stealableItem(target);
      if (!item) return { hit: false, damageDealt: 0, isCrit: false, isHeal: false };
      target.equipment[item.slot] = null;
      JobSystem.recalculateDerivedStats(target);
      target.currentHp = Math.min(target.currentHp, target.maxHp);
      target.currentMp = Math.min(target.currentMp, target.maxMp);
      return { hit: true, damageDealt: 0, isCrit: false, isHeal: false, stolen: item };
    }

    let appliedStatusName: string | undefined;
    let resisted = false;
    if (ability.appliesStatus) {
      if (this.applyStatus(target, ability.appliesStatus)) appliedStatusName = ability.appliesStatus.toUpperCase();
      else resisted = true;
    }
    const cleansed = ability.cleanse ? this.cleanse(target) : undefined;

    if (ability.power < 0) {
      const healAmount = Math.abs(forecast.expectedDamage);
      target.currentHp = Math.min(target.maxHp, target.currentHp + healAmount);
      return { hit: true, damageDealt: healAmount, isCrit: false, isHeal: true, appliedStatus: appliedStatusName, cleansed };
    }

    if (forecast.expectedDamage === 0) {
      return { hit: true, damageDealt: 0, isCrit: false, isHeal: false, appliedStatus: appliedStatusName, resisted, cleansed };
    }

    // Critical roll
    let critChance = 5;
    if (forecast.facingType === 'flank') critChance += 10;
    if (forecast.facingType === 'back') critChance += 25;

    const isCrit = rng() * 100 <= critChance;
    let finalDamage = forecast.expectedDamage;
    if (isCrit) finalDamage = Math.round(finalDamage * 1.5);

    const woke = this.damage(target, finalDamage);

    // Soul Drain: the caster heals for a share of the damage
    let drained: number | undefined;
    if (ability.drain && !attacker.isDead) {
      drained = Math.max(1, Math.round(finalDamage * ability.drain));
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + drained);
    }

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

    const bossEnraged = this.checkBossEnrage(target);

    return {
      hit: true,
      damageDealt: finalDamage,
      isCrit,
      isHeal: false,
      appliedStatus: appliedStatusName,
      resisted,
      reaction: reactionTrigger,
      secondStrike: secondStrikeResult,
      bossEnraged,
      drained,
      woke
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
      case 'mo_iron_will': {
        if (target.usedIronWill || target.currentHp > target.maxHp / 2) return undefined;
        target.usedIronWill = true;
        this.applyStatus(target, 'focus');
        this.applyStatus(target, 'protect');
        return {
          name: 'Iron Will',
          type: 'iron_will',
          target,
          status: 'focus',
          label: 'FOCUS + PROTECT',
          description: `${target.name} steels themselves: Focus and Protect!`
        };
      }
      case 'th_quick_hands': {
        if (rng() * 100 > 40 || has(target, 'haste')) return undefined;
        this.applyStatus(target, 'haste');
        return {
          name: 'Quick Hands',
          type: 'quick_hands',
          target,
          status: 'haste',
          label: 'HASTE',
          description: `${target.name} slips the blow and speeds up: Haste!`
        };
      }
      case 'su_mana_spring': {
        if (target.currentMp >= target.maxMp) return undefined;
        const mp = Math.max(1, Math.round(target.maxMp * 0.15));
        target.currentMp = Math.min(target.maxMp, target.currentMp + mp);
        return {
          name: 'Mana Spring',
          type: 'mana_spring',
          target,
          label: `MP +${mp}`,
          description: `${target.name}'s Mana Spring restores ${mp} MP.`
        };
      }
      case 'or_hex_ward': {
        if (rng() * 100 > 35 || attacker.isDead || has(attacker, 'blind')) return undefined;
        if (!this.applyStatus(attacker, 'blind')) return undefined;
        return {
          name: 'Hex Ward',
          type: 'hex_ward',
          target: attacker,
          status: 'blind',
          label: 'BLIND',
          description: `${target.name}'s Hex Ward blinds ${attacker.name}!`
        };
      }
      case 'pa_divine_grace': {
        if (rng() * 100 > 30 || target.currentHp >= target.maxHp) return undefined;
        const heal = Math.min(target.maxHp - target.currentHp, Math.max(1, Math.round(target.maxHp * 0.15)));
        target.currentHp += heal;
        return {
          name: 'Divine Grace',
          type: 'divine_grace',
          target,
          heal,
          label: `+${heal}`,
          description: `${target.name} is touched by Divine Grace: +${heal} HP!`
        };
      }
      case 'sb_runic': {
        if (ability.element === 'physical' || target.currentMp >= target.maxMp) return undefined;
        const mp = Math.min(target.maxMp - target.currentMp, Math.max(1, Math.round(target.maxMp * 0.2)));
        target.currentMp += mp;
        return {
          name: 'Runic',
          type: 'runic',
          target,
          label: `MP +${mp}`,
          description: `${target.name}'s blade drinks in the spell: +${mp} MP.`
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
