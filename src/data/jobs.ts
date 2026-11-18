import { Job, Ability } from '../core/types';

export const BASIC_ATTACK: Ability = {
  id: 'basic_attack',
  name: 'Attack',
  jobId: 'all',
  type: 'action',
  description: 'A standard physical strike with equipped weapon.',
  jpCost: 0,
  mpCost: 0,
  range: 1,
  heightTolerance: 1.5,
  aoe: 0,
  power: 1.0,
  element: 'physical'
};

export const JOBS: Record<string, Job> = {
  squire: {
    id: 'squire',
    name: 'Squire',
    description: 'The foundational warrior discipline. Balanced and versatile with basic survival techniques.',
    role: 'Vanguard',
    spriteClass: 'squire',
    baseMove: 4,
    baseJump: 2,
    statMultipliers: {
      hp: 1.0,
      mp: 0.8,
      attack: 1.0,
      magic: 0.8,
      speed: 1.0
    },
    abilities: [
      {
        id: 'sq_stone',
        name: 'Throw Stone',
        jobId: 'squire',
        type: 'action',
        description: 'Hurls a loose rock at a distant target to chip damage.',
        jpCost: 50,
        mpCost: 0,
        range: 4,
        heightTolerance: 2.0,
        aoe: 0,
        power: 0.6,
        element: 'physical'
      },
      {
        id: 'sq_focus',
        name: 'Focus',
        jobId: 'squire',
        type: 'action',
        description: 'Channel concentration to bolster Physical Attack for the battle.',
        jpCost: 100,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical',
        isSelfOnly: true
      },
      {
        id: 'sq_counter',
        name: 'Counter Tackle',
        jobId: 'squire',
        type: 'reaction',
        description: 'Retaliates with a blunt shoulder check when struck by melee attacks.',
        jpCost: 120,
        mpCost: 0,
        range: 1,
        heightTolerance: 1.0,
        aoe: 0,
        power: 0.7,
        element: 'physical'
      },
      {
        id: 'sq_jp_boost',
        name: 'JP Boost',
        jobId: 'squire',
        type: 'support',
        description: 'Gain 50% additional Job Points from all battlefield actions.',
        jpCost: 150,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      },
      {
        id: 'sq_move_plus',
        name: 'Move +1',
        jobId: 'squire',
        type: 'movement',
        description: 'Increases unit movement radius by 1 tile.',
        jpCost: 200,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      }
    ]
  },

  knight: {
    id: 'knight',
    name: 'Knight',
    description: 'Heavily armored protector proficient in breaking opponent equipment and holding defensive lines.',
    role: 'Vanguard',
    spriteClass: 'knight',
    baseMove: 3,
    baseJump: 2,
    statMultipliers: {
      hp: 1.3,
      mp: 0.7,
      attack: 1.25,
      magic: 0.7,
      speed: 0.95
    },
    prerequisites: [{ jobId: 'squire', level: 2 }],
    abilities: [
      {
        id: 'kn_rend_armor',
        name: 'Rend Armor',
        jobId: 'knight',
        type: 'action',
        description: 'Shatters foe armor plating, permanently reducing their physical defense.',
        jpCost: 150,
        mpCost: 5,
        range: 1,
        heightTolerance: 1.5,
        aoe: 0,
        power: 1.1,
        element: 'physical'
      },
      {
        id: 'kn_shield_bash',
        name: 'Shield Bash',
        jobId: 'knight',
        type: 'action',
        description: 'Slams shield into target, knocking them back and dealing physical shock.',
        jpCost: 180,
        mpCost: 8,
        range: 1,
        heightTolerance: 1.5,
        aoe: 0,
        power: 1.3,
        element: 'physical'
      },
      {
        id: 'kn_parry',
        name: 'Weapon Guard',
        jobId: 'knight',
        type: 'reaction',
        description: 'Chance to deflect incoming front-facing physical attacks with blade.',
        jpCost: 200,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      },
      {
        id: 'kn_heavy_armor',
        name: 'Equip Heavy Armor',
        jobId: 'knight',
        type: 'support',
        description: 'Allows non-knight classes to equip plate mail and heavy helms.',
        jpCost: 250,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      }
    ]
  },

  archer: {
    id: 'archer',
    name: 'Archer',
    description: 'Long-range marksman capitalizing on elevation advantages and calculated trick shots.',
    role: 'Marksman',
    spriteClass: 'archer',
    baseMove: 3,
    baseJump: 3,
    statMultipliers: {
      hp: 0.95,
      mp: 0.8,
      attack: 1.1,
      magic: 0.8,
      speed: 1.05
    },
    prerequisites: [{ jobId: 'squire', level: 2 }],
    abilities: [
      {
        id: 'ar_aim',
        name: 'Aim +2',
        jobId: 'archer',
        type: 'action',
        description: 'Takes extra time to line up shot for devastating critical puncture.',
        jpCost: 100,
        mpCost: 0,
        range: 5,
        heightTolerance: 3.0,
        aoe: 0,
        power: 1.4,
        element: 'physical'
      },
      {
        id: 'ar_leg_shot',
        name: 'Leg Shot',
        jobId: 'archer',
        type: 'action',
        description: 'Pinpoints tendon to immobilize enemy movement for 2 turns.',
        jpCost: 160,
        mpCost: 6,
        range: 4,
        heightTolerance: 2.5,
        aoe: 0,
        power: 0.9,
        element: 'physical',
        appliesStatus: 'immobilize'
      },
      {
        id: 'ar_speed_save',
        name: 'Speed Save',
        jobId: 'archer',
        type: 'reaction',
        description: 'Boosts Speed stat whenever sustaining damage in battle.',
        jpCost: 200,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      },
      {
        id: 'ar_jump_plus',
        name: 'Jump +1',
        jobId: 'archer',
        type: 'movement',
        description: 'Allows scaling higher ledges and cliffs effortlessly.',
        jpCost: 180,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      }
    ]
  },

  black_mage: {
    id: 'black_mage',
    name: 'Black Mage',
    description: 'Master of destructive elemental incantations spanning fire, frost, and lightning.',
    role: 'Mage',
    spriteClass: 'black_mage',
    baseMove: 3,
    baseJump: 2,
    statMultipliers: {
      hp: 0.8,
      mp: 1.4,
      attack: 0.7,
      magic: 1.35,
      speed: 0.95
    },
    abilities: [
      {
        id: 'bm_fire',
        name: 'Fire',
        jobId: 'black_mage',
        type: 'action',
        description: 'Engulfs target tile and surrounding foes in searing flame.',
        jpCost: 80,
        mpCost: 10,
        range: 4,
        heightTolerance: 2.0,
        aoe: 1,
        power: 1.3,
        element: 'fire'
      },
      {
        id: 'bm_blizzard',
        name: 'Blizzard',
        jobId: 'black_mage',
        type: 'action',
        description: 'Summons chilling shards of ice to impale enemy formation.',
        jpCost: 80,
        mpCost: 10,
        range: 4,
        heightTolerance: 2.0,
        aoe: 1,
        power: 1.3,
        element: 'ice'
      },
      {
        id: 'bm_thunder',
        name: 'Thunder',
        jobId: 'black_mage',
        type: 'action',
        description: 'Strikes target from high clouds with crackling lightning bolt.',
        jpCost: 80,
        mpCost: 10,
        range: 4,
        heightTolerance: 3.5,
        aoe: 1,
        power: 1.35,
        element: 'lightning'
      },
      {
        id: 'bm_poison',
        name: 'Poison Cloud',
        jobId: 'black_mage',
        type: 'action',
        description: 'Enshrouds foe in venomous miasma, dealing 10% max HP damage every turn.',
        jpCost: 140,
        mpCost: 8,
        range: 3,
        heightTolerance: 2.0,
        aoe: 0,
        power: 0.5,
        element: 'dark',
        appliesStatus: 'poison'
      },
      {
        id: 'bm_arcane_strength',
        name: 'Arcane Strength',
        jobId: 'black_mage',
        type: 'support',
        description: 'Increases all magical damage output by 25%.',
        jpCost: 250,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      }
    ]
  },

  white_mage: {
    id: 'white_mage',
    name: 'White Mage',
    description: 'Devoted healer using sanctified incantations to mend wounds, cure status, and protect allies.',
    role: 'Healer',
    spriteClass: 'white_mage',
    baseMove: 3,
    baseJump: 2,
    statMultipliers: {
      hp: 0.85,
      mp: 1.3,
      attack: 0.7,
      magic: 1.25,
      speed: 1.0
    },
    abilities: [
      {
        id: 'wm_cure',
        name: 'Cure',
        jobId: 'white_mage',
        type: 'action',
        description: 'Restores health to an injured ally with warm holy light.',
        jpCost: 70,
        mpCost: 8,
        range: 4,
        heightTolerance: 2.0,
        aoe: 0,
        power: -1.4,
        element: 'holy'
      },
      {
        id: 'wm_protect',
        name: 'Protect',
        jobId: 'white_mage',
        type: 'action',
        description: 'Erects an arcane barrier, softening physical blows by 30% for 3 turns.',
        jpCost: 120,
        mpCost: 12,
        range: 3,
        heightTolerance: 2.0,
        aoe: 0,
        power: 0,
        element: 'holy',
        appliesStatus: 'protect'
      },
      {
        id: 'wm_auto_potion',
        name: 'Auto-Potion',
        jobId: 'white_mage',
        type: 'reaction',
        description: 'Instantly drinks a restorative potion when taking direct damage.',
        jpCost: 200,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      },
      {
        id: 'wm_regen_move',
        name: 'Regen Walk',
        jobId: 'white_mage',
        type: 'movement',
        description: 'Restores 10% of maximum HP on every tile movement step.',
        jpCost: 220,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      }
    ]
  },

  dragoon: {
    id: 'dragoon',
    name: 'Dragoon',
    description: 'Skyward knight wielding polearms. Masters of crushing vertical plunge attacks and draconic arts.',
    role: 'Lancer',
    spriteClass: 'dragoon',
    baseMove: 3,
    baseJump: 4, // High baseline jump!
    statMultipliers: {
      hp: 1.2,
      mp: 0.8,
      attack: 1.3,
      magic: 0.8,
      speed: 1.0
    },
    prerequisites: [{ jobId: 'knight', level: 2 }],
    abilities: [
      {
        id: 'dr_jump',
        name: 'Dragon Plunge',
        jobId: 'dragoon',
        type: 'action',
        description: 'Leaps high into the skies and crashes down on target with crushing kinetic force.',
        jpCost: 120,
        mpCost: 6,
        range: 3,
        heightTolerance: 4.0,
        aoe: 0,
        power: 1.6,
        element: 'physical'
      },
      {
        id: 'dr_fire_breath',
        name: 'Dragon Breath',
        jobId: 'dragoon',
        type: 'action',
        description: 'Channels dragon wyrm spirit to spew cones of searing fire.',
        jpCost: 180,
        mpCost: 14,
        range: 2,
        heightTolerance: 2.0,
        aoe: 1,
        power: 1.3,
        element: 'fire'
      },
      {
        id: 'dr_dragonheart',
        name: 'Dragonheart',
        jobId: 'dragoon',
        type: 'reaction',
        description: 'Survives a fatal blow with 1 HP and enters Reraise state.',
        jpCost: 250,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      },
      {
        id: 'dr_ignore_height',
        name: 'Ignore Elevation',
        jobId: 'dragoon',
        type: 'movement',
        description: 'Allows scaling any sheer cliff or watchtower wall regardless of elevation height.',
        jpCost: 350,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      }
    ]
  },

  ninja: {
    id: 'ninja',
    name: 'Ninja',
    description: 'Lethal shadow operative boasting immense speed, evasion, shuriken throwing, and dual-wielding.',
    role: 'Skirmisher',
    spriteClass: 'ninja',
    baseMove: 4,
    baseJump: 3,
    statMultipliers: {
      hp: 0.9,
      mp: 0.7,
      attack: 1.2,
      magic: 0.9,
      speed: 1.25 // Highest speed class!
    },
    prerequisites: [{ jobId: 'archer', level: 2 }],
    abilities: [
      {
        id: 'ni_shuriken',
        name: 'Throw Shuriken',
        jobId: 'ninja',
        type: 'action',
        description: 'Flicks sharp four-pointed steel stars across distance to lacerate opponents.',
        jpCost: 100,
        mpCost: 0,
        range: 4,
        heightTolerance: 2.5,
        aoe: 0,
        power: 1.1,
        element: 'physical'
      },
      {
        id: 'ni_shadow_clone',
        name: 'Reflexes / Vanish',
        jobId: 'ninja',
        type: 'reaction',
        description: 'Splits into smoke decoys upon being targeted, granting 40% evasion against attacks.',
        jpCost: 220,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      },
      {
        id: 'ni_dual_wield',
        name: 'Dual Wield',
        jobId: 'ninja',
        type: 'support',
        description: 'Equips a weapon in both hands; basic attacks strike twice in rapid succession!',
        jpCost: 350,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      },
      {
        id: 'ni_water_walk',
        name: 'Water Walk',
        jobId: 'ninja',
        type: 'movement',
        description: 'Treads effortlessly on water surface and murky bogs without movement penalty.',
        jpCost: 150,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'physical'
      }
    ]
  },

  time_mage: {
    id: 'time_mage',
    name: 'Time Weaver',
    description: 'Chronomancer manipulating space-time fabric to accelerate allies, slow foes, and bend gravity.',
    role: 'Chronomancer',
    spriteClass: 'time_mage',
    baseMove: 3,
    baseJump: 2,
    statMultipliers: {
      hp: 0.85,
      mp: 1.35,
      attack: 0.7,
      magic: 1.25,
      speed: 1.05
    },
    prerequisites: [{ jobId: 'black_mage', level: 2 }],
    abilities: [
      {
        id: 'tm_haste',
        name: 'Haste',
        jobId: 'time_mage',
        type: 'action',
        description: 'Accelerates personal time flux, boosting Speed by +50% for 3 turns.',
        jpCost: 120,
        mpCost: 12,
        range: 4,
        heightTolerance: 2.0,
        aoe: 0,
        power: 0,
        element: 'time',
        appliesStatus: 'haste'
      },
      {
        id: 'tm_slow',
        name: 'Slow',
        jobId: 'time_mage',
        type: 'action',
        description: 'Weaves temporal drag around foe, cutting their Speed by 33% for 3 turns.',
        jpCost: 120,
        mpCost: 12,
        range: 4,
        heightTolerance: 2.0,
        aoe: 0,
        power: 0,
        element: 'time',
        appliesStatus: 'slow'
      },
      {
        id: 'tm_gravity',
        name: 'Gravity',
        jobId: 'time_mage',
        type: 'action',
        description: 'Bends gravitational weight, shearing away 25% of target current HP directly.',
        jpCost: 180,
        mpCost: 16,
        range: 4,
        heightTolerance: 3.0,
        aoe: 0,
        power: 1.2,
        element: 'time'
      },
      {
        id: 'tm_teleport',
        name: 'Teleport',
        jobId: 'time_mage',
        type: 'movement',
        description: 'Folds spacetime to instantly blink to any tile within range, bypassing cliffs and walls!',
        jpCost: 350,
        mpCost: 0,
        range: 0,
        heightTolerance: 0,
        aoe: 0,
        power: 0,
        element: 'time'
      }
    ]
  }
};
