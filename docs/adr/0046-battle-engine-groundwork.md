# ADR 0046: Battle-engine groundwork (part 1)

## Status
Accepted (0.41.0, 2026-11-25).

## Context
- The person wants online versus for 2–4 players, with every match setting configurable, but **later**. For now the code should be organized so versus can be added without tearing the battle code apart. The plan is in [ONLINE_VERSUS.md](../ONLINE_VERSUS.md).
- The rules for an action lived in `main.ts`'s `performAction`, mixed with animation and waits. The balance sim couldn't use them, so it kept its own simpler copy.
- Dice were `Math.random` unless a test passed something else, so no battle could be repeated.
- "Is that an enemy?" was asked as `a.team !== b.team` in a dozen places, which can't express allied sides (2v2).
- New jobs were paused until this lands. Every job with a new mechanic added more code to `performAction`.

## Decision
1. **Sides** (`core/Sides.ts`). `isFoe`, `isAlly`, `allianceOf`, `joinSide`, `sidesStanding`. A unit's side is its `alliance` if it has one, otherwise its team. The campaign never sets an alliance, so nothing changes. Every relational team check in `src/core` (AI targeting, blasts, revives, movement blocking, summon warnings, taming) now goes through these. Checks that mean "the person's squad" (`team === 'player'`) stay as they are; turning those into "who controls this side" is part 2.
2. **Dice** (`core/Rng.ts`). `seededRng` moved here from `Trials` (which re-exports it). Each battle seeds its own generator when it's set up, and every hit, crit, status and reaction roll draws from it. A Workshop playtest keeps the suspended battle's dice.
3. **Rules** (`core/Rules.ts`). `BattleRules` holds what a battle is played under. Today that's one field, which teams earn JP and EXP (`CAMPAIGN_RULES`: the squad). Versus settings become fields here as they're built.
4. **The action resolver** (`core/Action.ts`). `resolveAction` is a generator:
   - The **start** step pays the costs: MP, the supply from the caster's pouch, a signature's once-per-battle use. It also starts or ends a song or dance, turns the caster, and begins a grand summon's call.
   - Then one **hit** step per target, rolled only when the caller asks for it.
   - It returns the JP and levels earned under the rules.

   `main.ts` presents each step as it comes, so the timing on screen is unchanged: a second target isn't rolled (or shown as fallen) before the first is shown. `runAction` runs it headless. `victimsFor` and `forecastFor` moved with it.
5. **The balance sim uses the resolver**, with seeded dice (`SEED=n`). The same command now gives the same numbers, and nobody levels up mid-battle in the sim.

## Consequences
- **No visible change.** All 8 play-tests pass, Chapter I on AUTO among them.
- **The sim agrees with its old self.** 150 battles per point, Normal, before → after: Chapter I L3 66% → 65%, II-B L5 62% → 74%, IV L7 42% → 51%, VI L10 32% → 34%. Every point is within the noise of unseeded runs. That's the point: the sim's own copy of the rules matched the game's, and now it can't drift.
- **Fix:** an enemy using an item with no pouch no longer takes it from the squad's inventory. Enemies only plan items they carry, so this never showed in play.
- **Still in `main.ts` (part 2):** turn start (calls landing, encores, poison), end of turn, victory, and "who controls this unit". That's when the engine emits events and a whole battle can be replayed from its seed and choices.
- 9 new tests (306 total).
