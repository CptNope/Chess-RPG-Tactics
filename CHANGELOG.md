# Changelog

All notable changes to the **Chess RPG Tactics** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.9.0] - 2026-11-19

### Changed
- **Original characters.** The starting squad's names came from Square's games (Ramza, Agrias, Mustadio, Kain); they are now **Rowan, Maren, Tobin and Corvin**. FFT's "Zodiac Stones" became **Zodiac Seals**, matching the Trials' "Seal of …" floors. Saves from earlier versions are renamed automatically on load.
- **MIT License** added (`LICENSE`, `package.json`), with third-party credits and a not-affiliated note in the README.

### Added — graphics upgrade
- **Lighting:** hemisphere sky/ground light, a warm key light and cool rim light per battlefield, ACES filmic tone mapping, soft PCF shadows fitted to each map.
- **Atmosphere:** painted gradient skies (stars at night), distance fog, and a distinct look per map: golden Riverside Ruins, moonlit Night Battlement, murky Gloomy Mire, violet Zodiac Summit.
- **Terrain shading:** bevelled tile edges, ambient occlusion down cliff sides, cliff textures that repeat instead of stretching, flowing water with sun glints, bubbling swamp, tinted wooden boardwalks.
- **Set dressing:** swaying grass, cattail reeds and pebbles (instanced, kept off the tile centers).
- **Units:** soft contact shadows under every unit and a pulsing gold (or red) ring under the unit whose turn it is.
- **Night lighting:** flickering torches with warm light pools on Night Battlement and an altar glow on the Zodiac Summit.
- **Effects:** bloom (spells, torches, water glints and highlights glow) and a gentle vignette on High.
- **Highlights:** glowing, pulsing move/attack/support tiles with bright rims; support abilities now show green tiles (they were blue).
- **Graphics setting** in Menu: Auto, High, Medium, Low (saved). Auto picks Medium on phones and High elsewhere, and steps down a tier if the frame rate stays under 40 fps.

### Performance
- Terrain is now merged into one mesh per material: **~760 draw calls per frame → ~37**, and hidden tile bottoms are no longer drawn. Tile picking works from the hit point on the merged mesh.

---

## [0.8.1] - 2026-11-19

### Documentation
- Rewrote the README (feature table, battle flow diagram, controls table, docs index, screenshots).
- New guides: **Gameplay Guide**, **Roadmap** (release timeline, Now / Next / Later, impact vs effort, known issues), **Enemy AI**, **Testing**, **Contributing** (recipes for jobs, abilities, maps, chapters, items, UI).
- **Content Reference** generated from the game data by `scripts/gen-docs.ts` (`npm run docs:gen`): every job, ability, status, item, map, chapter and the first 15 Trial floors, with a campaign diagram. CI runs `npm run docs:check` so it can't go stale.
- Architecture rewritten for the current code: module map, game state machine, turn sequence, action pipeline, input flow, data model, persistence and build diagrams.
- Job System corrected: the old progression tree listed jobs that don't exist (Chemist, Summoner, Warmage); it now shows the real prerequisites and notes they aren't enforced yet.
- Combat and Controls guides gained hit-resolution, gesture and controller diagrams; the docs hub routes players and developers and indexes ADRs by release.
- Screenshots in `docs/images/` (WebP).

### Fixed
- Chapter II-A's branch choice still said the final battle was at Night Battlement; it is at the Zodiac Summit.

---

## [0.8.0] - 2026-11-19

### Added
- **Every input works everywhere**: one dispatcher for mouse, keyboard, touch, pen and controller.
  - **Touch**: tap to select, drag to pan, pinch to zoom, two-finger twist to rotate, two-finger tap to cancel. Taps now select the tile under your finger (before, a tap used the last hovered tile).
  - **Pen**: hover previews tiles, tap selects, drag pans, eraser / barrel button cancels.
  - **Keyboard**: a tile cursor on the arrows, Enter to select, Esc to back out, `1`–`4` command hotkeys, `J`/`L`/`H` for Team/Log/Controls, and arrow-key navigation inside every menu. A whole turn can be played without a mouse.
  - **Controller** (`src/input/GamepadInput.ts`): standard mapping with d-pad/stick cursor and menu navigation, held-direction repeat, LB/RB rotate, analog-trigger zoom, right-stick pan, rumble on crits and boss enrage, and a connect banner.
  - **Mouse**: left-drag now pans too (trackpads without a right button), and trackpad pinch zooms smoothly.
