// Golem: the ground cracks and a stone giant heaves its shoulders up out of the circle, raises both
// fists and brings them down; a golden shield of hexagons rises over the whole area.
import { clamp, ease, rand, TAU, hex, WHITE, cycle } from "../../../vendor/pixelfx/core/index.js";
import { area, sigil, motes, shock, floorFlash, eye, INK } from "./_lib.js";

export const meta = {
  name: "Golem",
  desc: "A stone giant rises from the ground, slams its fists down and raises a shield of light over the whole area.",
  tags: ["summon", "earth", "protect"],
  size: [300, 300],
  origin: [150, 220],
  duration: 2.3,
  impact: 1.0,
  loop: false,
  fps: 30,
  options: { palette: ["#2a1c08", "#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff"], radius: 2, seed: 13 }
};

const STONE = ["#2c2c38", "#4a4a58", "#6e6e7e", "#9a9aaa", "#c4c4d0"].map(hex);
const MOSS = ["#225224", "#357530", "#4f9a3a"].map(hex);

const risen = (t) => (t < 1.55 ? ease.outCubic(clamp((t - 0.25) / 0.5)) : 1 - ease.inQuad(clamp((t - 1.55) / 0.55)));

/** A stone block with a dark outline, a lit top-left edge and cracks. */
function block(p, x, y, w, h, seed) {
  if (y > 2) return;
  const hh = Math.min(h, 2 - y);
  p.rect(x - 1, y - 1, w + 2, hh + 2, INK);
  p.rect(x, y, w, hh, STONE[2]);
  p.rect(x, y, w, 2, STONE[3]);
  p.rect(x, y, 2, hh, STONE[3]);
  p.rect(x + w - 2, y + 2, 2, hh - 2, STONE[1]);
  p.rect(x, y + hh - 2, w, 2, STONE[1]);
  for (let i = 0; i < 3; i++) {
    const cx = x + 3 + rand(seed, i) * (w - 6), cy = y + 3 + rand(seed, i, 2) * (hh - 6);
    p.line(cx, cy, cx + 3, cy + 2, STONE[0]);
  }
  if (rand(seed, 9) < 0.5) p.rect(x + 2, y, Math.min(w - 4, 6), 2, MOSS[1]);
}

function golem(p, t, C) {
  const e = risen(t), drop = (1 - e) * 120;
  const lift = clamp((t - 0.7) / 0.18) * (1 - ease.inQuad(clamp((t - 0.88) / 0.12)));
  const slam = clamp((t - 0.88) / 0.12) * (1 - clamp((t - 1.4) / 0.3));
  const y0 = -86 + drop; // top of the head
  // arms: shoulder to fist, raised above the head, then driven into the floor either side
  for (const side of [-1, 1]) {
    const sx = side * 30, sy = y0 + 32;
    const fx = side * (44 - lift * 18 + slam * 10), fy = sy + 34 - lift * 70 + slam * 30;
    const n = 4;
    for (let i = 0; i <= n; i++) {
      const u = i / n, bx = sx + (fx - sx) * u, by = sy + (fy - sy) * u;
      block(p, bx - 8, by - 8, 16, 16, side * 10 + i);
    }
    block(p, fx - 11, fy - 9, 22, 18, side * 30 + 7); // the fist
    p.line(fx - 9, fy - 2, fx + 9, fy - 2, STONE[1]);
  }
  // shoulders, chest with a glowing rune, head with eyes
  block(p, -38, y0 + 22, 22, 20, 1);
  block(p, 16, y0 + 22, 22, 20, 2);
  block(p, -22, y0 + 26, 44, 40, 3);
  block(p, -24, y0 + 62, 48, 30, 4);
  block(p, -13, y0, 26, 24, 5);
  if (y0 + 40 < 0) {
    const g = 0.6 + 0.4 * Math.sin(t * 8) + slam;
    p.line(-8, y0 + 36, 0, y0 + 46, C[5]);
    p.line(0, y0 + 46, 8, y0 + 36, C[5]);
    p.line(0, y0 + 32, 0, y0 + 54, C[5]);
    p.glow(0, y0 + 43, 18, C[4], 0.5 * g);
  }
  if (y0 + 12 < 0) {
    p.rect(-9, y0 + 9, 18, 3, INK);
    eye(p, -5, y0 + 10, C, 0.6);
    eye(p, 4, y0 + 10, C, 0.6);
  }
  return slam;
}

