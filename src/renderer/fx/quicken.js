// Chess RPG Tactics' own Haste effect, written against the pixelfx toolkit (see src/vendor/pixelfx).
//
// The stock "status/haste" effect trails three after-images up to 42 px behind the character. On a
// crowded isometric board those ghosts land on the neighbouring tiles and read as an effect that
// missed its target. This one stays on the unit: a tight shimmer hugging the silhouette, streaks
// racing up its sides, and a quick ring pulsing at its feet.
import { cycle, fit, rand, TAU } from '../../vendor/pixelfx/core/index.js';
import { shape } from '../../vendor/pixelfx/fx/status/_lib.js';

export const meta = {
  name: 'Quicken',
  desc: 'Sped up, on the spot: a blue shimmer hugs the body, streaks race up both sides and a ring pulses at the feet.',
  tags: ['status', 'haste', 'buff', 'loop'],
  size: [64, 72],
  origin: [32, 62],
  duration: 1.2,
  loop: true,
  fps: 30,
  bg: 'ground',
  actor: 2,
  options: { palette: ['#4c25ab', '#773ae4', '#5b6cff', '#5eb0ff', '#a3dcff', '#ccf6ff', '#ffffff'], seed: 4 }
};

const D = meta.duration;

export function drawBack(p, t, o) {
  const C = fit(o.palette, 7), a = o.actor, f = Math.floor(t * 30);
  // two close after-images, flickering a pixel or two either side: speed without leaving the tile
  for (let g = 2; g >= 1; g--) {
    const dx = (f % 2 ? -1 : 1) * (g * 2 + (rand(f >> 1, g, 3) < 0.5 ? 0 : 1));
    p.outline(a.mask, a.x + dx, a.y, (mx, my) => ((mx + my + f) % (g + 1) ? 0 : C[5 - g]));
  }
  // a ring at the feet, pulsing three times a loop
  const pulse = (t / D) * 3 % 1, rx = 6 + pulse * 10, ry = rx * 0.38;
  for (let i = 0; i < 28; i++) {
    const ang = (i / 28) * TAU;
    if ((i + f) % 3 === 0) continue;
    p.dot(Math.cos(ang) * rx, -1 + Math.sin(ang) * ry, pulse < 0.5 ? C[5] : C[3], 1 - pulse);
  }
  p.glow(0, a.y + a.h * 0.5, 18, C[3], 0.2);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), a = o.actor, S = shape(a), f = Math.floor(t * 15);
  // the silhouette's edges catch the light, flickering
  for (const [x, y] of S.side) if (rand(x, y, f) < 0.4) p.px(a.x + x, a.y + y, rand(y, f, 2) < 0.3 ? C[6] : C[5]);
  // streaks racing straight up, just outside the body on both sides
  const half = a.w / 2 + 3;
  cycle(t, D, 14, o.seed + 7, (r) => r.range(0.14, 0.28), (age, life, r, i) => {
    const u = age / life, side = i % 2 ? 1 : -1;
    const x = Math.round(side * (half + r.range(-3, 3)));
    const len = Math.round(r.range(5, 11)), y0 = -r.range(0, a.h * 0.5) - age * r.range(70, 120);
    for (let d = 0; d < len; d++) {
      if (d > len * 0.5 && d % 2) continue;
      p.dot(x, y0 + d, d < 2 ? C[6] : d < len * 0.5 ? C[5] : C[3], (1 - d / len) * (1 - u));
    }
    p.light(x, y0, C[4], 0.35 * (1 - u));
  });
  p.glow(0, a.y + a.h * 0.4, 14, C[4], 0.1 + 0.05 * Math.sin((t / D) * TAU * 3));
}
