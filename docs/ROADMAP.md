# Roadmap

Where Chess RPG Tactics has been, what's known to be rough, and where it could go next.

> **Everything under "Next" and "Later" is a proposal, not a promise.** Priorities change with playtesting. Shipped work is recorded in the [Changelog](../CHANGELOG.md); design decisions in the [ADRs](README.md#architectural-decision-records).

---

## 1. Shipped so far

```mermaid
timeline
    title Chess RPG Tactics releases (November 2026)
    section Nov 17
        0.1.0 : 3D isometric engine : CT speed turns : Facing combat : 5-slot jobs : Pages CI
        0.2.0 : Close-up zoom : Mouse and keyboard camera : Floating combat text
        0.3.0 : Dragoon, Ninja, Time Weaver : Synth SFX : Dialogue : Map selector : Status effects
        0.4.0 : 3D map editor : Equipment : Branching campaign
    section Nov 18
        0.5.0 : Spell VFX and weather : Screen shake : Overhead HP bars
        0.5.1 : Texture caching : Material pooling : 60 FPS loop
        0.6.0 : Reactions : Chiptune BGM : Battle log : Saves
    section Nov 19
        0.7.0 : Deploy fix : Planning AI and AUTO : Persistent squad : Geomancer : Bosses : Trials
        0.8.0 : Phone, tablet, desktop layouts : Touch, pen, keyboard, controller
        0.8.1 : Documentation overhaul : Generated content reference
        0.9.0 : Original character names : MIT license : Graphics upgrade : 20x fewer draw calls
        0.10.0 : 16x16 battlefields : Workshop map and scenario editor : Share links : Animated 48px sprites : Drawn portraits
    section Nov 20
        0.11.0 : Pixel-art spell effects : Path walking : Workshop brush strokes : Balance sim
        0.12.0 : itch.io release : Title screen : Bundled fonts : Fullscreen
    section Nov 23
        0.13.0 : Monk, Thief, Summoner, Oracle : 6 new statuses : Gear traits : Steal
        0.14.0 : Job levels and job tree : Paladin, Spellblade : Gil and shop : Status pips
        0.15.0 : Items in battle : World map between missions : Market, buy and sell : Haste effect fix
        0.16.0 : Side battles : Job mastery : Raise : Undo move, battle speed, tips
```

| Version | Theme | Highlights |
| :--- | :--- | :--- |
| 0.1–0.3 | Foundations | Isometric engine, CT turns, facing, 8 jobs, audio, dialogue, status effects |
| 0.4 | Content systems | Map editor, gear, branching campaign |
| 0.5 | Feel | VFX, weather, screen shake, performance pass |
| 0.6 | Depth | Reactions, music, battle log, saves (shipped without a changelog entry; see ADR 0014) |
| 0.7 | Make it a game | Deploy fix, AI, progression, Geomancer, bosses, spoils, Trials, 28 tests |
| 0.8 | Play anywhere | Responsive HUD; mouse, keyboard, touch, pen and controller |
| 0.8.1 | Documentation | Rewritten guides, roadmap, generated content reference, docs check in CI |
| 0.9 | Own it, polish it | Original names, MIT license, lighting/sky/water/torches/bloom, quality tiers, merged terrain |
| 0.16 | Room to grow | Three replayable side battles on the map, permanent job mastery bonuses at job level 5 and 8, the White Mage's Raise (used by the AI too), undo move, a Fast battle speed, first-battle tips |
| 0.15 | A world between battles | The Item command and six supplies (a revive among them), a world map where the story branch is a march and defeat is a retreat, Larkmoor Market with buy and sell, the Haste effect back on the unit |
| 0.14 | Progression | Job levels and an enforced job tree, Paladin and Spellblade (15 jobs, 86 abilities), gil and a shop that grows with the campaign, status pips over units, readable HP bars |
| 0.13 | Bigger squad | Monk, Thief, Summoner and Oracle (13 jobs, 75 abilities), Shell / Regen / Blind / Silence / Sleep / Breach, 25 new items with traits, Steal, Rend Armor and Armor Mastery fixed |
| 0.12 | Ship it | itch.io release (HTML5 zip, store page, butler publishing), title screen, fullscreen, bundled fonts, iframe-safe input |
| 0.11 | Feel | Pixel-art spell and hit effects (pixelfx) wrapping the real sprites, units walk their path, Workshop brush strokes, Chapter II-B rebalanced with a headless balance sim |
| 0.10 | Make your own | 16×16 battlefields, the Workshop (map + scenario editor with objectives, library, share links), animated 48px sprites, drawn portraits |

---

## 2. Now / Next / Later

```mermaid
flowchart LR
    subgraph NOW["Now (0.17)"]
        direction TB
        N1["Campaign Chapters IV–VI"]
        N2["Real-device QA:<br/>iOS Safari, Android, real pads"]
        N3["Commit the Playwright<br/>play-test suite to CI"]
        N4["Devlog + site post<br/>for the itch release"]
    end
    subgraph NEXT["Next (0.18 – 0.20)"]
        direction TB
        X1["Equipment rules:<br/>weapon types per job"]
        X2["World map events:<br/>travellers, camp scenes"]
        X3["Smarter AI:<br/>reactions, facing, 2-ply"]
        X4["Difficulty settings"]
        X5["Multiple save slots"]
        X6["Installable PWA, offline"]
    end
    subgraph LATER["Later (1.0+)"]
        direction TB
        L1["Monsters with their<br/>own abilities"]
        L2["More jobs: Bard, Dancer,<br/>Chemist"]
        L3["Workshop: community<br/>scenario gallery"]
        L4["Remappable controls"]
        L5["Localization"]
        L6["Async online duels"]
        L7["Effects for every ability<br/>(per-weapon arcs, projectiles)"]
    end
    NOW --> NEXT --> LATER
```

### Now (0.17): finish and ship what exists

| Item | Why | Size | Notes |
| :--- | :--- | :---: | :--- |
| **Campaign Chapters IV–VI** | A playthrough is three battles; the map, market, items and mastery now have more depth than the story gives time to use | L | New maps, a third recruit, new places on the world map |
| **Real-device QA** | 0.8.0 input was verified in Chromium with synthesized events only | S | iPhone Safari (gestures, safe areas), Android Chrome, iPad + Pencil, Xbox/PlayStation pads |
| **Play-test suite in CI** | Device matrix, input and campaign bots exist but aren't committed | M | Add Playwright as a dev dependency; run headless in Actions |
| **Devlog** | Tell people what's new | S | itch devlog for 0.13 to 0.16 (the site's project page is live) |

