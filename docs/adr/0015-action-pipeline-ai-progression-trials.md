# ADR 0015: Unified Action Pipeline, Planning AI, Persistent Squad, and Trials of the Zodiac

## Status
Accepted (0.7.0, 2026-11-19)

## Context
A play-test audit of 0.6.0 found the game looked finished but several systems were disconnected:

- Player and enemy attacks were resolved by two copy-pasted code paths in `main.ts`, and they had drifted apart (enemies never paid MP; area spells only hit one unit on either side).
- The player could attack any unit on the map: clicking a unit outside the red range overlay still opened the forecast.
- Gear ATK/MAG and evasion were summed but never used, so swapping weapons did nothing.
- Three reactions were wired to ability ids that did not exist, so they could never trigger.
- The enemy AI walked to the nearest player and used the first ability in range. It could cast Haste on the player's units.
- The squad was rebuilt from scratch at each chapter, EXP never produced a level, and the gear rewards promised by story choices were never granted.
- Defeat left the player on a dead board with no retry, and the campaign ended on a banner.
- The GitHub Pages deploy failed when `deploy-pages` ran in the same job as the artifact upload and could not see the artifact yet.

## Decision

1. **One action pipeline.** `TacticsGame.performAction()` resolves every ability for both teams: spends MP once, gathers victims (`unitsInBlast` for area abilities), rolls each, plays effects, resolves reactions, handles boss enrage, and awards EXP/JP to player units.
2. **Targeting is validated by the grid.** `BattleGrid.canTarget()` is the single rule for range, height tolerance and self-targeting. It is used by the range overlay, the click handler and the AI.
3. **Planning AI (`src/core/EnemyAI.ts`).** For every reachable tile × affordable ability × valid aim point, score the outcome from forecasts (share of HP removed, kill bonus, heals on wounded allies, statuses not already applied, small positional terms) and take the best. The planner is team-agnostic, so the same code powers the player's **AUTO** command.
4. **Combat math uses effective stats.** `JobSystem.getAttackPower()/getMagicPower()` combine base stat × job multiplier + gear. Focus and enrage are battle-only modifiers and never touch `baseStats`. Facing and height bonuses apply to physical damage only. Area spells deal 60% on the splash ring. Scales were re-tuned and locked by tests (a same-level basic attack kills in 2–6 hits; no spell one-shots a full-HP unit).
5. **Persistent squad + armory.** `squad` and `armory` live on the game object, persist across chapters, and are saved (save format 0.7.0; 0.6.x saves load and rebuild the armory from equipped gear).
6. **Result modal.** One reusable modal drives spoils, defeat (retry / load), the campaign epilogue and Trials.
7. **Trials of the Zodiac (`src/core/Trials.ts`).** Post-game floors generated from a seeded PRNG (mulberry32) so each floor is deterministic. Map rotates through all four battlefields, enemy level is 3 + floor, a Warden boss appears every fifth floor, and each clear drops one unowned rare item.
8. **CI.** The Pages workflow builds on every push and PR, runs `vitest` plus a dist asset check, and deploys from a separate job with one retry.

## Consequences
- `main.ts` lost ~250 lines of duplicated enemy-attack code; new abilities only need data plus, if special, a branch in `CombatEngine`.
- Core rules are covered by unit tests in `tests/core.test.ts`, runnable with `npm test`.
- `?debug&fast` exposes the game as `window.__tactics` and speeds up animations; it is used for automated play-tests and has no effect otherwise.
