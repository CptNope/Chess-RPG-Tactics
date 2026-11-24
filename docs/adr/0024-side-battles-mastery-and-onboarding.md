# ADR 0024: Side Battles, Job Mastery, Raise, and Onboarding

## Status
Accepted (0.16.0, 2026-11-23).

## Context
After 0.15.0 the game had a world map, a market, items and an eight-level job ladder, and a campaign of three battles per playthrough:
- **Nowhere to train.** A player stuck on Chapter II could only retry it. Job levels 4 to 8 took far more battles than the story has, and unlocked nothing.
- **Reviving cost gil only.** The Phoenix Feather was the one way to bring a unit back, so the White Mage, the obvious job for it, had no say.
- **Nothing taught the rules.** A Controls screen lists inputs; facing, height, speed-based turns and the forecast were left to be discovered. New players arrive from itch.io with no manual.
- **A misplaced move was final**, and every pause in battle ran at one speed.

## Decision
1. **Side battles are generated, not authored.** `buildSkirmish(id, squadLevels, wins)` returns an ordinary `CampaignChapter`, as `buildTrialFloor` does, so the battle code doesn't know the difference. A place fixes the map, the enemy jobs and the objective; a seeded RNG (place, level, wins) picks the rest, so a given visit is always the same fight and tests can pin it.
2. **Difficulty follows the squad, then leans against farming.** Enemy level is the squad's average rounded down, plus one per earlier win at that place, capped at two; the leader is one higher. The first visit favours the player; repeat visits pay less (80 gil instead of 160) and hit harder. There is no boss, so no triple bounty.
3. **A fourth battle mode, `skirmish`.** It reuses the campaign's spoils and defeat screens with its own buttons (World Map / Fight again). It is never the story's position: saves record the campaign chapter and `onWorldMap: true`, so loading a save made mid-skirmish puts the squad back on the map beside it instead of trying to rebuild a generated fight.
4. **Places open with the story and never close.** `opensAfter` lists chapters, any one of which opens the place, so both branches reach the Chapter II places. `nodeState` never returns `cleared` for them.
5. **Mastery is derived, not stored.** A tier is a job-level threshold (5 and 8) on the lifetime JP that already drives job levels, so there is no new save field, no migration, and it can't drift. Old saves get what they have earned.
6. **One stat per job, small, and it follows the unit.** Master replaces Veteran rather than stacking, bonuses are flat and applied after job multipliers, and they hold in every job. That rewards touring the job tree (the game's core idea) without making any single job mandatory. Speed, the strongest stat, comes from one job only.
7. **Revive is an ability flag, not an item feature.** `revive` on any ability is resolved by `CombatEngine` without a roll; `unitsInBlast` is the one place that says who can be raised (fallen, same side, tile free, not a boss). Raise is then four lines of data.
8. **The AI may raise.** The planner aims revives at fallen allies and scores one like a kill. AUTO needs this to be useful with a White Mage; for enemies it makes healers a priority target. Bosses are excluded in the engine so a kill that ends a fight stays a kill.
9. **Tips are non-blocking and event-driven.** `Tutorial.show(id)` is called where the thing happens (first turn, move mode, forecast…); each tip shows once, in a panel that takes no focus, and leaves on its own. A modal tutorial would have meant a second input mode to keep working on five input devices. The world map shows its tip inside its own panel, where it can't cover a place.
10. **Tips are remembered per device**, in their own storage key, not in the save: a second playthrough or New Game+ shouldn't teach again, and a new device should. Skip turns them all off; Controls turns them back on.
11. **Undo is a snapshot of the mover.** Position, facing, HP and MP before the move, kept until the unit acts, waits or hands over to AUTO. Moving has no other side effects in this engine (no traps, no reactions to movement), which is what makes a snapshot enough. If that changes, undo has to learn about it.
12. **Battle speed scales the two clocks the game has**: scripted pauses (`SPEED`) and frame-driven walking (`TacticsScene.walkSpeed`). Effects keep their authored timing. Two settings, not a slider.

## Consequences
- **A stuck player has something to do**, and gil, supplies, JP and mastery all feed back into the story battle.
- **Farming is possible but slow.** Repeat wins pay 80 gil plus bounties against enemies two levels up. Mastering one job is roughly fifteen battles.
- **Enemy healers change fights.** The balance sim (AI on both sides) moved within its noise, but it has not been played by hand against every roster. Listed as a known issue with a fallback (cap raises per battle).
- **Mastery can add up.** A unit that masters all fifteen jobs gains 90 HP, 55 MP, 4 ATK, 6 MAG, 14 Evasion, 2 Jump and 2 Speed. That is far past the campaign and is intended as the long game for the Trials.
- **Tips cover the first battle's verbs only.** They don't explain jobs, the job tree or statuses; the Gameplay Guide does.
- **Undo doesn't cover actions.** An executed action, or a WAIT, is final.
- **Three more places on a small map** forced a layout pass: the Gate of Trials moved, and tests now fail if two places are closer than 12% of the map.
