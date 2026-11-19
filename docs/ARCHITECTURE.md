# Architecture

How Chess RPG Tactics is put together: modules, the game's state machine, how a turn and an action flow through the code, input, persistence, and the build.

> Stack: **TypeScript + Vite + Three.js** (orthographic 3D), DOM/CSS HUD, Web Audio, no runtime framework. ~8k lines of TypeScript, one 120 KB app chunk plus a 476 KB Three.js chunk.

---

## 1. Layers and modules

```mermaid
flowchart TB
    subgraph Input["Input · src/input + TacticsScene gestures"]
        direction LR
        Kbd["Keyboard"] ~~~ Ptr["Mouse · touch · pen<br/>(Pointer Events)"] ~~~ Pad["Controller<br/>(GamepadInput)"] ~~~ Nav["FocusNav"]
    end

    subgraph Game["Orchestration · src/main.ts"]
        direction LR
        Disp["Input dispatcher"] ~~~ Flow["Battle flow<br/>turns · spoils · chapters · Trials"] ~~~ Pipe["performAction()<br/>player + AI"]
    end

    subgraph Core["Rules · src/core (no DOM, unit-tested)"]
        direction LR
        TM["TurnManager"] ~~~ Grid["BattleGrid"] ~~~ CE["CombatEngine"] ~~~ JS["JobSystem"]
        AI["EnemyAI"] ~~~ Geo["Geomancy"] ~~~ Tr["Trials"] ~~~ Save["SaveManager"]
    end

    subgraph Data["Content · src/data"]
        direction LR
        Jobs["jobs"] ~~~ Items["items"] ~~~ Maps["maps"] ~~~ Camp["campaign"]
    end

    subgraph View["Presentation"]
        direction LR
        Scene["TacticsScene<br/>Three.js"] ~~~ VFX["VFXManager"] ~~~ Tex["PixelTextures"] ~~~ UI["UIManager"] ~~~ Audio["SoundFX · Music"]
    end

    Input ==>|"intents"| Game
    Game ==>|"rules & queries"| Core
    Core ==>|"reads"| Data
    Game ==>|"draws & plays"| View
    View -.->|"taps, gestures"| Input
```

| Module | File(s) | Responsibility | Depends on |
| :--- | :--- | :--- | :--- |
| **TacticsGame** | `src/main.ts` | Owns all state; turn flow, action pipeline, input dispatch, spoils, chapters, Trials, save/load | everything |
| **TurnManager** | `src/core/TurnManager.ts` | CT clock, turn order prediction, CT refunds, status ticking, poison | JobSystem |
| **BattleGrid** | `src/core/Grid.ts` | Tile lookup, Dijkstra movement (Jump, terrain cost, Teleport), `canTarget` range rule | types |
| **CombatEngine** | `src/core/CombatEngine.ts` | Facing, forecast, hit/crit rolls, statuses, reactions, boss enrage | JobSystem |
| **JobSystem** | `src/core/JobSystem.ts` | Unit creation, effective stats, EXP/levels, bosses, passives lookup | data |
| **EnemyAI** | `src/core/EnemyAI.ts` | Scores every tile × ability × target; also powers AUTO | Grid, CombatEngine, Geomancy |
| **Geomancy** | `src/core/Geomancy.ts` | Terrain → spell mapping | types |
| **Trials** | `src/core/Trials.ts` | Seeded floor generator, drops | data |
| **SaveManager** | `src/core/SaveManager.ts` | Save/load, best Trial floor, custom maps | — |
| **TacticsScene** | `src/renderer/TacticsScene.ts` | Three.js scene, camera, tiles, sprites, highlights, gestures, cursor | Grid, VFX, PixelTextures |
| **VFXManager** | `src/renderer/VFXManager.ts` | Weather, spell particles, screen shake (reduced-motion aware) | — |
| **PixelTextures** | `src/graphics/PixelTextures.ts` | Procedural tile textures and 4-facing unit sprites (cached) | — |
| **UIManager** | `src/ui/UIManager.ts` | HUD, menus, Team screen, modals, focus management, input-aware hints | JobSystem, FocusNav |
| **GamepadInput** | `src/input/GamepadInput.ts` | Standard-mapping polling, repeat, rumble | — |
| **FocusNav** | `src/input/FocusNav.ts` | Arrow / d-pad focus movement between visible controls | — |
| **Audio** | `src/audio/*.ts` | SFX and three procedural music tracks | — |

