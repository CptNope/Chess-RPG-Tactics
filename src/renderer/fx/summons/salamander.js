// Salamander: a fire lizard bursts up out of the circle in a column of flame, rears, and breathes
// a gout of fire that rolls out over the whole area as a burning ring, then sinks back into it.
import { clamp, ease, rand, TAU, hex, cycle } from "../../../vendor/pixelfx/core/index.js";
import { area, body, sigil, pillar, motes, shock, floorFlash, eye, INK } from "./_lib.js";

export const meta = {
  name: "Salamander",
  desc: "A fire lizard rises from a summoning circle in a column of flame and breathes a burning ring over the whole area.",
  tags: ["summon", "fire"],
  size: [300, 300],
  origin: [150, 220],
  duration: 2.3,
  impact: 1.0,
  loop: false,
  fps: 30,
  options: { palette: ["#1f0b10", "#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a", "#fff8d6"], radius: 2, seed: 3 }
};

const SKIN = ["#5a1410", "#a82a14", "#e0561e", "#ffae35"].map(hex);
const BELLY = ["#a8681c", "#e8a83a", "#ffd86a", "#fff3b0"].map(hex);
const MOUTH = hex("#3d0a0a");

// how far out of the circle it has risen (0 under the floor, 1 up), and how far it rears back
const risen = (t) => (t < 1.55 ? ease.outBack(clamp((t - 0.22) / 0.45)) : 1 - ease.inCubic(clamp((t - 1.55) / 0.5)));
const rear = (t) => clamp((t - 0.6) / 0.22) - clamp((t - 0.9) / 0.1) * 1.4 + clamp((t - 1.2) / 0.3) * 0.4;

function lizard(p, t, C) {
  const e = risen(t), drop = (1 - e) * 140, r = rear(t), sway = Math.sin(t * 6) * 2;
  // the torso leans up and to the left of the circle's heart, the head turned to screen right
  const spine = (u) => [-6 - Math.sin(u * 2.6) * 14 + sway * u + r * 8 * u * u, 6 - u * 92 + drop + r * 4 * u];
  const tail = (u) => [10 + Math.cos(u * 4) * 34 * (1 - u * 0.3), 8 - Math.sin(u * 4) * 8 + drop * 0.2];
  const parts = [];
  for (let i = 12; i >= 0; i--) {
    const [x, y] = tail(i / 12);
    if (y < 3 && e > 0.3) parts.push([x, y - 2, 3 + (1 - i / 12) * 7]);
  }
  for (let i = 0; i <= 16; i++) {
    const u = i / 16, [x, y] = spine(u);
    if (y > 4) continue;
    parts.push([x, y, 14 - u * 6]);
  }
  const [nx, ny] = spine(1);
  const hx = nx + 13 - r * 4, hy = ny - 4 - r * 7;
  // forelegs: shoulder, elbow, claws
  const legs = [];
  for (const [side, dx] of [[-1, -12], [1, 9]]) {
    const [sx, sy] = spine(0.62);
    const ex = sx + dx, ey = sy + 14, fx = ex + side * 3, fy = ey + 10;
    if (fy < 6) legs.push({ sx: sx + dx * 0.4, sy, ex, ey, fx, fy });
  }
  body(p, [...legs.flatMap((l) => [[l.sx, l.sy, 5], [l.ex, l.ey, 4], [l.fx, l.fy, 3]]), ...parts], SKIN);
  for (const l of legs) for (let k = -1; k <= 1; k++) p.line(l.fx + k * 2, l.fy + 2, l.fx + k * 3, l.fy + 5, INK);
  // a pale belly down the front of the torso, and spots on its back
  for (let i = 4; i <= 60; i++) {
    const u = i / 64, [x, y] = spine(u), rr = 14 - u * 6;
    if (y < 2) p.ellipse(x + rr * 0.5, y, rr * 0.36, 2.2, (d) => BELLY[d < 0.5 ? 2 : 1]);
    if (y < 2 && i % 12 === 0) p.circle(x - rr * 0.4, y - 2, 1.6, SKIN[0]);
  }
  if (hy < 0) {
    const open = clamp((t - 0.78) / 0.1) * (1 - clamp((t - 1.45) / 0.2));
    // skull, snout and the jaw dropping open for the breath
    body(p, [[hx + 6, hy + 5 + open * 6, 5], [hx + 15, hy + 6 + open * 8, 3.6], [hx - 2, hy, 10], [hx + 9, hy - 1, 7.5], [hx + 17, hy + 1, 5]], SKIN);
    if (open > 0.15) {
      p.ellipse(hx + 13, hy + 5 + open * 3, 5, 1.5 + open * 3, MOUTH);
      for (let k = 0; k < 4; k++) p.px(hx + 9 + k * 3, hy + 4, hex("#fff3d0"));
    }
    // brow ridge, nostril and horns swept back
    p.line(hx - 1, hy - 6, hx + 8, hy - 5, SKIN[0]);
    p.px(hx + 19, hy - 1, INK);
    for (const [ox, len] of [[-6, 16], [0, 13]]) {
      p.line(hx + ox, hy - 7, hx + ox - len, hy - 7 - len * 0.6, INK);
      p.line(hx + ox, hy - 8, hx + ox - len + 1, hy - 8 - len * 0.6, SKIN[3]);
    }
    eye(p, hx + 5, hy - 4, C, 0.7);
  }
  // a crest of flame along its back
  cycle(t, 0.45, 22, 41, 0.3, (age, life, R, i) => {
    const u = 0.05 + (i / 22) * 0.95, [x, y] = spine(u);
    if (y > 0) return;
    const k = age / life, rr = 14 - u * 6, fx = x - rr * 0.8 + R.range(-2, 2), fy = y - rr * 0.5 - k * 16;
    p.circle(fx, fy, (1 - k) * 2.6, k < 0.3 ? C[7] : k < 0.6 ? C[6] : C[4], 1 - k);
    p.light(fx, fy, C[5], 0.5 * (1 - k));
  });
  p.glow(nx, ny + 30, 55, C[4], 0.3 * e);
  return { mx: hx + 18, my: hy + 7, open: clamp((t - 0.8) / 0.08) };
}

