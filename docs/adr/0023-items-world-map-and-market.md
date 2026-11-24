# ADR 0023: Battle Items, a World Map Between Missions, and a Market That Buys and Sells

## Status
Accepted (0.15.0, 2026-11-23).

## Context
After 0.14.0:
- **Gil ran out of uses.** The armory is a shared set, so each item is bought once, and a complete armory left nothing to spend on (ADR 0022 named consumables as the planned sink).
- **A fallen unit was out for the battle.** No ability or item could target the dead.
- **Battles ran back to back.** Victory led to a choice modal and straight into the next fight; defeat offered only Retry or Load. The shop lived in a tab you could open mid-battle, which made buying a potion in the middle of a boss fight possible in principle and gave the game no place between fights.
- **Haste looked wrong.** Its effect (pixelfx `status/haste`) draws speed streaks about five tiles wide; on our small units it read as an effect happening next to the unit. A player reported it as "away from the sprite".

## Decision
1. **A consumable is data that becomes an `Ability`.** `consumableAbility()` builds an ability with `item` set and one of `fixedHeal`, `fixedMp`, `fixedDamage`, `revive` or `cleanse`. Targeting, range, area, the forecast panel, effects, logging and the action pipeline are then the ones abilities already use. `CombatEngine.executeAttack` hands anything with `item` to `useItem`, which never rolls.
2. **Items are fixed and certain.** No hit roll, crit, facing, height, mitigation or reaction. A potion is worth the same in every hand, so the choice is who spends their action, not who has the best stats. A Blast Flask does full damage across its blast for the same reason.
3. **The inventory is counts, shared by the squad** (`Record<id, number>`, at most 9 each), separate from the armory's set of ids. Six supplies only; each does one thing.
4. **Revive is a targeting rule, not a special case in the UI.** `unitsInBlast` selects the dead exactly when the ability revives, and `itemCanTarget` is the single statement of the rule. A DOM marker stays over a fallen ally's tile so the target can be seen; the tile must be free of the living.
5. **Items earn no JP and no acting EXP**, and the **AI never uses them**: AUTO must not spend what the player paid for, and enemies carry none. (Both are open to change; see the roadmap.)
6. **The world map is the hub between missions.** Its rules live in `core/World.ts` with no DOM: places, roads, and `openMissions(currentChapter, clearedChapters)`. The view (`ui/WorldMap.ts`) knows the game only through a `WorldHost` interface.
7. **The story branch is chosen by marching.** `openMissions` returns both next chapters after a win, each carrying its `StoryChoice`; marching applies that choice's reward and loads the chapter. The walk follows the branch actually won, so the road not taken stays closed even if the save's chapter pointer is stale. This replaces the choice modal and needs no new campaign data.
8. **Defeat can retreat to the map.** The chapter stays the open mission. Together with the market this turns "I can't beat this" into something to do.
9. **Trading happens only at the market place.** The Shop tab is still reachable anywhere (browse, plan), but `buy*` and `sell*` check `marketOpen()`. The shop's tier now also rises when the current chapter is won, because that is when the player first stands in it.
10. **Selling is allowed, with two refusals.** Selling removes an item from the shared armory, so gear someone is wearing can't be sold (it would silently unequip), and the three relics can't be re-bought so they can't be sold. Everything pays half price, the same rate as fenced loot.
11. **The map is painted in code** on a 320×180 canvas (value noise for land and sea, then roads and a small icon per place) and scaled up with `image-rendering: pixelated`. Places are HTML buttons positioned by percentage over it. That keeps the "no image files" rule, gives keyboard, controller and screen-reader support through the existing spatial focus navigation, and makes the layout responsive for free.
12. **The map is a layer, not a mode.** It shows while `currentMode` is `menu`; `activeLayer()` ranks it below the modals. The 3D scene skips rendering while it's covered.
13. **Saves record where you stand.** `clearedChapters`, `onWorldMap` and `worldLocation` are optional fields; a save made on the map resumes on it. Old saves resume in their battle, with the chapters before it taken as won and the starting supplies added.
14. **Haste gets a local effect** (`src/renderer/fx/quicken.js`) written against the vendored pixelfx core: after-images, side streaks and a foot ring inside a 64×72 box anchored at the unit's feet. `PixelEffects` looks up local effects after the vendored registry, so the vendored code stays unchanged. Focus moved to an on-unit effect as well.

## Consequences
- **Gil has a sink that scales with difficulty**: a hard fight costs supplies, an easy one doesn't.
- **A wipe is harder to reach** with a Phoenix Feather in the bag; the balance sim (AI only, no items) is unchanged, so the campaign's hands-on difficulty dropped slightly. Enemy numbers were left alone.
- **Retry keeps supplies spent; loading a save restores them.** This inconsistency is listed as a known issue.
- **New Game still opens on Chapter I**, not the map: with one battle and a 300-gil purse there is nothing to decide there yet.
- **Workshop battles and the battlefield picker stay outside the map.** Opening the Workshop from the map parks the map and returns to it.
- **Adding a place is data**: a node, a road, and (for a battle) a chapter id. The painter draws an icon by kind and chapter.
- 24 tests pin the item rules, inventory clamping, sale refusals and the map's open/cleared/locked logic, including the closed-branch and old-save cases.
