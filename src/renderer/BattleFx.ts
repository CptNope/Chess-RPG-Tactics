/**
 * Battle effect cues: which pixel-art effect plays for which game event, where, and how fast.
 *
 * Effects are authored facing right with their impact some way into the animation. Each cue says
 * where the effect stands (on the target, or just in front of the attacker for a weapon arc),
 * whether to mirror it so it travels toward the target on screen, and how far to skip into a
 * wind-up so the impact lands with the damage number (`startAt` keeps ~0.15 s of anticipation).
 */
import * as THREE from 'three';
import type { Ability, Unit } from '../core/types';
import type { TacticsScene } from './TacticsScene';
import { effectImpact, type PlayOptions } from './PixelEffects';

interface Cue extends PlayOptions {
  id: string;
  /** Wrap the effect round the unit's real sprite (heals, statuses). */
  wrap?: boolean;
}

/** Spell impact per element. Times come from each effect's source (see the constants at its top). */
const ELEMENT: Record<string, Cue> = {
  fire: { id: 'fire/flame-pillar', startAt: 0.4, speed: 1.5 },
  ice: { id: 'ice/icicle-fall', startAt: 0.75, speed: 1.3 },
  lightning: { id: 'lightning/lightning-strike', startAt: 0.7, speed: 1.4 },
  holy: { id: 'holy/smite', startAt: 0.38, speed: 1.3 },
  dark: { id: 'shadow/grasping-hands', startAt: 0.18, speed: 1.5 },
  time: { id: 'arcane/time-stop', startAt: 0.2, speed: 1.6 }
};

/** Geomancy spells (by terrain) get their own look where the element alone would be generic. */
const GEOMANCY: Record<string, Cue> = {
  Rockslide: { id: 'nature/earth-spike', startAt: 0.22, speed: 1.4 },
  Sandstorm: { id: 'nature/quake', speed: 1.5 },
  'Hell Ivy': { id: 'nature/root-snare', startAt: 0.45, speed: 1.3, wrap: true },
  Quicksand: { id: 'status/poisoned', speed: 1.1, wrap: true, holdFor: 1.3 }
};

/** Buffs and ailments, by status id. */
const STATUS: Record<string, Cue> = {
  // Our own effect: the library's Haste trails after-images two tiles behind the unit
  haste: { id: 'local/quicken', wrap: true, holdFor: 1.3 },
  slow: { id: 'status/slowed', wrap: true, holdFor: 1.6 },
  protect: { id: 'holy/divine-shield', wrap: true, holdFor: 1.4 },
  poison: { id: 'status/poisoned', wrap: true, holdFor: 1.4 },
  immobilize: { id: 'nature/root-snare', startAt: 0.45, speed: 1.3, wrap: true },
  focus: { id: 'status/rage', wrap: true, holdFor: 1.3 },
  shell: { id: 'arcane/rune-circle', holdFor: 1.3, speed: 1.4 },
  regen: { id: 'nature/healing-bloom', speed: 1.5 },
  blind: { id: 'status/stunned', wrap: true, holdFor: 1.4 },
  silence: { id: 'status/cursed', wrap: true, holdFor: 1.4 },
  sleep: { id: 'status/sleep', wrap: true, holdFor: 1.8 },
  breach: { id: 'shadow/hex-sigil', speed: 2.2, startAt: 0.6 },
  encore: { id: 'arcane/rune-circle', holdFor: 1.1, speed: 1.6 },
  calling: { id: 'arcane/rune-circle', holdFor: 1.4, speed: 1.2 }
};

/** Abilities with a look of their own, beyond their element. */
const ABILITY: Record<string, Cue> = {
  mo_aura_wave: { id: 'arcane/mana-burst', speed: 1.4 },
  bm_firestorm: { id: 'fire/fire-tornado', holdFor: 1.1, speed: 1.3 },
  su_salamander: { id: 'fire/fire-tornado', holdFor: 1.1, speed: 1.3 },
  su_undine: { id: 'water/wave-crash', startAt: 0.95, speed: 1.6 },
  or_soul_drain: { id: 'shadow/soul-drain', holdFor: 1.0, speed: 1.4 },
  // 0.38.0
  dr_jump: { id: 'impacts/heavy-landing', speed: 1.5 },
  gu_flash_powder: { id: 'explosions/smoke-bomb', speed: 2.4, scale: 0.6 },
  gu_scattershot: { id: 'impacts/bullet-impact', speed: 1.4, scale: 0.8 },
  gu_breaching_round: { id: 'impacts/bullet-impact', speed: 1.3 },
  sig_thunder_volley: { id: 'impacts/heavy-landing', speed: 1.4 }
};

/**
 * Area spells by element (0.38.0): a burst over the area instead of one strike per target. Played
 * once, on the aim tile; the targets get the single-target look only if there's none here.
 */
const AREA: Record<string, Cue> = {
  ice: { id: 'ice/frost-nova', speed: 2.2, scale: 0.7, startAt: 0.3 },
  lightning: { id: 'lightning/thunderclap', speed: 1.6, scale: 0.7, startAt: 0.2 }
};

