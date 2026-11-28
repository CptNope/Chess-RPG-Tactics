/**
 * Monster sprites and portraits (0.26.0), painted in code like the characters: the same 48×48
 * canvas with the feet on row 44, the same frames (idle, walk, attack, hurt), the same views
 * (front, back, right; left is the right view mirrored by drawSprite) and the same outline pass.
 *
 * Monsters aren't people in a job, so each has a body of its own: a wolf on four legs, a wyvern
 * hovering on its wings, an ooze, a wisp of marsh-fire and a hulking brute of stone; from 0.32.0
 * a basilisk, a bone knight and a thornling; from 0.51.0 a salamander, a frost sprite and a bog
 * lurker.
 */
import { Painter, makeCanvas, outline, shade, rgb, hex, SPRITE_SIZE, PORTRAIT_SIZE } from './CharacterArt';
import type { SpriteFrame, SpriteView } from './CharacterArt';

interface Pose {
  bob: number;
  stride: -1 | 0 | 1;
  attack: boolean;
  hurt: boolean;
  /** Wing beat for flyers: 1 up, 0 level, -1 down. */
  flap: number;
}

function poseFor(frame: SpriteFrame): Pose {
  return {
    bob: frame === 'idle1' || frame === 'hurt' ? 1 : 0,
    stride: frame === 'walk0' ? 1 : frame === 'walk1' ? -1 : 0,
    attack: frame === 'attack',
    hurt: frame === 'hurt',
    flap: frame === 'idle0' || frame === 'walk0' ? 1 : frame === 'idle1' ? 0 : -1
  };
}

