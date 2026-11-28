import { MAPS, spawnsFor } from './data/maps';
import { BattleGrid } from './core/Grid';
import { TacticsScene } from './renderer/TacticsScene';
import { UIManager } from './ui/UIManager';
import { TurnManager } from './core/TurnManager';
import { JobSystem, JpGain, MAX_JOB_LEVEL } from './core/JobSystem';
import { JOBS } from './data/jobs';
import { drawSprite } from './graphics/CharacterArt';
import { WorldMap } from './ui/WorldMap';
import { DIFFICULTIES, DIFFICULTY_ORDER, Difficulty, enemyLevel, sanitizeDifficulty, scaleBoss } from './core/Difficulty';
import { Tutorial, TipId, TIPS } from './ui/Tutorial';
import { TEXT_SIZE_LABEL, TextSize, applyTextSize, nextTextSize, savedTextSize } from './ui/TextSize';
import { SKIRMISHES, SKIRMISH_MAX_HEAT, buildSkirmish, missingTrophies, sanitizeSkirmishWins, skirmishBonus } from './core/Skirmish';
import { SIDE_STORIES, buildSideStory, sanitizeSideStories, sideStoryOpen, sideStoryStates } from './core/SideStory';
import { MERCHANT_NAME, MerchantSales, merchantVisit, merchantVisitIndex, sanitizeMerchantSales } from './core/Merchant';
import { beastFromTamed, isBeast } from './core/Taming';
import { PARTY_EXP, PARTY_JP, RESERVE_EXP, RESERVE_JP, trainReserve } from './core/Reserve';
import { farShoreOpen } from './core/World';
import { LEADER_ID, MAX_SQUAD, PARTY_SIZE, RecruitHires, chooseParty, hireRecruit, isHired, recruitBoard, sanitizeParty, sanitizeRecruitHires } from './core/Recruits';
import { CAMP_JP, CAMP_SCENES, campMemories, pendingCamp, sanitizeCampSeen } from './data/camp';
import { SIGNATURES } from './data/signatures';
import { FIRST_ACT_FINALE, Mission, clearedAfterStory, nodeForChapter, sanitizeCleared } from './core/World';
import { CONSUMABLES, STARTING_INVENTORY, MAX_STACK, sanitizeInventory, consumableStock } from './data/consumables';
import { STARTING_GIL, shopProgress, shopStock, nextShopCap, victoryGil, resaleValue, gearSaleBlock , BattleMode } from './core/Economy';
import { CombatEngine, AttackResult } from './core/CombatEngine';
import { ActionContext, TrapStep, walkInto, ActionHit, forecastFor, resolveAction, victimsFor } from './core/Action';
import { newSeed, seededRng } from './core/Rng';
import { battleOutcome, noteTurn } from './core/Battle';
import { CAMPAIGN_RULES } from './core/Rules';
import { Unit, Ability, CombatForecast, FacingDirection, DialogueLine, CampaignChapter } from './core/types';
import { CAMPAIGN_CHAPTERS } from './data/campaign';
import { ITEMS, STARTING_ARMORY } from './data/items';
import { SoundFX } from './audio/SoundEffects';
import { Music } from './audio/MusicSynthesizer';
import { SaveManager, GameSaveData, SAVE_SLOTS, MAX_IMPORT_BYTES } from './core/SaveManager';
import { resolveTerrainAbility } from './core/Geomancy';
import { encoreDue, endPerformance, isCentered, performedBy } from './core/Performance';
import { planTurn, ENEMY_RAISE_CAP } from './core/EnemyAI';
import { enemyCaution, enemyPouch, salvage } from './core/EnemyPouch';
import { breakCall, callArea, callDue, callHolds } from './core/Summons';
import { buildTrialFloor, rollTrialDrop } from './core/Trials';
import { GamepadInput, PadAction } from './input/GamepadInput';
import { Bindings, actionForKey, loadBindings, saveBindings } from './input/Bindings';
import { ControlsPanel } from './ui/ControlsPanel';
import { getQualitySetting, setQualitySetting, resolveQuality, QualitySetting, PROFILES } from './renderer/GraphicsQuality';
import { moveFocus, focusablesIn, Dir } from './input/FocusNav';
import { Workshop } from './ui/Workshop';
import { BattleFx } from './renderer/BattleFx';
import { Scenario, scenarioToChapter, decodeShare } from './core/Scenario';
import { Chain, ChainLibrary, ChainProgress, chainStep, decodeChainShare } from './core/Chain';
import { inReach, sumPulses, TotemPulse } from './core/Totems';
import { trapAt } from './core/Traps';
import { HAZARDS, HazardPulse, holdGoal, zoneHolder, zoneKeys } from './core/Hazards';
import { ITCH_URL, SOURCE_URL, AUTHOR_URL, canFullscreen, isFullscreen, toggleFullscreen, guardPageScroll, setupInstall } from './platform';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/vt323/latin-400.css';

type InputMode = 'idle' | 'moving' | 'targeting' | 'facing' | 'dialogue' | 'editor' | 'menu' | 'busy';

// The saved text size applies before anything is drawn, the title screen included (0.20.0)
applyTextSize(savedTextSize());

/** ?fast speeds every animation delay up (used by the automated play-test). */
const TEST_FAST = new URLSearchParams(location.search).has('fast');
/** Multiplier on every scripted pause: 1 on Normal, 0.5 on the Fast battle speed. */
let SPEED = TEST_FAST ? 0.12 : 1;
type BattleSpeed = 'normal' | 'fast';
const SPEED_KEY = 'chess_rpg_tactics_speed_v1';
function savedBattleSpeed(): BattleSpeed {
  try { return localStorage.getItem(SPEED_KEY) === 'fast' ? 'fast' : 'normal'; } catch { return 'normal'; }
}
const later = (fn: () => void, ms: number) => setTimeout(fn, ms * SPEED);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms * SPEED));

/** HTML-escape text that goes into the result modal. */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

class TacticsGame {
  private grid!: BattleGrid;
  private scene!: TacticsScene;
  private ui!: UIManager;
  private turnManager!: TurnManager;
  private units: Unit[] = [];

  /** Persistent player squad: levels, JP, abilities and gear carry from battle to battle. */
  private squad: Unit[] = [];
  /** Item ids the squad owns. */
  private armory: string[] = [...STARTING_ARMORY];
  /** Gear stolen this battle (shown on the spoils screen). */
  private stolenThisBattle: string[] = [];
  /** Consumables the squad carries: item id to count. */
  private inventory: Record<string, number> = { ...STARTING_INVENTORY };
  /** The squad's purse. */
  private gil = STARTING_GIL;
  /** Gil from fencing stolen duplicates this battle. */
  private fencedThisBattle = 0;
  /** Job level-ups and unlocks this battle, per unit (shown on the spoils screen). */
  private jobNews: Record<string, string[]> = {};

  private mode: BattleMode = 'campaign';
  /** The side battle being fought (mode 'skirmish'), and wins so far at each place. */
  private currentSkirmish: string | null = null;
  /** Fallen enemies raised by the enemy side this battle (capped). */
  private enemyRaises = 0;
  /** The battle's dice: every roll comes from here, seeded when the battle is set up (0.41.0). */
  private rng: () => number = seededRng(newSeed());
  /** Units whose grand summon is marked on the board (0.24.0), to tell when a call is broken. */
  private callsShown = new Set<string>();
  /** The save slot this game writes to (1–3), and its difficulty. */
  private saveSlot = 1;
  private difficulty: Difficulty = 'normal';
  /** Supplies as the battle began: a lost battle gives back what was used in it. */
  private battleStartInventory: Record<string, number> | null = null;
  private skirmishWins: Record<string, number> = {};
  /** Recruit side stories won this playthrough, and the one being fought (0.43.0). */
  private sideStoriesWon: string[] = [];
  private currentSideStory: string | null = null;
  /** Camp scenes already played this playthrough (0.21.0). */
  private campSeen: string[] = [];
  /** Camp scenes seen in any playthrough of this save, to watch again (0.39.0). */
  private campMemories: string[] = [];
  /** Bought from the travelling merchant on her current visit (0.21.0). */
  private merchantSales: MerchantSales | undefined;
  /** The party the player picked when the squad outgrew it (0.25.0), by unit id. */
  private party: string[] | undefined;
  /** Who fights the current battle: a subset of the squad (0.25.0). */
  private deployed: string[] = [];
  /** Who was hired from the market's current recruiting board (0.25.0). */
  private recruitHires: RecruitHires | undefined;
  /** The campaign chapter to return to after Workshop battles (and to save). */
  private campaignChapterId = 'chapter_1';
  /** Campaign chapters won this run, in order. */
  private clearedChapters: string[] = [];
  /** The world map shown between missions. */
  private world!: WorldMap;
  /** First-battle tips. */
  private tutor = new Tutorial();
  /** Where the active unit stood before this turn's move, while the move can still be taken back. */
  /** Where the active unit stood before moving, and what it had (a performance it was holding included), for UNDO. */
  private moveUndo: { unitId: string; x: number; z: number; facing: Unit['facing']; hp: number; mp: number; performing?: string; encore?: number } | null = null;
  /** True while the Workshop is open over the world map. */
  private mapParked = false;

  // Workshop
  private workshop!: Workshop;
  private fx!: BattleFx;
  private customScenario: Scenario | null = null;
  /** The scenario chain being played, and which battle of it (0.42.0). */
  private chainRun: { chain: Chain; index: number } | null = null;
  /** The battle that was in progress when the Workshop opened, restored when it closes. */
  private suspended: {
    grid: BattleGrid; units: Unit[]; turnManager: TurnManager; chapter: CampaignChapter;
    mode: BattleMode; inputMode: InputMode; kills: Record<string, number>;
    round: number; roundActed: Set<string>; held: number; rng: () => number;
  } | null = null;

  /** Rounds for the "survive" objective: a round ends once every living unit has had a turn. */
  private round = 1;
  private roundActed = new Set<string>();
  /** Rounds ended holding the zone, for a "hold" objective (0.48.0). */
  private held = 0;
  private trialsFloor = 0;
  private campaignCleared = false;
  private battleOver = false;
  /** Per-battle kill tally for the spoils screen. */
  private kills: Record<string, number> = {};

  // Interaction state
  private currentMode: InputMode = 'dialogue';
  private pad = new GamepadInput();
  /** Which keys and buttons do what (0.40.0), kept per browser. */
  private bindings: Bindings = loadBindings();
  private selectedAbility: Ability | null = null;
  private currentForecast: CombatForecast | null = null;
  private targetTile: { x: number; z: number } | null = null;
  /** The tile a totem is aimed at, waiting for a second click to plant it (0.47.0). */
  private totemAim: { x: number; z: number } | null = null;

  // Campaign state
  private currentChapter: CampaignChapter = CAMPAIGN_CHAPTERS.chapter_1;
  private dialogueQueue: DialogueLine[] = [];
  private dialogueIndex = 0;
  private onDialogueFinished?: () => void;

  constructor() {
    this.ui = new UIManager();
    this.world = new WorldMap({
      state: () => ({
        current: this.campaignChapterId,
        cleared: this.clearedChapters,
        // The Gate opens once the first act is won (0.18.0); New Game+ waits for the very end
        trialsOpen: this.campaignCleared || this.mode === 'trials' || this.clearedChapters.includes(FIRST_ACT_FINALE),
        newGamePlus: this.campaignCleared,
        trialsFloor: Math.max(1, this.trialsFloor),
        bestTrial: SaveManager.getBestTrialFloor(),
        gil: this.gil,
        leaderJob: this.squad[0]?.jobId || 'squire',
        squadLevels: this.squad.map((u) => u.level),
        skirmishWins: this.skirmishWins,
        armory: this.armory,
        merchant: this.merchant(),
        camp: pendingCamp(this.clearedChapters, this.campSeen),
        memories: this.campMemories.length,
        recruits: this.recruitBoard(),
        squadSize: this.squad.length,
        farShore: farShoreOpen(this.clearedChapters),
        sideStories: sideStoryStates(this.clearedChapters, this.squad.map((u) => u.id), this.sideStoriesWon)
      }),
      hire: (slot) => this.hire(slot),
      barracks: () => this.openParty(null),
      skirmish: (id) => this.withParty(() => this.startSkirmish(id)),
      sideStory: (id) => this.withParty(() => this.startSideStory(id), SIDE_STORIES[id]?.hero, true),
      buyFromMerchant: (id) => this.buyFromMerchant(id),
      makeCamp: () => this.makeCamp(),
      memories: () => this.openMemories(),
      tip: () => (this.tutor.wants('worldMap') ? TIPS.worldMap : null),
      tipSeen: () => this.tutor.markSeen('worldMap'),
      march: (m) => this.withParty(() => this.marchTo(m), CAMPAIGN_CHAPTERS[m.chapterId]?.recruit),
      enterTrials: () => this.withParty(() => { this.world.close(); this.startTrial(Math.max(1, this.trialsFloor)); }),
      newGamePlus: () => this.startNewGamePlus(),
      openTeam: () => this.openTeamFor(null),
      openShop: () => {
        this.openTeamFor(null);
        const tab = document.getElementById('btn-tab-shop')!;
        tab.click();
        tab.focus({ preventScroll: true }); // before the modal's own first-focus pass, so the Shop tab is where you are
      },
      save: () => this.saveGame(true),
      menu: () => this.ui.toggleSystemMenu(),
      focus: (el) => this.ui.focusForNav(el),
      blip: () => SoundFX.playMenuBlip()
    });
    this.ui.onJobModalClosed = () => this.world.refresh();
    this.ui.canUndoMove = (u) => this.canUndoMove(u);
    document.getElementById('btn-action-act')!.addEventListener('click', () => this.tip('actMenu'));
    document.getElementById('btn-action-item')!.addEventListener('click', () => this.tip('item'));
    document.getElementById('btn-tips-reset')!.addEventListener('click', () => {
      this.tutor.reset();
      this.ui.toggleHelp(false);
      this.ui.showBanner('TIPS ARE BACK ON');
      this.world.refresh();
    });
    this.ui.armory = this.armory;
    this.ui.inventory = () => this.inventory;
    this.ui.shop = {
      gil: () => this.gil,
      stock: () => shopStock(this.shopLevel()),
      nextCap: () => nextShopCap(this.shopLevel()),
      buy: (id) => this.buyItem(id),
      open: () => this.marketOpen(),
      supplies: () => consumableStock(this.shopLevel()),
      buySupply: (id) => this.buyConsumable(id),
      sellSupply: (id) => this.sellConsumable(id),
      sellGear: (id) => this.sellGear(id),
      saleBlock: (id) => gearSaleBlock(id, this.armory, this.squad)
    };
    this.squad = this.createStartingSquad();

    this.setupBattle(CAMPAIGN_CHAPTERS.chapter_1);

    const canvas = document.getElementById('viewport-canvas') as HTMLCanvasElement;
    this.scene = new TacticsScene(canvas, this.grid);
    this.scene.updateUnits(this.units);
    this.applyAtmosphereForMap();
    // The first battle was set up before the scene existed: fill the HUD now
    const lead = this.squad[0];
    this.ui.updateUnitCard(lead, this.grid.getHeight(lead.x, lead.z));
    this.ui.updateTurnTimeline(this.turnManager.predictTurnTimeline(8), null);
    this.scene.focusOn(lead.x, this.grid.getHeight(lead.x, lead.z), lead.z);

    this.fx = new BattleFx(this.scene);

    this.workshop = new Workshop({
      scene: this.scene,
      banner: (t) => this.ui.showBanner(t),
      squad: () => this.squad.map((u) => ({ name: u.name, jobId: u.jobId })),
      chapters: () => Object.values(CAMPAIGN_CHAPTERS),
      currentChapter: () => CAMPAIGN_CHAPTERS[this.campaignChapterId] || CAMPAIGN_CHAPTERS.chapter_1,
      play: (s) => this.playScenario(s),
      playChain: (c, index) => this.playChain(c, index),
      closed: () => this.workshopClosed()
    });

    this.bindEvents();
    this.bindPlatform();
    this.gameLoop();
    // Automated play-tests (?fast) and share links skip the title screen
    const params = new URLSearchParams(location.search);
    const shared = /^#[sc]=/.test(location.hash); // a scenario or a chain (0.42.0)
    if (params.has('fast') || params.has('notitle') || shared) {
      this.hideTitle();
      if (!shared) this.playChapterIntro();
      this.openShareLink();
    } else {
      this.showTitle();
    }

    // Debug / automated play-testing hook: add ?debug to the URL
    if (new URLSearchParams(location.search).has('debug')) {
      (window as unknown as { __tactics: TacticsGame }).__tactics = this;
    }
  }

  // ---------------------------------------------------------------------------
  // Squad, chapters and battle setup
  // ---------------------------------------------------------------------------

  private createStartingSquad(): Unit[] {
    const squad = [
      JobSystem.createUnit('p1', 'Rowan', 'player', 'squire', 3, 8, 'N', 3),
      JobSystem.createUnit('p2', 'Maren', 'player', 'knight', 4, 8, 'N', 3),
      JobSystem.createUnit('p3', 'Tobin', 'player', 'archer', 5, 9, 'N', 3),
      JobSystem.createUnit('p4', 'Corvin', 'player', 'dragoon', 2, 7, 'N', 3)
    ];

    JobSystem.setSecondarySkillset(squad[0], 'knight');
    squad[0].unlockedAbilities['kn_rend_armor'] = true;
    squad[0].unlockedAbilities['sq_move_plus'] = true;
    squad[0].equippedAbilities.movement = 'sq_move_plus';
    JobSystem.recalculateDerivedStats(squad[0]);

    squad[3].unlockedAbilities['dr_jump'] = true;
    squad[3].unlockedAbilities['dr_ignore_height'] = true;
    squad[3].equippedAbilities.movement = 'dr_ignore_height';
    JobSystem.recalculateDerivedStats(squad[3]);

    return squad;
  }

  private applyAtmosphereForMap(): void {
    this.scene.vfx.setWeatherTheme(this.grid.mapData.theme);
  }

  /** The squad members fighting this battle (0.25.0). */
  private deployedUnits(): Unit[] {
    return this.squad.filter((u) => this.deployed.includes(u.id));
  }

  /** Puts every deployed squad member on a free, walkable deployment tile with full HP/MP. */
  private deploySquad(): void {
    const taken = new Set<string>();
    for (const e of this.units.filter((u) => u.team === 'enemy')) taken.add(`${e.x},${e.z}`);

    const spawns = spawnsFor(this.grid.mapData);
    this.deployedUnits().forEach((member, i) => {
      let spot = spawns[i % spawns.length];
      const ok = (x: number, z: number) => this.grid.isWalkable(x, z) && !taken.has(`${x},${z}`);
      if (!ok(spot.x, spot.z)) {
        // Fall back to the nearest open tile on the southern edge of the map
        const candidates = this.grid.mapData.tiles
          .filter((t) => t.walkable && !taken.has(`${t.x},${t.z}`))
          .sort((a, b) => b.z - a.z || Math.abs(a.x - spot.x) - Math.abs(b.x - spot.x));
        if (candidates[0]) spot = { x: candidates[0].x, z: candidates[0].z };
      }
      taken.add(`${spot.x},${spot.z}`);
      JobSystem.resetForBattle(member, spot.x, spot.z);
    });
  }

  private spawnEnemies(chapter: CampaignChapter): Unit[] {
    return chapter.enemyRoster.map((e, idx) => {
      // Difficulty shifts enemy levels everywhere but the Workshop, where the author set them
      const level = this.mode === 'custom' ? e.level : enemyLevel(e.level, this.difficulty);
      const u = JobSystem.createUnit(`e${idx + 1}`, e.name, 'enemy', e.jobId, e.x, e.z, e.facing || 'S', level);
      if (e.isBoss) JobSystem.makeBoss(u);
      if (e.isBoss && this.mode !== 'custom') scaleBoss(u, this.difficulty);
      // Enemy casters get their job's reaction/support so they fight like the player's units
      this.equipEnemyPassives(u);
      // Some carry items (0.31.0); the Workshop plays at Normal
      u.pouch = enemyPouch(u, idx, this.mode === 'custom' ? 'normal' : this.difficulty);
      return u;
    });
  }

