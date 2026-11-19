import { Ability, FacingDirection, Unit } from './types';
import { BattleGrid } from './Grid';
import { CombatEngine } from './CombatEngine';
import { JobSystem } from './JobSystem';
import { resolveTerrainAbility } from './Geomancy';

export interface AiPlan {
  /** Tile to move to before acting (may equal the current tile). */
  moveTo: { x: number; z: number };
  /** Ability to use after moving, already resolved for terrain (Geomancer). */
  ability: Ability | null;
  /** Tile the ability is aimed at (the primary target's tile). */
  targetTile: { x: number; z: number } | null;
  /** Facing to end the turn with. */
  facing: FacingDirection;
  score: number;
}

/** Units on the opposing side of `unit`. */
function foesOf(unit: Unit, units: Unit[]): Unit[] {
  return units.filter((u) => !u.isDead && u.team !== unit.team);
}

function alliesOf(unit: Unit, units: Unit[]): Unit[] {
  return units.filter((u) => !u.isDead && u.team === unit.team);
}

/** Direction from (x, z) that faces (tx, tz). */
export function faceTowards(x: number, z: number, tx: number, tz: number): FacingDirection {
  const dx = tx - x;
  const dz = tz - z;
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 'E' : 'W';
  return dz > 0 ? 'S' : 'N';
}

/**
 * Units caught by an ability aimed at (cx, cz). Damage and debuffs only hit the caster's foes;
 * heals and buffs only touch the caster's allies. AoE 0 means the single unit on the tile.
 */
export function unitsInBlast(caster: Unit, ability: Ability, cx: number, cz: number, units: Unit[]): Unit[] {
  const supportive = CombatEngine.isSupportive(ability);
  return units.filter((u) => {
    if (u.isDead) return false;
    const dist = Math.abs(u.x - cx) + Math.abs(u.z - cz);
    if (dist > ability.aoe) return false;
    return supportive ? u.team === caster.team : u.team !== caster.team;
  });
}

/**
 * Scores what an ability would achieve against each unit it touches.
 * Positive = good for the caster. Uses forecasts (expected values), never rolls dice.
 */
function scoreAbility(caster: Unit, ability: Ability, victims: Unit[], grid: BattleGrid, aim: { x: number; z: number }): number {
  const casterH = grid.getHeight(caster.x, caster.z);
  let score = 0;
  for (const v of victims) {
    const vH = grid.getHeight(v.x, v.z);
    const isSplash = ability.aoe > 0 && (v.x !== aim.x || v.z !== aim.z);
    const fc = CombatEngine.getForecast(caster, v, ability, casterH, vH, grid.getTile(v.x, v.z)?.terrain, isSplash);
    const p = fc.hitChance / 100;

    if (ability.power < 0) {
      const missing = v.maxHp - v.currentHp;
      if (missing < v.maxHp * 0.25) continue; // not worth a heal
      score += (Math.min(missing, Math.abs(fc.expectedDamage)) / v.maxHp) * 100 * 1.3 + (v.isBoss ? 20 : 0);
      continue;
    }

    if (ability.appliesStatus && fc.expectedDamage === 0) {
      // Pure status: only useful if the unit does not already have it
      if (v.statuses.some((s) => s.type === ability.appliesStatus)) continue;
      const weight = ability.appliesStatus === 'haste' || ability.appliesStatus === 'slow' ? 45 : 35;
      score += weight * p;
      continue;
    }

    // Damage is valued as the share of the target's HP removed, so chip damage on a
    // healthy unit never outranks finishing off a wounded one.
    let dmg = fc.expectedDamage * (fc.willDualWield ? 1.9 : 1);
    dmg = Math.min(dmg, v.currentHp);
    score += (dmg / v.maxHp) * 100 * p;
    if (fc.expectedDamage >= v.currentHp) score += (120 + (v.isBoss ? 40 : 0)) * p; // likely kill
    if (ability.appliesStatus && !v.statuses.some((s) => s.type === ability.appliesStatus)) score += 15 * p;
    // Avoid poking units with a nasty counter reaction
    if (v.equippedAbilities.reaction === 'sq_counter' && ability.element === 'physical') score -= 8;
  }
  return score;
}

