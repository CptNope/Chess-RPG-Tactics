/**
 * Plays pixelfx pixel-art effects in the 3D scene.
 *
 * Each live effect draws into two small pixel frames (behind and in front of the unit). Each frame
 * has a colour buffer and a light buffer. They become four textures on billboards that turn with
 * the camera like the unit sprites: colour with normal blending, light with additive blending, so
 * glows brighten what's behind them (and feed bloom on High).
 *
 * Effect pixels are the same size on screen as sprite pixels (1.35 world units per 48 px), so the
 * effects and the 48px characters read as one piece of pixel art. Effects step at their own frame
 * rate (30 fps), like hand-drawn animation, whatever the display's refresh rate.
 */
import * as THREE from 'three';
import { EFFECTS, createFrame, clearFrame, createFx, FxFrame, FxInstance, FxModule } from '../vendor/pixelfx/registry.js';
import * as quicken from './fx/quicken.js';
import * as tameFx from './fx/tame.js';
import { SUMMON_EFFECTS } from './fx/summons/index.js';

/** The game's own effects, alongside the vendored library: Haste, and the summons (0.24.0). */
const LOCAL_EFFECTS: Record<string, FxModule> = { 'local/quicken': quicken, 'local/tame': tameFx, ...(SUMMON_EFFECTS as Record<string, FxModule>) };

/** Seconds into an effect at which it lands (summons say so in their meta), at speed 1. */
export function effectImpact(id: string): number {
  const mod = EFFECTS[id] ?? LOCAL_EFFECTS[id];
  return (mod?.meta as { impact?: number } | undefined)?.impact ?? 0;
}

/** World units per effect pixel (matches the 48px unit sprites drawn on 1.35-unit planes). */
export const FX_PIXEL = 1.35 / 48;
/**
 * Height of the sprite's feet above the tile: the sprite plane is centred 0.68 above the tile and
 * its feet end at pixel row 44 of 48, so effect pixels line up exactly with sprite pixels.
 */
const FEET = 0.68 + 1.35 / 2 - 44 * (1.35 / 48);
/** How far the back and front layers sit behind and in front of the unit, along the view. */
const LAYER_DEPTH = 0.32;

/** A character for effects that wrap or recolour a body (heal, poison, haste...): mask + pixels, feet at (0, 0). */
export interface FxActor {
  mask: { w: number; h: number; data: Uint8Array };
  pixels: Uint32Array;
  x: number;
  y: number;
  w: number;
  h: number;
  k: number;
  head: [number, number];
  chest: [number, number];
}

const actorCache = new Map<string, FxActor>();

/**
 * Builds an effect actor from a 48×48 unit sprite canvas (key identifies job/view/team), so effects
 * shape themselves to the real character instead of the library's stand-in.
 */
export function actorFromSprite(key: string, sprite: HTMLCanvasElement): FxActor {
  const hit = actorCache.get(key);
  if (hit) return hit;
  const S = sprite.width;
  const img = sprite.getContext('2d')!.getImageData(0, 0, S, sprite.height).data;
  let x0 = S, y0 = S, x1 = -1, y1 = -1;
  // Solid pixels only (the soft ground shadow is ~35% alpha and is left out)
  const solid = (x: number, y: number) => img[(y * S + x) * 4 + 3] >= 200;
  for (let y = 0; y < sprite.height; y++) for (let x = 0; x < S; x++) if (solid(x, y)) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const mask = new Uint8Array(w * h);
  const pixels = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x0 + x, y0 + y)) continue;
    const i = ((y0 + y) * S + x0 + x) * 4;
    mask[y * w + x] = 1;
    pixels[y * w + x] = (img[i] | (img[i + 1] << 8) | (img[i + 2] << 16) | (255 << 24)) >>> 0;
  }
  // Feet sit on row 44 of the sprite: rows above it are negative y in effect space
  const top = y0 - 44;
  const actor: FxActor = {
    mask: { w, h, data: mask }, pixels,
    x: x0 - S / 2, y: top, w, h, k: 2,
    head: [0, top], chest: [0, Math.round(top + h * 0.38)]
  };
  actorCache.set(key, actor);
  return actor;
}
const MAX_LIVE = 14;