  private equipEnemyPassives(u: Unit): void {
    JobSystem.equipVeteranPassives(u);
    JobSystem.applyGearStatuses(u);
  }

  /** Builds grid, squad deployment and enemies for a chapter (optionally on a different map). */
  private setupBattle(chapter: CampaignChapter, mapOverride?: string): void {
    this.currentChapter = chapter;
    const mapId = mapOverride || chapter.mapId;
    // Workshop chapters carry their own battlefield (a copy, so replays start fresh)
    this.grid = new BattleGrid(chapter.mapData && !mapOverride ? JSON.parse(JSON.stringify(chapter.mapData)) : (MAPS[mapId] || MAPS.river_ruins)());

    if (chapter.recruit && !this.squad.some((u) => u.id === chapter.recruit!.id)) {
      const r = chapter.recruit;
      this.squad.push(JobSystem.createUnit(r.id, r.name, 'player', r.jobId, 0, 0, 'N', r.level));
      if (!this.armory.includes('gaia_staff')) this.armory.push('gaia_staff');
    }

    // Who fights: everyone if the squad fits, else the party picked, with the leader and a story
    // recruit joining in this battle always in it (0.25.0)
    this.deployed = chooseParty(this.squad, this.party, chapter.recruit ? [chapter.recruit.id] : []);
    const enemies = this.spawnEnemies(chapter);
    this.units = [...enemies];
    this.deploySquad();
    this.units = [...this.deployedUnits(), ...enemies];
    this.turnManager = new TurnManager(this.units, this.grid);
    this.kills = {};
    this.enemyRaises = 0;
    this.rng = seededRng(newSeed());
    this.callsShown.clear();
    // (the scene is built after the first battle is set up; a new map clears these anyway)
    this.scene?.setCallMarkers([]);
    this.scene?.dim(0);
    this.stolenThisBattle = [];
    this.fencedThisBattle = 0;
    this.jobNews = {};
    this.battleOver = false;

    this.ui.setMapSelection(mapId);
    if (this.scene) {
      this.scene.loadMap(this.grid);
      this.scene.updateUnits(this.units);
      this.applyAtmosphereForMap();
      // Clear the previous battle's HUD before the intro dialogue plays
      this.ui.updateTurnTimeline(this.turnManager.predictTurnTimeline(8), null);
      const lead = this.squad[0];
      this.ui.updateUnitCard(lead, this.grid.getHeight(lead.x, lead.z));
      this.scene.focusOn(lead.x, this.grid.getHeight(lead.x, lead.z), lead.z);
    }
  }

  private loadChapter(chapterId: string): void {
    this.mode = 'campaign';
    this.customScenario = null;
    this.campaignChapterId = CAMPAIGN_CHAPTERS[chapterId] ? chapterId : 'chapter_1';
    this.setupBattle(CAMPAIGN_CHAPTERS[chapterId] || CAMPAIGN_CHAPTERS.chapter_1);
    this.playChapterIntro();
  }

  /** An optional side battle from the world map. It never moves the story on. */
  private startSkirmish(id: string): void {
    if (!SKIRMISHES[id]) return;
    this.world.close();
    this.mode = 'skirmish';
    this.currentSkirmish = id;
    this.customScenario = null;
    this.setupBattle(buildSkirmish(id, this.squad.map((u) => u.level), this.skirmishWins[id] || 0));
    this.playChapterIntro();
    this.saveGame(false); // a save made here resumes on the map, at this place
  }

  /** A recruit's side story from the world map (0.43.0): told once, never moves the story on. */
  private startSideStory(id: string): void {
    if (!sideStoryOpen(id, this.clearedChapters, this.squad.map((u) => u.id), this.sideStoriesWon)) return;
    this.world.close();
    this.mode = 'story';
    this.currentSideStory = id;
    this.customScenario = null;
    this.setupBattle(buildSideStory(id, this.squad.map((u) => u.level)));
    this.playChapterIntro();
    this.saveGame(false); // a save made here resumes on the map, at this place
  }

  /** A side story is won: it's marked told, and the squad is back on the map beside it. */
  private finishSideStory(): void {
    const id = this.currentSideStory;
    if (id && !this.sideStoriesWon.includes(id)) this.sideStoriesWon.push(id);
    this.ui.addLogEntry(`[STORY] ${SIDE_STORIES[id || '']?.hero.name || 'The'} side story is told.`, 'system');
    this.openWorldMap(id || undefined);
    this.saveGame(false);
  }

  private startTrial(floor: number): void {
    this.mode = 'trials';
    this.trialsFloor = floor;
    this.setupBattle(buildTrialFloor(floor));
    this.startBattle();
  }

  private playChapterIntro(): void {
    if (this.currentChapter.introDialogue.length === 0) {
      this.startBattle();
      return;
    }
    this.playDialogueSequence(this.currentChapter.introDialogue, () => this.startBattle());
  }

  private playDialogueSequence(lines: DialogueLine[], onComplete: () => void): void {
    Music.playTrack('dialogue');
    this.currentMode = 'dialogue';
    this.dialogueQueue = lines;
    this.dialogueIndex = 0;
    this.onDialogueFinished = onComplete;
    this.advanceDialogue();
  }

  private advanceDialogue(): void {
    if (this.dialogueIndex < this.dialogueQueue.length) {
      const line = this.dialogueQueue[this.dialogueIndex];
      this.ui.showDialogue(line, () => {
        this.dialogueIndex++;
        this.advanceDialogue();
      });
    } else {
      this.ui.hideDialogue();
      const done = this.onDialogueFinished;
      this.onDialogueFinished = undefined;
      done?.();
    }
  }

  // ---------------------------------------------------------------------------
  // Input binding
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    this.ui.onMapChanged = (mapId) => {
      // The battlefield picker belongs to a battle: on the world map there is none to redraw
      if (!this.world.isOpen) this.switchBattlefield(mapId);
    };

    this.ui.onWorkshop = () => this.openWorkshop();

