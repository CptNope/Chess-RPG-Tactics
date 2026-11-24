# ADR 0031: Master Signatures

## Status
Accepted (0.23.0, 2026-11-24).

## Context
- Job mastery (0.16) pays stat bonuses only. The roadmap's next depth item was "a signature ability per job at Master would give builds an identity".
- There are 18 jobs. Each signature should feel like the job at its best, without breaking the action economy or the AI.

## Decision
1. **One signature per job, in its own data file** (`src/data/signatures.ts`). Signatures aren't in a job's ability list, so they can't be learned with JP, equipped as a secondary, or picked up by enemy veterans (who get "every action in their job").
2. **Earned, not stored.** A unit has a signature when `masteryTier(unit, job) === 2`, which comes from lifetime JP. Like the mastery bonus, old saves get what they've already earned and the save format doesn't change.
3. **Kept in every job, once per battle.** `getCombatActionAbilities` adds every earned signature not yet in `Unit.usedSignatures`; using one marks it; `resetForBattle` clears the list. Once per battle, rather than an MP cost, keeps them special and lets them cost 0 MP. So they still work under Silence, which seals MP abilities.
4. **+30 hit.** A once-a-battle blow that whiffs at 68% feels bad (found in the browser test). The bonus applies before the usual 10–100 clamp, so they're close to certain without being guaranteed against an evasive foe.
5. **Built from existing flags.** Damage multipliers, area, drain, cleanse, a status. The one new idea, an area around the caster that doesn't repeat (Earthquake, Shield Wall, Chrono Surge...), became `Ability.centered`. Performances already had that shape, so `isCentered()` now covers both, and targeting, victims, splash and the planner were switched to it in one pass.
6. **The planner saves them.** A signature scores −30, so AUTO uses one for a group or a kill that matters, not on a foe a plain blow would finish. Both cases are tested.
7. **Announced where they're earned.** The level-up log line names the signature, and Team → Jobs shows it next to the mastery bonus, so the goal is visible long before it's reached.

## Consequences
- **Master is a long road** (1,900 lifetime JP in one job, about 20 battles in it), so signatures are late-game. The roadmap asks a hand play-through to judge the pace.
- **Several signatures together can swing a fight** for a unit that has mastered many jobs. That's the reward for the grind; the once-per-battle limit bounds it.
- **Enemies never have them.** If a later boss should, it can be given one explicitly.
