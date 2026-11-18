# Chess RPG Tactics (Tactics JRPG Engine)

A 2.5D turn-based tactical RPG built in the style of *Final Fantasy Tactics* and *Tactics Ogre*, featuring:
- **3D Isometric Rotatable View**: 90° camera rotation (`Q` / `E`), zoom controls (`+` / `-`), and stepped terrain elevation.
- **Elevation & Physics**: Movement governed by unit Jump and height difference; physical & ranged attacks modified by elevation advantages.
- **Directional Facing & Combat Geometry**: Front, Flank (+15% hit, damage bonus), and Back (+30% hit, backstab criticals).
- **Speed / CT (Charge Time) Engine**: Tick-based speed timeline rather than rigid team turns; remaining CT refund for moving without acting or waiting.
- **Deep Job & Ability System**: 5-slot ability equipping (Primary Action, Secondary Action, Reaction, Support, Movement), JP earning, and skill unlocking.
- **Billboard Pixel Art Sprites**: Dynamic 2D sprites facing camera perspective with 4-way relative orientation.

---

## 🚀 Live GitHub Pages Deployment

This repository includes an automated GitHub Actions deployment workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

### How to Enable GitHub Pages:
1. Push your code to your repository on GitHub.
2. Go to your repository on GitHub: `https://github.com/CptNope/Chess-RPG-Tactics`
3. Click **Settings** $\to$ **Pages** (in the left sidebar under *Code and automation*).
4. Under **Build and deployment** $\to$ **Source**, choose:
   - **GitHub Actions**
5. That's it! Every time you commit and push to the `main` branch, the GitHub Actions workflow will automatically build and publish your game to:
   - `https://cptnope.github.io/Chess-RPG-Tactics/`

---

## 🎮 How to Play Locally

### Development Server
```bash
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

### Camera Controls
* **Rotate Left**: Press `Q` or click `⟲ Q` on the top-right HUD.
* **Rotate Right**: Press `E` or click `⟳ E` on the top-right HUD.
* **Zoom In / Out**: Click `+` / `-` buttons.
* **Hover / Select Tile**: Move your cursor over any tile to see coordinates, height level, and terrain.

### Combat Commands
* **MOVE**: Click `MOVE` to highlight blue reachable tiles based on Move and Jump stats. Click a blue tile to step there.
* **ACT**: Open action menu (Attack, Throw Stone, Rend Armor, Aim, Fire, Cure, etc.). Click a target unit to view the **Battle Forecast** (Hit %, Expected Damage, Facing advantage), then confirm execution.
* **WAIT**: Choose one of 4 facing directions (North, East, South, West) to protect your rear from critical backstabs!
* **★ JOBS**: Open the character customization window to inspect unlocked jobs, equip secondary skillsets, and spend JP to learn new abilities.

---

## 🏗️ Project Architecture
```
src/
├── core/
│   ├── types.ts          # Core data models (Unit, Job, Ability, Tile, CombatForecast)
│   ├── Grid.ts           # 3D height-aware grid, Jump constraints, Dijkstra pathfinding
│   ├── CombatEngine.ts   # Facing calculation (Front/Flank/Back), height & damage formulas
│   ├── TurnManager.ts    # CT (Charge Time) speed tick loop and future turn predictor
│   └── JobSystem.ts      # Job scaling, 5-slot ability equipping, and JP progression
├── data/
│   ├── jobs.ts           # Job definitions (Squire, Knight, Archer, Black Mage, White Mage)
│   └── maps.ts           # 3D stepped terrain layout (Ruins by the River)
├── graphics/
│   └── PixelTextures.ts  # Procedural retro pixel art textures & 4-directional billboard sprites
├── renderer/
│   └── TacticsScene.ts   # Three.js isometric orthographic camera, lighting, and meshes
├── ui/
│   └── UIManager.ts      # Tactical HUD, turn timeline, status card, and action menus
├── style.css             # CRT scanline overlay, retro 90s palette and typography
└── main.ts               # Game loop and AI turn execution
```
