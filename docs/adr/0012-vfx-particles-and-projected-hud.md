# ADR 0012: Visual Effects, Camera Trauma Shake, and 3D Projected Overlays

## Status
Accepted

## Context
Tactical RPGs like *Final Fantasy Tactics* rely heavily on visceral sensory feedback to convey the kinetic impact of physical attacks, the awe of powerful elemental magic, and the immediate spatial awareness of unit vital statistics without cluttering the screen.

In previous versions, combat feedback relied solely on floating numeric damage text and sound effects. Combat sprites remained static at their tile origin during attacks, and health checks required clicking on units or referencing the bottom tactical card.

## Decision
1. **Procedural VFX Particle Engine (`src/renderer/VFXManager.ts`)**:
   - Built a lightweight particle management system integrated directly into the Three.js render loop without external animation libraries.
   - Designed elemental spell visual effects:
     - **Physical Slash**: Arc geometry with additive blending expanding and fading along the slice angle.
     - **Fire / Flare**: 40-particle velocity-driven upward burst accompanied by a warm dynamic `PointLight` that illuminates terrain and units.
     - **Ice / Frost**: Rotating wireframe crystal cone expanding with a cool cyan `PointLight`.
     - **Lightning Bolt**: Multi-segment randomized jagged line drawn from sky to ground with high-intensity golden flash.
     - **Holy / Bless**: Ascending golden torus rings representing divine restorative light.
   - Implemented ambient atmospheric weather motes (daytime pollen, nocturnal fortress embers, swamp spores) synced to the active map theme.

2. **Trauma-Based Camera Shake**:
   - Implemented an accumulative trauma model ($0.0 \le \tau \le 1.0$) where camera shake offset is proportional to $\tau^2$, ensuring small hits produce subtle trembling while critical strikes and lightning produce dramatic shuddering with exponential recovery.

3. **Kinematic Unit Lunge & Recoil Tweens**:
   - Added directional lunge offsets along the vector between attacker and target during attack execution.
   - Added recoil kickback offsets on hit targets to emphasize impact.

4. **Projected 3D Overhead Mini HP & CT Status Bars**:
   - Embedded screen-space projected DOM elements mapped to the 3D unit coordinates via `Vector3.project(camera)`.
   - Displays real-time dual gauges (HP green gradient bar and CT yellow timing bar) directly above character heads with team-colored frames.

5. **Animated Water Caustics**:
   - Animated procedural UV coordinate offsets in the render loop for water tile textures, creating flowing river and swamp currents.

## Consequences
- **Positive**:
  - Greatly elevates the visual fidelity and nostalgic 90s PlayStation 1 aesthetic.
  - Combat feels punchy, clear, and satisfying.
  - Players can survey the entire battlefield's health distribution at a single glance without clicking individual units.
- **Negative**:
  - Dynamic `PointLight` instances require careful lifecycle disposal to prevent WebGL memory leaks, which is managed centrally in `VFXManager.update()`.
