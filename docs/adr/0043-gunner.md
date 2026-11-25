# ADR 0043: The Gunner

## Status
Accepted (0.36.0, 2026-11-25).

## Context
- With the story finished, the roadmap's next big item was a gunner: a ranged job that doesn't care about height. Height is the main thing a Tactics map is built around, and every other ranged job (Archer, Bard with a bow, Squire's Throw Stone) is bounded by it.
- 19 jobs, five of them advanced. A new job has to slot into the job tree, the gear rules, recruits, the Trials, mastery and signatures, and needs art in three views plus a portrait.

## Decision
1. **One rule: a shot ignores height.** `Ability.ignoresHeight` lets the ability reach any tile in range however high or low (`heightTolerance: 99`), and `getForecast` treats the height difference as 0, so high ground neither adds +5% hit and +10% damage nor costs −10% hit. Range is the gun's only limit. A gun's basic Attack gets this rule, and so does every Gunner action and the Thunder Volley signature.
2. **Guns are the Gunner's alone** (`WeaponType` `gun`, `JOB_GEAR.gunner`): Flintlock Pistol (reach 4, 300 G), Long Musket (reach 6, 540 G), Thunderlock Rifle (reach 6, ATK 13, 880 G), on the market's price-gated shelves. The Gunner can also hold a dagger.
3. **The kit:** Steady Shot (a free heavy shot, the counterpart of the Archer's Aim), Hobble Shot (Slow), Flash Powder (area Blind), Breaching Round (Breach), Scattershot (area damage that hits allies too), **Return Fire** (a reaction: 50% to shoot back at an attacker 2+ tiles away, inside the gun's reach) and **Long Barrel** (a support: +2 reach on a gun's Attack). Mastery: +1/+2 ATK. Signature: **Thunder Volley** (reach 7, area 1, Breach).
4. **Advanced, after Archer 3 and Thief 2.** On the recruiting board from Chapter IV, in the Trials as the "Musketeer", and veteran enemy gunners equip Return Fire.
5. **Gunshots land with the heavy impact effect,** and the sprite levels the musket with a flash and a puff of smoke.

## Balance
The balance sim's `GUNNER=1` puts Tobin in the Gunner job, keeping the archer's band and boots as he would after a job change. Normal, 60 battles:

| Chapter | Tobin as Archer | Tobin as Gunner |
| :--- | :--- | :--- |
| III (L3/4/5) | 2 / 2 / 12% | 0 / 5 / 7% |
| V (L7/8/9) | 47 / 43 / 62% | 35 / 62 / 52% |
| VII (L9/10/11) | 22 / 57 / 53% | 2 / 10 / 13% |
| IX (L11/12/13) | 12 / 35 / 43% | 15 / 40 / 47% |

- The first kit had no free heavy shot. The auto-battler spent every turn on Hobble Shot (power 0.8) where the Archer used Aim (1.4), and the squad lost far more. Steady Shot closed most of the gap.
- In Chapter VII the Gunner squad still loses much more. Tobin's damage per shot matches the Archer's. But he acts half as often, because the enemy focuses him. Free of height limits, the auto-battler picks firing spots on the low ground in reach of the court's melee fighters. That is a positioning weakness in the AI, not in the job's numbers. It's listed on the roadmap rather than patched with a Chapter VII special case.

## Consequences
- 20 jobs, 121 abilities. The Trials and the recruiting board can field gunners.
- Anything new that should ignore height sets `ignoresHeight`. Nothing else needs to change.
