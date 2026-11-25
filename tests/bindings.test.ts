/**
 * 0.40.0: remappable keys and controller buttons.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_KEYS, DEFAULT_PAD, KEY_ACTIONS, PAD_ACTIONS, actionForButton, actionForKey, defaultBindings,
  rebindButton, rebindKey, sanitizeBindings
} from '../src/input/Bindings';

describe('bindings', () => {
  it('the defaults are the old fixed controls, one action per key and per button', () => {
    const b = defaultBindings();
    expect(actionForKey(b, 'Q')).toBe('rotateLeft');
    expect(actionForKey(b, 'Home')).toBe('recenter');
    expect(actionForKey(b, '=')).toBe('zoomIn');
    expect(actionForKey(b, 'ArrowUp')).toBeUndefined();
    const keys = Object.values(DEFAULT_KEYS).flat();
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(Object.values(DEFAULT_PAD)).size).toBe(PAD_ACTIONS.length);
    expect(actionForButton(b, 0)).toBe('confirm');
    expect(KEY_ACTIONS.map((a) => a.id).sort()).toEqual(Object.keys(DEFAULT_KEYS).sort());
  });

  it('rebinding a key takes it from its old action, which falls back on the freed key', () => {
    let b = rebindKey(defaultBindings(), 'rotateLeft', 'z')!;
    expect(actionForKey(b, 'z')).toBe('rotateLeft');
    expect(actionForKey(b, 'q')).toBeUndefined();
    // Taking E from Rotate right leaves it with nothing else, so it gets Z
    b = rebindKey(b, 'rotateLeft', 'e')!;
    expect(actionForKey(b, 'e')).toBe('rotateLeft');
    expect(b.keys.rotateRight).toEqual(['z']);
    // Taking T from Auto, which also has 4, leaves it 4
    b = rebindKey(b, 'log', 't')!;
    expect(b.keys.auto).toEqual(['4']);
    // Every action still has a key, and no key is on two actions
    const all = Object.values(b.keys).flat();
    expect(Object.values(b.keys).every((k) => k.length > 0)).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });

  it('the cursor keys, Enter, Space, Escape and Tab stay fixed', () => {
    for (const k of ['ArrowUp', 'Enter', ' ', 'Escape', 'Tab']) expect(rebindKey(defaultBindings(), 'move', k)).toBeNull();
  });

  it('rebinding a button swaps it with the action that had it, so Confirm is never lost', () => {
    const b = rebindButton(defaultBindings(), 'cancel', 0)!;
    expect(b.pad.cancel).toBe(0);
    expect(b.pad.confirm).toBe(1);
    expect(rebindButton(defaultBindings(), 'confirm', 12)).toBeNull(); // d-pad
    expect(rebindButton(defaultBindings(), 'confirm', 7)).toBeNull(); // trigger
  });

  it('stored bindings are repaired: junk dropped, clashes resolved, gaps back to defaults', () => {
    const b = sanitizeBindings({ keys: { rotateLeft: ['Z'], rotateRight: ['z'], move: ['Enter'], nope: ['x'], zoomIn: 'p' }, pad: { confirm: 3, help: 99, menu: 'x' } });
    expect(actionForKey(b, 'z')).toBe('rotateRight');
    expect(b.keys.move).toEqual(['1']);
    expect(b.keys.zoomIn).toEqual(['+', '=']);
    expect(b.pad.confirm).toBe(3);
    expect(b.pad.team).toBe(0); // swapped with Confirm
    expect(b.pad.help).toBe(DEFAULT_PAD.help);
    expect(sanitizeBindings('garbage')).toEqual(defaultBindings());
    const all = Object.values(b.keys).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('controller buttons', () => {
  it('a rebound button fires its new action, and a capture takes the next press instead', async () => {
    const pads: { buttons: { pressed: boolean; value: number }[]; axes: number[]; connected: boolean; id: string }[] = [];
    const g = globalThis as unknown as { window?: unknown; navigator?: unknown };
    const hadWindow = 'window' in g, hadNav = 'navigator' in g;
    Object.defineProperty(globalThis, 'window', { value: { addEventListener() {} }, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true });
    try {
      const { GamepadInput } = await import('../src/input/GamepadInput');
      const pad = new GamepadInput();
      const fired: string[] = [];
      pad.onAction = (a) => fired.push(a);
      const state = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], connected: true, id: 'test' };
      pads.push(state);
      const press = (i: number) => { state.buttons[i].pressed = true; pad.poll(0); state.buttons[i].pressed = false; pad.poll(0); };
      // Confirm and Cancel swapped
      pad.setButtons(rebindButton(defaultBindings(), 'confirm', 1)!.pad);
      press(1);
      press(0);
      expect(fired).toEqual(['confirm', 'cancel']);
      // Waiting for a button: the press is taken, and does nothing else
      let got = -1;
      pad.captureButton((b) => (got = b));
      press(3);
      expect(got).toBe(3);
      expect(fired).toEqual(['confirm', 'cancel']);
    } finally {
      if (!hadWindow) delete (globalThis as { window?: unknown }).window;
      if (!hadNav) delete (globalThis as { navigator?: unknown }).navigator;
    }
  });
});
