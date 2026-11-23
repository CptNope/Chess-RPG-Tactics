# ADR 0022: Job Levels, an Enforced Job Tree, and a Gil Economy

## Status
Accepted (0.14.0, 2026-11-23).

## Context
After 0.13.0 the game had 13 jobs and 52 items, but nothing paced them:
- `jobs.ts` declared prerequisites, yet the Team screen let any unit take any job on turn one, so the tree was decoration.
- Items had prices nothing used. Gear arrived only as fixed chapter rewards, Trials drops or Steal.
- The six new statuses showed only on the selected unit's card.

## Decision
1. **Job level comes from lifetime JP, kept apart from spendable JP.** `Unit.jobJpEarned[job]` only grows; `jobPoints[job]` is the purse abilities are bought from. A level is a threshold lookup (`JOB_LEVEL_JP`), not stored, so it can't drift. Thresholds are short (100, 250, 450...) because the campaign is three chapters: a level takes about a battle.
2. **`canChangeJob` is the one gate**, used by the Team screen. `changeJob` itself stays unconditional so the engine, tests and the Workshop can place a unit in any job. A unit may always keep the job it holds.
3. **Units created in a job are given its requirements** (`grantPrerequisites`, recursive down the tree). That covers recruits, enemies and the opening squad without special cases.
4. **Everyone starts at Squire Lv 2.** Knight and Archer are open at once, so the first choice is real, and three caster jobs need nothing.
5. **Old saves are rebuilt, not reset.** Lifetime JP is estimated as JP held plus JP spent on learned abilities, minus the starting bank. The current job and secondary skillset are then granted, so nothing a player is using locks.
6. **The armory stays a shared set.** Buying an item unlocks it for the whole squad, as rewards and drops always have. This keeps the shop to one rule ("not owned, can afford, in stock") and avoids inventories and counts. The cost is that selling makes no sense; instead, a stolen duplicate is fenced on the spot for half price.
7. **Stock is a price cap per campaign stage** (`Economy.ts`), not hand-written shelves. New items join the right tier by price alone. Three relics are never sold.
8. **Gil has few sources, all deterministic:** a bounty per defeated enemy, a clear bonus, fenced loot. Workshop battles pay nothing, since a scenario with fifty weak enemies would otherwise print money.
9. **Status pips reuse the status badge colours** and add shape: round for buffs, square for ailments, so the important distinction doesn't rest on colour alone.

## Consequences
- **Pacing.** A fresh unit reaches a second-tier job after one battle and an advanced job (two requirements) after about three. Tests pin the tree: base jobs open, advanced jobs locked, no cycles.
- **Chapter payouts are tested** to land between 400 and 900 gil, enough for one or two items per chapter, with the first shelves offering new gear in every slot.
- **Job levels 4 to 8 unlock nothing yet.** Mastery rewards are on the roadmap.
- **Gil runs out of uses** once the armory is complete. Consumables are the planned sink.
- **`scalesWith: 'attack'` damage now uses the weapon scale (×5).** Chakra, the only earlier user, heals, so it's unchanged.
- **The overhead HP bar was resized** while adding pips: its fill had been clipped to one pixel since the HUD moved to `border-box` sizing.
