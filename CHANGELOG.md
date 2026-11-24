# Changelog

All notable changes to the **Chess RPG Tactics** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
