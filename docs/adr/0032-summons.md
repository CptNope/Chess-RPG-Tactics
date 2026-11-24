# ADR 0032: Summons on Screen and Grand Summons

## Status
Accepted (0.24.0, 2026-11-24).

## Context
- The Summoner (0.13) had five summons that looked like any other spell: the element's generic effect on each target. The player asked for "cool powerful spells and effects" for the job.
- A bigger summon is only interesting if it isn't just a bigger number. It also has to stay fair to the AI and the player, and inside the same-level one-shot rule (`tests/core.test.ts`).

## Decision
1. **A creature per summon, as game effects.** Each summon names a creature (`Ability.summon`). Its effect is a pixelfx module in `src/renderer/fx/summons/`, drawn at the unit sprites' pixel scale so it reads as part of the same pixel art. Bodies are shaded discs and polygons with a 1 px outline, not hand-painted bitmaps, so they animate smoothly and each file stays small. A shared `_lib.js` draws the summoning circle sized to the spell's area, light pillars, shock rings and motes.
2. **Drawn over the board.** A floor-sized circle can't live on an upright billboard: under the isometric camera its near half sinks into the ground. Summons play in a new `overlay` mode (no depth test, drawn last) for the two or three seconds they last.
3. **Staged like a cutscene, but short.** The camera comes in on the area and back afterwards. A full-screen shade dims the board, but not the units, the markers or the effect. Each effect declares its `impact` time, and the damage numbers wait for it. Battle speed scales the whole thing. The name floats over the caster rather than in a banner that would cover the creature.
4. **Grand summons take a turn.** `Ability.charge`: the MP and the action are spent now and the area is marked. The creature arrives at the start of the caller's next turn, before they act, and hits whoever stands there then. This is the same "plays at turn start" slot performances use, so the battle flow had one place to change. The tension is the point: foes can get clear, allies can step in for Cinderwing, and the caller can be knocked out, slept or silenced to break the call.
5. **Fair numbers.** A grand summon hits the whole area at full force (no splash falloff: the aimed tile may well be empty by then) and at +30 hit, because a miss after a turn's wait feels bad. Its power stays under the one-shot rule (Tidewyrm 1.25 at radius 3, Elder Wyrm 1.35), so the telegraph is a warning and never a death sentence.
6. **The AI understands both sides.** `callsLandingOn` adds a large penalty to standing in a foe's marked area, including on the fallback walk. A grand summon scores 70% of its immediate value. Cinderwing's raise counts as a raise for the enemy raise cap. Enemies get grand summons from level 6 (`ENEMY_GRAND_SUMMON_LEVEL`). The balance sim charges and resolves them the same way.

## Consequences
- **A new shape of threat** on the board (marked tiles that land later), explained by a first-time tip and a line of story dialogue before Chapter V.
- **Summons take longer than other spells** (about 2 to 3 seconds at Normal speed). The Fast battle speed halves that. If it wears thin in a long campaign, a setting to skip the creature is a small follow-up.
- **The overlay draws the creature in front of everything**, units included, for its moment. That's intended for a summon; ordinary spells keep depth-tested effects.
- **Effects can only be judged by eye.** `tests/summons.test.ts` checks that each effect draws through its whole duration and covers its area; contact sheets and browser screenshots were used to tune them.
