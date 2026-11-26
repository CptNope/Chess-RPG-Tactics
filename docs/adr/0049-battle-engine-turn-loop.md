# ADR 0049: Battle-engine groundwork (part 2): the turn loop

## Status
Accepted (0.44.0, 2026-11-25).

## Context
- Part 1 (ADR 0046) moved resolving an action into `src/core`.
- The rest of a battle still lived only in `main.ts`, wrapped in animation and timers:
  - whose turn it is, Poison and Regen, a grand summon landing, an encore
  - moving and facing
  - the round count, and who has won
- So the balance sim kept its own copy of the loop, without encores, objectives or the game's CT refunds. And no whole battle could be replayed, which versus needs (docs/ONLINE_VERSUS.md).

## Decision
1. **`core/Battle.ts`** holds the turn loop as a `Battle` object:
   - **`nextTurn()`** advances the clock to the next unit that gets to choose. On the way it plays out Poison, Regen and sleep, the round count, a grand summon landing and a song or dance playing on.
   - **`apply(intent)`** plays a turn: move, act, face, end the turn. The intent is `{ moveTo, ability, target, facing }`, the same shape the AI's plan already has.
   - **`check(intent)`** says why an intent isn't legal: out of reach, already acted, not enough MP, none left in the pouch, no target, out of range. `apply` refuses those. A server will need this.
   - Every step is written to **`events`**: `turn`, `tick`, `call` / `encore` / `act` (with each hit's result), `move`, `face` and `end`.
2. **`battleOutcome(units, objective, round, hero)`** is the one victory check:
   - Last side standing wins, using alliances, so allied teams win together.
   - A tamed beast can't win alone.
   - When the boss falls, the rest flee.
   - Holding out wins a survive battle.

   `noteTurn` counts rounds. The game's `checkBattleStatus` and `trackRound` now call these and only present the result.
3. **`runBattle(battle, decide)`** plays a battle to the end and returns the intents. `replay(intents)` plays them back. A decider can be the AI, a recording, or, later, a player or a server.
4. **The balance sim** runs whole battles through `Battle`, with the chapter's objective.

## Consequences
- **Replays work:** a battle from the same seed and the same intents gives the same events, event for event, and the tests check it.
- **The sim now follows the game's CT refunds**, and that changed one result a lot:
  - The old sim charged a full turn for moving, or waiting in place, without acting. The game, and now the engine, refunds part of it (`TurnManager.endTurn`). An enemy holding its ground starts its next turn 40 CT ahead.
  - **Chapter IV** fell from 51% to 9% at squad level 7 (150 battles, Normal). Putting back the old charge brings it to 46%, so the refund is the cause.
  - Chapter IV is likely harder in play than earlier sims said. That's for the coming balance pass, not this release.
  - Other chapters moved within noise, except Chapter VI, which rose with encores and objectives.
- **Still in `main.ts`:** the game drives its own turns with animation between the steps. Driving it from the engine's events comes when versus starts (V1); this release gives it the engine to drive from.
- **`check` doesn't confirm the unit knows the ability:** the AI resolves terrain spells into variants. A server will check ability ids against the unit's list.
- 8 new tests (325 total).
