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
        0.17.0 : Act II, Chapters IV to VI : Three battlefields : Sable joins : Enemy raise cap
        0.18.0 : Easy, Normal, Hard : Three save slots, export and import : Supplies refunded on defeat : Trials after Chapter III
        0.19.0 : Chemist job : Frost Flask, Elixir : Installable app, plays offline
        0.20.0 : Enemies path, face and focus healers : Chapter III rebalanced : Text size
        0.21.0 : Travelling merchant : Camp scenes : Side-battle trophies
        0.22.0 : Bard and Dancer : Performances that play each turn : Encore and Resonance
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
| 0.22 | Encore | The Bard and the Dancer (18 jobs, 105 abilities); songs and dances that play again each turn the performer holds its ground; two new reactions; job changes can't leave HP above the maximum |
| 0.21 | On the road | Wenna the Pedlar, a travelling merchant with early gear and goods of her own; six camp scenes between story battles; a trophy for the first win at each side battle; 6 new items (60) |
| 0.20 | Smarter foes | Enemies walk the real path round cliffs, face their foes, respect Weapon Guard and drop healers first; Chapter III rebalanced (0% → about 30–60% in the sim); a text-size setting |
| 0.19 | Kit and reach | The Chemist (16 jobs, 93 abilities) with Pharmacology for supplies, Frost Flask and Elixir (8 supplies), an installable app that plays offline |
| 0.18 | Choices for the player | Easy / Normal / Hard, three save slots with export and import, a lost battle returns its supplies, the Trials open after Chapter III |
| 0.17 | A second act | Chapters IV to VI on three new battlefields (harbor piers, a lighthouse rock, a cliff altar), a third recruit, six battles per playthrough; finished saves continue; enemies raise once per battle |
| 0.16 | Room to grow | Three replayable side battles on the map, permanent job mastery bonuses at job level 5 and 8, the White Mage's Raise (used by the AI too), undo move, a Fast battle speed, first-battle tips |
| 0.15 | A world between battles | The Item command and six supplies (a revive among them), a world map where the story branch is a march and defeat is a retreat, Larkmoor Market with buy and sell, the Haste effect back on the unit |
| 0.14 | Progression | Job levels and an enforced job tree, Paladin and Spellblade (15 jobs, 86 abilities), gil and a shop that grows with the campaign, status pips over units, readable HP bars |
| 0.13 | Bigger squad | Monk, Thief, Summoner and Oracle (13 jobs, 75 abilities), Shell / Regen / Blind / Silence / Sleep / Breach, 25 new items with traits, Steal, Rend Armor and Armor Mastery fixed |
| 0.12 | Ship it | itch.io release (HTML5 zip, store page, butler publishing), title screen, fullscreen, bundled fonts, iframe-safe input |
| 0.11 | Feel | Pixel-art spell and hit effects (pixelfx) wrapping the real sprites, units walk their path, Workshop brush strokes, Chapter II-B rebalanced with a headless balance sim |
| 0.10 | Make your own | 16×16 battlefields, the Workshop (map + scenario editor with objectives, library, share links), animated 48px sprites, drawn portraits |

---

## 2. Now / Next / Later

*Reviewed for 0.22.0. The game now has a two-act campaign, side battles, a market, items, mastery, difficulty, save slots and an installable offline build; most of what's left is depth for players who stay, and checks only a person can make.*

```mermaid
flowchart LR
    subgraph NOW["Now (0.23): needs a person"]
        direction TB
        N1["Play the campaign by hand:<br/>Chapter III, Act II"]
        N2["Real-device QA:<br/>iOS Safari, Android, pads"]
        N3["Install the app on a phone;<br/>play offline"]
        N4["Devlog + store update"]
    end
    subgraph NEXT["Next (0.23 – 0.25): depth"]
        direction TB
        X1["AI: items and<br/>two-ply look-ahead"]
        X3["Recruiting at the market"]
        X4["Mastery abilities"]
        X5["Play-tests in CI"]
        X7["Equipment rules"]
    end
    subgraph LATER["Later (1.0+): breadth"]
        direction TB
        L1["Act III"]
        L2["Monsters with their<br/>own abilities"]
        L4["Workshop gallery"]
        L5["Remappable controls"]
        L6["Localization"]
        L7["Async online duels"]
    end
    NOW --> NEXT --> LATER
```

### Now (0.23): checks that need a person