**Rule of thumb:** `src/core` and `src/data` never touch the DOM or Three.js. That is what lets `tests/core.test.ts` and `scripts/gen-docs.ts` import them directly in Node.

---

## 2. Game state machine

`TacticsGame.currentMode` gates every input. `battleOver` short-circuits turn advancement.

```mermaid
stateDiagram-v2
    [*] --> dialogue: chapter intro
    dialogue --> busy: startBattle()
    busy --> idle: player unit's turn
    busy --> busy: enemy turn (runAiTurn)
    idle --> moving: MOVE
    moving --> idle: tile chosen / cancel
    idle --> targeting: ACT → ability
    targeting --> idle: cancel
    targeting --> busy: EXECUTE → performAction
    idle --> busy: AUTO
    idle --> facing: WAIT
    busy --> facing: moved and acted
    facing --> idle: back out (if not forced)
    facing --> busy: confirm → endTurn
    idle --> editor: Map editor
    editor --> idle: close
    busy --> menu: victory / defeat
    menu --> dialogue: next chapter
    menu --> busy: retry / next Trial
```

| Mode | Battlefield taps | Arrows / d-pad | Confirm (Enter / A) | Cancel (Esc / B) |
| :--- | :--- | :--- | :--- | :--- |
| `dialogue` | — | — | Next line | — |
| `idle` | Inspect unit | Move cursor | On own unit → command menu; else inspect | Blur focus |
| `moving` | Move if reachable | Move cursor | Move to cursor | Back to idle |
| `targeting` | Forecast if in range | Move cursor | Forecast at cursor | Back to idle |
| `facing` | — | Move focus on compass | Pick / confirm | Back out unless forced |
| `editor` | Edit tile | Move cursor | Edit cursor tile | Close editor |
| `busy` / `menu` | — | Modal focus only | Modal buttons | — |

---

## 3. A turn, end to end

```mermaid
sequenceDiagram
    autonumber
    participant TM as TurnManager
    participant G as TacticsGame
    participant UI as UIManager
    participant AI as EnemyAI
    participant P as performAction
    participant CE as CombatEngine

    G->>TM: advanceToNextActiveTurn()
    TM-->>G: active unit (+ poison tick)
    G->>UI: unit card, ACT list (terrain-resolved), timeline, banner
    alt player unit
        UI->>G: MOVE → tile (reachable via BattleGrid)
        UI->>G: ACT → ability → target tile (canTarget)
        G->>UI: forecast (hit %, damage, facing, +N in area)
        UI->>G: EXECUTE
        G->>P: performAction(unit, ability, tile)
    else enemy unit, or AUTO
        G->>AI: planTurn(unit, units, grid)
        AI-->>G: { moveTo, ability, targetTile, facing }
        G->>P: performAction(...) if an ability was chosen
    end
    P->>CE: forecast + executeAttack per victim
    CE-->>P: hit, damage, crit, status, reaction, enrage
    P-->>G: EXP / JP / level-ups for player units
    G->>TM: endTurn() — CT refund, statuses tick
    G->>G: checkBattleStatus() → spoils / defeat / next turn
```

---

## 4. The action pipeline

Player actions, enemy actions and AUTO all go through one function, `TacticsGame.performAction()`. Before 0.7.0 the player and enemy paths were separate copies and drifted apart.

