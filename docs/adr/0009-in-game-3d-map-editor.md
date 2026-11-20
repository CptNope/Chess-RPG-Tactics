# ADR 0009: In-Game 3D Map Editor & Live Mesh Mutation

## Status
**Superseded** by [ADR 0018](0018-workshop-scenarios-and-character-art.md) in 0.10.0: the Workshop replaced this editor.

## Date
2026-11-17

## Context
Tactical RPG players enjoy customizing scenarios, creating custom challenges, and sculpting unique terrain layouts. Hardcoding maps in TypeScript files limited experimentation to developers.

## Decision
We implemented a real-time **In-Game 3D Map Editor**:
- Toggleable via the top HUD (`✎ Editor`).
- Directly mutates the underlying `BattleGrid` and disposes/rebuilds specific Three.js tile meshes in real-time (`TacticsScene.updateTile()`).
- Supported tools:
  - **Raise Height (+0.5h)**
  - **Lower Height (-0.5h)**
  - **Paint Material**: Grass, Stone, Dirt, Water, Swamp, Parapet, Wood
  - **Toggle Walkability**
- Supports full JSON export to system clipboard and JSON import to load custom maps.
- **Test Battle** button allows players to immediately skirmish on their created map without reloading.

## Consequences
### Positive
- Players and level designers can sculpt 3D battlefields with zero external tools.
- Real-time mesh mutation ensures 60 FPS feedback without rebuilding the entire scene.
- Serialized JSON format enables map sharing and community levels.

### Negative
- Raycasting logic must switch between editor mode (intercepting clicks to edit) and combat mode (moving/targeting).
