# ADR 0041: Act III begins — the Far Shore

## Status
Accepted (0.34.0, 2026-11-24).

## Context
- The story ended at Chapter VI (the Drowned Regent), and every place on the world map was taken.
- The roadmap's Act III asked for Chapters VII to IX, new battlefields and new places. The direction chosen: follow the Regent's court across the sea to the drowned kingdom's old lands, with new kinds of ground, monster-heavy fights and the court's survivors.
- A whole act in one release is a lot to tune. Players who have finished the story should be able to carry on without starting over.

## Decision
1. **Ship the act in parts.** 0.34 adds its first two chapters (VII and VIII). Chapter VI becomes an ordinary chapter with a march order, so a save that finished the story finds Chapter VII waiting on the map. Chapter VIII is the finale for now: its own `epilogue` says the story continues in a coming update, and the Trials and New Game+ stay open as before.
2. **A second map, not a bigger one.** The realm's map is full. The Far Shore is a region of its own (`WorldNode.region`), painted by its own painter (sea-glass beaches, dunes, scrub, a snowy massif, and the drowned city's towers rising in the bay). Ships sail between Emberwick Harbor and the Anchorage once Chapter VI is won. No road crosses the sea, so walking and routes stay per region, and the map shows only the region the party is in.
3. **The realm keeps the shops.** The market and Wenna the Pedlar stay at home, so the sea crossing is a choice: restock first, or sail back. A Far Shore market is left for a later part of the act.
4. **New ground with one rule each.** Sand is ordinary ground with its own look and a Geomancer spell (Dust Devil: Blind). Snow costs 2 movement for everyone, like water and swamp, and gives Whiteout (Slow). Both are available in the Workshop.
5. **A new ally who uses 0.28's system.** Kestrel, a Beast Tamer, joins in Chapter VII, so the act's monster-heavy fights have someone on your side who can recruit from them.
6. **Tuned with the sim against Chapter VI.** The first rosters were far too hard (5% and 3% at the middle level). Probing swaps one unit at a time found a single unit behind each: the Court Duelist (a ninja) in VII and the Court Lancer (a dragoon) in VIII. The Duelist became a monk, the Court Pugilist. In VIII any seventh unit (archer, thornling, white mage, wisp, dragoon) left the chapter near 5%, so the pass fort holds six.

   | Normal, 100 battles | lower | middle | upper |
   | :--- | :--- | :--- | :--- |
   | VI at L8 / L9 / L10 | 1% | 17% | 35% |
   | VII at L9 / L10 / L11 | 18% | 47% | 55% |
   | VIII at L10 / L11 / L12 | 10% | 34% | 40% |

   VII is a step down after the Regent, as a new act's opening should be; VIII climbs back toward VI.

## Consequences
- The story is eight chapters long. Saves from 0.33 and earlier continue where they stopped; nothing is migrated.
- World map code is region-aware: anything new placed on the map picks a region, and a test checks that no road crosses the sea and that the merchant stays in the realm.
- The balance sim fields Kestrel in place of Sable in VII and VIII (a party of six) and shifts its default levels for Act III.
- A play-test sails to the Far Shore and starts Chapter VII in CI.
- Still to come in Act III: the drowned city and the Pale Heir (Chapter IX), Far Shore side battles and a market, and a camp scene after Chapter VIII.
