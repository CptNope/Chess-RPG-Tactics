# ADR 0054: The Ranger, and traps hidden from the other side

## Status
Accepted (0.49.0, 2026-11-28).

## Context
- 0.48 put lasting effects on the ground: hazards everyone sees, and the Shaman's totems. The roadmap's "more ground" item listed traps hidden until stepped on.
- Until now everything on the field was visible to both sides, and a move always ended where it was aimed.

## Decision
1. **Traps** (`src/core/Traps.ts`), kept on the Ranger like totems (`unit.traps`):
   - An ability with `trap: <kind>` hides one on a free tile (walkable, nobody on it, no trap there), or, with `aoe`, on every free tile around (the Killing Field signature, past the usual limit).
   - Snare: Immobilize. Spikes: the setter's attack power × 2.4 (Protect cuts it). Slumber: Sleep. Smoke: Blind. A status the victim's gear guards against doesn't land; the trap is spent anyway.
   - Three per Ranger, five with Trapsmith; the oldest is pulled up. A trap stays when its Ranger falls, and is gone once sprung.
2. **Springing on the way** (`walkInto` in `Action.ts`): a move follows the walking path. The first tile with a trap belonging to the mover's foe stops the walk there, and the trap springs.
   - A Ranger with Ambush who can reach the victim with its weapon shoots at once.
   - Teleporting units only spring a trap where they land.
   - The engine's `apply` records a `trap` event. Stopped short, the unit acts only if its intent is still valid from the trap and it isn't asleep.
   - The battle screen walks the shortened path, shows the snap, and drops an enemy's planned action the same way.
3. **Hidden information:** the screen draws only the squad's own traps, and an enemy setting one logs only "hides something on the ground". The AI never reads a foe's traps; allies walk over their own side's freely.
   - For online versus (docs/ONLINE_VERSUS.md), this is the first state one side must not see. A server will have to filter `unit.traps` and the target of trap-setting `act` events per viewer.
4. **AI:** `scoreTrap` values a tile a foe can reach next turn on its way to the Ranger's side, with the best foe counted fully and others at a quarter, discounted for foes who fight at range, then × 0.55. The AI lays traps mostly when no attack is in reach.
5. **The Ranger** (Archer 3 + Thief 2), a Trapper: bow or dagger, Move 4, Jump 3. Snare comes first in its list, so a young enemy Ranger (below level 4) sets snares. A **Bandit Trapper** is one of Thornwood Ford's two fixed foes.

## Tuning
Ranged jobs in Tobin's slot (`SWAP=p3:<job>`, 100 battles a point; Chapter II-B Lv 4 / IV Lv 7 / VII Lv 10):

| Job | II-B | IV | VII |
| :--- | :---: | :---: | :---: |
| Archer | 58% | 28% | 44% |
| Gunner | 51% | 16% | 16% |
| Ranger, first cut (ATK 1.05, Pinning Shot 1.0, range 4) | 39% | 15% | 5% |
| **Ranger as shipped** (ATK 1.15, Pinning Shot 1.3, range 5) | 46% | 18% | 11% |

- A trace showed traps springing (Chapter IV: 53 of 102 Spike Traps; VII: 16 of 100) and laid about once a battle, on turns otherwise spent walking. The gap to the Archer is damage: it has a free 1.4 shot and Arrow Rain.
- Discounting traps against ranged foes changed nothing measurable but keeps the AI from laying them for foes who won't come.
- Thornwood Ford stays at 99–100% in the sim (which fields the Act II party of six there).

## Consequences
- 23 jobs, 142 abilities plus signatures.
- Moves can now end short of where they were aimed; anything that reasons about a move after the fact reads where the unit stands, not the intent.
