import { Ability, FacingDirection, Unit } from './types';
import { BattleGrid } from './Grid';
import { CombatEngine, HARMFUL_STATUSES, guardsAgainst } from './CombatEngine';
import { JobSystem } from './JobSystem';
import { resolveTerrainAbility } from './Geomancy';
import { performedBy } from './Performance';

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

/**
 * Walking distance from every tile to (from.x, from.z), by the unit's own rules: walkable tiles,
 * steps no higher than its Jump, water and swamp costing 2 (unless it water-walks). Units are
 * ignored: they move. Used to approach foes across terraces and around cliffs, where straight-line
 * distance points at a wall (0.20.0).
 */
export function walkingDistances(grid: BattleGrid, from: { x: number; z: number }, unit: Unit): Map<string, number> {
  const k = (x: number, z: number) => `${x},${z}`;
  const dist = new Map<string, number>([[k(from.x, from.z), 0]]);
  const waterWalk = unit.equippedAbilities.movement === 'ni_water_walk';
  const jump = Math.max(1, unit.jump);
  const open: { x: number; z: number; d: number }[] = [{ x: from.x, z: from.z, d: 0 }];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].d < open[bi].d) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.d > (dist.get(k(cur.x, cur.z)) ?? Infinity)) continue;
    const here = grid.getTile(cur.x, cur.z);
    if (!here) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const t = grid.getTile(cur.x + dx, cur.z + dz);
      if (!t || !t.walkable || Math.abs(t.height - here.height) > jump) continue;
      // Cost of stepping off `t` toward the foe (the search runs backwards from the foe)
      const cost = !waterWalk && (t.terrain === 'water' || t.terrain === 'swamp') ? 2 : 1;
      const nd = cur.d + cost;
      if (nd < (dist.get(k(t.x, t.z)) ?? Infinity)) {
        dist.set(k(t.x, t.z), nd);
        open.push({ x: t.x, z: t.z, d: nd });
      }
    }
  }
  return dist;
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
    if (u.isDead !== !!ability.revive) return false;
    // The fallen can only be raised where nobody is standing, and never a boss
    if (ability.revive && (u.isBoss || units.some((o) => !o.isDead && o.x === u.x && o.z === u.z))) return false;
    const dist = Math.abs(u.x - cx) + Math.abs(u.z - cz);
    if (dist > ability.aoe) return false;
    return supportive ? u.team === caster.team : u.team !== caster.team;
  });
}

const SUPPORT_BUFFS = ['haste', 'protect', 'shell', 'regen'];

/**
 * A healer or buffer: a unit with a heal, a raise or a buff for others it can still pay for. The AI
 * values hurting these more, the way a player learns to drop the medic first (0.20.0).
 */
export function isSupportCaster(u: Unit): boolean {
  if (u.statuses.some((s) => s.type === 'silence')) return false;
  return JobSystem.getCombatActionAbilities(u).some((a) => !a.item && !a.isSelfOnly && a.mpCost <= u.currentMp
    && (a.power < 0 || !!a.revive || (!!a.appliesStatus && SUPPORT_BUFFS.includes(a.appliesStatus))));
}

/**
 * Scores what an ability would achieve against each unit it touches.
 * Positive = good for the caster. Uses forecasts (expected values), never rolls dice.
 */
function foesNear(u: Unit, units: Unit[], dist: number): boolean {
  return units.some((f) => !f.isDead && f.team !== u.team && Math.abs(f.x - u.x) + Math.abs(f.z - u.z) <= dist);
}

