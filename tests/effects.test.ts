/**
 * 0.38.0: per-ability effects. Every effect a cue names is one the game ships, and every vendored
 * effect is used by some cue (so the vendor folder doesn't collect dead weight).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EFFECTS, createFx, createFrame } from '../src/vendor/pixelfx/registry.js';
import { JOBS } from '../src/data/jobs';
import { SIGNATURES } from '../src/data/signatures';

// The library's categories: anything else matched below is a MIME type or a path, not an effect
const PIXELFX_CATEGORIES = new Set(['arcane', 'critters', 'explosions', 'fire', 'holy', 'ice', 'impacts', 'lightning', 'melee', 'moves', 'nature', 'pickups', 'projectiles', 'scifi', 'shadow', 'spawn', 'status', 'transitions', 'ui', 'water', 'weather']);
const fxSource = readFileSync(new URL('../src/renderer/BattleFx.ts', import.meta.url), 'utf8');
// Effects are played from the cue tables in BattleFx, and a few straight from the scene
const sceneSource = ['../src/renderer/TacticsScene.ts', '../src/main.ts'].map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
const named = [...(fxSource + sceneSource).matchAll(/'([a-z]+\/[a-z-]+)'/g)].map((m) => m[1]).filter((id) => PIXELFX_CATEGORIES.has(id.split('/')[0]));

describe('battle effects', () => {
  it('every effect a cue names is vendored', () => {
    for (const id of named) expect(EFFECTS[id], id).toBeDefined();
  });

  it('every vendored effect is played somewhere', () => {
    const used = new Set(named);
    for (const id of Object.keys(EFFECTS)) expect(used.has(id), id).toBe(true);
  });

  it('every new effect draws without throwing, flipped and rotated too', () => {
    for (const id of ['projectiles/arrow', 'projectiles/bullet-tracer', 'projectiles/muzzle-pistol', 'impacts/bullet-impact', 'impacts/heavy-landing', 'melee/thrust', 'melee/uppercut', 'melee/whip-crack', 'melee/claw-swipe', 'melee/hammer-smash', 'lightning/thunderclap', 'ice/frost-nova', 'explosions/smoke-bomb']) {
      const mod = EFFECTS[id];
      const [w, h] = mod.meta.size;
      const frame = createFrame(w, h);
      const fx = createFx(mod, { x: mod.meta.origin[0], y: mod.meta.origin[1], flip: true, angle: -0.4 });
      for (let i = 0; i < 6; i++) {
        fx.update(mod.meta.duration / 6);
        fx.draw(frame, 'back');
        fx.draw(frame, 'front');
      }
      expect(frame.color.some((px: number) => px !== 0), id).toBe(true);
    }
  });

  it('the abilities with a look of their own exist', () => {
    const ids = [...fxSource.matchAll(/^\s{2}([a-z]+_[a-z_]+): \{ id:/gm)].map((m) => m[1]);
    const known = new Set([...Object.values(JOBS).flatMap((j) => j.abilities.map((a) => a.id)), ...Object.values(SIGNATURES).map((s) => s.id)]);
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) expect(known.has(id), id).toBe(true);
  });
});
