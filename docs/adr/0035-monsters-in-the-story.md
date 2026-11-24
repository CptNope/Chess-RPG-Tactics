# ADR 0035: Monsters in the Story

## Status
Accepted (0.27.0, 2026-11-24).

## Context
- 0.26 added monsters to a side battle and the Trials, but the story still fought only people.
- The first try at swapping them into the chapters made most of Act I and II much easier in the balance sim (the Mire from 9–20% to 38–57%). Monsters were weaker than people of the same level: no gear, so less ATK, MAG, HP and evasion, and no reactions or supports.

## Decision
1. **Fix the monsters, not the story.** `Job.innate.stats` gives each monster natural "gear" (fangs, hide, glow), counted wherever gear is. That raises them everywhere they appear, within the 2–6-hit and no-one-shot rules the core tests enforce.
2. **Replace like with like.** A monster takes the place of an enemy of similar strength at the same level, chosen by the sim: replacing a support caster with any damage dealer made a fight far harder (the Cape's Hourglass Seer), and replacing the hardest hitter made it far easier (the Harbor's monk). Where needed a monster is added rather than swapped (the Mire's ooze) or its level shifted by one (the Summit's Brute, the Cape's Wisp).
3. **Tone down Lure.** A wisp that sleeps a squad member every turn decided battles on its own. Lure now has an accuracy penalty (new `Ability.accuracy`), a shorter range and a higher MP cost.
4. **Tell the player.** Each chapter's intro has a line warning about its monster, in a squad member's voice.
5. **Chapter I stays human:** it teaches the game.

## Consequences
- **Chapter difficulty is about what it was,** within the sim's noise (about ±10 points at 100 battles per level). Stormbreak Cape came out a little harder at the top levels; the roadmap's hand play-through should judge it.
- **Monsters are stronger at the Howling Hollow and in the Trials** than in 0.26.
- **The sim is a yardstick, not the game:** the AI squad has no supplies, so Sleep and Poison weigh more on it than on a player.