function scoreAbility(caster: Unit, ability: Ability, victims: Unit[], grid: BattleGrid, aim: { x: number; z: number }, victimsPool: Unit[] = victims): number {
  const casterH = grid.getHeight(caster.x, caster.z);
  let score = 0;
  for (const v of victims) {
    const vH = grid.getHeight(v.x, v.z);
    // A performance has no centre target: everyone in it takes the full effect
    const isSplash = ability.aoe > 0 && !ability.performance && (v.x !== aim.x || v.z !== aim.z);
    const fc = CombatEngine.getForecast(caster, v, ability, casterH, vH, grid.getTile(v.x, v.z)?.terrain, isSplash);
    let p = fc.hitChance / 100;
    // A knight with Weapon Guard parries 30% of frontal physical blows: hit them from the side
    if (v.equippedAbilities.reaction === 'kn_parry' && ability.element === 'physical' && ability.power > 0 && fc.facingType === 'front' && v.id !== caster.id) p *= 0.7;

    // Raising a fallen ally is worth about as much as a kill: it puts a whole unit back on the board
    if (ability.revive) {
      score += 110 + v.level * 2;
      continue;
    }

    // Cleansing is worth ~25 a removed ailment (sleep and silence more)
    if (ability.cleanse) {
      for (const st of v.statuses) {
        if (HARMFUL_STATUSES.includes(st.type)) score += st.type === 'sleep' || st.type === 'silence' ? 40 : 25;
      }
    }

    if (ability.power < 0) {
      const missing = v.maxHp - v.currentHp;
      if (missing < v.maxHp * 0.25) continue; // not worth a heal
      score += (Math.min(missing, Math.abs(fc.expectedDamage)) / v.maxHp) * 100 * 1.3 + (v.isBoss ? 20 : 0);
      continue;
    }

    // Pure status: only useful if the unit doesn't already have it and its gear doesn't ward it off
    if (ability.appliesStatus && fc.expectedDamage === 0) {
      const st = ability.appliesStatus;
      if (v.statuses.some((s) => s.type === st)) continue;
      if (HARMFUL_STATUSES.includes(st) && guardsAgainst(v, st)) continue;
      if (st === 'regen' && v.currentHp > v.maxHp * 0.8) continue;
      // Guard buffs only matter when a foe is close enough to strike soon
      if ((st === 'protect' || st === 'shell' || st === 'focus') && !foesNear(v, victimsPool, 5)) continue;
      if (st === 'silence' && !JobSystem.getCombatActionAbilities(v).some((a) => a.mpCost > 0)) continue;
      // Shell and Rally's Focus help less than a blow; ailments and Haste/Slow more
      const weight = st === 'sleep' ? 55 : st === 'haste' || st === 'slow' ? 45
        : st === 'shell' ? 15 : st === 'regen' ? 25 : st === 'focus' && ability.aoe > 0 ? 18 : 35;
      // An area buff is worth less per ally than a buff aimed where it's needed
      score += weight * p * (ability.aoe > 0 ? 0.6 : 1);
      continue;
    }
    if (ability.cleanse || ability.steal) continue;

    // Damage is valued as the share of the target's HP removed, so chip damage on a
    // healthy unit never outranks finishing off a wounded one.
    let dmg = fc.expectedDamage * (fc.willDualWield ? 1.9 : 1);
    dmg = Math.min(dmg, v.currentHp);
    const support = isSupportCaster(v);
    score += (dmg / v.maxHp) * 100 * p * (support ? 1.3 : 1);
    if (fc.expectedDamage >= v.currentHp) score += (120 + (v.isBoss ? 40 : 0) + (support ? 30 : 0)) * p; // likely kill
    if (ability.appliesStatus && !v.statuses.some((s) => s.type === ability.appliesStatus) && !guardsAgainst(v, ability.appliesStatus)) score += 15 * p;
    if (ability.drain) score += (Math.min(fc.expectedDamage * ability.drain, caster.maxHp - caster.currentHp) / caster.maxHp) * 60 * p;
    // Hitting a sleeper wakes it: only worth it for real damage
    if (v.statuses.some((s) => s.type === 'sleep')) score -= 10;
    // Avoid poking units with a nasty counter reaction
    if (v.equippedAbilities.reaction === 'sq_counter' && ability.element === 'physical') score -= 8;
  }
  return score;
}

/**
 * Plans an enemy turn: tries every reachable tile x every affordable ability x every valid
 * target, and picks the highest-value combination. Falls back to advancing on the closest foe.
 */
/** How many fallen allies the enemy side may raise in one battle. Keeps a healer from undoing a whole fight. */
export const ENEMY_RAISE_CAP = 1;