/** What a ranged weapon fires (0.38.0): drawn pointing right, its origin at the tip. */
const MISSILE: Record<string, { id: string; speed: number; arc: number; flash?: string }> = {
  bow: { id: 'projectiles/arrow', speed: 18, arc: 0.7 },
  gun: { id: 'projectiles/bullet-tracer', speed: 34, arc: 0, flash: 'projectiles/muzzle-pistol' }
};

export class BattleFx {
  private v = new THREE.Vector3();

  constructor(private scene: TacticsScene) {}

  private ground(u: { x: number; z: number }): THREE.Vector3 {
    return new THREE.Vector3(u.x, this.scene.grid.getHeight(u.x, u.z), u.z);
  }

  /** True when `to` is left of `from` on screen, so a right-facing effect should be mirrored. */
  private leftward(from: { x: number; z: number }, to: { x: number; z: number }): boolean {
    const cam = this.scene.camera;
    const a = this.v.set(from.x, 0, from.z).project(cam).x;
    const b = this.v.set(to.x, 0, to.z).project(cam).x;
    return b < a - 1e-4;
  }

  private play(c: Cue, at: Unit | { x: number; z: number }, extra: PlayOptions = {}): void {
    const { id, wrap, ...opts } = c;
    const actor = wrap && 'jobId' in at ? this.scene.fxActorFor(at as Unit) : undefined;
    this.scene.pfx.play(id, this.ground(at), { ...opts, ...extra, ...(actor ? { actor } : {}) });
  }

  /**
   * A summon's creature over the whole area (0.24.0), drawn in front of the board. Returns the
   * seconds until it lands, so the damage numbers can wait for it. `speed` > 1 plays it faster.
   */
  public summon(ability: Ability, at: { x: number; z: number }, speed = 1): number {
    const id = `summon/${ability.summon}`;
    const impact = effectImpact(id);
    if (!impact) return 0;
    this.scene.pfx.play(id, this.ground(at), { overlay: true, speed, options: { radius: ability.aoe } });
    return impact / speed;
  }

