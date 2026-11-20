# itch.io page

What's on [cptnope.itch.io/chess-rpg-tactics](https://cptnope.itch.io/chess-rpg-tactics) and how the upload is set up, so the page can be rebuilt or updated in one sitting. Store images are generated from the game (see [Testing](TESTING.md) for the scripts).

## Upload

| Setting | Value | Why |
| :--- | :--- | :--- |
| File | `release/chess-rpg-tactics-<version>-html5.zip` from `npm run build:itch` (also a CI artifact, *itch-html5*) | `index.html` at the root, relative paths, no remote fonts or scripts |
| Kind of project | HTML, "This file will be played in the browser" | |
| Viewport | 1280 × 720 | Matches the 16:9 layout; the HUD reflows below that |
| Mobile friendly | On, orientation default | Portrait and landscape layouts are built in |
| Fullscreen button | On | Also lets the in-game Fullscreen button work inside the iframe |
| Automatically start on page load | Off | The click on "Run game" is the gesture that unlocks audio |
| Scrollbars | Off | |
| Butler channel | `cptnope/chess-rpg-tactics:html5` | CI pushes `main` once the `BUTLER_API_KEY` secret exists |

## Page

| Field | Value |
| :--- | :--- |
| Title | Chess RPG Tactics |
| URL | `chess-rpg-tactics` |
| Short description | Free isometric tactics RPG: nine jobs, high ground, bosses and a map editor. |
| Classification · status | Games · Released |
| Pricing | No payments required, donations welcome ($0 or donate, suggested $3) |
| Genre | Strategy |
| Tags | Tactical RPG, Turn-based Strategy, Isometric, Pixel Art, Strategy RPG, Level Editor, Fantasy, Singleplayer, Retro, Medieval |
| Inputs | Keyboard, Mouse, Touchscreen, Xbox controller, PlayStation controller |
| Average session | About an hour |
| Languages | English |
| Accessibility | Leave unticked for now: controls aren't remappable yet and there's no colour-blind mode (on the Roadmap) |
| Links | Source on GitHub, jeremyanderson.tech, the web version on GitHub Pages |
| AI disclosure | Code and text written with Claude (Anthropic). No AI image, audio or voice generation: all art and sound is drawn and synthesized by the game's own code |
| Cover | 1260 × 1000 (shown at 630 × 500) |
| Screenshots | Title, battle with effects, move range, Workshop, Team, Zodiac Summit, effects sheet, phone layout |

## Description

> Paste into the itch.io description editor. Headings and lists keep their formatting.

**Chess RPG Tactics** is a free turn-based tactics RPG that runs right in your browser: isometric 3D battlefields with height, facing-based combat, nine mix-and-match jobs, a branching campaign with boss fights, an endless post-game, and a Workshop to build and share your own battles.

### Features
- **Real tactics.** Speed decides who moves next, not teams. Hit from behind for big damage, take the high ground for range, mind water and swamp.
- **Nine jobs, five ability slots.** Squire, Knight, Archer, White and Black Mage, Time Weaver, Dragoon, Ninja and Geomancer. Mix a second job's skills, a reaction, a support and a movement ability on every unit.
- **A branching campaign** across 16×16 battlefields, with a recruit, story choices, and bosses that enrage at half health.
- **Trials of the Zodiac:** endless seeded floors with rare gear and a Warden boss every fifth floor, plus New Game+.
- **The Workshop:** sculpt terrain, place enemies and bosses, write the dialogue, pick a goal (rout them, defeat the boss, or survive N rounds), then play it or share it as a link.
- **Hand-made pixel art** in a 3D world: animated units, drawn portraits, and pixel spell effects that wrap the actual characters.
- **AUTO** lets the AI play a turn for you when you just want to watch it go.

### Play anywhere
Phone, tablet or desktop, in portrait or landscape. Mouse, keyboard, touch, pen or a controller all work, and you can switch mid-fight. Press **H** (or the **?** button) in game for every control.

| | Keyboard | Controller | Touch |
| :--- | :--- | :--- | :--- |
| Move cursor / choose | Arrows + Enter | D-pad + A | Tap |
| Commands | 1 Move · 2 Act · 3 Wait · 4 Auto | X | Command bar |
| Back | Esc | B | Two-finger tap |
| Camera | Q / E rotate, + / − zoom, WASD pan | Bumpers, triggers, right stick | Twist, pinch, drag |
| Fullscreen | F | | Fullscreen button |

### Saves
Progress saves in your browser (Menu → Save, plus an autosave at each chapter). It survives game updates on this page. Private or incognito windows don't keep it.

### Free and open
The game is free, and the code is open source under the MIT licence on [GitHub](https://github.com/CptNope/Chess-RPG-Tactics). If you enjoy it, a donation helps more games get made.

Made by [Jeremy Anderson Tech](https://jeremyanderson.tech). Built with three.js and TypeScript, with code and writing produced with Claude (Anthropic). All art and sound are drawn and synthesized by the game's own code; spell effects come from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT).

*Chess RPG Tactics is a fan-made homage to the tactics-RPG genre and is not affiliated with Square Enix or the makers of Final Fantasy Tactics or Tactics Ogre.*
