# ADR 0034: Monsters

## Status
Accepted (0.26.0, 2026-11-24).

## Context
- Every enemy was a person in a player job. The roadmap's "Monsters: enemies that aren't humans in player jobs, with their own abilities" was the biggest gap in variety.
- The battle rules, planner, balance sim, Workshop and docs generator all key on `unit.jobId` and `JOBS`.

## Decision
1. **Monsters are jobs with a flag.** `data/monsters.ts` defines each as a `Job` with `monster: true` and merges them into `JOBS`. Every rule that looks a unit's job up (stats, abilities, the planner, forecasts, the sim) works unchanged. The places that list jobs *for players* (the job tree, secondary skillsets, JP banks, recruiting, the docs' job tables, tests over "every job") use `PLAYER_JOB_IDS`; `canChangeJob` refuses a monster's job to anyone else.
2. **No gear, so `innate`.** Monsters wear nothing. What gear traits give people, `Job.innate` gives them: statuses at the start of battle (the Ooze's Regen, the Brute's Protect) and immunities, read by `applyGearStatuses` and `guardsAgainst`. A monster knows every action from level 1.
3. **Held to the same balance rules.** The core tests that every pairing of jobs takes 2 to 6 plain blows, and that no same-level spell one-shots a full-HP unit, include monsters automatically. Their multipliers were tuned against those tests (the Wisp was the outlier).
4. **Their own bodies.** `graphics/MonsterArt.ts` paints each monster with the characters' painter and outline pass, in the same 48 px canvas, views and frames, so the battle renderer needs nothing new. Flyers cast a smaller shadow. Portraits are a 2× crop of the front sprite.
5. **Where they live:** a new side battle (Howling Hollow, with a trophy), about a third of the enemies on Trials floors from 3 (drawn from a separate seed, so the human enemies on existing floors don't change), and the Workshop's enemy list. The story is unchanged, so its balance is too.

## Consequences
- **Five monsters, three actions each,** no reactions or supports. Enough for variety; more can be added as data plus a painter function.
- **A Thief can't steal from them** (nothing to take), and the AI never tries.
- **The story doesn't use them yet.** Putting a few in Act I or II is on the roadmap, with the balance sim to check it.
