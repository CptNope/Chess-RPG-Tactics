# ADR 0048: Recruit side stories

## Status
Accepted (0.43.0, 2026-11-25).

## Context
- The roadmap's 0.43 was "more story". Asked which direction, the person chose side stories for the story recruits, over an epilogue chapter or a new act.
- Bria, Sable and Kestrel each join with a reason that the main story never comes back to:
  - Bria's village is poisoned.
  - Sable has a debt to repay: "nobody has asked me to give anything back yet".
  - Kestrel's village is burned.
- The world map already has optional places (side battles). Those are generated and replayable; a story needs written scenes and a fixed cast.

## Decision
1. **One chapter per recruit**, defined in `core/SideStory.ts` and fought at a new place of their own:

   | Village | Recruit | Region | Battlefield | Opens after |
   | :--- | :--- | :--- | :--- | :--- |
   | Fenhollow | Bria | Realm, off the Mire | Gloomy Mire | Chapter III |
   | Saltmere | Sable | Realm, west coast | Emberwick Harbor | Chapter V |
   | Dunehome | Kestrel | Far Shore | Saltglass Shore | Chapter VII |

   Each reuses an existing battlefield under a new name (the chapter carries `mapData` with the place's field name).
2. **Opening.** A story opens once its recruit is in the squad and its chapter is won. Its place, a new world-node kind `story`, appears on the map only then. The map's background art always shows the village; only the pin waits.
3. **Told once per playthrough.** Won ids are saved as `sideStories`. New Game and New Game+ clear them, like camp scenes.
4. **The recruit fights it.** The chapter names the hero as its `recruit`, so `chooseParty` always deploys them. The party screen shows them as **FIGHTS**, taking a seat, and keeps them in the saved party afterwards.
5. **Levels follow the squad**, so a story left for later is still a fight. Enemies are at the squad's average level, never under a per-story floor, and the boss is one level up. The objective is to defeat the boss, so the rest flee.
6. **Mode `story`.** It pays bounties and the usual clear bonus, plus the relic. It resumes on the map like a side battle, and a loss can be retried or left. After the victory scene the squad stands on the map at the place, now marked told.
7. **A relic each**, never sold:
   - Fenhollow Spring-Stone
   - Saltmere Coin
   - Dunehome Whistle
8. **Kestrel's story leans on Tame.** The Huntmaster's "Broken Wolf" is a normal wolf that Kestrel can win over, as her intro line suggests.

## Consequences
- Each recruit's opening promise gets a payoff, without touching the main path or its save fields.
- **Not done:**
  - New maps; each story reuses its region's battlefield.
  - A camp scene or memory entry for side stories: their victory dialogue is their closing scene.
  - Side stories for hired recruits.
- 5 new tests (317 total).
