# ADR 0056: Creatures of fire, frost and bog

## Status
Accepted (0.51.0, 2026-11-28).

## Context
- 0.48–0.50 made the ground matter: map hazards, totems, traps, and spells that burn, douse and poison it. Most battles only meet that through a Black Mage or a map's author.
- Monsters are the game's way of giving each fight a character. None of the eight interacted with the ground beyond the Bog Ooze's spit leaving miasma since 0.50.

## Decision
1. **Three monsters**, each making one kind of ground through the 0.50 rules (no special cases):
   - **Emberback** (Beast; id `salamander`, since the Summoner already has a fire spirit called Salamander): Flame Spit (area, leaves embers), Kindle (a burst around it, embers around it), Tail Whip.
   - **Frost Sprite** (Spirit, flies): Frost Bolt, Rime Burst (area, Slow, puts out embers), Hoarfrost Veil (Shell around it, puts out embers). Immune to Slow, Sleep and Poison.
   - **Bog Lurker** (Beast): Venom Spit (area, Poison, leaves miasma), Snap, Drag Under (Immobilize). Immune to Poison and Blind.
2. **`innate.thrives`**: hazards that heal a monster 10% instead of hurting it. The Emberback thrives on embers, the Bog Lurker on miasma. `hazardFor` checks it first, so the AI's ground scoring makes them seek their ground; the screen says "basks" or "breathes in the miasma".
3. **AI:** a hurt unit (below half HP) now weighs the ground at 0.6 instead of an eighth on a plain walk, so it heads for healing ground and away from harm when it has nothing better to do.
4. **Where they are met:**
   - Emberbacks at Cinder Spring, Bog Lurkers at Howling Hollow, Frost Sprites at Briar Barrow (one more name in each pool).
   - All three in the Trials from floor 13 (`TRIAL_DEEPER_MONSTERS_FROM`), so floors 1–12 are unchanged.
   - Tameable, with beast names of their own.

## Tuning
- Frost Sprite: the combat tests (2–6 basic hits to fell a same-level unit; no same-level spell one-shots) failed at ATK 0.6 / HP 0.95. It now matches the Marsh Wisp (ATK 0.85, HP 1.05).
- Emberback: HP 1.05, ATK 1.15, built-in HP +10. Lighter than the Basilisk, since it heals on its own ground.
- **Cinder Spring:** 73% at Lv 7 in 0.50 (fire now burns the ground there), 59% with the larger pool.
  - Swapping the Emberback for a second Archer gave 55%, so the drop was the composition, not the Emberback.
  - Cinder Spring now sends **four** zealots (five at full heat): 61% / 88% / 100% at Lv 6 / 7 / 8, and 59% at full heat (Lv 7).
- Howling Hollow (Lv 4: 100%) and Briar Barrow (Lv 6: 85%) didn't move. Story chapters: II-B 57%, IV 26%, VII 43%, VIII 25% (within noise of 0.50).

## Consequences
- 11 monsters. `thrives` is open to any later monster (a spring-dwelling one, say).
- The squad can tame an Emberback or Bog Lurker and fight on its ground.
