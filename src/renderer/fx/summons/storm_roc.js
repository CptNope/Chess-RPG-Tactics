// Storm Roc: storm clouds gather, a great thunderbird swoops in over the circle, spreads its wings
// with a cry, and lightning rains down all over the area; then it wheels away.
import { clamp, ease, rand, TAU, hex, WHITE, cycle, bolt, rng } from "../../../vendor/pixelfx/core/index.js";
import { area, body, sigil, motes, shock, floorFlash, eye, shape, INK } from "./_lib.js";

export const meta = {
  name: "Storm Roc",
  desc: "Storm clouds gather, a great thunderbird swoops over the area and calls down a rain of lightning.",
  tags: ["summon", "lightning"],
  size: [320, 320],
  origin: [160, 230],
  duration: 2.3,
  impact: 1.0,
  loop: false,
  fps: 30,
  options: { palette: ["#0a0f2e", "#172a78", "#2550d0", "#3f8cff", "#7cc8ff", "#c8f0ff", "#ffffff", "#ffffff"], radius: 2, seed: 7 }
};

const FEATHER = ["#1b2140", "#2c3a70", "#4a64b0", "#8eb0f0"].map(hex);
const GOLD = ["#6a4a10", "#c08a1c", "#f0c040", "#fff0a0"].map(hex);
const CLOUD = ["#141626", "#20243a", "#2e3450", "#424a6a"].map(hex);

// where the bird is: in from the upper left, hovering over the circle, away to the upper right
function flight(t) {
  if (t < 0.75) {
    const u = ease.outCubic(clamp((t - 0.1) / 0.65));
    return [-190 + u * 190, -40 - 100 * (1 - u) - 80 * u - Math.sin(u * Math.PI) * 20];
  }
  if (t < 1.45) return [Math.sin(t * 3) * 3, -120 + Math.sin(t * 6) * 3];
  const u = ease.inCubic(clamp((t - 1.45) / 0.6));
  return [u * 220, -120 - u * 120];
}

function roc(p, t, C) {
  const [bx, by] = flight(t);
  if (bx > 200) return [bx, by];
  // wings: beating on the way in, spread wide for the cry
  const spread = clamp((t - 0.75) / 0.12) * (1 - clamp((t - 1.3) / 0.15));
  const beat = (1 - spread) * Math.sin(t * 16);
  const span = 70 + spread * 18;
  for (const side of [-1, 1]) {
    const tipY = by - 10 - beat * 34 - spread * 22, midY = by - 6 - beat * 16 - spread * 10;
    const pts = [[bx + side * 6, by - 4], [bx + side * span * 0.45, midY - 4], [bx + side * span, tipY],
      [bx + side * span * 0.85, tipY + 10], [bx + side * span * 0.7, midY + 14], [bx + side * span * 0.5, midY + 12], [bx + side * span * 0.3, by + 12], [bx + side * 6, by + 8]];
    shape(p, pts, FEATHER[1]);
    // feather tips and a bright leading edge
    for (let f = 0; f < 6; f++) {
      const u = 0.35 + f * 0.11, x = bx + side * span * u, y = midY + 8 + (tipY - midY) * (u - 0.35) * 1.4 + 6;
      p.line(x, y - 4, x + side * 2, y + 6, FEATHER[0]);
    }
    p.line(bx + side * 6, by - 4, bx + side * span * 0.45, midY - 4, FEATHER[3]);
    p.line(bx + side * span * 0.45, midY - 4, bx + side * span, tipY, FEATHER[2]);
    // sparks running along the wing
    if (rand(Math.floor(t * 20), side) < 0.6) {
      const u = rand(Math.floor(t * 20), side, 2), x = bx + side * span * u, y = by - 4 + (tipY - by) * u;
      p.px(x, y, WHITE);
      p.glow(x, y, 8, C[4], 0.6);
    }
  }
  // tail fan, body, head with a hooked gold beak and a crest
  shape(p, [[bx - 9, by + 10], [bx + 9, by + 10], [bx + 14, by + 34], [bx, by + 28], [bx - 14, by + 34]], FEATHER[1]);
  body(p, [[bx, by + 4, 11], [bx, by - 8, 8], [bx, by - 18, 7]], FEATHER);
  shape(p, [[bx - 2, by - 16], [bx + 3, by - 16], [bx + 1, by - 9]], GOLD[2]);
  for (let i = 0; i < 4; i++) p.line(bx - 2 + i, by - 24, bx - 8 + i * 3, by - 34 - (i % 2) * 4, i % 2 ? GOLD[2] : FEATHER[3]);
  eye(p, bx - 4, by - 20, C, 0.6);
  eye(p, bx + 3, by - 20, C, 0.6);
  p.glow(bx, by, 40, C[4], 0.35 + spread * 0.4);
  return [bx, by];
}

