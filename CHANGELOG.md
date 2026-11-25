# Changelog

All notable changes to the **Chess RPG Tactics** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.34.0] - 2026-11-24

### Added — Act III begins: across the sea
- **Chapter VI** (The Drowned Regent) is no longer the end. After the victory, Sable shows the chart she stole from the Regent's ship, and the squad takes ship after his court.
- **The Far Shore**, a second world map. Once Chapter VI is won, **⛵ Sail to the Far Shore** at Emberwick Harbor; the ship lands at **the Anchorage**. Sail home from there to shop: the market and Wenna the Pedlar stay in the realm.
- **Chapter VII: The Saltglass Shore.** The drowned kingdom's old harbour in the dunes, held by Herald Isaine and the Regent's court, with a basilisk in the dunes and a thornling in the wreck. Win: the **Saltglass Blade** (ATK +12, MAG +4, Speed +1, ice damage up). March on: **Frostfang Mail** (heavy armor, HP +90, ATK +2, no Slow).
- **Kestrel** joins in Chapter VII: a Beast Tamer from a village the Court burned.
- **Chapter VIII: Frostfang Pass.** Terraces up to the Court's fort, held by Marshal Hale with a frost wyvern, a wolf and a drowned knight. It ends the story for now; its closing screen says Act III continues in a coming update. The Trials and New Game+ stay open.
- **Sand and snow.** Two new kinds of ground with their own textures, decorations, light and weather (drifting sand, falling snow). **Snow costs 2 movement**, like water and swamp. Geomancers cast **Dust Devil** on sand (Blind) and **Whiteout** on snow (Slow). Both are in the Workshop palette.
- **Two camp scenes:** the last night ashore before sailing, and a fire in the dunes with Kestrel.

### Balance
- Tuned with the balance sim against Chapter VI (Normal, 100 battles):

  | Chapter | lower | middle | upper |
  | :--- | :--- | :--- | :--- |
  | VI at L8 / L9 / L10 | 1% | 17% | 35% |
  | VII at L9 / L10 / L11 | 18% | 47% | 55% |
  | VIII at L10 / L11 / L12 | 10% | 34% | 40% |

  The first rosters won 5% and 3% at the middle level. In VII a ninja made the difference (now a monk, the Court Pugilist); in VIII any seventh unit kept the chapter near 5%, so the fort holds six.

### Fixed
- The guide's world map diagram called the Zodiac Summit the Final Chapter; it's Chapter III.

### Developer
- `WorldNode.region` (`'realm' | 'shore'`), `regionOf`, `SEA_PORTS`, `farShoreOpen`; a `port` node kind. `paintWorld(canvas, region)`. `CampaignChapter.epilogue`. Terrain `sand` and `snow` (map letters `a` and `n`), themes `desert` and `snow`.
- The balance sim fields Kestrel for Sable in VII and VIII and shifts its levels for Act III. `KESTREL=0` puts Sable back.
- A new play-test sails to the Far Shore (8 checks). 2 new tests (277 total). [ADR 0041](docs/adr/0041-act-three-the-far-shore.md).
- The README and TESTING test counts were one behind since 0.33; fixed.

## [0.33.0] - 2026-11-24

### Changed — the new beasts join the story
- **Chapter V (The Greywatch Light):** a **Cliff Basilisk** suns itself by the tower, in place of the Storm Hexer. Corvin warns you not to stand where it can see you.
- **Final Chapter (The Drowned Regent):** one of the Regent's old knights, a **Drowned Knight** (a Bone Knight), comes up out of the sea with him, in place of the Hourglass Seer. Sable warns you it won't sleep.
- Each swap was picked with the balance sim from several candidates as the one that keeps the chapter about as hard as it was:

  | Chapter (Normal, 100 battles) | 0.32 | 0.33 |
  | :--- | :--- | :--- |
  | V at L7 / L8 / L9 | 47 / 53 / 65% | 38 / 69 / 62% |
  | Final at L8 / L9 / L10 | 5 / 11 / 27% | 3 / 17 / 26% |

  Swapping other units moved the numbers a lot: the Basilisk in place of the Sentinel made Chapter V far harder (2 / 14 / 45%), and the Bone Knight in place of the Wraith Lancer made the Final Chapter far easier (67 / 31 / 65%).

## [0.32.0] - 2026-11-24

### Added — new beasts
- **Three new monsters**, each with its own sprite and portrait:
  - **Basilisk**: a long, low lizard in olive scales. Tail Lash; **Stone Gaze** roots a foe from 4 tiles away; **Dread Stare** damages and Slows. Can't be Immobilized or Blinded.
  - **Bone Knight**: a dead knight in a rusted helm. Rusted Blade; **Shield Bash** damages and Slows; **Grave Chill** hits a small area with dark damage. No Poison, Sleep or Blind.
  - **Thornling**: a walking knot of briars. Regenerates; **Thorn Lash** poisons from 3 tiles; **Bramble Burst** roots everyone next to it; **Pollen Cloud** Blinds a small area. No Sleep or Blind.
- **The Briar Barrow**, a new side battle on the world map between Riverside Ruins and the Night Battlement, open after Chapter III: bone knights, a basilisk and thornlings in an old kings' grave-mound. First win: the **Basilisk Eye** (HP +15, MAG +4, Speed +1, no Immobilize or Slow), a relic.
- **The Trials** meet the new monsters from floor 8. Floors 1–7 are unchanged.
- **Tame them**: a Beast Tamer can win any of the three over. They join with names of their own (Glare the Basilisk, Sir Rattles the Bone Knight, Bramble the Thornling…).

### Balance
- Simulated first visits to the Barrow win about 63–73% of the time, like the Drowned Shrine; with two earlier wins there, about 40%.

### Developer
- `MonsterArt`: `basilisk`, `boneKnight`, `thornling` painters. Roles `Undead` and `Plant`. `TRIAL_DEEP_MONSTERS_FROM`.
- 5 new tests (275 total) in `tests/new-monsters.test.ts`. [ADR 0040](docs/adr/0040-more-monsters.md).

## [0.31.0] - 2026-11-24

### Added — smarter enemies
- **Enemies think a turn ahead.** Before moving, an enemy now estimates what your squad could do to it on your next turns, tile by tile, and avoids ending where it would likely fall, unless the trade is worth it (killing the unit that threatens it counts). A hurt archer shoots from out of reach instead of walking into your knights.
  - **Normal**: enemies think ahead once they're below half HP, so the wounded back off or heal while the healthy still charge.
  - **Hard**: every enemy thinks ahead, prefers safer spots, and hurt ones hang back.
  - **Easy**: unchanged.
