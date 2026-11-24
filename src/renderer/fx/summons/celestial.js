// Celestial Call (the Summoner's Master signature): a shaft of light opens, a winged being of pure
// light descends in it, spreads six wings, and lances of light fall all over the area.
import { clamp, ease, rand, TAU, hex, WHITE, flare } from "../../../vendor/pixelfx/core/index.js";
import { area, body, sigil, motes, shock, floorFlash, pillar, eye, shape, INK } from "./_lib.js";

export const meta = {
  name: "Celestial Call",
  desc: "A being of light descends in a shaft of light, spreads six wings, and lances of light fall all over the area.",
  tags: ["summon", "holy"],
  size: [320, 320],
  origin: [160, 230],
  duration: 2.5,
  impact: 1.1,
  loop: false,
  fps: 30,
  options: { palette: ["#2a1c08", "#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff"], radius: 2, seed: 17 }
};

const ROBE = ["#b89a60", "#e8d4a0", "#fff4d8", "#ffffff"].map(hex);
const WING = ["#c8a040", "#f0d070", "#fff0b0", "#ffffff"].map(hex);

function y0At(t) {
  if (t < 0.9) return -230 + ease.outCubic(clamp((t - 0.2) / 0.7)) * 130;
  if (t < 1.65) return -100 + Math.sin(t * 4) * 2;
  return -100 - ease.inQuad(clamp((t - 1.65) / 0.6)) * 180;
}

function being(p, t, C) {
  const y = y0At(t), open = ease.outBack(clamp((t - 0.8) / 0.25)) * (1 - clamp((t - 1.65) / 0.3) * 0.6);
  // six wings in three pairs, feathers layered from the root out
  for (const [pair, ang, len] of [[0, -0.9, 62], [1, -0.25, 74], [2, 0.45, 52]]) for (const side of [-1, 1]) {
    const a = (ang - (1 - open) * 0.9) * 1;
    const ex = side * Math.cos(a) * len * (0.3 + open * 0.7), ey = Math.sin(a) * len * 0.7 * (0.3 + open * 0.7);
    for (let f = 0; f < 7; f++) {
      const u = f / 6, fx = side * 6 + ex * u, fy = y + 4 + pair * 4 + ey * u;
      const fl = 10 + u * 12;
      shape(p, [[fx, fy - 3], [fx + side * fl * 0.4, fy - 2], [fx + side * fl, fy + 8 + pair * 2], [fx, fy + 4]], WING[f % 2 ? 1 : 2], 0.95);
    }
    p.line(side * 6, y + 4 + pair * 4, side * 6 + ex, y + 4 + pair * 4 + ey, WING[3]);
  }
  // robe, body, head with a halo
  shape(p, [[-10, y], [10, y], [16, y + 44], [0, y + 50], [-16, y + 44]], ROBE[1]);
  p.line(0, y + 6, 0, y + 46, ROBE[0]);
  p.line(-14, y + 43, 14, y + 43, ROBE[3]);
  body(p, [[0, y - 8, 7]], ROBE);
  p.ring(0, y - 18, 9, 2, (v) => (v > 0.5 ? WHITE : C[5]));
  p.glow(0, y - 18, 16, C[6], 0.7);
  eye(p, -3, y - 8, C, 0.3);
  eye(p, 2, y - 8, C, 0.3);
  p.glow(0, y + 20, 70, C[5], 0.3 + open * 0.4);
  return [y, open];
}

export function draw(p, t, o) {
  const C = o.palette.map((c) => (typeof c === "number" ? c : hex(c)));
  const { rx, ry } = area(o.radius);
  sigil(p, t, C, rx, ry, { inT: 0.3, outT: 2.0, flash: 1.1, spin: 0.5, points: 8 });
  // the shaft of light it descends in
  const shaft = clamp((t - 0.05) / 0.2) * (1 - clamp((t - 1.1) / 0.5));
  pillar(p, 0, -240, 30, C, shaft);
  if (shaft > 0) {
    p.rect(-12, -240, 24, 240, C[6], shaft * 0.25);
    p.rect(-4, -240, 8, 240, WHITE, shaft * 0.35);
  }
  const [y] = being(p, t, C);
  // lances of light falling all over the area, one after another
  for (let i = 0; i < 12; i++) {
    const g = rand(o.seed, i) * TAU, d = i === 0 ? 0 : 0.3 + Math.sqrt(rand(o.seed, i, 2)) * 0.65;
    const x = Math.cos(g) * d * rx, gy = Math.sin(g) * d * ry, at = 1.0 + i * 0.035, a = t - at;
    if (a < -0.12 || a > 0.3) continue;
    if (a < 0) {
      // the lance falling
      const u = (a + 0.12) / 0.12, top = -200 + u * 200 + gy;
      p.beam(x, top - 24, x, top, 3, (uu) => (uu > 0.6 ? WHITE : C[6]));
      p.glowLine(x, top - 24, x, top, 6, C[5], 0.6);
    } else {
      const k = 1 - a / 0.3;
      flare(p, x, gy - 2, 10 * k + 2, k, ["#d8a428", "#ffd84a", "#fff09a", "#ffffff"]);
      p.glow(x, gy, 18, C[5], 0.8 * k);
      p.glowLine(x, gy, x, gy - 40 * k, 4, C[6], 0.5 * k);
    }
  }
  floorFlash(p, t, 1.1, 0.5, rx, ry, C);
  shock(p, t, 1.08, 0.45, rx, ry, C, 4);
  motes(p, t, 1.1, 2.2, rx, ry, C, o.seed + 9, 34, 90);
}
