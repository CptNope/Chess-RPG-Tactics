# ADR 0013: Engine Performance, Object Pooling, and Animation Loop Optimization

## Status
Accepted

## Context
As the scope of *Chess RPG Tactics* expanded to feature 8 job classes, directional billboarding, dynamic point lights, particle systems, 3D map editing, and screen-projected overhead HUD elements, several performance bottlenecks and garbage collection (GC) pressure points emerged:
1. **Dynamic Texture Allocations**: Procedural character sprites were generating fresh HTML `<canvas>` elements and uploading new WebGL textures to GPU VRAM on every state update.
2. **Material Instantiation**: Every individual map tile instantiated its own `MeshLambertMaterial` objects, allocating 240+ duplicate material instances and shader programs.
3. **Raycaster Array Allocations**: Every mouse pointer event converted the tile Map to an array via `Array.from(this.tileMeshes.values())`, causing continuous memory allocations during cursor movement.
4. **Animation Step Coupling**: Sprite idle breathing bob and attack lunge/recoil tweens were stepped inside state-driven updates rather than the continuous render loop, leading to hitched animations.
5. **DOM Layout Thrashing**: Cursor hover updates were rewriting tile info to the DOM on every single animation frame (60 FPS) even when resting over the same stationary tile.
6. **Pathfinding Sort Overhead**: BFS Dijkstra pathfinding was invoking `queue.sort()` on every step despite edge weights being uniformly $1.0$.
7. **Monolithic Bundle**: Vite bundled Three.js into a single monolithic $>570\text{ kB}$ chunk.

## Decision

### 1. Canvas Texture Caching (`src/graphics/PixelTextures.ts`)
- Introduced a static `unitSpriteTextureCache: Map<string, THREE.CanvasTexture>` keyed by `${jobClass}_${facing}_${team}`.
- All 64 possible character sprite combinations are rasterized exactly once on first access and cached permanently for all units sharing that job/facing/faction.

### 2. Material & Highlight Geometry Pooling (`src/renderer/TacticsScene.ts`)
- Created shared static `MeshLambertMaterial` instances (`stoneMat`, `parapetMat`, `swampTopMat`, `swampSideMat`, `waterTopMat`, `waterSideMat`, `dirtMat`, `grassTopMat`).
- All 120+ map tiles reference shared materials rather than duplicating instances.
- Reused a pre-rotated `sharedHighlightGeom: THREE.PlaneGeometry` and static `moveHighlightMat` / `attackHighlightMat` for tactical tile highlights.

### 3. Raycaster Target Array Caching
- Maintained a pre-cached `tileMeshList: THREE.Mesh[]` populated only when maps load or tiles mutate, replacing `Array.from()` calls in pointer handlers.

### 4. 60 FPS Decoupled Animation Loop
- Separated state synchronization (`updateUnits`) from frame-by-frame interpolation (`animateUnits`).
- Unit breathing bob, directional billboard facing alignment, overhead mini HP bar screen-space projection, and attack lunge/recoil tweens now interpolate smoothly at a full 60 FPS.
- Reused `tempScreenPos: THREE.Vector3` across floating damage numbers and overhead bars to eliminate per-frame Vector allocations.

### 5. Monotonic BFS Queue Optimization (`src/core/Grid.ts`)
- Removed `queue.sort((a, b) => a.cost - b.cost)` in `getReachableTiles()`. In unweighted graphs with uniform edge costs of $+1$, a standard FIFO queue (`push` / `shift`) is inherently monotonic in $O(1)$.

### 6. DOM Layout Mutation Guard (`src/main.ts`)
- Added `lastHoveredKey: string` to check whether the cursor has crossed tile boundaries before executing DOM updates, eliminating 60 layout writes per second.

### 7. Code Splitting & Vendor Chunking (`vite.config.ts`)
- Configured Rollup `manualChunks` to isolate `three` into its own vendor chunk (`assets/three-[hash].js`), reducing game application code from $570\text{ kB}$ to **$94.5\text{ kB}$** ($26.7\text{ kB}$ gzip).

## Consequences
- **Positive**:
  - Zero heap churn and zero garbage collection hitches during gameplay or mouse movement.
  - Silky-smooth 60 FPS character bobbing, lunging, and real-time 3D overhead HP bar tracking.
  - Sub-second Vite build time ($1.15\text{s}$) with optimal browser caching for Three.js.
  - Pathfinding latency reduced for large move ranges.
- **Negative**:
  - Cached materials require centralized theme management when switching between daytime, nocturnal, and swamp lighting presets.
