# ADR 0017: Lighting, Atmosphere, Merged Terrain and Quality Tiers

## Status
Accepted (0.9.0, 2026-11-19)

## Context
The battlefield used flat ambient + directional lighting, hard `BasicShadowMap` shadows, a solid background color and stretched cliff textures. Every map looked like the same scene with a color tint. Each tile was its own six-material box, so a map cost ~760 draw calls per frame. That was fine on desktops, but it was the main cost on phones, where 0.8.0 made the game playable.

The design-skills tracker's vetted **CloudAI-X/threejs-skills** (lighting, shaders, post-processing, performance) guided the approach.

## Decision
1. **Per-map atmosphere presets** (`Atmosphere.ts`), chosen by map id and falling back to the theme: painted gradient sky with seeded stars, fog, hemisphere + sun + rim lights, exposure, bloom strength and torch colour. ACES filmic tone mapping, PCF shadows framed to the map's bounds.
2. **Extend built-in materials, don't replace them.** `onBeforeCompile` injects bevels, cliff AO, flowing water, swamp bubbles and grass sway into Lambert/Phong, so lighting, shadows and fog keep working. A single shared `uTime` uniform drives everything animated.
3. **Merge the terrain.** Tile faces are bucketed by material and merged (bottom faces dropped): ~760 → ~37 draw calls. Picking raycasts the merged meshes and maps the hit point to a tile.
4. **Cheap, readable set dressing.** Three `InstancedMesh`es (grass, reeds, pebbles), placed deterministically at tile corners so units and highlights stay clear, excluded from raycasts.
5. **Quality tiers** (`GraphicsQuality.ts`): High (bloom, vignette, 4× MSAA composer, 2048 shadows), Medium (1024 shadows, half decorations, DPR 1.5), Low (no shadow maps or torches, DPR 1). Auto picks by device and **steps down** after sustained frame rates under 40 fps; a manual choice is never overridden.
6. **Units stay pixel-art billboards.** They gain contact shadows and an active-unit ring rather than real shadow casting, which looks wrong for flat sprites.

## Consequences
- Each battlefield has its own identity, and spells, torches and glints glow on High.
- Phones get a lighter default and the game protects itself on weak GPUs; editing a tile rebuilds the merged terrain (cheap at this map size).
- High-tier cost on real integrated GPUs is still unmeasured; software-rendered CI runs at ~3 fps on High (30 on Low), so automated browser tests use Low.
- Unit art (procedural 32px sprites, emoji portraits) is now the weakest visual element; higher-resolution sprites are on the roadmap.
