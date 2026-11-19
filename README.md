# Chess RPG Tactics (Tactics JRPG Engine)

A 2.5D turn-based tactical RPG built in the style of *Final Fantasy Tactics* and *Tactics Ogre*, featuring:
- **3D Isometric Rotatable View**: 90° camera rotation (`Q` / `E`), extreme close-up zoom (`2.0` to `22.0`), mouse drag panning, and stepped terrain elevation.
- **Elevation & Physics**: Movement governed by unit Jump and height difference; physical & ranged attacks modified by elevation advantages.
- **Directional Facing & Combat Geometry**: Front, Flank (+15% hit, damage bonus), and Back (+30% hit, backstab criticals).
- **Speed / CT (Charge Time) Engine**: Tick-based speed timeline rather than rigid team turns; remaining CT refund for moving without acting or waiting.
- **Deep Job & Ability System**: 5-slot ability equipping (Primary Action, Secondary Action, Reaction, Support, Movement), JP earning, and skill unlocking.
- **Billboard Pixel Art Sprites**: Dynamic 2D sprites facing camera perspective with 4-way relative orientation and idle breathing animation.
- **Branching Campaign with a Persistent Squad**: Levels, JP, abilities and gear carry from chapter to chapter. Win battles for EXP, level-ups and new armory gear on the Spoils of War screen.
- **9 Jobs** including the **Geomancer**, whose *Elemental* spell changes with the terrain underfoot (grass, stone, dirt, water, swamp, wood).
- **Boss Battles**: commanders with an enrage phase at half HP, ending on the new **Zodiac Summit** map.
- **Trials of the Zodiac**: endless post-game floors with rare drops and a Warden boss every fifth floor, plus **New Game+**.
- **Planning Enemy AI**: enemies focus wounded units, heal and buff each other, and drop area spells on clusters. Press **AUTO** (`T`) to let the same AI play one of your turns.

▶ **Play it:** https://cptnope.github.io/Chess-RPG-Tactics/

---

## 📚 Technical Documentation & Architecture

Comprehensive design guides, Mermaid sequence & class diagrams, and Architectural Decision Records:

* 🗺️ **[System Architecture & Data Flow](docs/ARCHITECTURE.md)**: Component topology, turn lifecycle sequence, and class diagrams.
* ⚔️ **[Combat Engine & Formulas](docs/COMBAT_SYSTEM.md)**: Speed ticks, CT refunds, facing vector dot products, and damage equations.
* 🛡️ **[Job & Ability System](docs/JOB_SYSTEM.md)**: 5-slot equipping model, job progression tree, and ability database.
* 🎥 **[Controls & Isometric Camera](docs/CONTROLS_AND_CAMERA.md)**: Mouse drag panning, wheel zoom, and camera math.
* 🏛️ **[Architectural Decision Records (ADRs)](docs/README.md#architectural-decision-records-adrs)**: ADRs 0001–0015 detailing all engine decisions.
* 📜 **[Changelog](CHANGELOG.md)**: Semantic release notes following the Keep a Changelog standard.

---

## 🚀 Live GitHub Pages Deployment

This repository includes an automated GitHub Actions deployment workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

### How to Enable GitHub Pages:
1. Push your code to your repository on GitHub:
   ```bash
   git add .
   git commit -m "docs: add comprehensive documentation, mermaid diagrams, changelogs, and ADRs"
   git push origin main
   ```
2. Go to your repository on GitHub: `https://github.com/CptNope/Chess-RPG-Tactics`
3. Click **Settings** $\to$ **Pages** (in the left sidebar under *Code and automation*).
4. Under **Build and deployment** $\to$ **Source**, choose:
   - **GitHub Actions**
5. That's it! Every push to `main` will build and publish automatically to:
   - `https://cptnope.github.io/Chess-RPG-Tactics/`

---

## 🎮 How to Play Locally

### Development Server
```bash
npm install
npm run dev
```

### Tests
```bash
npm test            # Vitest unit tests for combat, AI, pathfinding, data and Trials
npm run build       # type-check + production build
npm run test:build  # tests + check every built asset exists (what CI runs)
```
Add `?debug` to the URL to expose the running game as `window.__tactics` for automated play-testing (`?debug&fast` also speeds up animations).
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

### Camera & Navigation Controls
* **Rotate Left / Right**: Press `Q` / `E` or click `⟲ Q` / `⟳ E` on the top-right HUD.
* **Zoom In / Out**: Scroll **Mouse Wheel Up/Down**, press `+` / `-`, or click `+` / `-` buttons. Can zoom down to `2.0` for extreme close-up view!
* **Pan Camera**: **Hold Right-Click (or Middle-Click) & Drag**, or press `W` / `A` / `S` / `D` or Arrow Keys.
* **Reset Camera**: Press `R` or `Home` to re-center on the current active unit.
* **Inspect Unit**: Click on any unit on the map to focus the camera and view their full stat card.

### Combat Commands
* **MOVE**: Click `MOVE` to highlight blue reachable tiles based on Move and Jump stats. Click a blue tile to step there.
* **ACT**: Open action menu (Attack, Throw Stone, Rend Armor, Aim, Fire, Cure, etc.). Click a target unit to view the **Battle Forecast** (Hit %, Expected Damage, Facing advantage), then confirm execution.
* **WAIT**: Choose one of 4 facing directions (North, East, South, West) to protect your rear from critical backstabs!
* **AUTO** (`T`): Let the AI plan and play this unit's turn.
* **Terrain**: Water and swamp cost 2 Move (Water Walk ignores this). Spells ignore facing; physical attacks from the side or back hit harder and more often.
* **★ JOBS**: Open the character customization window to inspect unlocked jobs, equip secondary skillsets, and spend JP to learn new abilities.
