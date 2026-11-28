# ADR 0053: Hazards and hold zones on the ground

## Status
Accepted (0.48.0, 2026-11-27).

## Context
- Totems (0.47) made the first effects that stay on the field, but only a Shaman could make them, and only for a few turns.
- Maps shaped fights only through height, terrain cost and walls. Objectives were rout, boss and survive: none asked the squad to go anywhere.
- The roadmap's next item was hazards and zones, built on the totem shape (tile, reach, effect at turn start).

## Decision
1. **Hazards are part of the map** (`TileData.hazard`), working like a totem that never fades and belongs to nobody (`src/core/Hazards.ts`):
   - **Embers** burn 10% of max HP, **miasma** Poisons (gear guarding Poison keeps it off), a **spring** heals 12% and washes Poison off.
   - They work at the start of a turn on whoever stands there, on either side (`TurnManager.startOfTurn(unit, units, grid)`, `TurnTick.hazard`, the battle's `tick` event). The turn manager takes the grid as an optional second argument.
   - Gear can carry `traits.hazardproof` (the Cinderwalk Charm: embers and miasma).
2. **Hold zones** (`TileData.zone`) and a **hold** objective (`{ type: 'hold', rounds }`, default 3):
   - When a round ends, the zone is held by the only side standing on it (`zoneHolder`); contested or empty counts for nobody.
   - Rounds the hero's side holds add up (`RoundState.held`, not reset by a lost round). Reaching the objective's rounds wins (`battleOutcome(..., held)`, reason `hold`); routing the enemy still wins too.
   - The engine records a `hold` event each round; the screen logs the count and colours the zone's rim (gold, green held, red lost).
3. **AI:** every unit weighs the ground where it would end its turn (off embers and miasma, a hurt unit to a spring). With a hold objective (`PlanOptions.zone`) both sides value standing on the zone, and the fallback walk heads for it.
4. **Drawing:** shader overlays per kind (flickering embers, drifting miasma, a rippling spring) and a rim around the zone's outer edge only.
5. **Content and tools:**
   - **Cinder Spring**, a side battle after Chapter IV on a new caldera map: a spring basin to hold, ember flanks, sulphur vents. Five Ashen Zealots, led by an Ember Shaman, start on and around the basin. A side battle can now set how far south its enemies deploy (`deployRows`); enemies never deploy on a hazard.
   - The Workshop's **Ground** tool paints hazards and the zone; **Hold** is an objective. Share links add a hazard letter and `*` for the zone to each tile; older links still load.
   - The balance sim runs side battles (`skirmish_<place>[:wins]`).

## Tuning
`npm run balance -- 100 skirmish_<place> <level>` (Normal, the Act II party of six):

| Place | Lv 6 | Lv 7 | Lv 8 |
| :--- | :---: | :---: | :---: |
| Watchfire Ridge (survive) | 43% | 77% | |
| Briar Barrow | 77% | 97% | |
| Drowned Shrine | 90% | 83% | |
| Howling Hollow | 98% | 98% | |
| **Cinder Spring**, first cut: 4 zealots in the north | 88% | 100% | 100% |
| Cinder Spring, 6 on the basin | 29% | 60% | 74% |
| **Cinder Spring as shipped**, 5 on the basin | 85% | 84% | 97% |

- With four zealots deployed in the north, every traced battle ended in a rout by round 4, before the hold mattered. Starting them on the spring makes the squad take it.
- Six was harder than any other side battle; five sits with the Shrine and Barrow, and 69% at full heat (Lv 7).

## Consequences
- Maps can carry lasting effects; existing chapters have none, so their balance is unchanged.
- A hold objective gives the squad a reason to move. Story chapters could use one later.
- Online versus (docs/ONLINE_VERSUS.md): hazards and zones are map data, and the hold count lives in `RoundState`, so a server replaying intents gets them with no new state.