export function draw(p, t, o) {
  const C = o.palette.map((c) => (typeof c === "number" ? c : hex(c)));
  const { rx, ry } = area(o.radius);
  sigil(p, t, C, rx, ry, { inT: 0.3, outT: 1.85, flash: 1.0, spin: 1.2 });
  // clouds rolling in over the top of the area
  const cl = clamp(t / 0.35) * (1 - clamp((t - 1.6) / 0.5));
  if (cl > 0) for (let i = 0; i < 14; i++) {
    const x = (i / 13 - 0.5) * rx * 2.6 + Math.sin(t + i) * 4, y = -170 + rand(o.seed, i) * 18;
    p.disc(x, y, 14 + rand(o.seed, i, 2) * 12, (d) => CLOUD[d < 0.4 ? 3 : d < 0.75 ? 2 : 1], cl * 0.85);
  }
  const [bx, by] = roc(p, t, C);
  // the cry: a ring of light round the bird
  if (t > 0.82 && t < 1.05) p.glowRing(bx, by, (t - 0.82) * 260, 6, C[5], 0.6);
  // bolts: one from the bird to the heart, the rest from the clouds all over the area
  const strikes = [[0, 0, 0.92, true]];
  for (let i = 0; i < 9; i++) {
    const g = rand(o.seed, i, 1) * TAU, d = 0.3 + Math.sqrt(rand(o.seed, i, 2)) * 0.65;
    strikes.push([Math.cos(g) * d * rx, Math.sin(g) * d * ry, 0.95 + i * 0.045, false]);
  }
  for (const [x, y, at, fromBird] of strikes) {
    const a = t - at;
    if (a < 0 || a > 0.22) continue;
    const k = a < 0.05 ? 1 : 1 - (a - 0.05) / 0.17;
    const R = rng(o.seed, Math.round(x * 10 + y));
    const pts = bolt(R, fromBird ? bx : x + R.range(-20, 20), fromBird ? by + 10 : -165, x, y, { jag: 0.25, depth: 5 });
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      if (fromBird) p.beam(x0, y0, x1, y1, 3, C[5], k);
      p.line(x0, y0, x1, y1, WHITE, k);
      p.line(x0 + 1, y0, x1 + 1, y1, C[5], k * 0.8);
    }
    p.glowLine(pts[0][0], pts[0][1], x, y, fromBird ? 16 : 9, C[4], 0.6 * k);
    p.glow(x, y, 16, C[5], 0.9 * k);
    for (let s = 0; s < 6; s++) p.dot(x + R.range(-8, 8) * a * 20, y - R.range(0, 6) * a * 20, WHITE, k);
  }
  floorFlash(p, t, 0.96, 0.4, rx, ry, C);
  shock(p, t, 0.96, 0.4, rx, ry, C, 3);
  motes(p, t, 1.1, 2.0, rx, ry, C, o.seed + 9, 26, 70);
  // a few feathers drifting down
  if (t > 0.9) for (let i = 0; i < 5; i++) {
    const a = t - 0.9 - i * 0.08;
    if (a < 0 || a > 1.2) continue;
    const x = (rand(o.seed, i, 5) - 0.5) * 80 + Math.sin(a * 5 + i) * 8, y = -110 + a * 90;
    p.line(x - 2, y, x + 2, y - 1, FEATHER[3], 1 - a / 1.2);
    p.px(x - 3, y + 1, FEATHER[2]);
  }
}
