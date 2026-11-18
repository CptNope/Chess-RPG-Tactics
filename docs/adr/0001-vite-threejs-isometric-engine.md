# ADR 0001: Vite + TypeScript + Three.js for 2.5D Isometric Engine

## Status
**Accepted**

## Date
2026-11-17

## Context
We needed a technological foundation to build a tactical RPG in the vein of *Final Fantasy Tactics*. Key requirements included:
1. True 3D stepped heightmap grid with elevation physics.
2. Smooth 90-degree camera rotation around the battlefield center without occluding sprites or terrain.
3. Retro pixel art aesthetic with crisp nearest-neighbor filtering and 2D billboard sprites.
4. Instant accessibility across modern web browsers without requiring heavy desktop installations or platform-specific builds.

## Decision
We chose **Vite + TypeScript + Three.js**:
- **Three.js** provides a WebGL rendering engine with native support for `OrthographicCamera`, custom shader materials, nearest-neighbor texture filtering (`NearestFilter`), lighting, shadows, and raycasting.
- **TypeScript** ensures strict typing across combat formulas, unit data structures, and job architectures.
- **Vite** offers fast Hot Module Replacement (HMR) and lightweight production bundles.

## Consequences
### Positive
- Zero runtime install friction: runs instantly in any web browser and can be hosted on static sites (GitHub Pages).
- Seamless 3D orthographic mathematics: pitch, azimuth rotation, and zoom frustum calculations operate natively in Three.js.
- Clean separation between core TypeScript game logic (pure headless data models) and presentation rendering.

### Negative
- Pure WebGL requires custom handling of 2D UI elements (achieved via responsive HTML/CSS tactical HUD panels).
- Larger minified bundle size (~500 KB) due to the Three.js runtime.

## Alternatives Considered
- **Pure 2D Canvas / PixiJS**: Would require manual sorting and shearing to simulate rotatable isometric terrain, creating mathematical complexity when rotating 90°.
- **Godot / Unity WebGL**: Significantly heavier build artifacts (>20 MB), longer loading times, and friction for quick web sharing.