```mermaid
flowchart TD
    Start(["performAction(caster, ability, tx, tz)"]) --> Victims{"ability.isSelfOnly?"}
    Victims -- yes --> Self["victims = [caster]"]
    Victims -- "aoe > 0" --> Blast["unitsInBlast()<br/>foes for damage, allies for heals"]
    Victims -- "aoe = 0" --> Tile["unit on the tile"]
    Self & Blast & Tile --> MP["Spend MP once · face target · lunge"]
    MP --> Loop["For each victim"]
    Loop --> FC["getForecast()<br/>splash ring = 60%"]
    FC --> Roll["executeAttack()<br/>parry → hit roll → status → heal or damage → crit"]
    Roll --> React{"reaction?"}
    React -- yes --> RX["counter · auto-potion · dragonheart ·<br/>earthen ward · speed save · critical quick"]
    React -- no --> Enr
    RX --> Enr{"boss ≤ 50% HP?"}
    Enr -- first time --> Rage["Enrage: Haste, +20% power, rumble"]
    Enr -- no --> Next
    Rage --> Next{"more victims<br/>and caster alive?"}
    Next -- yes --> Loop
    Next -- no --> Prog["Player caster: +JP, +EXP, level-up"]
    Prog --> Done(["update sprites · return"])
```

---

## 5. Input architecture

Every device ends up as one of three intents (direction, confirm, cancel) or a named command. Which one wins depends on whether a menu layer is active.

```mermaid
flowchart LR
    subgraph Devices
        K["Keyboard<br/>keydown"]
        M["Mouse"]
        T["Touch"]
        Pn["Pen"]
        C["Controller<br/>Gamepad API"]
    end
    M & T & Pn --> PE["Pointer Events<br/>TacticsScene"]
    PE -->|"tap"| Tap["onTileTap"]
    PE -->|"drag / pinch / twist / wheel"| Cam["Camera"]
    PE -->|"2-finger tap · eraser · barrel"| Cancel
    K --> Intent
    C --> Intent["direction · confirm · cancel · command"]
    Intent --> Layer{"ui.activeLayer()?"}
    Layer -- "menu / modal / sheet" --> Focus["FocusNav.moveFocus · click focused"]
    Layer -- none --> Field["Tile cursor · onCanvasClick"]
    Tap --> Field
    Intent --> Cancel["cancelAction()<br/>closes the top-most thing"]
```

`html[data-input]` records the last-used device (`mouse`, `touch`, `pen`, `keyboard`, `gamepad`). CSS and UI read it for hotkey badges, the dialogue hint and the order of cards on the Controls screen. Full mapping: [Controls & Camera](CONTROLS_AND_CAMERA.md).

---

## 6. Data model

```mermaid
classDiagram
    direction LR
    class Unit {
        id, name, team
        level, exp
        jobId
        jobPoints: Record~job, number~
        unlockedAbilities: Record~id, bool~
        equippedAbilities: EquippedAbilities
        equipment: EquippedGear
        baseStats
        currentHp/maxHp, currentMp/maxMp
        speed, ct, move, jump, evasion
        statuses: ActiveStatus[]
        x, z, facing
        isDead, hasMoved, hasActed
        isBoss?, isEnraged?, usedDragonheart?
    }
    class EquippedAbilities {
        primaryJobId
        secondaryJobId
        reaction
        support
        movement
    }
    class EquippedGear {
        weapon, shield, head, body, accessory
    }
    class Job {
        id, name, role
        baseMove, baseJump
        statMultipliers
        abilities: Ability[]
        prerequisites?
    }
    class Ability {
        id, type, jpCost, mpCost
        range, heightTolerance, aoe
        power, element
        appliesStatus?, isSelfOnly?, terrainDriven?
    }
    class Item {
        id, slot, weaponType?
        stats, range?, price
    }
    class CampaignChapter {
        id, title, mapId
        introDialogue, victoryDialogue
        enemyRoster: EnemySpawn[]
        choices?: StoryChoice[]
        rewardItemIds?, recruit?
    }
    class MapData {
        id, name, theme
        width, depth
        tiles: TileData[]
    }
    Unit *-- EquippedAbilities
    Unit *-- EquippedGear
    EquippedGear o-- Item
    Unit ..> Job : jobId
    Job *-- Ability
    CampaignChapter ..> MapData : mapId
    CampaignChapter ..> Item : rewards
```

---

## 7. Persistence

