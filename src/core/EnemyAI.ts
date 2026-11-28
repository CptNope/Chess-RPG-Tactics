import { pulseFor, standingTotems, Totem, TOTEM_TURNS } from './Totems';
import { groundFrom, hazardFor } from './Hazards';
import { bodies, canRaise, worksOnBodies } from './Necromancy';
import { setTraps, trapAt, trapEffect, trapLimit, TRAP_STATUS } from './Traps';
import { canBuildAt, canShape } from './Earthworks';
import { Ability, FacingDirection, Unit } from './types';
import { isAlly, isFoe } from './Sides';
import { BattleGrid } from './Grid';
import { CombatEngine, HARMFUL_STATUSES, guardsAgainst } from './CombatEngine';
import { JobSystem } from './JobSystem';
import { resolveTerrainAbility } from './Geomancy';
import { isCentered, noFalloff, performedBy } from './Performance';
import { callsLandingOn, rebirthOf } from './Summons';
import { CONSUMABLES, consumableAbility } from '../data/consumables';

/** What a planner may use beyond the unit's own abilities (0.31.0). */
export interface PlanOptions {
  /** No raising the fallen this turn (the side has used its raises). */
  noRevive?: boolean;
  /**
   * Think one turn ahead (0.31.0): weigh what the foes could do to this unit where it ends its
   * turn. 'light' (once the unit is below half HP) only steers clear of spots where it would
   * likely fall, unless the trade is worth it; 'full' always does, also prefers spots where it
   * takes less, and hurt units hang back.
   */
  caution?: false | 'light' | 'full';
  /** Items the unit carries (0.31.0): consumable id -> count. */
  pouch?: Record<string, number>;
  /**
   * Never walk into a spot where it would likely fall, even when healthy (0.45.0). For AUTO on
   * the squad: before this, a fresh unit with nothing in reach would walk alone into the middle
   * of the enemy for a few tiles of progress. Enemies keep pressing forward.
   */
  holdBack?: boolean;
  /**
   * The ground a "hold" objective is about (0.48.0), as "x,z" keys. Both sides want to stand on
   * it: the squad to hold it, the enemy to contest it.
   */
  zone?: ReadonlySet<string>;
  /**
   * The side defending a hold zone (0.53.0) fights as it would anyway: it doesn't rush the zone or
   * cling to it, and the squad has to clear whoever stands there. Both sides wanting it pulled
   * every defender into Chapter II-B's gate (51% → 20% in the sim; 19% when only those already on
   * it stayed); this way the hold is a second road to victory, and Cinder Spring didn't move.
   */
  guardZone?: boolean;
}

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
  return units.filter((u) => !u.isDead && isFoe(u, unit));
}

function alliesOf(unit: Unit, units: Unit[]): Unit[] {
  return units.filter((u) => !u.isDead && isAlly(u, unit));
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
      const cost = t.terrain === 'snow' || (!waterWalk && (t.terrain === 'water' || t.terrain === 'swamp')) ? 2 : 1;
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
    return supportive ? isAlly(u, caster) : isFoe(u, caster);
  });
}

/**
 * Everyone an ability aimed at (cx, cz) touches, each with the ability as it applies to them: a
 * summon that also raises the fallen (Cinderwing, 0.24.0) heals the living and raises the fallen.
 */
export function summonVictims(caster: Unit, ability: Ability, cx: number, cz: number, units: Unit[]): { unit: Unit; ability: Ability }[] {
  const out = unitsInBlast(caster, ability, cx, cz, units).map((unit) => ({ unit, ability }));
  const raise = rebirthOf(ability);
  if (raise) for (const unit of unitsInBlast(caster, raise, cx, cz, units)) out.push({ unit, ability: raise });
  return out;
}

const SUPPORT_BUFFS = ['haste', 'protect', 'shell', 'regen'];

/**
 * A healer or buffer: a unit with a heal, a raise or a buff for others it can still pay for. The AI
 * values hurting these more, the way a player learns to drop the medic first (0.20.0).
 */
