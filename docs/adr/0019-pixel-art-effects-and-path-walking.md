# ADR 0019: Pixel-Art Battle Effects (pixelfx), Path Walking and a Balance Yardstick

## Status
Accepted (0.11.0, 2026-11-20). Partly supersedes [ADR 0012](0012-vfx-particles-and-projected-hud.md): its spell particles are replaced; weather, screen shake and the projected HUD stay.

## Context
- After 0.10 the units were outlined 48px pixel art, but spells were smooth 3D particle bursts (points, lines, point lights). They clashed with the sprites and said little about what happened.
- Units slid in a straight line to their destination, through walls and over water.
- The 0.10 Workshop could only edit one tile per tap.
- A bot run of Chapter II-B lost eight times in a row after the 0.10 fortress redesign; one-off bot runs take ten minutes each and are too noisy to tune with.

## Decision
1. **Use pixelfx for effects, vendored.** [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx) (MIT, listed as Vetted in the project's design-skills tracker) draws each effect in code into two pixel buffers: colour and additive light. We copy `src/core` and only the 21 effects we play, unchanged, into `src/vendor/pixelfx` with the LICENSE and NOTICE, plus our own `registry.js` and a `.d.ts`. Before vendoring, the source was scanned for network, eval, DOM and storage use (none). The repo's gallery font, which isn't MIT, is left out. The repo's Node tools aren't run; effects are judged in contact sheets rendered by the game's own code.
2. **Render effects as billboards at sprite pixel density** (`renderer/PixelEffects.ts`): 1.35 world units per 48 px, the same as unit sprites. Each effect has a back and a front layer, each a colour texture (normal blending) and a light texture (additive, which feeds bloom). The layers sit behind and in front of the unit **along the camera's view direction**: an orthographic camera shows no shift that way, whereas a sideways offset would misalign them by several pixels. Effects advance in whole frames at their authored 30 fps.
3. **Pass the real character.** pixelfx's body effects (heal, haste, poison, rage, shield) shape themselves around a stand-in actor's mask. `actorFromSprite()` builds that mask and its pixels from the unit's current 48px sprite, with the feet on the same row, so a heal restores *that* unit's colours.
4. **Cues live in one table** (`renderer/BattleFx.ts`): event → effect, anchor (target, or an arc that sweeps across it), mirror toward the target on screen, speed, and `startAt` to skip most of a wind-up, so impacts land with the damage numbers that `main.ts` shows immediately.
5. **Walk the path.** `BattleGrid.findPath()` reuses the movement Dijkstra with parent links. The game queues the path with the scene (`walkPath`) just before it changes the unit's tile; the scene walks it segment by segment, turning the sprite per step and hopping over height changes. The AI waits for the walk before acting. Teleporters have no path and keep the short slide.
6. **Workshop strokes** use a `dragPaint` hook in the scene's pointer code: a one-pointer drag that would pan becomes a stroke when the Workshop wants one. A second finger turns it back into a camera gesture. Strokes visit each tile once, take one undo checkpoint and throttle terrain rebuilds.
7. **Balance with a yardstick, not single runs.** `scripts/balance-sim.ts` (`npm run balance`) plays chapters headless with the game's rules and AI on both sides and prints win rates by level. It takes seconds and accepts roster overrides, so changes can be compared between versions.

## Consequences
- Effects match the art style and say what happened (element, buff, ailment); there are no image files and no runtime dependency.
- Bundle +~50 KB minified for the library and effects. Each live effect costs four small texture uploads per animation frame; at most 14 run at once.
- Updating pixelfx means copying the same files from a newer checkout and reading the diff.
- The balance sim ignores reactions, gear upgrades and human play, so its numbers are relative. Chapter II-B was tuned to sit between Chapter I and II-A.
