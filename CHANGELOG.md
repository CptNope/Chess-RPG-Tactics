# Changelog

All notable changes to the **Chess RPG Tactics** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
