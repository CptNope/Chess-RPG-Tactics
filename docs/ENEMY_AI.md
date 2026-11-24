# Enemy AI (and AUTO)

`planTurn(unit, units, grid)` in `src/core/EnemyAI.ts` decides a whole turn: where to stand, what to use, what to aim at, and which way to face. It's team-agnostic, so the same planner plays enemy turns and the player's **AUTO** command.

---

## 1. Search

The planner is exhaustive. Maps are 16×16 (Workshop maps up to 24×24), squads are 4–6 units, and a unit can only reach the tiles within its Move, so it simply tries everything.

```mermaid
flowchart TD
    A(["planTurn(unit)"]) --> B["Candidate tiles = current tile + getReachableTiles()"]
    B --> C["For each tile"]
    C --> D["Abilities = combat actions the unit<br/>has learned and can afford (MP)"]
    D --> E["Resolve terrain spells for this tile<br/>(Geomancer)"]
    E --> F["Aim points:<br/>foes for damage/debuffs,<br/>allies for heals/buffs, self for Focus"]
    F --> G{"grid.canTarget()?"}
    G -- no --> F
    G -- yes --> H["victims = unitsInBlast()"]
    H --> I["score = Σ value(victim) + position − MP cost"]
    I --> J{"best so far?"}
    J -- yes --> K["keep {tile, ability, aim, facing}"]
    J -- no --> F
    K --> F
    C -->|done| L{"any scored plan?"}
    L -- yes --> M(["return best plan"])
    L -- no --> N["Advance by walking distance toward<br/>the closest, weakest foe it can reach;<br/>prefer high ground"]
    N --> M
```

Roughly *tiles × abilities × aim points*: about 30 × 5 × 6 ≈ 900 forecasts per turn, well under a millisecond each. The unit's position is moved temporarily for each candidate tile and always restored in a `finally` block.

---

## 2. Scoring

All values come from **forecasts** (expected values). The planner never rolls dice.

| Situation | Score per victim | Why |
| :--- | :--- | :--- |
| Damage | `min(damage, HP left) / maxHP × 100 × hit%` | Value is the *share* of HP removed, so chip damage on a healthy unit never beats finishing a wounded one |
| Likely KO (damage ≥ HP left) | `+120 × hit%` (+40 more on a boss) | Removing a unit is worth far more than damage |
| The target is a healer or buffer (0.20) | damage × 1.3, KO +30 more | `isSupportCaster()`: a heal, a raise, or Haste / Protect / Shell / Regen for others that it can still pay for and isn't silenced. Drop the medic first |
| Frontal physical blow on a Weapon Guard knight (0.20) | hit% × 0.7 | Weapon Guard parries 30% of frontal physical blows, so the side or back scores higher |
| Dual Wield | damage × 1.9 | Second strike |
| Damage that also inflicts a status | `+15 × hit%` if the target doesn't have it yet | |
| Pure Sleep | `55 × hit%` | Takes a unit out of the fight until someone hits it |
| Pure Haste / Slow | `45 × hit%` if not already applied | Tempo swings |
| Other pure statuses (Protect, Immobilize, Poison, Focus, Blind, Silence, Breach) | `35 × hit%` if not already applied | |
| Regen | `25 × hit%`, only if the ally is below 80% HP | |
| Shell / area Focus (Rally) | `15` / `18 × hit%` | Help less than a blow |
| Area buffs and debuffs | × 0.6 per victim | A buff aimed where it's needed beats a blanket |
| Protect, Shell or Focus with no foe within 5 tiles | skipped | Don't armour up miles from the fight |
| Ailment the target's gear guards against | skipped | It would be wasted |
| Silence on a unit with no MP abilities | skipped | |
| Cleanse | `+25` per ailment removed (`+40` for Sleep or Silence) | |
| Drain | `+ min(drained, HP missing) / maxHP × 60 × hit%` | Prefers draining when hurt |
| Hitting a sleeping unit | −10 | It wakes up |
| Steal | never chosen | The AI has nowhere to put stolen gear; Steal is the player's |
| Heal | `healed / maxHP × 100 × 1.3` (+20 on a boss), only if the ally is missing ≥ 25% HP | No wasted heals |
| Physical attack into Counter Tackle | −8 | Avoid feeding counters |

Then each plan gets small adjustments:

