/**
 * Remappable controls (0.40.0): which key or controller button does what. The cursor keys,
 * Enter, Space, Escape and Tab stay fixed (they move focus, confirm and cancel everywhere, and
 * a player who rebinds them could lock themselves out), and so do the d-pad, sticks and triggers.
 * Everything else can be changed on the Controls screen, and is kept per browser.
 */
import type { PadAction } from './GamepadInput';

export type KeyAction =
  | 'move' | 'act' | 'wait' | 'auto' | 'item'
  | 'panUp' | 'panLeft' | 'panDown' | 'panRight'
  | 'rotateLeft' | 'rotateRight' | 'zoomIn' | 'zoomOut' | 'recenter'
  | 'team' | 'log' | 'help' | 'fullscreen';

/** Controller actions on buttons that can be moved. */
export type PadButtonAction = Extract<PadAction, 'confirm' | 'cancel' | 'commands' | 'team' | 'rotateLeft' | 'rotateRight' | 'recenter' | 'menu' | 'help'>;

export interface Bindings {
  /** Keys per action, normalized (see normKey). The first is the one shown. */
  keys: Record<KeyAction, string[]>;
  /** Standard-mapping button index per controller action. */
  pad: Record<PadButtonAction, number>;
}

/** The keyboard actions, in the order the Controls screen lists them. */
export const KEY_ACTIONS: { id: KeyAction; label: string }[] = [
  { id: 'move', label: 'Move' },
  { id: 'act', label: 'Act' },
  { id: 'wait', label: 'Wait' },
  { id: 'auto', label: 'Auto' },
  { id: 'item', label: 'Item' },
  { id: 'panUp', label: 'Pan up' },
  { id: 'panLeft', label: 'Pan left' },
  { id: 'panDown', label: 'Pan down' },
  { id: 'panRight', label: 'Pan right' },
  { id: 'rotateLeft', label: 'Rotate left' },
  { id: 'rotateRight', label: 'Rotate right' },
  { id: 'zoomIn', label: 'Zoom in' },
  { id: 'zoomOut', label: 'Zoom out' },
  { id: 'recenter', label: 'Center on the active unit' },
  { id: 'team', label: 'Team' },
  { id: 'log', label: 'Battle log' },
  { id: 'help', label: 'Controls' },
  { id: 'fullscreen', label: 'Fullscreen' }
];

/** The controller actions, in the order the Controls screen lists them. */
export const PAD_ACTIONS: { id: PadButtonAction; label: string }[] = [
  { id: 'confirm', label: 'Select / confirm' },
  { id: 'cancel', label: 'Cancel / back' },
  { id: 'commands', label: 'Command menu' },
  { id: 'team', label: 'Team' },
  { id: 'rotateLeft', label: 'Rotate left' },
  { id: 'rotateRight', label: 'Rotate right' },
  { id: 'recenter', label: 'Center on the active unit' },
  { id: 'menu', label: 'Menu' },
  { id: 'help', label: 'Controls' }
];

export const DEFAULT_KEYS: Record<KeyAction, string[]> = {
  move: ['1'], act: ['2'], wait: ['3'], auto: ['4', 't'], item: ['5', 'i'],
  panUp: ['w'], panLeft: ['a'], panDown: ['s'], panRight: ['d'],
  rotateLeft: ['q'], rotateRight: ['e'], zoomIn: ['+', '='], zoomOut: ['-', '_'],
  recenter: ['r', 'home'], team: ['j'], log: ['l'], help: ['h', '?'], fullscreen: ['f']
};

export const DEFAULT_PAD: Record<PadButtonAction, number> = {
  confirm: 0, cancel: 1, commands: 2, team: 3, rotateLeft: 4, rotateRight: 5, recenter: 11, menu: 9, help: 8
};

/** Keys that can't be bound: they move, confirm and cancel everywhere. */
export const RESERVED_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', ' ', 'escape', 'tab'];

/** Buttons that can't be bound: the d-pad (directions) and the triggers (zoom). */
export const RESERVED_BUTTONS = [6, 7, 12, 13, 14, 15];

/** Standard-mapping button names (Xbox, with PlayStation in brackets). */
export const PAD_BUTTON_NAMES: Record<number, string> = {
  0: 'A (Cross)', 1: 'B (Circle)', 2: 'X (Square)', 3: 'Y (Triangle)', 4: 'LB (L1)', 5: 'RB (R1)', 6: 'LT (L2)', 7: 'RT (R2)',
  8: 'View (Share)', 9: 'Start (Options)', 10: 'Left stick click', 11: 'Right stick click',
  12: 'D-pad up', 13: 'D-pad down', 14: 'D-pad left', 15: 'D-pad right', 16: 'Home (PS)', 17: 'Touchpad'
};

