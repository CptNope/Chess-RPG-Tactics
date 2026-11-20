# ADR 0018: Workshop Scenarios, Bigger Battlefields and Character Art

## Status
Accepted (0.10.0, 2026-11-19). Supersedes [ADR 0009](0009-in-game-3d-map-editor.md).

## Context
- The 11×11 maps left little room for flanking or for the extra enemies the later chapters wanted.
- The 0.4 map editor edited the live battle map, had four tools, copied JSON to the clipboard, and could only "test" with the current chapter's enemies. Nothing was saved, and imported JSON was trusted as-is.
- After the 0.9 graphics work, the units (32px sprites with no animation, emoji portraits) were the weakest part of the picture.

## Decision
1. **16×16 battlefields built with a small `MapBuilder`** (`set`, `rect`, `each`) so layouts read as intent ("a river here, a temple there") instead of loops over coordinates. Each map declares its own `playerSpawns`; `spawnsFor()` falls back to the southern rows. A unit test flood-fills from the deploy zone to prove every campaign and Trials enemy is reachable on foot.
2. **A scenario is plain JSON** (`core/Scenario.ts`): map, enemies, dialogue, objective, rewards. `scenarioToChapter()` turns it into an ordinary `CampaignChapter` with an optional `mapData` and `objective`, so the battle flow, AI, spoils and saves need no special path.
3. **Objectives live in the chapter** (`rout`, `boss`, `survive` with rounds). A round ends once every living unit has had a turn since the last one; `checkBattleStatus` handles all three.
4. **Untrusted input is rebuilt, not validated in place.** `sanitizeScenario()` constructs a new scenario field by field: sizes and numbers are clamped, job and item ids are checked with own-property lookups (so `__proto__` can't pass), text is stripped of control characters and length-capped, and everything is rendered with `textContent`. Validation (`validateScenario`) is separate and only advises the author.
5. **Share links carry the scenario itself**: tiles packed as one short token per tile, deflated with `CompressionStream`, base64url in the URL hash (`#s=`), so there's no server and nothing is uploaded.
6. **The Workshop is a separate UI module** (`ui/Workshop.ts`) that talks to the game through a small host interface (scene, squad, chapters, play, closed). It suspends the battle in progress and restores it on close. Controls are buttons and ◀ ▶ steppers rather than `<select>` or number inputs, so a controller can drive everything with the existing spatial focus navigation.
7. **Character art stays procedural** (`graphics/CharacterArt.ts`): a tiny pixel painter draws shaded parts, then an outline pass adds a 1px dark edge. Six frames per view (idle ×2, walk ×2, attack, hurt); the west view mirrors the east. The scene picks the frame from what the unit is doing (lunge → attack, recoil → hurt, tile change → walk tween). Portraits use the same painter at 64×64 for named heroes and every job in both team colours.

## Consequences
- Players can build, play and share battles with no account or server; scenarios are small enough for a link (a full 16×16 chapter remix is under 4 KB of URL).
- The battle code has one path for campaign, Trials and Workshop battles.
- No image assets to license or load; new jobs need drawing code, not files. The art is limited to what reads well at 48px.
- There's no gallery of shared scenarios (that needs a back end), and walking slides in a straight line rather than along the path.
