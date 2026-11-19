# Chess RPG Tactics — Documentation Hub

Welcome to the comprehensive technical documentation and design specifications for **Chess RPG Tactics**.

---

## 📚 Core System Guides

| Guide | Description |
| :--- | :--- |
| **[System Architecture](ARCHITECTURE.md)** | High-level topology, component interaction, turn lifecycle sequence diagram, and class relationship model. |
| **[Combat System Specifications](COMBAT_SYSTEM.md)** | Speed tick formulas, CT refund matrix, facing vector dot-product geometry, elevation bonuses, and damage formulas. |
| **[Job & Ability System](JOB_SYSTEM.md)** | 5-slot ability equipping model (FFT paradigm), job progression tree, stat multipliers, and full ability database including Dragoon, Ninja, and Time Weaver. |
| **[Controls & Camera Guide](CONTROLS_AND_CAMERA.md)** | Orthographic isometric camera mathematics, zoom bounds (2.0x to 22.0x), mouse drag panning, and keyboard mapping. |

---

## 🏛️ Architectural Decision Records (ADRs)

Documenting the architectural choices, tradeoffs, and context of the engine:

* **[ADR 0001: Vite + TypeScript + Three.js for 2.5D Isometric Engine](adr/0001-vite-threejs-isometric-engine.md)**
* **[ADR 0002: Speed-Based CT Turn System vs Team Turn System](adr/0002-ct-speed-tick-turn-system.md)**
* **[ADR 0003: Five-Slot Ability Equipping Architecture](adr/0003-five-slot-ability-architecture.md)**
* **[ADR 0004: Procedural Canvas Pixel Art Textures & Directional Billboarding](adr/0004-billboard-pixel-art-sprites.md)**
* **[ADR 0005: 3D Height-Constrained Dijkstra Pathfinding](adr/0005-height-jump-pathfinding.md)**
* **[ADR 0006: GitHub Actions CI/CD for Automated GitHub Pages Deployment](adr/0006-github-actions-pages-deployment.md)**
* **[ADR 0007: Web Audio API Retro 16-Bit Sound Synthesis](adr/0007-web-audio-api-sound-synthesizer.md)**
* **[ADR 0008: Multi-Map Generator & Dynamic Thematic Lighting](adr/0008-multi-map-theme-architecture.md)**
* **[ADR 0009: In-Game 3D Map Editor & Live Mesh Mutation](adr/0009-in-game-3d-map-editor.md)**
* **[ADR 0010: Five-Slot Equipment & Weapon Range System](adr/0010-equipment-and-inventory-architecture.md)**
* **[ADR 0011: Multi-Stage Branching Campaign & Dialogue Engine](adr/0011-branching-campaign-state-machine.md)**
* **[ADR 0012: Visual Effects, Camera Trauma Shake, and 3D Projected Overlays](adr/0012-vfx-particles-and-projected-hud.md)**
* **[ADR 0013: Engine Performance, Object Pooling, and Animation Loop Optimization](adr/0013-engine-performance-and-memory-pooling.md)**
* **[ADR 0014: Reactions, Procedural BGM, Battle Chronicle, and Persistence](adr/0014-reactions-bgm-combat-log-persistence.md)**
* **[ADR 0015: Unified Action Pipeline, Planning AI, Persistent Squad, and Trials of the Zodiac](adr/0015-action-pipeline-ai-progression-trials.md)**

---

## 📜 Project History
* **[Changelog](../CHANGELOG.md)**: Semantic versioning history of features, changes, and refinements.