export function planTurn(unit: Unit, units: Unit[], grid: BattleGrid, opts: { noRevive?: boolean } = {}): AiPlan {
  const foes = foesOf(unit, units);
  const origin = { x: unit.x, z: unit.z };
  const fallbackFacing = unit.facing;

  if (foes.length === 0) {
    return { moveTo: origin, ability: null, targetTile: null, facing: fallbackFacing, score: 0 };
  }

  const tiles: { x: number; z: number }[] = unit.hasMoved ? [origin] : [origin, ...grid.getReachableTiles(unit, units)];
  const baseAbilities = JobSystem.getCombatActionAbilities(unit).filter((a) => a.mpCost <= unit.currentMp && !(opts.noRevive && a.revive));

  // Walking distance from each foe, by this unit's own movement rules: shared by the self-buff
  // approach below and the fallback walk
  const key = (x: number, z: number) => `${x},${z}`;
  const manhattan = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  const fields = foes.map((f) => ({ f, d: walkingDistances(grid, f, unit) }));
  const walkToFoes = (t: { x: number; z: number }) =>
    Math.min(...fields.map((e) => e.d.get(key(t.x, t.z)) ?? manhattan(e.f, t) + 20));

  // A performer whose song or dance is still playing loses it by moving or doing anything else
  // (0.22.0): weigh that, so it isn't thrown away for a small gain
  const holding = !!unit.performing && unit.statuses.some((st) => st.type === 'encore');

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
      if (holding && (tile.x !== origin.x || tile.z !== origin.z)) posScore -= 12;

      for (const raw of baseAbilities) {
        const ability = performedBy(unit, resolveTerrainAbility(raw, terrain));
        const supportive = CombatEngine.isSupportive(ability);

        // Candidate aim points: every unit on the relevant side within reach
        // A performance is centred on the performer, wherever it stands
        const aimUnits = ability.isSelfOnly || ability.performance ? [unit]
          : ability.revive ? units.filter((u) => u.isDead && u.team === unit.team) // a revive aims at the fallen
          : supportive ? alliesOf(unit, units) : foes;
        for (const aim of aimUnits) {
          const ax = aim.id === unit.id ? tile.x : aim.x;
          const az = aim.id === unit.id ? tile.z : aim.z;
          if (!ability.isSelfOnly && !ability.performance && !grid.canTarget(tile.x, tile.z, ax, az, ability.range, ability.heightTolerance, supportive)) continue;

          const victims = ability.isSelfOnly ? [unit] : unitsInBlast(unit, ability, ax, az, units);
          if (victims.length === 0) continue;

          let score = scoreAbility(unit, ability, victims, grid, { x: ax, z: az }, units);
          if (score <= 0) continue;
          // A performance plays again on the next turns if the performer stays put
          if (ability.performance) score *= 1.4;
          if (holding && ability.id !== unit.performing) score -= 12;
          score += posScore;
          // A self-buff (Bulwark, Focus) can be cast anywhere, so cast it on the way in rather
          // than standing still (0.20.0)
          if (ability.isSelfOnly) score -= walkToFoes(tile) * 0.6;
          score -= ability.mpCost * 0.15; // spend MP when it matters

          if (!best || score > best.score) {
            const nearestFoe = foes.reduce((a, b) =>
              Math.abs(a.x - tile.x) + Math.abs(a.z - tile.z) <= Math.abs(b.x - tile.x) + Math.abs(b.z - tile.z) ? a : b
            );
            // End the turn facing the closest foe (the one most likely to strike next), so the
            // back isn't left open to it; a melee target is that foe anyway
            const facing = faceTowards(tile.x, tile.z, nearestFoe.x, nearestFoe.z);
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
  // Nothing worth doing: a performer keeps playing rather than wandering off
  if (holding) return { moveTo: origin, ability: null, targetTile: null, facing: fallbackFacing, score: 0 };

  // No action possible this turn: walk toward the weakest foe it can actually reach, by real
  // walking distance (climbing only where Jump allows), and prefer high ground on the way
  const reachableFoes = fields.filter((e) => e.d.has(key(unit.x, unit.z)));
  const pick = (reachableFoes.length ? reachableFoes : fields).reduce((a, b) => {
    const da = (a.d.get(key(unit.x, unit.z)) ?? manhattan(a.f, unit)) + a.f.currentHp / 100;
    const db = (b.d.get(key(unit.x, unit.z)) ?? manhattan(b.f, unit)) + b.f.currentHp / 100;
    return da <= db ? a : b;
  });
  const target = pick.f;
  const distFrom = (t: { x: number; z: number }) => pick.d.get(key(t.x, t.z)) ?? manhattan(target, t) + 100;
  let moveTo = origin;
  let bestDist = distFrom(origin);
  for (const t of tiles) {
    const d = distFrom(t) - grid.getHeight(t.x, t.z) * 0.05;
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
