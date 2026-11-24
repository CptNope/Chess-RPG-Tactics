// Undine: a water spirit rises out of a swirling pool in the circle, lifts her arms, and brings a
// wave crashing down over the whole area; frost spikes are left where it broke.
import { clamp, ease, rand, TAU, hex, cycle, WHITE } from "../../../vendor/pixelfx/core/index.js";
import { crystal } from "../../../vendor/pixelfx/core/index.js";
import { area, body, sigil, motes, shock, floorFlash, eye, faded, INK } from "./_lib.js";

export const meta = {
  name: "Undine",
  desc: "A water spirit rises from a pool, lifts her arms and brings a freezing wave down over the whole area.",
  tags: ["summon", "water", "ice"],
  size: [300, 300],
  origin: [150, 220],
  duration: 2.3,
  impact: 1.05,
  loop: false,
  fps: 30,
  options: { palette: ["#081830", "#0e2e5a", "#14508c", "#1c76bc", "#36a2e0", "#78ccf4", "#c4ecff", "#ffffff"], radius: 2, seed: 5 }
};

const SKIN = ["#2a6aa8", "#58a8e0", "#9cdcf8", "#e0f8ff"].map(hex);
const HAIR = ["#123a78", "#1f62b0", "#3f94dc", "#8cd0ff"].map(hex);

const risen = (t) => (t < 1.5 ? ease.outCubic(clamp((t - 0.2) / 0.5)) : 1 - ease.inQuad(clamp((t - 1.5) / 0.55)));

function maiden(p, t, C) {
  const e = risen(t), drop = (1 - e) * 120, bob = Math.sin(t * 4) * 2;
  const y0 = -78 + drop + bob, x0 = -4;
  // arms: up over the head with an orb of water (0.6-0.95), then flung forward at the wave
  const up = clamp((t - 0.55) / 0.3) * (1 - clamp((t - 0.95) / 0.12));
  const fling = clamp((t - 0.95) / 0.12) * (1 - clamp((t - 1.5) / 0.3));
  const hand = (side) => {
    const sx = x0 + side * 9, sy = y0 + 14;
    const hx = sx + side * (16 - up * 12) + fling * 18, hy = sy + 14 - up * 40 - fling * 6;
    return [sx, sy, hx, hy];
  };
  // a column of water from the pool up to her waist
  const waist = y0 + 34;
  if (waist < 0) {
    for (let y = waist; y < 2; y += 2) {
      const w = 7 + (y - waist) * 0.25 + Math.sin(y * 0.3 + t * 10) * 1.5;
      p.rect(x0 - w + Math.sin(y * 0.2 + t * 6) * 2, y, w * 2, 2, y % 4 ? C[4] : C[5], 0.9);
    }
    p.glowLine(x0, waist, x0, 0, 12, C[5], 0.4);
  }
  // hair streaming out behind, to the left, in waves
  const strands = [];
  for (let s = 0; s < 5; s++) for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    strands.push([x0 - 2 - u * 34 - s * 2, y0 - 4 + u * (14 + s * 6) + Math.sin(u * 6 + t * 7 + s) * 4, 4.5 - u * 3]);
  }
  const torso = [[x0, y0 + 14, 8], [x0, y0 + 22, 7], [x0, y0 + 29, 6.5]];
  const head = [[x0, y0, 7.5]];
  const arms = [];
  for (const side of [-1, 1]) {
    const [sx, sy, hx, hy] = hand(side);
    for (let i = 0; i <= 6; i++) arms.push([sx + (hx - sx) * (i / 6), sy + (hy - sy) * (i / 6), 2.6 - i * 0.15]);
  }
  const vis = (q) => q.filter((b) => b[1] < 2);
  body(p, vis(strands), HAIR);
  body(p, vis([...torso, ...arms, ...head]), SKIN);
  if (y0 < 0) {
    // face, a crown of foam, eyes
    p.line(x0 - 6, y0 - 6, x0 + 6, y0 - 6, HAIR[3]);
    for (let i = -6; i <= 6; i += 3) p.px(x0 + i, y0 - 8 - (Math.abs(i) < 3 ? 2 : 0), WHITE);
    eye(p, x0 - 3, y0, C, 0.4);
    eye(p, x0 + 3, y0, C, 0.4);
    // gown of flowing water at the hips
    p.tri(x0 - 7, y0 + 30, x0 + 7, y0 + 30, x0 + Math.sin(t * 5) * 4, y0 + 46, C[5], 0.8);
  }
  // the orb gathered between her hands
  if (up > 0.2) {
    const [, , lx, ly] = hand(-1), [, , hx2, hy2] = hand(1);
    const ox = (lx + hx2) / 2, oy = (ly + hy2) / 2 - 6, r = up * 9;
    p.circle(ox, oy, r + 1, INK, up);
    p.circle(ox, oy, r, (d, a) => (d < 0.4 ? C[7] : Math.sin(a + t * 8) > 0.3 ? C[6] : C[5]), up);
    p.glow(ox, oy, 26, C[5], 0.6 * up);
  }
  p.glow(x0, y0 + 20, 50, C[4], 0.3 * e);
}