/** A filled ellipse (the outline pass snaps its soft edge to whole pixels). */
function ell(p: Painter, cx: number, cy: number, rx: number, ry: number, c: string): void {
  const ctx = p.ctx;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Dire Wolf
// ---------------------------------------------------------------------------

const WOLF = { fur: '#6b7280', light: '#a3acb9', dark: '#3a404c', eye: '#facc15', nose: '#111318', mouth: '#5a1a1a' };

function wolf(p: Painter, view: SpriteView, P: Pose): void {
  const C = WOLF, b = P.bob, st = P.stride;
  if (view === 'E') {
    const lunge = P.attack ? 3 : P.hurt ? -2 : 0;
    const leg = (x: number, near: boolean, phase: number) => {
      const off = phase * 2;
      p.b(x + off, 33 + b, 3, 9 - b, near ? C.fur : C.dark);
      p.r(x + off - 1, 42, 5, 2, near ? C.dark : shade(C.dark, -0.2));
    };
    leg(14, false, -st); leg(30 + lunge, false, st);
    // tail, raised in the attack
    p.tri(12, 28 + b, 2, P.attack ? 18 : 24 + b, 9, 32 + b, C.fur);
    p.tri(4, P.attack ? 19 : 25 + b, 3, P.attack ? 17 : 23 + b, 7, 27 + b, C.light);
    ell(p, 22 + lunge / 2, 30 + b, 12, 6, C.fur);
    p.r(14 + lunge / 2, 33 + b, 16, 2, C.light); // belly
    ell(p, 20 + lunge / 2, 27 + b, 7, 2, shade(C.fur, 0.15)); // back
    leg(17, true, st); leg(33 + lunge, true, -st);
    // neck and head
    const hx = 31 + lunge, hy = 19 + b + (P.hurt ? 2 : 0);
    p.b(hx - 3, hy + 4, 8, 8, C.fur); // ruff
    p.b(hx, hy, 10, 9, C.fur);
    p.b(hx + 8, hy + 4, 6, 4, C.light); // snout
    p.px(hx + 13, hy + 4, C.nose);
    p.tri(hx + 1, hy + 1, hx + 3, hy - 6, hx + 5, hy + 1, C.fur); // ear
    p.px(hx + 3, hy - 3, C.dark);
    if (P.attack) {
      p.r(hx + 8, hy + 8, 6, 3, C.mouth); // jaw dropped open
      p.px(hx + 9, hy + 8, '#ffffff'); p.px(hx + 12, hy + 8, '#ffffff');
      p.b(hx + 8, hy + 10, 6, 2, C.light);
    }
    if (P.hurt) p.r(hx + 5, hy + 3, 2, 1, C.nose);
    else { p.r(hx + 5, hy + 2, 2, 2, C.eye); p.px(hx + 6, hy + 2, '#ffffff'); }
    return;
  }
  const back = view === 'N';
  // tail behind (front view) or up (back view)
  if (!back) p.tri(32, 30 + b, 39, 22 + b, 35, 33 + b, C.dark);
  ell(p, 24, 31 + b, 11, 7, back ? C.fur : C.dark);
  // four legs; the near pair strides
  for (const [x, ph] of [[16, -st], [29, st], [19, st], [26, -st]] as const) {
    const near = x === 19 || x === 26;
    if (back === near) continue;
    p.b(x, 34 + b + (ph > 0 ? -1 : 0), 4, 9 - b - (ph > 0 ? -1 : 0), near || back ? C.fur : C.dark);
    p.r(x - 1, 42, 6, 2, C.dark);
  }
  if (back) {
    p.b(17, 15 + b, 14, 11, C.fur); // head from behind
    p.tri(17, 17 + b, 18, 9 + b, 22, 16 + b, C.fur);
    p.tri(31, 17 + b, 30, 9 + b, 26, 16 + b, C.fur);
    p.r(19, 25 + b, 10, 2, C.dark); // the scruff, and a spine stripe down the back
    p.r(23, 27 + b, 2, 6, C.dark);
    // the tail over the rump, swishing with the stride
    p.tri(21, 33 + b, 27, 33 + b, 24 + st * 4, 42, C.fur);
    p.tri(23, 36 + b, 25, 36 + b, 24 + st * 4, 42, C.light);
    return;
  }
  ell(p, 24, 32 + b, 7, 5, C.light); // chest
  const hy = 15 + b + (P.hurt ? 2 : 0);
  p.b(17, hy, 14, 12, C.fur);
  p.tri(17, hy + 2, 18, hy - 6, 22, hy + 1, C.fur); // ears
  p.tri(31, hy + 2, 30, hy - 6, 26, hy + 1, C.fur);
  p.px(19, hy - 3, C.dark); p.px(29, hy - 3, C.dark);
  p.b(20, hy + 7, 8, 6, C.light); // muzzle
  p.r(22, hy + 7, 4, 2, C.nose);
  if (P.attack) {
    p.r(21, hy + 11, 6, 4, C.mouth);
    p.px(21, hy + 11, '#ffffff'); p.px(26, hy + 11, '#ffffff');
  }
  if (P.hurt) { p.r(19, hy + 4, 3, 1, C.nose); p.r(26, hy + 4, 3, 1, C.nose); }
  else { p.r(19, hy + 3, 3, 2, C.eye); p.r(26, hy + 3, 3, 2, C.eye); p.px(20, hy + 3, '#ffffff'); p.px(27, hy + 3, '#ffffff'); }
}

// ---------------------------------------------------------------------------
// Wyvern (hovers: its shadow stays on the ground)
// ---------------------------------------------------------------------------

const WYV = { hide: '#2f8a6a', light: '#62c49a', dark: '#1b4f45', wing: '#5b3f8c', wingLight: '#8f6bd1', belly: '#d9c27a', eye: '#ff7a3a', horn: '#e8dcc0' };

function wyvern(p: Painter, view: SpriteView, P: Pose): void {
  const C = WYV, b = P.bob, f = P.attack ? 0.5 : P.flap;
  const tipY = (base: number) => base - f * 9;
  if (view === 'E') {
    const lunge = P.attack ? 3 : P.hurt ? -2 : 0;
    // far wing
    p.tri(20, 17 + b, 30, tipY(4) + b, 30, 19 + b, shade(C.wing, -0.25));
    // tail with its sting
    p.line(14, 24 + b, 7, 29 + b, C.hide, 3);
    p.line(7, 29 + b, 3, 35 + b, C.hide, 2);
    p.tri(1, 33 + b, 5, 33 + b, 2, 39 + b, C.horn);
    ell(p, 20 + lunge / 2, 23 + b, 9, 6, C.hide);
    p.r(14 + lunge / 2, 26 + b, 12, 2, C.belly);
    // legs tucked under
    p.b(17, 28 + b, 3, 5, C.dark); p.b(23, 28 + b, 3, 5, C.dark);
    p.r(16, 33 + b, 4, 1, C.horn); p.r(22, 33 + b, 4, 1, C.horn);
    // neck and head
    const hx = 30 + lunge, hy = 9 + b + (P.hurt ? 3 : 0);
    p.line(25 + lunge / 2, 20 + b, hx + 1, hy + 5, C.hide, 4);
    p.b(hx, hy, 9, 7, C.hide);
    p.b(hx + 6, hy + 3, 5, 3, C.light);
    p.tri(hx + 1, hy + 1, hx - 4, hy - 4, hx + 4, hy, C.horn);
    if (P.attack) { p.r(hx + 6, hy + 6, 5, 2, '#5a1a1a'); p.px(hx + 7, hy + 6, '#ffffff'); }
    if (P.hurt) p.r(hx + 4, hy + 2, 2, 1, '#111318');
    else { p.r(hx + 4, hy + 2, 2, 2, C.eye); }
    // near wing
    p.tri(19, 18 + b, 8, tipY(2) + b, 28, 20 + b, C.wing);
    p.tri(19, 18 + b, 8, tipY(2) + b, 12, tipY(10) + b + 6, C.wingLight);
    p.line(19, 18 + b, 8, tipY(2) + b, C.dark);
    return;
  }
  const back = view === 'N';
  // wings, both sides
  for (const s of [-1, 1]) {
    p.tri(24 + s * 3, 19 + b, 24 + s * 22, tipY(6) + b, 24 + s * 6, 29 + b, back ? C.wing : shade(C.wing, -0.1));
    p.tri(24 + s * 3, 19 + b, 24 + s * 22, tipY(6) + b, 24 + s * 18, tipY(14) + b + 8, C.wingLight);
    p.line(24 + s * 3, 19 + b, 24 + s * 22, tipY(6) + b, C.dark);
  }
  // tail hanging below
  p.line(24, 30 + b, 26, 37 + b, C.hide, 3);
  p.tri(24, 37 + b, 29, 37 + b, 27, 42 + b, C.horn);
  ell(p, 24, 24 + b, 7, 8, C.hide);
  if (!back) ell(p, 24, 26 + b, 4, 5, C.belly);
  p.b(20, 30 + b, 3, 4, C.dark); p.b(25, 30 + b, 3, 4, C.dark);
  const hy = 8 + b + (P.hurt ? 3 : 0);
  p.line(24, 18 + b, 24, hy + 6, C.hide, 4);
  p.b(20, hy, 9, 8, C.hide);
  p.tri(20, hy + 1, 15, hy - 5, 22, hy, C.horn);
  p.tri(28, hy + 1, 33, hy - 5, 26, hy, C.horn);
  if (!back) {
    p.b(21, hy + 5, 7, 4, C.light);
    if (P.attack) p.r(22, hy + 8, 5, 2, '#5a1a1a');
    if (P.hurt) { p.r(21, hy + 3, 2, 1, '#111318'); p.r(26, hy + 3, 2, 1, '#111318'); }
    else { p.r(21, hy + 2, 2, 2, C.eye); p.r(26, hy + 2, 2, 2, C.eye); }
  }
}

// ---------------------------------------------------------------------------
// Bog Ooze
// ---------------------------------------------------------------------------

const OOZE = { body: '#5f8a2e', light: '#9cc84a', dark: '#36531a', core: '#2b4415', eye: '#f7f7e8', pupil: '#1a1a12' };

function ooze(p: Painter, view: SpriteView, P: Pose): void {
  const C = OOZE;
  // squash and stretch: taller when it rears to strike, flatter when hit
  const sq = P.attack ? -3 : P.hurt ? 3 : P.bob ? 1 : P.stride ? -1 : 0;
  const rx = 13 + sq, ry = 11 - sq, cy = 44 - ry;
  ell(p, 24, cy, rx, ry, C.body);
  p.r(24 - rx + 1, cy, rx * 2 - 2, 44 - cy, C.body);
  ell(p, 24, cy + 3, rx - 5, ry - 5, C.dark); // the murk inside
  ell(p, 22, cy + 2, 3, 2, C.core);
  ell(p, 19 - (view === 'E' ? 2 : 0), cy - ry + 4, 4, 2, C.light); // sheen
  p.px(30, cy + 4, C.light); p.px(27, cy + 7, C.light); p.px(16, cy + 6, C.light); // bubbles
  // drips at the base
  for (const x of [13, 22, 33]) p.r(x, 42, 2, 2, C.dark);
  if (view === 'N') return;
  const eyes = view === 'E' ? [30] : [19, 28];
  for (const x of eyes) {
    const ey = cy - 3;
    p.b(x, ey, 4, 5, C.eye);
    if (P.hurt) p.r(x, ey + 2, 4, 1, C.pupil);
    else p.r(x + (view === 'E' ? 2 : 1), ey + 2, 2, 2, C.pupil);
  }
  if (P.attack) p.r(view === 'E' ? 31 : 20, cy + 3, view === 'E' ? 5 : 9, 4, '#1f2a10');
}

// ---------------------------------------------------------------------------
// Marsh Wisp (hovers)
// ---------------------------------------------------------------------------

const WISP = { glow: '#7ee6f7', main: '#b9f3fb', core: '#f2feff', deep: '#2e9bb5', eye: '#0b3a4a' };

function wisp(p: Painter, view: SpriteView, P: Pose): void {
  const C = WISP, b = P.bob * 2;
  const flick = P.stride || (P.bob ? -1 : 1);
  const size = P.attack ? 2 : P.hurt ? -1 : 0;
  const lean = view === 'E' ? -3 : 0;
  const cy = 24 + b;
  // wispy tail trailing down
  p.tri(19, cy + 4, 29, cy + 4, 24 + flick * 2 + lean, 40, C.deep);
  p.tri(21, cy + 4, 27, cy + 4, 24 - flick + lean, 37, C.glow);
  // the flame: a round body with a flickering tip
  ell(p, 24, cy, 9 + size, 9 + size, C.glow);
  p.tri(16 - size, cy - 3, 32 + size, cy - 3, 24 + flick * 3 + lean, cy - 18 - size, C.glow);
  p.tri(19, cy - 3, 29, cy - 3, 24 - flick * 2 + lean, cy - 13, C.main);
  ell(p, 24, cy + 1, 6 + size, 6 + size, C.main);
  ell(p, 24, cy + 2, 3 + size, 3 + size, C.core);
  // two sparks orbiting
  p.px(12 + flick * 2, cy - 6, C.main);
  p.px(36 - flick * 2, cy + 4, C.main);
  if (view === 'N') return;
  const ex = view === 'E' ? [27] : [20, 27];
  for (const x of ex) {
    if (P.hurt) p.r(x, cy - 1, 2, 1, C.eye);
    else p.r(x, cy - 2, 2, 3, C.eye);
  }
  if (P.attack) p.r(view === 'E' ? 27 : 22, cy + 3, view === 'E' ? 3 : 4, 2, C.eye);
}

// ---------------------------------------------------------------------------
// Stonehide Brute
// ---------------------------------------------------------------------------

const BRUTE = { stone: '#77727a', light: '#a39ea6', dark: '#45424d', moss: '#4f8a3a', eye: '#ff9a2a', crack: '#2c2a33' };

function brute(p: Painter, view: SpriteView, P: Pose): void {
  const C = BRUTE, b = P.bob, st = P.stride;
  if (view === 'E') {
    const lunge = P.attack ? 2 : P.hurt ? -2 : 0;
    p.b(15 - st * 2, 35 + b, 7, 8 - b, C.dark); // far leg
    p.b(13 + lunge, 19 + b, 14, 7, C.dark); // far arm, behind
    p.b(16 + st * 2, 35 + b, 8, 8 - b, C.stone); // near leg
    p.r(15 + st * 2, 42, 10, 2, C.dark);
    p.b(11 + lunge, 17 + b, 20, 20, C.stone); // hunched torso
    p.r(11 + lunge, 17 + b, 9, 3, C.moss);
    p.line(14 + lunge, 24 + b, 19 + lunge, 30 + b, C.crack);
    // head thrust forward and low
    const hx = 26 + lunge, hy = 13 + b + (P.hurt ? 2 : 0);
    p.b(hx, hy, 10, 9, C.stone);
    p.r(hx, hy, 10, 2, C.light);
    p.r(hx + 6, hy + 3, 2, 2, P.hurt ? C.crack : C.eye);
    p.r(hx + 4, hy + 7, 6, 1, C.crack);
    // near arm: down to the ground, or raised for the blow
    if (P.attack) {
      p.b(28 + lunge, 8, 7, 14, C.stone);
      p.b(29 + lunge, 1, 11, 10, C.light);
    } else {
      p.b(24 + lunge, 20 + b, 7, 14, C.stone);
      p.b(24 + lunge, 32 + b, 10, 9, C.light);
    }
    return;
  }
  const back = view === 'N';
  for (const [x, ph] of [[15, st], [26, -st]] as const) {
    p.b(x, 35 + b - (ph > 0 ? 1 : 0), 8, 8 - b + (ph > 0 ? 1 : 0), C.dark);
    p.r(x - 1, 42, 10, 2, C.crack);
  }
  p.b(11, 16 + b, 26, 21, C.stone); // torso
  p.b(13, 18 + b, 22, 6, C.light);
  p.r(11, 16 + b, 10, 3, C.moss); p.r(28, 17 + b, 6, 2, C.moss);
  p.line(16, 26 + b, 22, 33 + b, C.crack); p.line(31, 24 + b, 28, 31 + b, C.crack);
  // boulder shoulders
  ell(p, 11, 18 + b, 6, 5, C.stone);
  ell(p, 37, 18 + b, 6, 5, C.stone);
  // arms down to the ground (the right one raised in the attack)
  p.b(3, 20 + b, 7, 14, C.stone);
  p.b(1, 32 + b, 10, 10, C.light);
  if (P.attack && !back) {
    p.b(38, 4, 7, 15, C.stone);
    p.b(36, 0, 11, 8, C.light);
  } else {
    p.b(38, 20 + b, 7, 14, C.stone);
    p.b(37, 32 + b, 10, 10, C.light);
  }
  // small head sunk between the shoulders
  const hy = 9 + b + (P.hurt ? 2 : 0);
  p.b(19, hy, 10, 9, C.stone);
  p.r(19, hy, 10, 2, C.light);
  if (!back) {
    p.r(20, hy + 3, 8, 2, C.crack);
    if (P.hurt) { p.r(20, hy + 3, 3, 1, C.dark); p.r(25, hy + 3, 3, 1, C.dark); }
    else { p.r(20, hy + 3, 2, 2, C.eye); p.r(26, hy + 3, 2, 2, C.eye); }
    p.r(21, hy + 7, 6, 1, C.crack);
  }
}


// ---------------------------------------------------------------------------
// Basilisk (0.32.0): a long, low lizard with a crest and a stare that roots you
// ---------------------------------------------------------------------------

const BAS = { scale: '#6b7a2e', light: '#a3b35a', dark: '#3b4419', belly: '#d8c98a', crest: '#b45309', eye: '#fbbf24', glow: '#fde68a', mouth: '#5a1a1a' };

function basilisk(p: Painter, view: SpriteView, P: Pose): void {
  const C = BAS, b = P.bob, st = P.stride;
  if (view === 'E') {
    const lunge = P.attack ? 3 : P.hurt ? -2 : 0;
    const leg = (x: number, near: boolean, ph: number) => {
      p.b(x + ph * 2, 35 + b, 4, 7 - b, near ? C.scale : C.dark);
      p.r(x + ph * 2 - 1, 41, 6, 2, C.dark);
    };
    leg(12, false, -st); leg(27 + lunge, false, st);
    // tail, tapering to the left along the ground
    p.tri(12, 30 + b, 12, 37 + b, 1, 40, C.scale);
    p.line(12, 34 + b, 2, 39, C.dark);
    ell(p, 21 + lunge / 2, 32 + b, 13, 6, C.scale);
    p.r(11 + lunge / 2, 35 + b, 20, 2, C.belly);
    // the crest along the spine
    for (let i = 0; i < 5; i++) p.tri(12 + i * 4 + lunge / 2, 28 + b, 14 + i * 4 + lunge / 2, 22 + b - (i % 2) * 2, 16 + i * 4 + lunge / 2, 28 + b, C.crest);
    for (let i = 0; i < 4; i++) p.px(15 + i * 5 + lunge / 2, 31 + b, C.light); // scale glints
    leg(15, true, st); leg(30 + lunge, true, -st);
    // a flat, heavy head held low
    const hx = 31 + lunge, hy = 26 + b + (P.hurt ? 2 : 0);
    p.b(hx, hy, 12, 8, C.scale);
    p.r(hx + 1, hy, 9, 2, C.light);
    p.tri(hx + 1, hy + 1, hx + 4, hy - 4, hx + 6, hy + 1, C.crest);
    if (P.attack) {
      p.r(hx + 6, hy + 6, 7, 3, C.mouth); p.px(hx + 7, hy + 6, '#ffffff'); p.px(hx + 11, hy + 6, '#ffffff');
      // the stare: two beams from the eye
      p.line(hx + 9, hy + 2, hx + 16, hy - 1, C.glow); p.line(hx + 9, hy + 3, hx + 16, hy + 4, C.glow);
    }
    if (P.hurt) p.r(hx + 7, hy + 3, 3, 1, C.dark);
    else { p.r(hx + 7, hy + 2, 3, 3, C.eye); p.px(hx + 8, hy + 3, '#7c2d12'); }
    return;
  }
  const back = view === 'N';
  // splayed legs at the four corners
  for (const [x, ph] of [[7, st], [35, -st], [11, -st], [31, st]] as const) {
    p.b(x, 34 + b - (ph > 0 ? 1 : 0), 6, 7 - b + (ph > 0 ? 1 : 0), x === 11 || x === 31 ? C.scale : C.dark);
    p.r(x - 1, 41, 8, 2, C.dark);
  }
  if (back) {
    ell(p, 24, 31 + b, 14, 8, C.scale);
    for (let i = 0; i < 4; i++) p.tri(21, 22 + b + i * 4, 24, 18 + b + i * 4, 27, 22 + b + i * 4, C.crest);
    p.b(18, 20 + b, 12, 7, C.scale); // the back of the head
    p.tri(22, 38 + b, 26, 38 + b, 24 + st * 3, 44, C.scale); // the tail
    for (const x of [14, 33]) p.px(x, 30 + b, C.light);
    return;
  }
  ell(p, 24, 33 + b, 14, 7, C.scale);
  ell(p, 24, 36 + b, 9, 3, C.belly);
  const hy = 21 + b + (P.hurt ? 2 : 0);
  p.b(16, hy, 16, 8, C.scale); // the head, with eyes on its sides
  p.r(17, hy, 14, 2, C.light);
  for (const x of [18, 23, 28]) p.tri(x - 1, hy + 1, x + 1, hy - 5, x + 3, hy + 1, C.crest);
  p.b(19, hy + 6, 10, 8, C.scale); // a long snout coming at you
  p.b(20, hy + 7, 8, 5, C.light);
  p.px(21, hy + 8, C.dark); p.px(26, hy + 8, C.dark); // nostrils
  if (P.attack) { p.r(19, hy + 12, 10, 3, C.mouth); p.px(20, hy + 12, '#ffffff'); p.px(27, hy + 12, '#ffffff'); }
  else p.r(19, hy + 12, 10, 1, C.dark);
  if (P.hurt) { p.r(15, hy + 3, 3, 1, C.dark); p.r(30, hy + 3, 3, 1, C.dark); }
  else {
    p.r(15, hy + 2, 3, 3, C.eye); p.r(30, hy + 2, 3, 3, C.eye);
    p.px(16, hy + 3, '#7c2d12'); p.px(31, hy + 3, '#7c2d12');
    if (P.attack) { p.line(16, hy + 2, 12, hy - 7, C.glow); p.line(31, hy + 2, 35, hy - 7, C.glow); }
  }
}

// ---------------------------------------------------------------------------
// Bone Knight (0.32.0): a skeleton in a rusted helm, with a notched sword and a round shield
// ---------------------------------------------------------------------------

const BONE = { bone: '#e7e1cf', dark: '#a69f88', rust: '#8a4b2a', rustLight: '#b8693a', cloth: '#3b2f4a', clothLight: '#5b4a70', eye: '#60a5fa', steel: '#cbd5e1' };

function boneKnight(p: Painter, view: SpriteView, P: Pose): void {
  const C = BONE, b = P.bob, st = P.stride;
  const hurt = P.hurt ? 2 : 0;
  if (view === 'E') {
    const lunge = P.attack ? 3 : P.hurt ? -2 : 0;
    // legs: thin bones with knobbed knees
    for (const [x, ph] of [[20, -st], [25, st]] as const) {
      p.r(x + ph * 2, 33 + b, 2, 9 - b, x === 20 ? C.dark : C.bone);
      p.px(x + ph * 2 - 1, 37 + b, C.bone);
      p.r(x + ph * 2 - 1, 42, 5, 2, C.dark);
    }
    p.b(17 + lunge / 2, 28 + b, 12, 7, C.cloth); // tattered tabard
    for (const x of [18, 22, 26]) p.tri(x + lunge / 2, 34 + b, x + 2 + lunge / 2, 38 + b, x + 4 + lunge / 2, 34 + b, C.cloth);
    // ribs and spine
    p.r(20 + lunge / 2, 18 + b, 2, 11, C.dark);
    for (let i = 0; i < 4; i++) p.r(21 + lunge / 2, 19 + b + i * 3, 7, 2, C.bone);
    // shield on the far arm, behind
    ell(p, 16 + lunge / 2, 24 + b, 5, 7, C.rust);
    ell(p, 16 + lunge / 2, 24 + b, 2, 3, C.rustLight);
    // skull in a rusted pot helm
    const hx = 19 + lunge, hy = 7 + b + hurt;
    p.b(hx, hy + 4, 10, 8, C.bone);
    p.b(hx - 1, hy, 12, 7, C.rust);
    p.r(hx - 1, hy, 12, 2, C.rustLight);
    p.r(hx + 6, hy + 5, 4, 2, '#111318'); // the visor slit
    if (!P.hurt) p.px(hx + 8, hy + 5, C.eye);
    p.r(hx + 5, hy + 10, 5, 1, C.dark); // the jaw
    // sword arm: forward for the thrust, else held down
    if (P.attack) {
      p.line(24 + lunge, 20 + b, 31 + lunge, 21 + b, C.bone, 2);
      p.r(31 + lunge, 19 + b, 2, 5, C.rust);
      p.line(33 + lunge, 21 + b, 45, 20 + b, C.steel, 2);
    } else {
      p.line(24, 20 + b, 28, 29 + b, C.bone, 2);
      p.r(27, 29 + b, 4, 2, C.rust);
      p.line(29, 31 + b, 33, 42, C.steel, 2);
    }
    return;
  }
  const back = view === 'N';
  for (const [x, ph] of [[19, st], [27, -st]] as const) {
    p.r(x, 33 + b - (ph > 0 ? 1 : 0), 2, 9 - b + (ph > 0 ? 1 : 0), C.bone);
    p.px(x - 1, 37 + b, C.bone); p.px(x + 2, 37 + b, C.bone);
    p.r(x - 1, 42, 5, 2, C.dark);
  }
  p.b(16, 28 + b, 16, 7, C.cloth);
  for (const x of [16, 21, 26]) p.tri(x, 34 + b, x + 3, 39 + b, x + 6, 34 + b, back ? C.cloth : C.clothLight);
  // ribcage (or the spine and shoulder blades from behind)
  if (back) {
    p.r(23, 17 + b, 2, 12, C.bone);
    p.b(17, 18 + b, 5, 5, C.dark); p.b(26, 18 + b, 5, 5, C.dark);
  } else {
    p.r(23, 17 + b, 2, 12, C.dark);
    for (let i = 0; i < 4; i++) { p.r(18, 18 + b + i * 3, 12, 2, C.bone); p.r(23, 18 + b + i * 3, 2, 2, C.dark); }
  }
  // arms
  p.line(17, 18 + b, 13, 28 + b, C.bone, 2);
  p.line(31, 18 + b, 35, 28 + b, C.bone, 2);
  // shield on its left (our right in the front view), sword on the other side
  const sx = back ? 12 : 36;
  ell(p, sx, 27 + b, 6, 7, C.rust); ell(p, sx, 27 + b, 2, 3, C.rustLight);
  const wx = back ? 35 : 12;
  if (P.attack && !back) {
    p.line(wx + 1, 26 + b, wx - 1, 2, C.steel, 2);
    p.r(wx - 2, 25 + b, 6, 2, C.rust);
  } else {
    p.r(wx - 1, 27 + b, 5, 2, C.rust);
    p.line(wx + 1, 29 + b, wx + 1, 43, C.steel, 2);
  }
  // skull in its helm
  const hy = 6 + b + hurt;
  p.b(18, hy + 4, 12, 9, C.bone);
  p.b(17, hy, 14, 8, C.rust);
  p.r(17, hy, 14, 2, C.rustLight);
  if (!back) {
    p.r(19, hy + 5, 10, 2, '#111318');
    if (!P.hurt) { p.px(20, hy + 5, C.eye); p.px(27, hy + 5, C.eye); }
    for (const x of [20, 22, 24, 26]) p.px(x, hy + 11, C.dark); // teeth
  } else p.r(22, hy + 2, 4, 1, C.rustLight); // a rivet line
}

// ---------------------------------------------------------------------------
// Thornling (0.32.0): a walking knot of briars on root legs, with a flower on top
// ---------------------------------------------------------------------------

const THORN = { vine: '#3f6b2a', light: '#6a9a3c', dark: '#223d17', thorn: '#e8d8a8', flower: '#d9466f', flowerLight: '#f59ab5', eye: '#fbbf24', root: '#5a3d22' };

function thornling(p: Painter, view: SpriteView, P: Pose): void {
  const C = THORN, b = P.bob, st = P.stride;
  const sq = P.attack ? -1 : P.hurt ? 2 : 0;
  // root legs, shuffling with the stride
  for (const [x, ph] of [[15, st], [21, -st], [27, st], [33, -st]] as const) {
    p.line(x, 34 + b, x + (ph || (x < 24 ? -1 : 1)) * 2, 43, C.root, 2);
  }
  const cy = 25 + b + sq;
  ell(p, 24, cy, 13, 11 - sq, C.vine);
  ell(p, 22, cy - 4, 8, 5, C.light);
  ell(p, 26, cy + 4, 9, 5, C.dark);
  // thorns all round the edge
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = 24 + Math.cos(a) * 13, y = cy + Math.sin(a) * (11 - sq);
    p.tri(x - 1, y, x + Math.cos(a) * 3, y + Math.sin(a) * 3, x + 1, y + 1, C.thorn);
  }
  // twisting vines across it
  p.line(14, cy - 2, 22, cy + 4, C.dark); p.line(28, cy - 6, 34, cy + 2, C.dark);
  // the flower on top
  const fx = view === 'E' ? 20 : 24, fy = cy - 12;
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) ell(p, fx + dx, fy + dy, 2.5, 2.5, C.flower);
  ell(p, fx, fy, 2, 2, C.flowerLight);
  if (view === 'N') return;
  // a vine whip lashing out in the attack
  if (P.attack) {
    const dir = view === 'E' ? 1 : -1, ox = view === 'E' ? 34 : 13;
    p.line(ox, cy, ox + dir * 8, cy - 6, C.vine, 2);
    p.line(ox + dir * 8, cy - 6, ox + dir * 13, cy - 2, C.vine, 2);
    p.tri(ox + dir * 13, cy - 3, ox + dir * 15, cy - 1, ox + dir * 12, cy, C.thorn);
  }
  // a face in the briars: two amber eyes and a dark hollow
  const ex = view === 'E' ? 28 : 19, gap = view === 'E' ? 5 : 8;
  if (P.hurt) { p.r(ex, cy - 1, 3, 1, C.dark); p.r(ex + gap, cy - 1, 3, 1, C.dark); }
  else { p.r(ex, cy - 2, 3, 3, C.eye); p.r(ex + gap, cy - 2, 3, 3, C.eye); }
  p.r(ex + 1, cy + 4, gap + 1, P.attack ? 3 : 2, '#111a0c');
}

