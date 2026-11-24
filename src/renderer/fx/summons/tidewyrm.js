// Tidewyrm (grand summon): a whirlpool opens in a wide circle, a sea serpent arches up out of it,
// rears over the area and dives back in, bringing the sea down on everything inside: a wall of
// water rolls over the whole area and leaves it glazed with frost.
import { clamp, ease, rand, TAU, hex, WHITE, cycle } from "../../../vendor/pixelfx/core/index.js";
import { crystal } from "../../../vendor/pixelfx/core/index.js";
import { area, body, sigil, motes, shock, floorFlash, eye, faded, INK } from "./_lib.js";

export const meta = {
  name: "Tidewyrm",
  desc: "A sea serpent arches up out of a whirlpool and dives back in, bringing a wall of water down over a very wide area.",
  tags: ["summon", "water", "ice"],
  size: [360, 340],
  origin: [180, 250],
  duration: 2.8,
  impact: 1.35,
  loop: false,
  fps: 30,
  options: { palette: ["#081830", "#0e2e5a", "#14508c", "#1c76bc", "#36a2e0", "#78ccf4", "#c4ecff", "#ffffff"], radius: 3, seed: 23 }
};

const SCALE = ["#0c2a48", "#17587a", "#2a8a9c", "#7ad0c8"].map(hex);
const BELLY = ["#7a9a8a", "#b8d8c0", "#e0f4e0", "#ffffff"].map(hex);
const FIN = hex("#3fb8c8");

// how high the arch stands (0 under the water, 1 fully up), then the dive
const arch = (t) => (t < 1.0 ? ease.outCubic(clamp((t - 0.3) / 0.55)) : 1 - ease.inCubic(clamp((t - 1.0) / 0.35)) * 0.6);

function serpent(p, t, C) {
  const e = arch(t);
  if (t > 1.9 || e <= 0) return;
  const k = 1 - clamp((t - 1.5) / 0.35);
  // the body: out of the water at the back left, up over the top, the neck curving down at the front
  const dive = clamp((t - 1.0) / 0.35);
  const path = (u) => {
    const x = -70 + u * 140, h = Math.sin(u * Math.PI * 0.85) * 170 * e;
    return [x + Math.sin(u * 6 + t * 3) * 4, -12 - h + dive * u * u * 90];
  };
  const parts = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40, [x, y] = path(u);
    if (y > 0) continue;
    parts.push([x, y, 13 - Math.abs(u - 0.55) * 8]);
  }
  // fins along the back
  for (let i = 4; i <= 32; i += 4) {
    const [x, y] = path(i / 40), [x2, y2] = path((i + 1) / 40);
    if (y > -6) continue;
    const nx = -(y2 - y), ny = x2 - x, L = Math.hypot(nx, ny) || 1;
    p.tri(x, y, x2, y2, x - (nx / L) * 14 + 3, y - (ny / L) * 14, INK, k);
    p.tri(x + 0.5, y, x2, y2, x - (nx / L) * 12 + 3, y - (ny / L) * 12, FIN, k);
  }
  faded(p, k, () => body(p, parts, SCALE));
  // scales: a pale belly line and darker marks along the back
  for (let i = 1; i <= 38; i++) {
    const u = i / 40, [x, y] = path(u);
    if (y > 0) continue;
    p.dot(x, y + 7, BELLY[i % 3 ? 1 : 2], k);
    if (i % 3 === 0) p.dot(x - 2, y - 6, SCALE[0], k);
  }
  // the head at the end of the arch, mouth wide, mane streaming
  const [hx, hy] = path(1);
  if (hy < 6) {
    faded(p, k, () => {
      body(p, [[hx + 6, hy + 8, 6], [hx + 2, hy - 2, 11], [hx + 12, hy + 2, 8], [hx + 20, hy + 4, 5]], SCALE);
      p.ellipse(hx + 15, hy + 9, 6, 2.5, hex("#04121e"));
      for (let i = 0; i < 4; i++) p.px(hx + 11 + i * 3, hy + 7, WHITE);
      for (let i = 0; i < 6; i++) {
        const a = -2.2 - i * 0.18 + Math.sin(t * 9 + i) * 0.1;
        p.line(hx - 2, hy - 6, hx - 2 + Math.cos(a) * (16 + i * 2), hy - 6 + Math.sin(a) * (16 + i * 2), i % 2 ? FIN : SCALE[3]);
      }
      p.line(hx + 4, hy - 10, hx - 6, hy - 22, SCALE[3]);
    });
    eye(p, hx + 6, hy - 4, C, 0.7 * k);
  }
  // water pouring off it
  cycle(t, 0.4, 30, 77, 0.35, (age, life, R, i) => {
    const [x, y] = path(R.next());
    if (y > -4) return;
    p.dot(x + R.range(-8, 8), y + 8 + age * 120 + 300 * age * age, R.chance(0.4) ? WHITE : C[5], k * (1 - age / life));
  });
}

