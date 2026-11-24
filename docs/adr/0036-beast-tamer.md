# ADR 0036: The Beast Tamer and Beasts in the Squad

## Status
Accepted (0.28.0, 2026-11-24).

## Context
- 0.26 and 0.27 put monsters on the Howling Hollow, the Trials and every story chapter from II. They could only be fought.
- The roadmap asked for a Beast Tamer to recruit them. The squad already had room to grow (a barracks of ten, a party of six since 0.25), and monsters already work as jobs (`Job.monster`), so a monster can be a squad member with almost no new rules.

## Decision
1. **Tame is an action, not a capture item.** The Beast Tamer's first ability wins a monster over. Its odds depend on how hurt the monster is (15% unhurt, up to 90%), with bonuses for Sleep, attacking from behind and the Beast Lore support, so the player has to wear a beast down without killing it. Bosses can't be tamed; only the player's side tames (the enemy planner skips it).
2. **The monster changes sides at once.** `tame()` sets its team and a `tamed` flag; from then on the turn loop hands it to the player like any squad member. This gives the job an immediate payoff in battle, not only after it.
3. **It joins after the victory, if it lives.** Survivors become squad members (`beast-` ids) with their job and level, and a name from a short list per kind. A full squad (10) sends them back to the wild. A Workshop scenario doesn't add them (its squad isn't the campaign's).
4. **A beast stays a beast.** No job changes (`canChangeJob`, `changeJob`), no gear (`equipItem`, save import, a note on the gear screen); its natural stats from 0.27 stand in for gear, and every move is known from the start. Beasts level and gain JP like anyone, and can be released at the Barracks.
5. **A tamed beast can't hold the field alone.** Defeat counts only the squad's own people, so taming the last enemy wins but a lone beast doesn't keep a lost battle going.
6. **The rest of the kit points at beasts** through one field, `Ability.beasts { hit, power }`: Snare and Soothe land more often on monsters, Treat heals them twice as much, Stampede hits them harder. Beast Lore (+25% damage to monsters) is useful to any job in the monster-heavy story.
7. **The Trials' job list is unchanged,** so seeded floors players are partway through stay the same.

## Consequences
- **A new way to grow the squad** that costs no gil but takes a party slot and a tamer's turns.
- **Beasts don't scale with gear**, so they fall behind geared people at high levels unless their natural stats are raised; a future "beast gear" (collars, barding) could fill that gap.
- **Balance is untested by the sim**, which fields no tamer; the hand play-through should judge whether a tamed wyvern or brute is too strong early.