// ---------------------------------------------------------------------------
// Emberback (0.51.0; id 'salamander'): a low fire lizard with a flickering crest, breathing flame in the attack
// ---------------------------------------------------------------------------

const SAL = { skin: '#d9481f', light: '#f4793b', belly: '#fcd34d', dark: '#7c2d12', crest: '#fde047', crestTip: '#fb923c', eye: '#1c1917', flame: '#fb923c', flameCore: '#fef08a' };

function salamander(p: Painter, view: SpriteView, P: Pose): void {
  const C = SAL, b = P.bob, st = P.stride;
  const flick = P.bob ? 1 : 0;
  if (view === 'E') {
    const lunge = P.attack ? -3 : P.hurt ? -2 : 0; // rears back to breathe
    // tail sweeping back
    p.tri(13, 30 + b, 13, 35 + b, 2, 37 + st, C.skin);
    p.tri(13, 33 + b, 6, 36 + st, 2, 37 + st, C.dark);
    // far legs
    p.b(15 - st, 34 + b, 3, 8 - b, C.dark); p.b(27 + st, 34 + b, 3, 8 - b, C.dark);
    // body and belly
    ell(p, 22 + lunge / 2, 32 + b, 11, 5, C.skin);
    ell(p, 22 + lunge / 2, 35 + b, 9, 2.5, C.belly);
    // crest flames along the back
    for (const [x, h] of [[15, 4], [19, 6], [23, 5], [27, 4]] as const) {
      p.tri(x - 2, 28 + b, x + 2, 28 + b, x + flick, 28 + b - h - flick, C.crest);
      p.px(x + flick, 27 + b - h + 2, C.crestTip);
    }
    // near legs
    p.b(18 + st, 35 + b, 3, 7 - b, C.skin); p.b(30 - st + lunge, 35 + b, 3, 7 - b, C.skin);
    p.r(17 + st, 42, 5, 2, C.dark); p.r(29 - st + lunge, 42, 5, 2, C.dark);
    // head and snout
    ell(p, 34 + lunge, 30 + b, 5, 4, C.skin);
    p.tri(36 + lunge, 28 + b, 36 + lunge, 33 + b, 43 + lunge, 31 + b, C.light);
    p.r(38 + lunge, 32 + b, 4, 1, C.dark);
    if (P.hurt) p.r(35 + lunge, 29 + b, 2, 1, C.eye); else p.r(35 + lunge, 28 + b, 2, 2, C.eye);
    if (P.attack) {
      // a gout of fire from the mouth
      p.tri(41 + lunge, 31 + b, 48, 23, 48, 40, C.flame);
      p.tri(41 + lunge, 31 + b, 48, 27, 48, 36, C.crest);
      p.tri(41 + lunge, 31 + b, 47, 29, 47, 33, C.flameCore);
    }
    return;
  }
  if (view === 'S') {
    // body behind the head, legs splayed
    ell(p, 24, 35 + b, 10, 6, C.skin);
    p.b(13 + st, 36 + b, 4, 6 - b, C.dark); p.b(31 - st, 36 + b, 4, 6 - b, C.dark);
    p.r(12 + st, 42, 6, 2, C.dark); p.r(30 - st, 42, 6, 2, C.dark);
    ell(p, 24, 38 + b, 6, 2.5, C.belly);
    // crest flames on the head
    for (const [x, h] of [[20, 4], [24, 6], [28, 4]] as const) p.tri(x - 2, 25 + b, x + 2, 25 + b, x + flick, 25 + b - h - flick, C.crest);
    ell(p, 24, 29 + b, 7, 5, C.skin);
    ell(p, 24, 32 + b, 5, 2, C.light);
    if (P.hurt) { p.r(19, 28 + b, 3, 1, C.eye); p.r(26, 28 + b, 3, 1, C.eye); }
    else { p.r(19, 27 + b, 3, 3, C.eye); p.r(26, 27 + b, 3, 3, C.eye); p.px(20, 27 + b, C.crest); p.px(27, 27 + b, C.crest); }
    p.r(21, 33 + b, 6, 1, C.dark);
    if (P.attack) { p.tri(19, 34 + b, 29, 34 + b, 24, 45, C.flame); p.tri(21, 34 + b, 27, 34 + b, 24, 41, C.flameCore); }
    return;
  }
  // N: from behind, the tail toward the viewer
  ell(p, 24, 32 + b, 9, 7, C.skin);
  p.b(13 + st, 35 + b, 4, 7 - b, C.dark); p.b(31 - st, 35 + b, 4, 7 - b, C.dark);
  p.tri(21, 36 + b, 27, 36 + b, 24 + st * 2, 46, C.skin);
  p.tri(23, 38 + b, 25, 38 + b, 24 + st * 2, 45, C.dark);
  for (const [y, h] of [[25, 5], [29, 4], [33, 3]] as const) p.tri(22, y + b, 26, y + b, 24 + flick, y + b - h, C.crest);
  ell(p, 24, 24 + b, 5, 4, C.skin);
}

