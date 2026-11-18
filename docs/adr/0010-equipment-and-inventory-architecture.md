# ADR 0010: Five-Slot Equipment & Weapon Range System

## Status
**Accepted**

## Date
2026-11-17

## Context
In classical tactical RPGs (*Final Fantasy Tactics*, *Tactics Ogre*), unit stats and combat reaches are not determined by job class alone; gear loadouts define practical survivability, attack power, and weapon ranges (e.g. spears hitting 2 tiles away, bows firing from 5 tiles away, heavy plate armor granting HP at a slight speed cost).

## Decision
We implemented a **5-Slot Equipment System**:
- Slots: **Weapon**, **Shield**, **Headgear**, **Body Armor**, and **Accessory**.
- Integrated into `JobSystem.recalculateDerivedStats()`:
  - Gear adds directly to max HP, max MP, Attack, Magic, Speed, Move, Jump, and Evasion.
  - Equipped weapons dynamically override the unit's basic attack range (e.g., Holy Dragon Lance sets melee reach to 2 tiles, Longbow sets range to 5 tiles).
- UI integration: Added an **Equipment & Gear** subtab within the `#job-modal` to view live loadouts and equip items with immediate stat feedback.

## Consequences
### Positive
- Deepens character build customization alongside the 5-slot ability system.
- Enables distinct tactical playstyles (e.g., evasion dodge tanks with shields vs two-handed damage dealers).
- Weapon range modifiers integrate cleanly with existing Dijkstra range queries.

### Negative
- Requires maintaining an item catalog and balancing stat weightings across equipment tiers.