export interface PlayOptions {
  /** Mirror a directional effect so it faces left on screen. */
  flip?: boolean;
  /** Dark-to-bright colour ramp (hex strings). */
  palette?: string[];
  /** Playback speed (1 = as authored). */
  speed?: number;
  /** Seconds to wait before it starts. */
  delay?: number;
  /** Skip into the effect (seconds of its own time), e.g. past a long wind-up. */
  startAt?: number;
  /** Nudge the origin sideways on screen, in effect pixels (positive = screen right). */
  offsetX?: number;
  /** Glow strength multiplier. */
  light?: number;
  /** Pixels to lift the effect's origin above the unit's feet (e.g. to chest height). */
  lift?: number;
  /** Size multiplier (1 = pixel-matched to sprites). */
  scale?: number;
  seed?: number;
  /** Stop a looping effect after this many seconds (it fades out). */
  holdFor?: number;
  /** The real character, for effects that wrap or recolour a body. */
  actor?: FxActor;
  /** Any of the effect's own options. */
  options?: Record<string, unknown>;
  /** Draw over the whole board, ignoring depth (summons, 0.24.0). */
  overlay?: boolean;
}

interface Layer {
  frame: FxFrame;
  color: THREE.DataTexture;
  light: THREE.DataTexture;
}

interface Live {
  fx: FxInstance;
  base: THREE.Vector3;
  groups: THREE.Group[];
  layers: Layer[];
  materials: THREE.Material[];
  speed: number;
  delay: number;
  step: number;
  acc: number;
  age: number;
  holdFor: number;
}

const geomCache = new Map<string, THREE.PlaneGeometry>();

export class PixelEffects {
  private live: Live[] = [];
  /** Set by the scene each frame so billboards face the camera. */
  public facing = Math.PI / 4;

