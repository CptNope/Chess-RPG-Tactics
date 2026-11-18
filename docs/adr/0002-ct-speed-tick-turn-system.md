# ADR 0002: Speed-Based CT (Charge Time) Turn System vs Team Turn System

## Status
**Accepted**

## Date
2026-11-17

## Context
Tactical RPGs generally follow one of two turn architectures:
1. **Phased / Team Turn System** (e.g., *Fire Emblem*, *Chess*): Player moves all units, followed by Enemy moving all units.
2. **Individual Speed / Charge Time System** (e.g., *Final Fantasy Tactics*, *Tactics Ogre*): Units accumulate action points (CT) based on individual Speed attributes, interweaving player and enemy turns dynamically.

## Decision
We implemented a **Speed-Based Charge Time (CT) Engine**:
- Each tick of the game clock, every alive unit receives $CT = CT + \text{Speed}$.
- When any unit's $CT \ge 100$, the clock halts and grants that unit an active turn.
- An upcoming turn predictor simulates future ticks to populate a real-time turn timeline ribbon at the top of the HUD.
- **CT Refund Mechanics**:
  - Moving AND Acting: $CT = \max(0, CT - 100)$
  - Moving ONLY or Acting ONLY: $CT = 20$ ($20\%$ refund)
  - Pure WAIT: $CT = 40$ ($40\%$ refund)

## Consequences
### Positive
- Deep strategic depth: Speed becomes a high-value stat, and opting not to move or act accelerates subsequent turns.
- Eliminates "alpha strike" advantage where the first-moving team wipes out the opponent.
- Matches authentic *Final Fantasy Tactics* gameplay feel.

### Negative
- AI logic requires asynchronous turn handling rather than batch evaluation of the entire team.
- More complex state simulation required for turn forecasting.
