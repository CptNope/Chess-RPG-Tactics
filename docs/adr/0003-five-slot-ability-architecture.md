# ADR 0003: Five-Slot Ability Equipping Architecture

## Status
**Accepted**

## Date
2026-11-17

## Context
A major pillar of the game is rich character customization through job classes. In standard RPGs, classes often lock abilities to a single skill tree. In *Final Fantasy Tactics*, players can cross-pollinate skills across classes, enabling innovative player builds (e.g., a Black Mage equipped with a Knight's shield, or an Archer with White Magic).

## Decision
We adopted the **5-Slot Ability Architecture**:
1. **Primary Action**: Locked to current active Job (gives access to all learned action skills of that job).
2. **Secondary Action**: Freely equipped from any other unlocked job.
3. **Reaction Ability**: Triggered conditionally when attacked or damaged (e.g., *Counter Tackle*, *Auto-Potion*, *Weapon Guard*).
4. **Support Ability**: Persistent passive rule changer (e.g., *Equip Heavy Armor*, *Arcane Strength*, *JP Boost*).
5. **Movement Ability**: Modifies spatial movement or vertical traversal (e.g., *Move +1*, *Jump +1*, *Regen Walk*).

## Consequences
### Positive
- High combinatorial freedom for player builds ($5 \text{ jobs} \times 4 \text{ secondaries} \times \text{reactions} \times \dots$).
- Job points (JP) earned in battle remain permanently relevant even after changing active jobs.
- Clear structural division between action commands, passive triggers, and movement modifiers.

### Negative
- Requires robust validation to ensure secondary skillsets only expose learned abilities.
- Balancing requires careful attention to avoid overpowered cross-class synergies (e.g., high-speed Ninja with Dual Wield and Heavy Armor).
