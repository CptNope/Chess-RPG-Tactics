export type TerrainType = 'grass' | 'stone' | 'dirt' | 'water' | 'wood';

export type FacingDirection = 'N' | 'E' | 'S' | 'W';

export type Team = 'player' | 'enemy';

export type AbilityType = 'action' | 'reaction' | 'support' | 'movement';

export type Element = 'physical' | 'fire' | 'ice' | 'lightning' | 'holy' | 'dark';

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
  castTime?: number; // CT required if cast time
}

export interface Job {
  id: string;
  name: string;
  description: string;
  role: 'Vanguard' | 'Marksman' | 'Mage' | 'Healer' | 'Skirmisher';
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
  
  // Base stats (unmodified by job)
  baseStats: {
    hp: number;
    mp: number;
    attack: number;
    magic: number;
    speed: number;
  };
  
  // Current combat state
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  speed: number;
  ct: number;
  move: number;
  jump: number;
  
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
}
