# Job & Ability System

How units grow: jobs, the five ability slots, JP, EXP, levels and gear. For the full numbers (every job, ability and item), see the generated **[Content Reference](CONTENT_REFERENCE.md)**.

**Code:** `src/core/JobSystem.ts` · `src/data/jobs.ts` · `src/data/items.ts` · `src/ui/UIManager.ts` (Team screen)

---

## 1. The five ability slots

Every unit builds its battlefield identity from five slots, after *Final Fantasy Tactics*.

```mermaid
flowchart LR
    Unit(["Unit"]) --> P["① Primary action<br/><i>current job's skillset</i>"]
    Unit --> S["② Secondary action<br/><i>any other job's skillset</i>"]
    Unit --> R["③ Reaction<br/><i>fires when hit</i>"]
    Unit --> Sup["④ Support<br/><i>always-on rule change</i>"]
    Unit --> M["⑤ Movement<br/><i>how it crosses terrain</i>"]
    P & S --> Menu["ACT menu"]
    R --> Combat["CombatEngine.checkReaction"]
    Sup --> Formula["Damage / JP formulas"]
    M --> Path["BattleGrid.getReachableTiles"]
```

| Slot | Comes from | When it matters | Examples |
| :---: | :--- | :--- | :--- |
| ① Primary | The unit's current job (fixed) | ACT menu | Knight → Rend Armor, Shield Bash |
| ② Secondary | Any job, cycled in **Team → Jobs** | ACT menu, alongside primary | Black Magic on a Knight |
| ③ Reaction | Any learned reaction | After taking a hit | Counter Tackle, Auto-Potion, Earthen Ward |
| ④ Support | Any learned support | Every damage/JP calculation | Arcane Strength, Attack Boost, JP Boost |
| ⑤ Movement | Any learned movement ability | Pathfinding and move range | Move +1, Teleport, Water Walk |

Only **learned** abilities can be equipped. Click (or press Enter / A on) a Reaction, Support or Movement slot to cycle through every passive the unit has learned from *any* job, plus None. Learning a passive equips it at once.

---

## 2. Jobs at a glance

```mermaid
quadrantChart
    title Job identity (multipliers)
    x-axis "Magic-leaning" --> "Attack-leaning"
    y-axis "Slow" --> "Fast"
    quadrant-1 "Fast strikers"
    quadrant-2 "Fast casters"
    quadrant-3 "Steady casters"
    quadrant-4 "Heavy hitters"
    Squire: [0.6, 0.45]
    Knight: [0.85, 0.3]
    Archer: [0.68, 0.6]
    Black Mage: [0.1, 0.3]
    White Mage: [0.15, 0.45]
    Dragoon: [0.85, 0.45]
    Ninja: [0.75, 0.95]
    Geomancer: [0.45, 0.45]
    Time Weaver: [0.15, 0.6]
    Monk: [0.9, 0.55]
    Thief: [0.62, 0.9]
    Summoner: [0.05, 0.2]
    Oracle: [0.2, 0.42]
    Paladin: [0.72, 0.35]
    Spellblade: [0.5, 0.5]
```

