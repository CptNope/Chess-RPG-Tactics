// Shared by Chess RPG Tactics' summon effects (0.24.0), written against the pixelfx toolkit
// (see src/vendor/pixelfx). Files starting with _ are helpers, not effects.
//
// A summon plays over the whole battlefield (the game draws it in front of the board), centred on
// the aimed tile: a summoning circle on the floor the size of the spell's area, the creature, its
// attack, and a fade. Bodies are built from shaded discs with a dark outline, in the same 48 px
// character scale as the units, so the creatures read as pixel art alongside them.

import { clamp, hex, TAU, rand, WHITE } from "../../../vendor/pixelfx/core/index.js";

/** Effect pixels per world unit (sprites: 48 px per 1.35 units). */
export const PX = 48 / 1.35;

/**
 * The floor ellipse of an area of radius `r` tiles, as it sits under the isometric camera: the
 * area's diamond reads as a box about 0.7 tiles wide per tile of radius, squashed by the view.
 */
export function area(r = 2) {
  const rx = Math.round(0.707 * (r + 0.5) * PX);
  return { rx, ry: Math.round(rx * 0.7) };
}

export const INK = hex("#0b0a10");

/** Shading of a lit disc (light from the upper left): 0 dark, 1 mid, 2 light, 3 highlight. */
export function tone(d, ang) {
  const v = Math.cos(ang + 2.356) * d;
  return v > 0.62 ? 3 : v > 0.18 ? 2 : v < -0.42 ? 0 : 1;
}

/**
 * Body parts as discs: [x, y, r] each. Draws every outline first, then every fill, so the outline
 * only shows round the silhouette. S: [dark, mid, light, highlight] colors. a: alpha (dithered).
 */
export function body(p, parts, S, a = 1, ink = INK) {
  for (const [x, y, r] of parts) if (r > 0.3) p.circle(x, y, r + 1, ink, a);
  for (const [x, y, r] of parts) if (r > 0.3) p.circle(x, y, r, (d, ang) => S[tone(d, ang)], a);
}

/** Points along a path f(u) for u in 0..1, every `step` px or so, each with radius rad(u). */
export function along(f, rad, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, [x, y] = f(u);
    out.push([x, y, rad(u)]);
  }
  return out;
}

/** A polygon with a 1 px dark outline (the outline is the polygon pushed out from its centre). */
export function shape(p, pts, c, a = 1, ink = INK) {
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  cx /= pts.length; cy /= pts.length;
  const grow = pts.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
    return [x + (dx / l) * 1.2, y + (dy / l) * 1.2];
  });
  p.poly(grow, ink, a);
  p.poly(pts, c, a);
}

/**
 * The summoning circle on the floor, rx by ry: an outer double ring of dashes turning one way, an
 * inner ring and a star turning the other, rune ticks, a glowing heart. `t` in seconds; it draws in
 * over `inT`, burns bright at `flash` (a time, or -1), and fades out from `outT` over 0.4 s.
 * near: draw the near half (true), the far half (false) or both (undefined).
 */
export function sigil(p, t, C, rx, ry, { inT = 0.3, outT = 9, flash = -1, spin = 0.6, points = 6, near } = {}) {
  const reveal = clamp(t / inT), fade = 1 - clamp((t - outT) / 0.4);
  if (fade <= 0) return;
  const hot = flash >= 0 && t >= flash && t < flash + 0.12;
  const k = fade * (0.7 + 0.3 * Math.sin(t * 9));
  const keep = (ang) => near === undefined || (Math.sin(ang) >= 0) === near;
  const ell = (R, a0, a1, step, col, a) => {
    for (let g = a0; g < a1; g += step) {
      if (!keep(g)) continue;
      p.dot(Math.cos(g) * R * rx, Math.sin(g) * R * ry, col, a);
    }
  };
  const step = 0.9 / Math.max(rx, 8);
  // outer ring: a solid line drawn in from the front, and dashes turning round it
  ell(1, Math.PI / 2 - Math.PI * reveal, Math.PI / 2 + Math.PI * reveal, step, hot ? WHITE : C[5], fade);
  for (let i = 0; i < 40; i++) {
    const g = (i / 40) * TAU + t * spin;
    if (i % 2 || !keep(g) || reveal < 1) continue;
    for (let j = 0; j < 3; j++) p.dot(Math.cos(g + j * step) * 0.9 * rx, Math.sin(g + j * step) * 0.9 * ry, hot ? WHITE : C[4], fade);
  }
  if (reveal >= 1) ell(0.62, 0, TAU, step * 1.3, hot ? WHITE : C[4], fade * 0.9);
  // a star turning the other way, its points touching the inner ring
  if (t > inT * 0.6) {
    const pts = [];
    for (let i = 0; i < points; i++) {
      const g = (i / points) * TAU - t * spin * 0.7;
      pts.push([Math.cos(g) * 0.62 * rx, Math.sin(g) * 0.62 * ry, g]);
    }
    const a = fade * clamp((t - inT * 0.6) / 0.2);
    for (let i = 0; i < points; i++) {
      const A = pts[i], B = pts[(i + 2) % points];
      if (near !== undefined && !keep((A[2] + B[2]) / 2)) continue;
      p.line(A[0], A[1], B[0], B[1], hot ? WHITE : C[3], a);
    }
    // rune ticks on the outer band
    for (let i = 0; i < 12; i++) {
      const g = (i / 12) * TAU + t * spin;
      if (!keep(g)) continue;
      const x = Math.cos(g) * 0.78 * rx, y = Math.sin(g) * 0.78 * ry;
      p.dot(x, y, hot ? WHITE : C[6], a);
      p.dot(x + (i % 2 ? 1 : -1), y, C[5], a * 0.8);
      p.dot(x, y - 1, C[4], a * 0.7);
    }
  }
  // glow: the rim and the heart
  for (let i = 0; i < 10; i++) {
    const g = (i / 10) * TAU + t * spin;
    if (keep(g)) p.glow(Math.cos(g) * rx, Math.sin(g) * ry, 10, C[4], 0.22 * k * reveal);
  }
  p.glow(0, 0, rx * 0.45, C[4], (hot ? 0.9 : 0.3) * k);
}

