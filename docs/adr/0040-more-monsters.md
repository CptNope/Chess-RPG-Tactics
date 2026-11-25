# ADR 0040: More Monsters — the Briar Barrow

## Status
Accepted (0.32.0, 2026-11-24).

## Context
- Five monsters (0.26) were in every story chapter (0.27), and the Beast Tamer (0.28) could recruit them, so a squad could collect the whole set quickly.
- The roadmap asked for more monsters to meet and tame.

## Decision
1. **Three monsters with clear jobs in a fight.** The Basilisk controls (roots and slows from range). The Bone Knight is a hard-hitting melee unit that ignores the usual ailments. The Thornling holds ground (regenerates, poisons from 3 tiles, blinds an area, roots whoever crowds it). Each has its own art, drawn in code like the first five.
2. **A new side battle, not new story enemies.** The story was balanced chapter by chapter in 0.27. A side battle at the squad's level (the Briar Barrow, after Chapter III) introduces them without moving those numbers. Its first two slots are a Bone Knight and a Basilisk, so every visit shows them.
3. **The deeper Trials only.** They join the Trials' monster pool from floor 8, so floors players have already seen don't change.
4. **Tuned with the sim, against the other side battles.** The first numbers made the Barrow nearly unlosable (98–100% at levels 6 and 9). The new monsters were slow, short-ranged melee units. Each got more speed, reach and hit. First visits now win 63–73% (the Drowned Shrine: 73%; Watchfire Ridge: 48%; the Hollow, with its wyvern: about 25%).
5. **Tameable like the rest**, with five names each.

## Consequences
- **Eight monsters** to meet and tame; the Barrow's relic (Basilisk Eye) is the first accessory that wards off both Immobilize and Slow.
- **Tamed Bone Knights and Basilisks are strong** (a Bone Knight at level 7 has more attack than a knight). Beasts still can't change jobs or wear people's gear, so they don't scale with the market.
- **No story changes in 0.32.** See the amendment below.

## Amendment (0.33.0)
Two of the new monsters joined Act II, each replacing the enemy whose swap kept the chapter's simulated win rates closest (several candidates were tried per chapter):
- Chapter V: a Cliff Basilisk for the Storm Hexer (47/53/65% → 38/69/62%). The Basilisk in place of the Greywatch Sentinel made the chapter far harder (2/14/45%).
- Final Chapter: a Drowned Knight (Bone Knight) for the Hourglass Seer (5/11/27% → 3/17/26%). In place of the Wraith Lancer it made the chapter far easier (67/31/65%).

ADR 0035 found replacing the Seer with a damage dealer made the Cape harder; with 0.31's planner and this monster, it doesn't. The sim, not intuition about roles, decides each swap. The Thornling stays at the Barrow and in the Trials: no chapter fit it without a third monster in one battle.
