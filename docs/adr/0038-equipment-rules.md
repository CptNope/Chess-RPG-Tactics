# ADR 0038: Equipment Rules per Job

## Status
Accepted (0.30.0, 2026-11-24).

## Context
- Until now every job could wear everything, so the best piece in each slot went on everyone: a Black Mage in plate with a halberd. Gear choices didn't depend on jobs, and job changes cost nothing.
- The roadmap listed "weapon and armor types per job" since 0.14. Beasts (0.28–0.29) already had a wear rule of their own, `JobSystem.canEquip`.

## Decision
1. **Weapons by type, armor by weight.** Each job lists its weapon types. Shields, heavy armor and helms (`Item.armor = 'heavy'`) and robes (`'robe'`) belong to some jobs; everything unmarked (clothes, caps, hats, circlets, accessories) suits anyone. Most jobs get two weapon types; the front line gets shields and heavy armor, casters get robes. The table lives in `src/data/gear-rules.ts`.
2. **Starting gear sets the floor.** The rules were drawn so every job's starting gear already complies (a test checks every job, player and enemy), so the story, the Trials and the balance sim don't change. The Geomancer keeps heavy armor because it starts in mail.
3. **One rule, everywhere.** `canEquip` applies the job rules to people and the beast rule to beasts; equipping, the Team lists, save import and save load all go through it.
4. **Job changes clean up and refill.** Gear the new job can't use comes off, back to the armory, and the emptied slots take the best owned piece the job can use (its own armor kind first, then the priciest), so a change never leaves a unit empty-handed without saying so.
5. **Show the rules, don't hide the gear.** A unit's gear list shows what it can't wear, greyed, with who can; the job list shows each job's gear; the market says who each restricted piece is for.
6. **Old saves are fixed on load**, with a log note per unit, instead of keeping illegal gear.

## Consequences
- **Gear choices matter more**: a strong weapon helps only the jobs that use its type, and switching a caster into plate is no longer free HP.
- **Some players' units lose stats on load** (a mage in plate). The armory keeps the pieces.
- **Future content has a place to plug in:** supports such as "Equip Heavy Armor" or new weapon types are data in `JOB_GEAR` and `gearKind`.