/** The shield: a dome of hexagons over the area that shimmers and fades. */
function dome(p, t, C, rx, ry) {
  const u = clamp((t - 1.0) / 0.35), k = u * (1 - clamp((t - 1.65) / 0.5));
  if (k <= 0) return;
  const H = 95 * ease.outBack(u);
  for (let row = 0; row <= 6; row++) {
    const v = row / 6, lat = v * Math.PI / 2;
    const rrx = rx * Math.cos(lat), rry = ry * Math.cos(lat), y = -H * Math.sin(lat);
    const n = Math.max(3, Math.round(16 * Math.cos(lat)));
    for (let i = 0; i < n; i++) {
      const g = (i / n) * TAU + row * 0.3 + t * 0.3;
      const x = Math.cos(g) * rrx, yy = Math.sin(g) * rry + y, front = Math.sin(g) > 0;
      const r = 5 * Math.cos(lat) + 2;
      for (let s = 0; s < 6; s++) {
        const a0 = (s / 6) * TAU, a1 = ((s + 1) / 6) * TAU;
        p.line(x + Math.cos(a0) * r, yy + Math.sin(a0) * r * 0.7, x + Math.cos(a1) * r, yy + Math.sin(a1) * r * 0.7, front ? C[6] : C[4], k * (front ? 0.9 : 0.45));
      }
      if (front && rand(i, row, Math.floor(t * 12)) < 0.15) p.glow(x, yy, 8, C[6], 0.5 * k);
    }
  }
  p.glow(0, -H * 0.4, rx, C[5], 0.25 * k);
}

export function draw(p, t, o) {
  const C = o.palette.map((c) => (typeof c === "number" ? c : hex(c)));
  const { rx, ry } = area(o.radius);
  sigil(p, t, C, rx, ry, { inT: 0.3, outT: 1.85, flash: 1.0, spin: 0.4, points: 4 });
  // cracks opening in the floor round the heart
  const cr = clamp((t - 0.15) / 0.25) * (1 - clamp((t - 1.8) / 0.4));
  if (cr > 0) for (let i = 0; i < 7; i++) {
    let x = 0, y = 0, g = (i / 7) * TAU;
    for (let s = 0; s < 8 * cr; s++) {
      const nx = x + Math.cos(g) * 5, ny = y + Math.sin(g) * 3.5;
      p.line(x, y, nx, ny, INK);
      p.line(x, y - 1, nx, ny - 1, C[4], 0.6);
      x = nx; y = ny; g += (rand(o.seed, i, s) - 0.5) * 0.9;
    }
  }
  const slam = golem(p, t, C);
  // the slam: dust and rocks thrown up either side, the floor jolts
  if (t > 0.98 && t < 1.6) cycle(t, 0.6, 30, o.seed + 4, 0.55, (age, life, R, i) => {
    const side = i % 2 ? 1 : -1, k = age / life;
    const x = side * 54 + R.range(-14, 14) + side * age * R.range(30, 70), y = 10 - (R.range(60, 120) * age - 280 * age * age);
    if (i % 3) p.disc(x, y, 3 + k * 6, STONE[3], (1 - k) * 0.6);
    else { p.rect(x - 1, y - 1, 3, 3, INK); p.rect(x, y, 2, 2, STONE[2]); }
  });
  floorFlash(p, t, 1.0, 0.4, rx, ry, C);
  shock(p, t, 0.98, 0.4, rx, ry, C, 3);
  dome(p, t, C, rx, ry);
  motes(p, t, 1.1, 2.0, rx, ry, C, o.seed + 9, 26, 60);
  return slam;
}