// ---------------------------------------------------------------------------
// Frost Sprite (0.51.0): a hovering shard of ice with crystal wings and a cold light inside
// ---------------------------------------------------------------------------

const FROST = { ice: '#7dd3fc', light: '#e0f2fe', deep: '#0369a1', core: '#ffffff', eye: '#0c4a6e', glint: '#bae6fd' };

function frostSprite(p: Painter, view: SpriteView, P: Pose): void {
  const C = FROST, b = P.bob * 2;
  const cy = 24 + b;
  const grow = P.attack ? 2 : P.hurt ? -1 : 0;
  const wing = P.flap * 3;
  // crystal wings, beating
  p.tri(18, cy - 2, 6, cy - 8 - wing, 10, cy + 6 - wing / 2, C.glint);
  p.tri(30, cy - 2, 42, cy - 8 - wing, 38, cy + 6 - wing / 2, C.glint);
  p.tri(18, cy, 9, cy - 4 - wing, 12, cy + 4, C.ice);
  p.tri(30, cy, 39, cy - 4 - wing, 36, cy + 4, C.ice);
  // the shard body: a long diamond
  p.tri(16 - grow, cy, 32 + grow, cy, 24, cy - 16 - grow, C.ice);
  p.tri(16 - grow, cy, 32 + grow, cy, 24, cy + 16 + grow, C.deep);
  p.tri(19, cy, 29, cy, 24, cy - 11, C.light);
  p.tri(19, cy, 29, cy, 24, cy + 10, C.ice);
  // the cold light in its heart
  ell(p, 24, cy, 3 + grow / 2, 3 + grow / 2, C.core);
  // a crown of small shards
  p.tri(20, cy - 12, 22, cy - 12, 19, cy - 19, C.light);
  p.tri(26, cy - 12, 28, cy - 12, 29, cy - 19, C.light);
  // drifting snow
  p.px(10 + P.stride * 2, cy + 10, C.light); p.px(38 - P.stride * 2, cy + 14, C.light); p.px(24, cy + 22, C.glint);
  if (view === 'N') return;
  const ex = view === 'E' ? [26] : [21, 26];
  for (const x of ex) {
    if (P.hurt) p.r(x, cy - 4, 2, 1, C.eye);
    else p.r(x, cy - 5, 2, 2, C.eye);
  }
  if (P.attack) {
    // a spray of frost toward the target
    const dir = view === 'E' ? 1 : 0;
    if (dir) { p.line(32, cy, 44, cy - 4, C.light); p.line(32, cy + 2, 45, cy + 3, C.glint); p.px(46, cy - 1, C.core); }
    else { p.line(24, cy + 17, 21, cy + 22, C.light); p.line(24, cy + 17, 27, cy + 22, C.light); }
  }
}

