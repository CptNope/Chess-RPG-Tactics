# Changelog

All notable changes to the **Chess RPG Tactics** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-11-17

### Added
- **3 Advanced Hybrid Job Classes**:
  - **Dragoon (Lancer)**: High jump (base Jump 4), *Dragon Plunge* ($1.6\times$ kinetic strike), *Dragon Breath* (fire cone), *Dragonheart* (Reraise reaction), and *Ignore Elevation* (scales any cliff height).
  - **Ninja (Skirmisher)**: High speed ($1.25\times$), *Throw Shuriken*, *Vanish/Reflexes* (evades incoming attacks), *Dual Wield* (support ability: attacks strike twice!), and *Water Walk*.
  - **Time Weaver (Chronomancer)**: *Haste* ($+50\%$ Speed for 3 turns), *Slow* ($-33\%$ Speed), *Gravity* (deals $25\%$ target current HP), and *Teleport* (blinks across map bypassing obstacles).
- **Custom Pixel Art for Advanced Classes**:
  - Dragoon with azure dragon mail, winged greathelm, and long polearm.
  - Ninja with midnight shinobi cowl, red sash, and dual blades.
  - Time Weaver with crimson star-patterned robes and hourglass staff.
- **Synthesized 16-Bit Audio Engine (`src/audio/SoundEffects.ts`)**:
  - Pure Web Audio API retro synth: sword slashes, spell chimes, crits, heal sparkles, turn bells, and victory fanfares.
  - Top HUD audio toggle button (`🔊 SFX` / `🔇 MUTED`).
- **Story Cutscene Dialogue System**:
  - Visual novel style dialogue box with character portraits, speaker titles, and retro dialog prompts between Ramza, Agrias, and the brigand chiefs before battle!
- **Multi-Map Battlefield Selector**:
  - Added dropdown to switch between:
    - *Riverside Ruins* (Daytime river, ruins, and stone watchtower).
    - *Night Battlement* (Dark castle ramparts, archer bastions, and torches).
    - *Gloomy Mire & Marsh* (Murky swamp pools, toxic bogs, and wooden boardwalks).
- **Status Effects Engine**:
  - Active tracking for `Haste`, `Slow`, `Protect` ($-30\%$ physical damage taken), `Immobilize` (Move reduced to 0), and `Poison` ($-10\%$ max HP per turn).
  - Colored status badges displayed on the active unit card with turn countdown timers (`[HAST 3t]`, `[PROT 2t]`).

---

## [0.2.0] - 2026-11-17

### Added
- **Extreme Close-Up Zoom System**: Extended minimum orthographic camera zoom down to `2.0` (nearly $10\times$ closer than initial release), enabling dramatic close-up inspection of retro pixel art and weapon animations.
- **Smooth Mouse Wheel Zoom**: Interactive scroll wheel listener with lerped interpolation across the zoom range (`2.0` to `22.0`).
- **Mouse Drag Camera Panning**: Right-click and Middle-click drag functionality that dynamically pans the camera target in world space oriented to the current camera rotation.
- **Keyboard Camera Controls**: Added `W`/`A`/`S`/`D` and Arrow Keys for camera translation, `+`/`-` for zoom, and `R` / `Home` to re-center on the active unit.
- **3D Floating Combat Text**: Dynamic screen-projected damage, heal, critical hit, and miss numbers (`-34`, `CRIT! -51`, `+45`, `MISS`) floating upward in 3D world space over target units.
- **Idle Sprite Animation**: Added subtle procedural sinusoidal bobbing to billboard sprites to give characters an authentic retro battle stance.
- **Click-to-Inspect Units**: Clicking any unit on the battlefield in idle mode focuses the camera and displays their live stat card and equipped job.
- **Architectural Documentation Suite**: Added comprehensive architecture diagrams, combat mechanics specs, job tree guides, and Architecture Decision Records (ADRs 0001–0006).

### Changed
- Default camera zoom changed from wide overview (`38.0`) to authentic tactical isometric scale (`8.5`).
- Sprite plane dimensions expanded from `1.2x1.2` to `1.35x1.35` for enhanced visual presence.

---

## [0.1.0] - 2026-11-17

### Added
- **Core 3D Isometric Viewport**: Orthographic camera with stepped elevation terrain (grasslands, dirt banks, stone ruins, river water).
- **90° Rotatable Camera**: Smooth 90-degree camera rotation on `Q` / `E` allowing full inspection of obscured terrain and ledges.
- **CT (Charge Time) Engine**: Speed-based tick timeline with upcoming turn order prediction ribbon.
- **CT Refund Mechanics**: $20\%$ refund for moving without acting or acting without moving; $40\%$ refund for pure `WAIT`.
- **Directional Facing & Combat Geometry**: 4-way compass facing (North, East, South, West) with dot-product front, flank ($+15\%$), and back ($+30\%$) combat modifiers.
- **Height & Elevation Constraints**: 3D Dijkstra pathfinding constrained by unit `Move` and `Jump` attributes.
- **5-Slot Job & Ability Architecture**: Primary, Secondary, Reaction, Support, Movement abilities.
- **Job Class Roster**: Implemented Squire, Knight, Archer, Black Mage, and White Mage with JP earning and ability learning.
- **Procedural Pixel Art Engine**: Canvas-based 16x16 tile textures and 32x32 4-directional billboard sprites with nearest-neighbor rendering.
- **Tactical Enemy AI**: Utility evaluation for pathfinding, skill selection, and post-turn facing.
- **GitHub Pages CI/CD Workflow**: Automated build and deployment via `.github/workflows/deploy.yml` with relative Vite base configuration.
