/**
 * The Controls screen's keyboard and controller cards (0.40.0): they show the current bindings,
 * and each bindable row has a button that waits for a new key or controller button. The cursor
 * keys, Enter, Space, Escape, the d-pad, sticks and triggers are listed but fixed.
 */
import {
  Bindings, KEY_ACTIONS, KeyAction, PAD_ACTIONS, PadButtonAction, RESERVED_BUTTONS, RESERVED_KEYS,
  defaultBindings, keyLabel, padLabel, rebindButton, rebindKey
} from '../input/Bindings';
import type { GamepadInput } from '../input/GamepadInput';

type Waiting = { kind: 'key'; action: KeyAction; btn: HTMLButtonElement } | { kind: 'pad'; action: PadButtonAction; btn: HTMLButtonElement };

export class ControlsPanel {
  private keyList: HTMLElement;
  private padList: HTMLElement;
  private note: HTMLElement;
  private waiting: Waiting | null = null;
  private timer = 0;

  constructor(
    root: HTMLElement,
    private get: () => Bindings,
    private set: (b: Bindings) => void,
    private pad: GamepadInput
  ) {
    this.keyList = root.querySelector('[data-input="keyboard"] dl')!;
    this.padList = root.querySelector('[data-input="gamepad"] dl')!;
    this.note = document.createElement('p');
    this.note.className = 'bind-note';
    this.note.setAttribute('role', 'status');
    this.note.setAttribute('aria-live', 'polite');
    const reset = document.createElement('button');
    reset.className = 'hud-btn-mini bind-reset';
    reset.textContent = 'Reset controls to defaults';
    reset.addEventListener('click', () => {
      this.stopWaiting();
      this.set(defaultBindings());
      this.say('Every key and button is back to its default.');
      this.render();
    });
    root.querySelector('.help-foot')?.before(this.note, reset);
    // A key pressed while a row waits is taken before the game sees it
    window.addEventListener('keydown', (e) => this.onKey(e), true);
    this.render();
  }

  /** Redraws both cards from the current bindings. */
  public render(): void {
    const b = this.get();
    this.keyList.replaceChildren();
    this.fixed(this.keyList, '←↑↓→', 'Move the cursor, or move between buttons in a menu');
    this.fixed(this.keyList, 'Enter · Space', 'Select / confirm');
    this.fixed(this.keyList, 'Esc', 'Cancel / back');
    for (const { id, label } of KEY_ACTIONS) {
      this.row(this.keyList, b.keys[id].map(keyLabel).join(' · '), label, `Change the key for ${label}`, (btn) => this.startWaiting({ kind: 'key', action: id, btn }));
    }
    this.padList.replaceChildren();
    this.fixed(this.padList, 'D-pad / left stick', 'Move the cursor, or move between buttons in a menu');
    for (const { id, label } of PAD_ACTIONS) {
      this.row(this.padList, padLabel(b.pad[id]), label, `Change the button for ${label}`, (btn) => this.startWaiting({ kind: 'pad', action: id, btn }));
    }
    this.fixed(this.padList, 'LT / RT', 'Zoom out / in');
    this.fixed(this.padList, 'Right stick', 'Pan the camera');
  }

  private fixed(list: HTMLElement, keys: string, what: string): void {
    const dt = document.createElement('dt');
    const kbd = document.createElement('kbd');
    kbd.textContent = keys;
    dt.append(kbd);
    const dd = document.createElement('dd');
    dd.textContent = `${what} (fixed)`;
    list.append(dt, dd);
  }

  private row(list: HTMLElement, current: string, what: string, aria: string, onPick: (btn: HTMLButtonElement) => void): void {
    const dt = document.createElement('dt');
    const btn = document.createElement('button');
    btn.className = 'bind-btn';
    btn.textContent = current;
    btn.setAttribute('aria-label', `${aria} (now ${current})`);
    btn.addEventListener('click', () => (this.waiting?.btn === btn ? this.stopWaiting() : onPick(btn)));
    dt.append(btn);
    const dd = document.createElement('dd');
    dd.textContent = what;
    list.append(dt, dd);
  }

  private startWaiting(w: Waiting): void {
    this.stopWaiting();
    this.waiting = w;
    w.btn.classList.add('waiting');
    w.btn.textContent = w.kind === 'key' ? 'Press a key…' : 'Press a button…';
    this.say(w.kind === 'key' ? 'Press the new key, or Esc to keep the old one.' : 'Press the new button on the controller. Press this again to keep the old one.');
    if (w.kind === 'pad') this.pad.captureButton((button) => this.takeButton(button));
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { if (this.waiting === w) { this.stopWaiting(); this.say('Nothing pressed: the old binding stays.'); } }, 10000);
  }

  private stopWaiting(): void {
    if (!this.waiting) return;
    if (this.waiting.kind === 'pad') this.pad.captureButton(null);
    this.waiting = null;
    window.clearTimeout(this.timer);
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    const w = this.waiting;
    if (!w || w.kind !== 'key') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { this.stopWaiting(); this.say('Kept the old key.'); return; }
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return; // wait for the real key
    const next = rebindKey(this.get(), w.action, e.key);
    if (!next) { this.say(`${keyLabel(e.key.toLowerCase())} is fixed: ${RESERVED_KEYS.includes(e.key.toLowerCase()) ? 'it moves, confirms or cancels everywhere' : 'it can’t be used'}. Try another key.`); return; }
    const label = KEY_ACTIONS.find((a) => a.id === w.action)!.label;
    this.set(next);
    this.waiting = null;
    window.clearTimeout(this.timer);
    this.say(`${label} is now ${keyLabel(e.key.toLowerCase())}.`);
    this.render();
    this.focusRow(this.keyList, KEY_ACTIONS.findIndex((a) => a.id === w.action));
  }

  private takeButton(button: number): void {
    const w = this.waiting;
    if (!w || w.kind !== 'pad') return;
    const next = rebindButton(this.get(), w.action, button);
    if (!next) {
      this.say(`${padLabel(button)} is fixed${RESERVED_BUTTONS.includes(button) ? ' (it moves the cursor or zooms)' : ''}. Press another button.`);
      this.pad.captureButton((b) => this.takeButton(b));
      return;
    }
    const label = PAD_ACTIONS.find((a) => a.id === w.action)!.label;
    this.set(next);
    this.waiting = null;
    window.clearTimeout(this.timer);
    this.say(`${label} is now ${padLabel(button)}.`);
    this.render();
    this.focusRow(this.padList, PAD_ACTIONS.findIndex((a) => a.id === w.action));
  }

  /** Puts focus back on the row just changed, so keyboard and controller players keep their place. */
  private focusRow(list: HTMLElement, index: number): void {
    list.querySelectorAll<HTMLButtonElement>('.bind-btn')[index]?.focus();
  }

  private say(text: string): void {
    this.note.textContent = text;
  }
}