| Term | Value |
| :--- | :--- |
| High ground | `+0.5 × tile height` |
| Ending next to 2+ foes | −6 |
| MP spent | `−0.15 × MP cost` |
| Self-only buff (Bulwark, Focus) (0.20) | `−0.6 × walking distance to the nearest foe`, so it is cast on the way in |
| A performance (song or dance) (0.22) | ×1.4: it plays again on the next turns. Aimed at the performer's own tile, never range-checked |
| Still performing (0.22): moving, or any other action | −12 each, so a song isn't dropped for a small gain; with nothing worth doing, the performer stays put instead of advancing |

Every plan ends **facing the closest foe** (0.20), the one most likely to strike next, so the unit doesn't leave its back open after moving. For a melee attack that foe is the target anyway.

### Walking distance (0.20)

`walkingDistances(grid, from, unit)` runs Dijkstra outward from a foe over walkable tiles, with steps no higher than the unit's Jump and water or swamp costing 2 (unless it has Water Walk). Units are ignored, since they move. The planner uses it twice:

- **When nothing is in reach,** it picks the foe it can actually walk to (closest by path, then lowest HP) and moves to the reachable tile with the shortest path left, preferring high ground on ties. Before 0.20 this used straight-line distance, which walked units into the foot of cliffs.
- **For self-buffs,** as above.

A foe that can't be reached at all (on a cliff top) falls back to straight-line distance plus 100, so it is only chosen when nothing else is reachable.


---

## 3. Guarantees (covered by tests)

| Rule | Test in `tests/core.test.ts` |
| :--- | :--- |
| Damage never targets the caster's own team | `moves in and attacks a player in reach` |
| Finishes a wounded unit before chipping a healthy one | `prefers finishing a wounded foe` |
| Never buffs the player's units; heals wounded allies | `never casts buffs on the player team and heals wounded allies` |
| Never picks an ability it can't afford | `does not use abilities it cannot afford` |
| Walks around a cliff; water costs double; Water Walk ignores it | `tests/ai.test.ts`: `walking distance` |
| Ends its turn facing the closest foe | `tests/ai.test.ts`: `ends its turn facing the closest foe` |
| Heads for the gap instead of hugging a cliff | `tests/ai.test.ts`: `approaches along the path` |
| Values a frontal blow on a parrying knight less | `tests/ai.test.ts` |
| Shoots the unit that can still heal, given two identical targets | `tests/ai.test.ts` |
| A Bard beside wounded allies sings, centred on itself; a performer still playing holds its ground, but breaks off for a clearly better blow | `tests/performers.test.ts` |

---

## 4. How enemies are built

| Layer | Source |
| :--- | :--- |
| Job, level, position | Chapter `enemyRoster` (`src/data/campaign.ts`) or `buildTrialFloor()` |
| Boss | `isBoss` → `JobSystem.makeBoss()`: +60% HP, +15% ATK/MAG, enrage at 50% HP |
| Veteran kit (level ≥ 4) | Every action in their job, plus a job reaction/support (Knight parry, White Mage auto-potion, Black Mage Arcane Strength, Ninja Dual Wield, Dragoon Dragonheart, Geomancer Earthen Ward) |

---

## 5. Known limits

| Limit | Effect | Idea |
| :--- | :--- | :--- |
| One-turn horizon | Doesn't set up combos or retreat to heal | Two-ply search on the best N plans |
| Knows only Counter Tackle and Weapon Guard (0.20) | Other reactions (Field Dressing, Auto-Potion) don't change its choices | Add terms as they matter |
| One raise per battle for the enemy side (0.17) | The first healer to act takes it, whoever fell | Let the planner hold it for the most valuable unit |
| Raises the fallen whenever it can (0.16) | A revive scores 110 + 2 × the fallen unit's level, about the same as a likely kill, so a healer with MP nearly always does it | Weigh the fallen unit's job and how exposed the tile is |
| Never uses items (0.15) | Enemies carry no supplies, and AUTO won't spend yours | Give bosses a potion or two and a rule for when to drink |
| Faces the closest foe, not the most dangerous one (0.20) | An archer two tiles further away may still get the back | Weigh each foe's damage, not just distance |
| Doesn't avoid danger | A wounded unit will still walk into the enemy line to land a blow. A threat term was tried for 0.20 and made no difference in the simulation, so it was left out | Retreat-to-heal as part of two-ply search |
| AUTO uses the same weights | Plays aggressively for the player | Optional "careful" profile for AUTO |

These are tracked on the [roadmap](ROADMAP.md).
