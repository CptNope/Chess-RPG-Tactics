# ADR 0030: The Bard, the Dancer, and Performances

## Status
Accepted (0.22.0, 2026-11-23).

## Context
- The user asked to keep expanding the classes and abilities. The roadmap listed "More jobs: Bard, Dancer" under Later, and "Mastery abilities" under Next.
- Every job so far is a set of one-shot actions. A Bard or Dancer copied that way would be another area buffer or debuffer (the Summoner and Oracle already cover those), so they needed a mechanic of their own.

## Decision
1. **A performance is an ability flag, not a new action type.** `performance: true` with `range: 0` and `aoe` = radius means "the area around the performer". Everything else (damage, heals, statuses, hit rolls, reactions, effects) goes through the existing pipeline: `victimsFor` returns `unitsInBlast` centred on the caster, and `unitsInBlast` already sends heals and buffs to allies and harm to foes. Songs and dances differ only in what they apply.
2. **It plays again at the start of the performer's turn.** That is where Poison and Regen already resolve, and it is easy to read: "the Bard's hymn plays on". The replay reuses `performAction` with `{ encore: true }`, which spends no MP, doesn't use up the action, and earns no JP or EXP (otherwise a performer could farm JP by standing still).
3. **Encore is a status**, so the unit card, the overhead pips, durations and turn-end ticking come for free. Its duration is repeats + 1, because it also ticks at the end of the turn it starts on. `Unit.performing` holds which ability to replay. `encoreDue` cleans up when the status has run out.
4. **Ending rules live in one module.** Moving, any other action (items included), Sleep, Silence or falling end a performance. Sleep and Silence end it inside `CombatEngine.applyStatus`, so every source (spells, reactions, items) is covered. UNDO restores it along with position, HP and MP.
5. **Full effect, no splash.** Area spells deal 60% to units off the aimed tile. A performance has no aimed unit, so that rule would quietly cut every performance; it is skipped for performances (battle screen, planner and balance sim alike).
6. **Two supports that work for both jobs.** Resonance (+1 radius) and Encore (+2 turns) are ordinary support abilities. A unit trained in both jobs can combine them, which is the kind of build the job tree is for.
7. **The planner values the repeat but not forever.** A performance scores ×1.4. While one is playing, moving or switching costs −12, and with nothing worth doing the performer stays put instead of advancing. A test checks that it still breaks off to finish a wounded foe.
8. **Reactions that fit:** Healing Refrain (50% Regen when hit) and Captivate (35% Sleep on a melee attacker). Captivate reuses the Hex Ward presentation, a status on the attacker.
9. **Found on the way:** `recalculateDerivedStats` never clamped HP and MP, so switching to a job with less HP left a unit above its maximum. It now clamps.

## Consequences
- **Performers reward standing still.** That suits a Bard behind the line and makes a Dancer in the middle of the enemy a real risk, which is the intent.
- **Enemy performers are strong in the Trials** (a free Haste every turn). They appear only there, alongside every other job. Watch it in play.
- **The balance sim doesn't replay encores**, so it undervalues performers. Noted on the roadmap; the story rosters have none.
- **Mastery abilities stay on the roadmap** as the next way to deepen the existing jobs.
