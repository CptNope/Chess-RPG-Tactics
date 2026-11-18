# ADR 0005: 3D Height-Constrained Dijkstra Pathfinding (Move & Jump)

## Status
**Accepted**

## Date
2026-11-17

## Context
Standard 2D grid pathfinding calculates Manhattan or Chebyshev distances on a flat $(X, Z)$ coordinate plane. In a 3D isometric tactical RPG with elevation, terrain height fundamentally impacts traversal:
1. A cliff 3 units high cannot be walked over by a unit with `Jump 2`.
2. Enemies block movement paths, whereas allies can be traversed through (but not occupied).
3. Water and obstacles alter cost and walkability.

## Decision
We implemented a **3D Dijkstra / BFS Pathfinding Algorithm** in `BattleGrid.ts`:
- Traverses 4-way orthogonal neighbors $(dx = \pm 1, dz = \pm 1)$.
- Validates that $|H_{\text{next}} - H_{\text{current}}| \le \text{unit.jump}$.
- Treats enemy units as solid impassable blockers.
- Enforces cost limits $\le \text{unit.move}$.
- Validates landing tile occupancy so two units never end their turn on the same tile.

## Consequences
### Positive
- True height physics: high plateaus and ruined battlements can create tactical chokepoints and defensive bastions.
- Jump stat and movement abilities (e.g. *Move +1*, *Jump +1*) directly influence tactical positioning.

### Negative
- Evaluating 3D neighbors has slightly higher computational overhead than flat 2D BFS (negligible for typical tactical map sizes of 11x11 to 24x24).
