export type TerrainType = 'grass' | 'stone' | 'dirt' | 'water' | 'wood' | 'swamp' | 'parapet';

export type FacingDirection = 'N' | 'E' | 'S' | 'W';

export type Team = 'player' | 'enemy';

export type AbilityType = 'action' | 'reaction' | 'support' | 'movement';

export type Element = 'physical' | 'fire' | 'ice' | 'lightning' | 'holy' | 'dark' | 'time';

export type StatusEffectType =
  | 'haste' | 'slow' | 'protect' | 'immobilize' | 'poison' | 'focus'
  // Added in 0.13.0
  | 'shell' | 'regen' | 'blind' | 'silence' | 'sleep' | 'breach'
  // Added in 0.22.0: a Bard or Dancer holding a performance; it plays again each turn
  | 'encore'
  // Added in 0.24.0: a Summoner calling a grand summon; it arrives at the start of their next turn
  | 'calling';

export interface ActiveStatus {
  type: StatusEffectType;
  duration: number;
}

export type EquipmentSlot = 'weapon' | 'shield' | 'head' | 'body' | 'accessory';

export type WeaponType = 'sword' | 'spear' | 'bow' | 'staff' | 'dagger' | 'knuckles' | 'whip';

/** Passive effects some gear carries on top of its stats. */
export interface ItemTraits {
  /** Statuses the wearer starts every battle with (normal duration; Regen lasts the whole battle). */
  startStatus?: StatusEffectType[];
  /** Elements whose damage (and healing, for holy) the wearer deals at +25%. */
  boost?: Element[];
  /** Statuses that can't be inflicted on the wearer. */
  guard?: StatusEffectType[];
}

export interface Item {
  id: string;
  name: string;
  slot: EquipmentSlot;
  weaponType?: WeaponType;
  description: string;
  price: number;
  stats: {
    hp?: number;
    mp?: number;
    attack?: number;
    magic?: number;
    speed?: number;
    move?: number;
    jump?: number;
    evasion?: number;
  };
  range?: number;
  traits?: ItemTraits;
}

export interface TileData {
  x: number;
  z: number;
  height: number;
  terrain: TerrainType;
  walkable: boolean;
}

export interface Ability {
  id: string;
  name: string;
  jobId: string;
  type: AbilityType;
  description: string;
  jpCost: number;
  mpCost: number;
  range: number;
  heightTolerance: number;
  aoe: number;
  power: number;
  element: Element;
  appliesStatus?: StatusEffectType;
  isLineAttack?: boolean;
  isSelfOnly?: boolean;
  /** Geomancer abilities: element and effect are decided by the terrain the caster stands on. */
  terrainDriven?: boolean;
  /** Elemental skills that hit with weapon strength (ATK) instead of MAG, e.g. a Monk's chi or a holy blade. */
  scalesWith?: 'attack' | 'magic';
  /** Removes harmful statuses (poison, slow, blind, silence, sleep, immobilize, breach) from each target. */
  cleanse?: boolean;
  /** Share of the damage dealt that heals the caster. */
  drain?: number;
  /** Thief: takes one piece of the target's gear instead of dealing damage. */
  steal?: boolean;
  /** Set on the action for using a consumable: the id of the item it spends (see data/consumables.ts). */
  item?: string;
  /** Items: a fixed amount of HP restored, whatever the user's stats. */
  fixedHeal?: number;
  /** Items: a fixed amount of MP restored. */
  fixedMp?: number;
  /** Items: fixed damage, never missing or critting. */
  fixedDamage?: number;
  /** Items: raises a fallen unit with this share of its max HP. Only fallen units can be targeted. */
  revive?: number;
  /**
   * Bard songs and Dancer dances (0.22.0): an area centred on the performer (range 0, radius
   * `aoe`). Songs reach allies, dances foes. It plays again at the start of each of the performer's
   * turns while they hold their ground (see core/Performance.ts).
   */
  performance?: boolean;
  /** An area centred on the caster (range 0, radius `aoe`) that doesn't repeat (0.23.0). */
  centered?: boolean;
  /** A Master signature (0.23.0): earned by mastering its job, usable in any job once per battle. */
  signature?: boolean;
  /** The creature a summon calls up on screen (0.24.0): picks its effect, not its rules. */
  summon?: string;
  /**
   * A grand summon (0.24.0): using it marks the area and the creature arrives at the start of the
   * caster's next turn, hitting whoever stands there then. KO, Sleep or Silence break the call
   * (see core/Summons.ts).
   */
  charge?: boolean;
  /** Also raises fallen allies in the area, with this share of their max HP (0.24.0). */
  rebirth?: number;
  /** Added to the chance to hit (0.27.0): the Wisp's Lure is easy to resist. */
  accuracy?: number;
  /** Beast Tamer (0.28.0): wins a weakened monster over to the caster's side (see core/Taming.ts). */
  tame?: boolean;
  /** Beast Tamer (0.28.0): extra chance to hit, and a power multiplier, when the target is a monster. */
  beasts?: { hit?: number; power?: number };
}

