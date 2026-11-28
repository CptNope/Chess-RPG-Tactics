/**
 * Totem sprites (0.47.0): a carved wooden pole with a face, side pegs and a glowing crest in the
 * colour of its kind. Drawn pixel by pixel like the unit sprites, 16 × 28.
 */
import type { TotemKind } from '../core/Totems';

export const TOTEM_COLOR: Record<TotemKind, { glow: string; core: string; ring: number }> = {
  mending: { glow: '#4ade80', core: '#dcfce7', ring: 0x4ade80 },
  warding: { glow: '#60a5fa', core: '#dbeafe', ring: 0x60a5fa },
  binding: { glow: '#a78bfa', core: '#ede9fe', ring: 0xa78bfa },
  storm: { glow: '#facc15', core: '#fef9c3', ring: 0xfacc15 },
  ancestral: { glow: '#fbbf24', core: '#ffffff', ring: 0xfbbf24 },
};

export const TOTEM_W = 16;
export const TOTEM_H = 28;

/** Draws a totem of `kind` on a new 16 × 28 canvas. */
export function drawTotem(kind: TotemKind, foe: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TOTEM_W;
  c.height = TOTEM_H;
  const g = c.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const wood = foe ? '#5b3a2a' : '#7c4a22';
  const dark = foe ? '#2a1712' : '#3f2410';
  const light = foe ? '#7a4f3a' : '#a0652e';
  const { glow, core } = TOTEM_COLOR[kind];

  // Outline, then the pole
  px(4, 6, 8, 22, dark);
  px(5, 7, 6, 20, wood);
  px(5, 7, 1, 20, light);
  // Side pegs (wings)
  px(1, 9, 3, 3, dark);
  px(12, 9, 3, 3, dark);
  px(2, 10, 2, 1, glow);
  px(12, 10, 2, 1, glow);
  // Carved face: brow, glowing eyes, mouth
  px(5, 11, 6, 1, dark);
  px(6, 12, 1, 1, glow);
  px(9, 12, 1, 1, glow);
  px(7, 15, 2, 1, dark);
  px(6, 14, 4, 1, dark);
  // Bands lower down
  px(5, 19, 6, 1, dark);
  px(5, 22, 6, 1, dark);
  px(7, 20, 2, 2, glow);
  // Base
  px(3, 26, 10, 2, dark);
  // Crest: a glowing diamond
  px(7, 0, 2, 1, glow);
  px(6, 1, 4, 1, glow);
  px(5, 2, 6, 2, glow);
  px(6, 4, 4, 1, glow);
  px(7, 5, 2, 1, glow);
  px(7, 2, 2, 2, core);
  return c;
}
