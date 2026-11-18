export type TerrainType = 'grass' | 'stone' | 'dirt' | 'water' | 'wood' | 'swamp' | 'parapet';

export type FacingDirection = 'N' | 'E' | 'S' | 'W';

export type Team = 'player' | 'enemy';

export type AbilityType = 'action' | 'reaction' | 'support' | 'movement';

export type Element = 'physical' | 'fire' | 'ice' | 'lightning' | 'holy' | 'dark' | 'time';

export type StatusEffectType = 'haste' | 'slow' | 'protect' | 'immobilize' | 'poison';

export interface ActiveStatus {
  type: StatusEffectType;
  duration: number;
}

export type EquipmentSlot = 'weapon' | 'shield' | 'head' | 'body' | 'accessory';

export type WeaponType = 'sword' | 'spear' | 'bow' | 'staff' | 'dagger';

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
}

export interface Job {
  id: string;
  name: string;
  description: string;
  role: 'Vanguard' | 'Marksman' | 'Mage' | 'Healer' | 'Skirmisher' | 'Lancer' | 'Chronomancer';
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
  jobLevels: Record<string, number>;
  jobPoints: Record<string, number>;
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
}

export interface DialogueLine {
  speaker: string;
  portraitClass: string;
  side: 'left' | 'right';
  text: string;
}

export interface StoryChoice {
  text: string;
  nextChapterId: string;
  rewardText: string;
}

export interface CampaignChapter {
  id: string;
  title: string;
  subtitle: string;
  mapId: string;
  introDialogue: DialogueLine[];
  victoryDialogue: DialogueLine[];
  choices?: StoryChoice[];
  enemyRoster: {
    name: string;
    jobId: string;
    level: number;
    x: number;
    z: number;
  }[];
}
