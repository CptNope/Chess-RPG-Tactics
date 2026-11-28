# ADR 0062: Mirror duels

## Status
Accepted (0.57.0, 2026-11-28).

## Context
- The chapter sweeps (`SWAP`, 0.46) compare a job in one squad slot across a few chapters. Each chapter rewards different things (ADR 0051), so they can't rank raw strength.
- The roadmap asked for duels on flat ground.

## Decision
1. **`npm run duels`** (`scripts/duels.ts`):
   - Every job meets every other, three of a kind a side, on a flat 12×12 field.
   - Each unit knows every action of its job and wears its starting gear. From Lv 4 it has the job's veteran reaction and support.
   - The sides swap ends every battle. Both play the same careful AI (`caution: 'full'`) with no items, and a battle past 400 turns is a draw.
   - It prints a ranking (share of wins, best and worst matchup); `--matrix` adds every pairing. The Beast Tamer is left out by default, since its craft needs beasts.
2. **A bug it found, fixed:** the AI aimed Undermine at a foe on ground already at the lowest height (0.5). `Battle.check` refused it ("The ground can't go lower there."), so the battle stopped with an error in the sim. On screen the tile couldn't be picked at all. Undermine's blow now lands there; the ground just doesn't sink.
3. **No balance changes in this release.** The duels measure one thing (a stand-up fight of three of a kind), and every chapter was tuned with the story squad as it is. Changes go through the chapter sweeps too.

## Results
20 battles per pair at Lv 10 (about 6½ minutes for 5,520 battles), and 12 per pair at Lv 5:

| # (Lv 10) | Job | Lv 10 | Lv 5 |
| ---: | :--- | ---: | ---: |
| 1 | Dragoon | 91% | 96% |
| 2 | Ninja | 91% | 92% |
| 3 | Ranger | 90% | 88% |
| 4 | Black Mage | 82% | 78% |
| 5 | Archer | 78% | 71% |
| 6 | Gunner | 74% | 72% |
| 7 | Sapper | 74% | 71% |
| 8 | Monk | 68% | 67% |
| 9 | Thief | 55% | 54% |
| 10 | Dark Knight | 52% | 51% |
| 11 | Dancer | 49% | 57% |
| 12 | Shaman | 48% | 55% |
| 13 | Paladin | 46% | 44% |
| 14 | Spellblade | 44% | 42% |
| 15 | Bard | 42% | 46% |
| 16 | Geomancer | 41% | 45% |
| 17 | Necromancer | 40% | 42% |
| 18 | Squire | 30% | 25% |
| 19 | Chemist | 29% | 24% |
| 20 | Knight | 28% | 31% |
| 21 | Oracle | 20% | 28% |
| 22 | Summoner | 18% | 12% |
| 23 | White Mage | 7% | 5% |
| 24 | Time Weaver | 3% | 4% |

The two levels agree closely.

## Reading them
- **Damage at range or on the move wins a stand-up fight:**
  - Dragoon: Jump lands from afar and dodges the reply.
  - Ninja: speed and two blades.
  - Ranger: the other side's AI never sees its traps, by design.
  - Black Mage and Archer.
- **Healers and support casters lose:**
  - White Mage, Time Weaver, Oracle and Summoner have little to win with three of a kind.
  - That is their role, not a flaw. In a mixed squad they are what the sweeps measure.
  - The Summoner may also suffer from the AI: a grand summon lands a turn later, by then often on empty ground.
- **The Knight is the surprise at 28–31%,** below every other front-line job. Move 3, melee reach only, and two of its four actions defend. In a campaign squad it holds a line (the sweeps put it mid-pack: II-B 52%, IV 60%, VII 35%, VIII 12%), but alone it is out-moved and out-ranged.
- **The Dragoon tops both measures:** 91–96% here, and the best mean in the 0.54 melee sweep (52%).

## Follow-ups (not in this release)
- **Knight mobility:** a Move +1 or a reach-2 action, weighed against the chapters, where Maren is a Knight.
- **Dragoon strength:** Jump's power or its delay, weighed against the chapters, where Corvin is a Dragoon.
- **Summoner AI:** aim a grand summon where foes will still be standing.
