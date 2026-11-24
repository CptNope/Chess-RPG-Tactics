/**
 * Procedural character art: 48×48 battle sprites and 64×64 dialogue portraits.
 *
 * Everything is drawn in code with a tiny pixel painter (no image assets), then given a
 * 1px dark outline so figures read clearly on any terrain. Sprites have three views
 * (front, back, side; the other side is mirrored) and six frames:
 *   idle0/idle1 (breathing), walk0/walk1 (stride), attack (weapon strike), hurt (flinch).
 */
import { drawMonsterPortrait, drawMonsterSprite, isMonsterArt } from './MonsterArt';

export type SpriteView = 'S' | 'N' | 'E' | 'W';
export type SpriteFrame = 'idle0' | 'idle1' | 'walk0' | 'walk1' | 'attack' | 'hurt';
export const SPRITE_SIZE = 48;
export const PORTRAIT_SIZE = 64;

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function hex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Lighten (amt > 0, toward a warm white) or darken (amt < 0, toward a cool navy). */
export function shade(c: string, amt: number): string {
  const [r, g, b] = rgb(c);
  if (amt >= 0) return hex(r + (255 - r) * amt, g + (248 - g) * amt, b + (230 - b) * amt);
  const k = -amt;
  return hex(r - (r - 12) * k, g - (g - 14) * k, b - (b - 34) * k);
}

const OUTLINE = '#0b0f1c';

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------

export class Painter {
  constructor(public ctx: CanvasRenderingContext2D) {}

  r(x: number, y: number, w: number, h: number, c: string): void {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(x, y, w, h);
  }

  px(x: number, y: number, c: string): void {
    this.r(x, y, 1, 1, c);
  }

  /** Shaded block: light from the upper left, shadow on the right and bottom. */
  b(x: number, y: number, w: number, h: number, c: string): void {
    this.r(x, y, w, h, c);
    if (w > 2 && h > 2) {
      this.r(x, y, w - 1, 1, shade(c, 0.22));
      this.r(x, y + 1, 1, h - 2, shade(c, 0.14));
      this.r(x + w - 1, y + 1, 1, h - 1, shade(c, -0.28));
      this.r(x + 1, y + h - 1, w - 2, 1, shade(c, -0.2));
    }
  }

