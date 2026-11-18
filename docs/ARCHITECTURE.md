# System Architecture & Technical Specifications

This document outlines the architectural design, component relationships, data flow, and lifecycle execution of **Chess RPG Tactics**.

---

## 1. High-Level Component Topology

```mermaid
flowchart TD
    subgraph Browser ["Web Browser Client"]
        DOM["HTML5 DOM & CRT Shader Overlay"]
        Canvas["WebGL Viewport Canvas"]
    end

    subgraph CoreEngine ["Core Engine (TypeScript / Decoupled)"]
        TM["TurnManager (CT Clock Engine)"]
        BG["BattleGrid (3D Heightmap & Pathfinding)"]
        CE["CombatEngine (Facing & Damage Formulas)"]
        JS["JobSystem (5-Slot Abilities & JP Progress)"]
    end

    subgraph PresentationLayer ["Presentation Layer"]
        TS["TacticsScene (Three.js 3D Isometric World)"]
        PT["PixelTextures (Procedural Pixel Art Engine)"]
        UI["UIManager (HUD, Timeline Ribbon, Modal UI)"]
    end

    subgraph DataLayer ["Data Definitions"]
        Jobs["Job Definitions (Squire, Knight, Mages...)"]
        Maps["Preset Maps (Elevations & Terrains)"]
    end

    DataLayer --> CoreEngine
    CoreEngine --> PresentationLayer
    TS --> Canvas
    UI --> DOM
    Canvas --> TS
```

---

## 2. Active Turn Lifecycle Sequence

The game does not use synchronous team turns. Instead, it ticks the CT clock based on unit speed until someone reaches $CT \ge 100$.

```mermaid
sequenceDiagram
    autonumber
    participant TM as TurnManager
    participant Main as GameLoop (main.ts)
    participant Scene as TacticsScene
    participant UI as UIManager
    participant AI as EnemyAI
    participant Combat as CombatEngine

    TM->>TM: Advance CT clock (Speed ticks)
    TM->>Main: Active Unit ready (CT >= 100)
    Main->>Scene: Focus camera on unit (focusOn)
    Main->>UI: Update status card, timeline & action menu
    
    alt Player Unit Turn
        UI->>Main: User clicks MOVE
        Main->>Scene: Calculate & render blue reachable tiles
        Main->>Main: User clicks tile -> Unit translates
        UI->>Main: User clicks ACT & chooses ability
        Main->>Scene: Calculate & render red attack range tiles
        Main->>Combat: Generate CombatForecast (facing, hit%, dmg)
        Main->>UI: Display Forecast Preview Popup
        UI->>Combat: Confirm Execute -> Damage, Crit & Floating Text
        Main->>UI: Prompt Facing Selector (N, E, S, W)
        UI->>Main: Facing Confirmed
    else Enemy Unit Turn
        Main->>AI: Trigger AI evaluation (900ms delay)
        AI->>AI: Evaluate closest threat & optimal tile
        AI->>Scene: Move unit sprite
        AI->>Combat: Execute skill in range
        AI->>Scene: Spawn 3D floating damage numbers
        AI->>Main: Turn to face target
    end

    Main->>TM: End Turn (Calculate CT Refund: 0%, 20%, or 40%)
    TM->>TM: Reset unit action flags & deduct CT
    Main->>Main: Check Victory/Defeat or advance to next turn
```

---

## 3. Core Class & Entity Relationship Diagram

```mermaid
classDiagram
    class Unit {
        +string id
        +string name
        +Team team
        +number level
        +number exp
        +string jobId
        +Record~string, number~ jobLevels
        +Record~string, number~ jobPoints
        +EquippedAbilities equippedAbilities
        +number currentHp
        +number maxHp
        +number currentMp
        +number maxMp
        +number speed
        +number ct
        +number move
        +number jump
        +number x
        +number z
        +FacingDirection facing
        +boolean isDead
        +boolean hasMoved
        +boolean hasActed
    }

    class EquippedAbilities {
        +string primaryJobId
        +string secondaryJobId
        +string reaction
        +string support
        +string movement
    }

    class Job {
        +string id
        +string name
        +string role
        +number baseMove
        +number baseJump
        +StatMultipliers statMultipliers
        +Ability[] abilities
    }

    class Ability {
        +string id
        +string name
        +string jobId
        +AbilityType type
        +number jpCost
        +number mpCost
        +number range
        +number heightTolerance
        +number aoe
        +number power
        +Element element
    }

    class TileData {
        +number x
        +number z
        +number height
        +TerrainType terrain
        +boolean walkable
    }

    class BattleGrid {
        +MapData mapData
        +getTile(x, z) TileData
        +getHeight(x, z) number
        +getReachableTiles(unit, allUnits) PathNode[]
        +getTargetableTiles(x, z, range, heightTol) TileData[]
        +getAoeTiles(cx, cz, aoe) TileData[]
    }

    class TurnManager {
        +Unit[] units
        +Unit activeUnit
        +advanceToNextActiveTurn() Unit
        +endTurn(unit) void
        +predictTurnTimeline(count) Unit[]
    }

    class CombatEngine {
        +getFacingType(ax, az, target) string
        +getForecast(atk, tgt, skill, hA, hT) CombatForecast
        +executeAttack(forecast) AttackResult
    }

    Unit *-- EquippedAbilities
    Job *-- Ability
    Unit --> Job : references
    BattleGrid *-- TileData
    TurnManager o-- Unit
    CombatEngine ..> Unit
    CombatEngine ..> Ability
```

---

## 4. Key Subsystem Responsibilities

| Subsystem | Primary Responsibility | Key Files |
| :--- | :--- | :--- |
| **Grid & Pathfinding** | Manages 3D voxel heightmaps, step walkability, and Dijkstra BFS with Jump constraints. | `src/core/Grid.ts`, `src/data/maps.ts` |
| **CT Speed Clock** | Simulates tick-based Charge Time accumulation ($CT \mathrel{+}= Speed$) and turn prediction. | `src/core/TurnManager.ts` |
| **Combat Mechanics** | Determines spatial vectors (Front/Flank/Back), height bonuses, hit rolls, and critical strikes. | `src/core/CombatEngine.ts` |
| **Job Progression** | Handles base stat scaling, 5-slot ability equipping, and JP ability mastery. | `src/core/JobSystem.ts`, `src/data/jobs.ts` |
| **3D Isometric Scene** | Manages Three.js scene, orthographic camera, 90° rotation, smooth zoom, and billboard planes. | `src/renderer/TacticsScene.ts` |
| **Pixel Art Generator** | Procedurally draws 16x16 tile textures and 4-directional 32x32 character sprites. | `src/graphics/PixelTextures.ts` |
| **HUD & Interface** | Controls turn order ribbon, status card, command menus, and floating combat numbers. | `src/ui/UIManager.ts`, `src/style.css` |
| **Game Orchestration** | Glues input handling, event loops, battle state checks, and enemy AI turns. | `src/main.ts` |
