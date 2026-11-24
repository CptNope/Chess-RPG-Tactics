# ADR 0039: Smarter Enemies — Thinking a Turn Ahead, and Items

## Status
Accepted (0.31.0, 2026-11-24).

## Context
- The planner (ADR 0020 and on) looks one action deep: it scores what a move and an action achieve now, and nothing about what happens next. A wounded enemy would walk into the squad's line to land a chip blow and die.
- A threat term was tried in 0.20 and made no difference in the simulation, so it was left out. Since then the sim has grown (monsters, performers, summons), and the roadmap kept "AI: items and two-ply look-ahead" as its largest open item.
- Enemies never used items, though the squad does, and the engine already resolves items as abilities.

## Decision
1. **A threat map, not a full second ply.** For each tile, sum each foe's best expected blow on this unit wherever the foe can walk and reach. It costs one reachability search and a few forecasts per foe per turn, cheap enough for phones. Foes this plan will likely KO are spared, which gives most of what a two-ply search would: trading a kill for safety.
2. **Three levels of caution, tied to difficulty.** Full caution on every enemy made Normal much harder in the sim (Chapter I at level 3 from 63% to 35%, Chapter IV at level 8 from 52% to 22%). So:
   - **Easy**: none, as before.
   - **Normal**: `'light'`, only for units below half HP, and only against likely KOs. The wounded back off or heal; the healthy still charge.
   - **Hard**: `'full'`, always, with a small cost per HP at risk.
   - **AUTO**: `'full'` for the player's units, since a careful AUTO is what a player wants from it.
3. **Pouches by role, not by chance.** Bosses, Chemists and every third enemy on Normal (every enemy on Hard) carry Potions, with Remedy, Phoenix Feather and Blast Flask for Chemists. It's deterministic so the sim and the player see the same battle, and it's shown on the enemy's card (🎒) so a player can plan around it, or Steal-and-kill first.
4. **Items reuse the ability scoring**, with a small cost so they aren't spent on trifles. A Phoenix Feather counts against the side's raise cap, like a Raise.
5. **Salvage what's left.** The squad gets the unused items of fallen enemies after a victory: a reason to kill a carrier before it drinks, and a small offset to the extra difficulty.
6. **AUTO doesn't spend the squad's supplies.** Supplies cost gil; spending them is the player's call.

## Consequences
- **Normal plays about the same overall in the sim**: some chapters a little harder (II-B at level 3, VI at level 8), V easier because AUTO plays safer. Hard is clearly harder.
- **Battles can run a little longer**: a hurt enemy that retreats has to be chased.
- **The estimate is coarse**: it ignores heights and facing and assumes every foe can converge. Counting only the strongest two threats, or simulating foe turns, are the next steps if enemies prove too timid.