export function draw(p, t, o) {
  const C = o.palette.map((c) => (typeof c === "number" ? c : hex(c)));
  const { rx, ry } = area(o.radius);
  sigil(p, t, C, rx, ry, { inT: 0.3, outT: 1.85, flash: 1.0, spin: 0.9 });
  // the column of flame it bursts out of
  const col = clamp((t - 0.1) / 0.15) * (1 - clamp((t - 0.55) / 0.3));
  pillar(p, 0, -150, 30, C, col);
  if (col > 0) cycle(t, 0.4, 40, o.seed, 0.35, (age, life, R) => {
    const k = age / life, x = R.range(-20, 20) * (1 - k * 0.5), y = -k * R.range(70, 160);
    p.circle(x, y, (1 - k) * 5, k < 0.25 ? C[7] : k < 0.5 ? C[6] : C[4], col * (1 - k));
  });
  const { mx, my } = lizard(p, t, C);
  // the breath: a roaring stream from the jaw down into the heart of the area
  const bt = clamp((t - 0.84) / 0.5);
  if (bt > 0 && bt < 1) {
    const k = 1 - clamp((bt - 0.7) / 0.3), tx = 6, ty = 2;
    p.beam(mx, my, tx, ty, 14 * k, (u, v) => (v < 0.3 ? C[7] : v < 0.65 ? C[6] : C[4]), k);
    p.glowLine(mx, my, tx, ty, 18, C[5], 0.7 * k);
    for (let i = 0; i < 30; i++) {
      const s = (i / 30 + t * 2.5) % 1, R = rand(o.seed, i, 7) - 0.5;
      const x = mx + (tx - mx) * s + R * 16 * s, y = my + (ty - my) * s + Math.sin(i + t * 20) * 3 * s;
      p.circle(x, y, 1.5 + s * 5, s < 0.3 ? C[7] : C[5], k * (1 - s * 0.4));
    }
  }
  floorFlash(p, t, 1.0, 0.45, rx, ry, C);
  shock(p, t, 0.98, 0.45, rx, ry, C, 4);
  // fire tongues standing up all over the area after the breath
  const burn = clamp((t - 1.0) / 0.1) * (1 - clamp((t - 1.5) / 0.6));
  if (burn > 0) cycle(t, 0.45, 60, o.seed + 3, 0.4, (age, life, R) => {
    const g = R.range(0, TAU), d = Math.sqrt(R.next());
    const x = Math.cos(g) * d * rx, y0 = Math.sin(g) * d * ry, k = age / life;
    const h = (1 - k) * R.range(8, 22), w = 2 + (1 - k) * 2;
    p.tri(x - w, y0, x + w, y0, x + Math.sin(t * 18 + g) * 2, y0 - h, C[5], burn);
    p.tri(x - w * 0.5, y0, x + w * 0.5, y0, x, y0 - h * 0.6, C[7], burn);
    p.light(x, y0 - h / 2, C[5], 0.4 * burn);
  });
  motes(p, t, 1.05, 2.0, rx, ry, C, o.seed + 9, 30, 70);
}
