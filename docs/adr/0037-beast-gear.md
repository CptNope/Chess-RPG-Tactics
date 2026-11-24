# ADR 0037: Beast Gear

## Status
Accepted (0.29.0, 2026-11-24). Amends [ADR 0036](0036-beast-tamer.md), which kept beasts out of gear altogether.

## Context
- 0.28 let a Beast Tamer win monsters over into the squad. Beasts wore nothing: their natural stats (0.27) stood in for gear.
- People's gear keeps improving with the market's stock, so a beast tamed early would fall further behind each chapter. ADR 0036 named this as the main cost of its design.

## Decision
1. **A gear category of its own.** `Item.beast` marks barding and collars. A beast wears only beast gear; a person never does. One rule, `JobSystem.canEquip`, decides it, and every way gear goes on (the Team screen, `equipItem`, save import) goes through it.
2. **Two slots, not five.** Beasts fill `body` (barding) and `accessory` (collar or charm), the slots that make sense on an animal. Their natural stats still do the work of a weapon and helmet.
3. **Sold at the market, shelved apart.** Six pieces priced across the market's tiers, so better beast gear arrives as the story goes on, like everyone else's. They sit last, under their own heading, so people's shopping isn't cluttered.
4. **A collar to start.** Every new beast arrives wearing a Leather Collar (the first one brings it into the armory), so the system shows itself the first time a monster is tamed.
5. **Enemy monsters still wear nothing.** Story, Hollow and Trials balance is unchanged.

## Consequences
- **Beasts scale with the squad's purse**, like people: about +50 HP and +5 ATK from the best pieces.
- **Gear owned is shared**, as for all gear: buying one Spiked Collar lets every beast wear one.
- **Room for more**: beast-only traits (a collar that boosts a monster's own element, barding with Regen) can be added as items, without new rules.
