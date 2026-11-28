# ADR 0057: The Necromancer and thralls

## Status
Accepted (0.52.0, 2026-11-28).

## Context
- 0.46–0.51 gave jobs new things to work with: HP costs, totems, traps, and the ground. None of them made use of the fallen, who stay on the field as markers until the battle ends.
- Changing sides already has rules: Charm and Dancer's Captivate turn a foe for a while, and `joinSide` (0.41) moves a unit between teams and alliances.

## Decision
1. **Necromancer**, an advanced job after Black Mage 3 and Oracle 2 (24 jobs). Staff and robes; frail, high Magic and MP.
   - **Grave Bolt** (dark magic), **Wither** (damage and Slow).
   - **Raise Thrall:** a fallen foe within 3 tiles stands up on the caster's side.
   - **Corpse Burst:** a body explodes, hitting everyone within a tile of it.
   - **Soul Siphon** (reaction): heals 25% of damage taken.
   - **Dark Pact** (support): thralls rise with 60% HP and last 5 turns.
   - Signature: **Army of the Dead**, which raises every foe's body in a 2-tile area.
2. **Thralls** (`Necromancy.ts`):
   - A thrall rises with 40% of its max HP and the `thrall` status for 3 of its own turns. It keeps its own job and abilities.
   - It crumbles back into a body when the status runs out or when it falls. Then it goes back to its old side, is dead again and is **spent**: no one can raise it again, and Corpse Burst can't use it.
   - It earns nothing (no EXP, JP or kills toward progress).
3. **What can be raised:** only a foe's body (from the caster's side), never a boss, a tamed beast, a spent body, or a body someone is standing on. Where two bodies lie on one tile, `raisableAt` finds the foe's.
4. **Enemy Necromancers can raise your fallen against you.** `resetForBattle` sends them home and clears `spent`, so the next battle starts clean.
5. **Engine:**
   - `Battle.settle` crumbles fallen thralls and emits a `crumble` event.
   - `Battle.check` asks for a body to raise or burst ("No body to raise there." / "No body there."), checked from where the caster will stand.
   - `checkReaction` now gets the damage taken, for Soul Siphon.
6. **AI:** a raise is worth 22 + 1.5 × level + (ATK + MAG) / 10 for each body. A burst is scored like any area attack centered on the body.
7. **Screen:**
   - While a Necromancer acts, foes' bodies show ☠ markers.
   - Raising and bursting use the two-click aim from the Shaman.
   - A thrall keeps its own colors with a pale green tint.

## Tuning
- Back-line sweep (`SWAP=p3`, 40 runs each over Chapters II-B, IV, VII and VIII): Necromancer 47/29/7 against Black Mage 44/40/4, Shaman 45/47/1 and White Mage 38/47/8. Mid-pack; no change.
- A trace showed it using everything: Chapter IV Grave Bolt 100, Raise 31, Burst 24, Wither 17; Chapter VII Raise 72, Wither 46.
- **Drowned Shrine** gained a Grave Cultist (Necromancer). Lv 4 went 89% → 94%, and Lv 6 86% → about 65–72%. A control with a second Black Mage in that slot gave 70%, so the drop is from the larger pool, not the Necromancer.

## Consequences
- 24 jobs. Bodies now matter on the field: kill a Necromancer first, or finish fights before it can raise your fallen.
- `spent` and the crumble rules are open to later effects that use bodies.