// ---------------------------------------------------------------------------
// Bog Lurker (0.51.0): a squat, wide-jawed frog-thing, mottled with mud, eyes bulging on top
// ---------------------------------------------------------------------------

const LURK = { skin: '#4d6b3a', light: '#7a9a52', dark: '#2a3d1f', belly: '#c2b280', spot: '#3a2a1a', eye: '#facc15', pupil: '#111827', mouth: '#5a1a1a', tongue: '#e11d48' };

function bogLurker(p: Painter, view: SpriteView, P: Pose): void {
  const C = LURK, b = P.bob, st = P.stride;
  const sq = P.attack ? -1 : P.hurt ? 1 : 0;
  if (view === 'E') {
    const lunge = P.attack ? 2 : P.hurt ? -2 : 0;
    // hind leg folded under, front leg planted
    ell(p, 14, 38 + b, 6, 4, C.dark);
    p.b(28 + st + lunge, 37 + b, 4, 6 - b, C.skin); p.r(27 + st + lunge, 42, 7, 2, C.dark);
    // body
    ell(p, 22 + lunge / 2, 33 + b + sq, 13, 8 - sq, C.skin);
    ell(p, 24 + lunge / 2, 38 + b, 9, 3, C.belly);
    for (const [x, y] of [[15, 29], [20, 27], [17, 33], [25, 30]] as const) p.r(x, y + b, 2, 2, C.spot);
    // the head: one with the body, a wide jaw
    ell(p, 33 + lunge, 32 + b + sq, 7, 5, C.skin);
    if (P.attack) {
      p.tri(33 + lunge, 33 + b, 41 + lunge, 30 + b, 41 + lunge, 37 + b, C.mouth);
      p.line(36 + lunge, 34 + b, 46, 33 + b, C.tongue, 2);
    } else {
      p.line(31 + lunge, 34 + b, 40 + lunge, 33 + b, C.dark);
    }
    // a bulging eye on top
    ell(p, 33 + lunge, 26 + b + sq, 3, 3, C.light);
    if (P.hurt) p.r(32 + lunge, 26 + b, 3, 1, C.pupil); else { p.r(32 + lunge, 25 + b + sq, 3, 3, C.eye); p.px(34 + lunge, 26 + b + sq, C.pupil); }
    return;
  }
  if (view === 'S') {
    // legs splayed to the sides
    p.b(9 + st, 37 + b, 5, 6 - b, C.dark); p.b(34 - st, 37 + b, 5, 6 - b, C.dark);
    p.r(8 + st, 42, 7, 2, C.dark); p.r(33 - st, 42, 7, 2, C.dark);
    ell(p, 24, 33 + b + sq, 14, 9 - sq, C.skin);
    ell(p, 24, 38 + b, 10, 3, C.belly);
    for (const [x, y] of [[13, 30], [33, 31], [19, 27], [29, 27]] as const) p.r(x, y + b, 2, 2, C.spot);
    // the wide mouth, open in the attack
    if (P.attack) { p.r(15, 34 + b, 18, 4, C.mouth); p.r(22, 36 + b, 4, 5, C.tongue); }
    else p.line(15, 35 + b, 33, 35 + b, C.dark);
    // two bulging eyes on top
    for (const x of [17, 31]) {
      ell(p, x, 25 + b + sq, 4, 4, C.light);
      if (P.hurt) p.r(x - 2, 25 + b, 4, 1, C.pupil);
      else { p.r(x - 2, 23 + b + sq, 4, 4, C.eye); p.r(x - 1, 24 + b + sq, 2, 2, C.pupil); }
    }
    return;
  }
  // N: the mottled back and the two eye-bumps
  p.b(9 + st, 37 + b, 5, 6 - b, C.dark); p.b(34 - st, 37 + b, 5, 6 - b, C.dark);
  ell(p, 24, 33 + b + sq, 14, 9 - sq, C.skin);
  ell(p, 24, 31 + b, 10, 5, C.light);
  for (const [x, y] of [[16, 30], [30, 29], [23, 34], [19, 36], [28, 36], [24, 28]] as const) p.r(x, y + b, 2, 2, C.spot);
  for (const x of [17, 31]) ell(p, x, 25 + b + sq, 4, 3.5, C.skin);
}

