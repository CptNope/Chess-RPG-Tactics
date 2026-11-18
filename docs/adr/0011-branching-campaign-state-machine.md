# ADR 0011: Multi-Stage Branching Campaign & Dialogue Engine

## Status
**Accepted**

## Date
2026-11-17

## Context
A standalone skirmish engine lacks the emotional investment of a narrative tactical campaign. Tactical RPGs excel when the player's tactical decisions lead to branching story routes, altering subsequent battlefields, enemy encounters, and equipment rewards.

## Decision
We implemented a **Multi-Stage Branching Campaign Architecture**:
- Defined in `src/data/campaign.ts`:
  - **Chapter I**: *Ambush at Riverside Ruins*
  - **Chapter II-A**: *The Sunken Crypts (Gloomy Mire)*
  - **Chapter II-B**: *The Siege of Night Battlement*
  - **Final Chapter**: *The Awakening at the Summit*
- **Branching Decision Gate**: Upon achieving victory in Chapter I, the game displays an interactive **Choice Modal** allowing the player to decide their strategic route:
  - Route A (Pursue Sorcerer into Mire) $\to$ unlocks Chapter II-A with toxic fog and magic rewards.
  - Route B (Reinforce Night Battlement) $\to$ unlocks Chapter II-B with high ramparts and heavy armor rewards.
- Integrated dialogue sequence engine for pre-battle and post-battle cutscenes with character portraits and typewriter audio cues.

## Consequences
### Positive
- Replayability: players can choose different narrative paths on subsequent playthroughs.
- Cohesive narrative structure connecting all battlefields, music, and enemy rosters into an authentic JRPG story arc.

### Negative
- Branching scenarios require authoring custom enemy rosters and unique dialogue scripts for each branch.
