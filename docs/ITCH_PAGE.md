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
| Short description | Free isometric tactics RPG: 25 jobs, high ground, bosses and a map editor. |
| Classification · status | Games · Released |
| Pricing | No payments required, donations welcome ($0 or donate, suggested $3) |
| Genre | Strategy |
| Tags | Tactical RPG, Turn-based Strategy, Isometric, Pixel Art, Strategy RPG, Level Editor, Fantasy, Singleplayer, Retro, Medieval |
| Inputs | Keyboard, Mouse, Touchscreen, Xbox controller, PlayStation controller, Gamepad (any) |
| Average session | About an hour |
| Languages | English |
| Accessibility | Configurable controls (every key and button can be changed, since 0.40). No colour-blind mode yet |
| Links | Source on GitHub, jeremyanderson.tech, the web version on GitHub Pages |
| AI disclosure | Code and text written with Claude (Anthropic). No AI image, audio or voice generation: all art and sound is drawn and synthesized by the game's own code |
| Cover | 1260 × 1000 (shown at 630 × 500) |
| Screenshots | Title, battle with effects, move range, Workshop, Team, Zodiac Summit, effects sheet, phone layout, job tree, shop, a Bard and Dancer performing, the world map with the merchant and a camp |

## Theme (Edit theme)

| Setting | Value |
| :--- | :--- |
| BG / BG 2 | `#0a0c10` / `#111c2e` (the game's background and panels) |
| Text / Link / Headers / Buttons | `#e6edf5` / `#f4c430` / `#f4c430` / `#2563eb` |
| Fonts | Body Lato (Large), headers *Pixel* |
| Banner | `docs/itch/itch-banner.png` (960 × 264, the title logo and tagline; regenerate when the tagline changes) |
| Embed BG | `docs/itch/itch-embed-bg.jpg` (1280 × 720, the summit, dimmed and blurred) |

The game's own page on [jeremyanderson.tech](https://jeremyanderson.tech/project/chess-rpg-tactics/) links here, and the description links back.

## Description

> Paste into the itch.io description editor. Headings and lists keep their formatting.

**Chess RPG Tactics** is a free turn-based tactics RPG that runs right in your browser: isometric 3D battlefields with height, facing-based combat, twenty-five mix-and-match jobs, a three-act campaign across two world maps with boss fights, an endless post-game, and a Workshop to build and share your own battles.

### Features
- **Real tactics.** Speed decides who moves next, not teams. Hit from behind for big damage, take the high ground for range, mind water and swamp. Enemies fight smart too: they path around cliffs, turn to face you, go for your healers first and respect a knight's parry.
- **Ground that fights back.** Fire spells leave the ground burning, ice puts it out, poison clouds linger. Some battlefields have their own embers, bog gas and healing springs, and Rangers (and some defenders) hide traps you won't see until someone walks into one.
- **Twenty-five jobs on a job tree.** Squire, Knight, Archer, White and Black Mage, Geomancer, then Chemist, Dragoon, Ninja, Thief, Monk, Time Weaver, Summoner, Oracle, Paladin, Spellblade, Bard, Dancer, Beast Tamer, Gunner, Dark Knight, Shaman, Ranger, Necromancer and Sapper as your units level their jobs. Bards and Dancers perform: a song or dance that plays again every turn they hold their ground. Summoners call down a creature that lands a turn later. Dark Knights pay for their techniques in their own blood, Shamans plant totems that work the field for you, Rangers hide traps your foes never see coming, Necromancers raise fallen foes to fight for you, and Sappers throw up barricades and raise the ground itself. Mix a second job's skills, a reaction, a support and a movement ability on every unit.
- **Monsters.** Dire Wolves, Wyverns, Bog Oozes, Basilisks, Bone Knights, fire-spitting Emberbacks that bask in the flames, and more, each with its own traits and immunities. A Beast Tamer can wear one down and win it over to fight for you.
- **Steal their gear.** Thieves lift weapons and trinkets straight off enemies into your armory. Over 70 pieces of gear, some with traits: start battles with Regen, boost an element, or ward off Sleep and Silence.
- **A world map between battles.** Walk the realm, choose which road the story takes, and fall back to regroup after a defeat. Win optional side battles for trophies found nowhere else, buy early gear and one-of-a-kind goods from a travelling merchant, and make camp after each chapter to hear what your squad has to say (and watch those nights again later). Each of your story recruits has a side story of their own, back home.
- **A market that grows with the story.** Bounties and wins pay gil. Buy gear that outfits the whole squad, sell what you don't need, and stock up on supplies.
- **Master your jobs.** Jobs level up, unlock advanced jobs, and pay permanent bonuses a unit keeps in every job. A mastered job also brings its signature move, usable once a battle in any job.
- **Easy to pick up.** Easy, Normal and Hard; tips the first time each thing comes up; undo for a misplaced move; a Fast battle speed; a larger text size.
- **Install it.** On the web version, add the game to your home screen or apps; it then plays offline.
- **Items in battle.** Potions, Ethers, Remedies, Blast and Frost Flasks, Elixirs, and Phoenix Feathers to raise fallen allies. The Chemist makes every one of them stronger.
- **A three-act campaign** across ten 16×16 battlefields and two world maps (a harbor fought along its piers, a lighthouse rock, a snowbound pass, a drowned city…), with a branch, three story recruits, more to hire at the market, and bosses that enrage at half health.
- **Trials of the Zodiac:** endless seeded floors with rare gear and a Warden boss every fifth floor, plus New Game+.
- **The Workshop:** sculpt terrain, place enemies and bosses, write the dialogue, paint burning ground, poison gas, healing springs and hidden traps, pick a goal (rout them, defeat the boss, survive N rounds, or hold the ground), then play it or share it as a link. String your battles into a chain and share a whole mini campaign.
- **Hand-made pixel art** in a 3D world: animated units, drawn portraits, and pixel spell effects that wrap the actual characters.
- **AUTO** lets the AI play a turn for you when you just want to watch it go.

### Play anywhere
Phone, tablet or desktop, in portrait or landscape. Mouse, keyboard, touch, pen or a controller all work, and you can switch mid-fight. Press **H** (or the **?** button) in game for every control, and change any key or controller button there.

| | Keyboard | Controller | Touch |
| :--- | :--- | :--- | :--- |
| Move cursor / choose | Arrows + Enter | D-pad + A | Tap |
| Commands | 1 Move (again to undo) · 2 Act · 3 Wait · 4 Auto · 5 Item | X | Command bar |
| Back | Esc | B | Two-finger tap |
| Camera | Q / E rotate, + / − zoom, WASD pan | Bumpers, triggers, right stick | Twist, pinch, drag |
| Fullscreen | F | | Fullscreen button |

### Saves
Progress saves in your browser, in three slots (Menu → Save, plus an autosave at each chapter and whenever you reach the world map). It survives game updates on this page. Private or incognito windows don't keep it. To move a save to another browser or device, export it from the save screen and import it there.

### Free and open
The game is free, and the code is open source under the MIT licence on [GitHub](https://github.com/CptNope/Chess-RPG-Tactics). If you enjoy it, a donation helps more games get made.

Made by [Jeremy Anderson Tech](https://jeremyanderson.tech). Built with three.js and TypeScript, with code and writing produced with Claude (Anthropic). All art and sound are drawn and synthesized by the game's own code; spell effects come from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT). Read how it was made on [the project page](https://jeremyanderson.tech/project/chess-rpg-tactics/).

*Chess RPG Tactics is a fan-made homage to the tactics-RPG genre and is not affiliated with Square Enix or the makers of Final Fantasy Tactics or Tactics Ogre.*