/** A soft column of light from the floor up to `top` (negative), `w` wide. */
export function pillar(p, x, top, w, C, k) {
  if (k <= 0.01) return;
  p.glowLine(x, 0, x, top, w, C[4], 0.35 * k);
  p.glowLine(x, 0, x, top * 0.8, w * 0.45, C[6], 0.45 * k);
}

/** Motes drifting up from the floor ellipse. */
export function motes(p, t, t0, t1, rx, ry, C, seed, rate = 40, rise = 60) {
  const n = Math.floor((Math.min(t, t1) - t0) * rate);
  for (let i = 0; i <= n; i++) {
    const born = t0 + i / rate, age = t - born, life = 0.5 + rand(seed, i, 1) * 0.6;
    if (age < 0 || age > life) continue;
    const g = rand(seed, i, 2) * TAU, d = Math.sqrt(rand(seed, i, 3));
    const x = Math.cos(g) * d * rx + Math.sin(age * 6 + i) * 2, y = Math.sin(g) * d * ry - age * rise;
    const u = age / life;
    p.dot(x, y, u < 0.3 ? WHITE : u < 0.6 ? C[6] : C[5], 1 - u * 0.7);
    p.light(x, y, C[5], 0.5 * (1 - u));
  }
}

/** A flash of light over the floor ellipse: bright at `at`, fading over `len` seconds. */
export function floorFlash(p, t, at, len, rx, ry, C) {
  const u = (t - at) / len;
  if (u < 0 || u > 1) return;
  const k = 1 - u;
  p.glow(0, 0, rx * 1.15, C[5], 0.9 * k);
  for (let i = 0; i < 7; i++) {
    const g = (i / 7) * TAU;
    p.glow(Math.cos(g) * rx * 0.6, Math.sin(g) * ry * 0.6, rx * 0.5, C[6], 0.35 * k);
  }
}

/** A ring racing out over the floor from the centre to the area's edge. */
export function shock(p, t, at, len, rx, ry, C, th = 3) {
  const u = (t - at) / len;
  if (u < 0 || u > 1) return;
  const R = Math.sqrt(u) * 1.05;
  for (let g = 0; g < TAU; g += 0.6 / Math.max(rx * R, 4)) {
    for (let w = 0; w < th; w++) {
      const r = R - w / Math.max(rx, 1);
      p.dot(Math.cos(g) * rx * r, Math.sin(g) * ry * r, w === 0 ? WHITE : C[6 - Math.min(w, 3)], 1 - u);
    }
  }
  p.glowRing(0, 0, rx * R, 8, C[5], 0.4 * (1 - u));
}

/** Runs `draw` with every pixel faded to alpha a (dithered), e.g. a creature fading out. */
export function faded(p, a, draw) {
  if (a <= 0.01) return;
  const f = p.fade;
  p.fade = f * clamp(a);
  draw();
  p.fade = f;
}

/** An eye: a bright pixel with a glint, and a glow. */
export function eye(p, x, y, C, k = 0.5) {
  p.px(x, y, WHITE);
  p.px(x + 1, y, C[6]);
  p.glow(x, y, 6, C[5], k);
}