  /**
   * Something in flight before the blow lands (0.38.0): an arrow from a bow, a ball from a gun
   * (with a flash at the muzzle). Returns the seconds until it arrives, so the damage can wait for
   * it; 0 when nothing flies (a melee blow, a spell, a target next to the shooter).
   */
  public launch(caster: Unit, ability: Ability, tx: number, tz: number, speed = 1): number {
    const w = caster.equipment.weapon?.weaponType;
    if (ability.element !== 'physical' || ability.isSelfOnly || ability.summon || ability.power <= 0 || !w) return 0;
    const m = MISSILE[w];
    const dist = Math.abs(caster.x - tx) + Math.abs(caster.z - tz);
    if (!m || dist < 2) return 0;
    const from = this.ground(caster), to = this.ground({ x: tx, z: tz });
    const flip = this.leftward(caster, { x: tx, z: tz });
    const len = Math.hypot(tx - caster.x, tz - caster.z, to.y - from.y);
    const flight = Math.max(0.12, len / m.speed) / speed;
    const pfx = this.scene.pfx;
    if (m.flash) this.scene.pfx.play(ability.id === 'gu_scattershot' ? 'projectiles/muzzle-shotgun' : m.flash, from, { flip, lift: 18, speed: 1.6 * speed, scale: 0.6 });
    // Scattershot fires a spray: three tracers fanned out a little
    const n = ability.id === 'gu_scattershot' ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const spread = (k - (n - 1) / 2) * 0.35;
      const end = to.clone().add(new THREE.Vector3(spread, 0, -spread));
      pfx.play(m.id, from, {
        flip, lift: 18, to: end, flight, arc: m.arc * Math.min(1, len / 6),
        angle: pfx.screenAngle(from, end), speed: 1.5, holdFor: flight + 0.1
      });
    }
    return flight;
  }

  /** An area spell's burst over the whole area (0.38.0); false when the element has none. */
  public area(ability: Ability, at: { x: number; z: number }): boolean {
    const cue = ability.aoe > 0 && ability.power > 0 ? AREA[ability.element] : undefined;
    if (!cue || ABILITY[ability.id]) return false;
    this.play(cue, at);
    return true;
  }

  /** A damaging hit: weapon arc and spark for physical blows, the element's spell otherwise. */
  public hit(caster: Unit, target: Unit, ability: Ability, crit: boolean): void {
    const flip = this.leftward(caster, target);
    // The summon's creature already showed the blow: just a spark where it lands
    if (ability.summon) return this.play({ id: crit ? 'impacts/crit-hit' : 'impacts/hit-spark', scale: crit ? 0.85 : 1 }, target, { flip });
    const geo = ability.name.split(': ')[1];
    if (geo && GEOMANCY[geo]) return this.play(GEOMANCY[geo], target, { flip });
    if (ABILITY[ability.id]) {
      this.play(ABILITY[ability.id], target, { flip });
      if (crit) this.play({ id: 'impacts/crit-hit', delay: 0.15, scale: 0.85 }, target, { flip });
      return;
    }

    if (ability.element === 'physical') {
      const dist = Math.abs(caster.x - target.x) + Math.abs(caster.z - target.z);
      if (dist <= 1 && !ability.isSelfOnly) {
        // The arc starts just short of the target and sweeps across it
        this.meleeArc(caster, target, flip, 1.15);
      }
      // A gun's ball lands with a puff of dust and chips (0.38.0; a blunt thump in 0.36)
      const shot = ability.ignoresHeight && caster.equipment.weapon?.weaponType === 'gun';
      if (shot && !crit) return this.play({ id: 'impacts/bullet-impact', speed: 1.5, scale: 0.7 }, target, { flip });
      // A fist lands with a thump, a blade with a spark
      const fist = caster.jobId === 'monk' || caster.equipment.weapon?.weaponType === 'knuckles';
      this.play({ id: crit ? 'impacts/crit-hit' : fist ? 'impacts/blunt-hit' : 'impacts/hit-spark', delay: dist <= 1 ? 0.06 : 0 }, target, { flip, scale: crit ? 0.85 : 1 });
      return;
    }
    // An area spell's burst already covered the targets: a spark on each is enough
    if (ability.aoe > 0 && AREA[ability.element]) return this.play({ id: crit ? 'impacts/crit-hit' : 'impacts/hit-spark', scale: crit ? 0.85 : 0.8 }, target, { flip });
    const cue = ELEMENT[ability.element];
    if (cue) this.play(cue, target, { flip });
    if (crit) this.play({ id: 'impacts/crit-hit', delay: 0.15, scale: 0.85 }, target, { flip });
  }

  public heal(target: Unit): void {
    this.play({ id: 'holy/heal', wrap: true, speed: 1.15 }, target);
  }

  /** A buff or ailment landing without damage. */
  public status(target: Unit, status: string | undefined): void {
    const cue = (status && STATUS[status]) || { id: 'arcane/mana-burst', speed: 1.3 };
    this.play(cue, target);
  }

  /** A follow-up blow (dual wield, counter-attack). */
  public strike(attacker: Unit, target: Unit): void {
    const flip = this.leftward(attacker, target);
    this.meleeArc(attacker, target, flip, 1.2);
    this.play({ id: 'impacts/hit-spark', delay: 0.06 }, target, { flip });
  }

  /**
   * The weapon's swing (0.38.0: per weapon, not just blade or fist): a sword's arc, a dagger
   * flurry, a spear's thrust, a fist's uppercut, a whip's crack, a monster's claws or a brute's smash.
   */
  private meleeArc(caster: Unit, target: Unit, flip: boolean, speed: number): void {
    const w = caster.equipment.weapon?.weaponType;
    if (caster.jobId === 'brute') return this.play({ id: 'melee/hammer-smash', speed: speed * 1.8, startAt: 0.5, scale: 0.7 }, target, { flip, offsetX: flip ? 20 : -20 });
    if (['wolf', 'wyvern', 'basilisk', 'thornling', 'ooze'].includes(caster.jobId)) return this.play({ id: 'melee/claw-swipe', speed }, target, { flip, offsetX: flip ? 14 : -14 });
    if (caster.jobId === 'monk' || w === 'knuckles') return this.play({ id: 'melee/uppercut', speed }, target, { flip, offsetX: flip ? 12 : -12 });
    if (w === 'spear') return this.play({ id: 'melee/thrust', speed }, target, { flip, offsetX: flip ? 40 : -40, scale: 0.8 });
    if (w === 'whip') return this.play({ id: 'melee/whip-crack', speed }, target, { flip, offsetX: flip ? 44 : -44, scale: 0.8 });
    const arc = caster.jobId === 'ninja' || caster.jobId === 'thief' || w === 'dagger' ? 'melee/dagger-flurry' : 'melee/sword-slash';
    this.play({ id: arc, speed }, target, { flip, offsetX: flip ? 30 : -30 });
  }

  /** Ailments washed away. */
  public cleanse(target: Unit): void {
    this.play({ id: 'holy/sunburst', holdFor: 0.9, speed: 1.4, scale: 0.8, lift: 12 }, target);
  }

  /** Life flowing back into the caster (Soul Drain). */
  public drain(caster: Unit): void {
    this.play({ id: 'holy/heal', wrap: true, speed: 1.3 }, caster);
  }

  /** Gear snatched off a target. */
  public steal(target: Unit): void {
    this.play({ id: 'pickups/collect-burst', speed: 1.1, lift: 14 }, target);
  }

  /** A monster won over by a Beast Tamer (0.28.0). */
  public tame(target: Unit): void {
    this.play({ id: 'local/tame', wrap: true, speed: 1.1 }, target);
  }

  public enrage(boss: Unit): void {
    this.play({ id: 'status/rage', wrap: true, holdFor: 1.6 }, boss);
  }

  public levelUp(unit: Unit): void {
    this.play({ id: 'holy/feather-burst', speed: 1.3, scale: 0.8, lift: 10 }, unit);
  }
}
