/**
 * Controller support via the Gamepad API (standard mapping: Xbox, PlayStation, Switch Pro,
 * 8BitDo and most Bluetooth pads). Polled once per frame; emits semantic game actions with
 * key-repeat for held directions.
 */

export type PadAction =
  | 'up' | 'down' | 'left' | 'right'
  | 'confirm' | 'cancel' | 'commands' | 'team'
  | 'rotateLeft' | 'rotateRight' | 'zoomIn' | 'zoomOut'
  | 'recenter' | 'menu' | 'help';

// Standard Gamepad button indices
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

const BUTTON_ACTIONS: [number, PadAction][] = [
  [BTN.A, 'confirm'],
  [BTN.B, 'cancel'],
  [BTN.X, 'commands'],
  [BTN.Y, 'team'],
  [BTN.LB, 'rotateLeft'],
  [BTN.RB, 'rotateRight'],
  [BTN.R3, 'recenter'],
  [BTN.START, 'menu'],
  [BTN.BACK, 'help']
];

const DEADZONE = 0.5;
const PAN_DEADZONE = 0.18;
const REPEAT_DELAY = 320;
const REPEAT_RATE = 110;

export class GamepadInput {
  public onAction?: (a: PadAction) => void;
  /** Right stick: continuous camera pan in tiles per frame. */
  public onPan?: (dx: number, dz: number) => void;
  /** Triggers: continuous zoom (negative = zoom in). */
  public onZoom?: (delta: number) => void;
  public onConnect?: (id: string) => void;
  public onDisconnect?: () => void;

  private prev = new Map<number, boolean>();
  private dirHeld: { dir: PadAction; since: number; last: number } | null = null;
  public connected = false;

  constructor() {
    window.addEventListener('gamepadconnected', (e) => {
      this.connected = true;
      this.onConnect?.((e as GamepadEvent).gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.connected = this.firstPad() !== null;
      if (!this.connected) this.onDisconnect?.();
    });
  }

  private firstPad(): Gamepad | null {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  /** Strongest controller rumble the browser supports, for crits and boss enrage. */
  public rumble(strength = 0.6, ms = 180): void {
    const pad = this.firstPad() as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }) | null;
    pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch(() => undefined);
  }

  public poll(now: number = performance.now()): void {
    const pad = this.firstPad();
    if (!pad) return;
    if (!this.connected) {
      this.connected = true;
      this.onConnect?.(pad.id);
    }

    const pressed = (i: number) => !!pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5);

    // Edge-triggered buttons
    for (const [i, action] of BUTTON_ACTIONS) {
      const down = pressed(i);
      if (down && !this.prev.get(i)) this.onAction?.(action);
      this.prev.set(i, down);
    }

    // Directions: d-pad or left stick, with key repeat while held
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    let dir: PadAction | null = null;
    if (pressed(BTN.UP) || ay < -DEADZONE) dir = 'up';
    else if (pressed(BTN.DOWN) || ay > DEADZONE) dir = 'down';
    else if (pressed(BTN.LEFT) || ax < -DEADZONE) dir = 'left';
    else if (pressed(BTN.RIGHT) || ax > DEADZONE) dir = 'right';

    if (!dir) {
      this.dirHeld = null;
    } else if (!this.dirHeld || this.dirHeld.dir !== dir) {
      this.dirHeld = { dir, since: now, last: now };
      this.onAction?.(dir);
    } else if (now - this.dirHeld.since > REPEAT_DELAY && now - this.dirHeld.last > REPEAT_RATE) {
      this.dirHeld.last = now;
      this.onAction?.(dir);
    }

    // Right stick pans the camera
    const rx = pad.axes[2] || 0;
    const ry = pad.axes[3] || 0;
    if (Math.abs(rx) > PAN_DEADZONE || Math.abs(ry) > PAN_DEADZONE) {
      this.onPan?.(rx * 0.25, ry * 0.25);
    }

    // Analog triggers zoom
    const lt = pad.buttons[BTN.LT]?.value || 0;
    const rt = pad.buttons[BTN.RT]?.value || 0;
    if (lt > 0.1 || rt > 0.1) this.onZoom?.((lt - rt) * 0.25);
  }
}