  private toCamera = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private camera: THREE.Camera) {}

  /** Starts an effect whose origin sits at `pos` (a tile's surface under a unit's feet). */
  public play(id: string, pos: THREE.Vector3, o: PlayOptions = {}): void {
    const mod = EFFECTS[id] ?? LOCAL_EFFECTS[id];
    if (!mod) return;
    while (this.live.length >= MAX_LIVE) this.dispose(this.live.shift()!);

    const [w, h] = mod.meta.size;
    const [ox, oy] = mod.meta.origin;
    const fx = createFx(mod, {
      ...(o.options || {}),
      x: ox,
      y: oy,
      flip: !!o.flip,
      ...(o.palette ? { palette: o.palette } : {}),
      ...(o.seed !== undefined ? { seed: o.seed } : {}),
      ...(o.light !== undefined ? { light: o.light } : {}),
      ...(o.actor ? { actor: o.actor } : {})
    });

    const scale = o.scale ?? 1;
    const key = `${w}x${h}`;
    let geom = geomCache.get(key);
    if (!geom) geomCache.set(key, (geom = new THREE.PlaneGeometry(w * FX_PIXEL, h * FX_PIXEL)));

    const base = new THREE.Vector3(pos.x, pos.y + FEET + (o.lift ?? 0) * FX_PIXEL, pos.z);
    if (o.offsetX) {
      // The billboard's right-hand direction for the current camera angle
      base.x += Math.cos(this.facing) * o.offsetX * FX_PIXEL;
      base.z -= Math.sin(this.facing) * o.offsetX * FX_PIXEL;
    }
    if (o.startAt) fx.update(o.startAt);
    const groups: THREE.Group[] = [];
    // Plane centre relative to the effect's origin (pixel rows run downward)
    const cx = (w / 2 - ox) * FX_PIXEL;
    const cy = (oy - h / 2) * FX_PIXEL;

    const layers: Layer[] = [];
    const materials: THREE.Material[] = [];
    (['back', 'front'] as const).forEach((side, i) => {
      const frame = createFrame(w, h);
      const tex = (buf: Uint32Array) => {
        const t = new THREE.DataTexture(new Uint8Array(buf.buffer as ArrayBuffer), w, h, THREE.RGBAFormat);
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.colorSpace = THREE.SRGBColorSpace;
        t.generateMipmaps = false;
        return t;
      };
      const layer: Layer = { frame, color: tex(frame.color), light: tex(frame.light) };
      layers.push(layer);
      // One group per layer: behind the unit for "back", in front of it for "front" (placed in update())
      const group = new THREE.Group();
      group.scale.setScalar(scale);
      group.userData.depth = side === 'back' ? -LAYER_DEPTH : LAYER_DEPTH;
      group.visible = false;
      groups.push(group);
      this.scene.add(group);
      const order = o.overlay ? 20 + i : side === 'back' ? 9 : 11;

      const colorMat = new THREE.MeshBasicMaterial({
        map: layer.color, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, alphaTest: 0.02,
        depthTest: !o.overlay
      });
      const lightMat = new THREE.MeshBasicMaterial({
        map: layer.light, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
        depthTest: !o.overlay
      });
      for (const [mat, extra] of [[colorMat, 0], [lightMat, 1]] as const) {
        const mesh = new THREE.Mesh(geom, mat);
        // Pixel rows are stored top-first; flip the quad so the picture is upright
        mesh.scale.y = -1;
        mesh.position.set(cx, cy, extra * 0.001 + i * 0.0005);
        mesh.renderOrder = order + extra * 0.5;
        mesh.frustumCulled = false;
        mesh.userData.noPick = true;
        group.add(mesh);
        materials.push(mat);
      }
    });
    const fps = mod.meta.fps || 30;
    this.live.push({
      fx, base, groups, layers, materials,
      speed: o.speed ?? 1,
      delay: o.delay ?? 0,
      step: 1 / fps,
      acc: 1 / fps, // draw on the first frame it's visible
      age: 0,
      holdFor: o.holdFor ?? (mod.meta.loop ? 1.6 : Infinity)
    });
  }

  public update(dt: number): void {
    // Shift layers along the view direction only, so they don't slide on screen (orthographic camera)
    this.camera.getWorldDirection(this.toCamera).negate();
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i];
      for (const g of l.groups) {
        g.rotation.y = this.facing;
        g.position.copy(l.base).addScaledVector(this.toCamera, g.userData.depth);
      }
      if (l.delay > 0) {
        l.delay -= dt;
        continue;
      }
      for (const g of l.groups) g.visible = true;
      const d = dt * l.speed;
      l.age += d;
      l.acc += d;
      if (l.age >= l.holdFor) l.fx.stop();
      // Advance in whole animation frames so it looks hand-animated
      if (l.acc >= l.step) {
        const steps = Math.floor(l.acc / l.step);
        l.acc -= steps * l.step;
        l.fx.update(steps * l.step);
        for (const [i2, layer] of l.layers.entries()) {
          clearFrame(layer.frame);
          l.fx.draw(layer.frame, i2 === 0 ? 'back' : 'front');
          layer.color.needsUpdate = true;
          layer.light.needsUpdate = true;
        }
      }
      if (l.fx.done()) {
        this.dispose(l);
        this.live.splice(i, 1);
      }
    }
  }

  /** Removes every live effect (new battle, Workshop). */
  public clear(): void {
    for (const l of this.live) this.dispose(l);
    this.live = [];
  }

  public get count(): number {
    return this.live.length;
  }

  private dispose(l: Live): void {
    for (const g of l.groups) this.scene.remove(g);
    for (const m of l.materials) m.dispose();
    for (const layer of l.layers) {
      layer.color.dispose();
      layer.light.dispose();
    }
  }
}
