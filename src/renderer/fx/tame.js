// Chess RPG Tactics' own Tame effect (0.28.0), written against the pixelfx toolkit (see src/vendor/pixelfx).
//
// A monster won over: a warm ring closes in on it from wide around, its outline flickers from red to
// gold as it changes sides, and little hearts and paw prints drift up off it.
import { cycle, fit, rand, TAU } from '../../vendor/pixelfx/core/index.js';
import { shape } from '../../vendor/pixelfx/fx/status/_lib.js';

export const meta = {
  name: 'Tamed',
  desc: 'A warm ring closes in at the feet, the outline turns from red to gold, and hearts and paw prints drift up.',
  tags: ['status', 'charm', 'tame', 'buff'],
  size: [72, 80],
  origin: [36, 68],
  duration: 1.5,
  loop: false,
  fps: 30,
  bg: 'ground',
  actor: 2,
  options: { palette: ['#7c2d12', '#c2410c', '#f97316', '#fbbf24', '#fde68a', '#fff7c2', '#ffffff', '#f43f5e', '#fb7185'], seed: 11 }
};

const D = meta.duration;

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const PAW = ['.#.#.', '#...#', '.###.', '#####', '.###.'];

function sprite(p, rows, x, y, c, alpha) {
  const ox = Math.round(x - rows[0].length / 2), oy = Math.round(y - rows.length / 2);
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '#') p.dot(ox + i, oy + j, c, alpha);
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 9), a = o.actor, f = Math.floor(t * 30), u = Math.min(1, t / (D * 0.45));
  // the ring closes in from wide to the feet, then glows there
  const rx = 30 - 22 * u, ry = rx * 0.38;
  for (let i = 0; i < 32; i++) {
    if ((i + f) % 4 === 0) continue;
    const ang = (i / 32) * TAU + t * 3;
    p.dot(Math.cos(ang) * rx, -1 + Math.sin(ang) * ry, u < 1 ? C[3] : C[4], u < 1 ? 0.9 : Math.max(0, 1 - (t - D * 0.45) / (D * 0.55)));
  }
  p.glow(0, a.y + a.h * 0.55, 22, C[3], 0.25 * (1 - Math.abs(t / D - 0.5)));
}

export function draw(p, t, o) {
  const C = fit(o.palette, 9), a = o.actor, S = shape(a), f = Math.floor(t * 20);
  const turn = Math.min(1, Math.max(0, (t - D * 0.3) / (D * 0.3)));
  // the outline flickers from enemy red to friendly gold
  if (t < D * 0.85) for (const [x, y] of S.side) {
    if (rand(x, y, f) < 0.55) p.px(a.x + x, a.y + y, rand(y, f, 3) < turn ? (rand(x, f, 5) < 0.3 ? C[6] : C[4]) : C[1]);
  }
  // hearts and paw prints drifting up once it has turned
  if (t > D * 0.35) {
    cycle(t - D * 0.35, D * 0.65, 7, o.seed, (r) => r.range(0.5, 0.8), (age, life, r, i) => {
      const k = age / life;
      const x = r.range(-a.w / 2 - 4, a.w / 2 + 4) + Math.sin(age * 9 + i) * 2;
      const y = a.y + a.h * 0.2 - age * r.range(30, 45);
      sprite(p, i % 3 === 2 ? PAW : HEART, x, y, i % 3 === 2 ? C[4] : (i % 2 ? C[7] : C[8]), 1 - k);
    });
  }
  p.light(0, a.y + a.h * 0.4, C[5], 0.3 * turn * (1 - t / D));
}
