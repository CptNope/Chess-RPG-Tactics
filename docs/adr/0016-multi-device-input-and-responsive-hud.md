# ADR 0016: Unified Multi-Device Input and Responsive HUD

## Status
Accepted (0.8.0, 2026-11-19)

## Context
A responsiveness and input audit (Impeccable `audit` rubric, Chromium device emulation at 375×667, 430×932, 844×390, 768×1024, 1180×820, 1366×768 and 1920×1080) found:

- **Touch was broken at the core.** Tile selection read the last *hovered* tile, which touch never sets, so a tap acted on the wrong tile. One-finger drag, pinch and rotate did nothing, and the canvas had no `touch-action`.
- **No keyboard path to the battlefield.** Arrow keys panned the camera; there was no way to pick a tile, choose an ability or reach most buttons without a mouse.
- **No controller support.**
- **Phone layouts collided.** The command menu sat on top of the unit card, the 11-button toolbar wrapped into three rows over the turn order, the Team screen squeezed into ~70px columns, and touch targets were 17–26 below 40px per screen. At 1920px the toolbar still covered the turn order.
- STATUS was a dead button.

## Decision
1. **One dispatcher, five inputs.** Keyboard, controller and canvas gestures translate into the same few intents: direction, confirm, cancel and named commands. `ui.activeLayer()` decides whether a direction moves focus within a menu or moves the tile cursor.
2. **Pointer Events for every pointer.** `TacticsScene` tracks pointers itself: tap (under a movement threshold) raycasts at the *tap point* and fires `onTileTap`; one-pointer drag pans; two pointers pinch-zoom, pan and twist-rotate; a quick two-finger tap or a pen eraser/barrel press cancels. Capture loss, `pointercancel` and window blur reset all gesture state.
3. **Spatial focus navigation** (`FocusNav.ts`) picks the nearest control in the pressed direction, so new menus work with arrows and the d-pad without per-menu code. Cards and list items get `tabindex` and `role="button"`.
4. **Gamepad API polling** each frame (standard mapping), edge-triggered buttons and repeating directions. Rumble uses `vibrationActuator` when present.
5. **Responsive HUD by collision breakpoints** (≤1100px wide, ≤700px wide, ≤520px tall) rather than device names, using safe-area insets and `dvh`. The toolbar shrank to four buttons plus a Menu; camera controls became their own cluster.
6. **Input-aware hints.** `html[data-input]` tracks the last-used input; hotkey badges, the dialogue hint and the Controls screen ordering follow it.

## Consequences
- An automated input suite (synthesized CDP touch including multi-touch, pen pointer events, mouse, keyboard-only turn, and an emulated standard gamepad) passes 47/47. It ran in Chromium only; Safari/iOS gesture quirks and real hardware controllers remain to be checked on devices.
- Menus added later inherit keyboard/controller navigation for free if they use buttons or the listed card classes.
