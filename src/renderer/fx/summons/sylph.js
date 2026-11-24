// Sylph: a wind fairy flutters down into a whirl of leaves, spins, and opens her arms: a soft rain
// of green light falls over the whole area and leaves spiral up and away.
import { clamp, ease, rand, TAU, hex, WHITE, cycle } from "../../../vendor/pixelfx/core/index.js";
import { area, body, sigil, motes, floorFlash, eye, INK } from "./_lib.js";

export const meta = {
  name: "Sylph",
  desc: "A wind fairy descends into a whirl of leaves and opens her arms: healing light rains over the whole area.",
  tags: ["summon", "heal", "wind"],
  size: [300, 300],
  origin: [150, 220],
  duration: 2.2,
  impact: 1.0,
  loop: false,
  fps: 30,
  options: { palette: ["#08201a", "#0f3f2c", "#17663e", "#24924e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"], radius: 2, seed: 11 }
};

const SKIN = ["#b0805a", "#e8b088", "#ffd8b8", "#fff0e0"].map(hex);
const DRESS = ["#1d6a3a", "#2fa058", "#6ad884", "#c8ffd0"].map(hex);
const HAIR = ["#2a7a3a", "#4ab05a", "#88e070", "#d8ffb0"].map(hex);
const LEAF = ["#357530", "#4f9a3a", "#7cc048", "#b4e070"].map(hex);

function pos(t) {
  if (t < 0.8) {
    const u = ease.outCubic(clamp((t - 0.15) / 0.65));
    return [Math.sin(u * 8) * 26 * (1 - u), -190 + u * 120];
  }
  if (t < 1.5) return [Math.sin(t * 3) * 3, -70 + Math.sin(t * 5) * 3];
  const u = ease.inQuad(clamp((t - 1.5) / 0.6));
  return [u * 40, -70 - u * 160];
}

function fairy(p, t, C) {
  const [x, y] = pos(t);
  const open = clamp((t - 0.85) / 0.15) * (1 - clamp((t - 1.45) / 0.2));
  const spin = t > 0.55 && t < 0.85 ? Math.cos((t - 0.55) * 21) : 1; // a twirl before the blessing
  // four dragonfly wings, translucent, beating
  const beat = Math.sin(t * 40) * 0.25;
  for (const side of [-1, 1]) for (const [ang, len, w] of [[-0.6, 34, 9], [0.35, 26, 7]]) {
    const a = ang + side * beat - Math.PI / 2;
    const ex = x + side * Math.abs(Math.cos(a)) * len * Math.abs(spin), ey = y - 6 + Math.sin(a) * len * 0.6;
    for (let i = 0; i <= 10; i++) {
      const u = i / 10, cx = x + (ex - x) * u, cy = y - 6 + (ey - y + 6) * u, r = Math.sin(u * Math.PI) * w * 0.5 + 0.5;
      p.disc(cx, cy, r, (d) => (d > 0.8 ? C[6] : C[5]), 0.45);
    }
    p.line(x, y - 6, ex, ey, C[6], 0.8);
    p.glowLine(x, y - 6, ex, ey, 5, C[5], 0.3);
  }
  // dress, body, arms, head and hair
  const sx = Math.max(0.35, Math.abs(spin));
  p.tri(x - 9 * sx, y + 14, x + 9 * sx, y + 14, x, y - 2, INK);
  p.tri(x - 8 * sx, y + 13, x + 8 * sx, y + 13, x, y - 1, DRESS[1]);
  p.line(x - 7 * sx, y + 12, x + 7 * sx, y + 12, DRESS[3]);
  const arms = [];
  for (const side of [-1, 1]) {
    const hx = x + side * (5 + open * 12) * sx, hy = y + 4 - open * 12;
    for (let i = 0; i <= 4; i++) arms.push([x + side * 3 * sx + (hx - x - side * 3 * sx) * (i / 4), y + (hy - y) * (i / 4), 1.6]);
  }
  body(p, [...arms, [x, y - 2, 4], [x, y - 11, 5.5]], SKIN);
  body(p, [[x - 4 * sx, y - 14, 3.5], [x + 3 * sx, y - 15, 3.5], [x - 6 * sx, y - 9, 3], [x - 8 * sx - 3, y - 6 + Math.sin(t * 9) * 2, 2.5]], HAIR);
  p.line(x - 2, y + 14, x - 2, y + 19, SKIN[1]);
  p.line(x + 2, y + 14, x + 2, y + 18, SKIN[1]);
  if (spin > 0) {
    eye(p, x - 2, y - 11, C, 0.3);
    eye(p, x + 2, y - 11, C, 0.3);
  }
  p.glow(x, y, 34, C[5], 0.4 + open * 0.5);
  return [x, y, open];
}

export function draw(p, t, o) {
  const C = o.palette.map((c) => (typeof c === "number" ? c : hex(c)));
  const { rx, ry } = area(o.radius);
  sigil(p, t, C, rx, ry, { inT: 0.35, outT: 1.8, flash: 1.0, spin: 0.5, points: 5 });
  // a whirl of leaves winding up round the area
  const whirl = clamp((t - 0.1) / 0.3) * (1 - clamp((t - 1.7) / 0.4));
  if (whirl > 0) for (let i = 0; i < 34; i++) {
    const ph = rand(o.seed, i) * TAU, h = (rand(o.seed, i, 2) + t * 0.5) % 1;
    const g = ph + t * (2.5 + h * 2), r = 1 - h * 0.6;
    const x = Math.cos(g) * rx * r, y = Math.sin(g) * ry * r - h * 130;
    const L = LEAF[i % 4], front = Math.sin(g) > 0;
    p.line(x - 2, y, x + 2, y - 1 - (i % 2), L, whirl * (front ? 1 : 0.6));
    p.px(x, y - 1, LEAF[3]);
  }
  const [fx, fy, open] = fairy(p, t, C);
  // the blessing: rain of green light over the area
  if (t > 0.95 && t < 1.8) cycle(t, 0.35, 60, o.seed + 1, 0.3, (age, life, R) => {
    const g = R.range(0, TAU), d = Math.sqrt(R.next());
    const x = Math.cos(g) * d * rx, gy = Math.sin(g) * d * ry, k = age / life;
    const y = gy - (1 - k) * 90;
    const a = clamp((t - 0.95) / 0.1) * (1 - clamp((t - 1.5) / 0.3));
    p.line(x, y, x, y + 4, k > 0.8 ? WHITE : C[6], a);
    p.light(x, y, C[5], 0.4 * a);
    if (k > 0.85) p.dot(x + 1, gy, C[7], a);
  });
  if (open > 0.1) p.glowRing(fx, fy, open * 50, 6, C[6], 0.5 * open);
  floorFlash(p, t, 1.0, 0.6, rx, ry, C);
  motes(p, t, 1.0, 2.0, rx, ry, C, o.seed + 9, 40, 80);
}