export function isSupportCaster(u: Unit): boolean {
  if (u.statuses.some((s) => s.type === 'silence')) return false;
  return JobSystem.getCombatActionAbilities(u).some((a) => !a.item && !a.isSelfOnly && JobSystem.canAfford(u, a)
    && (a.power < 0 || !!a.revive || (!!a.appliesStatus && SUPPORT_BUFFS.includes(a.appliesStatus))));
}

/**
 * Scores what an ability would achieve against each unit it touches.
 * Positive = good for the caster. Uses forecasts (expected values), never rolls dice.
 */
function foesNear(u: Unit, units: Unit[], dist: number): boolean {
  return units.some((f) => !f.isDead && isFoe(f, u) && Math.abs(f.x - u.x) + Math.abs(f.z - u.z) <= dist);
}

/**
 * The threat map (0.31.0): for each tile, how much damage the foes could do to `unit` there on
 * their next turns, each with its best blow from anywhere it can walk to. An estimate: heights,
 * facing and the dice are ignored. Foes that are asleep can't strike; `spared` leaves out foes
 * this turn's action is likely to kill.
 */
export function threatMap(unit: Unit, units: Unit[], grid: BattleGrid): (x: number, z: number, spared?: Set<string>) => number {
  const key = (x: number, z: number) => `${x},${z}`;
  const entries: { id: string; dmg: number; reach: Set<string> }[] = [];
  const uh = grid.getHeight(unit.x, unit.z);
  for (const foe of foesOf(unit, units)) {
    if (foe.statuses.some((s) => s.type === 'sleep')) continue;
    const silenced = foe.statuses.some((s) => s.type === 'silence');
    let best: { dmg: number; reach: number } | null = null;
    for (const a of JobSystem.getCombatActionAbilities(foe)) {
      if (a.item || a.isSelfOnly || a.charge || !JobSystem.canAfford(foe, a) || (silenced && a.mpCost > 0)) continue;
      if (CombatEngine.isSupportive(a) || !(a.power > 0 || a.fixedDamage)) continue;
      const fc = CombatEngine.getForecast(foe, unit, a, uh, uh, undefined, false, grid.mapData.weather);
      const dmg = Math.max(0, fc.expectedDamage) * (fc.willDualWield ? 1.9 : 1) * (fc.hitChance / 100);
      if (!best || dmg > best.dmg) best = { dmg, reach: a.range + a.aoe };
    }
    if (!best || best.dmg <= 0) continue;
    const from = foe.statuses.some((s) => s.type === 'immobilize') ? [{ x: foe.x, z: foe.z }]
      : [{ x: foe.x, z: foe.z }, ...grid.getReachableTiles(foe, units)];
    const reach = new Set<string>();
    for (const t of from) {
      for (let dx = -best.reach; dx <= best.reach; dx++) {
        const r = best.reach - Math.abs(dx);
        for (let dz = -r; dz <= r; dz++) reach.add(key(t.x + dx, t.z + dz));
      }
    }
    entries.push({ id: foe.id, dmg: best.dmg, reach });
  }
  return (x, z, spared) => {
    let total = 0;
    for (const e of entries) if (!spared?.has(e.id) && e.reach.has(key(x, z))) total += e.dmg;
    return total;
  };
}

/** The items a unit could use from its pouch this turn, as battle actions. */
function pouchAbilities(pouch: Record<string, number> | undefined, noRevive: boolean): Ability[] {
  if (!pouch) return [];
  return Object.entries(pouch)
    .filter(([id, n]) => n > 0 && CONSUMABLES[id] && !(noRevive && CONSUMABLES[id].revive))
    .map(([id]) => consumableAbility(CONSUMABLES[id]));
}