- **Controls screen** listing all five input methods, with your current one first.
- **STATUS** button now opens that unit's jobs and gear (it did nothing before).
- Unit card portrait shows the unit's actual sprite.

### Changed
- **Responsive layout** for phones (portrait and landscape), tablets and desktops: bottom command bar and stacked unit card on phones, bottom sheets for actions/forecast/log, full-screen modals, a two-column Team screen on tablets, safe-area insets for notched phones, and 44px touch targets.
- The 11-button toolbar is now four buttons (Team, Log, Controls, Menu) plus a camera cluster; map, sound, save, load and editor moved into Menu. Emoji buttons are replaced with drawn pixel icons.
- Portrait screens fit the camera to the screen width, so phones see the whole battlefield.
- Hotkey hints and the dialogue "continue" hint match the input you're using.
- Visible gold focus rings, `Tab` trapped inside modals with focus restored on close, ARIA labels and dialog roles throughout.
- Reduced-motion: screen shake is cut to 15% and the turn banner fades instead of sliding.

### Fixed
- Desktop toolbar covered the turn order at 1920px; camera buttons collided with the command menu on 768px-tall laptops; the stat row wrapped ("HT: 1.0h" on two lines); an empty turn-order strip showed during intros.

---

## [0.7.0] - 2026-11-19

