# ADR 0059: The Sapper and earthworks

## Status
Accepted (0.54.0, 2026-11-28).

## Context
- Since 0.48 the ground can burn, poison, heal and hide traps, but its shape never changed in a battle: heights, walls and water were the map's own.
- Height already decides a lot. High ground hits harder, and an attack or spell reaches only within its height tolerance. There is no line of sight: a wall stops feet, not arrows.

## Decision
1. **Sapper**, an advanced job after Chemist 3 and Geomancer 2 (25 jobs). Sword or dagger, heavy armor; sturdy (HP ×1.1, ATK ×1.05), Move 4, Jump 3.
   - **Barricade:** a wooden wall on an empty tile within 2, for 3 rounds. Nobody can walk through it or stand on it.
   - **Earthwork:** raises a walkable tile within 2 (its own included) a step for the rest of the battle; water becomes dirt.
   - **Undermine:** physical damage to whoever stands on a tile within 2, then the tile sinks a step.
   - **Blasting Charge:** fire damage in an area within 3. It brings barricades down and, as a fire area attack, leaves embers (0.50).
   - **Dig In** (reaction): Protect when a physical blow lands.
   - **Fieldworks** (support): barricades last 5 rounds and earth moves 1.5 steps.
   - Signature: **Siege Works**, which raises every walkable tile within 1 of the aim.
2. **Rules** (`Earthworks.ts`):
   - A barricade remembers the tile (`TileData.works`: rounds, height, terrain) and puts it back when it falls, at a round's end (`tickWorks`) or to a blast.
   - It needs free ground: walkable, with no one standing or lying there. A spent thrall's body doesn't count.
   - Earth stays between 0.5 and 6 high.
   - Undermine's blow is judged from the old height; the ground moves after the hits.
3. **Engine:** `ActionEnd.works` and a `works` battle event. `Battle.check` refuses "No room for a barricade there." and "The ground can't go higher/lower there.", judged from where the Sapper will stand.
4. **Screen:**
   - Earthworks use the two-click aim with amber tiles.
   - The terrain is rebuilt after each change, and units rise or sink with their tiles.
   - Barricades get sharpened stakes on top, and the tile panel shows their rounds left.
   - A Blasting Charge aimed where only a barricade stands brings it down.
5. **AI** (`scoreWorks`):
   - A barricade beside an ally scores the extra steps it costs each foe that could reach that ally next turn (4 if it seals the ally off), ×1.5 for a hurt or spell-casting ally, capped at 24.
   - Raised ground scores 10, only under an ally that shoots or casts from 3+ with a foe in reach, and not where the tile already looks down on its neighbours. It never goes under a foe.
6. A **Raider Sapper** can join the Night Raiders at Watchfire Ridge. Sappers can be recruited, and their Trials title is **Siegewright**.
7. **Fix for 0.53:** the chapters' hazards, hold zone and traps were drawn on the maps, so every side battle, side story and Trials floor on those maps had them too (Watchfire Ridge showed a hold rim in a Survive battle, and its raiders got traps by the squad's deploy tiles). They are now the chapters' own (`CampaignChapter.ground`, laid with `markGround`). The maps are as they were in 0.52, and a remix in the Workshop keeps the chapter's ground.

## Tuning
- **First sweep** (`SWAP=p1`, 60 battles each in II-B Lv 4, IV Lv 7, VII Lv 10, VIII Lv 11): Sapper 58 / 25 / 23 / 17%. A trace showed it raising ground on most turns (174 Earthworks in IV), under allies who walked off next turn. Raised ground was worth 14 under any shooter and 6 under anyone else. It is now worth 10, under an engaged shooter only.
- **After the fix:**

  | Job | II-B | IV | VII | VIII | Mean |
  | :--- | :---: | :---: | :---: | :---: | :---: |
  | Sapper | 58 | 42 | 32 | 15 | 37 |
  | Knight | 52 | 60 | 35 | 12 | 40 |
  | Dark Knight | 35 | 58 | 10 | 7 | 28 |
  | Monk | 58 | 43 | 52 | 22 | 44 |
  | Dragoon | 65 | 83 | 33 | 27 | 52 |
  | Paladin | 45 | 57 | 20 | 15 | 34 |

  Mid-pack. Blasting Charge does most of its work; it builds when it pays (77 barricades in VII).
- **Watchfire Ridge** (150 battles): Lv 4 76% with the Raider Sapper in the pool and 51% without; Lv 5 and 6 unchanged (100%, 45%). The pool's draw swings it.
- The 0.53 chapters give the same numbers with their ground laid by the chapter instead of the map: II-B 42 / 53 / 63%, II-A 4 / 14 / 18%, IV 20 / 34%.

## Consequences
- Maps can change mid-battle. Anything that caches heights or walkability must read the grid fresh: the scene rebuilds the terrain, and `walkingDistances` and pathing read the tiles each time.
- `CampaignChapter.ground` is how a chapter gets hazards, a hold zone or traps from now on (0.56's later chapters, too).
