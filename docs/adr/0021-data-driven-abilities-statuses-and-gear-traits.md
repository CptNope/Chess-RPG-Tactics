# ADR 0021: Data-Driven Ability Flags, Statuses and Gear Traits

## Status
Accepted (0.13.0, 2026-11-23).

## Context
The roadmap's "new jobs" item (Monk, Thief, Summoner) needed mechanics the engine didn't have: heals that scale with ATK, cleansing, life drain, stealing gear, Sleep that skips turns, Silence, and gear that does more than add stats. Two existing abilities also didn't do what they said: *Rend Armor* dealt plain damage, and *Equip Heavy Armor* did nothing.

Until now each special ability was a hard-coded `if (ability.id === ...)` in `CombatEngine`, `JobSystem` or `main.ts`. Adding four jobs that way would scatter dozens more id checks across files. The balance sim would also drift from the game, because it re-implements action resolution and keeps its own copy of the enemy passives.

## Decision
1. **Active effects are ability flags, not id checks.** `Ability` gained `cleanse`, `drain`, `steal` and `scalesWith`. `CombatEngine.getForecast` and `executeAttack` read the flags, so any job, or a Workshop scenario later, can reuse them. Passives (reactions, supports, movement) stay keyed by id, as before: each one is a small rule in one place.
2. **Statuses are data.** Six new statuses join `StatusEffectType`. Every status is in exactly one of `BENEFICIAL_STATUSES` and `HARMFUL_STATUSES` (a test checks this), and `STATUS_DURATION` holds its length. Cleansing and gear guards work from the harmful list, so a new ailment is covered automatically.
3. **Start-of-turn effects live in `TurnManager`.** Poison, Regen and Sleep resolve in `startOfTurn` and in the advance loop. A sleeper's turn passes inside the loop and is reported in `skipped`, so the game, the tests and the balance sim all see the same turn order.
4. **Gear traits are data on `Item`:** `traits.startStatus`, `traits.boost` and `traits.guard`. `JobSystem.resetForBattle` applies start statuses, `getForecast` applies boosts, and `applyStatus` refuses guarded ailments (returns `false`). The AI skips ailments a target is guarded against.
5. **MP cost and Silence are applied where the ability list is built.** `getCombatActionAbilities` drops MP abilities for a silenced unit and returns copies with Conserve's halved cost. The ACT menu, the player's spend, the AI's affordability check and the sim all read the same numbers without knowing about Conserve.
6. **One source for veteran-enemy kits.** `VETERAN_PASSIVES` and `JobSystem.equipVeteranPassives` replace the copies in `main.ts` and `scripts/balance-sim.ts`.
7. **Steal is the player's.** The AI never picks it: an enemy has nowhere to keep stolen gear, and losing gear to a coin-flip with no way to win it back isn't fun. Steal moves the item into the armory only when it isn't owned yet, because the armory is a set of item ids.

## Consequences
- **Adding effects is mostly data.** A future job with a drain, a cleanse, an ATK-scaled heal or an element boost needs no engine change.
- **Old saves migrate.** Units get JP banked in each job their save has never seen (`ensureJobPoints`), and starter gear added later joins old armories. Gear is still re-read from the item table on load, so traits apply to items saved before they had traits.
- **Trials floors changed.** The seeded floors draw from a longer job list, so they changed. A floor is regenerated from its number when played, so a saved Trials run continues on the new layout.
- **Status visibility is limited.** The new statuses show on the unit card and the battle log, not above units. Status icons over units are on the roadmap.
- **AI tuning.** The AI's buff weights were tuned with headless battles against Trials floors and `npm run balance`. Area buffs are discounted, and guard buffs only count when a foe is within 5 tiles. Otherwise AUTO squads spent turns re-casting Golem and Rally. Campaign win rates on AUTO stayed within noise of 0.12.
