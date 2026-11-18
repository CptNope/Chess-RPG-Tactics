# ADR 0008: Multi-Map Generator & Dynamic Thematic Lighting

## Status
**Accepted**

## Date
2026-11-17

## Context
A tactics game with only a single map feels static. Different battlefields require different height variations, tactical chokepoints, atmospheric lighting, and terrain effects (e.g. night ramparts with torches, murky swamps with toxic bogs).

## Decision
We implemented a **Multi-Map Generator & Thematic Scene Swapper**:
- `src/data/maps.ts` defines multiple battlefields:
  1. `river_ruins`: Daytime riverside ruins with water, hill ridges, and stone watchtower.
  2. `night_fortress`: Night castle battlement with drawbridge, moat, and high archer parapets.
  3. `gloomy_swamp`: Murky bog marsh with wooden boardwalks and toxic water.
- `TacticsScene.loadMap()` dynamically disposes old geometry, builds new themed voxel tiles, swaps background colors, and recalibrates ambient and directional lighting to reflect day, night, and swamp atmospheres.

## Consequences
### Positive
- Players can switch battlefields on the fly using the top-bar HUD dropdown.
- Demonstrates the engine's scalability for campaign scenarios and future level editors.
- Different terrain layouts stress-test the Jump, Teleport, and Water Walk mechanics.

### Negative
- Switching maps mid-battle resets squad positions (standard for skirmish match restarts).
