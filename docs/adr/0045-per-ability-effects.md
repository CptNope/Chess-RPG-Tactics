# ADR 0045: Effects per ability, and the AI teamwork experiment

## Status
Accepted (0.38.0, 2026-11-25).

## Context
- Battle effects were chosen by element. Every physical blow was a sword arc or a dagger flurry and a spark, and every bow or gun shot was a spark on the target with nothing in between. Every spell of an element looked the same, single target or area.
- The roadmap's last near-term item was smarter enemy AI (combos with allies, a second ply). Effects per ability sat under Later.
- Before effects, I built and measured AI teamwork for Hard: a Breach worth more when allies with weapons can reach the target, Slow, Immobilize and Blind worth more for each ally who can follow up, a bonus for leaving a foe low enough for allies to finish, and a focus-fire term. In the balance sim (60 battles per point, Chapters III, V, VII and IX, Hard) none of it moved win rates beyond noise, even at three times the weight. AUTO with teamwork didn't move Normal either. The person chose to drop it and do effects.

## Decision
1. **Missiles fly.** A bow's arrow and a gun's tracer travel from the shooter to the target. The gun adds a muzzle flash, and Scattershot uses a shotgun's flash and a fan of three tracers. `PixelEffects` gained `to` and `flight` (the origin moves along the path, with an arc for arrows, and the effect is removed on arrival), and `angle`, from the path's on-screen slope. The blow and its damage number wait for the missile to land (`BattleFx.launch` returns the flight time).
2. **The swing matches the weapon.** Spears thrust, fists throw an uppercut and land with a thump, whips crack, beasts claw, the Brute smashes. Swords and daggers keep their arcs.
3. **Area spells burst over the area.** An ice area spell plays a frost nova, and a lightning one a thunderclap, once on the aim tile. Each target then gets just a spark.
4. **A few abilities get their own look:** Jump lands heavily, Flash Powder is a smoke bomb, Breaching Round and Scattershot hit with a bullet's puff of dust and chips, and Thunder Volley lands heavily.
5. **Vendoring.** 14 new pixelfx effects were copied unchanged from the same upstream commit (5294518), with the `explosions` and `projectiles` category libraries. I read them first; they are drawing code only. One unused effect (`status/haste`, replaced by our own in 0.23) was removed. A test checks that every effect a cue names is vendored and every vendored effect is played. The repo's own render tools were not run. Effects were checked as contact sheets drawn by the game's own registry in the dev server, and in battle.
6. **The AI experiment is shelved**, not merged. The patch is kept outside the repo, and the result is recorded under known limits in [ENEMY_AI.md](../ENEMY_AI.md).

## Consequences
- The bundle grows by about 64 KB (25 KB gzipped).
- Ranged attacks take a little longer to land (about 0.1 to 0.4 s of flight, halved in fast mode).
- Anything new with a distinctive look goes in `BattleFx`'s `ABILITY` table, or `AREA` and `MISSILE` for a whole element or weapon.