// ---------------------------------------------------------------------------

const PAINTERS: Record<string, (p: Painter, view: SpriteView, pose: Pose) => void> = {
  wolf, wyvern, ooze, wisp, brute, basilisk, bone_knight: boneKnight, thornling,
  salamander, frost_sprite: frostSprite, bog_lurker: bogLurker
};

/** Flyers cast a smaller shadow: they hover above it. */
const HOVERS = new Set(['wyvern', 'wisp', 'frost_sprite']);

/** Where each monster's face is in its front sprite: the top-left of a 32×32 crop for its portrait. */
const FACE_CROP: Record<string, [number, number]> = {
  wolf: [8, 4], wyvern: [8, 0], ooze: [8, 16], wisp: [8, 6], brute: [8, 2],
  basilisk: [8, 9], bone_knight: [8, 2], thornling: [8, 8],
  salamander: [8, 14], frost_sprite: [8, 6], bog_lurker: [8, 15]
};

export function isMonsterArt(job: string): boolean {
  return !!PAINTERS[job];
}

/** A monster's sprite (east view; drawSprite mirrors it for west), shadow included. */
export function drawMonsterSprite(job: string, view: SpriteView, frame: SpriteFrame): HTMLCanvasElement {
  const layer = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const p = new Painter(layer.getContext('2d')!);
  PAINTERS[job](p, view === 'W' ? 'E' : view, poseFor(frame));
  outline(layer);
  const c = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(24, 44.5, HOVERS.has(job) ? 7 : 12, HOVERS.has(job) ? 2 : 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(layer, 0, 0);
  return c;
}

/** A monster's portrait: its face, from the front sprite, at twice the size on a foe's backdrop. */
export function drawMonsterPortrait(job: string): HTMLCanvasElement {
  const S = PORTRAIT_SIZE;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d')!;
  const [r1, g1, b1] = rgb('#4a1420'), [r2, g2, b2] = rgb('#1c0a10');
  for (let y = 0; y < S; y += 2) {
    const k = y / S;
    ctx.fillStyle = hex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
    ctx.fillRect(0, y, S, 2);
  }
  const layer = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
  PAINTERS[job](new Painter(layer.getContext('2d')!), 'S', poseFor('idle0'));
  outline(layer);
  const [x, y] = FACE_CROP[job] || [8, 8];
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer, x, y, 32, 32, 0, 0, S, S);
  ctx.strokeStyle = '#ef4444';
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  return c;
}
