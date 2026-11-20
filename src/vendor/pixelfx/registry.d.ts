// Types for the parts of pixelfx the game calls.
export interface FxMeta {
  name: string;
  size: [number, number];
  origin: [number, number];
  duration: number;
  loop: boolean;
  fps?: number;
  options?: Record<string, unknown>;
}
export interface FxModule {
  meta: FxMeta;
}
export interface FxFrame {
  w: number;
  h: number;
  ox: number;
  oy: number;
  color: Uint32Array;
  light: Uint32Array;
}
export interface FxInstance {
  meta: FxMeta;
  readonly t: number;
  update(dt: number): void;
  draw(frame: FxFrame, layer?: 'back' | 'front'): void;
  stop(): void;
  done(): boolean;
}
export const EFFECTS: Record<string, FxModule>;
export function createFrame(w: number, h: number, ox?: number, oy?: number): FxFrame;
export function clearFrame(f: FxFrame): FxFrame;
export function createFx(mod: FxModule, o?: Record<string, unknown>): FxInstance;
export function composite(f: FxFrame, out: Uint8ClampedArray, bg?: null | number, lightK?: number): Uint8ClampedArray;
export const PAL: Record<string, string[]>;