export interface Job {
  id: string;
  name: string;
  description: string;
  role: 'Vanguard' | 'Marksman' | 'Mage' | 'Healer' | 'Skirmisher' | 'Lancer' | 'Chronomancer' | 'Terramancer'
    | 'Brawler' | 'Rogue' | 'Summoner' | 'Hexer' | 'Templar' | 'Battlemage' | 'Alchemist' | 'Troubadour' | 'Performer'
    // Monsters (0.26.0)
    | 'Beast' | 'Ooze' | 'Spirit' | 'Brute' | 'Tamer';
  spriteClass: string;
  baseMove: number;
  baseJump: number;
  statMultipliers: {
    hp: number;
    mp: number;
    attack: number;
    magic: number;
    speed: number;
  };
  abilities: Ability[];
  prerequisites?: { jobId: string; level: number }[];
  /** A monster (0.26.0): an enemy only, never a player's job; see data/monsters.ts. */
  monster?: boolean;
  /** What a monster has instead of gear traits: statuses it starts each battle with, ailments it can't get. */
  innate?: { startStatus?: StatusEffectType[]; immune?: StatusEffectType[]; stats?: Item['stats'] };
}

export interface EquippedAbilities {
  primaryJobId: string;
  secondaryJobId: string | null;
  reaction: string | null;
  support: string | null;
  movement: string | null;
}

export interface EquippedGear {
  weapon: Item | null;
  shield: Item | null;
  head: Item | null;
  body: Item | null;
  accessory: Item | null;
}

export interface Unit {
  id: string;
  name: string;
  team: Team;
  level: number;
  exp: number;
  jobId: string;
  /** Legacy field from early saves; job levels now come from `jobJpEarned` (see JobSystem.jobLevel). */
  jobLevels: Record<string, number>;
  /** Spendable JP per job. */
  jobPoints: Record<string, number>;
  /** Lifetime JP earned per job (never spent): decides the job's level and what it unlocks. */
  jobJpEarned?: Record<string, number>;
  unlockedAbilities: Record<string, boolean>;
  equippedAbilities: EquippedAbilities;
  equipment: EquippedGear;
  
  baseStats: {
    hp: number;
    mp: number;
    attack: number;
    magic: number;
    speed: number;
  };
  
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  speed: number;
  ct: number;
  move: number;
  jump: number;
  evasion: number;
  
  statuses: ActiveStatus[];
  
  x: number;
  z: number;
  facing: FacingDirection;
  
  isDead: boolean;
  hasMoved: boolean;
  hasActed: boolean;

  /** Boss units get a nameplate, extra HP and an enrage phase below 50% HP. */
  isBoss?: boolean;
  isEnraged?: boolean;
  /** Dragonheart can save a unit only once per battle. */
  usedDragonheart?: boolean;
  /** The performance (ability id) the unit is holding, while it has the Encore status (0.22.0). */
  performing?: string;
  /** Master signatures already used this battle (0.23.0). */
  usedSignatures?: string[];
  /** A grand summon on its way, with the tile it was aimed at, while the unit has Calling (0.24.0). */
  calling?: { abilityId: string; x: number; z: number };
  /** Iron Will can fire only once per battle. */
  usedIronWill?: boolean;
  /** A monster a Beast Tamer won over this battle (0.28.0): it fights for the squad and may join it. */
  tamed?: boolean;
}

export interface CombatForecast {
  attacker: Unit;
  target: Unit;
  ability: Ability;
  hitChance: number;
  expectedDamage: number;
  facingType: 'front' | 'flank' | 'back';
  heightAdvantage: number;
  willDualWield?: boolean;
  /** Terrain under the target, used by terrain-aware reactions such as Earthen Ward. */
  targetTerrain?: TerrainType;
}

export interface DialogueLine {
  speaker: string;
  /** Emoji fallback shown when no drawn portrait matches. */
  portraitClass: string;
  /** Drawn portrait id (a named character like 'rowan', or a job id like 'knight'). */
  portrait?: string;
  side: 'left' | 'right';
  text: string;
}

export interface StoryChoice {
  text: string;
  nextChapterId: string;
  rewardText: string;
  /** Items added to the squad's armory as soon as this path is chosen. */
  rewardItemIds?: string[];
}

export interface CampaignChapter {
  id: string;
  title: string;
  subtitle: string;
  mapId: string;
  introDialogue: DialogueLine[];
  victoryDialogue: DialogueLine[];
  choices?: StoryChoice[];
  enemyRoster: EnemySpawn[];
  /** Items added to the squad's armory when the chapter is won. */
  rewardItemIds?: string[];
  /** A new ally who joins the squad at the start of this chapter (if not already recruited). */
  recruit?: { id: string; name: string; jobId: string; level: number };
  /** Custom battlefield (Workshop scenarios); when set it is used instead of mapId. */
  mapData?: import('../data/maps').MapData;
  /** How the battle is won. Defaults to routing every enemy. */
  objective?: BattleObjective;
}

/** rout: defeat every enemy · boss: defeat the boss · survive: keep one ally standing for N rounds */
export interface BattleObjective {
  type: 'rout' | 'boss' | 'survive';
  rounds?: number;
}

export interface EnemySpawn {
  name: string;
  jobId: string;
  level: number;
  x: number;
  z: number;
  isBoss?: boolean;
  facing?: FacingDirection;
}
