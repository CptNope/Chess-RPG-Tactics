# ADR 0058: Ground in the story

## Status
Accepted (0.53.0, 2026-11-28).

## Context
- Hazards and hold zones (0.48) were only in Cinder Spring and the Workshop, and traps (0.49) only came with Rangers. A player could finish the campaign without meeting any of them.
- Three chapters already tell the story for them: the Gloomy Mire's warlock "has poisoned" Bria's home, Chapter IV is called "Fire on the Water", and Chapter II-B is a siege at a gate.

## Decision
1. **Story maps:**
   - **Gloomy Mire (II-A):** miasma on six swamp tiles by the warlock's shrine, and a clean spring (two tiles) on the middle island. Bria points both out.
   - **Emberwick Harbor (IV):** embers on the end of the west pier and on a warehouse on the quay. Corvin warns about them.
   - **Night Battlement (II-B):** the gate and the row just outside it are a hold zone (4 tiles), and a snare and spikes are hidden on the approach.
2. **Chapter II-B is a Hold battle:** 3 rounds, or defeat them all. It is the only chapter with a hold objective.
3. **Map traps:** `TileData.trap` marks a trap laid before the battle. At the start, `layMapTraps` gives them to the enemy boss (else its first unit), so they follow the 0.49 rules: hidden from the squad, spikes hit with the owner's attack, and they stay if it falls. The battle's grid is a copy, so the map keeps its marks.
4. **The enemy guards a zone, it doesn't rush it** (`PlanOptions.guardZone`): it gets no pull toward the zone on a walk and no bonus for ending on it. The squad's AUTO still goes for it.
5. **Workshop:** the Ground tool paints Snare, Spikes, Slumber, Smoke and No trap. The editor draws them, and the scene draws them only while the Workshop is open (`setMapTraps`). Blocking a tile removes its trap.
   - Files keep `trap` on walkable tiles.
   - Share links add `^` and a letter (n, k, z, s) after a cell; older links still load.
   - Warnings: a trap on a deploy tile (whoever starts there won't spring it), and traps with no enemy to own them.
6. **Tips:** a first-time **Hold the ground** tip, shown on a player turn once the first-turn tip has been seen. The trap tip now says traps can be dug in before a battle.

## Tuning
All from the balance sim, 200 battles per level, the same command before and after.
- **II-B with both sides going for the zone:** 51% → 20% at Lv 4. Every defender left the walls for the 2×2 inside the gate. Keeping only those already on it still gave 19%. With `guardZone`, the zone moved a row out (gate and approach), and no traps: 49 / 53 / 64%.
- **II-B traps:** a snare, spikes and smoke cost 10–15 points. A snare and spikes, set off the zone, cost about 5.
- **Final, before → after:**

  | Battle | Before | After |
  | :--- | :--- | :--- |
  | II-B (Lv 3/4/5) | 41 / 57 / 66% | 42 / 53 / 63% |
  | II-A (Lv 3/4/5) | 4 / 9 / 19% | 4 / 14 / 18% (the spring helps a little) |
  | IV (Lv 6/7) | 20 / 34% | 20 / 34% |
  | Cinder Spring (Lv 6/7/8) | 60 / 88 / 100% | 64 / 86 / 100% |

  Cinder Spring's 24 timeouts at Lv 6 went away with `guardZone`.
- In the sim the squad still wins II-B mostly by routing: about 1 win in 17 is a hold. That's AUTO's choice; a player can go for the gate.

## Consequences
- Any map can carry traps, in the story or the Workshop. The Workshop gets them through the scenario format; the story through `maps.ts`.
- Later chapters can take a hold objective, map traps or hazards the same way.
