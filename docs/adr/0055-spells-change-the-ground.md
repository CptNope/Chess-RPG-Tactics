# ADR 0055: Spells that change the ground

## Status
Accepted (0.50.0, 2026-11-28).

## Context
- 0.48 put hazards on maps, but only where a map's author put them. The roadmap's "more ground" item asked for spells that leave burning ground.
- Fire, ice and poison already existed as elements and statuses; making them touch the ground ties the new hazards to every battle, not just Cinder Spring.

## Decision
1. **By rule, not per ability** (`groundFrom` in `Hazards.ts`), so later spells join in:
   - a fire action with an area (Fire, Firestorm, Dragon Breath, the fire summon, Meteor) leaves **embers**;
   - an ice action with an area (Blizzard, Undine, Tidewyrm) **douses** embers;
   - anything that inflicts Poison (Poison Cloud) leaves **miasma**.
   - Totems, traps, heals and items never change the ground.
2. **Temporary ground** (`TileData.temp`): embers and miasma last `SCORCH_ROUNDS` (2) round ends, dousing `DOUSE_ROUNDS` (3). The tile remembers the map's own hazard and puts it back (`tickGround`), so ice can put out the Cinder Caldera's embers for a while.
   - Embers never take on water or snow, nothing overwrites a spring, and miasma doesn't settle on fire.
   - A burst around its caster spares the caster's own tile.
3. **Where it happens:** the resolver changes the ground once the spell lands (a call being started changes nothing until it lands) and reports it on `ActionEnd.ground`. The battle engine records a `ground` event for it and for each round's countdown; the screen redraws the overlays and logs it.
4. **AI:** `groundWorth` adds a little for embers or miasma left under foes (they may step off), takes away for allies, and credits dousing embers under allies. Units already avoided ending on hazards (0.48).
5. **First-time tips** for burning ground and for walking into a hidden trap.

## Tuning
Story chapters, 100 battles a point (Chapter VIII also at 300), before and after:

| Chapter | 0.49 | 0.50 |
| :--- | :---: | :---: |
| II-B Lv 4 | 57% | 56% |
| III Lv 5 | 8% | 8% |
| IV Lv 7 | 27% | 25% |
| V Lv 8 | 40% | 40% |
| VII Lv 10 | 43% | 43% |
| VIII Lv 11 (300) | 31% | 28% |

- All within the sim's noise. Chapter VIII's first 100-battle run read 37 → 25; at 300 it was 31 → 28.

## Consequences
- Fire mages on either side now shape where units can stand for a couple of rounds; ice becomes a counter.
- The ground changes during a battle, so anything that caches hazards (the scene's overlays) must refresh on `ground` events.
- Online versus: `ground` events carry every change, so clients redraw from events; no new hidden state.
