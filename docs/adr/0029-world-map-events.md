# ADR 0029: World Map Events — a Travelling Merchant, Camp Scenes and Side-Battle Trophies

## Status
Accepted (0.21.0, 2026-11-23).

## Context
- The roadmap's next depth item was "world map events: a travelling merchant with one rare item, camp scenes between chapters, side battles with their own rewards".
- Side battles all paid the same (bounties and a bonus); nothing happened on the road between battles; the squad's story recruits never talked except in battle.

## Decision
1. **The merchant is derived, not saved.** Her place and wares are a pure function of won chapters, side-battle wins, the shop shelf and the armory (`merchantVisit`). Old saves need no migration, imports can't plant a merchant, and tests can walk her whole route.
2. **She moves after every win**, story or side battle (`merchantVisitIndex`). The stride across her stops shares no factor with their number, so she reaches every stop in turn rather than shuttling between two. A first version used a fixed stride of 3; the test that she visits every stop caught it skipping half of six stops.
3. **Two wares, not a shop.** One piece from the market's next shelf at ×1.25 (early access is the point, so it costs a little more), and one of three goods only she sells. Without care, buying a ware would reveal the next one, turning her into a second market that sells the next shelf piece by piece. So the save keeps what was bought on her current visit (`merchantSales`), and those wares stay on show marked Sold until she moves.
4. **Her goods are hers alone.** `MERCHANT_ITEMS` are kept off the market shelves and out of the Trials drop pool. They can be sold back (they're bought, not won), unlike relics.
5. **Camp scenes reuse the dialogue box.** It already draws portraits, sides and input hints, and sits above the world map (z 60 over 48). While a scene plays, the map is `inert`, so mouse, touch and focus can't reach it. Enter / A advance the scene before the world map's own focus handling sees them. `WorldMap.open()` clears `inert`, so loading a save mid-scene can't leave the map frozen.
6. **One scene per story battle but the last**, played from the panel wherever the squad stands, earliest unseen first. 30 JP each is enough to make it worth a click without being a grind lever (one per chapter, once per playthrough). Lines are filtered to speakers in the squad, though every scene's cast is fixed by when the recruits join. A test checks that.
7. **Old saves get one scene, not a backlog**: everything they've won counts as seen except the latest battle.
8. **Trophies are relics.** One per side-battle place, given on the first win, in `UNIQUE_ITEMS` (never sold, never dropped). A save that won there before 0.21 is given its trophy on loading (`missingTrophies`), so nobody has to fight again for something they earned.
9. **`__proto__` hardening.** Lookups by id from saves (`sanitizeCleared`, camp scenes, merchant sales) use `hasOwnProperty`, since `CAMPAIGN_CHAPTERS['__proto__']` is truthy.

## Consequences
- **The merchant can sit still for a win** when there are only two stops (right after Chapter I) and the win count steps by two. Her wares still change, since they also follow the visit number.
- **She runs out late in the game:** after every shelf is open and her three goods are bought, she isn't shown. More goods can come with Act III.
- **Camp scenes can't be replayed.** Fine for now; listed on the roadmap.
- **Item count is 60**: three merchant goods, three trophies.