    document.getElementById('btn-rot-left')?.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.scene.rotateLeft();
      this.scene.updateUnits(this.units);
    });
    document.getElementById('btn-rot-right')?.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.scene.rotateRight();
      this.scene.updateUnits(this.units);
    });
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.scene.zoomIn(1.8));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.scene.zoomOut(1.8));

    this.bindInputs();

    this.ui.onMoveClicked = () => this.handleMoveCommand();
    this.ui.onAbilitySelected = (ability) => this.handleAbilityCommand(ability);
    this.ui.onWaitClicked = () => this.handleWaitCommand();
    this.ui.onAutoClicked = () => this.handleAutoCommand();
    this.ui.onFacingConfirmed = (facing) => this.handleFacingConfirmed(facing);
    this.ui.onExecuteAttack = () => this.handleExecuteAttack();
    this.ui.onCancelAttack = () => this.cancelTargeting();

    this.ui.onToggleBgm = () => {
      const isMuted = Music.toggleMute();
      this.ui.updateBgmButton(isMuted);
      this.ui.addLogEntry(`[SYSTEM] BGM ${isMuted ? 'muted' : 'enabled'}.`, 'system');
    };

    this.ui.onSaveGame = () => this.openSlots('save');
    this.ui.onLoadGame = () => this.openSlots('load');
    document.getElementById('btn-difficulty')!.addEventListener('click', () => {
      const next = DIFFICULTY_ORDER[(DIFFICULTY_ORDER.indexOf(this.difficulty) + 1) % DIFFICULTY_ORDER.length];
      this.difficulty = next;
      this.labelDifficulty();
      this.ui.showBanner(`DIFFICULTY: ${DIFFICULTIES[next].label.toUpperCase()} (FROM THE NEXT BATTLE)`);
      this.ui.addLogEntry(`[SYSTEM] Difficulty set to ${DIFFICULTIES[next].label}: ${DIFFICULTIES[next].blurb}`, 'system');
      if (this.world.isOpen) this.saveGame(false);
    });
  }

  // ---------------------------------------------------------------------------
  // Unified input: keyboard, mouse, touch, pen and controller all end up here
  // ---------------------------------------------------------------------------

  private bindInputs(): void {
    // Canvas taps/clicks (mouse, touch, pen) select tiles; gestures handled in TacticsScene
    this.scene.onTileTap = () => this.onCanvasClick();
    this.scene.onCancelGesture = () => this.cancelAction();
    this.scene.onPointerKind = (kind) => this.ui.setInputMode(kind === 'pen' ? 'pen' : kind === 'touch' ? 'touch' : 'mouse');

    // Track the input the player is using right now so hints and focus rings match it
    window.addEventListener('pointerdown', (e) => this.ui.setInputMode(e.pointerType === 'pen' ? 'pen' : e.pointerType === 'touch' ? 'touch' : 'mouse'), true);

    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    this.pad.onAction = (a) => {
      this.ui.setInputMode('gamepad');
      this.handlePad(a);
    };
    // Rebindable keys and buttons (0.40.0): the Controls screen edits them
    this.pad.setButtons(this.bindings.pad);
    new ControlsPanel(document.getElementById('help-modal')!, () => this.bindings, (b) => {
      this.bindings = b;
      saveBindings(b);
      this.pad.setButtons(b.pad);
    }, this.pad);
    this.pad.onPan = (dx, dz) => this.scene.panBy(dx, dz);
    this.pad.onZoom = (d) => (d > 0 ? this.scene.zoomOut(d) : this.scene.zoomIn(-d));
    this.pad.onConnect = () => {
      this.ui.setInputMode('gamepad');
      this.ui.showBanner('CONTROLLER CONNECTED');
      this.ui.addLogEntry('[SYSTEM] Controller connected. Press View/Back for the controls.', 'system');
    };
    this.pad.onDisconnect = () => this.ui.showBanner('CONTROLLER DISCONNECTED');

    // Text size: Normal → Large → Larger. Saved on this device (0.20.0)
    const textBtn = document.getElementById('btn-text-size');
    const showTextSize = (v: TextSize) => { if (textBtn) textBtn.textContent = `Text size: ${TEXT_SIZE_LABEL[v]}`; };
    showTextSize(savedTextSize());
    textBtn?.addEventListener('click', () => {
      const next = nextTextSize(savedTextSize());
      applyTextSize(next, true);
      showTextSize(next);
      this.ui.showBanner(`TEXT SIZE: ${TEXT_SIZE_LABEL[next].toUpperCase()}`);
    });

    // Battle speed: Normal ↔ Fast (pauses halved, walking doubled). Saved on this device.
    const speedBtn = document.getElementById('btn-speed');
    const applySpeed = (v: BattleSpeed) => {
      if (!TEST_FAST) SPEED = v === 'fast' ? 0.5 : 1;
      this.scene.walkSpeed = v === 'fast' ? 2 : 1;
      if (speedBtn) speedBtn.textContent = `Battle speed: ${v === 'fast' ? 'Fast' : 'Normal'}`;
    };
    applySpeed(savedBattleSpeed());
    speedBtn?.addEventListener('click', () => {
      const next: BattleSpeed = savedBattleSpeed() === 'fast' ? 'normal' : 'fast';
      try {
        if (next === 'fast') localStorage.setItem(SPEED_KEY, next);
        else localStorage.removeItem(SPEED_KEY);
      } catch { /* private browsing: the choice lasts for this visit */ }
      applySpeed(next);
      this.ui.showBanner(`BATTLE SPEED: ${next.toUpperCase()}`);
    });

    // Graphics quality: Auto → High → Medium → Low
    const gfxBtn = document.getElementById('btn-graphics');
    const labelGfx = (this.labelGfx = () => {
      const setting = getQualitySetting();
      const name = (v: string) => v[0].toUpperCase() + v.slice(1);
      if (gfxBtn) gfxBtn.textContent = setting === 'auto' ? `Graphics: Auto (${name(this.scene.qualityLevel)})` : `Graphics: ${name(setting)}`;
    });
    labelGfx();
    gfxBtn?.addEventListener('click', () => {
      const order: QualitySetting[] = ['auto', 'high', 'medium', 'low'];
      const next = order[(order.indexOf(getQualitySetting()) + 1) % order.length];
      setQualitySetting(next);
      this.scene.setQuality(resolveQuality(next));
      labelGfx();
      this.ui.showBanner(`GRAPHICS: ${this.scene.qualityLevel.toUpperCase()}`);
    });

    this.ui.onStatusClicked = () => this.openTeamFor(this.turnManager.activeUnit);
    this.ui.onRecenterClicked = () => this.recenter();

    this.ui.setInputMode(matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');
  }

  private recenter(): void {
    const active = this.turnManager.activeUnit;
    if (!active) return;
    this.scene.focusOn(active.x, this.grid.getHeight(active.x, active.z), active.z);
    this.scene.setCursor(active.x, active.z);
  }

  private openTeamFor(unit: Unit | null): void {
    const idx = unit ? this.squad.findIndex((u) => u.id === unit.id) : 0;
    this.ui.populateJobCustomizer(this.squad, Math.max(0, idx));
    this.ui.openJobModal();
  }

  private isPlayerIdle(): boolean {
    return this.currentMode === 'idle' && this.turnManager.activeUnit?.team === 'player' && !this.battleOver;
  }

  /** Esc, controller B, two-finger tap, pen eraser: close the top thing, or step back. */
  private cancelAction(): void {
    if (this.ui.isHelpOpen) return this.ui.toggleHelp(false);
    if (this.isTitleOpen) return;
    if (this.ui.isSystemMenuOpen) return this.ui.toggleSystemMenu(false);
    if (this.ui.isJobModalOpen) return this.ui.closeJobModal();
    if (this.workshop.isOpen) {
      // From the panel, B / Esc steps back to the map cursor; from the map it closes the Workshop
      if (this.workshop.focusIsInPanel()) (document.activeElement as HTMLElement).blur();
      else this.workshop.close();
      return;
    }
    if (this.ui.isResultModalOpen || this.currentMode === 'dialogue') return;
    if (!document.getElementById('combat-forecast')!.classList.contains('hidden')) {
      document.getElementById('btn-forecast-cancel')!.click();
      return;
    }
    if (this.currentMode === 'facing') {
      const active = this.turnManager.activeUnit;
      // Facing is mandatory once a unit has both moved and acted; otherwise WAIT can be backed out of
      if (active && !(active.hasMoved && active.hasActed)) {
        document.getElementById('facing-selector')!.classList.add('hidden');
        this.currentMode = 'idle';
        this.ui.focusForNav(document.getElementById('btn-action-wait'));
      }
      return;
    }
    if (!document.getElementById('sub-menu')!.classList.contains('hidden')) return this.ui.toggleSubMenu(false);
    if (this.currentMode === 'targeting') {
      this.cancelTargeting();
      this.ui.focusForNav(document.getElementById('btn-action-act'));
      return;
    }
    if (this.currentMode === 'moving') {
      this.currentMode = 'idle';
      this.scene.clearHighlights();
      this.ui.focusForNav(document.getElementById('btn-action-move'));
      return;
    }
    if (this.ui.isCombatLogOpen) return this.ui.toggleCombatLog(false);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  /** Enter / Space / controller A on the battlefield (no menu has focus). */
  private confirmOnBattlefield(): void {
    if (this.currentMode === 'dialogue') {
      SoundFX.playMenuBlip();
      this.dialogueIndex++;
      this.advanceDialogue();
      return;
    }
    const tile = this.scene.hoveredTile;
    if (!tile) return;
    const active = this.turnManager.activeUnit;
    // Confirming on your own active unit while idle opens its command menu
    if (this.isPlayerIdle() && active && active.x === tile.x && active.z === tile.z) {
      this.ui.focusCommands();
      return;
    }
    this.onCanvasClick();
  }

  private moveCursor(dir: Dir): void {
    if (this.currentMode === 'dialogue' || this.ui.isResultModalOpen) return;
    const t = this.scene.moveCursor(dir);
    if (t) {
      SoundFX.playMoveStep();
      const tile = this.scene.grid.getTile(t.x, t.z);
      if (tile) this.ui.updateTileInfo(t.x, t.z, tile.height, tile.terrain, tile.hazard ? HAZARDS[tile.hazard].name : undefined, tile.zone);
      this.workshop.describeTile(t.x, t.z);
      const unit = this.units.find((u) => !u.isDead && u.x === t.x && u.z === t.z);
      if (unit && this.currentMode !== 'targeting') this.ui.updateUnitCard(unit, this.grid.getHeight(unit.x, unit.z));
    }
  }

  private handleDirection(dir: Dir): void {
    const layer = this.ui.activeLayer();
    if (layer && focusablesIn(layer).length > 0) {
      moveFocus(layer, dir);
      SoundFX.playMenuBlip();
    } else {
      this.moveCursor(dir);
    }
  }

  private handleConfirm(): void {
    // A camp scene plays over the world map: Enter / A advances it rather than pressing the map
    if (this.currentMode === 'dialogue' && this.world.isOpen) return this.confirmOnBattlefield();
    const layer = this.ui.activeLayer();
    const focused = document.activeElement as HTMLElement | null;
    if (layer) {
      if (focused && layer.contains(focused) && focused !== document.body) focused.click();
      else moveFocus(layer, 'down');
      return;
    }
    if (focused && focused !== document.body && focused.closest('button, [role="button"]')) {
      focused.click();
      return;
    }
    this.confirmOnBattlefield();
  }

  private handlePad(a: PadAction): void {
    if (this.isTitleOpen && !['up', 'down', 'left', 'right', 'confirm', 'cancel', 'help'].includes(a)) return;
    switch (a) {
      case 'up': case 'down': case 'left': case 'right':
        return this.handleDirection(a);
      case 'confirm': return this.handleConfirm();
      case 'cancel': return this.cancelAction();
      case 'commands':
        if (this.workshop.isOpen) this.workshop.focusPanel();
        else if (this.isPlayerIdle()) this.ui.focusCommands();
        return;
      case 'team':
        if (this.ui.isJobModalOpen) this.ui.closeJobModal();
        else if (this.currentMode !== 'dialogue' && !this.ui.isResultModalOpen) this.openTeamFor(this.turnManager.activeUnit);
        return;
      case 'rotateLeft': this.scene.rotateLeft(); this.scene.updateUnits(this.units); return;
      case 'rotateRight': this.scene.rotateRight(); this.scene.updateUnits(this.units); return;
      case 'zoomIn': this.scene.zoomIn(1.5); return;
      case 'zoomOut': this.scene.zoomOut(1.5); return;
      case 'recenter': return this.recenter();
      case 'menu': return this.ui.toggleSystemMenu();
      case 'help': return this.ui.toggleHelp();
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    this.ui.setInputMode('keyboard');
    const target = e.target as HTMLElement;
    const typing = target.matches?.('input, textarea, select');
    const k = e.key;

    if (k === 'Escape') {
      e.preventDefault();
      this.cancelAction();
      return;
    }
    if (typing) return;

    // Rebound keys (0.40.0): what this key does, if anything
    const bound = actionForKey(this.bindings, k);

    // On the title screen only menu keys work (the Controls key opens Controls)
    if (this.isTitleOpen && !this.ui.isHelpOpen) {
      const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as Record<string, Dir>)[k];
      if (dir) { e.preventDefault(); this.handleDirection(dir); }
      else if (bound === 'help') this.ui.toggleHelp(true);
      return;
    }

    if (this.ui.isResultModalOpen) {
      // Buttons handle Enter/Space natively; arrows move between them
      const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as Record<string, Dir>)[k];
      if (dir) { e.preventDefault(); this.handleDirection(dir); }
      return;
    }

    const arrows: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (arrows[k]) {
      e.preventDefault();
      this.handleDirection(arrows[k]);
      return;
    }

    if (k === 'Enter' || k === ' ') {
      // A focused button handles Enter/Space itself
      if (target && target !== document.body && target.closest('button, [role="button"], a')) return;
      e.preventDefault();
      this.handleConfirm();
      return;
    }

    if (this.currentMode === 'dialogue') return;

    switch (bound) {
      case 'rotateLeft': this.scene.rotateLeft(); this.scene.updateUnits(this.units); return;
      case 'rotateRight': this.scene.rotateRight(); this.scene.updateUnits(this.units); return;
      case 'zoomIn': this.scene.zoomIn(1.5); return;
      case 'zoomOut': this.scene.zoomOut(1.5); return;
      case 'panUp': this.scene.panBy(0, -1.0); return;
      case 'panDown': this.scene.panBy(0, 1.0); return;
      case 'panLeft': this.scene.panBy(-1.0, 0); return;
      case 'panRight': this.scene.panBy(1.0, 0); return;
      case 'recenter': this.recenter(); return;
      case 'help': this.ui.toggleHelp(); return;
      case 'log': this.ui.toggleCombatLog(); return;
      case 'team': if (this.ui.isJobModalOpen) this.ui.closeJobModal(); else this.openTeamFor(this.turnManager.activeUnit); return;
    }
    if (this.isPlayerIdle() && !this.ui.activeLayer()) {
      if (bound === 'move') this.clickIfEnabled('btn-action-move');
      else if (bound === 'act') this.clickIfEnabled('btn-action-act');
      else if (bound === 'wait') this.clickIfEnabled('btn-action-wait');
      else if (bound === 'auto') this.handleAutoCommand();
      else if (bound === 'item') this.clickIfEnabled('btn-action-item');
    }
  }

  private clickIfEnabled(id: string): void {
    const b = document.getElementById(id) as HTMLButtonElement | null;
    if (b && !b.disabled) b.click();
  }

  // ---------------------------------------------------------------------------
  // Save / load
  // ---------------------------------------------------------------------------

  private saveGame(announce: boolean): void {
    // Workshop battles never overwrite campaign progress: save the chapter you'll return to
    // Between missions (and in the Trials) the story's place is the campaign chapter, not the last battlefield
    const inStoryBattle = this.mode === 'campaign' && !this.world.isOpen;
    const ok = SaveManager.saveGame(inStoryBattle ? this.currentChapter.id : this.campaignChapterId, this.squad, {
      armory: this.armory,
      mode: this.mode === 'trials' ? 'trials' : 'campaign',
      trialsFloor: this.trialsFloor,
      campaignCleared: this.campaignCleared,
      gil: this.gil,
      inventory: this.inventory,
      clearedChapters: this.clearedChapters,
      // A side battle isn't resumed: loading puts the squad back on the map beside it
      onWorldMap: this.world.isOpen || this.mode === 'skirmish' || this.mode === 'story',
      skirmishWins: this.skirmishWins,
      campSeen: this.campSeen,
      campMemories: this.campMemories,
      sideStories: this.sideStoriesWon,
      merchantSales: this.merchantSales,
      party: this.party,
      recruitHires: this.recruitHires,
      worldLocation: this.world.location,
      difficulty: this.difficulty
    }, this.saveSlot);
    if (ok && announce) {
      SoundFX.playTurnChime();
      this.ui.showBanner('GAME SAVED!');
      this.ui.addLogEntry(`[SYSTEM] Squad, armory and progress saved to slot ${this.saveSlot} on this browser.`, 'system');
    } else if (!ok && announce) {
      this.ui.showBanner('SAVE FAILED: BROWSER STORAGE UNAVAILABLE');
    }
  }

  /** Loads a slot (default: the one being played; from the title, the newest). */
  private loadGame(slot = this.saveSlot): void {
    const data = SaveManager.loadGame(slot);
    if (!data || !data.units || data.units.length === 0) {
      this.ui.showBanner('NO SAVED GAME FOUND');
      return;
    }
    this.saveSlot = slot;
    this.restoreFromSave(data);
  }

  private restoreFromSave(data: GameSaveData): void {
    SoundFX.playTurnChime();
    this.ui.hideResultModal();

    // Re-hydrate gear from the current item table so balance changes apply to old saves
    this.squad = data.units
      .filter((u) => u.team === 'player')
      .map((u) => {
        for (const slot of Object.keys(u.equipment) as (keyof typeof u.equipment)[]) {
          const it = u.equipment[slot];
          u.equipment[slot] = it && ITEMS[it.id] ? ITEMS[it.id] : it;
        }
        // 0.8.2 renamed the starting squad; migrate saves that still carry the old names
        const renamed: Record<string, string> = { Ramza: 'Rowan', Agrias: 'Maren', Mustadio: 'Tobin', Kain: 'Corvin' };
        if (renamed[u.name]) u.name = renamed[u.name];
        u.isBoss = false;
        u.isEnraged = false;
        // 0.13.0 added jobs: bank starting JP for any job the save has never seen
        JobSystem.ensureJobPoints(u);
        return u;
      });

    // Starter gear added in later versions joins old armories too
    const owned = new Set<string>([...(data.armory || []), ...STARTING_ARMORY]);
    for (const u of this.squad) {
      for (const it of Object.values(u.equipment)) if (it) owned.add(it.id);
    }
    this.armory.length = 0;
    this.armory.push(...owned);
    // Equipment rules (0.30.0): gear a job can't use comes off, back to the armory
    const changed = this.squad.map((u) => ({ u, off: JobSystem.removeForbiddenGear(u) })).filter((c) => c.off.length);
    for (const { u, off } of changed) {
      this.ui.addLogEntry(`[GEAR] Each job now has its own gear. ${u.name} (${JOBS[u.jobId]?.name}) took off ${off.map((it) => it.name).join(', ')}: back in the armory.`, 'system');
    }

    this.campaignCleared = !!data.campaignCleared;
    this.difficulty = sanitizeDifficulty(data.difficulty);
    this.labelDifficulty();
    this.gil = typeof data.gil === 'number' && data.gil >= 0 ? Math.floor(data.gil) : STARTING_GIL;
    this.inventory = sanitizeInventory(data.inventory);
    this.skirmishWins = sanitizeSkirmishWins(data.skirmishWins);
    this.sideStoriesWon = sanitizeSideStories(data.sideStories);
    // Side battles won before 0.21.0 pay their trophy now
    for (const id of missingTrophies(this.skirmishWins, this.armory)) this.armory.push(id);
    let chapterId = CAMPAIGN_CHAPTERS[data.currentChapterId] ? data.currentChapterId : 'chapter_1';
    this.clearedChapters = sanitizeCleared(data.clearedChapters, chapterId);
    // A Trials save from before 0.15.0 has no list of won chapters, but the first act is certainly
    // over: it stands at the Summit, with Chapter IV ahead
    if (!Array.isArray(data.clearedChapters) && data.mode === 'trials' && this.campaignCleared) {
      this.clearedChapters = clearedAfterStory();
      chapterId = FIRST_ACT_FINALE;
    }
    this.campaignChapterId = chapterId;
    this.campSeen = sanitizeCampSeen(data.campSeen, this.clearedChapters);
    this.campMemories = campMemories(data.campMemories, this.campSeen);
    this.merchantSales = sanitizeMerchantSales(data.merchantSales);
    this.party = sanitizeParty(data.party);
    this.recruitHires = sanitizeRecruitHires(data.recruitHires);
    this.world.close();
    if (data.onWorldMap) {
      // Saved between missions: back to the map, where the squad was standing
      this.mode = data.mode === 'trials' ? 'trials' : 'campaign';
      this.customScenario = null;
      this.trialsFloor = Math.max(0, Math.floor(data.trialsFloor || 0));
      this.campaignChapterId = chapterId;
      this.ui.showBanner('SAVE FILE RESTORED!');
      this.openWorldMap(data.worldLocation);
    } else if (data.mode === 'trials' && data.trialsFloor) {
      this.ui.showBanner('SAVE FILE RESTORED!');
      this.startTrial(data.trialsFloor);
    } else {
      this.mode = 'campaign';
      this.customScenario = null;
      this.campaignChapterId = CAMPAIGN_CHAPTERS[data.currentChapterId] ? data.currentChapterId : 'chapter_1';
      this.setupBattle(CAMPAIGN_CHAPTERS[this.campaignChapterId]);
      this.ui.showBanner('SAVE FILE RESTORED!');
      this.startBattle();
    }
    this.ui.addLogEntry(`[SYSTEM] Save file from ${new Date(data.timestamp).toLocaleString()} restored.`, 'system');
  }

  private switchBattlefield(mapId: string): void {
    this.setupBattle(this.currentChapter, mapId);
    this.startBattle();
  }

  // ---------------------------------------------------------------------------
  // Turn flow
  // ---------------------------------------------------------------------------

  private startBattle(): void {
    this.battleStartInventory = { ...this.inventory };
    Music.playTrack('battle');
    SoundFX.playTurnChime();
    this.battleOver = false;
    this.currentMode = 'busy';
    this.ui.showBanner(`${this.currentChapter.title}: ${this.currentChapter.subtitle.toUpperCase()}`);
    this.ui.addLogEntry(`=== ${this.currentChapter.title}: ${this.currentChapter.subtitle} ===`, 'system');
    const boss = this.units.find((u) => u.isBoss && u.team === 'enemy');
    if (boss) this.ui.addLogEntry(`[BOSS] ${boss.name} commands the enemy. It will enrage at half HP!`, 'system');
    this.round = 1;
    this.roundActed.clear();
    this.held = 0;
    const obj = this.currentChapter.objective;
    if (obj?.type === 'boss') this.ui.addLogEntry(`[OBJECTIVE] Defeat ${boss ? boss.name : 'the boss'}.`, 'system');
    else if (obj?.type === 'survive') this.ui.addLogEntry(`[OBJECTIVE] Hold out for ${obj.rounds || 6} rounds. Round 1 begins!`, 'system');
    else if (obj?.type === 'hold') this.ui.addLogEntry(`[OBJECTIVE] Hold the marked ground: end ${holdGoal(obj)} rounds with your squad on it and no foe on it.`, 'system');
    this.updateTimeline();
    this.advanceTurn();
  }

  /** Logs a job level-up and any jobs it unlocked, and keeps them for the spoils screen. */
  private announceJobGain(u: Unit, gain: JpGain, float = true): void {
    if (!gain.leveledTo) return;
    const job = JOBS[u.jobId]?.name || u.jobId;
    const lv = gain.leveledTo >= MAX_JOB_LEVEL ? 'MASTER' : `Lv ${gain.leveledTo}`;
    const news = (this.jobNews[u.id] ||= []);
    news.push(`${job} ${lv}`);
    this.ui.addLogEntry(`[JOB] ${u.name}'s ${job} reached ${lv === 'MASTER' ? 'Master' : lv}!`, 'system');
    if (gain.mastery) {
      news.push(`MASTERY: ${gain.mastery}`);
      this.ui.addLogEntry(`[JOB] ${u.name} earns ${job} mastery: ${gain.mastery}, kept in every job.`, 'system');
      const sig = gain.leveledTo >= MAX_JOB_LEVEL ? SIGNATURES[u.jobId] : undefined;
      if (sig) {
        news.push(`★ ${sig.name}`);
        this.ui.addLogEntry(`[JOB] ${u.name} masters the ${job}: ★ ${sig.name} can now be used once per battle, in any job.`, 'system');
      }
      if (!u.isDead) this.scene.updateUnits(this.units);
    }
    for (const id of gain.unlocked) {
      news.push(`NEW JOB: ${JOBS[id].name}`);
      this.ui.addLogEntry(`[JOB] ${u.name} can now become a ${JOBS[id].name} (Team → Jobs).`, 'system');
    }
    if (float && !u.isDead) {
      const h = this.grid.getHeight(u.x, u.z);
      this.scene.spawnFloatingDamage(u.x, h + 0.7, u.z, gain.unlocked.length ? `NEW JOB: ${JOBS[gain.unlocked[0]].name}` : `${job} ${lv}`, 'heal');
    }
  }

  /** Reports turns that passed without the unit acting: asleep, or felled by poison. */
  private logSkippedTurns(): void {
    for (const t of this.turnManager.skipped) {
      const u = t.unit;
      const h = this.grid.getHeight(u.x, u.z);
      if (t.poison) {
        this.scene.spawnFloatingDamage(u.x, h, u.z, `POISON -${t.poison}`, 'damage');
        this.ui.addLogEntry(`[STATUS] ${u.name} takes ${t.poison} poison damage!`, 'spell');
      }
      if (t.regen) this.ui.addLogEntry(`[STATUS] ${u.name} regenerates ${t.regen} HP.`, 'heal');
      if (t.hazard) this.showHazard(u, t.hazard);
      if (t.totems) this.showPulses(u, t.totems);
      if (u.isDead && t.poison) this.ui.addLogEntry(`[DEFEAT] ${u.name} succumbs to poison!`, 'defeat');
      else if (t.slept) {
        this.scene.spawnFloatingDamage(u.x, h + 0.3, u.z, 'Zzz', 'miss');
        this.ui.addLogEntry(`[STATUS] ${u.name} is fast asleep and loses the turn.`, 'spell');
      }
    }
    if (this.turnManager.skipped.length) this.scene.updateUnits(this.units);
    this.turnManager.skipped = [];
  }

  private advanceTurn(): void {
    if (this.battleOver || this.checkBattleStatus()) return;

    const result = this.turnManager.advanceToNextActiveTurn();
    if (!result) {
      this.checkBattleStatus();
      return;
    }

    const { activeUnit, poisonDamage, regenHeal, totems, hazard } = result;
    this.logSkippedTurns();
    if (this.battleOver || this.checkBattleStatus()) return;
    if (!activeUnit.hasMoved && !activeUnit.hasActed && this.trackRound(activeUnit)) return;
    this.scene.setActiveUnit(activeUnit.id);
    this.currentMode = 'idle';
    this.scene.clearHighlights();

    const height = this.grid.getHeight(activeUnit.x, activeUnit.z);
    this.scene.focusOn(activeUnit.x, height, activeUnit.z);
    this.scene.setCursor(activeUnit.x, activeUnit.z);

    this.ui.addLogEntry(`[TURN] ${activeUnit.name} (${activeUnit.team.toUpperCase()}) is ready to act.`, 'turn');

    if (poisonDamage) {
      this.scene.spawnFloatingDamage(activeUnit.x, height, activeUnit.z, `POISON -${poisonDamage}`, 'damage');
      this.ui.addLogEntry(`[STATUS] ${activeUnit.name} takes ${poisonDamage} poison damage!`, 'spell');
      SoundFX.playCrit();
      this.scene.updateUnits(this.units);
    }
    if (regenHeal) {
      this.scene.spawnFloatingDamage(activeUnit.x, height, activeUnit.z, `REGEN +${regenHeal}`, 'heal');
      this.ui.addLogEntry(`[STATUS] ${activeUnit.name} regenerates ${regenHeal} HP.`, 'heal');
      this.scene.updateUnits(this.units);
    }
    this.showHazard(activeUnit, hazard);
    this.showPulses(activeUnit, totems);

    // A grand summon called last turn lands before the unit acts (0.24.0)
    const call = callDue(activeUnit);
    this.callsShown.delete(activeUnit.id);
    if (call && call !== 'broken') {
      this.currentMode = 'busy';
      this.ui.addLogEntry(`[SUMMON] ${activeUnit.name}'s ${call.ability.name} arrives!`, 'spell');
      void this.performAction(activeUnit, call.ability, call.x, call.z, { called: true }).then(() => {
        if (this.battleOver || this.checkBattleStatus()) return;
        if (activeUnit.isDead) {
          this.turnManager.endTurn(activeUnit);
          later(() => this.advanceTurn(), 600);
          return;
        }
        this.updateTimeline();
        this.continueTurnStart(activeUnit, height);
      });
      return;
    }
    if (call === 'broken') this.ui.addLogEntry(`[SUMMON] ${activeUnit.name}'s call fades: nothing comes.`, 'system');
    this.refreshCallMarkers();
    this.continueTurnStart(activeUnit, height);
  }

  /** The rest of a turn's start: a song or dance plays again, then the unit gets control. */
  private continueTurnStart(activeUnit: Unit, height: number): void {
    // A song or dance still playing goes again before the unit acts (0.22.0)
    const encore = encoreDue(activeUnit);
    if (encore) {
      this.currentMode = 'busy';
      void this.performAction(activeUnit, encore, activeUnit.x, activeUnit.z, { encore: true }).then(() => {
        if (this.battleOver || this.checkBattleStatus()) return;
        if (activeUnit.isDead) {
          // Felled by a counter in the middle of the dance
          this.turnManager.endTurn(activeUnit);
          later(() => this.advanceTurn(), 600);
          return;
        }
        this.updateTimeline();
        this.beginTurnControl(activeUnit, height);
      });
      return;
    }
    this.beginTurnControl(activeUnit, height);
  }

  /** Hands the turn to the player, or to the AI. */
  private beginTurnControl(activeUnit: Unit, height: number): void {
    this.currentMode = 'idle';
    this.ui.updateUnitCard(activeUnit, height);
    this.ui.populateActionSubMenu(activeUnit, this.grid.getTile(activeUnit.x, activeUnit.z)?.terrain);
    this.ui.updateTurnTimeline(this.turnManager.predictTurnTimeline(8), activeUnit);
    this.ui.showBanner(`${activeUnit.name.toUpperCase()}'s TURN`);

    if (activeUnit.team === 'player') {
      SoundFX.playTurnChime();
      this.tip('firstTurn');
    } else {
      this.currentMode = 'busy';
      later(() => this.runAiTurn(activeUnit), 800);
    }
  }

  private handleMoveCommand(): void {
    const active = this.turnManager.activeUnit;
    if (!active || active.team !== 'player' || this.currentMode === 'busy') return;
    if (active.hasMoved) {
      if (this.canUndoMove(active)) this.undoMove(active);
      return;
    }
    if (active.move === 0) return;

    this.currentMode = 'moving';
    this.tip('moveMode');
    (document.activeElement as HTMLElement | null)?.blur();
    this.scene.setHighlights(this.grid.getReachableTiles(active, this.units), 0x3b82f6);
    this.scene.setCursor(active.x, active.z);
  }

  /** Shows a first-time tip, in story battles only (the Trials and the Workshop are for players who know). */
  private tip(id: TipId): void {
    if (this.battleOver || this.mode === 'trials' || this.mode === 'custom' || this.workshop?.isOpen) return;
    if (this.turnManager?.activeUnit?.team !== 'player' && id !== 'fallen' && id !== 'enemyCall') return;
    this.tutor.show(id);
  }

  private canUndoMove(unit: Unit): boolean {
    return !!this.moveUndo && this.moveUndo.unitId === unit.id && unit.hasMoved && !unit.hasActed && !this.battleOver;
  }

  /** Puts the active unit back where it stood before this turn's move, as if it had not moved. */
  private undoMove(active: Unit): void {
    const u = this.moveUndo;
    if (!u || !this.canUndoMove(active)) return;
    this.moveUndo = null;
    this.cancelTargeting();
    document.getElementById('facing-selector')!.classList.add('hidden');
    this.scene.cancelWalk(active.id);
    active.x = u.x;
    active.z = u.z;
    active.facing = u.facing;
    active.currentHp = u.hp; // anything gained on the way (Lifefont) goes back too
    active.currentMp = u.mp;
    if (u.performing && u.encore) {
      active.performing = u.performing;
      if (!active.statuses.some((st) => st.type === 'encore')) active.statuses.push({ type: 'encore', duration: u.encore });
    }
    active.hasMoved = false;
    this.currentMode = 'idle';
    SoundFX.playMenuBlip();
    this.scene.clearHighlights();
    this.scene.updateUnits(this.units);
    const h = this.grid.getHeight(active.x, active.z);
    this.scene.setCursor(active.x, active.z);
    this.scene.focusOn(active.x, h, active.z);
    this.ui.updateUnitCard(active, h);
    this.ui.populateActionSubMenu(active, this.grid.getTile(active.x, active.z)?.terrain);
    this.ui.showBanner('MOVE TAKEN BACK');
    this.ui.focusForNav(document.getElementById('btn-action-move'));
  }

  private handleAbilityCommand(raw: Ability): void {
    const active = this.turnManager.activeUnit;
    if (!active || active.hasActed || active.team !== 'player' || this.currentMode === 'busy') return;
    if (!JobSystem.canAfford(active, raw)) return;

    let ability = resolveTerrainAbility(raw, this.grid.getTile(active.x, active.z)?.terrain);
    // Pharmacology: items reach a tile further in a Chemist-trained hand
    if (ability.item && JobSystem.itemPotency(active) > 1) ability = { ...ability, range: ability.range + 1 };
    ability = performedBy(active, ability); // Resonance: a tile further
    this.selectedAbility = ability;

    if (ability.isSelfOnly) {
      void this.executePlayerAction(active, ability, active.x, active.z);
      return;
    }

    if (isCentered(ability)) {
      // A song or dance fills the area around the performer: show it, and any tile in it confirms
      const area = this.grid.mapData.tiles.filter((t) => t.walkable && Math.abs(t.x - active.x) + Math.abs(t.z - active.z) <= ability.aoe);
      this.currentMode = 'targeting';
      this.tip('targeting');
      (document.activeElement as HTMLElement | null)?.blur();
      this.scene.setHighlights(area, CombatEngine.isSupportive(ability) ? 0x22c55e : 0xdc2626);
      this.scene.setCursor(active.x, active.z);
      return;
    }

    const supportive = CombatEngine.isSupportive(ability);
    this.totemAim = null;
    let tiles = this.grid.mapData.tiles.filter((t) =>
      this.grid.canTarget(active.x, active.z, t.x, t.z, ability.range, ability.heightTolerance, supportive || !!ability.totem || !!ability.trap)
    );
    // A trap goes on free ground (0.49.0)
    if (ability.trap && !ability.aoe) tiles = tiles.filter((t) => this.trapFree(t.x, t.z));
    if (ability.revive) {
      // Only the tiles where a fallen ally can be raised
      tiles = tiles.filter((t) => this.victimsFor(active, ability, t.x, t.z).length > 0);
      if (tiles.length === 0) {
        this.ui.showBanner('NO FALLEN ALLY IN REACH');
        this.selectedAbility = null;
        return;
      }
    }
    this.currentMode = 'targeting';
    this.tip('targeting');
    (document.activeElement as HTMLElement | null)?.blur();
    this.scene.setHighlights(tiles, ability.trap ? 0xf59e0b : supportive || this.totemHelps(ability) ? 0x22c55e : 0xdc2626);
  }

  /** Free ground for a trap: walkable, nobody on it, no trap there yet (0.49.0). */
  private trapFree(x: number, z: number): boolean {
    return !!this.grid.getTile(x, z)?.walkable && !this.units.some((u) => !u.isDead && u.x === x && u.z === z) && !trapAt(this.units, x, z);
  }

  /** True for a totem that works for its Shaman's side: Mending, Warding, Ancestral (0.47.0). */
  private totemHelps(ability: Ability): boolean {
    return ability.totem === 'mending' || ability.totem === 'warding' || ability.totem === 'ancestral';
  }

  private handleWaitCommand(): void {
    const active = this.turnManager.activeUnit;
    if (!active || active.team !== 'player') return;

    this.currentMode = 'facing';
    this.tip('facing');
    this.scene.clearHighlights();
    this.ui.showFacingSelector(active.facing);
  }

  private handleFacingConfirmed(facing: FacingDirection): void {
    const active = this.turnManager.activeUnit;
    if (!active) return;

    active.facing = facing;
    this.moveUndo = null;
    this.tutor.hide();
    this.scene.updateUnits(this.units);
    this.turnManager.endTurn(active);
    this.updateTimeline();

    if (!this.checkBattleStatus()) {
      this.currentMode = 'busy';
      later(() => this.advanceTurn(), 400);
    }
  }

  private onCanvasClick(): void {
    const hovered = this.scene.hoveredTile;
    if (!hovered) return;
    let tile = hovered;

    if (this.workshop.isOpen) {
      this.workshop.applyAt(tile.x, tile.z);
      return;
    }

    const active = this.turnManager.activeUnit;
    if (!active) return;

    if (this.currentMode === 'idle') {
      const clickedUnit = this.units.find((u) => !u.isDead && u.x === tile.x && u.z === tile.z);
      if (clickedUnit) {
        SoundFX.playMenuBlip();
        const height = this.grid.getHeight(clickedUnit.x, clickedUnit.z);
        this.scene.focusOn(clickedUnit.x, height, clickedUnit.z);
        this.ui.updateUnitCard(clickedUnit, height);
      }
    } else if (this.currentMode === 'moving' && active.team === 'player') {
      const dest = this.grid.getReachableTiles(active, this.units).find((r) => r.x === tile.x && r.z === tile.z);
      if (!dest) return;

      SoundFX.playMoveStep();
      // Until the unit acts, the move can be taken back (UNDO): remember where it stood and what it had
      const encore = active.statuses.find((st) => st.type === 'encore')?.duration;
      this.moveUndo = active.hasActed ? null : { unitId: active.id, x: active.x, z: active.z, facing: active.facing, hp: active.currentHp, mp: active.currentMp, performing: active.performing, encore };
      // A foe's trap on the way stops the walk on it (0.49.0)
      const path = this.grid.findPath(active, this.units, tile.x, tile.z);
      const trapped = walkInto(this.actionContext(), active, { x: tile.x, z: tile.z });
      this.scene.walkPath(active.id, trapped && path ? path.slice(0, path.findIndex((p) => p.x === trapped.stopAt.x && p.z === trapped.stopAt.z) + 1) : path);
      if (!trapped) {
        active.x = tile.x;
        active.z = tile.z;
      }
      active.hasMoved = true;
      // Walking off ends a song or dance (UNDO brings it back)
      if (endPerformance(active)) this.ui.addLogEntry(`[PERFORMANCE] ${active.name} stops performing to move.`, 'system');
      this.applyRegenWalk(active, dest.cost);
      if (this.moveUndo) this.tip('moved');
      this.scene.updateUnits(this.units);
      this.scene.clearHighlights();
      this.currentMode = 'idle';

      this.ui.updateUnitCard(active, this.grid.getHeight(active.x, active.z));
      // Terrain-driven spells change with the ground: refresh the action list
      this.ui.populateActionSubMenu(active, this.grid.getTile(active.x, active.z)?.terrain);

      if (trapped) {
        // There's no taking back a sprung trap
        this.moveUndo = null;
        void this.showTrap(active, trapped).then(() => {
          if (this.battleOver || this.checkBattleStatus()) return;
          if (active.isDead || active.statuses.some((s) => s.type === 'sleep')) {
            this.turnManager.endTurn(active);
            this.updateTimeline();
            this.currentMode = 'busy';
            later(() => this.advanceTurn(), 600);
          } else if (active.hasActed) this.handleWaitCommand();
        });
        return;
      }
      if (active.hasActed) this.handleWaitCommand();
    } else if (this.currentMode === 'targeting' && this.selectedAbility && active.team === 'player') {
      const ability = this.selectedAbility;
      const supportive = CombatEngine.isSupportive(ability);
      if (ability.totem || ability.trap) {
        // A totem (0.47.0) or a trap (0.49.0) goes on ground, not on someone: the first click shows
        // where it lands, the second sets it
        if (!this.grid.canTarget(active.x, active.z, tile.x, tile.z, ability.range, ability.heightTolerance, true)) {
          this.ui.showBanner('OUT OF RANGE');
          return;
        }
        if (ability.trap && !ability.aoe && !this.trapFree(tile.x, tile.z)) {
          this.ui.showBanner('NO ROOM FOR A TRAP THERE');
          return;
        }
        if (this.totemAim && this.totemAim.x === tile.x && this.totemAim.z === tile.z) {
          this.totemAim = null;
          SoundFX.playMenuBlip();
          void this.executePlayerAction(active, ability, tile.x, tile.z);
          return;
        }
        this.totemAim = { x: tile.x, z: tile.z };
        SoundFX.playMenuBlip();
        const area = { x: tile.x, z: tile.z, radius: ability.aoe };
        const reach = this.grid.mapData.tiles.filter((t) => t.walkable && inReach({ kind: 'mending', turns: 0, ...area }, t.x, t.z) && (!ability.trap || this.trapFree(t.x, t.z)));
        this.scene.setHighlights(reach, ability.trap ? 0xf59e0b : this.totemHelps(ability) ? 0x22c55e : 0xdc2626);
        this.scene.setCursor(tile.x, tile.z);
        this.ui.showBanner(ability.trap ? 'SELECT AGAIN TO HIDE IT HERE' : 'ITS REACH · SELECT AGAIN TO PLANT');
        return;
      }
      if (isCentered(ability)) {
        // Any tile of the area confirms: the performance is centred on the performer
        if (Math.abs(tile.x - active.x) + Math.abs(tile.z - active.z) > ability.aoe) {
          this.ui.showBanner('OUTSIDE THE AREA');
          return;
        }
        tile = { ...tile, x: active.x, z: active.z };
      } else if (!this.grid.canTarget(active.x, active.z, tile.x, tile.z, ability.range, ability.heightTolerance, supportive)) {
        this.ui.showBanner('OUT OF RANGE');
        return;
      }

      const victims = this.victimsFor(active, ability, tile.x, tile.z);
      if (victims.length === 0) {
        this.ui.showBanner(ability.aoe > 0 ? 'NO TARGETS IN AREA' : 'NO TARGET THERE');
        return;
      }

      SoundFX.playMenuBlip();
      // Preview the unit on the clicked tile, or the first unit caught in the blast
      const primary = victims.find((v) => v.x === tile.x && v.z === tile.z) || victims[0];
      this.currentForecast = this.forecastFor(active, primary, ability, { x: tile.x, z: tile.z });
      this.targetTile = { x: tile.x, z: tile.z };
      this.ui.showCombatForecast(this.currentForecast, victims.length - 1);
      this.tip('forecast');
    }
  }

  private applyRegenWalk(unit: Unit, steps: number): void {
    if (unit.equippedAbilities.movement === 'mo_ki_flow' && steps > 0) {
      const pct = Math.min(0.3, 0.06 * steps);
      const hp = Math.min(unit.maxHp - unit.currentHp, Math.round(unit.maxHp * pct));
      const mp = Math.min(unit.maxMp - unit.currentMp, Math.round(unit.maxMp * pct));
      unit.currentHp += hp;
      unit.currentMp += mp;
      if (hp > 0 || mp > 0) {
        const h = this.grid.getHeight(unit.x, unit.z);
        this.scene.spawnFloatingDamage(unit.x, h, unit.z, `KI +${hp} HP +${mp} MP`, 'heal');
      }
      return;
    }
    if (unit.equippedAbilities.movement !== 'wm_regen_move' || unit.currentHp >= unit.maxHp) return;
    const heal = Math.round(unit.maxHp * Math.min(0.4, 0.1 * steps));
    unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
    const h = this.grid.getHeight(unit.x, unit.z);
    this.scene.spawnFloatingDamage(unit.x, h, unit.z, `REGEN +${heal}`, 'heal');
  }

  private handleExecuteAttack(): void {
    if (!this.currentForecast || !this.targetTile) return;
    const { attacker, ability } = this.currentForecast;
    const tile = this.targetTile;
    this.currentForecast = null;
    this.targetTile = null;
    void this.executePlayerAction(attacker, ability, tile.x, tile.z);
  }

  private async executePlayerAction(active: Unit, ability: Ability, tx: number, tz: number): Promise<void> {
    this.currentMode = 'busy';
    this.scene.clearHighlights();
    await this.performAction(active, ability, tx, tz);
    this.selectedAbility = null;

    if (this.battleOver || this.checkBattleStatus()) return;

    this.currentMode = 'idle';
    this.ui.updateUnitCard(active, this.grid.getHeight(active.x, active.z));
    this.updateTimeline();

    if (active.isDead) {
      // Felled by a counter: their turn ends
      this.turnManager.endTurn(active);
      this.currentMode = 'busy';
      later(() => this.advanceTurn(), 600);
    } else if (active.hasMoved) {
      later(() => this.handleWaitCommand(), 500);
    }
  }

  private cancelTargeting(): void {
    this.currentMode = 'idle';
    this.selectedAbility = null;
    this.currentForecast = null;
    this.targetTile = null;
    this.scene.clearHighlights();
  }

  // ---------------------------------------------------------------------------
  // Shared action resolution (player + enemy)
  // ---------------------------------------------------------------------------

  /** Shows a sprung trap: the snap, what it did, and the Ranger's Ambush shot (0.49.0). */
  private async showTrap(u: Unit, t: TrapStep): Promise<void> {
    const s = t.sprung;
    const h = this.grid.getHeight(u.x, u.z);
    const NAMES: Record<string, string> = { snare: 'snare', spikes: 'spike trap', slumber: 'slumber trap', smoke: 'smoke trap' };
    SoundFX.playSwordSlash();
    this.scene.updateUnits(this.units);
    this.scene.focusOn(u.x, h, u.z);
    this.scene.spawnFloatingDamage(u.x, h + 0.5, u.z, 'TRAP!', 'damage');
    this.ui.addLogEntry(`[TRAP] ${u.name} walks into ${s.owner.name}'s ${NAMES[s.kind]}!`, 'spell');
    await wait(350);
    if (s.damage) {
      this.scene.spawnFloatingDamage(u.x, h, u.z, `-${s.damage}`, 'damage');
      this.ui.addLogEntry(`[TRAP] The spikes deal ${s.damage} damage.`, 'attack');
    }
    if (s.status) {
      this.fx.status(u, s.status);
      this.scene.spawnFloatingDamage(u.x, h + 0.3, u.z, s.status.toUpperCase(), 'miss');
      this.ui.addLogEntry(`[TRAP] ${u.name} is ${s.status === 'immobilize' ? 'caught fast' : s.status === 'sleep' ? 'put to sleep' : 'Blinded by smoke'}.`, 'spell');
    }
    if (t.ambush) {
      await wait(300);
      const a = t.ambush;
      this.scene.spawnFloatingDamage(u.x, h + 0.15, u.z, a.hit ? `AMBUSH -${a.damageDealt}` : 'MISS', a.hit ? 'damage' : 'miss');
      this.ui.addLogEntry(a.hit ? `[REACTION] Ambush! ${s.owner.name} shoots ${u.name} for ${a.damageDealt}.` : `[REACTION] ${s.owner.name}'s Ambush shot misses.`, a.hit ? 'reaction' : 'system');
    }
    if (u.isDead) this.ui.addLogEntry(`[DEFEAT] ${u.name} has fallen!`, 'defeat');
    this.scene.updateUnits(this.units);
    this.ui.updateUnitCard(u, h);
    await wait(450);
  }

  /** Floats and logs what the ground did to a unit starting its turn (0.48.0). */
  private showHazard(u: Unit, p: HazardPulse | undefined): void {
    if (!p) return;
    const h = this.grid.getHeight(u.x, u.z);
    if (p.damage) {
      this.scene.spawnFloatingDamage(u.x, h, u.z, `EMBERS -${p.damage}`, 'damage');
      this.ui.addLogEntry(`[GROUND] ${u.name} is burned by the embers: ${p.damage} damage.`, 'spell');
      if (u.isDead) this.ui.addLogEntry(`[DEFEAT] ${u.name} falls in the embers!`, 'defeat');
    }
    if (p.status === 'poison') {
      this.fx.status(u, 'poison');
      this.scene.spawnFloatingDamage(u.x, h + 0.3, u.z, 'MIASMA', 'miss');
      this.ui.addLogEntry(`[GROUND] ${u.name} breathes the miasma and is Poisoned.`, 'spell');
    }
    if (p.heal || p.cured) {
      this.scene.spawnFloatingDamage(u.x, h, u.z, p.heal ? `SPRING +${p.heal}` : 'CLEANSED', 'heal');
      this.ui.addLogEntry(`[GROUND] The spring ${p.heal ? `mends ${u.name}: +${p.heal} HP` : `washes ${u.name} clean`}${p.heal && p.cured ? ', and washes off the Poison' : ''}.`, 'heal');
    }
    this.scene.updateUnits(this.units);
  }

  /** Floats and logs what totems did to a unit (0.47.0). */
  private showPulses(u: Unit, pulses: TotemPulse[] | undefined): void {
    if (!pulses?.length) return;
    const t = sumPulses(pulses);
    const h = this.grid.getHeight(u.x, u.z);
    if (t.heal) {
      this.scene.spawnFloatingDamage(u.x, h, u.z, `TOTEM +${t.heal}`, 'heal');
      this.ui.addLogEntry(`[TOTEM] The spirits mend ${u.name}: +${t.heal} HP.`, 'heal');
    }
    if (t.damage) {
      this.scene.spawnFloatingDamage(u.x, h, u.z, `STORM -${t.damage}`, 'damage');
      this.ui.addLogEntry(`[TOTEM] Lightning strikes ${u.name} for ${t.damage}.`, 'spell');
    }
    for (const s of t.statuses) {
      this.fx.status(u, s);
      this.scene.spawnFloatingDamage(u.x, h + 0.35, u.z, s.toUpperCase(), s === 'slow' ? 'miss' : 'heal');
      this.ui.addLogEntry(`[TOTEM] ${u.name} is ${s === 'slow' ? 'Slowed' : 'Protected'} by a totem.`, 'spell');
    }
    if (u.isDead) this.ui.addLogEntry(`[DEFEAT] ${u.name} falls to the storm!`, 'defeat');
    this.scene.updateUnits(this.units);
  }

  /** Units an ability aimed at (tx, tz) will affect. Single-target abilities hit whoever is on the tile. */
  private victimsFor(caster: Unit, ability: Ability, tx: number, tz: number): Unit[] {
    return victimsFor(this.units, caster, ability, tx, tz);
  }

  private forecastFor(attacker: Unit, target: Unit, ability: Ability, aim?: { x: number; z: number }): CombatForecast {
    return forecastFor(this.grid, attacker, target, ability, aim);
  }

  /** What the rules need from the game to resolve an action (0.41.0). */
  private actionContext(): ActionContext {
    return {
      units: this.units,
      grid: this.grid,
      rng: this.rng,
      rules: CAMPAIGN_RULES,
      // An enemy's item comes out of its own pouch (0.31.0); the squad's from the inventory
      pouchOf: (caster) => (caster.team === 'enemy' ? caster.pouch : this.inventory)
    };
  }

  /**
   * Resolves an ability: spends MP once, then rolls it against every unit it touches,
   * plays effects, handles reactions, boss enrage, and awards EXP/JP to player units.
   */
  private async performAction(caster: Unit, ability: Ability, tx: number, tz: number, opts: { encore?: boolean; called?: boolean } = {}): Promise<void> {
    const encore = !!opts.encore;
    const called = !!opts.called;
    if (!encore && !called) this.moveUndo = null; // acting commits the move
    // The rules happen in core/Action.ts; this shows each step as it comes (0.41.0)
    const run = resolveAction(this.actionContext(), caster, ability, tx, tz, opts);
    const first = run.next();
    if (first.done || first.value.kind !== 'start') return;
    const { victims, calling, summoning, faced, performanceEnded, hpPaid, totem, pulses, trapsSet } = first.value;
    if (performanceEnded) this.ui.addLogEntry(`[PERFORMANCE] ${caster.name} stops performing.`, 'system');
    if (hpPaid > 0) {
      // A Dark Knight's price, paid in blood (0.46.0)
      this.scene.spawnFloatingDamage(caster.x, this.grid.getHeight(caster.x, caster.z) + 0.3, caster.z, `-${hpPaid} HP`, 'damage');
      this.ui.addLogEntry(`[BLOOD] ${caster.name} pays ${hpPaid} HP.`, 'system');
    }
    if (totem) {
      // A Shaman plants a totem (0.47.0): it pulses at once on everyone in reach
      SoundFX.playMagicCast();
      this.scene.spawnFloatingDamage(totem.x, this.grid.getHeight(totem.x, totem.z) + 0.6, totem.z, `✦ ${ability.name.toUpperCase()}`, 'heal');
      this.ui.addLogEntry(`[TOTEM] ${caster.name} plants a ${ability.name}. It stands for ${totem.turns} of ${caster.name}'s turns.`, 'spell');
      for (const p of pulses ?? []) this.showPulses(p.unit, p.pulses);
    }
    if (trapsSet) {
      // A Ranger hides traps (0.49.0). The other side sees only that something was hidden
      SoundFX.playMoveStep();
      const ours = caster.team === 'player';
      if (ours) for (const t of trapsSet) this.scene.spawnFloatingDamage(t.x, this.grid.getHeight(t.x, t.z) + 0.4, t.z, 'TRAP SET', 'heal');
      this.ui.addLogEntry(ours ? `[TRAP] ${caster.name} hides ${trapsSet.length === 1 ? `a ${ability.name.toLowerCase()}` : `${trapsSet.length} traps`}. Foes won't see ${trapsSet.length === 1 ? 'it' : 'them'}.`
        : `[TRAP] ${caster.name} hides something on the ground...`, 'spell');
      this.scene.updateUnits(this.units);
    }

    if (faced && !called) this.scene.triggerUnitLunge(caster.id, tx, tz);
    this.scene.updateUnits(this.units);

    if (calling) {
      SoundFX.playMagicCast();
      this.fx.status(caster, 'calling');
      this.scene.spawnFloatingDamage(caster.x, this.grid.getHeight(caster.x, caster.z) + 0.5, caster.z, `✦ ${ability.name.toUpperCase()}`, 'heal');
      this.ui.addLogEntry(`[SUMMON] ${caster.name} begins calling ${ability.name}. It lands on the marked tiles at the start of ${caster.name}'s next turn.`, 'spell');
      this.ui.showBanner(caster.team === 'enemy' ? `${caster.name} calls ${ability.name}! Get clear!` : `CALLING ${ability.name.toUpperCase()}…`);
      this.refreshCallMarkers();
      if (caster.team === 'enemy') this.tip('enemyCall');
    }

    const verb = caster.team === 'player' ? 'executes' : 'uses';
    const targetText = ability.isSelfOnly ? 'self' : victims.length > 1 ? `${victims.length} units` : victims[0]?.name || (isCentered(ability) ? 'nobody in reach' : 'empty ground');
    if (calling || totem || trapsSet) {
      // logged above
    } else if (called) {
      this.ui.addLogEntry(`[SUMMON] ${ability.name} falls on ${targetText}.`, 'spell');
    } else if (encore) {
      this.ui.addLogEntry(`[ENCORE] ${caster.name}'s ${ability.name} plays on (${targetText}).`, 'spell');
      this.scene.spawnFloatingDamage(caster.x, this.grid.getHeight(caster.x, caster.z) + 0.5, caster.z, `♪ ${ability.name.toUpperCase()}`, 'heal');
    } else {
      this.ui.addLogEntry(`[ACTION] ${caster.name} ${verb} ${ability.name} on ${targetText}.`, 'attack');
      if (ability.performance) this.ui.addLogEntry(`[PERFORMANCE] ${caster.name} will keep it up while holding this spot.`, 'system');
    }
    // (a summon's name floats over its caster instead of a banner that would hide the creature)
    if (caster.team === 'enemy' && !encore && !calling && !summoning) this.ui.showBanner(`${caster.name}: ${ability.name}!`);

    // The summoned creature appears over the area: the camera comes in, the board darkens, and
    // the blows land with it (0.24.0)
    if (summoning) {
      const at = isCentered(ability) ? caster : { x: tx, z: tz };
      this.scene.spawnFloatingDamage(caster.x, this.grid.getHeight(caster.x, caster.z) + 0.6, caster.z, `✦ ${ability.name.toUpperCase()}`, 'crit');
      this.scene.summonView(at.x, this.grid.getHeight(at.x, at.z), at.z, 4.4 + ability.aoe * 0.6);
      this.scene.dim(ability.charge ? 0.62 : 0.5);
      await wait(320);
      SoundFX.playMagicCast();
      const lands = this.fx.summon(ability, at, 1 / SPEED);
      await new Promise((r) => setTimeout(r, lands * 1000));
      this.scene.vfx.triggerScreenShake(ability.charge ? 0.75 : 0.45);
      this.pad.rumble(ability.charge ? 0.7 : 0.4, 220);
      later(() => this.scene.dim(0), 700);
    }

    // An arrow or a ball in flight lands before the blow does; an area spell bursts over its area (0.38.0)
    if (!calling && !summoning) {
      const flight = this.fx.launch(caster, ability, tx, tz, 1 / SPEED);
      if (flight > 0) await wait((flight * 1000) / SPEED);
      if (victims.length) this.fx.area(ability, { x: tx, z: tz });
    }

    // Each blow is rolled only when the previous one has been shown
    let step = run.next();
    while (!step.done) {
      const { target, forecast, result, killed } = step.value as ActionHit;
      this.presentResult(target, forecast, result);
      if (target.isDead && target.team === 'player') this.tip('fallen');
      if (killed && caster.team === 'player') this.kills[caster.id] = (this.kills[caster.id] || 0) + 1;
      if (result.reaction && result.reaction.type !== 'parry') {
        await wait(380);
        this.presentReaction(caster, target, result);
      }
      if (!caster.isDead) await wait(victims.length > 1 ? 220 : 120);
      step = run.next();
    }

    // Player progression: JP for the current job, EXP for acting and for kills
    const end = step.value;
    if (end.summonLevels > 0) this.ui.addLogEntry(`[LEVEL] ${caster.name} reached level ${caster.level}!`, 'system');
    if (end.jp) this.announceJobGain(caster, end.jp);
    if (end.levels > 0) {
      const h = this.grid.getHeight(caster.x, caster.z);
      this.scene.spawnFloatingDamage(caster.x, h + 0.4, caster.z, `LEVEL UP! Lv ${caster.level}`, 'heal');
      this.fx.levelUp(caster);
      this.ui.addLogEntry(`[LEVEL] ${caster.name} reached level ${caster.level}!`, 'system');
      SoundFX.playVictoryFanfare();
    }

    this.scene.updateUnits(this.units);
    this.refreshCallMarkers();
    if (summoning) {
      // let the creature finish before the camera pulls back
      await wait(700);
      this.scene.restoreView();
    }
    await wait(250);
  }

  /**
   * Shows every grand summon still on its way, and logs any call that was broken since the last
   * look (its caster fell, fell asleep or was silenced) (0.24.0).
   */
  private refreshCallMarkers(): void {
    const live = this.units.filter((u) => callHolds(u));
    for (const id of this.callsShown) {
      const u = this.units.find((x) => x.id === id);
      if (u && live.includes(u)) continue;
      if (u) {
        breakCall(u);
        this.ui.addLogEntry(`[SUMMON] ${u.name}'s call is broken!`, 'reaction');
        this.ui.showBanner('THE CALL IS BROKEN!');
      }
    }
    this.callsShown = new Set(live.map((u) => u.id));
    const { width, depth } = this.grid.mapData;
    this.scene.setCallMarkers(live.map((u) => ({ tiles: callArea(u, width, depth), color: u.team === 'player' ? 0xa855f7 : 0xf97316 })));
  }

  private presentResult(target: Unit, forecast: CombatForecast, result: AttackResult): void {
    const h = this.grid.getHeight(target.x, target.z);
    const ability = forecast.ability;

    if (result.revived) {
      SoundFX.playHeal();
      this.scene.updateUnits(this.units);
      this.fx.heal(target);
      this.scene.spawnFloatingDamage(target.x, h, target.z, 'REVIVED', 'heal');
      this.ui.addLogEntry(`[${ability.item ? 'ITEM' : 'RAISE'}] ${target.name} is back on their feet with ${result.damageDealt} HP!`, 'heal');
      this.updateTimeline();
      return;
    }
    if (ability.item && result.hit && !result.isHeal && result.damageDealt === 0 && result.cleansed === undefined) {
      // An Ether (or an item with nothing left to do)
      SoundFX.playHeal();
      this.fx.heal(target);
      this.scene.spawnFloatingDamage(target.x, h, target.z, result.mpRestored ? `MP +${result.mpRestored}` : 'NO EFFECT', result.mpRestored ? 'heal' : 'miss');
      this.ui.addLogEntry(`[ITEM] ${target.name} recovers ${result.mpRestored || 0} MP.`, 'heal');
      return;
    }

    if (!result.hit) {
      SoundFX.playMenuBlip();
      this.scene.spawnFloatingDamage(target.x, h, target.z, ability.item ? 'NO EFFECT' : 'MISS', 'miss');
      if (result.reaction?.type === 'parry') {
        this.ui.showBanner(result.reaction.description);
        this.ui.addLogEntry(`[PARRY] ${result.reaction.description}`, 'reaction');
      } else {
        this.ui.addLogEntry(`[MISS] ${ability.name} missed ${target.name}.`, 'attack');
      }
      return;
    }

    if (result.stolen) {
      const item = result.stolen;
      SoundFX.playTurnChime();
      this.fx.steal(target);
      this.scene.spawnFloatingDamage(target.x, h, target.z, `STOLE ${item.name.toUpperCase()}`, 'heal');
      const thief = forecast.attacker;
      if (thief.team === 'player' && !this.armory.includes(item.id)) {
        this.armory.push(item.id);
        this.stolenThisBattle.push(item.id);
        this.ui.addLogEntry(`[STEAL] ${thief.name} steals ${item.name} from ${target.name}! It's in your armory now.`, 'reaction');
      } else if (thief.team === 'player') {
        // The squad already owns one: it's fenced for half its price
        const gil = resaleValue(item);
        this.gil += gil;
        this.fencedThisBattle += gil;
        this.ui.addLogEntry(`[STEAL] ${thief.name} steals ${item.name} from ${target.name} and fences it for ${gil} gil.`, 'reaction');
      } else {
        this.ui.addLogEntry(`[STEAL] ${thief.name} steals ${item.name} from ${target.name}.`, 'reaction');
      }
      this.ui.showBanner(`STOLE ${item.name.toUpperCase()}!`);
      return;
    }

    // Tame (0.28.0): the monster changes sides
    if (result.tamed) {
      SoundFX.playTurnChime();
      this.fx.tame(target);
      this.scene.updateUnits(this.units);
      this.scene.spawnFloatingDamage(target.x, h, target.z, 'TAMED!', 'heal');
      this.ui.showBanner(`${target.name.toUpperCase()} IS TAMED!`);
      this.ui.addLogEntry(`[TAME] ${forecast.attacker.name} wins ${target.name} over. It fights for you now${this.mode === 'custom' ? '' : ', and joins the squad if it lives to see the victory'}.`, 'reaction');
      this.tip('tamed');
      this.updateTimeline();
      return;
    }

    if (result.isHeal) {
      SoundFX.playHeal();
      this.fx.heal(target);
      this.scene.spawnFloatingDamage(target.x, h, target.z, `+${result.damageDealt}`, 'heal');
      this.ui.addLogEntry(`[HEAL] ${target.name} recovers ${result.damageDealt} HP${result.cleansed ? ' and is cleansed' : ''}.`, 'heal');
      if (result.appliedStatus) later(() => this.fx.status(target, result.appliedStatus?.toLowerCase()), 350);
      return;
    }

    if (result.damageDealt === 0 && (result.resisted || result.cleansed !== undefined)) {
      SoundFX.playMagicCast();
      if (result.resisted) {
        this.scene.spawnFloatingDamage(target.x, h, target.z, 'RESIST', 'miss');
        this.ui.addLogEntry(`[RESIST] ${target.name}'s gear wards off ${ability.appliesStatus}.`, 'spell');
      } else {
        this.fx.cleanse(target);
        this.scene.spawnFloatingDamage(target.x, h, target.z, result.cleansed ? 'CLEANSED' : 'NO AILMENTS', result.cleansed ? 'heal' : 'miss');
        this.ui.addLogEntry(`[STATUS] ${target.name} is cleansed of ${result.cleansed} ailment${result.cleansed === 1 ? '' : 's'}.`, 'heal');
      }
      return;
    }

    if (result.damageDealt === 0) {
      SoundFX.playMagicCast();
      this.fx.status(target, (result.appliedStatus || ability.appliesStatus)?.toLowerCase());
      this.scene.spawnFloatingDamage(target.x, h, target.z, `[${result.appliedStatus || 'OK'}]`, 'heal');
      this.ui.addLogEntry(`[STATUS] ${target.name} receives ${result.appliedStatus}.`, 'spell');
      return;
    }

    this.scene.triggerUnitRecoil(target.id);
    if (ability.element === 'physical') SoundFX.playSwordSlash();
    else SoundFX.playMagicCast();
    this.fx.hit(forecast.attacker, target, ability, !!result.isCrit);
    // A status that rides on a damaging spell (Hell Ivy, Quicksand, Leg Shot...) shows after the hit
    if (result.appliedStatus && !ability.name.includes(': ')) later(() => this.fx.status(target, result.appliedStatus?.toLowerCase()), 350);
    if (result.woke) this.ui.addLogEntry(`[STATUS] ${target.name} wakes up!`, 'spell');
    if (result.resisted) this.ui.addLogEntry(`[RESIST] ${target.name}'s gear wards off ${ability.appliesStatus}.`, 'spell');
    if (result.drained) {
      const a = forecast.attacker;
      later(() => {
        this.fx.drain(a);
        this.scene.spawnFloatingDamage(a.x, this.grid.getHeight(a.x, a.z), a.z, `+${result.drained}`, 'heal');
        this.scene.updateUnits(this.units);
      }, 380);
      this.ui.addLogEntry(`[DRAIN] ${a.name} drains ${result.drained} HP.`, 'heal');
    }

    if (result.isCrit) {
      SoundFX.playCrit();
      this.scene.vfx.triggerScreenShake(0.6);
      this.pad.rumble(0.5, 160);
      this.scene.spawnFloatingDamage(target.x, h, target.z, `CRIT! -${result.damageDealt}`, 'crit');
      this.ui.addLogEntry(`[CRIT] ${target.name} takes ${result.damageDealt} DMG (${forecast.facingType}).`, 'crit');
    } else {
      this.scene.spawnFloatingDamage(target.x, h, target.z, `-${result.damageDealt}`, 'damage');
      this.ui.addLogEntry(`[HIT] ${target.name} takes ${result.damageDealt} DMG (${forecast.facingType}).`, 'attack');
    }
    if (result.appliedStatus) {
      this.ui.addLogEntry(`[STATUS] ${target.name} is afflicted with ${result.appliedStatus}.`, 'spell');
    }

    if (result.secondStrike) {
      const ss = result.secondStrike;
      later(() => {
        if (ss.hit) {
          SoundFX.playSwordSlash();
          this.fx.strike(forecast.attacker, target);
          this.scene.triggerUnitRecoil(target.id);
          this.scene.spawnFloatingDamage(target.x, h + 0.3, target.z, `-${ss.damageDealt}`, 'damage');
          this.ui.addLogEntry(`[DUAL WIELD] Second strike for ${ss.damageDealt} DMG.`, 'attack');
        }
        this.scene.updateUnits(this.units);
      }, 300);
    }

    if (result.bossEnraged) {
      SoundFX.playCrit();
      this.scene.vfx.triggerScreenShake(1.0);
      this.pad.rumble(1.0, 400);
      this.fx.enrage(target);
      this.ui.showBanner(`${target.name.toUpperCase()} IS ENRAGED!`);
      this.ui.addLogEntry(`[BOSS] ${target.name} is enraged: Haste and +20% power!`, 'crit');
    }

    if (target.isDead) {
      this.ui.addLogEntry(`[DEFEAT] ${target.name} has fallen!`, 'defeat');
    }
  }

  private presentReaction(caster: Unit, target: Unit, result: AttackResult): void {
    const rx = result.reaction!;
    this.ui.showBanner(`REACTION: ${rx.name.toUpperCase()}!`);
    this.ui.addLogEntry(`[REACTION] ${rx.description}`, 'reaction');
    const th = this.grid.getHeight(target.x, target.z);

    if (rx.type === 'counter_attack' && rx.damage) {
      this.scene.triggerUnitLunge(target.id, caster.x, caster.z);
      this.scene.triggerUnitRecoil(caster.id);
      SoundFX.playSwordSlash();
      const ch = this.grid.getHeight(caster.x, caster.z);
      this.scene.spawnFloatingDamage(caster.x, ch, caster.z, `-${rx.damage}`, 'damage');
      this.fx.strike(target, caster);
      if (caster.isDead) this.ui.addLogEntry(`[DEFEAT] The counter felled ${caster.name}!`, 'defeat');
    } else if (rx.type === 'auto_potion' && rx.heal) {
      SoundFX.playHeal();
      this.fx.heal(target);
      this.scene.spawnFloatingDamage(target.x, th, target.z, `+${rx.heal}`, 'heal');
    } else if (rx.type === 'dragonheart') {
      SoundFX.playHeal();
      this.fx.heal(target);
      this.scene.spawnFloatingDamage(target.x, th, target.z, 'REVIVED!', 'heal');
    } else if (rx.type === 'earthen_ward') {
      SoundFX.playHeal();
      this.fx.status(target, 'protect');
      this.scene.spawnFloatingDamage(target.x, th, target.z, 'PROTECT', 'heal');
    } else if (rx.type === 'speed_save') {
      SoundFX.playTurnChime();
      this.fx.status(target, 'haste');
      this.scene.spawnFloatingDamage(target.x, th, target.z, 'SPD +2', 'heal');
    } else if (rx.type === 'critical_quick') {
      SoundFX.playTurnChime();
      this.scene.spawnFloatingDamage(target.x, th, target.z, 'QUICK!', 'heal');
    } else if (rx.label) {
      // Iron Will, Quick Hands, Mana Spring, Hex Ward: a status or MP on the unit the reaction touched
      const u = rx.target;
      SoundFX.playTurnChime();
      if (rx.status) this.fx.status(u, rx.status);
      else this.fx.heal(u);
      this.scene.spawnFloatingDamage(u.x, this.grid.getHeight(u.x, u.z), u.z, rx.label, rx.type === 'hex_ward' ? 'damage' : 'heal');
    }
    this.scene.updateUnits(this.units);
  }

  // ---------------------------------------------------------------------------
  // Enemy turns
  // ---------------------------------------------------------------------------

  /** AUTO command: the AI plans and plays the active player unit's turn. */
  private handleAutoCommand(): void {
    const active = this.turnManager.activeUnit;
    if (!active || active.team !== 'player' || this.currentMode === 'busy' || this.battleOver) return;
    this.cancelTargeting();
    this.moveUndo = null;
    this.currentMode = 'busy';
    this.ui.toggleSubMenu(false);
    void this.runAiTurn(active);
  }

  private async runAiTurn(enemy: Unit): Promise<void> {
    if (this.battleOver) return;
    // Enemies may raise only so many of their fallen per battle; AUTO for your own units is not limited
    // Enemies think a turn ahead except on Easy, and use their pouches; AUTO plays your units
    // carefully too but never spends the squad's supplies (0.31.0)
    const foe = enemy.team === 'enemy';
    const plan = planTurn(enemy, this.units, this.grid, {
      noRevive: foe && this.enemyRaises >= (this.mode === 'custom' ? ENEMY_RAISE_CAP : DIFFICULTIES[this.difficulty].raiseCap),
      caution: foe ? enemyCaution(this.mode === 'custom' ? 'normal' : this.difficulty) : 'full',
      pouch: foe ? enemy.pouch : undefined,
      holdBack: !foe,
      zone: this.currentChapter.objective?.type === 'hold' ? zoneKeys(this.grid.mapData.tiles) : undefined // a hold objective's ground (0.48.0)
    });
    if ((plan.ability?.revive || plan.ability?.rebirth) && enemy.team === 'enemy') this.enemyRaises++;

    let trapped: TrapStep | null = null;
    if (plan.moveTo.x !== enemy.x || plan.moveTo.z !== enemy.z) {
      const path = this.grid.findPath(enemy, this.units, plan.moveTo.x, plan.moveTo.z);
      trapped = walkInto(this.actionContext(), enemy, plan.moveTo); // a foe's trap stops it short (0.49.0)
      const walkMs = this.scene.walkPath(enemy.id, trapped && path ? path.slice(0, path.findIndex((p) => p.x === trapped!.stopAt.x && p.z === trapped!.stopAt.z) + 1) : path);
      if (!trapped) {
        enemy.x = plan.moveTo.x;
        enemy.z = plan.moveTo.z;
      }
      enemy.hasMoved = true;
      endPerformance(enemy);
      SoundFX.playMoveStep();
      this.scene.updateUnits(this.units);
      this.scene.focusOn(enemy.x, this.grid.getHeight(enemy.x, enemy.z), enemy.z);
      // Let the walk finish before acting (the walk runs on frames, so it isn't sped up by ?fast)
      await wait(550);
      if (walkMs > 550 * SPEED) await new Promise((r) => setTimeout(r, walkMs - 550 * SPEED));
    }

    if (trapped) {
      await this.showTrap(enemy, trapped);
      if (this.battleOver || this.checkBattleStatus()) return;
    }
    // Stopped short by a trap, it acts only if it still can from where it stands
    const stillCan = !trapped || (!enemy.isDead && !enemy.statuses.some((s) => s.type === 'sleep') && !!plan.ability && !!plan.targetTile &&
      (!!plan.ability.isSelfOnly || isCentered(plan.ability) || this.grid.canTarget(enemy.x, enemy.z, plan.targetTile.x, plan.targetTile.z, plan.ability.range, plan.ability.heightTolerance, CombatEngine.isSupportive(plan.ability) || !!plan.ability.totem || !!plan.ability.trap)));
    if (plan.ability && plan.targetTile && stillCan) {
      await this.performAction(enemy, plan.ability, plan.targetTile.x, plan.targetTile.z);
    }

    if (this.battleOver || this.checkBattleStatus()) return;

    if (!enemy.isDead) enemy.facing = plan.facing;
    this.scene.updateUnits(this.units);
    this.turnManager.endTurn(enemy);
    this.updateTimeline();
    later(() => this.advanceTurn(), plan.ability ? 900 : 500);
  }

  private updateTimeline(): void {
    this.ui.updateTurnTimeline(this.turnManager.predictTurnTimeline(8), this.turnManager.activeUnit);
    this.ui.populateJobCustomizer(this.squad);
  }

  // ---------------------------------------------------------------------------
  // Title screen, fullscreen, links (itch.io / web embeds)
  // ---------------------------------------------------------------------------

  private get titleEl(): HTMLElement {
    return document.getElementById('title-screen')!;
  }

  public get isTitleOpen(): boolean {
    return !this.titleEl.classList.contains('hidden');
  }

  private showTitle(): void {
    this.currentMode = 'menu';
    this.ui.hideDialogue();
    this.ui.hideResultModal();
    this.ui.toggleSystemMenu(false);
    this.world.close();
    Music.stop();
    const cont = document.getElementById('title-continue') as HTMLButtonElement;
    cont.classList.toggle('hidden', !SaveManager.hasSave());
    // Load Game appears once there is more than one save to choose from
    document.getElementById('title-load')!.classList.toggle('hidden', SaveManager.slotsInUse().length < 2);
    this.titleEl.classList.remove('hidden');
    document.body.classList.add('title-open');
    const first = (SaveManager.hasSave() ? cont : document.getElementById('title-new')) as HTMLElement;
    this.ui.focusForNav(first);
  }

  private hideTitle(): void {
    this.titleEl.classList.add('hidden');
    document.body.classList.remove('title-open');
  }

  /** Runs `start` from a title-screen press: that press is what lets the browser play audio. */
  private fromTitle(start: () => void): void {
    SoundFX.playMenuBlip();
    this.hideTitle();
    start();
  }

  private bindPlatform(): void {
    const on = (id: string, fn: () => void) => document.getElementById(id)?.addEventListener('click', fn);
    for (const id of ['title-continue', 'title-new', 'title-load', 'title-workshop', 'title-controls', 'title-fullscreen']) {
      (document.getElementById(id) as HTMLButtonElement).disabled = false;
    }
    document.getElementById('title-new')!.textContent = 'New Game';
    document.getElementById('title-version')!.textContent = `v${__APP_VERSION__}`;
    for (const [id, url] of [['title-support', ITCH_URL], ['btn-support', ITCH_URL], ['title-source', SOURCE_URL], ['title-author', AUTHOR_URL]]) {
      (document.getElementById(id) as HTMLAnchorElement).href = url;
    }

    // Installable app: the Menu offers it once the browser says it can
    const installBtn = document.getElementById('btn-install');
    setupInstall(
      (prompt) => {
        installBtn?.classList.remove('hidden');
        installBtn?.addEventListener('click', () => { SoundFX.playMenuBlip(); prompt(); }, { once: true });
      },
      () => { installBtn?.classList.add('hidden'); this.ui.showBanner('INSTALLED: THE GAME NOW PLAYS OFFLINE'); }
    );

    on('title-new', () => this.fromTitle(() => this.newGameFlow()));
    on('title-continue', () => this.fromTitle(() => this.loadGame(SaveManager.latestSlot() || 1)));
    on('title-load', () => this.fromTitle(() => this.openSlots('load', undefined, () => this.showTitle())));
    on('title-workshop', () => this.fromTitle(() => {
      // Start the campaign underneath, so closing the Workshop lands in Chapter I
      this.playChapterIntro();
      this.openWorkshop();
    }));
    on('title-controls', () => {
      SoundFX.playMenuBlip();
      this.ui.toggleHelp(true);
    });
    on('btn-title', () => {
      SoundFX.playMenuBlip();
      if (!this.battleOver && !['idle', 'dialogue', 'menu', 'editor'].includes(this.currentMode)) {
        this.ui.showBanner('WAIT FOR YOUR TURN');
        return;
      }
      this.ui.toggleSystemMenu(false);
      if (this.workshop.isOpen) this.workshop.close();
      this.showTitle();
    });

    // Fullscreen (itch.io shows its own button too; this one also works in the web version)
    const fsButtons = ['title-fullscreen', 'btn-fullscreen'].map((id) => document.getElementById(id) as HTMLButtonElement);
    const labelFs = () => fsButtons.forEach((b) => (b.textContent = isFullscreen() ? 'Exit fullscreen' : 'Fullscreen'));
    if (canFullscreen()) {
      fsButtons.forEach((b) => {
        b.classList.remove('hidden');
        b.addEventListener('click', () => {
          SoundFX.playMenuBlip();
          toggleFullscreen();
        });
      });
      document.addEventListener('fullscreenchange', labelFs);
      document.addEventListener('webkitfullscreenchange', labelFs);
    }
    window.addEventListener('keydown', (e) => {
      const typing = (e.target as HTMLElement)?.matches?.('input, textarea, select');
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && actionForKey(this.bindings, e.key) === 'fullscreen' && canFullscreen()) toggleFullscreen();
    });
    guardPageScroll();
  }

  // ---------------------------------------------------------------------------
  // Workshop
  // ---------------------------------------------------------------------------

  private openWorkshop(scenario?: Scenario, chain?: Chain): void {
    if (this.workshop.isOpen) return;
    if (!this.battleOver && this.currentMode !== 'idle' && this.currentMode !== 'dialogue') {
      this.ui.showBanner('OPEN THE WORKSHOP ON YOUR TURN');
      return;
    }
    // Park the battle in progress so closing the Workshop puts you straight back into it
    this.suspended = this.battleOver ? null : {
      grid: this.grid, units: this.units, turnManager: this.turnManager, chapter: this.currentChapter, mode: this.mode,
      inputMode: this.currentMode, kills: this.kills, round: this.round, roundActed: this.roundActed, held: this.held, rng: this.rng
    };
    this.ui.hideDialogue();
    this.ui.hideResultModal();
    this.ui.toggleSystemMenu(false);
    this.ui.toggleSubMenu(false);
    // Opened from the world map: step off it, and come back to it when the Workshop closes
    this.mapParked = this.world.isOpen;
    this.world.close();
    this.currentMode = 'editor';
    this.units = [];
    this.scene.setActiveUnit(null);
    Music.playTrack('dialogue');
    if (chain) this.workshop.openChain(chain);
    else this.workshop.open(scenario);
  }

  private workshopClosed(): void {
    const s = this.suspended;
    this.suspended = null;
    if (!s) return this.returnToCampaign();
    this.grid = s.grid;
    this.units = s.units;
    this.turnManager = s.turnManager;
    this.currentChapter = s.chapter;
    this.mode = s.mode;
    this.kills = s.kills;
    this.rng = s.rng;
    this.round = s.round;
    this.roundActed = s.roundActed;
    this.held = s.held;
    this.scene.loadMap(this.grid);
    this.scene.updateUnits(this.units);
    this.currentMode = s.inputMode;
    if (s.inputMode === 'dialogue') {
      this.advanceDialogue(); // re-shows the line you were on
      return;
    }
    Music.playTrack('battle');
    const active = this.turnManager.activeUnit;
    if (active) {
      this.scene.setActiveUnit(active.id);
      this.recenter();
      this.ui.updateUnitCard(active, this.grid.getHeight(active.x, active.z));
    }
  }

  private playScenario(s: Scenario, inChain = false): void {
    if (!inChain) this.chainRun = null;
    this.suspended = null;
    this.customScenario = s;
    this.mode = 'custom';
    const chapter = scenarioToChapter(s);
    const run = this.chainRun;
    if (run) {
      // A chain battle says where it sits in the chain; the first opens with the chain's blurb
      const n = run.chain.scenarios.length;
      chapter.subtitle = `${run.chain.title}, battle ${run.index + 1} of ${n}${s.subtitle ? ` · ${s.subtitle}` : ''}`;
      if (run.index === 0 && run.chain.blurb) {
        chapter.introDialogue.unshift({ speaker: run.chain.title, portraitClass: '📜', side: 'left', text: run.chain.blurb });
      }
    }
    this.setupBattle(chapter);
    this.ui.addLogEntry(run
      ? `[WORKSHOP] "${run.chain.title}"${run.chain.author ? ` by ${run.chain.author}` : ''}: battle ${run.index + 1} of ${run.chain.scenarios.length}, "${s.title}".`
      : `[WORKSHOP] Playing "${s.title}"${s.author ? ` by ${s.author}` : ''}.`, 'system');
    this.playChapterIntro();
  }

  /** Plays battle `index` of a scenario chain, and remembers it as the place to pick up (0.42.0). */
  private playChain(c: Chain, index: number): void {
    const i = Math.max(0, Math.min(index, c.scenarios.length - 1));
    this.chainRun = { chain: c, index: i };
    ChainProgress.set(c.id, i);
    this.playScenario(c.scenarios[i], true);
  }

  /** End of a chain battle: on to the next, retry, or the chain is done. */
  private showChainEnd(won: boolean): void {
    const run = this.chainRun;
    if (!run) return;
    const { chain, index } = run;
    const n = chain.scenarios.length;
    const step = chainStep(chain, index, won);
    const toWorkshop = { label: 'Back to Workshop', onClick: () => { this.chainRun = null; this.openWorkshop(undefined, chain); } };
    const toCampaign = { label: 'Return to campaign', onClick: () => { this.chainRun = null; this.returnToCampaign(); } };
    this.currentMode = 'menu';
    if (step.kind === 'next') {
      ChainProgress.set(chain.id, step.index);
      this.ui.showResultModal({
        title: `BATTLE ${index + 1} OF ${n} WON`,
        subtitle: `Next: "${chain.scenarios[step.index].title}". Your squad keeps its EXP, JP and any reward gear, and the chain remembers where you are if you stop here.`,
        buttons: [{ label: 'Next battle', primary: true, onClick: () => this.playChain(chain, step.index) }, toWorkshop, toCampaign]
      });
    } else if (step.kind === 'complete') {
      ChainProgress.clear(chain.id);
      SoundFX.playVictoryFanfare();
      this.ui.showResultModal({
        title: 'CHAIN COMPLETE',
        subtitle: `You won all ${n} battles of "${chain.title}"${chain.author ? ` by ${chain.author}` : ''}.`,
        buttons: [{ label: 'Play it again', primary: true, onClick: () => this.playChain(chain, 0) }, toWorkshop, toCampaign]
      });
    } else {
      this.ui.showResultModal({
        title: 'DEFEAT',
        subtitle: `Battle ${index + 1} of ${n}, "${chain.scenarios[index].title}". Your squad keeps the EXP and JP it earned, and the chain picks up from this battle.`,
        buttons: [{ label: 'Retry', primary: true, onClick: () => this.playChain(chain, index) }, toWorkshop, toCampaign]
      });
    }
  }

  private returnToCampaign(): void {
    // Between missions (the chapter is already won, or the Workshop was opened from the map): back to the map
    if (this.mapParked || this.clearedChapters.includes(this.campaignChapterId)) {
      this.mapParked = false;
      this.ui.addLogEntry('[SYSTEM] Back to the campaign.', 'system');
      this.openWorldMap();
      return;
    }
    this.ui.addLogEntry('[SYSTEM] Back to the campaign: the chapter starts fresh.', 'system');
    this.loadChapter(this.campaignChapterId);
  }

  /** End of a Workshop battle: replay, edit, or go back to the campaign. */
  private showCustomEnd(won: boolean): void {
    if (this.chainRun) return this.showChainEnd(won);
    const s = this.customScenario;
    this.currentMode = 'menu';
    this.ui.showResultModal({
      title: won ? 'SCENARIO COMPLETE' : 'DEFEAT',
      subtitle: won ? `You won "${s?.title || 'the scenario'}". Your squad keeps its EXP, JP and any reward gear.` : 'Your squad keeps the EXP and JP it earned. Try again, or tweak the scenario.',
      buttons: [
        { label: won ? 'Play again' : 'Retry', primary: true, onClick: () => s && this.playScenario(s) },
        { label: 'Back to Workshop', onClick: () => this.openWorkshop(s || undefined) },
        { label: 'Return to campaign', onClick: () => this.returnToCampaign() }
      ]
    });
  }

  /** Opens a scenario (#s=…) or a chain (#c=…, 0.42.0) shared as a link in the Workshop. */
  private openShareLink(): void {
    const c = /^#c=([\w-]+)$/.exec(location.hash);
    if (c) {
      history.replaceState(null, '', location.pathname + location.search);
      decodeChainShare(c[1])
        .then((chain) => {
          ChainLibrary.save(chain);
          this.openWorkshop(undefined, chain);
          this.ui.showBanner(`SHARED CHAIN: ${chain.title.toUpperCase()}`);
        })
        .catch((e: Error) => this.ui.showBanner(e.message.toUpperCase()));
      return;
    }
    const m = /^#s=([\w-]+)$/.exec(location.hash);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    decodeShare(m[1])
      .then((s) => {
        this.openWorkshop(s);
        this.ui.showBanner(`SHARED SCENARIO: ${s.title.toUpperCase()}`);
      })
      .catch((e: Error) => this.ui.showBanner(e.message.toUpperCase()));
  }

  // ---------------------------------------------------------------------------
  // Victory, defeat, spoils, epilogue, Trials
  // ---------------------------------------------------------------------------

  /**
   * Counts rounds for the survive objective. Returns true when the battle ended because the
   * squad held out long enough.
   */
  private trackRound(unit: Unit): boolean {
    // The count lives in core/Battle.ts (0.44.0); this shows it
    const state = { round: this.round, acted: this.roundActed };
    const fresh = noteTurn(state, unit, this.units);
    this.round = state.round;
    if (fresh) {
      const obj = this.currentChapter.objective;
      if (obj?.type === 'hold') {
        // A round ended: did the squad hold the marked ground alone? (0.48.0)
        const zone = zoneKeys(this.grid.mapData.tiles);
        const holder = zoneHolder(this.units, zone);
        const goal = holdGoal(obj);
        if (holder === 'player') this.held++;
        this.scene.setZoneHeld(holder === 'player' ? 'held' : holder ? 'lost' : 'empty');
        this.ui.addLogEntry(holder === 'player' ? `[OBJECTIVE] The ground is yours: ${this.held} of ${goal} rounds held.`
          : holder ? `[OBJECTIVE] The enemy holds the ground. Still ${this.held} of ${goal}.`
          : `[OBJECTIVE] Nobody holds the ground clear. Still ${this.held} of ${goal}.`, 'system');
        if (this.held >= goal) return this.checkBattleStatus();
        if (holder === 'player') this.ui.showBanner(this.held === goal - 1 ? 'ONE MORE ROUND!' : `HELD ${this.held} / ${goal}`);
      }
      if (obj?.type === 'survive') {
        const goal = obj.rounds || 6;
        if (this.round > goal) return this.checkBattleStatus();
        this.ui.addLogEntry(`[OBJECTIVE] Round ${this.round} of ${goal}.`, 'system');
        if (this.round === goal) this.ui.showBanner('FINAL ROUND!');
      }
    }
    return false;
  }

  private checkBattleStatus(): boolean {
    if (this.battleOver) return true;
    // Who has won is decided in core/Battle.ts (0.44.0): a tamed beast can't win alone, a fallen
    // boss sends the rest fleeing, holding out wins a survive battle
    const outcome = battleOutcome(this.units, this.currentChapter.objective, this.round, 'player', this.held);
    if (!outcome) return false;
    const winText = outcome.reason === 'boss' ? 'VICTORY! THE BOSS HAS FALLEN' : outcome.reason === 'survive' ? 'VICTORY! YOU HELD THE LINE' : outcome.reason === 'hold' ? 'VICTORY! THE GROUND IS YOURS' : 'VICTORY! BATTLEFIELD SECURED';
    if (outcome.reason === 'boss') this.ui.addLogEntry('[OBJECTIVE] Their leader is down. The rest of the enemy flees!', 'system');

    if (outcome.winner !== 'player') {
      this.battleOver = true;
      this.currentMode = 'menu';
      this.ui.toggleSubMenu(false);
      this.tutor.hide();
      this.moveUndo = null;
      Music.stop();
      this.ui.showBanner('DEFEAT... ALL ALLIES FALLEN');
      this.ui.addLogEntry('=== DEFEAT! All allies have fallen. ===', 'defeat');
      later(() => this.showDefeat(), 1600);
      return true;
    }
    this.battleOver = true;
    this.currentMode = 'menu';
    this.ui.toggleSubMenu(false);
    this.tutor.hide();
    this.moveUndo = null;
    Music.playTrack('victory');
    SoundFX.playVictoryFanfare();
    this.ui.showBanner(winText);
    this.ui.addLogEntry(`=== VICTORY! ${outcome.reason === 'hold' ? 'The ground is yours.' : outcome.reason === 'survive' ? 'You held out.' : outcome.reason === 'boss' ? 'Their leader has fallen.' : 'All hostiles defeated.'} ===`, 'system');
    later(() => this.showSpoils(), 1500);
    return true;
  }

  private showDefeat(): void {
    if (this.mode === 'custom') return this.showCustomEnd(false);
    const retry = () => {
      if (this.mode === 'trials') this.startTrial(this.trialsFloor);
      else if (this.mode === 'skirmish' && this.currentSkirmish) this.startSkirmish(this.currentSkirmish);
      else if (this.mode === 'story' && this.currentSideStory) this.startSideStory(this.currentSideStory);
      else {
        this.setupBattle(this.currentChapter);
        this.startBattle();
      }
    };
    const buttons: { label: string; primary?: boolean; onClick: () => void }[] = [
      { label: 'Retry Battle', primary: true, onClick: retry }
    ];
    buttons.push({ label: 'World Map', onClick: () => this.openWorldMap(this.mode === 'trials' ? 'trials' : this.mode === 'story' ? this.currentSideStory || undefined : undefined) });
    if (SaveManager.hasSave(this.saveSlot)) buttons.push({ label: 'Load Save', onClick: () => this.loadGame() });
    // Supplies used in a lost battle come back, whatever you do next (EXP and JP are kept too)
    const refunded = this.refundSupplies();
    this.ui.showResultModal({
      title: 'DEFEAT',
      subtitle: `Your squad keeps the EXP and JP it earned${refunded ? `, and the supplies used in this battle are returned (${refunded})` : ''}. Retry with a new formation, or fall back to the world map to restock at the market.`,
      buttons
    });
  }

  /** Awards end-of-battle EXP/JP/items and shows the spoils screen. */
  private showSpoils(): void {
    const rows: string[] = [];
    for (const u of this.deployedUnits()) {
      const survived = !u.isDead;
      // The fallen take half a share, the same as the reserve (0.37.0; was 15 EXP and 20 JP)
      const exp = survived ? PARTY_EXP : RESERVE_EXP;
      const jp = survived ? PARTY_JP : RESERVE_JP;
      const jobGain = JobSystem.gainJp(u, Math.round(jp * (u.equippedAbilities.support === 'sq_jp_boost' ? 1.5 : 1)));
      this.announceJobGain(u, jobGain, false);
      const jobNews = (this.jobNews[u.id] || []).map((t) => `<span class="levelup jobup">${esc(t)}</span>`).join('');
      const levels = JobSystem.grantExp(u, exp + (this.kills[u.id] || 0) * 10);
      const killsText = this.kills[u.id] ? ` · ${this.kills[u.id]} KO` : '';
      rows.push(`<div class="result-row ${survived ? '' : 'fallen'}">
        <span><span class="result-name">${esc(u.name)}</span>${levels > 0 ? `<span class="levelup">LEVEL UP! Lv ${u.level}</span>` : ''}${jobNews}</span>
        <span class="result-detail">${survived ? '' : 'Fell in battle · '}+${exp} EXP · +${jp} JP${killsText}</span>
      </div>`);
    }

    // The reserve trains at camp and takes half a share (0.37.0); a Workshop scenario has no camp
    if (this.mode !== 'custom') {
      const bench = trainReserve(this.squad, this.deployed);
      if (bench.length) {
        const news = bench.map((g) => {
          const notes: string[] = [];
          if (g.levels > 0) notes.push(`LEVEL UP! Lv ${g.unit.level}`);
          if (g.job.leveledTo) notes.push(`${JOBS[g.unit.jobId]?.name || g.unit.jobId} ${g.job.leveledTo >= MAX_JOB_LEVEL ? 'MASTER' : `Lv ${g.job.leveledTo}`}`);
          if (g.job.mastery) notes.push(`mastery ${g.job.mastery}`);
          for (const id of g.job.unlocked) notes.push(`can become a ${JOBS[id].name}`);
          if (notes.length) this.ui.addLogEntry(`[CAMP] ${g.unit.name} trained in reserve: ${notes.join(', ')}.`, 'system');
          return `${esc(g.unit.name)}${notes.length ? ` <span class="levelup">${esc(notes.join(' · '))}</span>` : ''}`;
        });
        rows.push(`<div class="result-loot"><b>RESERVE:</b> ${news.join(', ')}<br><small>Trained at camp: +${RESERVE_EXP} EXP and +${RESERVE_JP} JP each (more with JP Boost), half a share for sitting out.</small></div>`);
      }
    }

    const newItems: string[] = [];
    if (this.mode === 'campaign' || this.mode === 'custom' || this.mode === 'story') {
      for (const id of this.currentChapter.rewardItemIds || []) {
        if (!this.armory.includes(id)) newItems.push(id);
      }
    } else if (this.mode === 'trials') {
      const drop = rollTrialDrop(this.trialsFloor, this.armory);
      if (drop) newItems.push(drop);
    }
    this.armory.push(...newItems);
    const sideId = this.mode === 'skirmish' ? this.currentSkirmish : null;
    const sideWins = sideId ? this.skirmishWins[sideId] || 0 : 0;
    // The first win at a side-battle place brings its trophy (0.21.0)
    const trophy = sideId ? SKIRMISHES[sideId]?.trophy : undefined;
    if (trophy && ITEMS[trophy] && !this.armory.includes(trophy)) { this.armory.push(trophy); newItems.push(trophy); }
    const earned = victoryGil(this.units.filter((u) => u.team === 'enemy'), this.mode, this.trialsFloor) + (sideId ? skirmishBonus(sideWins) : 0);
    if (sideId) this.skirmishWins[sideId] = sideWins + 1;
    this.gil += earned;
    if (earned > 0 || this.fencedThisBattle > 0) {
      const fenced = this.fencedThisBattle > 0 ? ` · +${this.fencedThisBattle} from fenced loot` : '';
      rows.push(`<div class="result-loot result-gil"><b>GIL:</b> +${earned}${fenced} · Purse: ${this.gil.toLocaleString('en-US')}<br><small>Spend it at the market on the world map.</small></div>`);
    }
    if (this.stolenThisBattle.length > 0) {
      rows.push(`<div class="result-loot"><b>STOLEN:</b> ${this.stolenThisBattle.map((id) => esc(ITEMS[id].name)).join(', ')}</div>`);
    }
    // What the fallen enemies didn't use from their pouches (0.31.0)
    const salvaged = salvage(this.units, this.inventory);
    if (Object.keys(salvaged).length) {
      rows.push(`<div class="result-loot"><b>SALVAGED:</b> ${Object.entries(salvaged).map(([id, n]) => `${esc(CONSUMABLES[id].name)}${n > 1 ? ` ×${n}` : ''}`).join(', ')}<br><small>Items the enemy carried and never used.</small></div>`);
    }
    // Tamed monsters still standing join the squad, if there's room (0.28.0)
    if (this.mode !== 'custom') {
      for (const t of this.units.filter((u) => u.tamed && !u.isDead)) {
        if (this.squad.length >= MAX_SQUAD) {
          rows.push(`<div class="result-loot"><b>TAMED:</b> ${esc(t.name)} · the squad is full (${MAX_SQUAD}), so it goes back to the wild.<br><small>Let someone go at the Barracks to make room next time.</small></div>`);
          continue;
        }
        const beast = beastFromTamed(t, this.squad);
        // Every new beast gets a collar; the first one brings it into the armory (0.29.0)
        if (!this.armory.includes('leather_collar')) this.armory.push('leather_collar');
        JobSystem.equipItem(beast, ITEMS.leather_collar);
        beast.currentHp = beast.maxHp;
        this.squad.push(beast);
        rows.push(`<div class="result-loot"><b>NEW BEAST:</b> ${esc(beast.name)} the ${esc(JOBS[beast.jobId].name)} (Lv ${beast.level}) joins your squad, wearing a Leather Collar!<br><small>Beasts never change jobs and wear only beast gear (barding and collars, at the market). Pick your party at the Barracks.</small></div>`);
      }
    }
    if (newItems.length > 0) {
      rows.push(`<div class="result-loot"><b>NEW GEAR:</b> ${newItems.map((id) => esc(ITEMS[id].name)).join(', ')}<br><small>Equip it from ★ Team → Equipment.</small></div>`);
    }

    let subtitle = this.currentChapter.subtitle ? `${this.currentChapter.title}: ${this.currentChapter.subtitle}` : this.currentChapter.title;
    if (this.mode === 'trials') {
      const isRecord = SaveManager.recordTrialFloor(this.trialsFloor);
      subtitle += isRecord ? ` · New record: floor ${this.trialsFloor}!` : ` · Best: floor ${SaveManager.getBestTrialFloor()}`;
    }

    if (this.mode === 'trials') {
      this.ui.showResultModal({
        title: 'TRIAL CLEARED',
        subtitle,
        bodyHtml: rows.join(''),
        buttons: [
          { label: `Next Trial (${this.trialsFloor + 1})`, primary: true, onClick: () => { this.trialsFloor++; this.saveGame(false); this.startTrial(this.trialsFloor); } },
          { label: 'World Map', onClick: () => { this.trialsFloor++; this.openWorldMap('trials'); } }
        ]
      });
      return;
    }

    if (sideId) {
      const again = sideWins + 1 < SKIRMISH_MAX_HEAT ? 'They will be back, and stronger.' : 'They will be back.';
      this.ui.showResultModal({
        title: 'SIDE BATTLE WON',
        subtitle: `${subtitle} · ${again}`,
        bodyHtml: rows.join(''),
        buttons: [
          { label: 'World Map', primary: true, onClick: () => this.openWorldMap(sideId) },
          { label: 'Fight again', onClick: () => this.startSkirmish(sideId) }
        ]
      });
      return;
    }

    this.ui.showResultModal({
      title: this.mode === 'custom' ? 'SCENARIO CLEARED' : this.mode === 'story' ? 'SIDE STORY WON' : 'VICTORY — SPOILS OF WAR',
      subtitle,
      bodyHtml: rows.join(''),
      buttons: [{ label: 'Continue', primary: true, onClick: () => this.afterSpoils() }]
    });
  }

  private afterSpoils(): void {
    const next = () => (this.mode === 'custom' ? this.showCustomEnd(true) : this.mode === 'story' ? this.finishSideStory() : this.handleChapterVictoryChoices());
    if (this.currentChapter.victoryDialogue.length > 0) {
      this.playDialogueSequence(this.currentChapter.victoryDialogue, next);
    } else {
      next();
    }
  }

  /** A campaign battle is won: on to the world map, or the epilogue after the last one. */
  private handleChapterVictoryChoices(): void {
    this.currentMode = 'menu';
    const won = this.currentChapter.id;
    if (!this.clearedChapters.includes(won)) this.clearedChapters.push(won);
    if (this.currentChapter.choices && this.currentChapter.choices.length > 0) {
      this.openWorldMap(nodeForChapter(won)?.id);
      return;
    }

    this.campaignCleared = true;
    this.saveGame(false);
    this.showEpilogue();
  }

  /** Shows the world map (and autosaves there): the squad's home between missions. */
  private openWorldMap(location?: string): void {
    if (this.mode === 'custom' || this.mode === 'skirmish' || this.mode === 'story') { this.mode = 'campaign'; this.customScenario = null; this.chainRun = null; this.currentSkirmish = null; this.currentSideStory = null; }
    this.currentMode = 'menu';
    this.battleOver = true;
    this.scene.clearHighlights();
    this.ui.hideResultModal();
    this.ui.hideDialogue();
    this.ui.toggleSystemMenu(false);
    Music.playTrack('dialogue');
    this.world.open(location);
    this.saveGame(false);
  }

  /** Leaves the world map for a battle. Orders that came with a story choice bring their reward. */
  private marchTo(mission: Mission): void {
    const choice = mission.choice;
    if (choice) {
      for (const id of choice.rewardItemIds || []) if (!this.armory.includes(id)) this.armory.push(id);
      this.ui.addLogEntry(`[ORDERS] ${choice.text}`, 'system');
      if (choice.rewardText) this.ui.addLogEntry(`[ARMORY] ${choice.rewardText}`, 'system');
    }
    this.world.close();
    this.loadChapter(mission.chapterId);
    this.saveGame(false); // autosave at the start of each chapter
  }

  private showEpilogue(): void {
    const best = SaveManager.getBestTrialFloor();
    const end = this.currentChapter.epilogue;
    this.ui.showResultModal({
      title: end?.title || 'THE REALM IS AT PEACE',
      subtitle: end?.text || 'Campaign complete! Both seals are quiet. The mountain still hums at night, though: the Trials of the Zodiac are endless generated battles with rare gear and a Warden boss every fifth floor.',
      bodyHtml: best > 0 ? `<div class="result-row"><span class="result-name">BEST TRIAL</span><span class="result-detail">Floor ${best}</span></div>` : '',
      buttons: [
        { label: 'World Map', primary: true, onClick: () => this.openWorldMap(nodeForChapter(this.campaignChapterId)?.id) },
        { label: 'Enter the Trials', onClick: () => this.startTrial(1) },
        { label: 'New Game+', onClick: () => this.startNewGamePlus() }
      ]
    });
  }

  /** A fresh campaign: new squad, starting armory and purse. (The save stays until you save over it.) */
  /** New Game from the title: pick a difficulty, then a slot (the first empty one, or ask). */
  private newGameFlow(): void {
    const rows = DIFFICULTY_ORDER.map((d) => `<div class="result-row"><span class="result-name">${DIFFICULTIES[d].label.toUpperCase()}</span><span class="result-detail">${esc(DIFFICULTIES[d].blurb)}</span></div>`).join('');
    this.ui.showResultModal({
      title: 'NEW GAME',
      subtitle: 'Choose a difficulty. You can change it any time from the Menu.',
      bodyHtml: rows,
      buttons: [
        ...DIFFICULTY_ORDER.map((d) => ({ label: DIFFICULTIES[d].label, primary: d === 'normal', onClick: () => this.pickSlotForNewGame(d) })),
        { label: 'Back', onClick: () => this.showTitle() }
      ]
    });
  }

  private pickSlotForNewGame(d: Difficulty): void {
    const empty = SaveManager.firstEmptySlot();
    if (empty) return this.startNewGame(d, empty);
    this.openSlots('new', (slot) => this.startNewGame(d, slot), () => this.newGameFlow());
  }

  private startNewGame(difficulty: Difficulty = this.difficulty, slot = this.saveSlot): void {
    this.difficulty = difficulty;
    this.saveSlot = slot;
    this.labelDifficulty();
    this.squad = this.createStartingSquad();
    this.armory.length = 0;
    this.armory.push(...STARTING_ARMORY);
    this.gil = STARTING_GIL;
    this.inventory = { ...STARTING_INVENTORY };
    this.campaignCleared = false;
    this.clearedChapters = [];
    this.skirmishWins = {};
    this.sideStoriesWon = [];
    this.campSeen = [];
    this.campMemories = [];
    this.merchantSales = undefined;
    this.party = undefined;
    this.recruitHires = undefined;
    this.trialsFloor = 0;
    this.world.close();
    this.world.location = 'ruins';
    this.mode = 'campaign';
    this.customScenario = null;
    this.loadChapter('chapter_1');
    this.saveGame(false); // the new game owns its slot from the start
  }

  /** Where the travelling merchant is and what she sells, from progress alone (0.21.0). */
  private merchant() {
    return merchantVisit(this.clearedChapters, this.skirmishWins, this.shopLevel(), this.armory, this.merchantSales);
  }

  /** The market's recruiting board for the current visit (0.25.0). */
  private recruitBoard() {
    const visit = merchantVisitIndex(this.clearedChapters, this.skirmishWins);
    return recruitBoard(visit, this.clearedChapters.length, this.squad, this.recruitHires);
  }

  /** Hires a hopeful: only on the map, at the market, with room and the gil (0.25.0). */
  private hire(slot: number): boolean {
    const offer = this.recruitBoard().find((r) => r.slot === slot);
    if (!offer || offer.hired || !this.world.isOpen || this.world.location !== 'market' || this.squad.length >= MAX_SQUAD || this.gil < offer.price) return false;
    this.gil -= offer.price;
    const u = hireRecruit(offer, this.squad.map((x) => x.id));
    this.squad.push(u);
    // Their kit counts as owned, as it does for everyone in a loaded save
    for (const it of Object.values(u.equipment)) if (it && !this.armory.includes(it.id)) this.armory.push(it.id);
    if (this.recruitHires?.visit !== offer.visit) this.recruitHires = { visit: offer.visit, slots: [] };
    this.recruitHires.slots.push(slot);
    // A pick made before stays as it was; a new face joins it if there's room
    if (this.party && this.party.length < PARTY_SIZE) this.party.push(u.id);
    SoundFX.playTurnChime();
    this.ui.showBanner(`${u.name.toUpperCase()} JOINS THE SQUAD`);
    const benched = this.squad.length > PARTY_SIZE && !chooseParty(this.squad, this.party).includes(u.id);
    this.ui.addLogEntry(`[RECRUIT] ${u.name} the ${JOBS[u.jobId].name} joins for ${offer.price} G.${benched ? ' Six fight at a time: choose the party in the Barracks.' : ''}`, 'system');
    this.saveGame(false);
    return true;
  }

  /**
   * Runs `go` once the party is settled (0.25.0): straight away when the squad fits, else after the
   * player picks who fights. `joining` is a story recruit who joins in that battle and takes a place.
   */
  private withParty(go: () => void, joining?: { id: string; name: string }, mustFight = false): void {
    // A newcomer takes a seat; so does a squad member whose own story this is (0.43.0)
    const newcomer = joining && (mustFight || !this.squad.some((u) => u.id === joining.id)) ? joining : undefined;
    const extra = newcomer && !this.squad.some((u) => u.id === newcomer.id) ? 1 : 0;
    if (this.squad.length + extra <= PARTY_SIZE) return go();
    this.openParty(go, newcomer);
  }

  /**
   * The party screen (0.25.0). Before a battle (`go` set) it picks who fights; from the market's
   * Barracks (`go` null) it also lets hired units be dismissed, and beasts released (0.28.0).
   */
  private openParty(go: (() => void) | null, newcomer?: { id: string; name: string }, pickIn?: string[]): void {
    const seats = PARTY_SIZE - (newcomer ? 1 : 0);
    let pick = (pickIn || chooseParty(this.squad, this.party)).filter((id) => id !== newcomer?.id && this.squad.some((u) => u.id === id)).slice(0, seats);
    if (!pick.includes(LEADER_ID) && this.squad.some((u) => u.id === LEADER_ID)) pick = [LEADER_ID, ...pick].slice(0, seats);
    const render = () => {
      const cards = this.squad.map((u) => {
        const fights = !!go && u.id === newcomer?.id; // in their own story (0.43.0)
        const on = pick.includes(u.id) || fights;
        const lead = u.id === LEADER_ID;
        return `<div class="party-card${on ? ' in' : ''}" data-id="${esc(u.id)}">
          <canvas width="48" height="48" aria-hidden="true"></canvas>
          <div class="party-info"><b>${esc(u.name)}</b><small>${esc(JOBS[u.jobId]?.name || u.jobId)} Lv ${u.level} · HP ${u.maxHp} · MP ${u.maxMp}</small></div>
          <div class="party-buttons">
            ${lead ? '<span class="party-lock">LEADS</span>' : fights ? '<span class="party-lock">FIGHTS</span>' : `<button data-act="toggle" class="${on ? 'primary' : ''}" aria-pressed="${on}">${on ? 'In party' : 'Reserve'}</button>`}
            ${!go && isHired(u) ? '<button data-act="dismiss">Dismiss</button>' : ''}
            ${!go && isBeast(u) ? '<button data-act="dismiss">Release</button>' : ''}
          </div>
        </div>`;
      }).join('');
      const joinNote = newcomer ? `<p class="party-count">${esc(newcomer.name)} ${this.squad.some((u) => u.id === newcomer.id) ? 'fights in this battle' : 'joins you in this battle'} and takes a place.</p>` : '';
      this.ui.showResultModal({
        title: go ? 'CHOOSE YOUR PARTY' : 'BARRACKS',
        subtitle: `${PARTY_SIZE} fight at a time. Rowan leads and always goes. Units in reserve keep their levels, jobs and gear, and train at camp: half a share of each win's EXP and JP.`,
        bodyHtml: `${joinNote}<p class="party-count">In the party: ${pick.length + (newcomer ? 1 : 0)} / ${PARTY_SIZE} · Barracks ${this.squad.length} / ${MAX_SQUAD}</p><div class="party-list">${cards}</div>`,
        buttons: go
          ? [{ label: `March with ${pick.length + (newcomer ? 1 : 0)}`, primary: true, onClick: () => { this.party = [...pick, ...(newcomer && this.squad.some((u) => u.id === newcomer.id) ? [newcomer.id] : [])]; this.ui.hideResultModal(); go(); } },
             { label: 'Back', onClick: () => { this.party = [...pick]; this.ui.hideResultModal(); this.world.refresh(); } }]
          : [{ label: 'Done', primary: true, onClick: () => { this.party = [...pick]; this.ui.hideResultModal(); this.saveGame(false); this.world.refresh(); } }]
      });
      for (const card of document.querySelectorAll<HTMLElement>('#result-body .party-card')) {
        const u = this.squad.find((x) => x.id === card.dataset.id);
        if (!u) continue;
        const pic = card.querySelector('canvas')!.getContext('2d')!;
        pic.drawImage(drawSprite(u.jobId, 'S', false, 'idle0'), 0, 0);
        const toggle = card.querySelector<HTMLButtonElement>('[data-act="toggle"]');
        if (toggle && !pick.includes(u.id) && pick.length >= seats) {
          toggle.disabled = true;
          toggle.title = 'The party is full: put someone in reserve first';
        }
        toggle?.addEventListener('click', () => {
          SoundFX.playMenuBlip();
          pick = pick.includes(u.id) ? pick.filter((id) => id !== u.id) : pick.length < seats ? [...pick, u.id] : pick;
          render();
          this.ui.focusForNav(document.querySelector<HTMLElement>(`#result-body .party-card[data-id="${CSS.escape(u.id)}"] [data-act="toggle"]`));
        });
        card.querySelector('[data-act="dismiss"]')?.addEventListener('click', () => {
          SoundFX.playMenuBlip();
          const beast = isBeast(u);
          this.confirm(beast ? `Release ${u.name}?` : `Dismiss ${u.name}?`, beast
            ? `${u.name} goes back to the wild for good, with its levels.`
            : `${u.name} leaves the squad for good, with their levels and JP. Their gear stays in your armory.`, beast ? 'Release' : 'Dismiss', () => {
            this.squad = this.squad.filter((x) => x.id !== u.id);
            pick = pick.filter((id) => id !== u.id);
            this.party = this.party?.filter((id) => id !== u.id);
            this.ui.addLogEntry(`[RECRUIT] ${u.name} leaves the squad.`, 'system');
            this.saveGame(false);
            this.openParty(go, newcomer, pick);
          }, () => this.openParty(go, newcomer, pick));
        });
      }
    };
    render();
  }

  /** Buys from the travelling merchant: only on the map, standing where she is. */
  private buyFromMerchant(id: string): boolean {
    const m = this.merchant();
    const ware = m?.wares.find((w) => w.id === id);
    if (!m || !ware || ware.sold || !this.world.isOpen || this.world.location !== m.nodeId || this.armory.includes(id) || this.gil < ware.price) return false;
    this.gil -= ware.price;
    this.armory.push(id);
    const visit = merchantVisitIndex(this.clearedChapters, this.skirmishWins);
    if (this.merchantSales?.visit !== visit) this.merchantSales = { visit, ids: [] };
    this.merchantSales.ids.push(id);
    SoundFX.playTurnChime();
    this.ui.showBanner(`BOUGHT ${ITEMS[id].name.toUpperCase()}`);
    this.ui.addLogEntry(`[MERCHANT] ${MERCHANT_NAME} sells you ${ITEMS[id].name} for ${ware.price} G. Equip it from ★ Team → Equipment.`, 'system');
    this.saveGame(false);
    return true;
  }

  /** Plays the waiting camp scene over the world map, then pays its JP (0.21.0). */
  private makeCamp(): void {
    const scene = pendingCamp(this.clearedChapters, this.campSeen);
    if (!scene || !this.world.isOpen || this.currentMode === 'dialogue') return;
    const mapEl = document.getElementById('world-map')!;
    mapEl.inert = true; // the map stays visible behind the fire, but nothing on it can be pressed
    (document.activeElement as HTMLElement | null)?.blur();
    const lines = scene.lines.filter((l) => l.speaker === 'Rowan' || this.squad.some((u) => u.name === l.speaker));
    this.playDialogueSequence(lines.length ? lines : scene.lines, () => {
      mapEl.inert = false;
      this.currentMode = 'menu';
      this.campSeen.push(scene.chapterId);
      this.campMemories = campMemories(this.campMemories, this.campSeen);
      const ups: string[] = [];
      for (const u of this.squad) {
        const gain = JobSystem.gainJp(u, CAMP_JP);
        this.announceJobGain(u, gain, false);
        if (gain.leveledTo) ups.push(u.name);
      }
      this.jobNews = {};
      this.ui.showBanner(`AROUND THE FIRE: +${CAMP_JP} JP EACH`);
      this.ui.addLogEntry(`[CAMP] ${scene.title}. Everyone gains ${CAMP_JP} JP${ups.length ? ` (${ups.join(', ')} gained a job level)` : ''}.`, 'system');
      this.saveGame(false);
      this.world.refresh();
      this.world.focusDefault();
    });
  }

  /** Lists the camp nights this save remembers, to watch one again (0.39.0). */
  private openMemories(): void {
    if (!this.world.isOpen || this.currentMode === 'dialogue' || !this.campMemories.length) return;
    this.ui.showResultModal({
      title: 'MEMORIES BY THE FIRE',
      subtitle: 'Camp nights from this save, in story order. Watching one again earns no JP.',
      buttons: [
        ...this.campMemories.map((id) => ({ label: `🔥 ${CAMP_SCENES[id].title} (${CAMPAIGN_CHAPTERS[id]?.title.replace('CHAPTER ', 'Ch. ') || id})`, onClick: () => this.replayCamp(id) })),
        { label: 'Close', primary: true, onClick: () => this.world.focusDefault() }
      ]
    });
  }

  /** Plays a remembered camp scene again, as it was, with no JP (0.39.0). */
  private replayCamp(id: string): void {
    const scene = CAMP_SCENES[id];
    if (!scene || !this.world.isOpen || this.currentMode === 'dialogue') return;
    const mapEl = document.getElementById('world-map')!;
    mapEl.inert = true;
    (document.activeElement as HTMLElement | null)?.blur();
    this.ui.showBanner(`A MEMORY: ${scene.title.toUpperCase()}`);
    this.playDialogueSequence(scene.lines, () => {
      mapEl.inert = false;
      this.currentMode = 'menu';
      this.world.refresh();
      this.world.focusDefault();
    });
  }

  /** The market trades only while the party stands at it on the world map. */
  private marketOpen(): boolean {
    // The ship's quartermaster at the Anchorage trades too (0.35.0)
    return this.world.isOpen && (this.world.location === 'market' || this.world.location === 'anchorage');
  }

  /** Buys one consumable. False when the market is closed, the purse is short or the stack is full. */
  private buyConsumable(id: string): boolean {
    const c = CONSUMABLES[id];
    if (!c || !this.marketOpen() || this.gil < c.price || (this.inventory[id] || 0) >= MAX_STACK) return false;
    if (!consumableStock(this.shopLevel()).some((x) => x.id === id)) return false;
    this.gil -= c.price;
    this.inventory[id] = (this.inventory[id] || 0) + 1;
    return true;
  }

  /** Sells one consumable for half its price. */
  private sellConsumable(id: string): boolean {
    const c = CONSUMABLES[id];
    if (!c || !this.marketOpen() || !(this.inventory[id] > 0)) return false;
    this.inventory[id]--;
    this.gil += resaleValue(c);
    return true;
  }

  /** Sells a piece of gear out of the armory for half its price (not relics, not gear someone is wearing). */
  private sellGear(id: string): boolean {
    if (!this.marketOpen() || gearSaleBlock(id, this.armory, this.squad)) return false;
    this.armory.splice(this.armory.indexOf(id), 1);
    this.gil += resaleValue(ITEMS[id]);
    return true;
  }

  /** Buys an item for the armory. Returns false when the purse is short or it's already owned. */
  private buyItem(id: string): boolean {
    const item = ITEMS[id];
    if (!item || !this.marketOpen() || this.armory.includes(id) || this.gil < item.price) return false;
    if (!shopStock(this.shopLevel()).some((it) => it.id === id)) return false;
    this.gil -= item.price;
    this.armory.push(id);
    this.ui.addLogEntry(`[SHOP] Bought ${item.name} for ${item.price} gil.`, 'system');
    return true;
  }

  private shopLevel() {
    return shopProgress(this.campaignChapterId, this.campaignCleared, this.mode === 'trials', this.clearedChapters.includes(this.campaignChapterId));
  }

  /** Replays the campaign from Chapter I keeping squad levels, jobs, abilities and armory. */
  private labelDifficulty(): void {
    const b = document.getElementById('btn-difficulty');
    if (b) b.textContent = `Difficulty: ${DIFFICULTIES[this.difficulty].label}`;
  }

  /** One line about a save: where it stands, the squad, the purse, the difficulty, when. */
  private describeSave(d: GameSaveData): string {
    const ch = CAMPAIGN_CHAPTERS[d.currentChapterId];
    const where = d.mode === 'trials' && !d.onWorldMap ? `Trials, floor ${d.trialsFloor || 1}` : ch ? `${ch.title}: ${ch.subtitle}` : 'Campaign';
    const levels = (d.units || []).filter((u) => u && u.team === 'player').map((u) => Number(u.level) || 1);
    const lv = levels.length ? (Math.min(...levels) === Math.max(...levels) ? `Lv ${Math.min(...levels)}` : `Lv ${Math.min(...levels)}–${Math.max(...levels)}`) : '';
    const parts = [where + (d.onWorldMap ? ' (world map)' : ''), `${levels.length} units ${lv}`.trim(), `${(Number(d.gil) || 0).toLocaleString('en-US')} G`, DIFFICULTIES[sanitizeDifficulty(d.difficulty)].label, new Date(d.timestamp || 0).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })];
    return parts.join(' · ');
  }

  /**
   * The save-slot screen. purpose: save (write the current game), load, new (choose a slot for a
   * new game) or import (choose where an imported save goes). Every slot can be exported or deleted.
   */
  private openSlots(purpose: 'save' | 'load' | 'new' | 'import', onPick?: (slot: number) => void, onClose?: () => void, imported?: GameSaveData): void {
    const titles = { save: 'SAVE GAME', load: 'LOAD GAME', new: 'CHOOSE A SLOT', import: 'IMPORT INTO…' };
    const intro = {
      save: `Saves go to your browser. You are playing in slot ${this.saveSlot}; the game also saves itself there at the start of each chapter and on the world map.`,
      load: 'Loading replaces the game in progress with the saved one.',
      new: 'Every slot is in use. Choose one for the new game: the save in it will be replaced.',
      import: 'Choose a slot for the imported save.'
    }[purpose];
    const action = { save: 'Save here', load: 'Load', new: 'Use this slot', import: 'Put it here' }[purpose];
    let body = '';
    for (let s = 1; s <= SAVE_SLOTS; s++) {
      const d = SaveManager.loadGame(s);
      const playing = s === this.saveSlot && !!this.squad.length && purpose !== 'new';
      const canAct = purpose === 'load' ? !!d : true;
      body += `<div class="slot-card${playing ? ' current' : ''}" data-slot="${s}">
        <div class="slot-head"><span class="result-name">SLOT ${s}</span>${playing ? '<span class="slot-tag">PLAYING</span>' : ''}</div>
        <div class="slot-info">${d ? esc(this.describeSave(d)) : '<i>Empty</i>'}</div>
        <div class="slot-actions">
          ${canAct ? `<button data-act="pick" class="primary">${action}</button>` : ''}
          ${d ? '<button data-act="export">Export</button><button data-act="delete">Delete</button>' : ''}
        </div>
      </div>`;
    }
    const close = () => (onClose ? onClose() : undefined);
    const buttons: { label: string; primary?: boolean; onClick: () => void }[] = [];
    if (purpose === 'save' || purpose === 'load') buttons.push({ label: 'Import a save…', onClick: () => this.openImport(() => this.openSlots(purpose, onPick, onClose)) });
    buttons.push({ label: purpose === 'import' ? 'Cancel' : purpose === 'new' ? 'Back' : 'Close', onClick: close });
    this.ui.showResultModal({ title: titles[purpose], subtitle: intro, bodyHtml: `<div class="slot-list">${body}</div>`, buttons });
    const reopen = () => this.openSlots(purpose, onPick, onClose, imported);

    for (const card of document.querySelectorAll<HTMLElement>('#result-body .slot-card')) {
      const slot = Number(card.dataset.slot);
      const has = SaveManager.hasSave(slot);
      card.querySelector('[data-act="pick"]')?.addEventListener('click', () => {
        SoundFX.playMenuBlip();
        const go = () => {
          this.ui.hideResultModal();
          if (purpose === 'save') { this.saveSlot = slot; this.saveGame(true); close(); }
          else if (purpose === 'load') this.loadGame(slot);
          else if (purpose === 'import' && imported) {
            if (SaveManager.writeSlot(slot, imported)) this.ui.showBanner(`SAVE IMPORTED INTO SLOT ${slot}`);
            else this.ui.showBanner('IMPORT FAILED: BROWSER STORAGE UNAVAILABLE');
            this.openSlots('load', undefined, onClose);
          } else onPick?.(slot);
        };
        // Writing over a different save asks first
        const overwrites = has && (purpose === 'new' || purpose === 'import' || (purpose === 'save' && slot !== this.saveSlot));
        if (!overwrites) return go();
        this.confirm(`Replace slot ${slot}?`, `This save will be overwritten: ${this.describeSave(SaveManager.loadGame(slot)!)}`, 'Replace', go, reopen);
      });
      card.querySelector('[data-act="export"]')?.addEventListener('click', () => { SoundFX.playMenuBlip(); this.openExport(slot, reopen); });
      card.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
        SoundFX.playMenuBlip();
        this.confirm(`Delete slot ${slot}?`, `This can't be undone. ${this.describeSave(SaveManager.loadGame(slot)!)}`, 'Delete', () => {
          SaveManager.clearSave(slot);
          this.ui.showBanner(`SLOT ${slot} DELETED`);
          reopen();
        }, reopen);
      });
    }
  }

  private confirm(title: string, text: string, yes: string, onYes: () => void, onNo: () => void): void {
    this.ui.showResultModal({ title: title.toUpperCase(), subtitle: text, buttons: [{ label: 'Cancel', primary: true, onClick: onNo }, { label: yes, onClick: onYes }] });
  }

  /** Shows a slot as text to copy, with a download button. */
  private openExport(slot: number, back: () => void): void {
    const text = SaveManager.exportSave(slot);
    if (!text) return back();
    this.ui.showResultModal({
      title: `EXPORT SLOT ${slot}`,
      subtitle: 'Keep this file to back the save up, or to carry it to another browser or device (Import a save… there).',
      bodyHtml: `<textarea class="save-text" readonly aria-label="Save data" rows="6">${esc(text)}</textarea>`,
      buttons: [
        {
          label: 'Download file', primary: true, onClick: () => {
            try {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
              a.download = `chess-rpg-tactics-slot${slot}-${new Date().toISOString().slice(0, 10)}.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(a.href), 4000);
              this.ui.showBanner('SAVE FILE DOWNLOADED');
            } catch {
              this.ui.showBanner('DOWNLOAD BLOCKED HERE: USE COPY INSTEAD');
            }
            this.openExport(slot, back);
          }
        },
        {
          label: 'Copy', onClick: () => {
            navigator.clipboard?.writeText(text).then(() => this.ui.showBanner('SAVE COPIED'), () => this.ui.showBanner('COPY BLOCKED HERE: SELECT THE TEXT AND COPY IT'));
            this.openExport(slot, back);
          }
        },
        { label: 'Back', onClick: back }
      ]
    });
    document.querySelector<HTMLTextAreaElement>('#result-body .save-text')?.addEventListener('focus', (e) => (e.target as HTMLTextAreaElement).select());
  }

  /** Paste a save or pick a file; it is checked, then placed in a slot of your choice. */
  private openImport(back: () => void): void {
    this.ui.showResultModal({
      title: 'IMPORT A SAVE',
      subtitle: 'Paste an exported save, or choose a .json file. Only what the game understands is kept.',
      bodyHtml: `<textarea class="save-text" aria-label="Paste a save here" rows="6" placeholder="Paste the save here"></textarea>
        <input type="file" class="save-file" accept=".json,application/json" aria-label="Choose a save file">
        <p class="save-error" role="alert"></p>`,
      buttons: [
        {
          label: 'Import', primary: true, onClick: () => {
            const text = (document.querySelector<HTMLTextAreaElement>('#result-body .save-text')?.value) ?? pendingText;
            tryImport(text);
          }
        },
        { label: 'Back', onClick: back }
      ]
    });
    let pendingText = '';
    const tryImport = (text: string) => {
      try {
        const data = SaveManager.parseImport(text);
        this.openSlots('import', undefined, back, data);
      } catch (e) {
        this.openImport(back);
        const err = document.querySelector('#result-body .save-error');
        if (err) err.textContent = (e as Error).message;
      }
    };
    const file = document.querySelector<HTMLInputElement>('#result-body .save-file');
    file?.addEventListener('change', () => {
      const f = file.files?.[0];
      if (!f) return;
      if (f.size > MAX_IMPORT_BYTES) {
        const err = document.querySelector('#result-body .save-error');
        if (err) err.textContent = 'That file is too large to be a save.';
        return;
      }
      f.text().then((t) => {
        pendingText = t;
        const ta = document.querySelector<HTMLTextAreaElement>('#result-body .save-text');
        if (ta) ta.value = t;
      });
    });
  }

  /** Gives back what a lost battle used; returns a short list of what came back, or ''. */
  private refundSupplies(): string {
    const start = this.battleStartInventory;
    if (!start) return '';
    const back: string[] = [];
    for (const [id, n] of Object.entries(start)) {
      const used = n - (this.inventory[id] || 0);
      if (used > 0 && CONSUMABLES[id]) back.push(`${used} × ${CONSUMABLES[id].name}`);
    }
    this.inventory = { ...start };
    if (back.length) this.ui.addLogEntry(`[ITEMS] Returned after the defeat: ${back.join(', ')}.`, 'system');
    return back.join(', ');
  }

  private startNewGamePlus(): void {
    this.ui.addLogEntry('[SYSTEM] New Game+ : your squad keeps its levels, jobs and gear.', 'system');
    this.clearedChapters = [];
    this.campSeen = []; // the story is told again, and so are its evenings
    this.sideStoriesWon = []; // and the recruits' own stories
    this.world.close();
    this.world.location = 'ruins';
    this.ui.hideResultModal();
    this.loadChapter('chapter_1');
  }

  private lastHoveredKey = '';
  private labelGfx: () => void = () => undefined;
  private fpsWindow = { start: performance.now(), frames: 0, slowWindows: 0 };

  /**
   * Adaptive quality: on "Auto", if the frame rate stays under 40 fps for two 3-second windows
   * in a row, step down one tier (High → Medium → Low). Manual settings are never changed.
   */
  private watchFrameRate(now: number): void {
    const w = this.fpsWindow;
    w.frames++;
    const elapsed = now - w.start;
    if (elapsed < 3000) return;
    const fps = (w.frames * 1000) / elapsed;
    w.start = now;
    w.frames = 0;
    if (document.hidden || getQualitySetting() !== 'auto' || this.scene.qualityLevel === 'low') return;
    w.slowWindows = fps < 40 ? w.slowWindows + 1 : 0;
    if (w.slowWindows < 2) return;
    w.slowWindows = 0;
    const next = this.scene.qualityLevel === 'high' ? 'medium' : 'low';
    this.scene.setQuality(PROFILES[next]);
    this.labelGfx();
    this.ui.addLogEntry(`[SYSTEM] Graphics lowered to ${next} to keep the game smooth (${Math.round(fps)} fps). Change it in Menu.`, 'system');
  }

  private gameLoop(): void {
    requestAnimationFrame(() => this.gameLoop());
    this.pad.poll();
    this.watchFrameRate(performance.now());

    if (this.scene && this.scene.hoveredTile) {
      const { x, z } = this.scene.hoveredTile;
      const key = `${x},${z}`;
      if (key !== this.lastHoveredKey) {
        this.lastHoveredKey = key;
        const tile = this.scene.grid.getTile(x, z);
        if (tile) this.ui.updateTileInfo(x, z, tile.height, tile.terrain, tile.hazard ? HAZARDS[tile.hazard].name : undefined, tile.zone);
        this.workshop?.describeTile(x, z);
      }
    }

    // Nothing of the battlefield shows behind the world map: skip drawing it
    if (this.scene && !this.world?.isOpen) this.scene.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new TacticsGame();
});