```mermaid
flowchart LR
    Save["Save button · chapter start · each Trial"] --> SM["SaveManager.saveGame()"]
    SM --> LS[("localStorage<br/>chess_rpg_tactics_save_v1")]
    LS --> Load["Load button / Defeat → Load Save"]
    Load --> Hydrate["Re-hydrate gear from ITEMS<br/>rebuild armory for 0.6 saves"]
    Hydrate --> Mode{"mode"}
    Mode -- campaign --> Chapter["setupBattle(chapter)"]
    Mode -- trials --> Trial["startTrial(floor)"]
```

| Key | Contents |
| :--- | :--- |
| `chess_rpg_tactics_save_v1` | `{ version, timestamp, currentChapterId, units, armory, mode, trialsFloor, campaignCleared }` |
| `chess_rpg_tactics_best_trial_v1` | Highest Trial floor cleared |
| `chess_rpg_tactics_custom_maps_v1` | Sculpted maps from the editor |

All storage calls are wrapped in `try/catch`, so private browsing or an embedded iframe without storage degrades to "save failed" instead of crashing.

---

## 8. Rendering notes

| Concern | Approach |
| :--- | :--- |
| Camera | Orthographic, 4 fixed azimuths (90° steps), smooth lerp. Zoom fits the *shorter* screen side, so portrait phones see the full map width |
| Tiles | One box mesh per tile, shared materials per terrain, cached `tileMeshList` for raycasts |
| Units | Billboard planes with procedurally drawn, cached 32×32 sprite textures per job/facing/team |
| Overlays | DOM HP/CT bars and floating numbers projected from 3D positions each frame |
| Frame loop | `requestAnimationFrame` → poll gamepad → hover tile info (only on change) → `scene.render()` |
| Motion | `prefers-reduced-motion` cuts screen shake to 15% and swaps sliding banners for fades |

---

## 9. Build, test, deploy

```mermaid
flowchart LR
    Dev["push / PR"] --> CI["GitHub Actions: build job"]
    CI --> Install["npm ci"]
    Install --> Build["tsc + vite build"]
    Build --> Tests["vitest (core rules)"]
    Tests --> Dist["check-dist.mjs<br/>assets exist"]
    Dist --> Docs["docs:check<br/>Content Reference up to date"]
    Docs --> PR{"pull request?"}
    PR -- yes --> Stop(["✔ checks only"])
    PR -- "no (main)" --> Upload["upload-pages-artifact"]
    Upload --> Deploy["deploy job: deploy-pages<br/>(+1 retry)"]
    Deploy --> Live(["cptnope.github.io/Chess-RPG-Tactics"])
```

Deploying from a separate job, with a retry, avoids the "No artifacts named github-pages" race that broke the 2026-11-18 deploy (see [ADR 0015](adr/0015-action-pipeline-ai-progression-trials.md)). Testing details: [TESTING.md](TESTING.md).

---

## 10. Source tree

```text
src/
├── main.ts                 TacticsGame: state, flow, action pipeline, input dispatch
├── style.css               HUD styles, responsive breakpoints, focus rings
├── core/                   Pure rules (Node-testable)
│   ├── types.ts            Shared types
│   ├── TurnManager.ts      CT clock
│   ├── Grid.ts             Pathfinding + targeting
│   ├── CombatEngine.ts     Forecasts, rolls, reactions, enrage
│   ├── JobSystem.ts        Stats, EXP, bosses
│   ├── EnemyAI.ts          Turn planner (also AUTO)
│   ├── Geomancy.ts         Terrain spells
│   ├── Trials.ts           Seeded post-game floors
│   └── SaveManager.ts      localStorage
├── data/                   Content: jobs, items, maps, campaign
├── renderer/               TacticsScene (Three.js + gestures), VFXManager
├── graphics/               PixelTextures
├── ui/                     UIManager
├── input/                  GamepadInput, FocusNav
└── audio/                  SoundEffects, MusicSynthesizer
tests/core.test.ts          28 rule tests
scripts/                    check-dist.mjs, gen-docs.ts
docs/                       This documentation + ADRs
```