| Job | Plays like | Signature tools |
| :--- | :--- | :--- |
| **Squire** | Flexible starter | Throw Stone (range 4), Focus, Counter Tackle, Move +1 |
| **Knight** | Front-line wall | Rend Armor, Shield Bash, Weapon Guard (parry) |
| **Archer** | Long-range damage | Aim +2, Leg Shot (immobilize), Speed Save |
| **Black Mage** | Area damage | Fire / Blizzard / Thunder (Area 1), Poison Cloud, Arcane Strength |
| **White Mage** | Healer | Cure, Protect, Auto-Potion, Regen Walk |
| **Dragoon** | Mobile bruiser | Dragon Plunge, Dragon Breath (Area 1), Dragonheart, Ignore Elevation |
| **Ninja** | Fastest unit | Throw Shuriken, Reflexes, Dual Wield, Water Walk |
| **Geomancer** | Terrain caster | Elemental (changes with the ground), Earth Slash, Earthen Ward |
| **Time Weaver** | Tempo control | Haste, Slow, Gravity, Regen, Critical Quick, Teleport |
| **Monk** *(0.13)* | Fist fighter and field medic | Aura Wave (range 3), Chakra (free area heal + cleanse, from ATK), Pummel, Iron Will, Brawler, Ki Flow |
| **Thief** *(0.13)* | Fast skirmisher | Steal (gear into your armory), Sand Toss (Blind), Hamstring (Slow), Quick Hands, Backstab, Fleet Foot |
| **Summoner** *(0.13)* | Radius-2 spells | Salamander, Undine, Storm Roc, Sylph (heal + Regen), Golem (area Protect), Mana Spring, Conserve |
| **Paladin** *(0.14, advanced)* | Holy front-liner | Holy Blade, Lay on Hands, Rebuke (Silence), Aegis (area Shell), Divine Grace, Zeal |
| **Spellblade** *(0.14, advanced)* | Elemental duelist | Flame Edge, Frost Edge (Slow), Thunder Lunge (reach 2), Runic, Arcane Edge |
| **Oracle** *(0.13)* | Ailments | Dim Sight (Blind), Hush (Silence), Lullaby (area Sleep), Soul Drain, Hex Ward, Hex Mastery |

Older jobs gained an action each in 0.13: Squire *Rally*, Knight *Bulwark*, Archer *Arrow Rain*, Black Mage *Firestorm*, White Mage *Shell*, *Purify* and *Healing Circle*, Ninja *Smoke Bomb*, Time Weaver *Regen*. The Knight's support is now **Armor Mastery** (+50% HP from armor, helms and shields).

### Job levels and the job tree (0.14)

Each job a unit works in has a **job level** from 1 to 8 (Master), set by the lifetime JP earned in that job: 100 JP for Lv 2, 250 for Lv 3, then 450, 700, 1000, 1400 and 1900. Spending JP on abilities doesn't lower it. An action earns 24 JP and a won battle 60, so a level takes about one battle early on.

A job is **locked** until the unit has the job levels it requires. The Team screen lists every job with its level, a progress bar, and what a locked job still needs. Every unit starts at Squire Lv 2, so Knight and Archer are open from the start; a unit already in a job (a recruit, or one from an older save) keeps it.

```mermaid
flowchart LR
    Squire --> |Lv 2| Knight
    Squire --> |Lv 2| Archer
    Knight --> |Lv 2| Dragoon
    Archer --> |Lv 2| Ninja
    BlackMage["Black Mage"] --> |Lv 2| TimeWeaver["Time Weaver"]
    Squire --> |Lv 3| Monk
    Archer --> |Lv 2| Thief
    WhiteMage["White Mage"] --> |Lv 2| Summoner
    BlackMage --> |Lv 2| Summoner
    TimeWeaver --> |Lv 2| Oracle
    Knight --> |Lv 3| Paladin
    WhiteMage --> |Lv 2| Paladin
    Knight --> |Lv 2| Spellblade
    BlackMage --> |Lv 2| Spellblade
    Geomancer
```

`JobSystem.canChangeJob` is the single check; `gainJp` reports level-ups and the jobs they unlock, and `grantPrerequisites` gives units created in an advanced job the levels it needs.

---

## 3. Growth: EXP, levels and JP

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Acting
    Acting --> Acting: action → +10 EXP, +24 JP<br/>KO → +20 EXP
    Acting --> Spoils: battle won or lost
    Spoils --> LevelUp: EXP ≥ 100
    LevelUp --> Spoils: +18 HP, +5 MP,<br/>+1.8 ATK, +1.6 MAG
    Spoils --> Team: spend JP on abilities,<br/>equip new gear
    Team --> Acting: next battle
```

| Source | EXP | JP (current job) |
| :--- | ---: | ---: |
| Any action | 10 | 24 (36 with JP Boost) |
| Action that scores a KO | +20 | — |
| Battle won, unit survived | 40 + 10/KO | 60 |
| Battle won, unit fell | 15 + 10/KO | 20 |
| Battle lost | — (EXP/JP earned during the fight is kept) | — |

* **100 EXP = 1 level.** Speed rises by 1 every third level (`8 + ⌊level / 3⌋`).
* **JP belongs to a job.** Points earned as a Knight buy Knight abilities only.
* **Persistence:** levels, JP, learned abilities, equipped slots and gear carry over between chapters, into New Game+ and into the Trials.

---

## 4. Effective stats

```mermaid
flowchart LR
    Base["Base stats<br/>(grow with level)"] --> Mult["× job multipliers"]
    Mult --> Gear["+ gear stats"]
    Gear --> Status["× battle modifiers<br/>Focus 1.25 · Enrage 1.2<br/>Haste 1.5 · Slow 0.67"]
    Status --> Final["ATK / MAG / SPD<br/>used by CombatEngine"]