  /** Thick pixel line (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, c: string, t = 1): void {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 200; i++) {
      this.r(x0, y0, t, t, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fill();
  }
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Adds a 1px outline around every opaque shape and cleans up anti-aliased edges. */
export function outline(canvas: HTMLCanvasElement, color = OUTLINE): void {
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    // Snap partial alpha from triangle edges to hard pixels
    if (d[i * 4 + 3] >= 110) { d[i * 4 + 3] = 255; solid[i] = 1; } else d[i * 4 + 3] = 0;
  }
  const [r, g, b] = rgb(color);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Job looks
// ---------------------------------------------------------------------------

type Body = 'light' | 'armor' | 'robe';
type Weapon = 'sword' | 'broadsword' | 'bow' | 'staff' | 'rod' | 'hourglass' | 'spear' | 'daggers' | 'gaia' | 'fists' | 'dagger' | 'horn' | 'orb' | 'lute' | 'whip';

interface Look {
  body: Body;
  weapon: Weapon;
  skin: string;
  hair: string;
  main: string;
  sub: string;
  trim: string;
  metal: string;
  pants: string;
  boots: string;
  shield?: boolean;
  cape?: string;
}

const SKIN = '#f2c79a';

function lookFor(job: string, enemy: boolean): Look {
  const base: Look = { body: 'light', weapon: 'sword', skin: SKIN, hair: '#8a4b1f', main: '#2f6fd6', sub: '#1d4aa8', trim: '#f4c430', metal: '#c9d3e0', pants: '#3b4558', boots: '#4a2e1c' };
  const e = enemy;
  switch (job) {
    case 'knight':
      return { ...base, body: 'armor', weapon: 'broadsword', shield: true, hair: '#c9a24a', main: e ? '#8e2a2a' : '#7d8aa1', sub: e ? '#5e1616' : '#2f4f8f', trim: '#f4c430', metal: e ? '#b98b8b' : '#d5dde8', cape: e ? '#5e1616' : '#2a4a8c' };
    case 'archer':
      return { ...base, weapon: 'bow', hair: '#a8532a', main: e ? '#9b2c2c' : '#2f8a4a', sub: e ? '#6b1c1c' : '#1f5e34', trim: '#c08a3e', pants: '#4b3a2a' };
    case 'white_mage':
      return { ...base, body: 'robe', weapon: 'staff', hair: '#e0a650', main: '#f3f1ea', sub: e ? '#b91c1c' : '#d64545', trim: e ? '#7f1d1d' : '#c0392b' };
    case 'black_mage':
      return { ...base, body: 'robe', weapon: 'rod', hair: '#1e1b4b', main: e ? '#5b1f7a' : '#2b3a8f', sub: '#b7791f', trim: '#f4c430', skin: '#141826' };
    case 'time_mage':
      return { ...base, body: 'robe', weapon: 'hourglass', hair: '#c56b9a', main: e ? '#6d1d6d' : '#b02a4a', sub: '#f4c430', trim: '#ffe27a' };
    case 'dragoon':
      return { ...base, body: 'armor', weapon: 'spear', hair: '#4a5568', main: e ? '#9b2c2c' : '#1f78b4', sub: e ? '#5e1616' : '#145a8a', trim: '#e8b931', metal: '#cfd8e3', cape: e ? '#6b1c1c' : '#0f3f66' };
    case 'ninja':
      return { ...base, weapon: 'daggers', hair: '#121826', main: e ? '#7a1f3a' : '#273248', sub: e ? '#e23b3b' : '#d63a3a', trim: '#9aa6b8', pants: e ? '#4a1424' : '#1c2433', boots: '#141a26' };
    case 'geomancer':
      return { ...base, body: 'robe', weapon: 'gaia', hair: '#5f8f2a', main: e ? '#9a3412' : '#4f7d1f', sub: e ? '#6b2410' : '#a16207', trim: '#e8c66a' };
    case 'paladin':
      return { ...base, body: 'armor', weapon: 'broadsword', shield: true, hair: '#e8dfc8', main: e ? '#3a2030' : '#e9e4d6', sub: e ? '#7a1f1f' : '#c9a227', trim: '#ffe27a', metal: e ? '#8d7f8a' : '#f3efe4', cape: e ? '#5e1616' : '#e6d9a8' };
    case 'spellblade':
      return { ...base, weapon: 'sword', hair: '#c9cfe0', main: e ? '#5a1f4a' : '#5b3fa8', sub: e ? '#2e0f26' : '#2f2466', trim: '#7dd3fc', pants: '#2a2f45', boots: '#1f2333', cape: e ? '#2e0f26' : '#2f2466' };
    case 'monk':
      return { ...base, weapon: 'fists', skin: '#e0ad7e', hair: '#2b2018', main: e ? '#7a2e1a' : '#efe6d2', sub: e ? '#b91c1c' : '#d9631a', trim: '#f4c430', pants: e ? '#4a1d12' : '#d8cdb5', boots: '#5b3a22' };
    case 'chemist':
      return { ...base, weapon: 'dagger', hair: '#7a4a2a', main: e ? '#6b3a1a' : '#2f8a7a', sub: e ? '#3d200e' : '#1f5e56', trim: '#e8c66a', pants: e ? '#3a2614' : '#4b3a2a' };
    case 'thief':
      return { ...base, weapon: 'dagger', hair: '#6b3a1f', main: e ? '#6b2626' : '#3f6a3a', sub: e ? '#3d1414' : '#24401f', trim: '#c08a3e', pants: e ? '#3a1d1d' : '#4b3a2a', boots: '#2e2118' };
    case 'summoner':
      return { ...base, body: 'robe', weapon: 'horn', hair: '#2f7f73', main: e ? '#6b1d4a' : '#1f6f6a', sub: e ? '#3e0e2b' : '#f4c430', trim: '#7dd3fc' };
    case 'oracle':
      return { ...base, body: 'robe', weapon: 'orb', hair: '#d8d4e8', main: e ? '#3a0f2a' : '#3b2f6b', sub: e ? '#b91c1c' : '#c4b5fd', trim: '#fde68a' };
    case 'bard':
      return { ...base, weapon: 'lute', hair: '#b45309', main: e ? '#7a1f3a' : '#6d28d9', sub: e ? '#3d0f1f' : '#facc15', trim: '#fde68a', pants: e ? '#3a1424' : '#3b2f5c', cape: e ? '#5e1616' : '#4c1d95' };
    case 'dancer':
      return { ...base, weapon: 'daggers', hair: '#5b2a14', main: e ? '#9d174d' : '#e11d48', sub: e ? '#4a0d24' : '#fbbf24', trim: '#fde68a', pants: e ? '#6b1035' : '#fb7185', boots: '#7c2d12' };
    case 'tamer':
      // A wolf-pelt hood and cloak over hunting greens (0.28.0)
      return { ...base, weapon: 'whip', hair: '#7a4a22', main: e ? '#6b3a1a' : '#5f7a2e', sub: e ? '#3d200e' : '#3f5220', trim: '#e7dcc0', pants: e ? '#3a2614' : '#5b4630', boots: '#3b2a1c', cape: e ? '#4a3a32' : '#8b8f99' };
    default: // squire
      return { ...base, weapon: 'sword', main: e ? '#b83232' : '#2f6fd6', sub: e ? '#7a1f1f' : '#1d4aa8', trim: '#d9a441' };
  }
}

// ---------------------------------------------------------------------------
// Sprite drawing
// ---------------------------------------------------------------------------

interface Pose {
  bob: number; // body shifted down (breathing)
  stride: -1 | 0 | 1; // which leg leads
  attack: boolean;
  hurt: boolean;
}

function poseFor(frame: SpriteFrame): Pose {
  return {
    bob: frame === 'idle1' || frame === 'hurt' ? 1 : 0,
    stride: frame === 'walk0' ? 1 : frame === 'walk1' ? -1 : 0,
    attack: frame === 'attack',
    hurt: frame === 'hurt'
  };
}

/** Headgear and hair, front view. hy = top of head. */
function headFront(p: Painter, job: string, L: Look, hy: number, pose: Pose, back: boolean): void {
  const x = 18;
  // Base head
  if (back) {
    p.b(x, hy, 12, 12, L.hair);
  } else {
    p.b(x, hy + 1, 12, 11, L.skin);
    // Eyes
    const ey = hy + 7;
    if (pose.hurt) {
      p.r(21, ey, 2, 1, '#2a1a12'); p.r(25, ey, 2, 1, '#2a1a12');
    } else {
      p.r(21, ey - 1, 2, 3, '#1b1f33'); p.r(25, ey - 1, 2, 3, '#1b1f33');
      p.px(21, ey - 1, '#ffffff'); p.px(25, ey - 1, '#ffffff');
    }
    p.r(23, hy + 10, 2, 1, shade(L.skin, -0.25));
    p.px(20, hy + 9, shade(L.skin, -0.08)); p.px(27, hy + 9, shade(L.skin, -0.08));
  }

  switch (job) {
    case 'paladin':
    case 'knight': {
      // Great helm with plume
      p.b(x - 1, hy - 1, 14, 13, L.metal);
      if (!back) {
        p.r(x + 1, hy + 6, 10, 2, '#141826'); // visor slit
        p.r(x + 5, hy + 8, 2, 3, '#141826');
        p.px(x + 2, hy + 6, shade(L.metal, 0.4));
      }
      p.r(x + 5, hy - 5, 2, 5, L.sub);
      p.r(x + 4, hy - 4, 4, 2, shade(L.sub, 0.2));
      p.r(x - 1, hy + 11, 14, 1, shade(L.metal, -0.3));
      break;
    }
    case 'dragoon': {
      p.b(x - 1, hy - 1, 14, 13, L.main);
      // wings
      p.tri(x - 1, hy + 2, x - 6, hy - 4, x - 1, hy - 1, L.metal);
      p.tri(x + 13, hy + 2, x + 18, hy - 4, x + 13, hy - 1, L.metal);
      p.r(x + 5, hy - 3, 2, 3, L.trim);
      if (!back) {
        p.r(x + 1, hy + 6, 10, 2, '#141826');
        p.r(x + 5, hy + 6, 2, 5, '#141826');
      }
      break;
    }
    case 'black_mage': {
      // Wide-brimmed pointy hat; the face is a shadow with glowing eyes
      if (!back) {
        p.r(x, hy + 3, 12, 9, '#101425');
        const glow = pose.hurt ? '#a16207' : '#ffd84a';
        p.r(21, hy + 7, 2, 2, glow); p.r(25, hy + 7, 2, 2, glow);
      }
      p.tri(x + 6, hy - 12, x - 1, hy + 2, x + 13, hy + 2, shade('#a8641f', 0.05));
      p.tri(x + 6, hy - 12, x + 6, hy + 2, x + 13, hy + 2, shade('#a8641f', -0.2));
      p.px(x + 7, hy - 11, '#a8641f');
      p.b(x - 4, hy + 2, 20, 3, '#8a5218');
      p.r(x + 1, hy + 1, 10, 1, L.trim);
      break;
    }
    case 'time_mage': {
      if (!back) p.r(x, hy + 1, 12, 3, L.hair);
      p.tri(x + 6, hy - 11, x - 1, hy + 3, x + 13, hy + 3, L.main);
      p.tri(x + 6, hy - 11, x + 6, hy + 3, x + 13, hy + 3, shade(L.main, -0.22));
      p.b(x - 2, hy + 2, 16, 3, shade(L.main, -0.1));
      p.px(x + 4, hy - 3, L.trim); p.px(x + 8, hy - 6, L.trim); p.px(x + 7, hy - 1, '#ffffff'); p.px(x + 3, hy + 1, L.trim);
      p.r(x + 5, hy - 12, 2, 2, L.trim);
      break;
    }
    case 'white_mage': {
      // Hood with the red zigzag trim
      p.b(x - 1, hy - 1, 14, 6, L.main);
      p.r(x - 1, hy + 4, 3, 9, L.main);
      p.r(x + 10, hy + 4, 3, 9, shade(L.main, -0.12));
      if (back) p.r(x - 1, hy - 1, 14, 13, L.main);
      p.tri(x + 3, hy - 3, x + 6, hy - 7, x + 9, hy - 3, L.main);
      for (let i = 0; i < 6; i++) p.r(x - 1 + i * 2 + (i % 2), hy + 4 + (i % 2), 2, 1, L.sub);
      if (back) for (let i = 0; i < 4; i++) p.tri(x + i * 3, hy + 12, x + 1.5 + i * 3, hy + 9, x + 3 + i * 3, hy + 12, L.sub);
      break;
    }
    case 'ninja': {
      p.b(x - 1, hy, 14, 12, L.main);
      if (!back) {
        p.r(x + 1, hy + 5, 10, 4, L.skin);
        if (pose.hurt) { p.r(21, hy + 7, 2, 1, '#1b1f33'); p.r(25, hy + 7, 2, 1, '#1b1f33'); }
        else { p.r(21, hy + 6, 2, 2, '#1b1f33'); p.r(25, hy + 6, 2, 2, '#1b1f33'); }
      }
      p.r(x - 1, hy + 3, 14, 2, L.sub); // headband
      p.r(back ? x + 4 : x + 12, hy + 3, 3, 1, L.sub);
      p.r(back ? x + 5 : x + 13, hy + 4, 3, 1, L.sub); // tails
      break;
    }
    case 'bard': {
      // Wide-brimmed hat with a band and a long plume
      if (!back) { p.r(x, hy + 1, 12, 4, L.hair); p.r(x - 1, hy + 4, 3, 6, L.hair); p.r(x + 10, hy + 4, 3, 6, L.hair); }
      else p.r(x - 1, hy + 2, 14, 10, L.hair);
      p.b(x + 1, hy - 4, 10, 6, L.main);
      p.r(x - 4, hy + 1, 20, 2, shade(L.main, -0.2));
      p.r(x + 1, hy, 10, 1, L.sub);
      p.line(x + 9, hy - 2, x + 15, hy - 9, L.trim);
      p.line(x + 10, hy - 2, x + 16, hy - 8, '#fff7c2');
      break;
    }
    case 'dancer': {
      // Topknot, a jewelled circlet and a silk veil over the mouth
      if (!back) { p.r(x, hy + 1, 12, 3, L.hair); p.r(x - 1, hy + 3, 2, 6, L.hair); p.r(x + 11, hy + 3, 2, 6, L.hair); }
      else p.r(x - 1, hy, 14, 9, L.hair);
      p.b(x - 1, hy - 1, 14, 4, L.hair);
      p.b(x + 4, hy - 6, 4, 6, L.hair);
      p.r(x + 7, hy - 4, 4, 1, L.sub);
      p.r(x - 1, hy + 2, 14, 1, L.trim);
      if (!back) { p.px(x + 6, hy + 2, '#38bdf8'); p.r(x + 1, hy + 9, 10, 3, shade(L.main, 0.3)); }
      else p.r(x + 5, hy + 4, 3, 10, L.hair);
      break;
    }
    case 'tamer': {
      // A wolf-pelt hood, ears up and the pelt's teeth along the brow
      const pelt = L.cape || '#8b8f99';
      if (!back) { p.r(x, hy + 3, 3, 3, L.hair); p.r(x + 9, hy + 3, 3, 3, L.hair); }
      p.b(x - 2, hy - 2, 16, 6, pelt);
      p.r(x - 2, hy + 3, 3, 9, pelt); p.r(x + 11, hy + 3, 3, 9, shade(pelt, -0.15));
      p.tri(x - 1, hy - 1, x + 1, hy - 7, x + 4, hy - 1, pelt);
      p.tri(x + 8, hy - 1, x + 11, hy - 7, x + 13, hy - 1, pelt);
      p.px(x + 1, hy - 4, shade(pelt, -0.4)); p.px(x + 11, hy - 4, shade(pelt, -0.4));
      if (back) { p.r(x - 2, hy - 2, 16, 14, pelt); p.r(x + 5, hy - 2, 2, 14, shade(pelt, 0.2)); }
      else {
        // the wolf's own face on top: eyes, a pale muzzle and a black nose
        p.b(x + 3, hy - 2, 6, 3, shade(pelt, 0.3));
        p.r(x + 5, hy - 2, 2, 1, '#1f2937');
        p.px(x + 2, hy - 1, '#1f2937'); p.px(x + 9, hy - 1, '#1f2937');
        p.r(x - 2, hy + 3, 16, 1, shade(pelt, -0.3)); p.px(x + 2, hy + 4, '#f8fafc'); p.px(x + 9, hy + 4, '#f8fafc');
      }
      break;
    }
    case 'archer': {
      if (!back) { p.r(x, hy + 1, 12, 4, L.hair); p.r(x, hy + 4, 2, 5, L.hair); p.r(x + 10, hy + 4, 2, 5, L.hair); }
      // Feathered cap
      p.b(x - 1, hy - 1, 14, 5, L.main);
      p.tri(x + 12, hy + 1, x + 17, hy - 2, x + 12, hy - 1, L.main);
      p.line(x + 3, hy - 1, x - 2, hy - 7, '#e8e2d0');
      p.line(x + 4, hy - 1, x - 1, hy - 6, '#c9c2ae');
      break;
    }
    case 'spellblade': {
      // Swept silver hair, a ponytail and a thin circlet
      if (!back) {
        p.b(x - 1, hy - 1, 14, 5, L.hair);
        p.r(x - 1, hy + 3, 2, 8, L.hair); p.r(x + 11, hy + 3, 2, 8, L.hair);
        p.tri(x + 2, hy + 4, x + 8, hy + 4, x + 3, hy + 7, L.hair);
      } else {
        p.r(x - 1, hy - 1, 14, 3, shade(L.hair, 0.15));
        p.r(x + 5, hy + 10, 3, 6, L.hair);
      }
      p.r(x - 1, hy + 1, 14, 1, L.trim);
      if (!back) p.px(x + 6, hy + 1, '#ffffff');
      break;
    }
    case 'monk': {
      // Shaved head, topknot and a sash headband
      if (back) p.b(x, hy, 12, 12, L.skin);
      p.b(x + 4, hy - 4, 4, 4, L.hair);
      p.r(x + 5, hy - 1, 2, 1, shade(L.hair, 0.3));
      p.r(x - 1, hy + 3, 14, 2, L.sub);
      p.r(back ? x + 5 : x + 12, hy + 4, 2, 4, L.sub);
      break;
    }
    case 'chemist': {
      // Flat cap with brass goggles pushed up on the brim, and a fringe
      if (!back) { p.r(x, hy + 4, 3, 3, L.hair); p.r(x + 9, hy + 4, 3, 3, L.hair); }
      p.b(x - 1, hy - 1, 14, 5, L.sub);
      p.r(x - 2, hy + 3, 16, 1, shade(L.sub, -0.25));
      if (!back) {
        p.r(x + 1, hy + 1, 4, 3, '#b7791f'); p.r(x + 7, hy + 1, 4, 3, '#b7791f');
        p.r(x + 2, hy + 2, 2, 1, '#9ee7f0'); p.r(x + 8, hy + 2, 2, 1, '#9ee7f0');
        p.r(x + 5, hy + 2, 2, 1, '#6b4a1a');
      } else {
        p.r(x - 1, hy + 2, 14, 1, '#6b4a1a');
      }
      break;
    }
    case 'thief': {
      // Bandana with trailing tails, scruffy fringe
      if (!back) { p.r(x, hy + 4, 3, 3, L.hair); p.r(x + 9, hy + 4, 3, 3, L.hair); }
      p.b(x - 1, hy - 1, 14, 6, L.sub);
      p.r(x - 1, hy + 4, 14, 1, shade(L.sub, -0.25));
      p.px(x + 3, hy, shade(L.sub, 0.35)); p.px(x + 8, hy + 1, shade(L.sub, 0.35));
      p.r(back ? x + 4 : x + 12, hy + 2, 3, 2, L.sub);
      p.r(back ? x + 5 : x + 14, hy + 4, 2, 3, L.sub);
      break;
    }
    case 'summoner': {
      // Long hair under a horned circlet with a sky gem
      if (!back) { p.r(x, hy + 1, 12, 3, L.hair); p.r(x - 1, hy + 3, 3, 10, L.hair); p.r(x + 10, hy + 3, 3, 10, L.hair); }
      else p.r(x - 1, hy + 2, 14, 12, L.hair);
      p.b(x - 1, hy - 1, 14, 4, L.hair);
      p.r(x - 1, hy + 2, 14, 2, L.sub);
      p.tri(x, hy + 2, x - 3, hy - 6, x + 3, hy + 1, '#e8e2d0');
      p.tri(x + 12, hy + 2, x + 15, hy - 6, x + 9, hy + 1, '#e8e2d0');
      if (!back) p.r(x + 5, hy + 1, 2, 3, L.trim);
      break;
    }
    case 'oracle': {
      // Deep hood with a golden eye on the brow
      p.b(x - 2, hy - 2, 16, 8, L.main);
      p.r(x - 2, hy + 5, 3, 9, L.main);
      p.r(x + 11, hy + 5, 3, 9, shade(L.main, -0.15));
      if (back) p.r(x - 2, hy - 2, 16, 15, L.main);
      else {
        p.r(x + 4, hy + 2, 4, 2, L.trim);
        p.px(x + 5, hy + 2, '#1b1f33'); p.px(x + 6, hy + 3, '#1b1f33');
      }
      p.r(x - 2, hy + 5, 16, 1, L.sub);
      break;
    }
    case 'geomancer': {
      if (!back) { p.r(x, hy + 1, 12, 4, L.hair); p.r(x - 1, hy + 4, 3, 7, L.hair); p.r(x + 10, hy + 4, 3, 7, L.hair); }
      p.b(x - 1, hy - 1, 14, 4, L.hair);
      p.r(x - 1, hy + 2, 14, 2, L.sub); // circlet
      p.r(x + 5, hy + 1, 3, 3, '#34d399');
      p.tri(x - 1, hy + 2, x - 5, hy - 2, x + 1, hy, '#6fbf3a'); // leaves
      p.tri(x + 13, hy + 2, x + 17, hy - 2, x + 11, hy, '#6fbf3a');
      break;
    }
    default: {
      // Squire: tousled hair and a headband
      if (!back) {
        p.b(x - 1, hy - 1, 14, 5, L.hair);
        p.r(x - 1, hy + 3, 3, 6, L.hair); p.r(x + 10, hy + 3, 3, 6, L.hair);
        p.r(x + 2, hy + 4, 3, 1, L.hair); p.r(x + 6, hy + 4, 2, 2, L.hair);
      } else {
        p.r(x - 1, hy - 1, 14, 2, shade(L.hair, 0.15));
      }
      p.px(x + 3, hy - 2, L.hair); p.px(x + 8, hy - 2, L.hair);
      p.r(x - 1, hy + 2, 14, 2, L.sub);
      if (back) p.r(x + 4, hy + 4, 2, 4, L.sub);
    }
  }
}

/** Body, arms and legs for front (S) or back (N) views. */
function bodyFrontBack(p: Painter, job: string, L: Look, pose: Pose, back: boolean): void {
  const ty = 19 + pose.bob;
  const robe = L.body === 'robe';
  // Legs (skipped under robes)
  const liftL = pose.stride === 1 ? 2 : 0;
  const liftR = pose.stride === -1 ? 2 : 0;
  if (!robe) {
    p.b(18, ty + 11, 5, 11 - liftL, L.pants);
    p.b(25, ty + 11, 5, 11 - liftR, L.pants);
    p.b(17, 40 - liftL, 6, 4, L.boots);
    p.b(25, 40 - liftR, 6, 4, L.boots);
  } else {
    p.b(18, 40 - liftL, 5, 4, L.boots);
    p.b(25, 40 - liftR, 5, 4, L.boots);
  }

  // Cape behind (visible from the back)
  if (L.cape && back) p.b(15, ty + 1, 18, 19, L.cape);

  // Torso
  if (robe) {
    p.b(16, ty, 16, 12, L.main);
    p.b(15, ty + 11, 18, 40 - (ty + 11) - (pose.stride ? 1 : 0), L.main);
    p.r(15, 40 - (pose.stride ? 1 : 0), 18, 2, L.sub);
    p.r(23, ty + 1, 2, 10, back ? shade(L.main, -0.1) : L.sub); // front placket
    p.r(16, ty + 9, 16, 2, L.sub);
  } else {
    p.b(16, ty, 16, 12, L.main);
    if (L.body === 'armor') {
      p.b(18, ty + 1, 12, 7, L.metal); // breastplate
      p.px(19, ty + 2, shade(L.metal, 0.5));
      p.r(23, ty + 2, 2, 5, shade(L.metal, -0.15));
    } else if (job === 'ninja') {
      p.line(17, ty + 1, 30, ty + 8, L.sub, 2);
    } else if (!back) {
      p.r(21, ty, 6, 3, shade(L.main, 0.15)); // collar
      p.r(23, ty + 1, 2, 2, L.skin);
    }
    p.r(16, ty + 9, 16, 2, '#4a2e1c'); // belt
    p.r(23, ty + 9, 2, 2, L.trim);
  }
  if (job === 'archer' && back) {
    p.b(26, ty - 2, 4, 12, '#6b4423'); // quiver
    p.r(26, ty - 4, 1, 2, '#e8e2d0'); p.r(28, ty - 5, 1, 3, '#e8e2d0');
  }

  // Arms: swing opposite to the legs while walking
  const swingL = pose.stride * 2;
  const swingR = -pose.stride * 2;
  const sleeve = robe ? L.main : L.body === 'armor' ? L.sub : shade(L.main, -0.08);
  p.b(12, ty + 1 + swingL, 4, 9, sleeve);
  p.b(12, ty + 10 + swingL, 4, 3, back ? sleeve : L.skin);
  const rightY = pose.attack ? ty - 3 : ty + 1 + swingR;
  p.b(32, rightY, 4, 9, sleeve);
  p.b(32, rightY + 9, 4, 3, L.skin);
  if (L.body === 'armor') {
    p.b(11, ty - 1, 6, 4, L.metal);
    p.b(31, ty - 1, 6, 4, L.metal);
  }
  if (L.shield) {
    const sx = back ? 30 : 8, sy = ty + 3 + swingL;
    p.b(sx, sy, 9, 11, L.sub);
    p.r(sx + 1, sy + 1, 7, 1, L.trim);
    p.r(sx + 4, sy + 3, 1, 6, L.trim);
    p.r(sx + 2, sy + 5, 5, 1, L.trim);
  }
}

/** Weapon held in a hand at (hx, hy). dir: 1 = right, -1 = left. */
function weapon(p: Painter, L: Look, hx: number, hy: number, pose: Pose, view: 'front' | 'side'): void {
  const strike = pose.attack;
  const wood = '#7a4a22';
  const steel = '#dfe6ef';
  switch (L.weapon) {
    case 'sword':
    case 'broadsword': {
      const len = L.weapon === 'broadsword' ? 15 : 12;
      const w = L.weapon === 'broadsword' ? 3 : 2;
      if (strike && view === 'side') {
        p.r(hx, hy - 1, 2, 4, wood);
        p.r(hx + 2, hy - 3, 1, 7, L.trim);
        p.r(hx + 3, hy, len, w, steel);
        p.r(hx + 3, hy, len, 1, '#ffffff');
        p.px(hx + 3 + len, hy + (w > 2 ? 1 : 0), steel);
      } else if (strike) {
        p.line(hx + 1, hy, hx + 10, hy - 11, steel, w);
        p.line(hx + 1, hy, hx + 9, hy - 11, '#ffffff');
        p.r(hx - 2, hy, 6, 1, L.trim);
      } else {
        p.r(hx, hy, 2, 4, wood);
        p.r(hx - 2, hy - 1, 6, 1, L.trim);
        p.r(hx + (w > 2 ? -1 : 0), hy - 1 - len, w, len, steel);
        p.r(hx + (w > 2 ? -1 : 0), hy - 1 - len, 1, len, '#ffffff');
      }
      break;
    }
    case 'spear': {
      if (strike) {
        p.r(hx - 10, hy, 26, 2, wood);
        p.tri(hx + 16, hy - 2, hx + 22, hy + 1, hx + 16, hy + 4, steel);
        p.r(hx + 14, hy - 2, 2, 6, L.trim);
      } else {
        p.r(hx, hy - 30 + 10, 2, 32, wood);
        p.tri(hx - 2, hy - 20, hx + 1, hy - 27, hx + 4, hy - 20, steel);
        p.r(hx - 2, hy - 20, 6, 2, L.trim);
      }
      break;
    }
    case 'bow': {
      const bx = view === 'side' ? hx + 2 : hx;
      if (strike && view === 'side') {
        p.line(bx + 3, hy - 9, bx + 6, hy, wood, 2);
        p.line(bx + 6, hy, bx + 3, hy + 9, wood, 2);
        p.line(bx + 3, hy - 9, bx - 4, hy, '#e8e2d0');
        p.line(bx - 4, hy, bx + 3, hy + 9, '#e8e2d0');
        p.r(bx - 4, hy, 14, 1, '#c9c2ae');
        p.tri(bx + 10, hy - 1, bx + 13, hy, bx + 10, hy + 2, steel);
      } else {
        p.line(bx, hy - 11, bx + 3, hy - 4, wood, 2);
        p.r(bx + 3, hy - 4, 2, 8, wood);
        p.line(bx + 3, hy + 4, bx, hy + 11, wood, 2);
        p.r(bx, hy - 10, 1, 21, '#e8e2d0');
      }
      break;
    }
    case 'staff':
    case 'rod':
    case 'hourglass':
    case 'gaia':
    case 'horn':
    case 'orb': {
      const tilt = strike ? (view === 'side' ? 6 : 5) : 0;
      const top = hy - (L.weapon === 'rod' || L.weapon === 'orb' ? 12 : 18);
      const shaft = L.weapon === 'staff' ? '#c08a3e' : L.weapon === 'rod' ? '#5b3a1e' : L.weapon === 'hourglass' ? '#c99a2e' : L.weapon === 'horn' ? '#3f2a1a' : L.weapon === 'orb' ? '#4a3a6a' : '#6b4423';
      p.line(hx, hy + 6, hx + tilt, top, shaft, 2);
      const gx = hx + tilt, gy = top;
      if (L.weapon === 'staff') {
        p.r(gx - 2, gy - 4, 6, 1, L.trim); p.r(gx - 2, gy - 4, 1, 4, L.trim); p.r(gx + 3, gy - 4, 1, 4, L.trim);
        p.r(gx, gy - 3, 2, 2, '#7dd3fc');
      } else if (L.weapon === 'rod') {
        p.b(gx - 1, gy - 4, 4, 4, '#ef4444'); p.px(gx, gy - 3, '#fecaca');
      } else if (L.weapon === 'horn') {
        // A curled horn crowning the staff, with a spirit flame inside
        p.r(gx - 3, gy - 3, 2, 4, '#e8e2d0'); p.r(gx - 4, gy - 6, 2, 4, '#e8e2d0'); p.r(gx - 2, gy - 8, 3, 2, '#e8e2d0');
        p.r(gx + 1, gy - 7, 2, 2, '#d6cdb8');
        p.r(gx, gy - 4, 2, 2, L.trim);
      } else if (L.weapon === 'orb') {
        p.b(gx - 2, gy - 6, 6, 6, '#a78bfa'); p.r(gx - 1, gy - 5, 2, 2, '#ede9fe');
        p.r(gx - 2, gy, 6, 1, L.trim);
      } else if (L.weapon === 'hourglass') {
        p.r(gx - 2, gy - 6, 6, 1, L.trim); p.r(gx - 2, gy, 6, 1, L.trim);
        p.tri(gx - 1, gy - 5, gx + 4, gy - 5, gx + 1.5, gy - 2.5, '#7dd3fc');
        p.tri(gx - 1, gy, gx + 4, gy, gx + 1.5, gy - 2.5, '#38bdf8');
      } else {
        p.r(gx - 2, gy - 1, 2, 2, shaft); p.r(gx + 2, gy - 2, 2, 2, shaft);
        p.b(gx - 1, gy - 5, 4, 4, '#34d399'); p.px(gx, gy - 4, '#d1fae5');
      }
      if (strike) {
        p.px(gx - 3, gy - 7, '#fff7c2'); p.px(gx + 5, gy - 6, '#fff7c2'); p.px(gx + 1, gy - 9, '#ffffff');
      }
      break;
    }
    case 'lute': {
      // A round-bodied lute; notes rise when it's played
      const tilt = strike ? 3 : 0;
      p.b(hx - 3, hy - 1, 7, 7, '#a16207');
      p.r(hx - 2, hy, 5, 1, shade('#a16207', 0.3));
      p.px(hx, hy + 2, '#3b2414');
      p.line(hx + 1, hy - 1, hx + 4 + tilt, hy - 10, '#6b4423', 2);
      p.r(hx + 3 + tilt, hy - 12, 3, 2, '#3b2414');
      if (strike) { p.px(hx + 6, hy - 6, '#fff7c2'); p.px(hx + 8, hy - 9, '#fde68a'); p.px(hx + 5, hy - 13, '#ffffff'); }
      break;
    }
    case 'whip': {
      // A braided whip: coiled at the hip, cracking out when it strikes (0.28.0)
      const leather = '#6b4423';
      if (strike && view === 'side') {
        p.r(hx, hy - 1, 2, 4, wood);
        p.line(hx + 2, hy, hx + 10, hy - 5, leather, 2);
        p.line(hx + 10, hy - 5, hx + 18, hy - 2, leather);
        p.line(hx + 18, hy - 2, hx + 22, hy + 2, leather);
        p.px(hx + 23, hy + 2, '#fff7c2'); p.px(hx + 24, hy, '#ffffff'); p.px(hx + 22, hy + 4, '#fff7c2');
      } else if (strike) {
        p.r(hx, hy - 1, 2, 4, wood);
        p.line(hx + 1, hy - 1, hx + 6, hy - 10, leather, 2);
        p.line(hx + 6, hy - 10, hx + 13, hy - 8, leather);
        p.px(hx + 14, hy - 8, '#fff7c2'); p.px(hx + 13, hy - 10, '#ffffff');
      } else {
        p.r(hx, hy - 3, 2, 5, wood);
        p.line(hx + 1, hy + 2, hx + 3, hy + 6, leather, 2);
        p.line(hx + 3, hy + 6, hx - 2, hy + 9, leather, 2);
        p.line(hx - 2, hy + 9, hx + 2, hy + 12, leather);
      }
      break;
    }
    case 'fists': {
      // Knuckle wraps over the hand
      p.r(hx - 1, hy - 1, 4, 3, L.trim);
      p.r(hx - 1, hy - 1, 4, 1, shade(L.trim, 0.3));
      if (strike) { p.px(hx + 4, hy - 2, '#fff7c2'); p.px(hx + 5, hy + 1, '#fff7c2'); }
      break;
    }
    case 'dagger':
    case 'daggers': {
      if (strike && view === 'side') {
        p.r(hx + 1, hy, 9, 2, steel); p.r(hx + 1, hy, 9, 1, '#ffffff');
      } else if (strike) {
        p.line(hx + 1, hy, hx + 7, hy - 7, steel, 2);
      } else {
        p.r(hx + 1, hy - 6, 2, 7, steel); p.r(hx, hy, 4, 1, L.trim);
      }
      break;
    }
  }
}

function drawFront(p: Painter, job: string, L: Look, pose: Pose, back: boolean): void {
  const hy = 7 + pose.bob;
  // Weapon behind the body from the back view
  const weaponFront = () => {
    const rightY = pose.attack ? 19 + pose.bob - 3 + 10 : 19 + pose.bob + 1 - pose.stride * 2 + 10;
    if (L.weapon === 'bow') weapon(p, L, back ? 33 : 12, 19 + pose.bob + 11 + pose.stride * 2, pose, 'front');
    else if (L.weapon === 'daggers') {
      weapon(p, L, 33, rightY, pose, 'front');
      weapon(p, L, 12, 19 + pose.bob + 11 + pose.stride * 2, { ...pose, attack: false }, 'front');
    } else weapon(p, L, back ? 12 : 33, rightY, pose, 'front');
  };
  if (back) weaponFront();
  bodyFrontBack(p, job, L, pose, back);
  headFront(p, job, L, hy, pose, back);
  if (!back) weaponFront();
}

function drawSide(p: Painter, job: string, L: Look, pose: Pose): void {
  // Facing right (E). The west view is a mirror image.
  const lean = pose.attack ? 1 : pose.hurt ? -2 : 0;
  const hy = 7 + pose.bob;
  const ty = 19 + pose.bob;
  const robe = L.body === 'robe';
  const st = pose.stride;

  // Far leg then near leg
  const legs = (near: boolean) => {
    const off = (near ? st : -st) * 3;
    const x = 21 + off;
    if (!robe) p.b(x, ty + 11, 5, 11 - (off < 0 ? 1 : 0), near ? L.pants : shade(L.pants, -0.2));
    p.b(x - 1, 40 - (off < 0 ? 1 : 0), 7, 4, near ? L.boots : shade(L.boots, -0.2));
  };
  legs(false);
  // Far arm and cape
  if (L.cape) p.b(16 + lean, ty + 1, 6, 17, L.cape);
  p.b(23 + lean - st * 2, ty + 1, 4, 10, shade(robe ? L.main : L.body === 'armor' ? L.sub : L.main, -0.25));
  legs(true);

  // Torso
  if (robe) {
    p.b(17 + lean, ty, 13, 12, L.main);
    p.b(16 + lean, ty + 11, 15, 40 - (ty + 11) - (st ? 1 : 0), L.main);
    p.r(16 + lean, 40 - (st ? 1 : 0), 15, 2, L.sub);
    p.r(17 + lean, ty + 9, 13, 2, L.sub);
  } else {
    p.b(17 + lean, ty, 13, 12, L.main);
    if (L.body === 'armor') p.b(22 + lean, ty + 1, 8, 7, L.metal);
    if (job === 'ninja') p.line(17 + lean, ty + 2, 29 + lean, ty + 8, L.sub, 2);
    p.r(17 + lean, ty + 9, 13, 2, '#4a2e1c');
    p.r(28 + lean, ty + 9, 2, 2, L.trim);
  }
  if (job === 'archer') p.b(15 + lean, ty - 1, 3, 11, '#6b4423');

  // Head (facing right)
  const hx = 18 + lean;
  if (job === 'black_mage') {
    p.r(hx + 2, hy + 3, 10, 9, '#101425');
    p.r(hx + 8, hy + 7, 2, 2, pose.hurt ? '#a16207' : '#ffd84a');
  } else {
    p.b(hx, hy + 1, 12, 11, L.skin);
    p.px(hx + 12, hy + 8, L.skin); // nose
    if (pose.hurt) p.r(hx + 8, hy + 7, 2, 1, '#2a1a12');
    else { p.r(hx + 8, hy + 6, 2, 3, '#1b1f33'); p.px(hx + 8, hy + 6, '#ffffff'); }
  }
  switch (job) {
    case 'paladin':
    case 'knight':
      p.b(hx, hy - 1, 13, 13, L.metal);
      p.r(hx + 6, hy + 6, 7, 2, '#141826');
      p.r(hx + 4, hy - 5, 2, 5, L.sub); p.r(hx + 1, hy - 4, 4, 2, shade(L.sub, 0.2));
      break;
    case 'dragoon':
      p.b(hx, hy - 1, 13, 13, L.main);
      p.tri(hx + 2, hy + 2, hx - 4, hy - 5, hx + 4, hy - 1, L.metal);
      p.r(hx + 7, hy + 6, 6, 2, '#141826');
      p.r(hx + 12, hy + 6, 2, 5, L.main);
      break;
    case 'black_mage':
      p.tri(hx + 4, hy - 12, hx - 1, hy + 2, hx + 13, hy + 2, '#a8641f');
      p.b(hx - 3, hy + 2, 19, 3, '#8a5218');
      break;
    case 'time_mage':
      p.r(hx + 1, hy + 1, 6, 6, L.hair);
      p.tri(hx + 4, hy - 11, hx - 1, hy + 3, hx + 13, hy + 3, L.main);
      p.b(hx - 2, hy + 2, 17, 3, shade(L.main, -0.1));
      p.px(hx + 5, hy - 4, L.trim); p.px(hx + 3, hy, L.trim);
      break;
    case 'white_mage':
      p.b(hx, hy - 1, 9, 13, L.main);
      p.tri(hx + 2, hy - 1, hx - 1, hy - 6, hx + 6, hy - 1, L.main);
      p.r(hx + 8, hy - 1, 4, 3, L.main);
      for (let i = 0; i < 3; i++) p.r(hx + 6 + i * 2, hy + 2 + (i % 2), 2, 1, L.sub);
      break;
    case 'ninja':
      p.b(hx, hy, 13, 12, L.main);
      p.r(hx + 7, hy + 5, 6, 4, L.skin);
      p.r(hx + 9, hy + 6, 2, 2, '#1b1f33');
      p.r(hx, hy + 3, 13, 2, L.sub);
      p.r(hx - 4, hy + 3, 4, 1, L.sub); p.r(hx - 5, hy + 4, 4, 1, L.sub);
      break;
    case 'bard':
      p.r(hx + 1, hy + 1, 6, 9, L.hair);
      p.b(hx + 1, hy - 4, 9, 6, L.main);
      p.r(hx - 3, hy + 1, 18, 2, shade(L.main, -0.2));
      p.r(hx + 1, hy, 9, 1, L.sub);
      p.line(hx + 2, hy - 2, hx - 4, hy - 9, L.trim);
      break;
    case 'tamer': {
      const pelt = L.cape || '#8b8f99';
      p.b(hx - 1, hy - 2, 14, 6, pelt);
      p.r(hx - 2, hy + 2, 5, 10, pelt);
      p.tri(hx + 3, hy - 1, hx + 5, hy - 7, hx + 8, hy - 1, pelt);
      p.px(hx + 5, hy - 4, shade(pelt, -0.4));
      p.b(hx + 9, hy - 2, 5, 3, shade(pelt, 0.3)); p.px(hx + 13, hy - 2, '#1f2937'); p.px(hx + 8, hy - 1, '#1f2937');
      p.r(hx + 8, hy + 3, 5, 1, shade(pelt, -0.3)); p.px(hx + 11, hy + 4, '#f8fafc');
      break;
    }
    case 'dancer':
      p.b(hx, hy - 1, 12, 4, L.hair);
      p.r(hx + 1, hy + 1, 4, 6, L.hair);
      p.b(hx + 3, hy - 6, 4, 6, L.hair);
      p.r(hx - 2, hy - 3, 3, 11, L.hair);
      p.r(hx, hy + 2, 13, 1, L.trim);
      p.r(hx + 8, hy + 8, 5, 3, shade(L.main, 0.3));
      break;
    case 'archer':
      p.r(hx + 1, hy + 1, 6, 9, L.hair);
      p.b(hx, hy - 1, 13, 5, L.main);
      p.tri(hx + 1, hy + 1, hx - 5, hy - 2, hx + 1, hy - 1, L.main);
      p.line(hx + 3, hy - 1, hx - 3, hy - 7, '#e8e2d0');
      break;
    case 'spellblade':
      p.b(hx, hy - 1, 12, 5, L.hair);
      p.r(hx, hy + 3, 5, 9, L.hair);
      p.r(hx - 2, hy + 8, 3, 6, L.hair);
      p.r(hx, hy + 1, 13, 1, L.trim);
      break;
    case 'monk':
      p.b(hx + 3, hy - 4, 4, 4, L.hair);
      p.r(hx, hy + 3, 13, 2, L.sub);
      p.r(hx - 2, hy + 4, 2, 4, L.sub);
      break;
    case 'chemist':
      p.b(hx, hy - 1, 13, 5, L.sub);
      p.r(hx - 2, hy + 3, 15, 1, shade(L.sub, -0.25));
      p.r(hx + 1, hy + 4, 4, 4, L.hair);
      p.r(hx + 6, hy + 1, 4, 3, '#b7791f'); p.r(hx + 7, hy + 2, 2, 1, '#9ee7f0');
      break;
    case 'thief':
      p.b(hx, hy - 1, 13, 6, L.sub);
      p.r(hx + 1, hy + 4, 4, 4, L.hair);
      p.r(hx - 3, hy + 2, 3, 2, L.sub); p.r(hx - 5, hy + 4, 3, 2, L.sub);
      break;
    case 'summoner':
      p.r(hx + 1, hy + 1, 6, 12, L.hair);
      p.b(hx, hy - 1, 13, 4, L.hair);
      p.r(hx, hy + 2, 13, 2, L.sub);
      p.tri(hx + 6, hy + 2, hx + 4, hy - 6, hx + 9, hy + 1, '#e8e2d0');
      break;
    case 'oracle':
      p.b(hx - 1, hy - 2, 11, 15, L.main);
      p.r(hx + 9, hy - 2, 4, 4, L.main);
      p.r(hx + 10, hy + 2, 2, 2, L.trim);
      break;
    case 'geomancer':
      p.r(hx + 1, hy + 1, 6, 11, L.hair);
      p.b(hx, hy - 1, 13, 4, L.hair);
      p.r(hx, hy + 2, 13, 2, L.sub);
      p.r(hx + 9, hy + 1, 3, 3, '#34d399');
      p.tri(hx, hy + 2, hx - 4, hy - 2, hx + 2, hy, '#6fbf3a');
      break;
    default:
      p.b(hx, hy - 1, 12, 5, L.hair);
      p.r(hx, hy + 3, 6, 7, L.hair);
      p.px(hx + 4, hy - 2, L.hair); p.px(hx + 8, hy - 2, L.hair);
      p.r(hx, hy + 2, 13, 2, L.sub);
      p.r(hx - 3, hy + 3, 3, 1, L.sub);
  }

  // Near arm + weapon
  const sleeve = robe ? L.main : L.body === 'armor' ? L.sub : shade(L.main, -0.08);
  if (pose.attack) {
    p.b(24 + lean, ty + 2, 8, 4, sleeve);
    p.b(31 + lean, ty + 2, 3, 4, L.skin);
    weapon(p, L, 32 + lean, ty + 3, pose, 'side');
  } else {
    const swing = -st * 3;
    p.b(22 + lean + swing, ty + 1, 4, 9, sleeve);
    p.b(22 + lean + swing, ty + 10, 4, 3, L.skin);
    if (L.body === 'armor') p.b(21 + lean, ty - 1, 6, 4, L.metal);
    weapon(p, L, 23 + lean + swing, ty + 11, pose, 'side');
  }
  if (L.shield && !pose.attack) {
    p.b(26 + lean, ty + 2, 4, 11, L.sub);
    p.r(27 + lean, ty + 3, 2, 9, L.trim);
  }
}

// ---------------------------------------------------------------------------
// Public sprite API
// ---------------------------------------------------------------------------

const spriteCache = new Map<string, HTMLCanvasElement>();

/** A 48×48 canvas for a job, view and frame (cached). */
export function drawSprite(job: string, view: SpriteView, enemy: boolean, frame: SpriteFrame = 'idle0'): HTMLCanvasElement {
  const key = `${job}|${view}|${enemy ? 'e' : 'p'}|${frame}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;

  // Monsters have bodies of their own (0.26.0)
  if (isMonsterArt(job) && view !== 'W') {
    const m = drawMonsterSprite(job, view, frame);
    spriteCache.set(key, m);
    return m;
  }

  if (view === 'W') {
    const src = drawSprite(job, 'E', enemy, frame);
    const c = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
    const ctx = c.getContext('2d')!;
    ctx.translate(SPRITE_SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    spriteCache.set(key, c);
    return c;
  }

  const L = lookFor(job, enemy);
  const pose = poseFor(frame);
  const layer = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const p = new Painter(layer.getContext('2d')!);
  if (view === 'E') drawSide(p, job, L, pose);
  else drawFront(p, job, L, pose, view === 'N');
  outline(layer);

  const c = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(24, 44.5, 11, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(layer, 0, 0);
  spriteCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------------------
// Portraits
// ---------------------------------------------------------------------------

interface Face {
  job: string;
  enemy: boolean;
  hair: string;
  hairStyle: 'short' | 'long' | 'spiky' | 'braid' | 'swept' | 'none';
  skin: string;
  eyes: string;
  brows?: string;
  scar?: boolean;
  freckles?: boolean;
  beard?: string;
  helmetOff?: boolean;
}

const NAMED: Record<string, Face> = {
  rowan: { job: 'squire', enemy: false, hair: '#8a4b1f', hairStyle: 'swept', skin: '#f2c79a', eyes: '#2f6fd6' },
  maren: { job: 'knight', enemy: false, hair: '#e2bf5c', hairStyle: 'long', skin: '#f5d2ae', eyes: '#3d7a5a', helmetOff: true },
  tobin: { job: 'archer', enemy: false, hair: '#c2552b', hairStyle: 'short', skin: '#f3c9a1', eyes: '#5a3a1e', freckles: true },
  corvin: { job: 'dragoon', enemy: false, hair: '#2c3446', hairStyle: 'spiky', skin: '#d9a77c', eyes: '#1f78b4', scar: true, helmetOff: true },
  bria: { job: 'geomancer', enemy: false, hair: '#5f8f2a', hairStyle: 'braid', skin: '#c99068', eyes: '#7a4a1e' }
};

/** Every portrait id the game knows: named characters, ally jobs and `foe_<job>` for enemies. */
export function portraitIds(jobs: string[]): string[] {
  return [...Object.keys(NAMED), ...jobs, ...jobs.map((j) => `foe_${j}`)];
}

function faceFor(id: string): Face {
  if (NAMED[id]) return NAMED[id];
  const enemy = id.startsWith('foe_');
  const job = enemy ? id.slice(4) : id;
  const L = lookFor(job, enemy);
  return {
    job, enemy,
    hair: enemy ? '#3a2a24' : L.hair,
    hairStyle: !enemy && job === 'dancer' ? 'long' : 'short',
    skin: enemy ? '#d8a47e' : SKIN,
    eyes: enemy ? '#7a1f1f' : '#2f4f8f',
    brows: enemy ? '#1a1414' : undefined,
    beard: enemy && (job === 'knight' || job === 'squire') ? '#3a2a24' : undefined
  };
}

function drawPortrait(id: string): HTMLCanvasElement {
  const monster = id.startsWith('foe_') ? id.slice(4) : id;
  if (isMonsterArt(monster)) return drawMonsterPortrait(monster);
  const F = faceFor(id);
  const L = lookFor(F.job, F.enemy);
  const S = PORTRAIT_SIZE;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d')!;

  // Backdrop: team colour with a soft vignette and pixel dither
  const bgTop = F.enemy ? '#4a1420' : '#173257';
  const bgBot = F.enemy ? '#1c0a10' : '#0b1626';
  for (let y = 0; y < S; y += 2) {
    const k = y / S;
    const [r1, g1, b1] = rgb(bgTop), [r2, g2, b2] = rgb(bgBot);
    ctx.fillStyle = hex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
    ctx.fillRect(0, y, S, 2);
  }
  ctx.fillStyle = F.enemy ? 'rgba(255,120,120,0.08)' : 'rgba(150,200,255,0.08)';
  for (let y = 0; y < S; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < S; x += 4) ctx.fillRect(x, y, 1, 1);

  const layer = makeCanvas(S, S);
  const lctx = layer.getContext('2d')!;
  lctx.translate(0, 5); // room for tall hats and plumes
  const p = new Painter(lctx);

  // Shoulders and outfit
  const sleeve = L.body === 'armor' ? L.metal : L.main;
  p.b(8, 48, 48, 16, sleeve);
  if (L.body === 'armor') {
    p.b(4, 46, 14, 10, L.metal); p.b(46, 46, 14, 10, L.metal);
    p.b(18, 50, 28, 14, L.sub);
    p.r(30, 52, 4, 12, L.trim);
  } else if (L.body === 'robe') {
    p.r(28, 48, 8, 16, L.sub);
    p.r(8, 48, 48, 2, L.trim);
  } else {
    p.b(22, 46, 20, 6, shade(L.main, 0.12)); // collar
    if (F.job === 'archer') p.line(10, 50, 50, 64, '#6b4423', 3);
    if (F.job === 'ninja') p.line(12, 50, 52, 62, L.sub, 3);
    if (F.job === 'monk') { p.tri(22, 46, 32, 58, 42, 46, shade(L.main, -0.15)); p.r(8, 60, 48, 4, L.sub); }
    if (F.job === 'thief') p.line(14, 50, 46, 64, '#4a2e1c', 3);
    if (F.job === 'bard') { p.line(10, 50, 50, 64, '#8b5a2b', 3); p.r(8, 48, 48, 2, L.sub); }
    if (F.job === 'dancer') { p.tri(22, 46, 32, 56, 42, 46, shade(L.main, -0.2)); p.r(8, 60, 48, 4, L.sub); }
    if (F.job === 'tamer') { p.b(6, 45, 52, 8, L.cape!); p.r(20, 45, 24, 2, shade(L.cape!, -0.25)); p.line(14, 52, 46, 64, '#6b4423', 3); }
  }
  // Neck
  p.b(27, 41, 10, 8, shade(F.skin, -0.18));

  // Long hair behind the head
  if (F.hairStyle === 'long' || F.hairStyle === 'braid') {
    p.b(15, 14, 34, F.hairStyle === 'long' ? 36 : 26, shade(F.hair, -0.15));
  }
  if (F.hairStyle === 'braid') p.b(44, 34, 6, 18, F.hair);

  // Head
  const hx = 18, hy = 12;
  p.b(hx, hy + 2, 28, 30, F.skin);
  p.r(hx + 2, hy + 28, 24, 3, shade(F.skin, -0.12)); // jaw shadow
  p.r(hx - 2, hy + 14, 3, 7, shade(F.skin, -0.1)); p.r(hx + 27, hy + 14, 3, 7, shade(F.skin, -0.2)); // ears

  // Eyes, brows, nose, mouth
  const ey = hy + 17;
  for (const ex of [hx + 5, hx + 17]) {
    p.r(ex, ey, 6, 4, '#ffffff');
    p.r(ex + 2, ey, 3, 4, F.eyes);
    p.r(ex + 3, ey + 1, 1, 2, '#0b0f1c');
    p.px(ex + 2, ey, '#ffffff');
    p.r(ex - 1, ey - 1, 8, 1, shade(F.skin, -0.45));
    p.r(ex, ey - 4, 6, 2, F.brows || shade(F.hair, -0.25));
  }
  if (F.enemy) { p.px(hx + 10, ey - 3, F.brows || '#1a1414'); p.px(hx + 17, ey - 3, F.brows || '#1a1414'); }
  p.r(hx + 13, ey + 5, 2, 4, shade(F.skin, -0.2));
  p.r(hx + 11, ey + 10, 6, 1, shade(F.skin, -0.4));
  if (!F.enemy) p.r(hx + 12, ey + 11, 4, 1, shade(F.skin, -0.2));
  if (F.freckles) for (const [x, y] of [[hx + 5, ey + 6], [hx + 7, ey + 7], [hx + 20, ey + 6], [hx + 22, ey + 7], [hx + 6, ey + 8], [hx + 21, ey + 8]]) p.px(x, y, '#c0753f');
  if (F.scar) p.line(hx + 19, ey - 5, hx + 23, ey + 7, '#b5654a');
  if (F.beard) {
    p.b(hx + 2, ey + 8, 24, 9, F.beard);
    p.r(hx + 10, ey + 10, 8, 2, shade(F.skin, -0.4));
  }

  // Hair on top
  const hc = F.hair;
  switch (F.hairStyle) {
    case 'swept':
      p.b(hx - 2, hy, 32, 9, hc);
      p.tri(hx + 4, hy + 8, hx + 22, hy + 8, hx + 18, hy + 15, hc);
      p.r(hx - 2, hy + 8, 4, 10, hc); p.r(hx + 26, hy + 8, 4, 8, hc);
      p.r(hx + 6, hy + 2, 10, 1, shade(hc, 0.3));
      break;
    case 'long':
      p.b(hx - 3, hy - 1, 34, 10, hc);
      p.r(hx - 3, hy + 8, 5, 26, hc); p.r(hx + 26, hy + 8, 5, 26, hc);
      p.tri(hx + 2, hy + 8, hx + 14, hy + 8, hx + 4, hy + 13, hc);
      p.r(hx + 4, hy + 1, 14, 1, shade(hc, 0.35));
      break;
    case 'spiky':
      p.b(hx - 2, hy + 1, 32, 8, hc);
      for (let i = 0; i < 6; i++) p.tri(hx - 2 + i * 6, hy + 2, hx + 1 + i * 6, hy - 6 + (i % 2) * 3, hx + 4 + i * 6, hy + 2, hc);
      p.tri(hx + 6, hy + 8, hx + 12, hy + 8, hx + 8, hy + 14, hc);
      p.r(hx - 2, hy + 8, 3, 8, hc); p.r(hx + 27, hy + 8, 3, 8, hc);
      break;
    case 'braid':
      p.b(hx - 2, hy, 32, 9, hc);
      p.r(hx - 2, hy + 8, 4, 14, hc); p.r(hx + 26, hy + 8, 4, 14, hc);
      for (let i = 0; i < 3; i++) p.r(hx + 6 + i * 6, hy + 8, 4, 3, hc);
      break;
    case 'short':
      p.b(hx - 1, hy, 30, 8, hc);
      p.r(hx - 1, hy + 7, 3, 8, hc); p.r(hx + 26, hy + 7, 3, 8, hc);
      for (let i = 0; i < 4; i++) p.r(hx + 4 + i * 6, hy + 7, 4, 3, hc);
      break;
  }

  // Headgear
  const metal = L.metal;
  if (!F.helmetOff) {
    switch (F.job) {
      case 'paladin':
      case 'knight':
        p.b(hx - 3, hy - 2, 34, 18, metal);
        p.r(hx + 1, ey - 1, 26, 4, '#141826');
        p.r(hx + 12, ey + 2, 4, 9, '#141826');
        p.r(hx - 3, hy + 15, 34, 2, shade(metal, -0.3));
        p.r(hx + 12, hy - 10, 4, 9, L.sub); p.r(hx + 9, hy - 9, 10, 3, shade(L.sub, 0.2));
        break;
      case 'dragoon':
        p.b(hx - 3, hy - 2, 34, 17, L.main);
        p.tri(hx - 3, hy + 6, hx - 12, hy - 8, hx - 1, hy, metal);
        p.tri(hx + 31, hy + 6, hx + 40, hy - 8, hx + 29, hy, metal);
        p.r(hx + 1, ey - 1, 26, 4, '#141826');
        break;
      case 'black_mage':
        p.r(hx, hy + 2, 28, 30, '#101425');
        p.r(hx + 7, ey, 4, 4, '#ffd84a'); p.r(hx + 17, ey, 4, 4, '#ffd84a');
        p.tri(hx + 14, hy - 14, hx - 2, hy + 6, hx + 30, hy + 6, '#a8641f');
        p.tri(hx + 14, hy - 14, hx + 14, hy + 6, hx + 30, hy + 6, shade('#a8641f', -0.2));
        p.b(hx - 10, hy + 5, 48, 5, '#8a5218');
        p.r(hx + 1, hy + 3, 26, 2, L.trim);
        break;
      case 'time_mage':
        p.tri(hx + 14, hy - 14, hx - 3, hy + 6, hx + 31, hy + 6, L.main);
        p.tri(hx + 14, hy - 14, hx + 14, hy + 6, hx + 31, hy + 6, shade(L.main, -0.22));
        p.b(hx - 6, hy + 4, 40, 5, shade(L.main, -0.1));
        for (const [x, y] of [[hx + 10, hy - 4], [hx + 18, hy - 1], [hx + 14, hy - 9], [hx + 6, hy + 2]]) { p.px(x, y, L.trim); p.px(x + 1, y, '#ffffff'); }
        break;
      case 'white_mage':
        p.b(hx - 4, hy - 4, 36, 12, L.main);
        p.r(hx - 4, hy + 6, 6, 30, L.main); p.r(hx + 26, hy + 6, 6, 30, shade(L.main, -0.12));
        p.tri(hx + 8, hy - 4, hx + 14, hy - 12, hx + 20, hy - 4, L.main);
        for (let i = 0; i < 9; i++) p.tri(hx - 4 + i * 4, hy + 8, hx - 2 + i * 4, hy + 4, hx + i * 4, hy + 8, L.sub);
        break;
      case 'ninja':
        p.b(hx - 2, hy - 1, 32, 15, L.main);
        p.b(hx - 2, ey + 4, 32, 14, L.main);
        p.r(hx - 2, hy + 7, 32, 3, L.sub);
        p.r(hx + 29, hy + 7, 8, 2, L.sub); p.r(hx + 31, hy + 9, 6, 2, L.sub);
        break;
      case 'bard':
        p.b(hx + 3, hy - 12, 22, 14, L.main);
        p.b(hx - 8, hy + 1, 44, 5, shade(L.main, -0.2));
        p.r(hx + 3, hy - 1, 22, 3, L.sub);
        p.line(hx + 20, hy - 4, hx + 36, hy - 22, L.trim, 3);
        p.line(hx + 22, hy - 4, hx + 38, hy - 19, '#fff7c2', 2);
        break;
      case 'tamer': {
        const pelt = L.cape || '#8b8f99';
        p.b(hx - 4, hy - 4, 36, 13, pelt);
        p.b(hx - 5, hy + 6, 7, 26, pelt); p.b(hx + 26, hy + 6, 7, 26, shade(pelt, -0.15));
        p.tri(hx - 2, hy - 2, hx + 3, hy - 16, hx + 10, hy - 2, pelt);
        p.tri(hx + 18, hy - 2, hx + 25, hy - 16, hx + 30, hy - 2, pelt);
        p.tri(hx + 1, hy - 3, hx + 3, hy - 11, hx + 7, hy - 3, shade(pelt, -0.4));
        p.tri(hx + 21, hy - 3, hx + 25, hy - 11, hx + 27, hy - 3, shade(pelt, -0.4));
        p.b(hx + 8, hy - 6, 12, 7, shade(pelt, 0.3));
        p.b(hx + 11, hy - 7, 6, 3, '#1f2937');
        p.r(hx + 3, hy - 2, 3, 2, '#1f2937'); p.r(hx + 22, hy - 2, 3, 2, '#1f2937');
        p.r(hx - 4, hy + 7, 36, 2, shade(pelt, -0.3));
        for (const tx of [hx + 2, hx + 22]) p.tri(tx, hy + 8, tx + 2, hy + 12, tx + 4, hy + 8, '#f8fafc');
        break;
      }
      case 'dancer':
        p.b(hx + 9, hy - 10, 10, 12, F.hair);
        p.r(hx + 18, hy - 7, 10, 3, L.sub);
        p.r(hx - 2, hy + 4, 32, 3, L.trim);
        p.b(hx + 12, hy + 3, 4, 5, '#38bdf8');
        p.b(hx + 2, ey + 8, 24, 9, shade(L.main, 0.3));
        p.r(hx + 2, ey + 8, 24, 1, shade(L.main, 0.5));
        break;
      case 'archer':
        p.b(hx - 3, hy - 2, 34, 8, L.main);
        p.tri(hx + 30, hy + 2, hx + 40, hy - 3, hx + 30, hy - 2, L.main);
        p.line(hx + 4, hy - 2, hx - 6, hy - 12, '#e8e2d0', 2);
        break;
      case 'spellblade':
        p.r(hx - 2, hy + 5, 32, 2, L.trim);
        p.b(hx + 12, hy + 3, 4, 5, '#ffffff');
        break;
      case 'monk':
        p.b(hx - 1, hy, 30, 10, F.skin); // shaved
        p.b(hx + 10, hy - 8, 8, 8, F.enemy ? '#2b2018' : L.hair); // topknot
        p.r(hx - 2, hy + 6, 32, 3, L.sub);
        p.r(hx + 28, hy + 8, 4, 8, L.sub);
        break;
      case 'chemist':
        p.b(hx - 3, hy - 2, 34, 11, L.sub);
        p.r(hx - 5, hy + 8, 38, 2, shade(L.sub, -0.25));
        p.r(hx + 2, hy + 2, 10, 6, '#b7791f'); p.r(hx + 16, hy + 2, 10, 6, '#b7791f');
        p.r(hx + 4, hy + 3, 6, 3, '#9ee7f0'); p.r(hx + 18, hy + 3, 6, 3, '#9ee7f0');
        p.r(hx + 12, hy + 4, 4, 2, '#6b4a1a');
        break;
      case 'thief':
        p.b(hx - 3, hy - 2, 34, 12, L.sub);
        p.r(hx - 3, hy + 9, 34, 2, shade(L.sub, -0.25));
        p.r(hx + 31, hy + 3, 7, 3, L.sub); p.r(hx + 33, hy + 6, 5, 5, L.sub);
        p.px(hx + 6, hy + 1, shade(L.sub, 0.35)); p.px(hx + 18, hy + 3, shade(L.sub, 0.35));
        break;
      case 'summoner':
        p.r(hx - 2, hy + 4, 32, 3, L.sub);
        p.tri(hx, hy + 5, hx - 6, hy - 12, hx + 6, hy + 3, '#e8e2d0');
        p.tri(hx + 28, hy + 5, hx + 34, hy - 12, hx + 22, hy + 3, '#e8e2d0');
        p.b(hx + 11, hy + 2, 6, 6, L.trim);
        break;
      case 'oracle':
        p.b(hx - 5, hy - 5, 38, 14, L.main);
        p.r(hx - 5, hy + 8, 7, 30, L.main); p.r(hx + 26, hy + 8, 7, 30, shade(L.main, -0.15));
        p.r(hx - 5, hy + 8, 38, 2, L.sub);
        p.b(hx + 9, hy + 1, 10, 5, L.trim);
        p.r(hx + 12, hy + 2, 4, 3, '#1b1f33');
        break;
      case 'geomancer':
        p.r(hx - 2, hy + 4, 32, 3, L.sub);
        p.b(hx + 11, hy + 2, 6, 6, '#34d399');
        p.tri(hx - 2, hy + 5, hx - 10, hy - 3, hx + 2, hy + 2, '#6fbf3a');
        p.tri(hx + 30, hy + 5, hx + 38, hy - 3, hx + 26, hy + 2, '#6fbf3a');
        break;
      default:
        p.r(hx - 2, hy + 5, 32, 3, L.sub);
        p.r(hx - 7, hy + 7, 5, 2, L.sub);
    }
  } else if (F.job === 'knight') {
    p.r(hx - 2, hy + 4, 32, 2, L.trim); // circlet
    p.b(hx + 12, hy + 3, 4, 4, '#60a5fa');
  } else if (F.job === 'dragoon') {
    p.r(hx - 2, hy + 5, 32, 3, L.main); // helm pushed back as a band
  } else if (F.job === 'geomancer') {
    p.r(hx - 2, hy + 4, 32, 3, L.sub);
  }
  if (F.job === 'geomancer' && !NAMED[id]) p.r(hx - 2, hy + 4, 32, 3, L.sub);
  if (id === 'bria') {
    p.r(hx - 2, hy + 4, 32, 3, L.sub);
    p.b(hx + 11, hy + 2, 6, 6, '#34d399');
    p.tri(hx - 2, hy + 5, hx - 9, hy - 2, hx + 2, hy + 2, '#6fbf3a');
  }

  outline(layer);
  ctx.drawImage(layer, 0, 0);
  ctx.strokeStyle = F.enemy ? '#ef4444' : '#f4c430';
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  return c;
}

const portraitCache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

export function portraitCanvas(id: string): HTMLCanvasElement {
  let c = portraitCache.get(id);
  if (!c) {
    c = drawPortrait(id);
    portraitCache.set(id, c);
  }
  return c;
}

/** PNG data URL for an <img> (Workshop lists, dialogue box). */
export function portraitDataUrl(id: string): string {
  let u = urlCache.get(id);
  if (!u) {
    u = portraitCanvas(id).toDataURL('image/png');
    urlCache.set(id, u);
  }
  return u;
}

/** Picks a portrait for a dialogue speaker when the line doesn't name one. */
export function portraitForSpeaker(speaker: string): string | undefined {
  const k = speaker.trim().toLowerCase();
  return NAMED[k] ? k : undefined;
}