/** A KeyboardEvent.key as stored: single characters lower-cased, named keys lower-cased. */
export function normKey(key: string): string {
  return key.toLowerCase();
}

/** How a stored key reads on screen. */
export function keyLabel(key: string): string {
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function padLabel(button: number): string {
  return PAD_BUTTON_NAMES[button] ?? `Button ${button}`;
}

export function defaultBindings(): Bindings {
  return { keys: Object.fromEntries(Object.entries(DEFAULT_KEYS).map(([a, k]) => [a, [...k]])) as Record<KeyAction, string[]>, pad: { ...DEFAULT_PAD } };
}

/** The keyboard action a key does, if any. */
export function actionForKey(b: Bindings, key: string): KeyAction | undefined {
  const k = normKey(key);
  return (Object.keys(b.keys) as KeyAction[]).find((a) => b.keys[a].includes(k));
}

/** The controller action a button does, if any. */
export function actionForButton(b: Bindings, button: number): PadButtonAction | undefined {
  return (Object.keys(b.pad) as PadButtonAction[]).find((a) => b.pad[a] === button);
}

/**
 * Binds `key` to `action` alone. A reserved key is refused (null). If another action used the
 * key, it loses it, and if that leaves it with no key at all, it takes `action`'s old first key:
 * the two swap, so nothing is ever left unbound.
 */
export function rebindKey(b: Bindings, action: KeyAction, key: string): Bindings | null {
  const k = normKey(key);
  if (!k || RESERVED_KEYS.includes(k)) return null;
  const keys = Object.fromEntries(Object.entries(b.keys).map(([a, ks]) => [a, [...ks]])) as Record<KeyAction, string[]>;
  const old = keys[action][0];
  for (const a of Object.keys(keys) as KeyAction[]) {
    if (a === action || !keys[a].includes(k)) continue;
    keys[a] = keys[a].filter((x) => x !== k);
    if (!keys[a].length && old && old !== k) keys[a] = [old];
  }
  keys[action] = [k];
  return { keys, pad: { ...b.pad } };
}

/**
 * Binds `button` to `action`. A reserved button is refused (null). If another action used the
 * button, the two swap buttons, so Confirm and Cancel can never be lost.
 */
export function rebindButton(b: Bindings, action: PadButtonAction, button: number): Bindings | null {
  if (!Number.isInteger(button) || button < 0 || button > 31 || RESERVED_BUTTONS.includes(button)) return null;
  const pad = { ...b.pad };
  const other = actionForButton(b, button);
  if (other && other !== action) pad[other] = pad[action];
  pad[action] = button;
  return { keys: b.keys, pad };
}

/** Bindings from storage, repaired: unknown actions dropped, missing or broken ones back to their defaults. */
export function sanitizeBindings(raw: unknown): Bindings {
  const b = defaultBindings();
  const r = raw && typeof raw === 'object' ? (raw as { keys?: unknown; pad?: unknown }) : {};
  if (r.keys && typeof r.keys === 'object') {
    let next = b;
    for (const { id } of KEY_ACTIONS) {
      const ks = (r.keys as Record<string, unknown>)[id];
      if (!Array.isArray(ks)) continue;
      const clean = [...new Set(ks.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 12).map(normKey))].filter((k) => !RESERVED_KEYS.includes(k)).slice(0, 3);
      if (!clean.length) continue;
      // Apply through rebindKey so no key ends up on two actions
      next = rebindKey(next, id, clean[0]) ?? next;
      next.keys[id] = [...new Set([...next.keys[id], ...clean.slice(1).filter((k) => !actionForKey(next, k))])];
    }
    b.keys = next.keys;
  }
  if (r.pad && typeof r.pad === 'object') {
    let next = b;
    for (const { id } of PAD_ACTIONS) {
      const btn = (r.pad as Record<string, unknown>)[id];
      if (typeof btn === 'number') next = rebindButton(next, id, btn) ?? next;
    }
    b.pad = next.pad;
  }
  return b;
}

const STORE_KEY = 'chess_rpg_tactics_bindings_v1';

export function loadBindings(): Bindings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return sanitizeBindings(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultBindings();
  }
}

export function saveBindings(b: Bindings): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(b)); } catch { /* private mode: keep them for this visit */ }
}
