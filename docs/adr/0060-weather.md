# ADR 0060: Weather

## Status
Accepted (0.55.0, 2026-11-28).

## Context
- Weather was only drifting particles, one set per map theme; it changed nothing in a battle.
- The ground (0.48–0.54) and the elements already give weather something to work on: embers burn, ice puts them out, fire and lightning spells hit by element.

## Decision
1. **Three kinds**, set for a whole battle (`Weather.ts`); clear when unset.

   | Weather | Elements | Also |
   | :--- | :--- | :--- |
   | Rain | Fire ×0.75, lightning ×1.25 | Nothing burns: fire leaves no embers, and the map's own embers are out for the battle |
   | Snow | Ice ×1.25, fire ×0.85 | Everyone's Move is 1 less (at least 2) |
   | Fog | — | Blows from more than 2 tiles away: −15 to hit (before the cap at 100) |

   Element changes apply to damage only; heals are untouched.
2. **It lives on the battle's copy of the map** (`MapData.weather`, set by `applyWeather`), so everything that already reads the grid gets it for free: `getForecast` (a new `weather` argument, passed by `forecastFor`, the AI's scoring and threat map, and the Ranger's Ambush), `getReachableTiles` and pathing (`weatherMove`), and `changeGround` (`canBurn`).
3. **Where it falls:**
   - **Stormbreak Cape (VI): rain.** **Frostfang Pass (VIII): snow.**
   - **Side battles:** rain at Watchfire Ridge, fog at Briar Barrow.
   - **Trials:** from floor 5, floors 1, 3 and 5 of every 6 bring rain, fog and snow (`trialWeather`).
   - **Workshop:** a Weather choice on the Rules tab, kept in files and share links (`map.weather`). A remix of a chapter keeps its weather.
4. **Screen:**
   - A badge under the turn order (☔ RAIN, ❄ SNOW, 🌫 FOG), with the rule as its tooltip, and a `[WEATHER]` line in the log at the start.
   - Rain falls in slanted streaks and dims the light; snow drifts; fog draws the distance fog in.
5. **The balance sim** applies the chapter's weather; `WEATHER=off|rain|snow|fog` overrides it.

## Tuning
200 battles per level (150 for side battles), with the weather on, then off (`WEATHER=off`):

| Battle | Off | On |
| :--- | :--- | :--- |
| II-A with fog (Lv 3/4/5) | 4 / 14 / 18% | 1 / 8 / 9% |
| VI with rain (Lv 8/9) | 1 / 28% | 5 / 29% |
| VIII with snow (Lv 11/12) | 27 / 38% | 40 / 27% |
| Watchfire Ridge with rain (Lv 4/5/6) | 76 / 100 / 45% | 79 / 99 / 45% |
| Briar Barrow with fog (Lv 6/7) | 85 / 87% | 80 / 84% |

- Fog made the Gloomy Mire, already the hardest early chapter, harder still: the squad leans on archers and mages there. II-A stays clear, though Rowan still calls the fog thick.
- VI, VIII and the side battles move within noise, so they keep their weather.

## Consequences
- Any battle can take weather, and any rule that reads the grid can depend on it.
- Weather that changes during a battle (a storm rolling in) would need a round hook like `tickGround`. Not now.