### Fixed
- **GitHub Pages deploy**: the 2026-11-18 deploy failed with *"No artifacts named github-pages were found"* because `deploy-pages` ran in the same job, milliseconds after the upload. Build and deploy are now separate jobs (GitHub's recommended layout) with one automatic retry; actions updated off the deprecated Node 20 runtime.
- **Out-of-range attacks**: clicking any unit opened the forecast, even across the map. Targeting now uses the same range/height rule as the red overlay.
- **Reactions that never fired**: Counter Tackle, Arcane Retaliation and Critical Quick were checked against ability ids that did not exist. Arcane Retaliation and Critical Quick are now learnable.
- **Gear did nothing**: weapon/gear ATK and MAG, job multipliers and evasion now affect damage and hit chance.
- **Area spells hit one unit**: Fire, Blizzard, Thunder and Dragon Breath now hit every foe within 1 tile (60% on the ring).
- **Enemy AI** could cast Haste/Protect on your units and never paid MP.
- **Squad reset every chapter**: levels, JP, abilities and gear now carry over.
- **Story rewards** ("Unlocked: Ring of Arcana!") were text only; they are now added to the armory.
- **EXP never levelled anyone up.**
- **Focus** permanently stacked +3 ATK; it is now a 4-turn +25% buff.
- Dragonheart could save a unit every hit; now once per battle.
- Defeat left a dead board; the campaign ended on a banner.
- Leftover sprites from the previous battle stayed on the map; stale turn order/unit card showed during intros.
- Camera toolbar covered the turn-order strip; tile info showed through dialogue; missing favicon (404).

### Added
- **Smarter enemy AI** (`src/core/EnemyAI.ts`): weighs every reachable tile, affordable ability and target; finishes wounded units, heals and buffs allies, uses area spells on clusters, prefers high ground.
- **AUTO command** (button or `T`): let the AI play the active unit's turn.
- **Geomancer job** and recruit **Bria** (joins in Chapter II): *Elemental* changes with the terrain underfoot (Hell Ivy, Rockslide, Sandstorm, Torrent, Quicksand, Wildfire), plus Earth Slash, Earthen Ward, Attack Boost, Mountain Stride.
- **Zodiac Summit**: new final-battle map (terraced shrine, starlit pools, obelisks, rope bridge).
- **Boss units** with nameplates, +60% HP and an **enrage** phase at half HP (Haste, +20% power).
- **Spoils of War screen**: per-unit EXP/JP/KOs, level-ups and new gear.
- **Armory**: the gear tab shows only owned items; 6 new items (Gaia Staff, Windslayer Bow, Zodiac Blade, Crystal Helm, Wyrmscale Mail, Zodiac Ribbon).
- **Defeat screen** with Retry Battle / Load Save. **Epilogue** with New Game+ (keeps your squad) or…
- **Trials of the Zodiac**: endless post-game floors, deterministic per floor, a Warden boss every 5th floor, a rare drop each clear, best floor recorded.
- **Terrain movement costs**: water and swamp cost 2 Move; Water Walk, Teleport and Regen Walk now work, as does JP Boost.
- Reaction / Support / Movement slots can be cycled through any learned passive; slots show names instead of ids.
- Autosave at the start of each chapter and after each Trial.
- **Tests**: 28 Vitest unit tests (`npm test`) for combat, reactions, AI, pathfinding, data integrity and Trials, run in CI.

### Changed
- Damage rebalanced: base HP 120 + 18/level; physical `ATK × Power × 5`; magic `MAG × Power × 3`; facing/height bonuses are physical-only.
- Save format 0.7.0 (stores armory, mode and Trials floor). 0.6.x saves still load.

---

## [0.5.1] - 2026-11-18

### Optimized
- **Procedural Canvas Texture Caching (`src/graphics/PixelTextures.ts`)**:
  - Implemented `unitSpriteTextureCache` to memoize 32x32 character sprite textures across all 64 job/facing/faction permutations, eliminating recurring canvas rasterization and GPU VRAM re-uploads.
- **Three.js Material & Geometry Pooling (`src/renderer/TacticsScene.ts`)**:
  - Consolidated 240+ duplicate `MeshLambertMaterial` instances into shared static material singletons for stone, parapet, swamp, water, dirt, and grass.
  - Reused `sharedHighlightGeom` and static blue/red highlight materials across tactical range overlays without per-turn allocation or disposal.
  - Reused `tempScreenPos` across 3D floating damage text and overhead HP bar projections.
- **Raycasting Performance**:
  - Replaced per-mouse-move `Array.from(tileMeshes.values())` heap allocations with a pre-cached `tileMeshList` updated only on map mutations.
- **60 FPS Decoupled Animation Loop**:
  - Moved character sprite idle breathing bob, attack lunges, damage recoils, and overhead HP bar tracking into `TacticsScene.render()`.
  - Units now interpolate smoothly at a full 60 FPS instead of ticking only on discrete state events.
- **Monotonic BFS Pathfinding (`src/core/Grid.ts`)**:
  - Removed redundant $O(N \log N)$ `queue.sort` in `getReachableTiles()`, leveraging natural FIFO queue monotonicity in unweighted $1$-cost movement graphs.
- **DOM Paint Throttling (`src/main.ts`)**:
  - Added `lastHoveredKey` guard in `gameLoop()`, eliminating 60 layout writes per second when cursor hovers over a stationary tile.
- **Rollup Code Splitting (`vite.config.ts`)**:
  - Isolated Three.js into a dedicated vendor chunk (`assets/three-[hash].js`), shrinking the main application chunk from $570\text{ kB}$ to **$94.5\text{ kB}$** ($26.7\text{ kB}$ gzip).
- **Architecture Documentation**:
  - Added ADR 0013: Engine Performance, Object Pooling, and Animation Loop Optimization.

---

## [0.5.0] - 2026-11-18

### Added
- **Visual Effects & Spell Particle Engine (`src/renderer/VFXManager.ts`)**:
  - **Atmospheric Weather Particles**: Context-aware ambient motes tailored to map themes (golden drifting pollen for daytime ruins, luminous azure motes for night fortress, toxic green spore clouds for swamp).
  - **Elemental Combat Spell VFX**:
    - *Slash Energy Arc*: Expanding additive crescent blade with directional orientation.
    - *Fire / Flare Eruption*: 40-particle velocity-driven upward fire column with dynamic orange `PointLight`.
    - *Ice / Frost Crystal*: Rotating 3D crystalline cone pillar with cyan point lighting.
    - *Lightning Bolt*: Multi-segmented celestial lightning strike with full-map ambient illumination.
    - *Holy / Bless Glow*: Ascending golden torus rings of sacred rejuvenation.
  - **Trauma-Based Camera Screen Shake**: Quadratic decay model ($\tau^2$) delivering visceral impact on critical strikes and heavy magic.
- **Combat Sprite Dynamics**:
  - Kinematic unit lunge forward toward target tile upon attack execution.
  - Recoil pushback animation upon sustaining physical or magical damage.
- **Projected 3D Overhead Mini HP & CT Status Bars**:
  - Dual gauge (green health and yellow CT meter) hovering above each character in 3D perspective space.
  - Team-colored borders (player royal blue, enemy crimson red) allowing instant situational awareness.
- **Animated Water Caustics**:
  - Continuous procedural UV texture offset oscillation creating flowing, rippling river and swamp currents.
- **Architecture Documentation**:
  - Added ADR 0012: Visual Effects, Camera Trauma Shake, and 3D Projected Overlays.

---

## [0.4.0] - 2026-11-17

### Added
- **In-Game 3D Map Editor**:
  - Live 3D terrain sculpting: click any tile on the battlefield to raise height (`+0.5h`), lower height (`-0.5h`), or paint materials.
  - 7 Paintable terrain materials: *Grassland*, *Stone Ruins*, *Dirt Soil*, *Water Bed*, *Poison Swamp*, *Castle Stone*, and *Wood Bridge*.
  - Walkability toggling (set impassable boulders, walls, or fences).
  - One-click **JSON Export** (copies formatted map data to clipboard) and **JSON Import** to load custom maps.
  - Instant **Test Battle** button to drop units into skirmish on the sculpted map immediately.
- **Equipment & Inventory System**:
  - 5 Gear slots per character: **Weapon**, **Shield**, **Headgear**, **Body Armor**, and **Accessory**.
  - 18 Unique items with stat scaling (Attack, Magic, Defense HP/MP, Speed, Move, Jump, Evasion).
  - Weapon types with variable range: Swords, Long Dragon Lance (2-tile spear range), Longbow (5-tile archer range), Chrono Scepter, and Assassin Daggers.
  - Subtab in `#job-modal` to inspect current loadouts, compare stats, and equip/unequip gear dynamically.
- **Multi-Stage Branching Campaign**:
  - Chapter-based story campaign (`src/data/campaign.ts`) with character dialogues and tactical encounter progressions:
    - **Chapter I**: *Ambush at Riverside Ruins*
    - **Chapter II-A**: *The Sunken Crypts (Gloomy Mire)*
    - **Chapter II-B**: *The Siege of Night Battlement*
    - **Final Chapter**: *The Awakening at the Summit*
  - **Narrative Choice System**: After Chapter I victory, players choose whether to pursue the sorcerer into the toxic mire or reinforce the castle garrison, unlocking distinct maps, enemy compositions, and equipment rewards!
- **Architectural Decision Records**: Added ADR 0009 (In-Game 3D Map Editor), ADR 0010 (Equipment & Inventory Architecture), and ADR 0011 (Branching Campaign State Machine).

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
  - Visual novel style dialogue box with character portraits, speaker titles, and retro dialog prompts before battle.
- **Multi-Map Battlefield Selector**:
  - Added dropdown to switch between *Riverside Ruins*, *Night Battlement*, and *Gloomy Mire & Marsh*.
- **Status Effects Engine**:
  - Active tracking for `Haste`, `Slow`, `Protect`, `Immobilize`, and `Poison` with countdown badges.

---

## [0.2.0] - 2026-11-17

### Added
- **Extreme Close-Up Zoom System**: Extended minimum orthographic camera zoom down to `2.0`.
- **Smooth Mouse Wheel Zoom**: Interactive scroll wheel listener across `2.0` to `22.0`.
- **Mouse Drag Camera Panning**: Right-click and Middle-click drag functionality.
- **Keyboard Camera Controls**: `W`/`A`/`S`/`D` pan, `+`/`-` zoom, `R`/`Home` re-center.
- **3D Floating Combat Text**: Dynamic screen-projected damage, heal, critical hit, and miss numbers.
- **Idle Sprite Animation**: Procedural sinusoidal bobbing for billboard sprites.
- **Click-to-Inspect Units**: Live inspection of friend or foe stats.

---

## [0.1.0] - 2026-11-17

### Added
- **Core 3D Isometric Viewport & 90° Rotatable Camera**.
- **CT Speed Tick Engine & CT Refund Rules**.
- **Directional Facing & Combat Geometry**.
- **5-Slot Job & Ability Architecture**.
- **GitHub Pages CI/CD Pipeline**.
