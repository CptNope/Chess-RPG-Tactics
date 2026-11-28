# ADR 0052: The Shaman and totems that stand on the field

## Status
Accepted (0.47.0, 2026-11-27).

## Context
- After the Dark Knight (0.46) the roadmap asked for a support or caster job; White Mage was the only pure healer.
- Every effect in the engine landed on a unit and travelled with it. Nothing stayed on the ground, so where a fight happened mattered only through height and terrain.

## Decision
1. **Totems** (`src/core/Totems.ts`), pure rules on units like Summons and Performance:
   - An ability with `totem: <kind>` plants one on the aimed tile; its reach is the ability's `aoe` in steps. It hits nobody (`victimsFor` returns no one) and blocks nothing.
   - Kept on the Shaman (`unit.totems`), like a Summoner's pending call (`unit.calling`), so the battle, the sim, the AI and a server see them through the units they already pass around.
   - **Pulse:** on everyone in reach when planted (`hpPaid`'s neighbour on the start step: `totem`, `pulses`), and on whoever starts a turn in reach (`TurnManager.startOfTurn(unit, units)`, reported as `totems` on the tick and as `totem` on the battle's `tick` event).
   - Mending heals allies 8% of max HP, Warding gives them Protect, Binding Slows foes, Storm strikes foes with lightning (MAG × 3 × 0.5, Shell cuts it). The signature's Ancestral totem mends, wards and binds.
   - Up to two per Shaman: the same kind moves, a third kind replaces the oldest.
   - They count down at the end of the Shaman's own turns (in `tickStatuses`, so a sleeping turn counts), three turns, five with Deep Roots. They fade when the Shaman falls, and are cleared when it is raised or a battle starts.
2. **The Shaman** (White Mage 3 + Geomancer 2), a Warden: staff, robes.
   - Spirit Lash (lightning), Mending, Warding, Binding and Storm Totems; Spirit Ward (reaction: struck in reach of its own totem, recovers 15%); Deep Roots (support); Ancestral Totem (signature, reach 3).
3. **AI:** `scoreTotem` values a totem's first pulse on everyone in reach × 1.6 for the turns it stands, less when it moves one with turns left. Every unit also weighs the totems where it would end its turn: out of a foe's Storm and Binding, into an ally's Mending and Warding.
4. **Screen:** a totem is aimed in two steps (the first click shows its reach, the second plants it), since there is no target to forecast. Totems are drawn as carved poles with a crest in their kind's colour and a ring on their tile (`graphics/TotemArt.ts`).

## Tuning
Back-line casters in Tobin's slot (`SWAP=p3:<job>`, 100 battles a point, Normal; Chapter II-B Lv 4 / IV Lv 7 / VII Lv 10):

| Job | II-B | IV | VII |
| :--- | :---: | :---: | :---: |
| Archer (as is) | 58% | 28% | 44% |
| White Mage | 38% | 47% | 8% |
| Oracle | 40% | 25% | 3% |
| Time Mage | 18% | 21% | 3% |
| Geomancer | 29% | 20% | 4% |
| Bard | 45% | 46% | 29% |
| Summoner | 15% | 71% | 11% |
| Black Mage | 44% | 40% | 4% |
| **Shaman** | 45% | 47% | 1% |

- The Shaman sits with the strongest casters early; Chapter VII punishes every caster in that slot but the Bard (its fights want a second archer).
- A trace over 50 battles a chapter shows the AI using all five actions: Warding Totem and Spirit Lash most, Storm Totem more as fights get harder. No change was needed.

## Consequences
- 22 jobs, 135 abilities plus signatures.
- Tiles can now carry effects. A later trap, hazard or objective zone can build on `Totems.ts`'s shape (owner, tile, reach, turns).
- Online versus (docs/ONLINE_VERSUS.md): totems live on units, so a server replaying intents sees them with no new state.
