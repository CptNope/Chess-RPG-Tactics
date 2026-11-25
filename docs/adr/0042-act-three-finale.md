# ADR 0042: Act III's finale — the Drowned City

## Status
Accepted (0.35.0, 2026-11-24).

## Context
- 0.34 shipped Act III's first two chapters and ended the story at Frostfang Pass with a to-be-continued screen ([ADR 0041](0041-act-three-the-far-shore.md)).
- The Far Shore had no side battle and no way to restock, so every visit to the market meant two sea crossings.
- The roadmap listed a Chapter IX finale, more Far Shore places, and a camp scene after Chapter VIII.

## Decision
1. **One more chapter ends the act.** Chapter VIII gets a march order to Chapter IX: the Drowned City, a new 16×16 map of pale streets, weed-silted canals (swamp: slow to wade), one bridge over the east canal, a plaza and a stair to the palace dais. The Pale Heir is a Summoner boss (level 12) with her own portrait. Her closing screen (`epilogue`) says Act III is complete. Saves that finished 0.34 continue from Frostfang Pass.
2. **The finale has a camp scene too.** Until now the last chapter had none, because the epilogue closed the story. Now the epilogue's World Map button leads to "The Ship Home", so the act ends with the squad together. The camp test now expects a scene after every chapter.
3. **The ship's stores, not a second market.** The Anchorage trades from Larkmoor's shelves (`marketOpen` is true there too). Hiring stays at Larkmoor, and so does Wenna, so the realm keeps something of its own.
4. **A side battle sized for the shore.** The Glasswing Dunes reuse the Saltglass map, like the Barrow reuses the Mire. With the usual four enemies a first visit won 93–100% in the sim, so `SkirmishDef.size` lets a place field more. The Dunes field five (six at full heat).
5. **Tuned with the sim.** Chapter IX at L11/12/13, Normal: about 7 / 29 / 40%. That's between Chapter VI (1 / 17 / 35%) and Chapter VIII (10 / 34 / 40%), with six enemies like VIII.

   | Glasswing Dunes (Normal, 30 battles) | L9 | L10 | L11 |
   | :--- | :--- | :--- | :--- |
   | First visit | 100% | 87% | 100% |
   | Second | 93% | 70% | 87% |
   | Full heat | 40% | 10% | 10% |

## Consequences
- The story is nine chapters long (eight per playthrough) and finished. New Game+ and the Trials open after Chapter IX.
- Rosters drawn at random can stack wyverns, and those draws are much harder than the rest. The Dunes show the widest spread of any side battle. It's listed as a known issue rather than special-cased.
- Relics: the Tidecrown (Chapter IX) and the Glasswing Lance (the Dunes) are never sold.