| Item | Why | Size | Notes |
| :--- | :--- | :---: | :--- |
| **Play the campaign by hand** | Act II, difficulty and 0.20's Chapter III change were tuned by an AI-versus-AI sim with a starter-geared squad | S | One run on Normal, one on Easy; note where it drags (Chapter V is the lowest in the sim now) |
| **Real-device QA** | Input has only been verified in Chromium with synthesized events | S | iPhone Safari (gestures, safe areas), Android Chrome, iPad + Pencil, Xbox/PlayStation pads |
| **Install the app and play offline** | 0.19's offline build was tested in headless Chrome only | S | Android Chrome (Install app), iPhone Safari (Share → Add to Home Screen), desktop Chrome/Edge |
| **Devlog and store update** | itch and the project page still describe 0.14 | S | One devlog covering 0.13 to 0.22 |

### Next (0.23 – 0.25): depth

| Item | Why | Size |
| :--- | :--- | :---: |
| **Recruiting at the market** | The squad is the opening four plus two story recruits; hiring (and choosing who deploys) would give gil a second sink | M |
| **Mastery abilities** | Mastery (0.16) is stat bonuses only; a signature ability per job at Master would give builds an identity | M |
| **Play-test suite in CI** | Device matrix, input, campaign and feature bots exist but aren't committed | M |
| **Equipment rules**: weapon and armor types per job | Every job can wear everything | M |
| **AI: items and two-ply look-ahead** | Bosses could carry a potion; enemies could set up combos and retreat to heal. A one-turn threat term was tried in 0.20 and changed nothing ([details](ENEMY_AI.md#5-known-limits)) | L |

### Later (1.0+): breadth

| Item | Size |
| :--- | :---: |
| Act III: Chapters VII to IX, new battlefields and map places | L |
| Monsters: enemies that aren't humans in player jobs, with their own abilities | L |
| More jobs (a beast tamer, a gunner) | L |
| Enemies that steal from you (needs a way to win it back) | S |
| Workshop: a browsable gallery of shared scenarios (needs a small back end); scenario chains (mini campaigns); props and multi-wave enemies | M |
| Remappable keyboard and controller bindings | M |
| Localization (strings out of code) | M |
| Asynchronous online duels (exchange turns via a back end) | XL |
| Effects per ability, not just per element: arrows in flight, spear thrusts, chain lightning | M |

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
    "Play it by hand": [0.15, 0.75]
    "Device QA": [0.25, 0.72]
    "Devlog + store": [0.1, 0.55]
    "AI look-ahead": [0.75, 0.5]
    "Recruiting": [0.5, 0.5]
    "Mastery abilities": [0.55, 0.45]
    "Play-tests in CI": [0.4, 0.6]
    "Equipment rules": [0.55, 0.4]
    "Act III": [0.8, 0.7]
    "Monsters": [0.75, 0.66]
    "Online duels": [0.88, 0.6]
    "Localization": [0.6, 0.28]
```

---

## 4. Known issues & tech debt

| Area | Issue | Impact | Plan |
| :--- | :--- | :---: | :--- |
| Balance | The balance sim doesn't play encores, so Bards and Dancers (Trials only, on the enemy side) count for less there than in play | Low | Fine for now |
| Balance | Act II and the difficulty settings are tuned by simulation only (AI against AI, starter gear, no items) | Medium | Now (play it by hand) |
| Balance | Chapter V is the lowest chapter in the simulation (under 15% at squad level 7–9 on Normal). The sim is pessimistic (no gear upgrades, no items), so a hand play-through decides whether it needs the Chapter III treatment | Medium | Now |
| QA | Input verified only in Chromium with synthetic events | Medium | Now (device QA) |
| QA | High-quality graphics frame rate not yet measured on real GPUs (CI has none); Auto steps down if slow | Medium | Now (device QA) |
| QA | Browser play-tests not in CI | Medium | Next |
| App | The offline build is tested in headless Chrome only; iOS installs from Safari's Share menu (no Install button there) | Low | Now (install on a phone) |
| App | An installed app picks up a new version on the next launch after it downloads, not instantly | Low | Fine for now |
| Code | `main.ts` (2.3k lines) and `UIManager.ts` (1.2k lines) are large | Medium | Split battle flow, saves, the map host and input into modules |
| Rules | Speed Save's +2 Speed is lost at the unit's next end of turn (stats are recalculated) | Low | Make it a status |
| A11y | Text size scales every UI label of 22px or less; the large title art keeps its size | Low | Fine for now |
| Saves | Export downloads may be blocked inside the itch.io embed; Copy works there | Low | Fine for now |
| Tips | First-battle tips are remembered per device, not per save, and don't show controller glyphs | Low | Fine for now |
| World map | Workshop battles and the battlefield picker sit outside the map; New Game starts in Chapter I without showing it | Low | Fine for now |
| Workshop | Shared scenarios live in links and files only; there's no gallery | Low | Later |
| World map | Camp scenes play once per playthrough with no way to watch them again; the merchant has three goods of her own, so late in the game she runs out | Low | More with Act III |
| Art | The itch banner image still says "Fifteen jobs" | Low | Regenerate with the next store update |

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