- **Enemies use items.** Some enemies carry a pouch: bosses a Potion, Chemists Potions and a Remedy, and on Normal every third enemy a Potion (on Hard, everyone; Chemists add a Phoenix Feather and a Blast Flask). They drink when hurt, cure a sleeping friend, and raise the fallen (counting against the side's raises). From level 9 Potions are Hi-Potions. Monsters carry nothing; on Easy nobody does.
- **🎒 on an enemy's card** shows how many items it carries; hover it for the list.
- **Salvage.** What fallen enemies never used goes into your supplies after a victory.
- **AUTO plays your units more carefully** too (it never spends your supplies).

### Changed
- The difficulty descriptions say how enemies use items and plan ahead.

### Balance
- Simulated win rates (Normal, 100 battles per level) stay close to 0.30 overall. Chapter II-B at level 3 and Chapter VI at level 8 are a little harder; Chapter V at levels 7–8 is easier because AUTO plays safer. Hard is clearly harder (Chapter I roughly halves).

### Developer
- `EnemyAI.threatMap()`, `PlanOptions { noRevive, caution: false | 'light' | 'full', pouch }`. Item heals are scored like heals; kills are reported so threatened plans can spare foes they finish.
- `core/EnemyPouch.ts`: `enemyPouch`, `enemyCaution`, `pouchText`, `salvage`. `Unit.pouch`.
- The balance sim mirrors the game (pouches, caution) and takes `OLD_AI=1`, `CAUTION=enemy|player|none` and `ITEMS=0` for comparisons.
- 8 new tests (270 total) in `tests/smarter-enemies.test.ts`. [ADR 0039](docs/adr/0039-smarter-enemies.md); [Enemy AI](docs/ENEMY_AI.md) updated.

## [0.30.0] - 2026-11-24

### Added — equipment rules
- **Each job has its own gear.** Weapons go by type (swords, spears, bows, staves and rods, daggers, knuckles, whips); shields, heavy armor and helms, and robes belong to some jobs. Light clothes, caps, hats, circlets and every accessory still suit anyone. For example:
  - **Knight**: swords and spears, shields, heavy armor and helms.
  - **Black Mage**: staves and rods, robes.
  - **Monk**: knuckles.
  - **Beast Tamer**: whips, daggers and bows.
  - The full table is in the [content reference](docs/CONTENT_REFERENCE.md#equipment-rules).
- **Team → Jobs** shows each job's gear under its name (⚔ Swords, Spears · Shields · Heavy armor & helms).
- **Team → Equipment** lists what this unit can wear first, then what its job can't use, greyed out, with who can (🔒 Platinum Plate Mail · For: Squire, Knight, Dragoon, Geomancer, Paladin). A job that carries no shield says so in the shield slot.
- **The market** names who can use each weapon, shield and piece of heavy armor or robe.

### Changed
- **Changing job takes off what the new job can't use**, back to the armory, and **puts on the best piece the new job can use** that you own (the job's own kind of armor first). A banner says what came off and what went on.
- **Old saves:** gear a unit's job can't use comes off when the save loads (it stays in the armory), with a note in the battle log.
- Every job's starting gear, enemies' included, already follows the rules, so story and Trials battles play as before.

### Developer
- `src/data/gear-rules.ts`: `JOB_GEAR`, `jobCanUse`, `whoCanUse`, `gearKind`, `jobGearText`. `Item.armor` ('heavy' | 'robe') marks heavy armor, helms and robes. `JobSystem.canEquip` now applies the job rules; `changeJob` returns what came off; `removeForbiddenGear`, `fillSlots`.
- The content reference gains an **Equipment rules** table and a **Who** column for every item.
- 7 new tests (262 total) in `tests/equipment-rules.test.ts`. [ADR 0038](docs/adr/0038-equipment-rules.md).

## [0.29.0] - 2026-11-24

### Added — beast gear
- **Gear for tamed beasts.** Beasts can now wear **barding** on the body and a **collar or charm** as an accessory, so a tamed monster keeps up with geared people as the squad grows. Six pieces, on a shelf of their own at the market (**Beast gear, tamed beasts only**):
  - **Leather Collar** (HP +20, Evasion +4), 160 G.
  - **Hide Barding** (HP +30, ATK +1), 200 G.
  - **Spiked Collar** (ATK +5), 320 G.
  - **Glowstone Charm** (MAG +6, MP +15), 340 G, for wisps.
  - **Chain Barding** (HP +50, ATK +2, Evasion −3), 440 G.
  - **Runed Barding** (HP +40, MP +15, no Sleep or Silence), 560 G.
- **Every new beast arrives wearing a Leather Collar**; the first one brings the collar into your armory.

### Changed
- **Beasts wear only beast gear, and people never do.** On a beast's Team → Equipment screen the weapon, shield and headgear slots read "beasts don't", and the lists show only what it can wear.

### Developer
- `Item.beast`, `JobSystem.canEquip` (used by `equipItem`, the gear lists and save import) and `BEAST_SLOTS`. `shopStock` puts beast gear last.
- 6 new tests (255 total) in `tests/beast-gear.test.ts`. [ADR 0037](docs/adr/0037-beast-gear.md).

## [0.28.0] - 2026-11-24

### Added — the Beast Tamer
- **A new advanced job, the Beast Tamer** (needs Archer Lv 2 and Chemist Lv 2; 19 jobs, 114 abilities). A drover in a wolf-pelt hood with a whip that cracks 2 tiles out:
  - **Tame**: win over a monster up to 2 tiles away. The more hurt it is, the likelier it gives in: 15% on an unhurt monster, up to 90% on one nearly down, +20% if it's asleep, +10% from behind. Never a boss.
  - **Snare**: a weighted net up to 3 tiles away, light damage and Immobilize; beasts get tangled more often.
  - **Treat**: heals an ally up to 3 tiles away, twice as much for a beast.
  - **Soothe**: Sleep up to 3 tiles away. People often shrug it off; beasts rarely do.
  - **Snarl** (reaction): struck in melee, a 35% chance the attacker is Slowed.
  - **Beast Lore** (support): +25% damage to monsters, and Tame works 15% more often. Any job can wear it once learned, handy now that the story is full of monsters.
  - **Stampede** (Master signature): a charging herd over a wide area up to 4 tiles away, heavy damage and Immobilize, more against beasts.
  - Mastery bonus: +10 HP at job level 5, +25 at Master.
- **Tamed monsters fight for you.** A monster won over changes sides on the spot and takes your orders for the rest of the battle (its HP bar and turn-order chip turn blue, and a ring of warm light and hearts marks the moment).
- **Beasts join the squad.** A tamed monster still standing at the victory joins the squad under a name of its own (Fang the Dire Wolf, Gloop the Bog Ooze, Flicker the Marsh Wisp…), at its level. Beasts wear no gear (their fangs, hide and glow are their gear), know all their moves from the start, and never change jobs; they level up like anyone else. With the squad full (10), a tamed monster goes back to the wild. Beasts can be **released** at the Barracks.
- Beast Tamers can turn up on the recruiting board after Chapter II.
- **Drover's Whip** (ATK +5, Speed +1, reaches 2 tiles): the tamer's weapon, in the starting armory and at the market.
- A first-time tip explains a tamed beast.

### Changed
- A tamed beast can't win a battle on its own: if everyone else in the squad falls, the battle is lost.

### Developer
- `core/Taming.ts` (`canTame`, `tameChance`, `tame`, `beastFromTamed`, `beastName`, `isBeast`, `BEAST_PREFIX`). `Ability.tame`, `Ability.beasts { hit, power }`, `Unit.tamed`, `AttackResult.tamed`, reaction type `snarl`, weapon type `whip`.
- A beast's job is its own: `canChangeJob` and `changeJob` refuse any other, `equipItem` and save import keep gear off it.
- A new pixel effect of our own, `local/tame` (`src/renderer/fx/tame.js`). Overhead HP bars follow a unit's team when it changes.
- The enemy planner never tries Tame. The Trials keep their job list, so existing floors don't change.
- 8 new tests (249 total) in `tests/tamer.test.ts`. [ADR 0036](docs/adr/0036-beast-tamer.md).

## [0.27.0] - 2026-11-24

### Added — monsters in the story
- **From Chapter II on, every story battle has monsters**, and someone in the squad warns you about them before the fight:
  - **II-A Gloomy Mire**: a Marsh Wisp (in place of the archer) and a Bog Ooze in the swamp.
  - **II-B Night Battlement**: the Dragoon Commander's War Wyvern (in place of the Gate Brawler).
  - **III Zodiac Summit**: the Altar Guardian, a Stonehide Brute woken with the Seal (in place of the Altar Sentinel).
  - **IV Emberwick Harbor**: Varrow's Bilge Ooze, out on the piers (in place of a Corsair Cutthroat).
  - **V Greywatch Isle**: a Storm Wyvern nesting on the light (in place of the Greywatch Lancer).
  - **VI Stormbreak Cape**: a Barrow Brute and a Drowned Wisp come up with the Regent (in place of the Tomb Knight and the Drowned Magus).
- Chapter I stays as it was.

### Changed
- **Monsters are stronger.** Monsters wear no gear, so they were weaker than people of the same level. Each now has natural stats in place of gear: the Wolf's fangs and speed (ATK +6, HP +20, Evasion +14), the Wyvern's hide (ATK +6, HP +30, Evasion +8), the Ooze's bulk (ATK +6, HP +30), the Wisp's glow (MAG +18, MP +20, Evasion +16) and the Brute's stone (ATK +6, HP +40). This applies at the Howling Hollow and in the Trials too.
- **Wisp Flame** hits harder (×1.25, was ×0.95) and **Drain Light** too (×1.0, was ×0.8).
- **Lure** is easier to resist (−30 to hit) and reaches 2 tiles (was 3), for 14 MP (was 8). A wisp that put someone to sleep every turn was the strongest thing in any battle it was in.

### Balance
- Each chapter was checked with the balance sim before and after (100 battles per level): the monsters replace units of a similar strength, so each chapter plays about as hard as it did. Where a swap made a fight much easier or harder (a monster in place of a support caster, or of the hardest hitter), it was moved to another unit or its level adjusted. Stormbreak Cape came out a little harder at the top levels.

### Developer
- `Job.innate.stats`: a monster's natural gear, counted by `recalculateDerivedStats` and `gearStat`. `Ability.accuracy`: added to the chance to hit.
- 2 new tests (241 total) in `tests/monsters.test.ts`. [ADR 0035](docs/adr/0035-monsters-in-the-story.md).

## [0.26.0] - 2026-11-24

### Added — monsters
- **Five monsters**, enemies with bodies and abilities of their own rather than people in a job. Each is drawn in pixel art in every view and frame, with a portrait for the unit card:
  - **Dire Wolf**: fast (Move 5) and hard-hitting. **Bite**, **Lunge** (2 tiles) and **Pack Howl** (Focus for the pack).
  - **Wyvern**: flies over walls and cliffs (Jump 8), can't be Immobilized. **Tail Sting** (Poison), **Swoop** (3 tiles, any height) and **Wing Gust** (a small area).
  - **Bog Ooze**: tough, starts every battle with Regen, can't be Poisoned, Blinded or put to Sleep. **Acid Touch** (Breach), **Engulf** (Immobilize) and **Bog Spit** (Poison over an area).
  - **Marsh Wisp**: a drifting marsh-light that floats over everything and can't be Poisoned, Slept or held. **Wisp Flame** (4 tiles), **Lure** (Sleep) and **Drain Light**.
  - **Stonehide Brute**: slow and huge, starts behind Protect. **Smash**, **Ground Pound** (every foe next to it, Immobilize) and **Hurl Boulder** (4 tiles).
- Monsters wear no gear and know all their actions from the start. They're never a squad member's job.
- **Howling Hollow**, a new side battle under the high pass (opens after Chapter I): a pack led by a wolf, with whatever else came down the mountain. First win: the **Wolfpelt Mantle** (HP +25, Evasion +6, Move +1, no Poison).
- **The Trials**: from floor 3, about one enemy in three is a monster.
- **The Workshop** can place monsters as enemies.

### Developer
- `src/data/monsters.ts`: monsters are `Job`s with `monster: true` and `innate` (start statuses, immunities). `PLAYER_JOB_IDS` and `isMonsterJob` in `data/jobs.ts`; job lists, the job tree, JP banks, recruiting and the docs' job tables use player jobs only.
- `src/graphics/MonsterArt.ts`: monster sprites (front, back, side; six frames) and portraits; `drawSprite` and the portrait cache hand monsters to it.
- `guardsAgainst` and `applyGearStatuses` include a monster's innate immunities and statuses.
- Monster stats are held to the same rules as jobs: a plain blow takes 2 to 6 hits either way, and no same-level spell one-shots one (the Wisp's HP and ATK were raised to pass).
- 6 new tests (239 total) in `tests/monsters.test.ts`. [ADR 0034](docs/adr/0034-monsters.md).

## [0.25.0] - 2026-11-24

### Added — recruiting
- **The market has a recruiting board.** Three hopefuls stand by it, each with a name, a job, a level (about one below your squad's) and a line about themselves. Hire one for 200 G plus 90 a level, a quarter more for a job that needs others first. A hire arrives in their job with its gear, its first ability and JP to spend on more.
- **The board changes after every battle won**, like the travelling merchant, and more jobs appear on it as the story goes on: the basic eight at first, Dragoon, Geomancer, Ninja, Time Weaver, Oracle and Summoner after two chapters, and Paladin, Spellblade, Bard and Dancer after four.
- **The squad can grow to ten** (the barracks).

### Added — choosing the party
- **Six fight at a time.** When the squad has more than six, **Choose your party** opens before a story battle, a side battle or the Trials: tap a unit to put it in the party or in reserve. The pick is remembered.
- **Rowan leads and always goes.** A story recruit fights the battle they join and takes one of the six places; the screen says so.
- **Barracks** at the market sets the party any time and lets you **dismiss** a hired unit (after a confirmation). Story characters can't be dismissed. Gear stays in the armory.
- Units in reserve keep their levels, jobs and gear, but earn no EXP or JP while they sit out.

### Changed
- Save files carry up to ten squad members (was eight), the party pick, and who was hired from the current board.

### Developer
- `src/core/Recruits.ts`: `recruitBoard`, `recruitJobs`, `recruitLevel`, `recruitPrice`, `hireRecruit`, `isHired`, `chooseParty`, `sanitizeParty`, `sanitizeRecruitHires`; `MAX_SQUAD`, `PARTY_SIZE`, `LEADER_ID`.
- The battle setup deploys `chooseParty(...)` rather than the whole squad, and the spoils go to whoever deployed.
- 11 new tests (233 total) in `tests/recruits.test.ts`. [ADR 0033](docs/adr/0033-recruiting-and-the-party.md).

## [0.24.0] - 2026-11-24

### Added — summons you can see
- **Every Summoner call now brings its creature onto the battlefield**, drawn in pixel art at the same scale as the units. The camera comes in, the board darkens, a summoning circle the size of the spell's area opens, and the damage lands with the creature's attack:
  - **Salamander**: a fire lizard rears out of a column of flame and breathes a burning ring over the area.
  - **Undine**: a water spirit rises from a pool and brings a wave down; frost is left where it broke.
  - **Storm Roc**: a thunderbird swoops in under storm clouds and calls down a rain of lightning.
  - **Sylph**: a wind fairy twirls down into a whirl of leaves and lets a healing rain fall.
  - **Golem**: a stone giant heaves up out of the ground, slams its fists and raises a shield of light.
  - **Celestial Call** (the Summoner's Master signature): a six-winged being descends in a shaft of light, and lances of light fall.

### Added — grand summons
- **Three new Summoner calls that take a turn to arrive** (✦ in the ACT menu, "Lands next turn"):
  - **Cinderwing** (450 JP, 36 MP): a firebird of rebirth dives into the circle. It heals allies in the area and **raises the fallen** there with a third of their HP.
  - **Tidewyrm** (520 JP, 40 MP): a sea serpent brings a wall of water down over a **radius-3** area and Slows whoever it hits.
  - **Elder Wyrm** (640 JP, 48 MP, range 5): an ancient dragon lowers its head out of a starry sky and breathes starfire into the circle.
- **How a call works:** using one spends the MP and the action and marks the area with pulsing striped tiles (violet for yours, orange for the enemy's). At the start of the caller's next turn the creature arrives and hits **whoever is standing there then**, at full force across the whole area and at +30 hit. The unit card shows **✦ CALLING**.
- **A call can be broken:** knock the caller out, put them to sleep or silence them, and nothing comes. The log says so.
- Enemy Summoners of level 6 and up call grand summons too, and enemies step out of the area of yours. A first-time tip explains the marked tiles. **Tidecaller Maelis**, Chapter V's boss, now calls the Tidewyrm, and Bria warns you about it before the fight.

### Changed
- A summon's name floats over its caster instead of a banner that would hide the creature.
- A unit raised by a spell is logged as **[RAISE]**, not [ITEM].

### Developer
- `src/core/Summons.ts`: `startCall`, `callDue`, `breakCall`, `callHolds`, `callArea`, `callsLandingOn`, `rebirthOf`, `ENEMY_GRAND_SUMMON_LEVEL`. `Ability.summon`, `charge`, `rebirth`; `Unit.calling`; the `calling` status. `noFalloff()` covers centred areas and grand summons; `summonVictims()` in the planner handles Cinderwing's heal-and-raise.
- `src/renderer/fx/summons/`: nine pixelfx effects and a shared helper library; each declares its `impact` time. `PixelEffects` gains an `overlay` mode (drawn over the board). `TacticsScene` gains `dim()`, `setCallMarkers()` and `summonView()` / `restoreView()`.
- The planner steers away from tiles a foe's grand summon will land on, values a grand summon at 70% (its targets can move), and won't use Cinderwing past the enemy raise cap. The balance sim charges and resolves grand summons like the game.
- Grand summon power is held under the same-level one-shot rule (Tidewyrm 1.25, Elder Wyrm 1.35).
- 14 new tests (222 total) in `tests/summons.test.ts`, including a draw-through of every effect. [ADR 0032](docs/adr/0032-summons.md).

## [0.23.0] - 2026-11-24

### Added — Master signatures
- **Mastering a job (job level 8) now brings its signature:** one action of the job's own, kept in every job like the mastery bonus. It shows in the ACT menu with a ★ and **ONCE**: free, usable once per battle, at +30 hit, and still usable under Silence. A unit that has mastered several jobs carries all their signatures.
- One for every job (18). A few of them:
  - **Valiant Charge** (Squire): a ×2.0 blow plus Breach.
  - **Shield Wall** (Knight): Protect for you and allies within 2 tiles.
  - **Meteor** (Black Mage): heavy fire over an area.
  - **Benediction** (White Mage): an area heal that also cleanses.
  - **Earthquake** (Geomancer): hits every foe within 3 tiles of you.
  - **Chrono Surge** (Time Weaver): Haste for every ally within 3 tiles.
  - **Final Fist** (Monk): a ×2.8 blow.
  - **Life Theft** (Thief): a heavy blow that heals you for half the damage.
  - **Doomsay** (Oracle): damage and Sleep over an area.
  - **Grand Finale** (Bard): heal and Haste for every ally within 3 tiles.
  - **Last Dance** (Dancer): damage and Slow to every foe within 2 tiles.
  The full table is in the job guide and the content reference.
- Team → Jobs names each job's signature next to its mastery bonus. The battle log announces it when a job is mastered.
- AUTO keeps a signature for a group or a target that matters, rather than spending it on a foe an ordinary blow would finish.

### Developer
- `src/data/signatures.ts`, `Ability.signature`, `Unit.usedSignatures` (cleared by `resetForBattle`). `JobSystem.signaturesOf`, `useSignature`; `findAbility` finds signatures.
- `Ability.centered` (an area around the caster that doesn't repeat) and `isCentered()`, which performances now share.
- 10 new tests (208 total) in `tests/signatures.test.ts`. [ADR 0031](docs/adr/0031-master-signatures.md).

## [0.22.0] - 2026-11-23

### Added — two performers (18 jobs, 105 abilities)
- **Bard** (needs Archer Lv 2 and White Mage Lv 2), with a feathered hat and a lute:
  - **Battle Hymn**: Focus for you and allies within 2 tiles.
  - **Mending Air**: heals you and allies within 2 tiles.
  - **Quickening Ballad**: Haste for you and allies within 2 tiles.
  - **Discord**: dark damage and Silence, up to 4 tiles away.
  - **Healing Refrain** (reaction): a blow may bring Regen.
  - **Resonance** (support): songs and dances reach a tile further.
- **Dancer** (needs Thief Lv 2 and Monk Lv 2), in silks with a veil and paired blades:
  - **Blade Waltz**: a free cut on every foe within 2 tiles.
  - **Veil of Silks**: Blinds foes within 2 tiles.
  - **Leaden Reel**: Slows foes within 2 tiles.
  - **Feint**: damage and Breach.
  - **Captivate** (reaction): a melee attacker may fall asleep.
  - **Encore** (support): songs and dances last two more turns.
- Mastery: Bard +8 / +20 MP, Dancer +1 / +2 Speed. Both turn up in the Trials as Minstrels and Bladedancers.

### Added — performances
- **A song or a dance plays again by itself** at the start of the performer's next three turns, free, before they act. The unit card shows ♪ and the encores left.
- It ends if the performer moves, does anything else, is put to sleep or silenced, or falls. Undoing the move brings it back.
- Choosing one highlights the area around the performer; any tile in it confirms.
- Everyone in a performance takes its full effect (no splash reduction).
- Enemy performers keep playing rather than wander off, unless something clearly better turns up.

### Fixed
- Changing to a job (or gear) with less HP or MP could leave a unit above its new maximum.

### Developer
- `src/core/Performance.ts` (`startPerformance`, `endPerformance`, `encoreDue`, `performedBy`, `encoreTurns`); `Ability.performance`, `Unit.performing` and the `encore` status. The battle screen plays an encore through `performAction(..., { encore: true })`, which spends no MP and earns no JP.
- The planner aims performances at the performer's tile, values them ×1.4, and weighs what moving or switching would throw away.
- Sprites and portraits for both jobs, and a lute.
- 16 new tests (198 total) in `tests/performers.test.ts`. [ADR 0030](docs/adr/0030-bard-dancer-performances.md).

## [0.21.0] - 2026-11-23

### Added — on the road
- **Wenna the Pedlar, a travelling merchant.** Once the first battle is won she sets up beside a won battlefield or a side-battle camp (🎒 on the map), and moves on after every win. She sells two things:
  - one piece the market won't stock until after the next chapter, early, for a quarter more;
  - one of her own goods, which nobody else sells: **Lucky Coin** (Evasion +10, no Blind), **Wayfarer Boots** (Move +1, Speed +1) and the **Starsteel Pike** (ATK +12, Jump +1, reach 2).
  A ware you buy stays on her blanket marked Sold until she moves on, so she never turns into a second market.
- **Camp scenes.** After each story battle the squad makes camp, and the map offers **Sit by the fire**: a short talk around the fire (six in all), once per playthrough, worth 30 JP to everyone. New Game+ tells them again.
- **Side-battle trophies.** The first win at each side-battle place brings gear found nowhere else, and it can't be sold:
  - Thornwood Ford: **Fordwarden's Bow** (ATK +8, Speed +1, Evasion +5, range 5).
  - Drowned Shrine: **Chanting Censer** (MAG +4, MP +20, no Silence).
  - Watchfire Ridge: **Watchfire Helm** (HP +40, no Sleep or Blind).
  The side-battle panel shows the trophy until it's won. A save that already won there gets it on loading.
- 6 new items (60 in all).

### Fixed
- A hand-edited save could pass `__proto__` off as a won chapter.

### Developer
- `src/core/Merchant.ts`: the merchant's place and wares are worked out from won chapters, side-battle wins, the shop shelf and the armory, so she needs no save data except what was bought on her current visit (`merchantSales`). Her stride across the stops shares no factor with their number, so she visits every one.
- `src/data/camp.ts` (`CAMP_SCENES`, `pendingCamp`, `sanitizeCampSeen`); saves keep `campSeen`. Scenes play in the ordinary dialogue box over the world map, with the map inert behind it; Enter / A advance it.
- `SkirmishDef.trophy`, `missingTrophies()`; trophies join `UNIQUE_ITEMS`. `MERCHANT_ITEMS` are kept off the market's shelves. `itemStatText()` is shared by the shop and the merchant.
- The content reference lists the merchant, the trophies and the camp scenes.
- 16 new tests (182 total) in `tests/world-events.test.ts`. [ADR 0029](docs/adr/0029-world-map-events.md).

## [0.20.0] - 2026-11-23

### Changed — smarter foes
- **Enemies walk the real path.** A unit with nothing in reach now heads for a foe it can actually get to, along the route its Jump allows, instead of marching at the foot of a cliff toward a foe on top of it.
- **They face you.** Every enemy ends its turn facing the closest foe, so a flank or back attack has to be earned.
- **They respect Weapon Guard.** A knight that parries is attacked from the side or back when possible.
- **They drop your healers first.** Given a choice, enemies aim at units that can still heal, raise or buff others.
- **Knights cast Bulwark on the way in**, rather than standing still to do it.
- AUTO uses the same planner, so your units do all of this too.

### Changed — Chapter III
- **Awakening at the Summit is easier.** The Grand Chronomancer and the Shadow Assassin no longer guard the Zodiac Champion, and the remaining escorts are a level lower. Even before this release's AI changes, the fight was out of reach in the balance simulation at every squad level and difficulty; it now plays like the middle of a two-act story, not its end.

### Added
- **Menu → Text size:** Normal, Large or Larger. Menus, panels, the log and the title screen all scale; the choice is saved on the device.

### Fixed
- Unit HP bars showed through open menus and panels; they now sit beneath them.
- On phones in portrait, the STATUS button's label overflowed its button.

### Developer
- `walkingDistances()` and `isSupportCaster()` in `src/core/EnemyAI.ts`; parry, support-target and self-buff approach terms in the planner. [docs/ENEMY_AI.md](docs/ENEMY_AI.md) has the new terms and limits.
- `src/ui/TextSize.ts`; every UI font size of 22px or less in `style.css` (and the job and gear lists) is `calc(Npx * var(--ts))`.
- 10 new tests (166 total) in `tests/ai.test.ts`. [ADR 0028](docs/adr/0028-smarter-foes-and-text-size.md) records the balance experiments behind the Chapter III change.

## [0.19.0] - 2026-11-23

### Added — the Chemist (16 jobs, 93 abilities)
- **A new job, open once a unit reaches Squire Lv 2:** a field medic and bomb-maker in a cap and brass goggles.
  - **Salve:** heals an ally up to 3 tiles away, from ATK, for no MP.
  - **Purge:** lifts every ailment from an ally up to 3 tiles away.
  - **Acid Flask:** light damage and Breach (+25% physical damage taken), thrown up to 3 tiles.
  - **Smoke Bomb:** Blinds every foe within 1 tile of the target.
  - **Field Dressing** (reaction): when a blow leaves you under half HP, recover 15% of max HP.
  - **Pharmacology** (support): items you use work 50% better (heal, MP, damage and revives) and reach a tile further. Any job can equip it once learned.
- Mastery: +8 HP at Chemist Lv 5, +20 at Master. Enemy Chemists appear in the Trials.

### Added — two supplies (8 in all)
- **Frost Flask** (160 G, after Chapter II): 45 ice damage and Slow on the target and every foe beside it.
- **Elixir** (600 G, after Chapter III): restores every point of HP and MP.

### Added — install it, play offline
- **The web version is an installable app.** Browsers that support it show **Install app** in the Menu (Android Chrome, desktop Chrome and Edge); on an iPhone or iPad use Safari's Share → Add to Home Screen. It opens full screen with its own icon.
- **It plays offline** once it has loaded once: the whole game is cached on the device. A new version downloads in the background and is used from the next launch.
- Inside itch.io nothing changes (itch's page can't install apps).

### Changed
- The item menu and forecast show the boosted reach and amounts when Pharmacology is equipped; the forecast shows the ailment a flask adds ("-45 HP + SLOW") and "FULL HP & MP" for an Elixir.
- **The roadmap is rewritten** for where the game is now: the next step is playing it by hand on real devices; then AI that handles high ground and facing, world map events, recruiting and mastery abilities.

### Developer
- `chemist` in `src/data/jobs.ts`, with art in `CharacterArt.ts` (cap and goggles, front, side and portrait), starting gear, a veteran reaction for enemy Chemists, and a mastery entry. `JobSystem.itemPotency(unit)`.
- Consumables can carry an ailment (`inflicts`), applied by `CombatEngine.useItem` to foes that survive.
- `public/manifest.webmanifest`, icons in `public/icons/` (drawn from the game's own sprite), and `scripts/sw-plugin.ts`, a Vite plugin that writes `dist/sw.js` with this build's files and a per-version cache. `platform.setupInstall` registers it on https outside itch. `npm run test:build` now checks the worker's file list and the manifest's icons.
- 8 new tests (156 total) in `tests/chemist.test.ts`; two supply tests updated. [ADR 0027](docs/adr/0027-chemist-and-installable-app.md).

## [0.18.0] - 2026-11-23

### Added — difficulty
- **Easy, Normal and Hard.** New Game now asks which; the Menu's **Difficulty** button changes it at any time, from the next battle. It's stored with each save.
  - **Easy:** enemies a level lower, bosses with 30% less HP, and no enemy ever raises a fallen ally.
  - **Normal:** the game as tuned (one enemy raise per battle).
  - **Hard:** enemies a level higher, bosses with 15% more HP, and up to two enemy raises per battle.
- It applies to story battles, side battles and the Trials. Workshop scenarios keep the levels their author chose.

### Added — save slots
- **Three save slots.** Menu → **Save game** and **Load game** open a slot screen showing where each save stands (chapter, squad levels, gil, difficulty, date). Saving over a different save and deleting a slot both ask first.
- **Continue** on the title screen loads the most recent save; **Load Game** appears once there is more than one.
- **New Game** uses the first empty slot, or asks which one to replace if all three are full. It no longer overwrites your only save at the first autosave.
- **Export and import.** Any slot can be exported as text (Copy) or a `.json` file (Download), and imported again from Load game → *Import a save…*, by pasting or choosing the file. Use it to back up a save or move it to another browser or device.
- **Your existing save is slot 1.** Nothing to do.

### Changed
- **A lost battle gives back the supplies used in it**, whether you retry or fall back to the map. (Before, a retry kept them spent and loading a save restored them.) EXP and JP earned are still kept.
- **The Gate of Trials opens once Chapter III is won**, instead of after the whole story. New Game+ still waits for the end.
- Result screens (defeat, spoils, saves) now hide the dialogue box behind them, which could cover their buttons when opened during a conversation.

### Developer
- `src/core/Difficulty.ts` (`DIFFICULTIES`, `enemyLevel`, `scaleBoss`). The enemy raise cap now comes from the difficulty (`ENEMY_RAISE_CAP` is Normal's, used by Workshop battles).
- `SaveManager`: every call takes a slot (1–3; slot 1 keeps the old storage key), plus `slotsInUse`, `latestSlot`, `firstEmptySlot`, `exportSave`, `writeSlot` and `parseImport`. An import is treated as untrusted: units are rebuilt from scratch with known jobs, abilities and items only, names are reduced to plain text, numbers are clamped, prototype keys are refused, and files over 512 KB are rejected.
- `DIFFICULTY=easy|normal|hard npm run balance`.
- 10 new tests (148 total) in `tests/slots-difficulty.test.ts`. [ADR 0026](docs/adr/0026-difficulty-and-save-slots.md).

## [0.17.0] - 2026-11-23

### Added — Act II: three new chapters
- **The story no longer ends at the Summit.** Winning Chapter III now leads on to a second act, and a playthrough is six battles instead of three.
- **Chapter IV, Fire on the Water** (Emberwick Harbor): corsairs are looting the port. The sea is too deep to wade, so the fight runs along three piers and a cross-pier to their moored ship. Boss: Captain Varrow.
- **Chapter V, The Greywatch Light** (Greywatch Isle): a climb from a landing beach up terraces to a lighthouse, with slow tidal shallows on both flanks. Boss: Tidecaller Maelis.
- **Final Chapter, The Drowned Regent** (Stormbreak Cape): cliffs stepping up to a sea altar, split by a chasm with one rope bridge. Boss: the Drowned Regent, a Paladin.
- **A third recruit:** Sable, a Thief, joins at the start of Chapter IV, so the squad is six strong.
- **Six pieces of gear** come with the new chapters: Moonfang, the Oathkeeper shield, a Warding Amulet, the Runeblade, Templar Mail and the Dawnbringer blade, as road and victory rewards.
- **Three new places on the world map** (the harbor in the south-west, the isle off the north-west, the cape on the northern point), each with its own icon, and three new battlefields in the Menu's battlefield list and the Workshop.

### Changed
- **The old finale is now Chapter III.** The epilogue, the Gate of Trials and "campaign cleared" move to the end of Chapter VI. **If you had already finished the story, you keep the Trials**, and Chapter IV is waiting on the map.
- **Enemies can raise one fallen ally per battle**, not as many as their healer has MP for. AUTO for your own units isn't limited.
- The two side battles that open after Chapter II also open for older saves that don't record which road was taken.
- Everything is on sale at the market once Chapter III is won, as before.

### Developer
- `chapter_4` to `chapter_6` in `src/data/campaign.ts`; `createHarborMap`, `createGreywatchMap`, `createCapeMap` in `src/data/maps.ts`. The story's shape is still data: Chapter III gained a single `choices` entry, and "a won chapter with no choices is the finale" picks up the new ending without code changes.
- `World.FIRST_ACT_FINALE`: a pre-0.15 save that says "campaign cleared" with no list of won chapters is placed at the Summit with Chapter IV ahead.
- `EnemyAI.ENEMY_RAISE_CAP` and `planTurn(..., { noRevive })`.
- `npm run balance` covers the new chapters (at higher squad levels, with Sable) and resolves revives properly.
- 4 new tests (138 total): the story runs from the Summit to a single finale, finished saves find Chapter IV, every enemy on the new battlefields can be reached from the deployment tiles, and difficulty rises chapter by chapter. [ADR 0025](docs/adr/0025-act-two.md).

## [0.16.0] - 2026-11-23

### Added — side battles
- **Three optional battles on the world map**, marked ⚑: **Thornwood Ford** (bandits, opens after Chapter I), **Drowned Shrine** (cultists) and **Watchfire Ridge** (hold out for 6 rounds); the last two open after Chapter II, whichever road you took.
- **They can be fought again and again.** Each pays enemy bounties, a gil bonus (160 the first time, 80 after), and the usual EXP and JP, so there is somewhere to train when a story battle is too hard.
- **Enemies match your squad's level** and come back one level stronger after each win, up to two levels. From the third visit there are five of them instead of four.
- Winning offers **World Map** or **Fight again**. They never move the story on, and they stay open after it ends.

### Added — job mastery
- **Job levels 5 and 8 now give a permanent bonus.** At job level 5 (Veteran) a unit earns a small stat bonus from that job, and at level 8 (Master) a larger one that replaces it. The unit keeps it in every job.
- Each job gives one stat: Squire, Knight and Paladin HP; Archer and Monk ATK; Black Mage, Summoner and Spellblade MAG; White Mage, Geomancer and Oracle MP; Ninja and Thief Evasion; Dragoon Jump; Time Weaver Speed. Bonuses from different jobs add up.
- **Team → Jobs** shows each job's two bonuses and ticks the ones earned. Earning one is announced in battle and on the spoils screen.

### Added — Raise
- **White Mages learn Raise** (260 JP, 18 MP, reach 3): a fallen ally stands up with a third of their HP. Like a Phoenix Feather it always works; unlike one it costs MP, not gil.
- **AUTO and enemy healers use it too**, so a White Mage is now worth taking down first.
- **Bosses can't be raised**, by spell or by feather.

### Added — comfort
- **Undo move.** After a unit moves and before it acts, the MOVE button reads **UNDO** (key 1) and puts it back where it stood.
- **Battle speed** in the Menu: Normal or Fast. Fast halves the pauses between actions and doubles walking speed. The choice is remembered on the device.
- **First-battle tips.** A short tip appears the first time each thing comes up: your first turn, moving, the action menu, targeting, the forecast, facing, items, a fallen ally, and the world map. Tips never block input, go away on their own, and can be turned off with **Skip tips**. **Controls → Show tips again** brings them back. They don't appear in the Trials or the Workshop.

### Changed
- The Gate of Trials moved slightly on the world map to make room, and place names no longer run off the map's edge on phones in landscape.
- The Menu scrolls when it is taller than the screen (phones in landscape).
- 87 abilities (was 86).

### Developer
- `src/core/Skirmish.ts` (`SKIRMISHES`, `buildSkirmish`, `skirmishLevel`, `skirmishBonus`, `skirmishOpen`): a side battle is generated like a Trials floor and played in a new battle mode, `skirmish`. Saves gained `skirmishWins`; a save made during a side battle resumes on the map beside it.
- `JobSystem.JOB_MASTERY`, `masteryTier`, `masteryBonus`; `gainJp` reports `mastery` when a tier is reached. Mastery is derived from lifetime JP, so old saves get what they have already earned.
- Any ability with `revive` is resolved by `CombatEngine` without a roll; `unitsInBlast` and the planner aim revives at the fallen.
- `src/ui/Tutorial.ts`; `TacticsScene.walkSpeed` and `cancelWalk`.
- The generated content reference gained job mastery and side-battle tables.
- 15 new tests (134 total) in `tests/side-mastery.test.ts`. [ADR 0024](docs/adr/0024-side-battles-mastery-and-onboarding.md).

## [0.15.0] - 2026-11-23

### Added — items in battle
- **ITEM command** (key **5** or **I**). Six supplies, shared by the squad and used up one at a time: **Potion** (80 HP), **Hi-Potion** (200 HP), **Ether** (40 MP), **Remedy** (cures every ailment), **Phoenix Feather** (raises a fallen ally at a quarter HP) and **Blast Flask** (70 fire damage to a target and every foe beside it, thrown up to 3 tiles). Using one is your action for the turn.
- **Items never miss** and do a fixed amount in anyone's hands. They ignore facing, don't crit and draw no reaction. The forecast says what the item will do.
- **Fallen allies can be raised.** A marker with the unit's name stays over the tile where an ally fell, so you can see where to use a Phoenix Feather. Nobody else can be standing there.
- A new squad carries 3 Potions and a Phoenix Feather. You can hold 9 of each.

### Added — the world map
- **Between missions the squad stands on a world map** of the realm: Larkmoor Market, the four battlefields, and the Gate of Trials, joined by roads. Select a place to walk there, then act on it from the panel.
- **The story branch is now a march.** After Chapter I both roads lie open; the panel shows each one's orders and the gear it brings. Marching down one closes the other.
- **Defeat no longer traps you in a battle.** The defeat screen offers **World Map**: restock, change jobs and march again when ready. The battle waits for you.
- **The Trials are entered from the map**, and after each floor you can go on or step back out to the market.
- The game saves whenever you reach the map, and **Continue** puts you back on it where you stood. Team, Save and the Menu (sound, graphics, load, Workshop, title screen) are in the map's top bar.
- Works with mouse, touch, pen, keyboard and controller, on phones in both orientations.

### Added — buying and selling
- **The shop is now Larkmoor Market**, a place on the world map, with **BUY** and **SELL** counters. In battle the Shop tab still lists everything, but you can only trade at the market.
- **Supplies** are sold alongside gear. Potions, Remedies and Phoenix Feathers are always stocked; Hi-Potions, Ethers and Blast Flasks arrive after the first victory.
- **Sell** spare gear and supplies for half price. Gear someone is wearing has to come off first, and the three relics are never sold.
- New stock now arrives the moment a chapter is won, so it's on the shelves when you first walk in.

### Fixed
- **Haste played away from the unit.** The effect's streaks spread several tiles wide and read as happening somewhere else. Haste now has its own effect that hugs the unit: flickering after-images, rising streaks at its sides and a ring at its feet. **Focus** had the same problem and now uses an on-unit effect too.
- Long lists in the action menu (many abilities or items) squashed their rows so descriptions spilled into the next row. Rows keep their height and the list scrolls.
- The action menu closes when a battle ends.
- Banners now show above menus and the map instead of behind them.

### Changed
- The choice screen after Chapter I and II is replaced by the world map.
- The epilogue offers **World Map** first; **Next Trial** is joined by **World Map** in place of the save-and-continue button (reaching the map saves).
- Old saves load as before, straight into their battle, with the starting supplies added. The chapters already behind them show as won on the map.

### Developer
- `src/data/consumables.ts` (`CONSUMABLES`, `consumableAbility`, `sanitizeInventory`, `consumableStock`): an item is turned into an `Ability` with `item`, `fixedHeal`, `fixedMp`, `fixedDamage`, `revive` or `cleanse`, and resolved by `CombatEngine.useItem` through the usual forecast and execute calls.
- `src/core/World.ts` holds the map's rules with no DOM (`openMissions`, `nodeState`, `route`, `sanitizeCleared`); `src/ui/WorldMap.ts` draws it. The island is painted in code onto a 320×180 canvas: still no image files.
- `Economy.gearSaleBlock`; `shopProgress` takes a fourth argument (the current chapter is won). Saves gained `inventory`, `clearedChapters`, `onWorldMap` and `worldLocation`.
- `src/renderer/fx/quicken.js`: the game's own Haste effect, written against the vendored pixelfx core.
- The generated content reference gained supplies and world-map tables.
- 24 new tests (119 total) in `tests/items-world.test.ts`. [ADR 0023](docs/adr/0023-items-world-map-and-market.md).

## [0.14.0] - 2026-11-23

### Added — the job tree
- **Jobs level up.** Every job has a level from 1 to 8 (Master), earned from the lifetime JP a unit gains in it. Spending JP never lowers it. Level-ups show in the battle log, over the unit, and on the spoils screen.
- **Advanced jobs must be unlocked.** The Team screen now lists every job with its level and a progress bar; locked jobs show what they need ("Needs Knight Lv 2 (now Lv 1)"). Squire, Black Mage, White Mage and Geomancer are open to everyone, and every unit starts at Squire Lv 2, which opens Knight and Archer. A job level takes about one battle, so a new job opens up roughly every fight.
- **Two advanced jobs** (15 in all), each needing two other jobs:
  - **Paladin** (Knight Lv 3 + White Mage Lv 2): *Holy Blade* (holy damage from ATK that Protect and facing don't change), *Lay on Hands* (a heal from ATK), *Rebuke* (ranged Silence), *Aegis* (area Shell); reaction *Divine Grace*; support *Zeal* (+20% holy damage and healing).
  - **Spellblade** (Knight Lv 2 + Black Mage Lv 2): *Flame Edge*, *Frost Edge* (Slow) and *Thunder Lunge* (reach 2), elemental strikes that hit with weapon strength; reaction *Runic* (MP back when struck by a spell); support *Arcane Edge* (Attack gains damage from MAG).
- New gear: **Runeblade** and the **Oathkeeper** shield (guards against Sleep and Blind). 86 abilities and 54 items in all.

### Added — gil and the shop
- **Gil.** Defeated enemies pay a bounty (more for higher levels, triple for bosses), and each win adds a bonus. A new game starts with 300 gil. Stealing gear you already own now fences it for half its price.
- **Shop** tab in Team: buy gear for the armory, which the whole squad shares. Stock grows after each chapter; everything but three relics is on sale once the campaign is cleared or in the Trials. Your purse shows in the Team header and on the spoils screen, and is saved.

### Added — battlefield readability
- **Status pips over units:** every active status shows above the unit's HP bar, round for buffs and square for ailments, in the same colours as the unit card's badges.

### Fixed
- **Overhead HP bars were nearly invisible:** the green HP fill was clipped to a 1px sliver. The bar is now tall enough to show HP and the CT line.
- **New Game** from the title screen now starts with a fresh squad, armory and purse even after a save was loaded.
- The secondary-skillset slot only cycles through other jobs where the unit has learned an action, instead of every job.

### Changed
- Team tabs are shorter on phones (Jobs / Gear / Shop), so the header stays on one line.
- Old saves are brought up to date on load: job levels are rebuilt from the JP each unit holds and has spent, the jobs and secondary skillsets in use stay unlocked, and the purse starts at 300 gil.

### Developer
- `JobSystem.jobLevel`, `jobLevelProgress`, `missingPrerequisites`, `canChangeJob`, `grantPrerequisites`, `gainJp`; `Unit.jobJpEarned`. `src/core/Economy.ts` (bounties, shop tiers, resale). Abilities with `scalesWith: 'attack'` and positive power use the weapon damage scale.
- The generated content reference gained job-level, requirement and shop tables.
- 21 new tests (95 total) in `tests/progression.test.ts`.

---

## [0.13.0] - 2026-11-23

### Added — new jobs, abilities and gear
- **Four new jobs** (13 in all), each with its own sprite, portrait, signature gear and veteran-enemy kit:
  - **Monk** (Brawler): *Aura Wave* (chi blast, range 3), *Chakra* (free area heal from ATK that also cleanses), *Pummel*; reaction *Iron Will* (Focus and Protect the first time you drop to half HP); support *Brawler* (+30% unarmed or knuckle Attacks); movement *Ki Flow* (walking restores HP and MP).
  - **Thief** (Rogue): *Steal* (lifts a piece of the target's gear into your armory; harder head-on and against bosses), *Sand Toss* (Blind), *Hamstring* (Slow); reaction *Quick Hands* (40% Haste when struck); support *Backstab* (extra flank and back damage); movement *Fleet Foot* (Move +1, Jump +1).
  - **Summoner**: radius-2 spirits: *Salamander* (fire), *Undine* (ice), *Storm Roc* (lightning), *Sylph* (area heal + Regen), *Golem* (area Protect); reaction *Mana Spring* (MP back when struck); support *Conserve* (half MP costs).
  - **Oracle** (Hexer): *Dim Sight* (Blind), *Hush* (Silence), *Lullaby* (area Sleep), *Soul Drain* (dark damage that heals you); reaction *Hex Ward* (may Blind the attacker); support *Hex Mastery* (ailments land 20% more often).
- **New actions for older jobs:** Squire *Rally* (Focus for you and neighbours), Knight *Bulwark* (self Protect), Archer *Arrow Rain* (area volley), Black Mage *Firestorm* (radius 2), White Mage *Shell*, *Purify* and *Healing Circle*, Ninja *Smoke Bomb* (area Blind), Time Weaver *Regen*. 75 abilities in all (was 41).
- **Six new statuses:** Shell (−30% spell damage), Regen (8% HP a turn), Blind (−40 physical accuracy), Silence (MP abilities sealed), Sleep (turns pass until struck; sleepers can't dodge), Breach (+25% physical damage taken).
- **25 new pieces of gear** (52 in all), including a new weapon type (knuckles), elemental rods, and gear with **traits**: start every battle with Regen, Shell or Protect; +25% to an element (Flame/Frost/Storm Rod, Dawnbringer for holy); or guard against ailments (Circlet of Clarity, Purity Bangle; the Zodiac Ribbon now wards off them all). Gear lists now show negative stats correctly.
- The new jobs join the Trials of the Zodiac roster; Chapter I's Bridge Cutthroat is now a Thief and Chapter II-B's gate has a Monk. Flame Rod, Verdant Charm and Mirror Shield are new chapter rewards; the rest drop in the Trials, or steal them.
- Stolen gear is listed on the spoils screen.

### Changed
- **Rend Armor** now does what it says: it inflicts Breach. **Equip Heavy Armor** (a no-op) is now **Armor Mastery**: +50% HP from armor, helms and shields.
- The enemy AI weighs the new kit: it cleanses, drains when hurt, avoids casting ailments a target's gear guards against, only raises Protect/Shell/Focus when a foe is near, and never tries to Steal.
- Old saves get 200 JP banked in each new job and the new starter gear in their armory.

### Developer
- Ability flags `cleanse`, `drain`, `steal`, `scalesWith`; item `traits` (`startStatus`, `boost`, `guard`). `JobSystem.equipVeteranPassives`, `applyGearStatuses`, `mpCostFor`, `ensureJobPoints`; `TurnManager.startOfTurn` / `tickStatuses` and `skipped` turns. The balance sim shares the game's veteran passives.
- 12 more pixelfx effects vendored (sleep, curse, stars, rune circle, hex sigil, healing bloom, soul drain, sunburst, collect burst, fire tornado, wave crash, blunt hit).
- 30 new tests (74 total) in `tests/jobs-gear.test.ts`.

---

## [0.12.0] - 2026-11-20

### Added — ready for itch.io
- **Title screen** over the live battlefield: New Game, Continue (when there's a save), Workshop, Controls and Fullscreen, with the version and links to support the game, the source and jeremyanderson.tech. Works with mouse, touch, keyboard and controller. The first press is what lets browsers play the music, and it gives an embedded game keyboard focus. *Quit to title* is in Menu.
- **Fullscreen**: a button on the title screen and in Menu, and the **F** key (shown only where the browser allows it; on itch.io that's the embed's fullscreen option).
- **Support the game ♥** link in Menu and on the title screen (opens the itch.io page in a new tab).
- `npm run build:itch` → `release/chess-rpg-tactics-<version>-html5.zip`, with `index.html` at the root. It first checks that every path is relative, that nothing is loaded from another site, and that it's within itch's file limits. 318 KB zipped.
- CI builds the itch zip on every push (artifact *itch-html5*) and, once the `BUTLER_API_KEY` repository secret is set, publishes `main` to itch.io with butler.
- `docs/ITCH_PAGE.md`: the store page's settings, description and tags; `docs/itch/`: cover and screenshots.

### Changed
- **Fonts are bundled** (Press Start 2P and VT323 via Fontsource, latin subset, OFL) instead of loaded from Google Fonts: no third-party requests, and they work offline and in the itch app.
- Inside an iframe, arrow keys, Space, Page Up/Down, Home and End no longer scroll the page around the game, and clicking the game gives it keyboard focus.
- Workshop share links made inside an embed point at the web version, which can open them (itch's page can't pass a link into the game).
- The page title is now "Chess RPG Tactics" with a description for search and link previews.

---

## [0.11.0] - 2026-11-20

### Added — pixel-art battle effects
- Every hit, spell, heal and status now plays a **hand-animated pixel-art effect** from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT), drawn at the same pixel size as the 48px units so effects and characters read as one picture. They replace the old particle bursts.
  - Weapon blows: a sword arc (dagger flurry for ninjas) that sweeps across the target, then a hit spark; critical hits burst.
  - Spells by element: fire pillar, falling icicle, lightning strike (the scene darkens under a sigil), holy smite, grasping shadow hands, a time-stop clock.
  - Geomancy by terrain: Rockslide raises an earth spike, Sandstorm shakes the ground, Hell Ivy snares the target in roots, Quicksand poisons.
  - Heals, Haste, Slow, Protect, Poison and boss enrage **wrap the unit's own sprite**: a heal greys the target and restores *its* colours, poison turns *it* green, Haste trails *its* after-images. (pixelfx effects are written around a stand-in character; the game passes each unit's real sprite instead.)
  - Level-ups throw a burst of feathers.
- Effects step at 30 fps like hand-drawn animation, glow additively (bloom picks them up on High), and skip into their wind-ups so the impact lands with the damage number.

### Changed
- **Units walk their path** tile by tile, turning to face each step and hopping up and down ledges, instead of sliding straight to the destination. Enemies finish walking before they act.
- **Workshop brush strokes:** drag across the map to sculpt or paint with raise, lower, level, paint or block. A stroke touches each tile once and is one undo step. Pan with two fingers, the right mouse button, WASD or the camera buttons, or switch "Drag on the map" to *Pans*.
- **Chapter II-B (Night Battlement) rebalanced.** The 0.10 fortress made it close to unwinnable on AUTO; the snipers now hold the wall walk by the gate (reachable by stairs) and every defender is level 3. In headless AUTO battles the branch is back to roughly its 0.9 difficulty, between Chapter I and II-A.

### Developer
- `npm run balance`: headless AUTO-vs-AI battles with the game's own rules, printing each chapter's win rate at several levels (`scripts/balance-sim.ts`).
- `BattleGrid.findPath()` (shares its Dijkstra with `getReachableTiles`); 3 new tests (44 total).
- Input suite: Workshop brush strokes by mouse and touch, one-step undo, and panning without painting (63 checks).

### Credits
- Pixel effects: pixelfx © 2026 Patch and Hugo Duprez, MIT; parts adapt Sprite Fusion's open-source VFX (Hugo Duprez, MIT). Vendored unchanged in `src/vendor/pixelfx` with its licence and notices.

---

## [0.10.0] - 2026-11-19

### Added — bigger battlefields
- **All four maps are now 16×16** (2.1× the area of 11×11), redesigned around the extra room: Riverside Ruins has a winding river with two bridges and a ford below a hilltop temple; Night Battlement adds a moat, drawbridge, curtain wall and keep; Gloomy Mire is islands joined by boardwalks; the Zodiac Summit climbs five terraces past twin pools.
- **Per-map deploy zones**: each map says where your squad starts (`playerSpawns`).
- Each campaign chapter gained one enemy (one level below the chapter) and every enemy was re-placed for the new terrain. A test checks every campaign and Trials enemy can be reached on foot.
- The camera, zoom and fog fit the map's size; Trials spawn enemies in the northern quarter of any map.

### Added — the Workshop (map & scenario editor)
Replaces the old map editor (Menu → **Workshop**).
- **Terrain**: raise, lower, level to a height, paint, block, flood fill; 1×1 / 3×3 / 5×5 brushes; undo and redo (Ctrl+Z / Ctrl+Y).
- **Units**: up to 6 squad deploy tiles and 16 enemies with name, job, level, facing and a boss flag. Enemies appear as real sprites while you edit.
- **Story**: title, subtitle, author, and the dialogue before the battle and after victory, with drawn portraits.
- **Rules**: three objectives (rout all, defeat the boss, survive N rounds), the look (daylight, night, swamp, summit) and up to six reward items.
- **File**: a library that saves as you work, new blank battlefields (8–24 tiles a side), copy any campaign map or remix any chapter, export/import `.json`, and **share links** (`#s=…`, compressed) that open the scenario in anyone's Workshop.
- A **check** lists what blocks play (no deploy tiles, enemies on blocked tiles, a boss objective with no boss) and warns about enemies melee units can't walk to.
- **Play** runs the scenario with your current squad. Afterwards: play again, back to the Workshop, or return to the campaign. Workshop battles never overwrite your campaign save; opening the Workshop mid-battle and closing it puts you back exactly where you were.
- Works with mouse, touch, pen, keyboard and controller (B steps out to the map cursor, X jumps back into the panel); a side panel on desktop, a collapsible bottom sheet on phones.
- Imported files and links are rebuilt field by field: numbers clamped, ids checked as own properties, text kept as plain text.

### Added — character art
- **48×48 sprites** (were 32×32) with shading, outlines and per-job silhouettes, headgear and weapons, in front, back and side views.
- **Animation frames**: breathing idle, a two-step walk, a weapon strike and a flinch. Units now **walk between tiles** (with a hop over height changes) instead of teleporting.
- **Drawn 64×64 portraits** for Rowan, Maren, Tobin, Corvin and Bria and for every job (ally and enemy colours), in the dialogue box (which now puts right-side speakers on the right) and on the unit card. They replace the emoji portraits.

### Fixed
- The unit card and turn order showed placeholder text until the first turn started.

---

## [0.9.0] - 2026-11-19

### Changed
- **Original characters.** The starting squad's names came from Square's games (Ramza, Agrias, Mustadio, Kain); they are now **Rowan, Maren, Tobin and Corvin**. FFT's "Zodiac Stones" became **Zodiac Seals**, matching the Trials' "Seal of …" floors. Saves from earlier versions are renamed automatically on load.
- **MIT License** added (`LICENSE`, `package.json`), with third-party credits and a not-affiliated note in the README.

### Added — graphics upgrade
- **Lighting:** hemisphere sky/ground light, a warm key light and cool rim light per battlefield, ACES filmic tone mapping, soft PCF shadows fitted to each map.
- **Atmosphere:** painted gradient skies (stars at night), distance fog, and a distinct look per map: golden Riverside Ruins, moonlit Night Battlement, murky Gloomy Mire, violet Zodiac Summit.
- **Terrain shading:** bevelled tile edges, ambient occlusion down cliff sides, cliff textures that repeat instead of stretching, flowing water with sun glints, bubbling swamp, tinted wooden boardwalks.
- **Set dressing:** swaying grass, cattail reeds and pebbles (instanced, kept off the tile centers).
- **Units:** soft contact shadows under every unit and a pulsing gold (or red) ring under the unit whose turn it is.
- **Night lighting:** flickering torches with warm light pools on Night Battlement and an altar glow on the Zodiac Summit.
- **Effects:** bloom (spells, torches, water glints and highlights glow) and a gentle vignette on High.
- **Highlights:** glowing, pulsing move/attack/support tiles with bright rims; support abilities now show green tiles (they were blue).
- **Graphics setting** in Menu: Auto, High, Medium, Low (saved). Auto picks Medium on phones and High elsewhere, and steps down a tier if the frame rate stays under 40 fps.

### Performance
- Terrain is now merged into one mesh per material: **~760 draw calls per frame → ~37**, and hidden tile bottoms are no longer drawn. Tile picking works from the hit point on the merged mesh.

---

## [0.8.1] - 2026-11-19

### Documentation
- Rewrote the README (feature table, battle flow diagram, controls table, docs index, screenshots).
- New guides: **Gameplay Guide**, **Roadmap** (release timeline, Now / Next / Later, impact vs effort, known issues), **Enemy AI**, **Testing**, **Contributing** (recipes for jobs, abilities, maps, chapters, items, UI).
- **Content Reference** generated from the game data by `scripts/gen-docs.ts` (`npm run docs:gen`): every job, ability, status, item, map, chapter and the first 15 Trial floors, with a campaign diagram. CI runs `npm run docs:check` so it can't go stale.
- Architecture rewritten for the current code: module map, game state machine, turn sequence, action pipeline, input flow, data model, persistence and build diagrams.
- Job System corrected: the old progression tree listed jobs that don't exist (Chemist, Summoner, Warmage); it now shows the real prerequisites and notes they aren't enforced yet.
- Combat and Controls guides gained hit-resolution, gesture and controller diagrams; the docs hub routes players and developers and indexes ADRs by release.
- Screenshots in `docs/images/` (WebP).

### Fixed
- Chapter II-A's branch choice still said the final battle was at Night Battlement; it is at the Zodiac Summit.

---

## [0.8.0] - 2026-11-19

### Added
- **Every input works everywhere**: one dispatcher for mouse, keyboard, touch, pen and controller.
  - **Touch**: tap to select, drag to pan, pinch to zoom, two-finger twist to rotate, two-finger tap to cancel. Taps now select the tile under your finger (before, a tap used the last hovered tile).
  - **Pen**: hover previews tiles, tap selects, drag pans, eraser / barrel button cancels.
  - **Keyboard**: a tile cursor on the arrows, Enter to select, Esc to back out, `1`–`4` command hotkeys, `J`/`L`/`H` for Team/Log/Controls, and arrow-key navigation inside every menu. A whole turn can be played without a mouse.
  - **Controller** (`src/input/GamepadInput.ts`): standard mapping with d-pad/stick cursor and menu navigation, held-direction repeat, LB/RB rotate, analog-trigger zoom, right-stick pan, rumble on crits and boss enrage, and a connect banner.
  - **Mouse**: left-drag now pans too (trackpads without a right button), and trackpad pinch zooms smoothly.
- **Controls screen** listing all five input methods, with your current one first.
- **STATUS** button now opens that unit's jobs and gear (it did nothing before).
- Unit card portrait shows the unit's actual sprite.

### Changed
- **Responsive layout** for phones (portrait and landscape), tablets and desktops: bottom command bar and stacked unit card on phones, bottom sheets for actions/forecast/log, full-screen modals, a two-column Team screen on tablets, safe-area insets for notched phones, and 44px touch targets.
- The 11-button toolbar is now four buttons (Team, Log, Controls, Menu) plus a camera cluster; map, sound, save, load and editor moved into Menu. Emoji buttons are replaced with drawn pixel icons.
- Portrait screens fit the camera to the screen width, so phones see the whole battlefield.
- Hotkey hints and the dialogue "continue" hint match the input you're using.
- Visible gold focus rings, `Tab` trapped inside modals with focus restored on close, ARIA labels and dialog roles throughout.
- Reduced-motion: screen shake is cut to 15% and the turn banner fades instead of sliding.

### Fixed
- Desktop toolbar covered the turn order at 1920px; camera buttons collided with the command menu on 768px-tall laptops; the stat row wrapped ("HT: 1.0h" on two lines); an empty turn-order strip showed during intros.

---

## [0.7.0] - 2026-11-19

### Fixed
- **GitHub Pages deploy**: the 2026-11-18 deploy failed with *"No artifacts named github-pages were found"* because `deploy-pages` ran in the same job, milliseconds after the upload. Build and deploy are now separate jobs (GitHub's recommended layout) with one automatic retry; actions updated off the deprecated Node 20 runtime.
- **Out-of-range attacks**: clicking any unit opened the forecast, even across the map. Targeting now uses the same range/height rule as the red overlay.
- **Reactions that never fired**: Counter Tackle, Arcane Retaliation and Critical Quick were checked against ability ids that did not exist. Arcane Retaliation and Critical Quick are now learnable.
- **Gear did nothing**: weapon/gear ATK and MAG, job multipliers and evasion now affect damage and hit chance.
- **Area spells hit one unit**: Fire, Blizzard, Thunder and Dragon Breath now hit every foe within 1 tile (60% on the ring).
- **Enemy AI** could cast Haste/Protect on your units and never paid MP.
- **Squad reset every chapter**: levels, JP, abilities and gear now carry over.
- **Story rewards** ("Unlocked: Ring of Arcana!") were text only; they are now added to the armory.
- **EXP never levelled anyone up.**
- **Focus** permanently stacked +3 ATK; it is now a 4-turn +25% buff.
- Dragonheart could save a unit every hit; now once per battle.
- Defeat left a dead board; the campaign ended on a banner.
- Leftover sprites from the previous battle stayed on the map; stale turn order/unit card showed during intros.
- Camera toolbar covered the turn-order strip; tile info showed through dialogue; missing favicon (404).

### Added
- **Smarter enemy AI** (`src/core/EnemyAI.ts`): weighs every reachable tile, affordable ability and target; finishes wounded units, heals and buffs allies, uses area spells on clusters, prefers high ground.
- **AUTO command** (button or `T`): let the AI play the active unit's turn.
- **Geomancer job** and recruit **Bria** (joins in Chapter II): *Elemental* changes with the terrain underfoot (Hell Ivy, Rockslide, Sandstorm, Torrent, Quicksand, Wildfire), plus Earth Slash, Earthen Ward, Attack Boost, Mountain Stride.
- **Zodiac Summit**: new final-battle map (terraced shrine, starlit pools, obelisks, rope bridge).
- **Boss units** with nameplates, +60% HP and an **enrage** phase at half HP (Haste, +20% power).
- **Spoils of War screen**: per-unit EXP/JP/KOs, level-ups and new gear.
- **Armory**: the gear tab shows only owned items; 6 new items (Gaia Staff, Windslayer Bow, Zodiac Blade, Crystal Helm, Wyrmscale Mail, Zodiac Ribbon).
- **Defeat screen** with Retry Battle / Load Save. **Epilogue** with New Game+ (keeps your squad) or…
- **Trials of the Zodiac**: endless post-game floors, deterministic per floor, a Warden boss every 5th floor, a rare drop each clear, best floor recorded.
- **Terrain movement costs**: water and swamp cost 2 Move; Water Walk, Teleport and Regen Walk now work, as does JP Boost.
- Reaction / Support / Movement slots can be cycled through any learned passive; slots show names instead of ids.
- Autosave at the start of each chapter and after each Trial.
- **Tests**: 28 Vitest unit tests (`npm test`) for combat, reactions, AI, pathfinding, data integrity and Trials, run in CI.

### Changed
- Damage rebalanced: base HP 120 + 18/level; physical `ATK × Power × 5`; magic `MAG × Power × 3`; facing/height bonuses are physical-only.
- Save format 0.7.0 (stores armory, mode and Trials floor). 0.6.x saves still load.

---

## [0.5.1] - 2026-11-18

### Optimized
- **Procedural Canvas Texture Caching (`src/graphics/PixelTextures.ts`)**:
  - Implemented `unitSpriteTextureCache` to memoize 32x32 character sprite textures across all 64 job/facing/faction permutations, eliminating recurring canvas rasterization and GPU VRAM re-uploads.
- **Three.js Material & Geometry Pooling (`src/renderer/TacticsScene.ts`)**:
  - Consolidated 240+ duplicate `MeshLambertMaterial` instances into shared static material singletons for stone, parapet, swamp, water, dirt, and grass.
  - Reused `sharedHighlightGeom` and static blue/red highlight materials across tactical range overlays without per-turn allocation or disposal.
  - Reused `tempScreenPos` across 3D floating damage text and overhead HP bar projections.
- **Raycasting Performance**:
  - Replaced per-mouse-move `Array.from(tileMeshes.values())` heap allocations with a pre-cached `tileMeshList` updated only on map mutations.
- **60 FPS Decoupled Animation Loop**:
  - Moved character sprite idle breathing bob, attack lunges, damage recoils, and overhead HP bar tracking into `TacticsScene.render()`.
  - Units now interpolate smoothly at a full 60 FPS instead of ticking only on discrete state events.
- **Monotonic BFS Pathfinding (`src/core/Grid.ts`)**:
  - Removed redundant $O(N \log N)$ `queue.sort` in `getReachableTiles()`, leveraging natural FIFO queue monotonicity in unweighted $1$-cost movement graphs.
- **DOM Paint Throttling (`src/main.ts`)**:
  - Added `lastHoveredKey` guard in `gameLoop()`, eliminating 60 layout writes per second when cursor hovers over a stationary tile.
- **Rollup Code Splitting (`vite.config.ts`)**:
  - Isolated Three.js into a dedicated vendor chunk (`assets/three-[hash].js`), shrinking the main application chunk from $570\text{ kB}$ to **$94.5\text{ kB}$** ($26.7\text{ kB}$ gzip).
- **Architecture Documentation**:
  - Added ADR 0013: Engine Performance, Object Pooling, and Animation Loop Optimization.

---

## [0.5.0] - 2026-11-18

### Added
- **Visual Effects & Spell Particle Engine (`src/renderer/VFXManager.ts`)**:
  - **Atmospheric Weather Particles**: Context-aware ambient motes tailored to map themes (golden drifting pollen for daytime ruins, luminous azure motes for night fortress, toxic green spore clouds for swamp).
  - **Elemental Combat Spell VFX**:
    - *Slash Energy Arc*: Expanding additive crescent blade with directional orientation.
    - *Fire / Flare Eruption*: 40-particle velocity-driven upward fire column with dynamic orange `PointLight`.
    - *Ice / Frost Crystal*: Rotating 3D crystalline cone pillar with cyan point lighting.
    - *Lightning Bolt*: Multi-segmented celestial lightning strike with full-map ambient illumination.
    - *Holy / Bless Glow*: Ascending golden torus rings of sacred rejuvenation.
  - **Trauma-Based Camera Screen Shake**: Quadratic decay model ($\tau^2$) delivering visceral impact on critical strikes and heavy magic.
- **Combat Sprite Dynamics**:
  - Kinematic unit lunge forward toward target tile upon attack execution.
  - Recoil pushback animation upon sustaining physical or magical damage.
- **Projected 3D Overhead Mini HP & CT Status Bars**:
  - Dual gauge (green health and yellow CT meter) hovering above each character in 3D perspective space.
  - Team-colored borders (player royal blue, enemy crimson red) allowing instant situational awareness.
- **Animated Water Caustics**:
  - Continuous procedural UV texture offset oscillation creating flowing, rippling river and swamp currents.
- **Architecture Documentation**:
  - Added ADR 0012: Visual Effects, Camera Trauma Shake, and 3D Projected Overlays.

---

## [0.4.0] - 2026-11-17

### Added
- **In-Game 3D Map Editor**:
  - Live 3D terrain sculpting: click any tile on the battlefield to raise height (`+0.5h`), lower height (`-0.5h`), or paint materials.
  - 7 Paintable terrain materials: *Grassland*, *Stone Ruins*, *Dirt Soil*, *Water Bed*, *Poison Swamp*, *Castle Stone*, and *Wood Bridge*.
  - Walkability toggling (set impassable boulders, walls, or fences).
  - One-click **JSON Export** (copies formatted map data to clipboard) and **JSON Import** to load custom maps.
  - Instant **Test Battle** button to drop units into skirmish on the sculpted map immediately.
- **Equipment & Inventory System**:
  - 5 Gear slots per character: **Weapon**, **Shield**, **Headgear**, **Body Armor**, and **Accessory**.
  - 18 Unique items with stat scaling (Attack, Magic, Defense HP/MP, Speed, Move, Jump, Evasion).
  - Weapon types with variable range: Swords, Long Dragon Lance (2-tile spear range), Longbow (5-tile archer range), Chrono Scepter, and Assassin Daggers.
  - Subtab in `#job-modal` to inspect current loadouts, compare stats, and equip/unequip gear dynamically.
- **Multi-Stage Branching Campaign**:
  - Chapter-based story campaign (`src/data/campaign.ts`) with character dialogues and tactical encounter progressions:
    - **Chapter I**: *Ambush at Riverside Ruins*
    - **Chapter II-A**: *The Sunken Crypts (Gloomy Mire)*
    - **Chapter II-B**: *The Siege of Night Battlement*
    - **Final Chapter**: *The Awakening at the Summit*
  - **Narrative Choice System**: After Chapter I victory, players choose whether to pursue the sorcerer into the toxic mire or reinforce the castle garrison, unlocking distinct maps, enemy compositions, and equipment rewards!
- **Architectural Decision Records**: Added ADR 0009 (In-Game 3D Map Editor), ADR 0010 (Equipment & Inventory Architecture), and ADR 0011 (Branching Campaign State Machine).

---

## [0.3.0] - 2026-11-17

### Added
- **3 Advanced Hybrid Job Classes**:
  - **Dragoon (Lancer)**: High jump (base Jump 4), *Dragon Plunge* ($1.6\times$ kinetic strike), *Dragon Breath* (fire cone), *Dragonheart* (Reraise reaction), and *Ignore Elevation* (scales any cliff height).
  - **Ninja (Skirmisher)**: High speed ($1.25\times$), *Throw Shuriken*, *Vanish/Reflexes* (evades incoming attacks), *Dual Wield* (support ability: attacks strike twice!), and *Water Walk*.
  - **Time Weaver (Chronomancer)**: *Haste* ($+50\%$ Speed for 3 turns), *Slow* ($-33\%$ Speed), *Gravity* (deals $25\%$ target current HP), and *Teleport* (blinks across map bypassing obstacles).
- **Custom Pixel Art for Advanced Classes**:
  - Dragoon with azure dragon mail, winged greathelm, and long polearm.
  - Ninja with midnight shinobi cowl, red sash, and dual blades.
  - Time Weaver with crimson star-patterned robes and hourglass staff.
- **Synthesized 16-Bit Audio Engine (`src/audio/SoundEffects.ts`)**:
  - Pure Web Audio API retro synth: sword slashes, spell chimes, crits, heal sparkles, turn bells, and victory fanfares.
  - Top HUD audio toggle button (`🔊 SFX` / `🔇 MUTED`).
- **Story Cutscene Dialogue System**:
  - Visual novel style dialogue box with character portraits, speaker titles, and retro dialog prompts before battle.
- **Multi-Map Battlefield Selector**:
  - Added dropdown to switch between *Riverside Ruins*, *Night Battlement*, and *Gloomy Mire & Marsh*.
- **Status Effects Engine**:
  - Active tracking for `Haste`, `Slow`, `Protect`, `Immobilize`, and `Poison` with countdown badges.

---

## [0.2.0] - 2026-11-17

### Added
- **Extreme Close-Up Zoom System**: Extended minimum orthographic camera zoom down to `2.0`.
- **Smooth Mouse Wheel Zoom**: Interactive scroll wheel listener across `2.0` to `22.0`.
- **Mouse Drag Camera Panning**: Right-click and Middle-click drag functionality.
- **Keyboard Camera Controls**: `W`/`A`/`S`/`D` pan, `+`/`-` zoom, `R`/`Home` re-center.
- **3D Floating Combat Text**: Dynamic screen-projected damage, heal, critical hit, and miss numbers.
- **Idle Sprite Animation**: Procedural sinusoidal bobbing for billboard sprites.
- **Click-to-Inspect Units**: Live inspection of friend or foe stats.

---

## [0.1.0] - 2026-11-17

### Added
- **Core 3D Isometric Viewport & 90° Rotatable Camera**.
- **CT Speed Tick Engine & CT Refund Rules**.
- **Directional Facing & Combat Geometry**.
- **5-Slot Job & Ability Architecture**.
- **GitHub Pages CI/CD Pipeline**.