```

`JobSystem.getAttackPower()` and `getMagicPower()` are the only places that combine these. Battle modifiers never write to `baseStats`, so nothing stacks across battles.

---

## 5. Gear and the armory

| Slot | Affects | Notes |
| :--- | :--- | :--- |
| Weapon | ATK / MAG, **range** | Spears reach 2, bows 5–6; range replaces Attack's range of 1 |
| Shield | HP, evasion | Evasion above 5 lowers front/flank physical hit chance |
| Head | HP, MP, evasion | |
| Body | HP, ATK | |
| Accessory | Anything | Speed, Move, Jump, MP… |

Weapon types: swords, spears (range 2), bows (4–6), staves and rods, daggers, and **knuckles** (0.13; the Monk's *Brawler* adds +30% to unarmed or knuckle Attacks).

### Traits (0.13)

Some gear carries a **trait** on top of its stats (`Item.traits`):

| Trait | What it does | Examples |
| :--- | :--- | :--- |
| `startStatus` | The wearer starts every battle with these statuses. Regen from gear lasts the whole battle; the rest run their normal course | Verdant Charm (Regen), Warding Amulet (Protect + Shell), Mirror Shield and Templar Mail (Shell) |
| `boost` | +25% to the wearer's spells of that element (holy also boosts healing) | Flame / Frost / Storm Rod, Dawnbringer (holy) |
| `guard` | Those ailments can't be inflicted on the wearer; the enemy AI won't waste turns trying | Circlet of Clarity (Blind, Silence, Sleep), Purity Bangle (Poison, Slow, binding, Breach), Sage's Staff (Silence), Zodiac Ribbon (all) |

### Steal

The Thief's **Steal** takes one piece of an adjacent foe's gear (accessory first, then head, weapon, shield, body) and adds it to your armory if you don't have one. The foe loses its stats. It's harder than a blow (−25 hit, −45 against a boss) and, like any attack, easier from the side or behind. Gear stolen in a battle is listed on the spoils screen.

### Gil and the market (0.14, 0.15)

| Source | Gil |
| :--- | :--- |
| New game | 300 |
| Defeated enemy | 20 + 10 × level (×3 for a boss) |
| Battle won | +150 (campaign), +100 + 20 × floor (Trials) |
| Stealing gear you already own | half its price |
| Selling at the market (0.15) | half its price |
| Workshop battles | none |

**Larkmoor Market** on the world map sells gear for the armory; one purchase outfits the whole squad. (Team → Shop shows the shelves anywhere, but trades only at the market.) The shelves grow with the campaign, the moment each chapter is won: items up to 380 gil before the first victory, 480 after Chapter I, 580 after Chapter II, and everything after the campaign is cleared or in the Trials. The Zodiac Blade, Zodiac Ribbon and Wyrmscale Mail are never sold. Rules live in `src/core/Economy.ts`.

**Selling (0.15).** The market's SELL counter pays half price for spare gear and supplies. An item leaves the armory when sold, so `gearSaleBlock` refuses anything a squad member is wearing ("Worn by Rowan") and the three relics.

### Supplies (0.15)

Consumables are not gear: they sit in a shared inventory (`Record<id, count>`, at most 9 of each), are bought and sold at the market, and are used in battle with the **ITEM** command. A new squad carries 3 Potions and a Phoenix Feather. [Full table](CONTENT_REFERENCE.md#supplies); how they resolve is in [Combat](COMBAT_SYSTEM.md#9-items-0150).

The gear tab lists only items in the squad's **armory**. You start with 17 items. Chapter wins, branch choices and Trials drops add more ([where each item comes from](CONTENT_REFERENCE.md#items)). Any number of units can equip the same item.
