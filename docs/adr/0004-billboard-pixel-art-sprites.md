# ADR 0004: Procedural Canvas Pixel Art Textures & Directional Billboarding

## Status
**Accepted**

## Date
2026-11-17

## Context
The visual identity of *Final Fantasy Tactics* and *Tactics Ogre* relies on 2D pixel art character sprites placed inside a 3D isometric world. When the 3D camera rotates 90 degrees, the character sprites must appear 3D-aware by dynamically showing the appropriate perspective (Front, Back, Left Side, Right Side) rather than an unchanging flat plane. Furthermore, to eliminate external asset loading latency or broken image dependencies, asset generation needed to be self-contained.

## Decision
1. **Procedural Pixel Art Engine**: Character sprites (32x32) and terrain textures (16x16) are generated via HTML5 `Canvas` and converted to Three.js `CanvasTexture` using `THREE.NearestFilter` to prevent bilinear blurring.
2. **Directional Camera Billboarding**:
   - Each character sprite is a 2D plane whose Y-rotation mirrors the camera's azimuth rotation.
   - The game calculates the relative angle between the unit's facing direction ($N, S, E, W$) and the camera's current viewing quadrant ($SW, NW, NE, SE$).
   - The texture dynamically updates to Front, Back, or Side perspectives corresponding to that relative angle.

## Consequences
### Positive
- Zero external image assets required; zero network asset fetching delays.
- Dynamic perspective swapping gives the illusion of full 3D animated sprites while preserving retro 16-bit pixel aesthetics.
- Seamless nearest-neighbor scaling looks sharp at extreme close-up zooms (down to 2.0x).

### Negative
- Procedural pixel drawing code requires canvas coordinate maintenance.
- In future production phases, replacing procedural drawings with external sprite sheets will require a sprite-atlas loader.
