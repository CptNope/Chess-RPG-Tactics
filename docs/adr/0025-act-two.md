# ADR 0025: Act II

## Status
Accepted (0.17.0, 2026-11-23).

## Context
By 0.16.0 the game had a world map, a market, items, side battles and an eight-level job ladder with mastery, and a story of three battles per playthrough. The systems outlasted the content: a player met most of them once and the credits rolled. The roadmap's largest open item was more campaign.

Two things had also changed underneath the old finale:
- Enemy White Mages learned Raise in 0.16.0 and could cast it as often as their MP allowed.
- "The campaign is over" was derived, not stored: a won chapter with no `choices` is the finale.

## Decision
1. **Extend the chapter graph; add no new story machinery.** Chapter III gains one `choices` entry leading to `chapter_4`, and Chapters IV to VI follow as a single road. The world map already turns a chapter's choices into open missions with orders and a reward, the epilogue already fires on a won chapter with no choices, and the Trials already open on "campaign cleared". All three move to the end of Chapter VI without code changes.
2. **Act II is linear.** The first act's branch is the game's one story choice; a second would double the maps to build and test for a choice that carries no consequences yet. Each chapter still gives a marching reward, so the map panel reads the same as before.
3. **Each battlefield has one idea**, built with the existing seven terrain types: impassable sea with piers as the only roads (harbor), a climb with slow flanks (isle), a split climb with one crossing (cape). A test floods each map from the deployment tiles to make sure every enemy can be reached.
4. **Finished saves continue.** A 0.15 or 0.16 save that had won Chapter III has it in its cleared list, so Chapter IV simply shows as open. A pre-0.15 save knows only "campaign cleared": it is placed at the Summit (`FIRST_ACT_FINALE`) with the first and last chapters of the old story marked won. Such players keep `campaignCleared`, so their Trials and full market stay open while they play Act II.
5. **The old finale is renamed Chapter III** and its closing lines now point north instead of at the Trials. The Gate of Trials and New Game+ wait for the new ending.
6. **A third recruit, Sable (Thief), joins in Chapter IV.** Every battlefield already has six deployment tiles. A Thief gives a job the opening squad lacks and a voice with local knowledge for the new chapters' briefings.
7. **Rewards reuse existing gear** that no chapter gave before (Moonfang, Oathkeeper, Warding Amulet, Runeblade, Templar Mail, Dawnbringer). They are also sold at the market by then; the armory ignores duplicates.
8. **The enemy side may raise once per battle.** `planTurn` takes `noRevive`, and the game passes it once an enemy has cast a revive. Every Act II roster has a healer; unlimited raises turned those fights (and Chapter III) into attrition. One raise keeps "kill the healer first" as a tactic without letting a fight be undone. AUTO for the player's units is not limited: it spends the player's own MP.
9. **Balance by simulation, and say so.** `npm run balance` plays each chapter AI against AI with a starter-geared squad (now six units for Act II). Rosters were trimmed until that weak squad wins Chapter IV about half the time at level 7, Chapter V about 7% at level 8 and the finale about 17% at level 9: the same band as Chapter II, and far kinder than Chapter III's 0%. A real squad has shop gear, a healer, items and mastery. Nobody has played Act II by hand; that is the first item on the roadmap.

## Consequences
- **A playthrough is six battles**, and side battles, the market and mastery have time to matter.
- **The Trials and New Game+ are further away** for new players. Listed as a possible change (open the Gate after Chapter III).
- **The world map holds twelve places.** A test keeps any two at least 12% of the map apart, and the layout was checked for overlapping names at phone sizes.
- **Chapter V is the hardest of the three in simulation**, because the planner attacks uphill badly. If hands-on play agrees, it should swap rosters or levels with the finale.
- **Adding Act III is the same recipe**: a `choices` entry on Chapter VI, chapters, maps, places.
