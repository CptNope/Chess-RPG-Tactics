# ADR 0051: The Dark Knight, techniques paid in HP

## Status
Accepted (0.46.0, 2026-11-27).

## Context
- 0.45's balance pass unpaused new jobs. The roster had 20 jobs, all of whose techniques cost MP (or nothing).
- Every caster's answer to Silence was the same: wait it out. A job that spends something else gives a different shape of turn: strong now, weaker later.
- The 0.45 job sweep put any job in Tobin's ranged slot, so it ranked "ranged or not" (ADR 0050). Tuning a new melee job needed a fairer measure.

## Decision
1. **`Ability.hpCost`**: a share of the caster's max HP, paid when the action starts (`resolveAction`'s pay step, reported as `hpPaid` on the start step).
   - It never brings the caster below 1 HP: `JobSystem.canAfford` needs more HP than the price, and the pay step caps it.
   - Silence doesn't seal it (it seals MP abilities).
   - `Battle.check` refuses an unaffordable technique ("Not enough HP."); the action menu shows the price in HP and greys out what can't be paid.
   - The AI subtracts the price from a plan's score as a share of its HP, counted double when below half HP, and plans its next turn from the HP left.
2. **The Dark Knight** (Knight 3 + Black Mage 2), a Bruiser: sword or spear, heavy armor, no shield.
   - Shadow Blade, Soul Rend (drain), Dread (Immobilize, reach 3), Night Ring (around itself), Black Oath (Haste on itself).
   - Vengeance (reaction): below half HP, strikes back at adjacent attackers. Blood Pact (support): HP prices halve.
   - Signature: Eclipse, a dark blast that drinks back a quarter.
   - Starts with an iron sword, an iron helm and chainmail.
3. **`SWAP=<id>:<job>` in the balance sim** puts a job, with all its actions, in a slot doing the same work: `p1` (Rowan) is melee, `p3` (Tobin) is ranged. Melee jobs are compared with melee jobs.

## Tuning
Melee sweep, `SWAP=p1:<job>`, 100 battles a point, Normal (Chapter II-B Lv 4 / IV Lv 7 / VII Lv 10):

| Job | II-B | IV | VII |
| :--- | :---: | :---: | :---: |
| Squire | 58% | 20% | 60% |
| Knight | 63% | 67% | 34% |
| Monk | 64% | 46% | 51% |
| Dragoon | 51% | 87% | 29% |
| Paladin | 58% | 54% | 27% |
| Ninja | 89% | 40% | 77% |
| Thief | 55% | 18% | 19% |
| Spellblade | 57% | 21% | 11% |
| Dancer | 79% | 10% | 36% |
| Beast Tamer | 61% | 47% | 33% |
| **Dark Knight** (first cut) | 57% | 65% | 19% |
| **Dark Knight** (as shipped, 200 battles) | 58% | 70% | 21% |

- The spread by chapter is wide: each fight rewards different things, so the sweep is a range check, not a ranking.
- Tracing the first cut showed the AI using **Black Oath** on more than half its turns in Chapter VII, paying a fifth of its HP each time. Black Oath now costs 12%.
- Weighting HP prices more in the AI (1.5 / 0.8 instead of 0.9 / 0.45) changed nothing in Chapter VII and cost 7 points in II-B, so the weights stay.
- Cheaper Shadow Blade and Night Ring changed nothing either, and stay as designed.
- The Dark Knight now starts with an iron helm (no shield, unlike the Knight).
- Chapter VII stays near 20% whatever its prices: it lands with the Paladin and Thief there, and with the Knight earlier on.

## Consequences
- 21 jobs, 128 abilities plus signatures.
- HP costs are a general engine feature: any later job or enemy can use them.
- Online versus (docs/ONLINE_VERSUS.md) gets the Dark Knight through the same rules; nothing in `BattleRules` changes.