// the wave: a curling wall that rises at the back of the area and rolls forward over it
function wave(p, t, C, rx, ry, seed) {
  const u = clamp((t - 0.82) / 0.4);
  if (u <= 0 || t > 1.6) return;
  const k = 1 - clamp((t - 1.2) / 0.4);
  const front = -ry + u * ry * 2.1; // the crest moves from the far edge to the near one
  const h = Math.sin(Math.min(1, u * 1.2) * Math.PI) * 70 + 8;
  for (let x = -rx - 6; x <= rx + 6; x += 2) {
    const edge = Math.sqrt(Math.max(0, 1 - (x / (rx + 8)) ** 2));
    const base = front * edge, top = base - h * edge;
    // the wall, darker at the foot, white at the curl
    for (let y = top; y < base; y += 1) {
      const v = (y - top) / Math.max(1, base - top);
      p.dot(x, y, v < 0.12 ? WHITE : v < 0.3 ? C[6] : v < 0.6 ? C[5] : C[4], k);
      p.dot(x + 1, y, v < 0.12 ? C[7] : v < 0.3 ? C[6] : C[4], k);
    }
    // the lip curling forward and spray off the top
    const lip = top - 2 + Math.sin(x * 0.3 + t * 20) * 2;
    p.dot(x, lip, WHITE, k);
    if (rand(seed, x, Math.floor(t * 20)) < 0.25) p.dot(x, lip - 3 - rand(x, seed) * 8, C[6], k * 0.8);
  }
  p.glow(0, front - h * 0.5, rx, C[5], 0.4 * k);
}

export function draw(p, t, o) {
  const C = o.palette.map((c) => (typeof c === "number" ? c : hex(c)));
  const { rx, ry } = area(o.radius);
  sigil(p, t, C, rx, ry, { inT: 0.3, outT: 1.9, flash: 1.05, spin: -0.7 });
  // a pool swirling at the heart of the circle
  const pool = clamp((t - 0.1) / 0.2) * (1 - clamp((t - 1.7) / 0.4));
  if (pool > 0) {
    p.ellipse(0, 0, 26, 12, (d, a) => (Math.sin(a * 3 - t * 9 + d * 6) > 0.4 ? C[5] : d > 0.8 ? C[6] : C[3]), pool);
    p.glow(0, 0, 30, C[5], 0.4 * pool);
  }
  maiden(p, t, C);
  wave(p, t, C, rx, ry, o.seed);
  floorFlash(p, t, 1.05, 0.4, rx, ry, C);
  shock(p, t, 1.05, 0.4, rx, ry, C, 3);
  // frost spikes where the wave broke, melting away
  const frost = clamp((t - 1.1) / 0.15) * (1 - clamp((t - 1.75) / 0.4));
  if (frost > 0) {
    const ICE = ["#0c1430", "#1f4f94", "#58b4ec", "#9bdcff", "#d8f4ff", "#ffffff"];
    for (let i = 0; i < 16; i++) {
      const g = rand(o.seed, i, 1) * TAU, d = 0.25 + Math.sqrt(rand(o.seed, i, 2)) * 0.7;
      const x = Math.cos(g) * d * rx, y = Math.sin(g) * d * ry;
      faded(p, frost, () => crystal(p, x, y, 6 + rand(i, 3) * 10 * frost, 3, rand(i, 4) - 0.5, ICE));
    }
  }
  // spray: beads thrown up as the wave lands
  if (t > 1.0 && t < 1.8) cycle(t, 0.5, 40, o.seed + 2, 0.45, (age, life, R) => {
    const g = R.range(0, TAU), d = Math.sqrt(R.next());
    const x = Math.cos(g) * d * rx + R.range(-8, 8) * age * 3, y = Math.sin(g) * d * ry - (R.range(80, 160) * age - 300 * age * age);
    p.dot(x, y, R.chance(0.5) ? WHITE : C[6], 1 - age / life);
  });
  motes(p, t, 1.1, 2.0, rx, ry, C, o.seed + 9, 24, 50);
}
