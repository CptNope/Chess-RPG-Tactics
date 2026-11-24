# ADR 0028: Smarter Foes, a Lighter Chapter III, and a Text-Size Setting

## Status
Accepted (0.20.0, 2026-11-23).

## Context
- The roadmap's next AI item was "approach uphill, respect facing and parries". The guess in 0.19's roadmap was that bad uphill pathing made Chapter III sit at 0% in the balance simulation.
- The planner walked toward foes by straight-line distance, ignored Weapon Guard, and ended turns facing wherever its last step pointed.
- Font sizes were fixed pixels (141 of them in the stylesheet, a few more inline). The roadmap listed a text-size setting.

## Decision
1. **Approach by walking distance.** `walkingDistances()` is a Dijkstra from a foe over walkable tiles, by the unit's own Jump and water rules, ignoring units. When nothing is in reach, the planner picks a foe it can actually walk to and moves along the path. Unreachable foes fall back to straight-line distance plus 100.
2. **Face the closest foe** at the end of every plan, not the direction of travel. A melee target is that foe anyway.
3. **Parry as expected value.** A frontal physical blow on a Weapon Guard knight has its hit chance × 0.7, the parry rate. The existing search already tries every tile, so side and back tiles win naturally.
4. **Drop the medic first.** `isSupportCaster()` (a heal, raise, or buff for others it can pay for, not silenced) raises the damage share × 1.3 and a KO +30. Self-only buffs (Bulwark) don't count, or every knight would be a "support".
5. **Self-buffs on the way in.** A self-only buff subtracts 0.6 × walking distance to the nearest foe, so a knight casting Bulwark also advances instead of buffing in place.
6. **A threat term was tried and dropped.** Penalising tiles that foes can reach next turn made no measurable difference in the simulation, so it isn't in the code.
7. **Chapter III's roster is lighter.** The pathing changes left it at 0%. The sim was then run with one change at a time (24 runs per cell, squad level 5 / 6): another battlefield, 5–15%; escorts a level lower, still 0%; also no assassin, 0–20%; also no medic, 4–38%; also no Chronomancer instead, 21–58%. A healer behind a Haste caster was what kept the fight out of reach. The shipped roster keeps the boss, the medic, the black mage and the knight a level lower, and drops the Chronomancer and the assassin: 28% / 60% / 55% at squad level 5 / 6 / 7 on Normal (40 runs each), up from 0%.
8. **Text size is one CSS variable.** Every UI `font-size` of 22px or less became `calc(Npx * var(--ts))`; `data-text-size` on `<html>` sets `--ts` to 1, 1.15 or 1.3. Applied at module load so the title screen is drawn at the chosen size. A unit test fails if a fixed size is added back. Title-art sizes (over 22px, or `clamp()`) don't scale.
9. **Where six buttons share a phone's width, the scale is capped** (`min(var(--ts), 1.1)`) and the ▶ marker is hidden, so STATUS fits. It overflowed by 4px even at Normal before.
10. **Unit HP bars moved under the HUD.** They shared the damage-number layer (z 25) above the panels (z 20) and showed through open menus. They now have their own layer at z 15; damage numbers stay on top.

## Consequences
- **The planner runs one Dijkstra per foe per turn.** On a 16×16 map that is a few hundred steps each, small next to the ~900 forecasts.
- **AUTO plays the same way**, so player units also face their foes and pick off enemy healers.
- **The sim is still pessimistic** (starter gear, no items, AI on both sides) and noisy at 24 runs. Chapter V sits low in it too; a hand play-through remains the real check (roadmap: Now).
- **Larger text means longer panels.** They already scroll; labels that would clip were checked at 1280×720, 390×844 and 844×390.
