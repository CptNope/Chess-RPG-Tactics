# Chess RPG Tactics

[![Play on itch.io](https://img.shields.io/badge/play-itch.io-fa5c5c?logo=itchdotio&logoColor=white)](https://cptnope.itch.io/chess-rpg-tactics)
[![Play on the web](https://img.shields.io/badge/play-in%20your%20browser-10b981?logo=googlechrome&logoColor=white)](https://cptnope.github.io/Chess-RPG-Tactics/)
[![Support the game](https://img.shields.io/badge/support-donate%20on%20itch-ff69b4?logo=githubsponsors&logoColor=white)](https://cptnope.itch.io/chess-rpg-tactics/donate)
<br />
[![Deploy to GitHub Pages](https://github.com/CptNope/Chess-RPG-Tactics/actions/workflows/deploy.yml/badge.svg)](https://github.com/CptNope/Chess-RPG-Tactics/actions/workflows/deploy.yml)
![Version](https://img.shields.io/badge/version-0.19.0-f4c430)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Three.js](https://img.shields.io/badge/Three.js-0.170-black)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A turn-based tactics RPG for the browser in the spirit of *Final Fantasy Tactics* and *Tactics Ogre*: isometric 3D battlefields with height, facing-based combat, sixteen mix-and-match jobs, a two-act campaign with bosses, and an endless post-game. It runs on phones, tablets and desktops, with mouse, keyboard, touch, pen or a controller.

### ▶ [Play it now](https://cptnope.github.io/Chess-RPG-Tactics/) · [on itch.io](https://cptnope.itch.io/chess-rpg-tactics) · [♥ Support development](https://cptnope.itch.io/chess-rpg-tactics/donate)

![A battle on Riverside Ruins](docs/images/battle-desktop.webp)

---

## Features

| | |
| :--- | :--- |
| **Tactics** | Speed-based turn order (CT), front / flank / back attacks, height advantage, terrain movement costs, area spells |
| **Squad building** | 16 jobs on a job tree (jobs level up, unlock advanced jobs, and give permanent mastery bonuses), 93 abilities, five ability slots (primary, secondary, reaction, support, movement), EXP and per-job JP |
| **Gear & gil** | 54 pieces of gear, some with traits; earn gil from battles; buy and sell at the market; steal gear off enemies |
| **Items** | Eight supplies (Potions, Ethers, Remedies, Phoenix Feathers, Elixirs and three kinds of flask) used with the Item command; Chemists make them go further |
| **World map** | Between missions the squad walks a map of the realm: visit the market, pick which road the story takes, fight optional side battles, enter the Trials |
| **Easy to pick up** | Easy, Normal and Hard; tips the first time each thing comes up; undo for a misplaced move; a Fast battle speed |
| **Saves** | Three slots in your browser, plus export and import to back a save up or move it to another device |
| **Install it** | The web version installs as an app (home screen, Start menu, dock) and plays offline |
| **Campaign** | A two-act campaign (seven chapters, six per playthrough, with a branch in the first act) on 16×16 battlefields, with two recruits, boss fights with enrage phases, and gear rewards |
| **Post-game** | New Game+ and the endless, seeded **Trials of the Zodiac** with a Warden boss every fifth floor |
| **Enemy AI** | Plans every move: finishes wounded units, heals allies, aims area spells at clusters. **AUTO** lets it play your turn |
| **Play anywhere** | Phone (portrait and landscape), tablet and desktop layouts; mouse, keyboard, touch, pen and controller |
| **Graphics** | Per-map skies, fog and lighting, soft shadows, flowing water, torches, bloom; Auto / High / Medium / Low quality that adapts to your device |
| **Workshop** | Build your own battles: sculpt terrain, place enemies and bosses, write dialogue, pick an objective (rout, defeat the boss, survive N rounds), then play it or share it as a link |
| **Art & sound** | Animated 48px pixel-art units (walk, strike, flinch), drawn character portraits, hand-animated pixel-art spell and hit effects, synthesized music and SFX; no image files |

<p>
  <img src="docs/images/phone-portrait.webp" alt="Phone layout" width="200">
  <img src="docs/images/summit.webp" alt="Zodiac Summit final battle" width="560">
</p>

<p>
  <img src="docs/images/world-map.webp" alt="The world map: the squad at Night Battlement, with the market, the other battlefields and the Gate of Trials" width="380">
  <img src="docs/images/items.webp" alt="The Item command in battle: potions, an ether, a remedy and a phoenix feather" width="380">
</p>

<p>
  <img src="docs/images/workshop-desktop.webp" alt="The Workshop: editing enemies on Riverside Ruins" width="560">
  <img src="docs/images/workshop-phone.webp" alt="The Workshop on a phone" width="200">
</p>

![Every job in both team colours, a knight's animation frames, and the character portraits](docs/images/character-art.webp)

![Pixel-art battle effects: sword arc, critical hit, fire, ice, lightning, holy, dark, rockslide, and heal, poison, haste and protect wrapping the unit's own sprite](docs/images/effects.webp)

<details><summary><b>0.8 vs 0.9 graphics</b></summary>

![Before and after the 0.9 graphics upgrade](docs/images/graphics-before-after.webp)

</details>

---

## How a battle flows

```mermaid
flowchart LR
    CT(["Fastest unit<br/>reaches CT 100"]) --> Cmd{"Command"}
    Cmd --> Move["MOVE"]
    Cmd --> Act["ACT → forecast → execute"]
    Cmd --> Auto["AUTO (AI plays)"]
    Move --> Act
    Act --> Wait["WAIT → choose facing"]
    Move --> Wait
    Auto --> Next
    Wait --> Next(["Next unit"])
    Next --> Win{"All foes down?"}
    Win -- yes --> Spoils["Spoils: EXP, JP, gear"]
    Win -- no --> CT
```

New to the game? Read the **[Gameplay Guide](docs/GAMEPLAY_GUIDE.md)**.

---

## Controls

Press **H**, the **?** button, or **View/Back** on a controller for the in-game list.

| | Select | Back | Pan | Zoom | Rotate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mouse** | Click | × / Cancel | Drag | Wheel | ⟲ ⟳ buttons |
| **Keyboard** | Arrows + Enter | Esc | W A S D | + / − | Q / E |
| **Touch** | Tap | Two-finger tap | Drag | Pinch | Twist |
| **Pen** | Tap (hover previews) | Eraser / barrel button | Drag | — | ⟲ ⟳ buttons |
| **Controller** | D-pad + A | B | Right stick | LT / RT | LB / RB |

Keyboard shortcuts: `1` Move · `2` Act · `3` Wait · `4`/`T` Auto · `5`/`I` Item · `1` again to undo a move · `R` re-center · `J` Team · `L` Log · `H` Controls. Full matrix: **[Controls & Camera](docs/CONTROLS_AND_CAMERA.md)**.

---

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 156 rule tests
npm run build        # type-check + production build
npm run build:itch   # build + release/chess-rpg-tactics-<version>-html5.zip for itch.io
npm run balance      # headless AUTO battles: win rate per chapter
npm run docs:gen     # regenerate the content reference
```

`?debug` exposes the running game as `window.__tactics`; `?debug&fast` also speeds up animations and skips the title screen (`?notitle` skips it alone).

Every push to `main` builds, tests and deploys to GitHub Pages and builds the itch.io zip; pull requests run the same checks without deploying. With the `BUTLER_API_KEY` secret set, `main` is also published to itch.io.

---

## Documentation

| | |
| :--- | :--- |
| 🎮 **[Gameplay Guide](docs/GAMEPLAY_GUIDE.md)** | How to play, campaign map, bosses, Trials, the Workshop, tips |
| 📖 **[Content Reference](docs/CONTENT_REFERENCE.md)** | Every job, ability, item, map, chapter and Trial floor (generated from the game data) |
| 🕹️ **[Controls & Camera](docs/CONTROLS_AND_CAMERA.md)** | All five input methods, gestures, layouts, camera math |
| 🏗️ **[Architecture](docs/ARCHITECTURE.md)** | Modules, state machine, action pipeline, input flow, saves, build |
| ⚔️ **[Combat](docs/COMBAT_SYSTEM.md)** · 🛡️ **[Jobs](docs/JOB_SYSTEM.md)** · 🧠 **[Enemy AI](docs/ENEMY_AI.md)** | System deep dives |
| 🧪 **[Testing](docs/TESTING.md)** | CI, unit tests, play-tests, release checklist |
| 🛒 **[itch.io page](docs/ITCH_PAGE.md)** | Upload settings, store text, tags; `npm run build:itch` |
| 🗺️ **[Roadmap](docs/ROADMAP.md)** | Release history, Now / Next / Later, known issues |
| 🤝 **[Contributing](CONTRIBUTING.md)** | Setup and recipes for adding jobs, maps, chapters, items |
| 🏛️ **[ADRs](docs/README.md#architectural-decision-records)** | 20 architectural decisions |
| 📜 **[Changelog](CHANGELOG.md)** | Every release |

---

## Project layout

```text
src/
  main.ts        game flow, action pipeline, input dispatch
  core/          rules: turns, grid, combat, jobs, AI, Trials, saves (no DOM)
  data/          jobs, items, maps, campaign
  renderer/      Three.js scene, gestures, VFX
  ui/ input/     HUD, menus, focus navigation, controller
  audio/ graphics/
tests/           Vitest rule tests
scripts/         build check, docs generator
docs/            guides, ADRs, images
.github/         CI and deploy workflows; FUNDING.yml (the Sponsor button → itch.io donations)
```

---

## Support the game

Chess RPG Tactics is free, has no ads, and its code is open. If you enjoy it, you can **[leave a donation on itch.io](https://cptnope.itch.io/chess-rpg-tactics/donate)**. Any amount helps more games get made, and none is expected.

| | |
| :--- | :--- |
| **Donate** | [cptnope.itch.io/chess-rpg-tactics/donate](https://cptnope.itch.io/chess-rpg-tactics/donate) |
| **Rate or comment** | [The game's itch.io page](https://cptnope.itch.io/chess-rpg-tactics) |
| **About the project** | [jeremyanderson.tech/project/chess-rpg-tactics](https://jeremyanderson.tech/project/chess-rpg-tactics/) |
| **Made by** | [Jeremy Anderson Tech](https://jeremyanderson.tech) |

## License

Released under the [MIT License](LICENSE) © 2026 Jeremy Anderson. You're free to use, modify and share the code; keep the copyright notice.

| Third-party | License |
| :--- | :--- |
| [three.js](https://threejs.org) | MIT |
| [Fontsource](https://fontsource.org) packaging of the fonts above | MIT (fonts OFL 1.1) |
| [pixelfx](https://github.com/patch-gg/pixelfx) spell and hit effects (vendored in `src/vendor/pixelfx`, which adapts parts of [Sprite Fusion's VFX](https://www.spritefusion.com/pixel-art-vfx)) | MIT |
| [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P), [VT323](https://fonts.google.com/specimen/VT323) fonts (Google Fonts) | SIL Open Font License 1.1 |

All characters, story, unit art, portraits, maps, music and sound are original to this project and generated in code; the spell and hit effects are pixelfx's (above). *Chess RPG Tactics* is a fan-made homage to the tactics-RPG genre and is not affiliated with or endorsed by Square Enix or the makers of *Final Fantasy Tactics* or *Tactics Ogre*.
