# ADR 0061: Ground in Acts II and III

## Status
Accepted (0.56.0, 2026-11-28).

## Context
- 0.53 put hazards, a hold and traps into Chapters II-A, II-B and IV. 0.54 moved them onto the chapters (`CampaignChapter.ground`), and 0.55 gave VI rain and VIII snow.
- Chapters V to IX had nothing of the sort.

## Decision
Each chapter gets ground that fits its story, and a line of dialogue that points it out:

| Chapter | Ground | Line |
| :--- | :--- | :--- |
| V, Greywatch Isle | **Hold 3 rounds, or rout**: the terrace under the lighthouse (8 tiles) | Maren |
| VI, Stormbreak Cape (rain) | A clean well in the middle of the field (2 spring tiles) | Corvin |
| VII, Saltglass Shore | White-hot saltglass on the sand (6 embers), a snare and a smoke trap on the way up | Kestrel |
| VIII, Frostfang Pass (snow) | A hot spring on the road halfway up (2 tiles) | Bria |
| IX, the Drowned City | Foul air in the flooded streets on both flanks (8 miasma) | Sable |

The maps stay bare, so side battles, side stories and Trials floors fought on them are unchanged.

## Tuning
200 battles per chapter at its usual levels, the same command before and after:

| Chapter | Before | After |
| :--- | :--- | :--- |
| V (Lv 7/8/9) | 43 / 40 / 73% | 41 / 48 / 87% |
| VI (Lv 8/9/10) | 5 / 29 / 68% | 5 / 28 / 68% |
| VII (Lv 9/10/11) | 35 / 40 / 64% | 33 / 41 / 62% |
| VIII (Lv 10/11/12) | 38 / 44 / 26% | 43 / 53 / 25% |
| IX (Lv 11/12/13) | 1 / 50 / 62% | 1 / 50 / 62% |

- **V:** the hold is a second way to win, and it helps most at higher levels.
- **VII:**
  - Embers alone gave 35 / 46 / 67%.
  - A snare and a slumber trap took it to 28 / 38 / 56%.
  - A snare and a smoke trap give 33 / 41 / 62%, the closest to before, and stay.
- **VIII:** the spring started off the road (11–12, 8) and changed nothing. On the road (7–8, 9) both sides use it, and it helps the squad a little in a hard chapter.
- **VI and IX:**
  - VI's well barely changes the numbers; IX's miasma doesn't change them at all.
  - IX's miasma sits on the flanks, which the AI doesn't walk.
  - Both are there for players: a place to heal, and a reason not to flank.

## Consequences
- Every chapter except I and III now has a goal, ground or weather of its own.
- The "More ground in the story" roadmap item is done.