/** The wall of water: rises at the back edge and rolls over the whole area to the front. */
function flood(p, t, C, rx, ry, seed) {
  const u = clamp((t - 1.15) / 0.45);
  if (u <= 0 || t > 2.0) return;
  const k = 1 - clamp((t - 1.6) / 0.4);
  const front = -ry * 1.1 + u * ry * 2.3, h = Math.sin(Math.min(1, u * 1.15) * Math.PI) * 95 + 10;
  for (let x = -rx - 8; x <= rx + 8; x += 2) {
    const edge = Math.sqrt(Math.max(0, 1 - (x / (rx + 10)) ** 2));
    const base = front * edge, top = base - h * (0.4 + 0.6 * edge);
    for (let y = top; y < base; y++) {
      const v = (y - top) / Math.max(1, base - top);
      const c = v < 0.08 ? WHITE : v < 0.25 ? C[6] : v < 0.55 ? C[5] : v < 0.8 ? C[4] : C[3];
      p.dot(x, y, c, k);
      p.dot(x + 1, y, v < 0.25 ? C[6] : C[4], k);
    }
    if (rand(seed, x, Math.floor(t * 24)) < 0.35) p.dot(x, top - 2 - rand(x, seed) * 10, WHITE, k);
  }
  p.glow(0, front - h * 0.5, rx * 1.1, C[5], 0.45 * k);
}

export function draw(p, t, o) {
  const C = o.palette.map((c) => (typeof c === "number" ? c : hex(c)));
  const { rx, ry } = area(o.radius);
  sigil(p, t, C, rx, ry, { inT: 0.4, outT: 2.3, flash: 1.35, spin: -0.6, points: 8 });
  // the whirlpool: spiral arms of foam turning in the circle
  const pool = clamp((t - 0.1) / 0.3) * (1 - clamp((t - 1.9) / 0.5));
  if (pool > 0) {
    p.ellipse(0, 0, rx * 0.55, ry * 0.55, C[2], pool * 0.7);
    for (let arm = 0; arm < 4; arm++) for (let s = 0; s < 1; s += 0.012) {
      const g = arm * (TAU / 4) + s * 7 - t * 4, r = s * 0.55;
      p.dot(Math.cos(g) * rx * r, Math.sin(g) * ry * r, s > 0.7 ? C[6] : C[5], pool);
    }
    p.glow(0, 0, rx * 0.5, C[4], 0.5 * pool);
  }
  serpent(p, t, C);
  flood(p, t, C, rx, ry, o.seed);
  floorFlash(p, t, 1.4, 0.5, rx, ry, C);
  shock(p, t, 1.35, 0.5, rx, ry, C, 4);
  // frost left behind
  const frost = clamp((t - 1.55) / 0.15) * (1 - clamp((t - 2.3) / 0.45));
  if (frost > 0) {
    const ICE = ["#0c1430", "#1f4f94", "#58b4ec", "#9bdcff", "#d8f4ff", "#ffffff"];
    for (let i = 0; i < 26; i++) {
      const g = rand(o.seed, i, 1) * TAU, d = 0.2 + Math.sqrt(rand(o.seed, i, 2)) * 0.75;
      faded(p, frost, () => crystal(p, Math.cos(g) * d * rx, Math.sin(g) * d * ry, 5 + rand(i, 3) * 12 * frost, 3, rand(i, 4) - 0.5, ICE));
    }
  }
  motes(p, t, 1.5, 2.5, rx, ry, C, o.seed + 9, 30, 50);
}
