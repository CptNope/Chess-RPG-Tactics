// Cinderwing (grand summon): a firebird of rebirth circles high over the circle trailing flame,
// dives into its heart and bursts into golden fire; feathers of light rise from the ashes and the
// bird is reborn out of them and flies up and away.
import { clamp, ease, rand, TAU, hex, WHITE, cycle } from "../../../vendor/pixelfx/core/index.js";
import { area, sigil, motes, shock, floorFlash, pillar, eye, shape, body, INK } from "./_lib.js";

export const meta = {
  name: "Cinderwing",
  desc: "A firebird circles above, dives into the circle and bursts into golden fire; it is reborn from the ashes as the fallen rise.",
  tags: ["summon", "fire", "holy", "heal", "raise"],
  size: [320, 330],
  origin: [160, 240],
  duration: 2.8,
  impact: 1.4,
  loop: false,
  fps: 30,
  options: { palette: ["#2a1c08", "#5a2a10", "#a8481a", "#e8801e", "#ffb83a", "#ffe27a", "#fffbe6", "#ffffff"], radius: 2, seed: 19 }
};

const PLUME = ["#8c1d1c", "#e0561e", "#ffae35", "#ffe27a"].map(hex);
const GOLD = ["#86520c", "#f0b424", "#ffe066", "#fff6c4"].map(hex);

// the flight: a wide circle high up, a dive into the heart, then (reborn) up and away
function flight(t, rx) {
  if (t < 1.05) {
    const g = -Math.PI / 2 + (t - 0.1) * 6.2;
    return { x: Math.cos(g) * rx * 0.9, y: -150 + Math.sin(g) * 22, dir: -Math.sin(g) > 0 ? 1 : -1, show: t > 0.1 };
  }
  if (t < 1.4) {
    const u = ease.inQuad((t - 1.05) / 0.35);
    return { x: rx * 0.9 * Math.cos(-Math.PI / 2 + 0.95 * 6.2) * (1 - u), y: -150 + u * 150, dir: 1, show: true, dive: u };
  }
  if (t < 1.9) return { show: false };
  const u = ease.inOutQuad(clamp((t - 1.9) / 0.85));
  return { x: u * 40, y: -20 - u * 220, dir: 1, show: true, reborn: clamp((t - 1.9) / 0.2) };
}

function bird(p, t, f, C) {
  const { x, y, dir } = f;
  const beat = f.dive ? -0.8 : Math.sin(t * 13);
  const a = f.reborn !== undefined ? f.reborn : 1;
  // wings of flame
  for (const side of [-1, 1]) {
    const tipY = y - 8 - beat * 26, span = 52;
    const pts = [[x + side * 4, y - 3], [x + side * span * 0.5, y - 10 - beat * 12], [x + side * span, tipY], [x + side * span * 0.75, tipY + 12], [x + side * span * 0.45, y + 6], [x + side * 4, y + 6]];
    shape(p, pts, PLUME[1], a);
    shape(p, pts.map(([px, py]) => [x + (px - x) * 0.7, y + (py - y) * 0.7]), PLUME[2], a);
    // flame licking off the trailing edge
    for (let i = 0; i < 5; i++) {
      const u = 0.3 + i * 0.15, fx = x + side * span * u, fy = y + 4 + (tipY - y) * u * 0.5 + 6;
      p.tri(fx - 2, fy, fx + 2, fy, fx + side * 2, fy + 6 + Math.sin(t * 30 + i) * 3, PLUME[3], a);
    }
  }
  // long tail plumes streaming behind
  for (let s = -1; s <= 1; s++) {
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push([x - dir * i * 4.5, y + 6 + i * 2 + s * i * 1.2 + Math.sin(t * 12 + i * 0.6 + s) * 2]);
    for (let i = 1; i < pts.length; i++) p.beam(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 3.5 - i * 0.25, i < 4 ? PLUME[3] : PLUME[2], a);
    p.circle(pts[10][0], pts[10][1], 2.5, GOLD[2], a);
  }
  body(p, [[x, y + 2, 7], [x + dir * 7, y - 6, 5]], GOLD, a);
  p.tri(x + dir * 11, y - 7, x + dir * 17, y - 5, x + dir * 11, y - 4, GOLD[3], a);
  for (let i = 0; i < 3; i++) p.line(x + dir * 5, y - 10, x + dir * (2 - i * 3), y - 18 - i * 2, PLUME[3], a);
  eye(p, x + dir * 8, y - 7, C, 0.5);
  p.glow(x, y, 44, C[4], 0.6 * a);
}

export function draw(p, t, o) {
  const C = o.palette.map((c) => (typeof c === "number" ? c : hex(c)));
  const { rx, ry } = area(o.radius);
  sigil(p, t, C, rx, ry, { inT: 0.35, outT: 2.3, flash: 1.4, spin: 0.7, points: 7 });
  const f = flight(t, rx);
  // a trail of embers behind the bird as it circles and dives
  if (t < 1.4) for (let i = 1; i < 14; i++) {
    const g = flight(Math.max(0, t - i * 0.025), rx);
    if (!g.show) continue;
    p.circle(g.x, g.y + 2, Math.max(0.6, 4 - i * 0.28), i < 4 ? C[6] : i < 8 ? C[5] : C[3], 1 - i / 14);
    p.light(g.x, g.y, C[5], 0.25 * (1 - i / 14));
  }
  if (f.show) bird(p, t, f, C);
  // the burst: golden fire, a ring of feathers flung out over the area
  const b = t - 1.4;
  if (b > 0 && b < 0.7) {
    const k = 1 - b / 0.7;
    p.circle(0, -6, 30 * Math.sqrt(b / 0.7) + 6, (d) => (d < 0.4 ? WHITE : d < 0.7 ? C[6] : C[5]), k);
    p.glow(0, -10, 90, C[5], 0.9 * k);
    for (let i = 0; i < 24; i++) {
      const g = (i / 24) * TAU, r = b * 260;
      const x = Math.cos(g) * Math.min(r, rx * 1.05), y = Math.sin(g) * Math.min(r, rx * 1.05) * 0.7 - 20 * Math.sin(b * 4);
      p.line(x, y, x - Math.cos(g) * 6, y - Math.sin(g) * 4 + 2, PLUME[3], k);
      p.px(x, y, WHITE);
    }
  }
  floorFlash(p, t, 1.4, 0.6, rx, ry, C);
  shock(p, t, 1.4, 0.5, rx, ry, C, 4);
  // pillars of rebirth rising from the area, and feathers of light floating up
  const rise = clamp((t - 1.45) / 0.15) * (1 - clamp((t - 2.2) / 0.5));
  if (rise > 0) {
    for (let i = 0; i < 5; i++) {
      const g = rand(o.seed, i) * TAU, d = 0.2 + rand(o.seed, i, 2) * 0.7;
      pillar(p, Math.cos(g) * d * rx, -90 - i * 8, 8, C, rise * (0.6 + 0.4 * Math.sin(t * 9 + i)));
    }
    cycle(t, 0.7, 40, o.seed + 5, 0.65, (age, life, R) => {
      const g = R.range(0, TAU), d = Math.sqrt(R.next()), k = age / life;
      const x = Math.cos(g) * d * rx + Math.sin(age * 8 + g) * 4, y = Math.sin(g) * d * ry - age * 110;
      p.line(x - 1, y + 2, x + 1, y - 2, k < 0.5 ? C[6] : C[5], rise * (1 - k));
      p.light(x, y, C[5], 0.4 * rise * (1 - k));
    });
  }
  motes(p, t, 1.5, 2.5, rx, ry, C, o.seed + 9, 34, 80);
}
