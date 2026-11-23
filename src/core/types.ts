export type TerrainType = 'grass' | 'stone' | 'dirt' | 'water' | 'wood' | 'swamp' | 'parapet';

export type FacingDirection = 'N' | 'E' | 'S' | 'W';

export type Team = 'player' | 'enemy';

export type AbilityType = 'action' | 'reaction' | 'support' | 'movement';

export type Element = 'physical' | 'fire' | 'ice' | 'lightning' | 'holy' | 'dark' | 'time';

export type StatusEffectType =
  | 'haste' | 'slow' | 'protect' | 'immobilize' | 'poison' | 'focus'
  // Added in 0.13.0
  | 'shell' | 'regen' | 'blind' | 'silence' | 'sleep' | 'breach';

export interface ActiveStatus {
  type: StatusEffectType;
  duration: number;
}

export type EquipmentSlot = 'weapon' | 'shield' | 'head' | 'body' | 'accessory';

export type WeaponType = 'sword' | 'spear' | 'bow' | 'staff' | 'dagger' | 'knuckles';

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
}

export interface Job {
  id: string;
  name: string;
  description: string;
  role: 'Vanguard' | 'Marksman' | 'Mage' | 'Healer' | 'Skirmisher' | 'Lancer' | 'Chronomancer' | 'Terramancer'
    | 'Brawler' | 'Rogue' | 'Summoner' | 'Hexer' | 'Templar' | 'Battlemage';
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
  /** Iron Will can fire only once per battle. */
  usedIronWill?: boolean;
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