function scoreAbility(caster: Unit, ability: Ability, victims: Unit[], grid: BattleGrid, aim: { x: number; z: number }, victimsPool: Unit[] = victims, kills?: Set<string>): number {
  const casterH = grid.getHeight(caster.x, caster.z);
  let score = 0;
  for (const v of victims) {
    const vH = grid.getHeight(v.x, v.z);
    // A performance has no centre target: everyone in it takes the full effect
    const isSplash = ability.aoe > 0 && !noFalloff(ability) && (v.x !== aim.x || v.z !== aim.z);
    const fc = CombatEngine.getForecast(caster, v, ability, casterH, vH, grid.getTile(v.x, v.z)?.terrain, isSplash, grid.mapData.weather);
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

    if (ability.power < 0 || ability.fixedHeal) {
      if (isFoe(v, caster)) continue;
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
    if (ability.cleanse || ability.steal || ability.tame) continue;

    // Damage is valued as the share of the target's HP removed, so chip damage on a
    // healthy unit never outranks finishing off a wounded one.
    let dmg = fc.expectedDamage * (fc.willDualWield ? 1.9 : 1);
    dmg = Math.min(dmg, v.currentHp);
    const support = isSupportCaster(v);
    score += (dmg / v.maxHp) * 100 * p * (support ? 1.3 : 1);
    if (fc.expectedDamage >= v.currentHp) {
      score += (120 + (v.isBoss ? 40 : 0) + (support ? 30 : 0)) * p; // likely kill
      if (p >= 0.7 && isFoe(v, caster)) kills?.add(v.id);
    }
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

/**
 * How much more than the average threat a spot can turn out to deal, for the squad's AUTO
 * (`holdBack`, 0.45.0). The threat map
 * weighs each blow by its hit chance and leaves out crits and back attacks, so a unit waiting
 * where the average is 97% of its HP almost always falls.
 */
export const LETHAL_MARGIN = 1.3;

/**
 * What planting a totem at (ax, az) is worth (0.47.0): its first pulse on everyone in reach,
 * and a share again for the turns it keeps standing (units move, so less than in full). Less
 * when it replaces a totem of the same kind that still had turns left.
 */
export function scoreTotem(caster: Unit, ability: Ability, ax: number, az: number, units: Unit[]): number {
  const totem: Totem = { kind: ability.totem!, x: ax, z: az, radius: ability.aoe, turns: TOTEM_TURNS };
  let now = 0;
  for (const u of units) {
    const p = pulseFor(caster, totem, u);
    if (!p) continue;
    const near = foesNear(u, units, 4) ? 1.3 : 0.8;
    if (p.heal) now += Math.min(p.heal, u.maxHp - u.currentHp) / u.maxHp * 100 * 0.8;
    if (p.status === 'protect') now += 10 * near;
    if (p.status === 'slow') now += (u.isBoss ? 22 : 14);
    if (p.damage) now += Math.min(p.damage, u.currentHp) / u.maxHp * 100 + (p.damage >= u.currentHp ? 40 : 0);
  }
  if (now <= 0) return 0;
  const replaced = (caster.totems ?? []).find((t) => t.kind === totem.kind);
  return now * 1.6 - (replaced ? replaced.turns * 6 : 0);
}

/**
 * What hiding a trap at (x, z) is worth (0.49.0). A foe will likely walk over a tile it can reach
 * next turn that lies on its way to the Ranger's side, so each foe for whom the tile is "on the
 * way" counts, the best one fully and the rest a little; the whole is discounted because foes
 * take other roads. A trap that pulls up an older one costs a little.
 */
/**
 * What a Sapper's barricade or raised earth on (x, z) is worth (0.54.0).
 * - Barricade, beside an ally a foe could reach next turn: the extra steps it costs that foe to get
 *   to the ally (4 when it seals the ally off), more for a hurt or frail ally.
 * - Raise, under an ally who shoots or casts from 3 or more and has a foe in reach: high ground,
 *   unless the tile already looks down on its neighbours.
 * Never raises a foe's tile. `standAt` is where the Sapper will stand.
 */
export function scoreWorks(caster: Unit, ability: Ability, x: number, z: number, units: Unit[], grid: BattleGrid, standAt: { x: number; z: number }): number {
  const tile = grid.getTile(x, z);
  if (!tile) return 0;
  const at = (u: Unit) => (u === caster ? standAt : u);
  const here = units.find((u) => !u.isDead && at(u).x === x && at(u).z === z);
  if (ability.earthwork === 'raise') {
    if (!canShape(tile, 'raise') || !here || !isAlly(here, caster)) return 0;
    // Only a shooter already in the fight is likely to stay and use the height: anyone else walks off
    // it next turn (in the sim the Sapper spent most turns raising ground, and Chapter IV fell to 25%)
    const reach = Math.max(0, ...JobSystem.getCombatActionAbilities(here).filter((a) => a.power > 0).map((a) => a.range));
    if (reach < 3) return 0;
    const engaged = units.some((u) => !u.isDead && isFoe(u, caster) && Math.abs(u.x - x) + Math.abs(u.z - z) <= reach + 1);
    if (!engaged) return 0;
    const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => grid.getTile(x + dx, z + dz)?.height ?? 0);
    return tile.height >= Math.max(...around) + 1 ? 0 : 10;
  }
  if (ability.earthwork !== 'barricade') return 0;
  if ((x === standAt.x && z === standAt.z) || !canBuildAt(tile, units.filter((u) => u !== caster))) return 0;
  const allies = units.filter((u) => !u.isDead && isAlly(u, caster) && Math.abs(at(u).x - x) + Math.abs(at(u).z - z) === 1);
  if (!allies.length) return 0;
  const foes = units.filter((u) => !u.isDead && isFoe(u, caster) && !u.tamed);
  let score = 0;
  for (const ally of allies) {
    const a = at(ally);
    const frail = ally.currentHp < ally.maxHp / 2 || JobSystem.getCombatActionAbilities(ally).some((ab) => ab.scalesWith === 'magic' && ab.power > 0) ? 1.5 : 1;
    for (const f of foes) {
      if (Math.abs(f.x - a.x) + Math.abs(f.z - a.z) > f.move + 2) continue;
      const before = walkingDistances(grid, f, f).get(`${a.x},${a.z}`);
      if (before === undefined || before > f.move + 1) continue;
      tile.walkable = false;
      const after = walkingDistances(grid, f, f).get(`${a.x},${a.z}`);
      tile.walkable = true;
      score += Math.min(4, after === undefined ? 4 : after - before) * 5 * frail;
    }
  }
  return Math.min(24, score);
}

export function scoreTrap(caster: Unit, ability: Ability, x: number, z: number, units: Unit[], grid: BattleGrid): number {
  const free = (tx: number, tz: number) => !!grid.getTile(tx, tz)?.walkable && !units.some((u) => !u.isDead && u.x === tx && u.z === tz) && !trapAt(units, tx, tz);
  const tiles: { x: number; z: number }[] = [];
  for (let dz = -ability.aoe; dz <= ability.aoe; dz++) for (let dx = -ability.aoe; dx <= ability.aoe; dx++) {
    if (Math.abs(dx) + Math.abs(dz) <= ability.aoe && free(x + dx, z + dz)) tiles.push({ x: x + dx, z: z + dz });
  }
  if (!tiles.length) return 0;
  const steps = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  const mine = units.filter((u) => !u.isDead && !u.tamed && !isFoe(caster, u));
  const foes = units.filter((u) => !u.isDead && isFoe(caster, u));
  const atk = JobSystem.getAttackPower(caster);
  // A foe that fights from range has less reason to walk in than one that must close to hit
  const walksIn = new Map(foes.map((f) => {
    const reach = Math.max(1, ...JobSystem.getCombatActionAbilities(f).filter((a) => !a.isSelfOnly && a.power > 0).map((a) => a.range));
    return [f.id, reach <= 1 ? 1.15 : reach <= 3 ? 0.8 : 0.5] as const;
  }));
  let total = 0;
  for (const t of tiles) {
    const values: number[] = [];
    for (const f of foes) {
      if (f.statuses.some((s) => s.type === 'immobilize' || s.type === 'sleep')) continue;
      const goal = mine.reduce((a, b) => (steps(f, a) <= steps(f, b) ? a : b), caster);
      const d = steps(f, t);
      if (d < 1 || d > f.move + 1 || d + steps(t, goal) > steps(f, goal) + 1) continue;
      const e = trapEffect({ kind: ability.trap!, x: t.x, z: t.z }, f, atk);
      const status = TRAP_STATUS[ability.trap!];
      let v = 0;
      if (e.damage) v += (Math.min(e.damage, f.currentHp) / f.maxHp) * 100 + (e.damage >= f.currentHp ? 30 : 0);
      if (status === 'immobilize') v += 12;
      if (status === 'sleep') v += 18;
      if (status === 'blind') v += JobSystem.getAttackPower(f) >= JobSystem.getMagicPower(f) ? 12 : 4;
      if (status && guardsAgainst(f, status)) v = e.damage ? v : 0;
      values.push(v * (walksIn.get(f.id) ?? 1));
    }
    values.sort((a, b) => b - a);
    total += (values[0] ?? 0) + values.slice(1).reduce((s, v) => s + v * 0.25, 0);
  }
  const mineSet = setTraps(units).filter((t) => t.owner === caster).length;
  return total * 0.55 - (mineSet >= trapLimit(caster) && !ability.signature ? 6 : 0);
}

/**
 * What a spell's mark on the ground is worth (0.50.0): embers or miasma left under foes a little
 * (they may step off), under allies a cost; putting out embers under allies a little.
 */
export function groundWorth(caster: Unit, ability: Ability, cx: number, cz: number, units: Unit[], grid: BattleGrid): number {
  const effect = groundFrom(ability);
  if (!effect) return 0;
  let s = 0;
  for (const u of units) {
    if (u.isDead || Math.abs(u.x - cx) + Math.abs(u.z - cz) > ability.aoe) continue;
    if (isCentered(ability) && u === caster) continue; // spared
    const t = grid.getTile(u.x, u.z);
    if (!t?.walkable || t.hazard === 'spring') continue;
    const foe = isFoe(caster, u);
    if (effect === 'douse') { if (t.hazard === 'embers' && !foe) s += 6; continue; }
    if (effect === 'embers' && (t.terrain === 'water' || t.terrain === 'snow')) continue;
    s += foe ? 4 : -8;
  }
  return s;
}

export function planTurn(unit: Unit, units: Unit[], grid: BattleGrid, opts: PlanOptions = {}): AiPlan {
  const foes = foesOf(unit, units);
  const origin = { x: unit.x, z: unit.z };
  const fallbackFacing = unit.facing;

  if (foes.length === 0) {
    return { moveTo: origin, ability: null, targetTile: null, facing: fallbackFacing, score: 0 };
  }

  const tiles: { x: number; z: number }[] = unit.hasMoved ? [origin] : [origin, ...grid.getReachableTiles(unit, units)];
  const baseAbilities = [
    ...JobSystem.getCombatActionAbilities(unit).filter((a) => JobSystem.canAfford(unit, a) && !(opts.noRevive && (a.revive || a.rebirth))),
    ...pouchAbilities(opts.pouch, !!opts.noRevive)
  ];
  // One turn ahead (0.31.0): what the foes could do to this unit, tile by tile
  // 'light' caution only kicks in once the unit is hurt: a wounded enemy backs off or heals
  const threat = opts.caution === 'full' || (opts.caution === 'light' && unit.currentHp < unit.maxHp * 0.5) ? threatMap(unit, units, grid) : null;
  const precious = (isSupportCaster(unit) ? 15 : 0) + (unit.isBoss ? 15 : 0);
  /** What ending the turn on a tile risks: a lot where the unit would likely fall, a little per HP otherwise. */
  const risk = (x: number, z: number, hpAfter: number, spared?: Set<string>) => {
    if (!threat) return 0;
    const danger = threat(x, z, spared);
    // The threat is an average: crits, blows from behind and a lucky roll go past it, so for the
    // squad's AUTO a spot where the average comes near the unit's HP is already deadly (0.45.0).
    // Enemies keep the plain average: their caution is set by the difficulty
    if (danger * (opts.holdBack ? LETHAL_MARGIN : 1) >= hpAfter) return 30 + precious;
    return opts.caution === 'full' ? (danger / unit.maxHp) * 15 : 0;
  };

  // Walking distance from each foe, by this unit's own movement rules: shared by the self-buff
  // approach below and the fallback walk
  const key = (x: number, z: number) => `${x},${z}`;
  const manhattan = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  /**
   * What the ground at a tile is worth to end the turn on (0.48.0): stay off embers and miasma,
   * a hurt unit heads for a spring, and both sides want the zone a hold objective is about.
   */
  const groundScore = (x: number, z: number): number => {
    let s = 0;
    const tile = grid.getTile(x, z);
    const sx = unit.x, sz = unit.z;
    unit.x = x; unit.z = z;
    const p = hazardFor(unit, tile);
    unit.x = sx; unit.z = sz;
    if (p?.damage) s -= (Math.min(p.damage, unit.currentHp) / unit.maxHp) * 100 * 1.2 + (p.damage >= unit.currentHp ? 40 : 0);
    if (p?.status === 'poison') s -= 10;
    if (p?.heal) s += (p.heal / unit.maxHp) * 100 * 0.7;
    if (p?.cured) s += 8;
    if (opts.zone?.has(key(x, z)) && !opts.guardZone) s += 20;
    return s;
  };
  const zoneDist = (t: { x: number; z: number }): number => {
    if (!opts.zone?.size) return 0;
    let best = Infinity;
    for (const k of opts.zone) {
      const [zx, zz] = k.split(',').map(Number);
      best = Math.min(best, Math.abs(zx - t.x) + Math.abs(zz - t.z));
    }
    return best;
  };
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
      // A foe's grand summon lands here at the start of its caster's next turn (0.24.0): get clear
      posScore -= callsLandingOn(unit, tile.x, tile.z, units) * 30;
      posScore += groundScore(tile.x, tile.z);
      // Totems standing here pulse at the start of its next turn (0.47.0): stay out of a foe's
      // Storm and Binding, lean into an ally's Mending and Warding
      for (const { owner, totem } of standingTotems(units)) {
        const p = pulseFor(owner, totem, unit);
        if (!p) continue;
        if (p.damage) posScore -= (p.damage / unit.maxHp) * 100;
        if (p.status === 'slow') posScore -= 8;
        if (p.heal) posScore += 4;
        if (p.status === 'protect') posScore += 3;
      }

      for (const raw of baseAbilities) {
        const ability = performedBy(unit, resolveTerrainAbility(raw, terrain));
        const supportive = CombatEngine.isSupportive(ability);

        // A Necromancer's work (0.52.0) is aimed at a body: raise it (worth the fallen foe's
        // strength, for a few turns) or burst it among the living
        if (worksOnBodies(ability)) {
          for (const b of bodies(units)) {
            if (!grid.canTarget(tile.x, tile.z, b.x, b.z, ability.range, ability.heightTolerance, true)) continue;
            let score: number;
            if (ability.thrall) {
              const raised = bodies(units).filter((c) => manhattan(c, b) <= ability.aoe && canRaise(unit, c, units));
              if (!raised.length) continue;
              score = raised.reduce((s, c) => s + 22 + c.level * 1.5 + (JobSystem.getAttackPower(c) + JobSystem.getMagicPower(c)) / 10, 0);
            } else {
              const victims = unitsInBlast(unit, ability, b.x, b.z, units);
              if (!victims.length) continue;
              score = scoreAbility(unit, ability, victims, grid, { x: b.x, z: b.z }, units, new Set<string>());
            }
            if (score <= 0) continue;
            if (threat) score -= risk(tile.x, tile.z, unit.currentHp);
            if (ability.signature) score -= 30;
            if (holding) score -= 12;
            score += posScore - ability.mpCost * 0.15;
            if (!best || score > best.score) {
              const nearestFoe = foes.reduce((a, c) => manhattan(a, tile) <= manhattan(c, tile) ? a : c);
              best = { moveTo: { ...tile }, ability, targetTile: { x: b.x, z: b.z }, facing: faceTowards(tile.x, tile.z, nearestFoe.x, nearestFoe.z), score };
            }
          }
          continue;
        }

        // A Sapper's barricade or raised earth (0.54.0) goes on ground within reach: try each tile
        if (ability.earthwork && ability.power <= 0) {
          for (let dz = -ability.range; dz <= ability.range; dz++) for (let dx = -ability.range; dx <= ability.range; dx++) {
            const ax = tile.x + dx, az = tile.z + dz;
            if (!grid.canTarget(tile.x, tile.z, ax, az, ability.range, ability.heightTolerance, true)) continue;
            let score = ability.aoe
              ? [...Array(2 * ability.aoe + 1)].flatMap((_, i) => [...Array(2 * ability.aoe + 1)].map((__, j) => [ax + i - ability.aoe, az + j - ability.aoe]))
                .filter(([cx, cz]) => Math.abs(cx - ax) + Math.abs(cz - az) <= ability.aoe)
                .reduce((s, [cx, cz]) => s + scoreWorks(unit, ability, cx, cz, units, grid, tile), 0)
              : scoreWorks(unit, ability, ax, az, units, grid, tile);
            if (score <= 8) continue;
            if (threat) score -= risk(tile.x, tile.z, unit.currentHp);
            if (ability.signature) score -= 30;
            if (holding) score -= 12;
            score += posScore - ability.mpCost * 0.15;
            if (!best || score > best.score) {
              const nearestFoe = foes.reduce((a, c) => manhattan(a, tile) <= manhattan(c, tile) ? a : c);
              best = { moveTo: { ...tile }, ability, targetTile: { x: ax, z: az }, facing: faceTowards(tile.x, tile.z, nearestFoe.x, nearestFoe.z), score };
            }
          }
          continue;
        }

        // A Ranger's trap (0.49.0) goes on free ground within reach: try each such tile
        if (ability.trap) {
          for (let dz = -ability.range; dz <= ability.range; dz++) for (let dx = -ability.range; dx <= ability.range; dx++) {
            const ax = tile.x + dx, az = tile.z + dz;
            if ((ax === tile.x && az === tile.z) || !grid.canTarget(tile.x, tile.z, ax, az, ability.range, ability.heightTolerance, true)) continue;
            let score = scoreTrap(unit, ability, ax, az, units, grid);
            if (score <= 4) continue;
            if (threat) score -= risk(tile.x, tile.z, unit.currentHp);
            if (ability.signature) score -= 30;
            if (holding) score -= 12;
            score += posScore - ability.mpCost * 0.15;
            if (!best || score > best.score) {
              const nearestFoe = foes.reduce((a, b) => manhattan(a, tile) <= manhattan(b, tile) ? a : b);
              best = { moveTo: { ...tile }, ability, targetTile: { x: ax, z: az }, facing: faceTowards(tile.x, tile.z, nearestFoe.x, nearestFoe.z), score };
            }
          }
          continue;
        }

        // A Shaman's totem (0.47.0) goes on a tile: try every living unit's tile within reach
        if (ability.totem) {
          for (const aim of units) {
            if (aim.isDead || !grid.canTarget(tile.x, tile.z, aim.x, aim.z, ability.range, ability.heightTolerance, true)) continue;
            const ax = aim.id === unit.id ? tile.x : aim.x;
            const az = aim.id === unit.id ? tile.z : aim.z;
            let score = scoreTotem(unit, ability, ax, az, units);
            if (score <= 0) continue;
            if (threat) score -= risk(tile.x, tile.z, unit.currentHp);
            if (ability.signature) score -= 30;
            if (holding) score -= 12;
            score += posScore - ability.mpCost * 0.15;
            if (!best || score > best.score) {
              const nearestFoe = foes.reduce((a, b) => manhattan(a, tile) <= manhattan(b, tile) ? a : b);
              best = { moveTo: { ...tile }, ability, targetTile: { x: ax, z: az }, facing: faceTowards(tile.x, tile.z, nearestFoe.x, nearestFoe.z), score };
            }
          }
          continue;
        }

        // Candidate aim points: every unit on the relevant side within reach
        // A performance is centred on the performer, wherever it stands
        const aimUnits = ability.isSelfOnly || isCentered(ability) ? [unit]
          : ability.revive ? units.filter((u) => u.isDead && isAlly(u, unit)) // a revive aims at the fallen
          : ability.rebirth ? units.filter((u) => isAlly(u, unit) && u.id !== unit.id) // heals the living, raises the fallen
          : supportive ? alliesOf(unit, units) : foes;
        for (const aim of aimUnits) {
          const ax = aim.id === unit.id ? tile.x : aim.x;
          const az = aim.id === unit.id ? tile.z : aim.z;
          if (!ability.isSelfOnly && !isCentered(ability) && !grid.canTarget(tile.x, tile.z, ax, az, ability.range, ability.heightTolerance, supportive)) continue;

          const victims = ability.isSelfOnly ? [unit] : unitsInBlast(unit, ability, ax, az, units);
          const raise = rebirthOf(ability);
          const fallen = raise ? unitsInBlast(unit, raise, ax, az, units) : [];
          if (victims.length === 0 && fallen.length === 0) continue;

          const kills = new Set<string>();
          let score = scoreAbility(unit, ability, victims, grid, { x: ax, z: az }, units, kills) + groundWorth(unit, ability, isCentered(ability) ? tile.x : ax, isCentered(ability) ? tile.z : az, units, grid)
            + (raise && fallen.length ? scoreAbility(unit, raise, fallen, grid, { x: ax, z: az }, units) : 0);
          if (score <= 0) continue;
          // Items are few: keep them for when they matter
          if (ability.item) score -= 6;
          // A Dark Knight's technique costs HP (0.46.0): worth it for a real blow, dearer when hurt
          const paid = ability.hpCost ? JobSystem.hpCostFor(unit, ability) : 0;
          if (paid) score -= (paid / unit.maxHp) * 100 * (unit.currentHp < unit.maxHp / 2 ? 0.9 : 0.45);
          if (threat) {
            // A heal on itself raises the HP it will face the next turn with; a price in HP lowers it
            let hpAfter = unit.currentHp - paid;
            if (victims.includes(unit) && (ability.power < 0 || ability.fixedHeal)) {
              const fc = CombatEngine.getForecast(unit, unit, ability, tileH, tileH);
              hpAfter = Math.min(unit.maxHp, hpAfter + Math.abs(Math.min(0, fc.expectedDamage)));
            }
            score -= risk(tile.x, tile.z, hpAfter, kills);
          }
          // A grand summon lands on the caster's next turn, and its targets can see it coming
          // (0.24.0): worth less than the same blow now, but it doesn't cost this turn's move
          if (ability.charge) score *= 0.7;
          // A performance plays again on the next turns if the performer stays put
          if (ability.performance) score *= 1.4;
          // A Master signature can be used once a battle: keep it for a moment that matters
          if (ability.signature) score -= 30;
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
  // ... and never into an area a foe's grand summon is about to land on (0.24.0)
  // With caution (0.31.0) a hurt unit with nothing to do hangs back rather than walking into reach
  // With `holdBack` (the squad's AUTO, 0.45.0) a spot where it would likely fall counts in full
  // even for a healthy unit
  const walkRisk = (t: { x: number; z: number }) => {
    if (!threat || opts.caution !== 'full') return 0;
    const r = risk(t.x, t.z, unit.currentHp);
    if (r >= 30 && opts.holdBack) return r;
    return r * (unit.currentHp < unit.maxHp * 0.4 ? 0.4 : 0.1);
  };
  // With a hold objective (0.48.0) the walk heads for the zone first, and the foes second
  const towards = (t: { x: number; z: number }) => (opts.zone?.size && !opts.guardZone ? zoneDist(t) + distFrom(t) * 0.25 : distFrom(t));
  const walkScore = (t: { x: number; z: number }) => towards(t) - grid.getHeight(t.x, t.z) * 0.05 + callsLandingOn(unit, t.x, t.z, units) * 50 + walkRisk(t) - groundScore(t.x, t.z) * (unit.currentHp < unit.maxHp / 2 ? 0.6 : 1 / 8); // a hurt unit minds the ground more (0.51.0)
  let moveTo = origin;
  let bestDist = walkScore(origin);
  for (const t of tiles) {
    const d = walkScore(t);
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
