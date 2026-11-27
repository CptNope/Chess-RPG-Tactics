# ADR 0050: Balance pass on the engine; AUTO holds back

## Status
Accepted (0.45.0, 2026-11-25).

## Context
- Since 0.44 the balance sim plays whole battles in the engine, with the game's CT refunds. That dropped **Chapter IV** from about half (its target since ADR 0025) to 9% at squad level 7.
- Next on the roadmap was a balance pass on the chapters and the 20 jobs, Chapter IV first.

## What the pass found
1. **Chapter IV's drop wasn't its roster: it was AUTO.**
   - Probing Chapter IV one enemy at a time gave results that didn't rise with squad level: one roster won 81% at Lv 7 and 27% at Lv 8.
   - Logging what happened showed Sable falling first in every battle. Every time, exactly four enemy turns passed between her last move and her fall.
   - On AUTO she walked alone, at full health and with nothing to hit, to the middle of the deck. The planner rated the danger there at 252 against her 261 HP, so the spot counted as "safe".
   - Two faults:
     - On the walk toward the enemy (nothing in reach), a healthy unit weighed danger at a tenth, so a deadly tile cost about three tiles of progress.
     - The threat is an average: it weights each blow by its hit chance and leaves out crits and back attacks, so 97% of HP is not safe.
2. **The job sweep measures squad shape, not job strength.**
   - A new switch (`TOBIN_JOB=<job> FULLKIT=1`) puts Tobin in any job with all its actions. Swept across Chapters II-B, IV and VII, it gave Archer, Bard and Ninja about 41–44% on average, and Knight and Paladin about 10%.
   - But Chapter II-B with a Knight in Tobin's place loses 59 of 60, with or without the Knight's actions: Tower Snipers on the walls kill freely when the squad has no ranged unit.
   - The sim's squad has one ranged slot, so the sweep ranks "ranged or not". No job stats change on this evidence; a fair comparison goes on the roadmap.

## Decision
1. **`holdBack` for the squad's AUTO** (`PlanOptions`):
   - On the walk, a deadly spot counts in full even for a healthy unit.
   - "Deadly" means the average threat times `LETHAL_MARGIN` (1.3) reaches the unit's HP.
   - The game's AUTO and the sim's squad use it.
   - Enemies don't: tried on them too, it made Hard enemies sit tight on Chapter IV's ship (56% → 12% at Lv 8). Their caution stays as each difficulty sets it.
2. **Chapter V's Storm Wyvern drops a level (6 → 5).** With a squad that no longer runs at Greywatch one unit at a time, Chapter V fell to 17 / 27 / 58%. One enemy at a time, the wyvern was the change that put it back nearest its old curve (44 / 42 / 74%). Its average enemy level now ties Chapter IV's; the test that checked "each chapter averages higher" now allows the tie, with the reason.
3. **The Mire (II-A) eases a little, and says it's the harder road.**
   - It had sat near 0% for many versions while the other branch, II-B, sat near half.
   - The Bog Poisoner and the Swamp Shinobi drop a level (4 → 3).
   - The march orders now say "The harder road: bog, poison, and lights that put you to sleep."
   - The Marsh Wisp's sleep is most of the Mire's bite (61% without it) and is kept: Bria warns about it in the intro.
4. **Chapter IV's roster is unchanged.** With AUTO fixed it is back to 21 / 30 / 67% (its old 21 / 51 / 63%). Lowering Captain Varrow overshot at Lv 7 and left Lv 6 low, so the story boss stays as written.

## Consequences
150 battles per point, Normal, before → after this pass:

| Chapter | Before | After |
| :--- | :--- | :--- |
| I | 49 / 69 / 73 | 50 / 71 / 74 |
| II-A | 2 / 3 / 8 | 5 / 9 / 27 |
| II-B | 35 / 47 / 74 | 41 / 59 / 67 |
| III | 1 / 7 / 8 | 3 / 9 / 11 |
| IV | 9 / 9 / 29 | 21 / 30 / 67 |
| V | 45 / 52 / 71 | 45 / 31 / 64 |
| VI | 2 / 26 / 46 | 1 / 35 / 44 |
| VII | 31 / 46 / 67 | 34 / 35 / 61 |
| VIII | 23 / 37 / 46 | 21 / 37 / 38 |
| IX | 10 / 49 / 61 | 1 / 41 / 57 |

- **Hard** (100 battles, Chapters I / IV / VII) stays close to before. Chapter IV at Lv 8 is lower (56% → 30%), because the squad itself plays more carefully.
- **In play,** AUTO no longer marches a lone unit into a deadly spot. A player pressing AUTO gets a more careful squad.
- **Not done:**
  - Job stat changes (see above).
  - Chapter III and the Mire are still the low points of the sim.
  - A hand play-through remains the real check.
- 2 new tests (327 total).
