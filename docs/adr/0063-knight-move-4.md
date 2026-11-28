# ADR 0063: Knights move 4

## Status
Accepted (0.58.0, 2026-11-28).

## Context
- The mirror duels (0.57, ADR 0062) put the Knight 20th of 24 (28% at Lv 10, 31% at Lv 5), below every other front-line job.
- The Monk has near-identical stats (HP ×1.2, ATK ×1.2) with Move 4 and Jump 3, and won 68%. The Knight had Move 3, melee reach only, and two defensive actions of four. Anything with range or speed out-moved it.
- Maren is a Knight, and so are several enemies, two of them bosses (the Bandit Chief, Marshal Hale). Any change reaches every chapter.

## Decision
1. **Knights move 4** (Jump stays 2: plate).
2. **The Bandit Chief (Chapter I) is Lv 2,** down from 3. A faster boss Knight took the first battle from 72% to 44% at Lv 4.
3. **AUTO heads for a hold zone and the foes alike** (`zoneDist × 0.5 + distance to the foe × 0.5`, was `zoneDist + distance × 0.25`). With a faster Knight, AUTO sent Maren onto Greywatch's terrace (Chapter V) ahead of the squad. Without the hold, the same chapter went from 43 / 41 / 63% to 64 / 61 / 97%, so the cause was the pace, not the Knight.
4. **`npm run duels -- … --only=<job>`** runs one job's pairings, so a change to one job can be measured in seconds rather than minutes.
5. A test that relied on a Knight's Move 3 (a hurt archer shooting from beyond its reach) now uses Paladins.

## Tuning
- **Mirror duels** (Lv 10, 20 per pair): Knight 28% → 47%, between the Shaman and the Paladin. Jump 3 wasn't needed.
- **Chapters** (150 battles per level, the same command on 0.57 and here):

  | Chapter | 0.57 | 0.58 |
  | :--- | :--- | :--- |
  | I | 50 / 71 / 74% | 63 / 75 / 69% |
  | II-A | 6 / 11 / 27% | 10 / 14 / 30% |
  | II-B | 39 / 49 / 65% | 41 / 64 / 69% |
  | III | 3 / 9 / 12% | 1 / 33 / 26% |
  | IV | 18 / 28 / 67% | 17 / 28 / 63% |
  | V | 42 / 53 / 90% | 43 / 68 / 79% |
  | VI | 4 / 29 / 58% | 27 / 45 / 47% |
  | VII | 29 / 42 / 65% | 46 / 57 / 71% |
  | VIII | 41 / 42 / 33% | 17 / 42 / 61% |
  | IX | 1 / 41 / 56% | 7 / 33 / 53% |

  Most chapters come out the same or a little easier, as a stronger Maren should make them.
- **VIII** is harder at Lv 10 and easier at Lv 12; Marshal Hale is a faster Knight now. Taking him down a level (22 / 48 / 64%) didn't change the Lv 10 drop, so he stays.
- **Cinder Spring** went to 70 / 100 / 100% (was 64 / 86 / 100%) with the new pace.

## Consequences
- Of the duels' follow-ups, the Dragoon (still first) and the Summoner's AI remain.
- Enemy Knights are as mobile as the squad's. II-B, where an Iron Vanguard holds the gate, got easier rather than harder (49% → 64% at Lv 4): Maren's speed counts for more there than the Vanguard's.
