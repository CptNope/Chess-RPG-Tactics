# Chess RPG Tactics — Documentation Hub

Welcome to the comprehensive technical documentation and design specifications for **Chess RPG Tactics**.

---

## 📚 Core System Guides

| Guide | Description |
| :--- | :--- |
| **[System Architecture](ARCHITECTURE.md)** | High-level topology, component interaction, turn lifecycle sequence diagram, and class relationship model. |
| **[Combat System Specifications](COMBAT_SYSTEM.md)** | Speed tick formulas, CT refund matrix, facing vector dot-product geometry, elevation bonuses, and damage formulas. |
| **[Job & Ability System](JOB_SYSTEM.md)** | 5-slot ability equipping model (FFT paradigm), job progression tree, stat multipliers, and full ability database. |
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

---

## 📜 Project History
* **[Changelog](../CHANGELOG.md)**: Semantic versioning history of features, changes, and refinements.
