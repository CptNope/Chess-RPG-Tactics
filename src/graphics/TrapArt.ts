/**
 * Trap icons (0.49.0): drawn flat on the tile for the squad's own traps only (the other side's
 * stay hidden). Pixel art, 16 × 16, like the unit sprites.
 */
import type { TrapKind } from '../core/Traps';

export const TRAP_SIZE = 16;

/** Draws a trap of `kind` on a new 16 × 16 canvas. */
export function drawTrap(kind: TrapKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TRAP_SIZE;
  c.height = TRAP_SIZE;
  const g = c.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // A faint dashed square says "this tile is trapped"
  for (let i = 0; i < 16; i += 4) {
    px(i, 0, 2, 1, '#f59e0b'); px(i, 15, 2, 1, '#f59e0b');
    px(0, i, 1, 2, '#f59e0b'); px(15, i, 1, 2, '#f59e0b');
  }
  if (kind === 'snare') {
    // A rope loop with a knot and a stake
    const rope = '#c08a4a', dark = '#6b4423';
    px(4, 4, 8, 1, rope); px(4, 11, 8, 1, rope); px(3, 5, 1, 6, rope); px(12, 5, 1, 6, rope);
    px(4, 5, 1, 1, dark); px(11, 10, 1, 1, dark);
    px(12, 7, 2, 2, dark); px(13, 9, 1, 4, dark);
  } else if (kind === 'spikes') {
    // Three rows of iron spikes
    const steel = '#cbd5e1', shade = '#64748b';
    for (const [x, y] of [[3, 4], [7, 4], [11, 4], [5, 8], [9, 8], [3, 11], [7, 11], [11, 11]]) {
      px(x + 1, y - 2, 1, 1, steel); px(x, y - 1, 3, 1, steel); px(x, y, 3, 1, shade);
    }
  } else if (kind === 'slumber') {
    // A stoppered flask of violet gas, and a "z"
    px(6, 3, 4, 2, '#a16207'); px(5, 5, 6, 1, '#e9d5ff');
    px(4, 6, 8, 6, '#a78bfa'); px(5, 7, 2, 2, '#ede9fe'); px(5, 12, 6, 1, '#7c3aed');
    px(11, 2, 3, 1, '#ede9fe'); px(12, 3, 1, 1, '#ede9fe'); px(11, 4, 3, 1, '#ede9fe');
  } else {
    // A clay smoke pot with a grey puff
    px(4, 8, 8, 5, '#9a3412'); px(5, 9, 2, 1, '#c2410c'); px(4, 13, 8, 1, '#7c2d12');
    px(5, 4, 3, 3, '#9ca3af'); px(8, 3, 3, 3, '#d1d5db'); px(7, 6, 3, 2, '#9ca3af');
  }
  return c;
}
