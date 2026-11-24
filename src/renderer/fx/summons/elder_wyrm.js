// Elder Wyrm (grand summon): the sky goes dark and starry, the head of an ancient dragon lowers out
// of it on a long neck, gathers starlight in its jaws, and breathes a beam of starfire into the heart
// of the circle: a dome of light swells over the whole area and bursts.
import { clamp, ease, rand, TAU, hex, WHITE, flare } from "../../../vendor/pixelfx/core/index.js";
import { area, body, sigil, motes, shock, floorFlash, eye, shape, INK } from "./_lib.js";

export const meta = {
  name: "Elder Wyrm",
  desc: "An ancient dragon lowers its head out of a starry sky and breathes starfire into the circle; a dome of light bursts over the whole area.",
  tags: ["summon", "dragon", "arcane"],
  size: [340, 360],
  origin: [170, 260],
  duration: 2.9,
  impact: 1.4,
  loop: false,
  fps: 30,
  options: { palette: ["#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"], radius: 2, seed: 29 }
};

const HIDE = ["#1a1430", "#2e2550", "#4a3c7a", "#7a6aa8"].map(hex);
const HORN = ["#5e5648", "#b8ad96", "#e4dcc8", "#fffaf0"].map(hex);
const MAW = hex("#08040e");

// the head comes down out of the dark, holds while it breathes, then withdraws
const lower = (t) => (t < 1.65 ? ease.outCubic(clamp((t - 0.25) / 0.65)) : 1 - ease.inCubic(clamp((t - 1.65) / 0.7)));

function wyrm(p, t, C) {
  const e = lower(t);
  if (e <= 0.01) return null;
  const K = 1.7, hx = 56, hy = -230 + e * 120 + Math.sin(t * 3) * 2;
  const jaw = clamp((t - 0.85) / 0.2) * (1 - clamp((t - 1.6) / 0.2));
  const ax = hx, ay = hy, X = (dx) => ax + dx * K, Y = (dy) => ay + dy * K;
  // the neck: from off the top of the frame down to the back of the skull
  const neck = [];
  for (let i = 0; i <= 18; i++) {
    const u = i / 18;
    neck.push([hx + 70 - u * 60 + Math.sin(u * 3 + t) * 6, hy - 150 + u * 140, 19 - u * 3]);
  }
  body(p, neck, HIDE);
  for (let i = 1; i < 18; i += 2) {
    const [x, y, r] = neck[i];
    p.tri(x + r - 3, y - 5, x + r - 3, y + 5, x + r + 12, y - 2, INK);
    p.tri(x + r - 3, y - 4, x + r - 3, y + 4, x + r + 10, y - 2, HIDE[3]);
  }
  // the head turned down-left toward the circle: skull, long snout, lower jaw dropping open
  body(p, [[X(-26), Y(18 + jaw * 14), 6 * K], [X(-14), Y(14 + jaw * 10), 8 * K]], HIDE);
  if (jaw > 0.1) shape(p, [[X(-34), Y(10)], [X(-6), Y(6)], [X(-10), Y(14 + jaw * 10)], [X(-30), Y(16 + jaw * 12)]], MAW);
  body(p, [[X(4), Y(-6), 15 * K], [X(-12), Y(0), 11 * K], [X(-26), Y(6), 8 * K], [X(-36), Y(10), 5.5 * K]], HIDE);
  // scales on the skull and a lit ridge
  for (let i = 0; i < 9; i++) p.dot(X(-30 + i * 4), Y(2 - i * 0.9), HIDE[3]);
  for (let i = 0; i < 6; i++) p.tri(X(-32 + i * 5), Y(13), X(-30 + i * 5), Y(13), X(-31 + i * 5), Y(17 + jaw * 3), HORN[3]);
  // brow, horns sweeping back, a cheek frill
  p.line(X(-22), Y(-4), X(2), Y(-14), INK);
  for (const [ox, oy, len, w] of [[2, -16, 34, 4], [10, -10, 26, 3]]) {
    const pts = [[X(ox), Y(oy - w)], [X(ox + len), Y(oy - len * 0.55)], [X(ox + len * 0.6), Y(oy - len * 0.2)], [X(ox), Y(oy + w)]];
    shape(p, pts, HORN[1]);
    p.line(X(ox), Y(oy - w + 1), X(ox + len - 2), Y(oy - len * 0.55 + 1), HORN[3]);
  }
  for (let i = 0; i < 4; i++) p.tri(X(14), Y(i * 4 - 4), X(14), Y(i * 4), X(24 + i * 2), Y(i * 5), HIDE[2]);
  p.circle(X(-10), Y(-7), 2.5, INK);
  eye(p, X(-10), Y(-7), C, 0.9);
  p.px(X(-10) + 1, Y(-7) + 1, C[5]);
  p.glow(X(-10), Y(-7), 18, C[5], 0.8);
  const mx = X(-28), my = Y(13);
  return { mx, my, jaw };
}