/**
 * Plans an enemy turn: tries every reachable tile x every affordable ability x every valid
 * target, and picks the highest-value combination. Falls back to advancing on the closest foe.
 */
export function planTurn(unit: Unit, units: Unit[], grid: BattleGrid): AiPlan {
  const foes = foesOf(unit, units);
  const origin = { x: unit.x, z: unit.z };
  const fallbackFacing = unit.facing;

  if (foes.length === 0) {
    return { moveTo: origin, ability: null, targetTile: null, facing: fallbackFacing, score: 0 };
  }

  const tiles: { x: number; z: number }[] = unit.hasMoved ? [origin] : [origin, ...grid.getReachableTiles(unit, units)];
  const baseAbilities = JobSystem.getCombatActionAbilities(unit).filter((a) => a.mpCost <= unit.currentMp);

  let best: AiPlan | null = null;
  const savedX = unit.x;
  const savedZ = unit.z;

  try {
    for (const tile of tiles) {
      unit.x = tile.x;
      unit.z = tile.z;
      const terrain = grid.getTile(tile.x, tile.z)?.terrain;

      // Small positional preferences: high ground, and not ending adjacent to several foes
      const tileH = grid.getHeight(tile.x, tile.z);
      let posScore = tileH * 0.5;
      const adjacentFoes = foes.filter((f) => Math.abs(f.x - tile.x) + Math.abs(f.z - tile.z) === 1).length;
      if (adjacentFoes >= 2) posScore -= 6;

      for (const raw of baseAbilities) {
        const ability = resolveTerrainAbility(raw, terrain);
        const supportive = CombatEngine.isSupportive(ability);

        // Candidate aim points: every unit on the relevant side within reach
        const aimUnits = ability.isSelfOnly ? [unit] : supportive ? alliesOf(unit, units) : foes;
        for (const aim of aimUnits) {
          const ax = aim.id === unit.id ? tile.x : aim.x;
          const az = aim.id === unit.id ? tile.z : aim.z;
          if (!ability.isSelfOnly && !grid.canTarget(tile.x, tile.z, ax, az, ability.range, ability.heightTolerance, supportive)) continue;

          const victims = ability.isSelfOnly ? [unit] : unitsInBlast(unit, ability, ax, az, units);
          if (victims.length === 0) continue;

          let score = scoreAbility(unit, ability, victims, grid, { x: ax, z: az });
          if (score <= 0) continue;
          score += posScore;
          score -= ability.mpCost * 0.15; // spend MP when it matters

          if (!best || score > best.score) {
            const nearestFoe = foes.reduce((a, b) =>
              Math.abs(a.x - tile.x) + Math.abs(a.z - tile.z) <= Math.abs(b.x - tile.x) + Math.abs(b.z - tile.z) ? a : b
            );
            const facing = supportive || ability.isSelfOnly
              ? faceTowards(tile.x, tile.z, nearestFoe.x, nearestFoe.z)
              : faceTowards(tile.x, tile.z, ax, az);
            best = { moveTo: { ...tile }, ability, targetTile: { x: ax, z: az }, facing, score };
          }
        }
      }
    }
  } finally {
    unit.x = savedX;
    unit.z = savedZ;
  }

  if (best) return best;

  // No action possible this turn: close distance to the weakest reachable foe, prefer high ground
  const target = foes.reduce((a, b) => {
    const da = Math.abs(a.x - unit.x) + Math.abs(a.z - unit.z) + a.currentHp / 100;
    const db = Math.abs(b.x - unit.x) + Math.abs(b.z - unit.z) + b.currentHp / 100;
    return da <= db ? a : b;
  });
  let moveTo = origin;
  let bestDist = Math.abs(target.x - unit.x) + Math.abs(target.z - unit.z);
  for (const t of tiles) {
    const d = Math.abs(target.x - t.x) + Math.abs(target.z - t.z) - grid.getHeight(t.x, t.z) * 0.05;
    if (d < bestDist) {
      bestDist = d;
      moveTo = t;
    }
  }
  return {
    moveTo: { x: moveTo.x, z: moveTo.z },
    ability: null,
    targetTile: null,
    facing: faceTowards(moveTo.x, moveTo.z, target.x, target.z),
    score: 0
  };
}