### Next (0.18 – 0.20): depth

| Item | Why | Size |
| :--- | :--- | :---: |
| **Equipment rules**: weapon and armor types per job | Every job can wear everything; Armor Mastery (0.13) could become "wear plate as any job" once rules exist | M |
| **World map events**: a travelling merchant with one rare item, a camp scene between chapters, side battles with their own rewards | Side battles (0.16) all pay the same; nothing happens on the road | M |
| **Difficulty settings** | The Final Chapter is near 0% on pure AUTO; an easier and a harder setting would widen who finishes | S |
| **Recruiting at the market** | The squad is fixed plus one story recruit; hiring would give gil a second sink | M |
| **Mastery abilities** | Mastery (0.16) is stat bonuses only; a signature ability per job at Master would give builds an identity | M |
| **More supplies and a Chemist job**: an elixir, status-inflicting flasks, a job that doubles item effects and throws them further | Items are six plain supplies | M |
| **AI: items** | Bosses could carry a potion; AUTO could use yours with a setting | S |
| **AI: reactions and facing** | AI ignores Weapon Guard and leaves its back open ([details](ENEMY_AI.md#5-known-limits)) | M |
| **AI: two-ply look-ahead** | Lets enemies set up combos and retreat to heal | L |
| **Multiple save slots** + export/import | One slot is fragile | S |
| **PWA**: install, offline | Play on phones without a connection | S |

### Later (1.0+): breadth

| Item | Size |
| :--- | :---: |
| More jobs (Bard, Dancer) | L |
| Monsters: enemies that aren't humans in player jobs, with their own abilities | L |
| Enemies that steal from you (needs a way to win it back) | S |
| Workshop: a browsable gallery of shared scenarios (needs a small back end); scenario chains (mini campaigns) | M |
| Remappable keyboard and controller bindings | M |
| Localization (strings out of code) | M |
| Asynchronous online duels (exchange turns via a back end) | XL |
| Effects per ability, not just per element: arrows and thrown stones in flight, spear thrusts, a chain lightning for area spells (more pixelfx effects are available) | M |
| Workshop: place props (trees, crates) and per-tile decorations; multi-wave enemies; ally guests | M |

---

## 3. Impact vs effort

```mermaid
quadrantChart
    title Candidate work
    x-axis "Low effort" --> "High effort"
    y-axis "Low impact" --> "High impact"
    quadrant-1 "Big bets"
    quadrant-2 "Quick wins"
    quadrant-3 "Fill-ins"
    quadrant-4 "Reconsider"
    "Difficulty settings": [0.2, 0.6]
    "Devlog + site post": [0.1, 0.55]
    "Device QA": [0.25, 0.75]
    "Play-tests in CI": [0.36, 0.65]
    "Recruiting": [0.45, 0.5]
    "Save slots": [0.22, 0.36]
    "PWA offline": [0.3, 0.52]
    "Equipment rules": [0.55, 0.53]
    "World map events": [0.55, 0.66]
    "AI 2-ply": [0.75, 0.6]
    "New chapters": [0.8, 0.85]
    "More jobs": [0.7, 0.7]
    "Online duels": [0.86, 0.68]
    "Localization": [0.6, 0.3]
```

---

## 4. Known issues & tech debt

| Area | Issue | Impact | Plan |
| :--- | :--- | :---: | :--- |
| Rules | Speed Save's +2 Speed is lost at the unit's next end of turn (stats are recalculated) | Low | Make it a status |
| Code | `main.ts` (1.5k lines) and `UIManager.ts` (1k lines) are large | Medium | Split battle flow, spoils/chapters and input into modules |
| QA | Input verified only in Chromium with synthetic events | Medium | Now (device QA) |
| QA | High-quality graphics frame rate not yet measured on real GPUs (CI has none); Auto steps down if slow | Medium | Now (device QA) |
| QA | Browser play-tests not in CI | Medium | Now |
| A11y | Font sizes are fixed px; no text-size setting | Low | Next |
| Workshop | Shared scenarios live in links and files only; there's no gallery | Low | Later |
| Balance | Enemy White Mages now raise their dead (0.16); the balance sim shows no clear shift, but it hasn't been played by hand against Chapter II-A's healer | Medium | Play it; cap AI raises per battle if it drags |
| Tips | First-battle tips are remembered per device, not per save, and aren't translated into controller glyphs | Low | Fine for now |
| Rules | Retrying a lost battle keeps the supplies spent in it, while loading a save restores them | Low | Decide on one rule; a retry could refund |
| World map | Workshop battles and the battlefield picker sit outside the map; New Game starts in Chapter I without showing it | Low | Open on the map once there is more than one thing to do there at the start |
| Balance | `npm run balance` ignores reactions and gear, so its numbers are relative; the Final Chapter is near 0% on pure AUTO (as in 0.9) and needs re-geared or hands-on play | Low | Tune after real playtests |

---

## 5. Definition of done (any roadmap item)

```mermaid
flowchart LR
    A["Rules in src/core<br/>with unit tests"] --> B["UI works with mouse,<br/>keyboard, touch, pen, controller"]
    B --> C["Fits phone, tablet,<br/>desktop layouts"]
    C --> D["Docs updated<br/>(npm run docs:gen if data changed)"]
    D --> E["CHANGELOG entry<br/>+ ADR if architectural"]
    E --> F["PR green in CI"]
```