export function draw(p, t, o) {
  const C = o.palette.map((c) => (typeof c === "number" ? c : hex(c)));
  const { rx, ry } = area(o.radius);
  // the sky darkening, with stars coming out across the top
  const night = clamp(t / 0.4) * (1 - clamp((t - 2.3) / 0.5));
  if (night > 0) for (let i = 0; i < 60; i++) {
    const x = (rand(o.seed, i) - 0.5) * 320, y = -330 + rand(o.seed, i, 2) * 200, tw = 0.5 + 0.5 * Math.sin(t * 6 + i);
    p.dot(x, y, i % 5 ? C[6] : WHITE, night * tw);
    if (i % 7 === 0) p.glow(x, y, 5, C[5], 0.4 * night * tw);
  }
  sigil(p, t, C, rx, ry, { inT: 0.4, outT: 2.4, flash: 1.4, spin: -0.8, points: 5 });
  const w = wyrm(p, t, C);
  // starlight gathering in its jaws, then the beam into the heart of the circle
  if (w) {
    const g = clamp((t - 0.9) / 0.35) * (1 - clamp((t - 1.3) / 0.05));
    if (g > 0) {
      flare(p, w.mx, w.my, 6 + g * 14, g, ["#481c88", "#9a48ec", "#ecc8ff", "#ffffff"]);
      p.glow(w.mx, w.my, 30, C[5], 0.8 * g);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + t * 4, r = 30 * (1 - ((t * 3 + i * 0.1) % 1));
        p.dot(w.mx + Math.cos(a) * r, w.my + Math.sin(a) * r, C[6], g);
      }
    }
    const b = clamp((t - 1.3) / 0.05) * (1 - clamp((t - 1.65) / 0.15));
    if (b > 0) {
      const wid = 10 + Math.sin(t * 50) * 2;
      p.beam(w.mx, w.my, 0, -4, wid * b, (u, v) => (v < 0.35 ? WHITE : v < 0.7 ? C[6] : C[4]), b);
      p.glowLine(w.mx, w.my, 0, -4, 26, C[5], 0.9 * b);
    }
  }
  // the dome of light swelling over the area and bursting
  const d = t - 1.35;
  if (d > 0 && d < 0.75) {
    const u = clamp(d / 0.3), k = 1 - clamp((d - 0.3) / 0.45);
    const H = 80 * ease.outCubic(u), RX = rx * (0.4 + 0.65 * u), RY = ry * 0.6 + H * 0.6;
    for (let g = 0; g < TAU; g += 0.5 / RX) for (let w = 0; w < 3; w++) {
      const f = 1 - w / RX;
      p.dot(Math.cos(g) * RX * f, -H * 0.35 + Math.sin(g) * RY * f, w ? C[6] : WHITE, k);
    }
    p.ellipse(0, -H * 0.35, RX * 0.35, RY * 0.35, WHITE, k);
    p.glow(0, -H * 0.4, rx * 1.3, C[5], 1.0 * k);
    p.glow(0, -H * 0.4, rx * 0.7, C[6], 0.8 * k);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, r = (0.5 + d * 1.6);
      p.line(Math.cos(a) * rx * 0.3, Math.sin(a) * ry * 0.3 - 10, Math.cos(a) * rx * r, Math.sin(a) * ry * r - 10, C[6], k * 0.8);
    }
  }
  floorFlash(p, t, 1.4, 0.6, rx, ry, C);
  shock(p, t, 1.45, 0.5, rx, ry, C, 5);
  motes(p, t, 1.6, 2.6, rx, ry, C, o.seed + 9, 34, 90);
}
