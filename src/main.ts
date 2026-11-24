import { MAPS, spawnsFor } from './data/maps';
import { BattleGrid } from './core/Grid';
import { TacticsScene } from './renderer/TacticsScene';
import { UIManager } from './ui/UIManager';
import { TurnManager } from './core/TurnManager';
import { JobSystem, JpGain, MAX_JOB_LEVEL } from './core/JobSystem';
import { JOBS } from './data/jobs';
import { WorldMap } from './ui/WorldMap';
import { Mission, clearedAfterStory, nodeForChapter, sanitizeCleared } from './core/World';
import { CONSUMABLES, STARTING_INVENTORY, MAX_STACK, sanitizeInventory, consumableStock } from './data/consumables';
import { STARTING_GIL, shopProgress, shopStock, nextShopCap, victoryGil, resaleValue, gearSaleBlock } from './core/Economy';
import { CombatEngine, AttackResult } from './core/CombatEngine';
import { Unit, Ability, CombatForecast, FacingDirection, DialogueLine, CampaignChapter } from './core/types';
import { CAMPAIGN_CHAPTERS } from './data/campaign';
import { ITEMS, STARTING_ARMORY } from './data/items';
import { SoundFX } from './audio/SoundEffects';
import { Music } from './audio/MusicSynthesizer';
import { SaveManager, GameSaveData } from './core/SaveManager';
import { resolveTerrainAbility } from './core/Geomancy';
import { planTurn, unitsInBlast, faceTowards } from './core/EnemyAI';
import { buildTrialFloor, rollTrialDrop } from './core/Trials';
import { GamepadInput, PadAction } from './input/GamepadInput';
import { getQualitySetting, setQualitySetting, resolveQuality, QualitySetting, PROFILES } from './renderer/GraphicsQuality';
import { moveFocus, focusablesIn, Dir } from './input/FocusNav';
import { Workshop } from './ui/Workshop';
import { BattleFx } from './renderer/BattleFx';
import { Scenario, scenarioToChapter, decodeShare } from './core/Scenario';
import { ITCH_URL, SOURCE_URL, AUTHOR_URL, canFullscreen, isFullscreen, toggleFullscreen, guardPageScroll } from './platform';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/vt323/latin-400.css';

type InputMode = 'idle' | 'moving' | 'targeting' | 'facing' | 'dialogue' | 'editor' | 'menu' | 'busy';

/** ?fast speeds every animation delay up (used by the automated play-test). */
const SPEED = new URLSearchParams(location.search).has('fast') ? 0.12 : 1;
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

  private mode: 'campaign' | 'trials' | 'custom' = 'campaign';
  /** The campaign chapter to return to after Workshop battles (and to save). */
  private campaignChapterId = 'chapter_1';
  /** Campaign chapters won this run, in order. */
  private clearedChapters: string[] = [];
  /** The world map shown between missions. */
  private world!: WorldMap;
  /** True while the Workshop is open over the world map. */
  private mapParked = false;

  // Workshop
  private workshop!: Workshop;
  private fx!: BattleFx;
  private customScenario: Scenario | null = null;
  /** The battle that was in progress when the Workshop opened, restored when it closes. */
  private suspended: {
    grid: BattleGrid; units: Unit[]; turnManager: TurnManager; chapter: CampaignChapter;
    mode: 'campaign' | 'trials' | 'custom'; inputMode: InputMode; kills: Record<string, number>;
    round: number; roundActed: Set<string>;
  } | null = null;

  /** Rounds for the "survive" objective: a round ends once every living unit has had a turn. */
  private round = 1;
  private roundActed = new Set<string>();
  private trialsFloor = 0;
  private campaignCleared = false;
  private battleOver = false;
  /** Per-battle kill tally for the spoils screen. */
  private kills: Record<string, number> = {};

  // Interaction state
  private currentMode: InputMode = 'dialogue';
  private pad = new GamepadInput();
  private selectedAbility: Ability | null = null;
  private currentForecast: CombatForecast | null = null;
  private targetTile: { x: number; z: number } | null = null;

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
        trialsOpen: this.campaignCleared || this.mode === 'trials',
        trialsFloor: Math.max(1, this.trialsFloor),
        bestTrial: SaveManager.getBestTrialFloor(),
        gil: this.gil,
        leaderJob: this.squad[0]?.jobId || 'squire'
      }),
      march: (m) => this.marchTo(m),
      enterTrials: () => { this.world.close(); this.startTrial(Math.max(1, this.trialsFloor)); },
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
      closed: () => this.workshopClosed()
    });

    this.bindEvents();
    this.bindPlatform();
    this.gameLoop();
    // Automated play-tests (?fast) and share links skip the title screen
    const params = new URLSearchParams(location.search);
    if (params.has('fast') || params.has('notitle') || /^#s=/.test(location.hash)) {
      this.hideTitle();
      if (!/^#s=/.test(location.hash)) this.playChapterIntro();
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

  /** Puts every squad member on a free, walkable deployment tile with full HP/MP. */
  private deploySquad(): void {
    const taken = new Set<string>();
    for (const e of this.units.filter((u) => u.team === 'enemy')) taken.add(`${e.x},${e.z}`);

    const spawns = spawnsFor(this.grid.mapData);
    this.squad.forEach((member, i) => {
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
      const u = JobSystem.createUnit(`e${idx + 1}`, e.name, 'enemy', e.jobId, e.x, e.z, e.facing || 'S', e.level);
      if (e.isBoss) JobSystem.makeBoss(u);
      // Enemy casters get their job's reaction/support so they fight like the player's units
      this.equipEnemyPassives(u);
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

    const enemies = this.spawnEnemies(chapter);
    this.units = [...enemies];
    this.deploySquad();
    this.units = [...this.squad, ...enemies];
    this.turnManager = new TurnManager(this.units);
    this.kills = {};
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

    this.ui.onSaveGame = () => this.saveGame(true);
    this.ui.onLoadGame = () => this.loadGame();
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
    this.pad.onPan = (dx, dz) => this.scene.panBy(dx, dz);
    this.pad.onZoom = (d) => (d > 0 ? this.scene.zoomOut(d) : this.scene.zoomIn(-d));
    this.pad.onConnect = () => {
      this.ui.setInputMode('gamepad');
      this.ui.showBanner('CONTROLLER CONNECTED');
      this.ui.addLogEntry('[SYSTEM] Controller connected. Press View/Back for the controls.', 'system');
    };
    this.pad.onDisconnect = () => this.ui.showBanner('CONTROLLER DISCONNECTED');

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
      if (tile) this.ui.updateTileInfo(t.x, t.z, tile.height, tile.terrain);
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

    // On the title screen only menu keys work (H opens Controls)
    if (this.isTitleOpen && !this.ui.isHelpOpen) {
      const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as Record<string, Dir>)[k];
      if (dir) { e.preventDefault(); this.handleDirection(dir); }
      else if (k.toLowerCase() === 'h' || k === '?') this.ui.toggleHelp(true);
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

    const lower = k.toLowerCase();
    if (lower === 'q') { this.scene.rotateLeft(); this.scene.updateUnits(this.units); }
    else if (lower === 'e') { this.scene.rotateRight(); this.scene.updateUnits(this.units); }
    else if (k === '+' || k === '=') this.scene.zoomIn(1.5);
    else if (k === '-' || k === '_') this.scene.zoomOut(1.5);
    else if (lower === 'w') this.scene.panBy(0, -1.0);
    else if (lower === 's') this.scene.panBy(0, 1.0);
    else if (lower === 'a') this.scene.panBy(-1.0, 0);
    else if (lower === 'd') this.scene.panBy(1.0, 0);
    else if (lower === 'r' || k === 'Home') this.recenter();
    else if (lower === 'h' || k === '?') this.ui.toggleHelp();
    else if (lower === 'l') this.ui.toggleCombatLog();
    else if (lower === 'j') { if (this.ui.isJobModalOpen) this.ui.closeJobModal(); else this.openTeamFor(this.turnManager.activeUnit); }
    else if (this.isPlayerIdle() && !this.ui.activeLayer()) {
      if (k === '1') this.clickIfEnabled('btn-action-move');
      else if (k === '2') this.clickIfEnabled('btn-action-act');
      else if (k === '3') this.clickIfEnabled('btn-action-wait');
      else if (k === '4' || lower === 't') this.handleAutoCommand();
      else if (k === '5' || lower === 'i') this.clickIfEnabled('btn-action-item');
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
      mode: this.mode === 'custom' ? 'campaign' : this.mode,
      trialsFloor: this.trialsFloor,
      campaignCleared: this.campaignCleared,
      gil: this.gil,
      inventory: this.inventory,
      clearedChapters: this.clearedChapters,
      onWorldMap: this.world.isOpen,
      worldLocation: this.world.location
    });
    if (ok && announce) {
      SoundFX.playTurnChime();
      this.ui.showBanner('GAME SAVED!');
      this.ui.addLogEntry('[SYSTEM] Squad, armory and progress saved to this browser.', 'system');
    } else if (!ok && announce) {
      this.ui.showBanner('SAVE FAILED: BROWSER STORAGE UNAVAILABLE');
    }
  }

  private loadGame(): void {
    const data = SaveManager.loadGame();
    if (!data || !data.units || data.units.length === 0) {
      this.ui.showBanner('NO SAVED GAME FOUND');
      return;
    }
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

    this.campaignCleared = !!data.campaignCleared;
    this.gil = typeof data.gil === 'number' && data.gil >= 0 ? Math.floor(data.gil) : STARTING_GIL;
    this.inventory = sanitizeInventory(data.inventory);
    const chapterId = CAMPAIGN_CHAPTERS[data.currentChapterId] ? data.currentChapterId : 'chapter_1';
    this.clearedChapters = sanitizeCleared(data.clearedChapters, chapterId);
    // A Trials save from before 0.15.0 has no list of won chapters, but the story is certainly over
    if (!Array.isArray(data.clearedChapters) && data.mode === 'trials' && this.campaignCleared) this.clearedChapters = clearedAfterStory();
    this.campaignChapterId = chapterId;
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
    const obj = this.currentChapter.objective;
    if (obj?.type === 'boss') this.ui.addLogEntry(`[OBJECTIVE] Defeat ${boss ? boss.name : 'the boss'}.`, 'system');
    else if (obj?.type === 'survive') this.ui.addLogEntry(`[OBJECTIVE] Hold out for ${obj.rounds || 6} rounds. Round 1 begins!`, 'system');
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
      if (u.isDead) this.ui.addLogEntry(`[DEFEAT] ${u.name} succumbs to poison!`, 'defeat');
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

    const { activeUnit, poisonDamage, regenHeal } = result;
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

    this.ui.updateUnitCard(activeUnit, height);
    this.ui.populateActionSubMenu(activeUnit, this.grid.getTile(activeUnit.x, activeUnit.z)?.terrain);
    this.ui.updateTurnTimeline(this.turnManager.predictTurnTimeline(8), activeUnit);
    this.ui.showBanner(`${activeUnit.name.toUpperCase()}'s TURN`);

    if (activeUnit.team === 'player') {
      SoundFX.playTurnChime();
    } else {
      this.currentMode = 'busy';
      later(() => this.runAiTurn(activeUnit), 800);
    }
  }

  private handleMoveCommand(): void {
    const active = this.turnManager.activeUnit;
    if (!active || active.hasMoved || active.team !== 'player' || active.move === 0 || this.currentMode === 'busy') return;

    this.currentMode = 'moving';
    (document.activeElement as HTMLElement | null)?.blur();
    this.scene.setHighlights(this.grid.getReachableTiles(active, this.units), 0x3b82f6);
    this.scene.setCursor(active.x, active.z);
  }

  private handleAbilityCommand(raw: Ability): void {
    const active = this.turnManager.activeUnit;
    if (!active || active.hasActed || active.team !== 'player' || this.currentMode === 'busy') return;
    if (active.currentMp < raw.mpCost) return;

    const ability = resolveTerrainAbility(raw, this.grid.getTile(active.x, active.z)?.terrain);
    this.selectedAbility = ability;

    if (ability.isSelfOnly) {
      void this.executePlayerAction(active, ability, active.x, active.z);
      return;
    }

    const supportive = CombatEngine.isSupportive(ability);
    let tiles = this.grid.mapData.tiles.filter((t) =>
      this.grid.canTarget(active.x, active.z, t.x, t.z, ability.range, ability.heightTolerance, supportive)
    );
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
    (document.activeElement as HTMLElement | null)?.blur();
    this.scene.setHighlights(tiles, supportive ? 0x22c55e : 0xdc2626);
  }

  private handleWaitCommand(): void {
    const active = this.turnManager.activeUnit;
    if (!active || active.team !== 'player') return;

    this.currentMode = 'facing';
    this.scene.clearHighlights();
    this.ui.showFacingSelector(active.facing);
  }

  private handleFacingConfirmed(facing: FacingDirection): void {
    const active = this.turnManager.activeUnit;
    if (!active) return;

    active.facing = facing;
    this.scene.updateUnits(this.units);
    this.turnManager.endTurn(active);
    this.updateTimeline();

    if (!this.checkBattleStatus()) {
      this.currentMode = 'busy';
      later(() => this.advanceTurn(), 400);
    }
  }

  private onCanvasClick(): void {
    const tile = this.scene.hoveredTile;
    if (!tile) return;

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
      this.scene.walkPath(active.id, this.grid.findPath(active, this.units, tile.x, tile.z));
      active.x = tile.x;
      active.z = tile.z;
      active.hasMoved = true;
      this.applyRegenWalk(active, dest.cost);
      this.scene.updateUnits(this.units);
      this.scene.clearHighlights();
      this.currentMode = 'idle';

      this.ui.updateUnitCard(active, this.grid.getHeight(active.x, active.z));
      // Terrain-driven spells change with the ground: refresh the action list
      this.ui.populateActionSubMenu(active, this.grid.getTile(active.x, active.z)?.terrain);

      if (active.hasActed) this.handleWaitCommand();
    } else if (this.currentMode === 'targeting' && this.selectedAbility && active.team === 'player') {
      const ability = this.selectedAbility;
      const supportive = CombatEngine.isSupportive(ability);
      if (!this.grid.canTarget(active.x, active.z, tile.x, tile.z, ability.range, ability.heightTolerance, supportive)) {
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

  /** Units an ability aimed at (tx, tz) will affect. Single-target abilities hit whoever is on the tile. */
  private victimsFor(caster: Unit, ability: Ability, tx: number, tz: number): Unit[] {
    if (ability.isSelfOnly) return [caster];
    if (ability.aoe > 0) return unitsInBlast(caster, ability, tx, tz, this.units);
    const living = this.units.find((v) => !v.isDead && v.x === tx && v.z === tz);
    if (ability.revive) {
      // A fallen ally lying on the tile, unless someone is standing over them
      const fallen = this.units.find((v) => v.isDead && v.team === caster.team && v.x === tx && v.z === tz);
      return fallen && !living ? [fallen] : [];
    }
    return living ? [living] : [];
  }

  private forecastFor(attacker: Unit, target: Unit, ability: Ability, aim?: { x: number; z: number }): CombatForecast {
    const isSplash = !!aim && ability.aoe > 0 && (target.x !== aim.x || target.z !== aim.z);
    return CombatEngine.getForecast(
      attacker,
      target,
      ability,
      this.grid.getHeight(attacker.x, attacker.z),
      this.grid.getHeight(target.x, target.z),
      this.grid.getTile(target.x, target.z)?.terrain,
      isSplash
    );
  }

  /**
   * Resolves an ability: spends MP once, then rolls it against every unit it touches,
   * plays effects, handles reactions, boss enrage, and awards EXP/JP to player units.
   */
  private async performAction(caster: Unit, ability: Ability, tx: number, tz: number): Promise<void> {
    const victims = this.victimsFor(caster, ability, tx, tz);
    caster.currentMp = Math.max(0, caster.currentMp - ability.mpCost);
    caster.hasActed = true;
    if (ability.item) this.inventory[ability.item] = Math.max(0, (this.inventory[ability.item] || 0) - 1);

    if (!ability.isSelfOnly) {
      caster.facing = faceTowards(caster.x, caster.z, tx, tz);
      this.scene.triggerUnitLunge(caster.id, tx, tz);
    }
    this.scene.updateUnits(this.units);

    const verb = caster.team === 'player' ? 'executes' : 'uses';
    const targetText = ability.isSelfOnly ? 'self' : victims.length > 1 ? `${victims.length} units` : victims[0]?.name || 'empty ground';
    this.ui.addLogEntry(`[ACTION] ${caster.name} ${verb} ${ability.name} on ${targetText}.`, 'attack');
    if (caster.team === 'enemy') this.ui.showBanner(`${caster.name}: ${ability.name}!`);

    let anyKill = false;
    for (const target of victims) {
      if (target.isDead && !ability.revive) continue;
      const forecast = this.forecastFor(caster, target, ability, { x: tx, z: tz });
      const result = CombatEngine.executeAttack(forecast);
      this.presentResult(target, forecast, result);
      if (target.isDead) {
        anyKill = true;
        if (caster.team === 'player') this.kills[caster.id] = (this.kills[caster.id] || 0) + 1;
      }
      if (result.reaction && result.reaction.type !== 'parry') {
        await wait(380);
        this.presentReaction(caster, target, result);
      }
      if (caster.isDead) break; // killed by a counter
      await wait(victims.length > 1 ? 220 : 120);
    }

    // Player progression: JP for the current job, EXP for acting and for kills
    if (caster.team === 'player' && !caster.isDead) {
      // Using a supply isn't practising a job: no JP and no EXP for the act, only for a kill it makes
      const jpGain = ability.item ? 0 : Math.round(24 * (caster.equippedAbilities.support === 'sq_jp_boost' ? 1.5 : 1));
      if (jpGain > 0) this.announceJobGain(caster, JobSystem.gainJp(caster, jpGain));
      const levels = JobSystem.grantExp(caster, (ability.item ? 0 : 10) + (anyKill ? 20 : 0));
      if (levels > 0) {
        const h = this.grid.getHeight(caster.x, caster.z);
        this.scene.spawnFloatingDamage(caster.x, h + 0.4, caster.z, `LEVEL UP! Lv ${caster.level}`, 'heal');
        this.fx.levelUp(caster);
        this.ui.addLogEntry(`[LEVEL] ${caster.name} reached level ${caster.level}!`, 'system');
        SoundFX.playVictoryFanfare();
      }
    }

    this.scene.updateUnits(this.units);
    await wait(250);
  }

  private presentResult(target: Unit, forecast: CombatForecast, result: AttackResult): void {
    const h = this.grid.getHeight(target.x, target.z);
    const ability = forecast.ability;

    if (result.revived) {
      SoundFX.playHeal();
      this.scene.updateUnits(this.units);
      this.fx.heal(target);
      this.scene.spawnFloatingDamage(target.x, h, target.z, 'REVIVED', 'heal');
      this.ui.addLogEntry(`[ITEM] ${target.name} is back on their feet with ${result.damageDealt} HP!`, 'heal');
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
    this.currentMode = 'busy';
    this.ui.toggleSubMenu(false);
    void this.runAiTurn(active);
  }

  private async runAiTurn(enemy: Unit): Promise<void> {
    if (this.battleOver) return;
    const plan = planTurn(enemy, this.units, this.grid);

    if (plan.moveTo.x !== enemy.x || plan.moveTo.z !== enemy.z) {
      const walkMs = this.scene.walkPath(enemy.id, this.grid.findPath(enemy, this.units, plan.moveTo.x, plan.moveTo.z));
      enemy.x = plan.moveTo.x;
      enemy.z = plan.moveTo.z;
      enemy.hasMoved = true;
      SoundFX.playMoveStep();
      this.scene.updateUnits(this.units);
      this.scene.focusOn(enemy.x, this.grid.getHeight(enemy.x, enemy.z), enemy.z);
      // Let the walk finish before acting (the walk runs on frames, so it isn't sped up by ?fast)
      await wait(550);
      if (walkMs > 550 * SPEED) await new Promise((r) => setTimeout(r, walkMs - 550 * SPEED));
    }

    if (plan.ability && plan.targetTile) {
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
    for (const id of ['title-continue', 'title-new', 'title-workshop', 'title-controls', 'title-fullscreen']) {
      (document.getElementById(id) as HTMLButtonElement).disabled = false;
    }
    document.getElementById('title-new')!.textContent = 'New Game';
    document.getElementById('title-version')!.textContent = `v${__APP_VERSION__}`;
    for (const [id, url] of [['title-support', ITCH_URL], ['btn-support', ITCH_URL], ['title-source', SOURCE_URL], ['title-author', AUTHOR_URL]]) {
      (document.getElementById(id) as HTMLAnchorElement).href = url;
    }

    on('title-new', () => this.fromTitle(() => this.startNewGame()));
    on('title-continue', () => this.fromTitle(() => this.loadGame()));
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
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'f' && canFullscreen()) toggleFullscreen();
    });
    guardPageScroll();
  }

  // ---------------------------------------------------------------------------
  // Workshop
  // ---------------------------------------------------------------------------

  private openWorkshop(scenario?: Scenario): void {
    if (this.workshop.isOpen) return;
    if (!this.battleOver && this.currentMode !== 'idle' && this.currentMode !== 'dialogue') {
      this.ui.showBanner('OPEN THE WORKSHOP ON YOUR TURN');
      return;
    }
    // Park the battle in progress so closing the Workshop puts you straight back into it
    this.suspended = this.battleOver ? null : {
      grid: this.grid, units: this.units, turnManager: this.turnManager, chapter: this.currentChapter, mode: this.mode,
      inputMode: this.currentMode, kills: this.kills, round: this.round, roundActed: this.roundActed
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
    this.workshop.open(scenario);
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
    this.round = s.round;
    this.roundActed = s.roundActed;
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

  private playScenario(s: Scenario): void {
    this.suspended = null;
    this.customScenario = s;
    this.mode = 'custom';
    this.setupBattle(scenarioToChapter(s));
    this.ui.addLogEntry(`[WORKSHOP] Playing "${s.title}"${s.author ? ` by ${s.author}` : ''}.`, 'system');
    this.playChapterIntro();
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

  /** Opens a scenario shared as a link (#s=…) in the Workshop. */
  private openShareLink(): void {
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
    const alive = this.units.filter((u) => !u.isDead);
    if (alive.every((u) => this.roundActed.has(u.id))) {
      this.round++;
      this.roundActed.clear();
      const obj = this.currentChapter.objective;
      if (obj?.type === 'survive') {
        const goal = obj.rounds || 6;
        if (this.round > goal) return this.checkBattleStatus();
        this.ui.addLogEntry(`[OBJECTIVE] Round ${this.round} of ${goal}.`, 'system');
        if (this.round === goal) this.ui.showBanner('FINAL ROUND!');
      }
    }
    this.roundActed.add(unit.id);
    return false;
  }

  private checkBattleStatus(): boolean {
    if (this.battleOver) return true;
    const playersAlive = this.units.some((u) => !u.isDead && u.team === 'player');
    let enemiesAlive = this.units.some((u) => !u.isDead && u.team === 'enemy');
    const obj = this.currentChapter.objective;
    let winText = 'VICTORY! BATTLEFIELD SECURED';
    if (playersAlive && obj?.type === 'boss' && this.units.some((u) => u.isBoss && u.team === 'enemy') && !this.units.some((u) => u.isBoss && u.team === 'enemy' && !u.isDead)) {
      enemiesAlive = false;
      winText = 'VICTORY! THE BOSS HAS FALLEN';
      this.ui.addLogEntry('[OBJECTIVE] Their leader is down. The rest of the enemy flees!', 'system');
    }
    if (playersAlive && obj?.type === 'survive' && this.round > (obj.rounds || 6)) {
      enemiesAlive = false;
      winText = 'VICTORY! YOU HELD THE LINE';
    }

    if (!playersAlive) {
      this.battleOver = true;
      this.currentMode = 'menu';
      this.ui.toggleSubMenu(false);
      Music.stop();
      this.ui.showBanner('DEFEAT... ALL ALLIES FALLEN');
      this.ui.addLogEntry('=== DEFEAT! All allies have fallen. ===', 'defeat');
      later(() => this.showDefeat(), 1600);
      return true;
    }
    if (!enemiesAlive) {
      this.battleOver = true;
      this.currentMode = 'menu';
      this.ui.toggleSubMenu(false);
      Music.playTrack('victory');
      SoundFX.playVictoryFanfare();
      this.ui.showBanner(winText);
      this.ui.addLogEntry('=== VICTORY! All hostiles defeated. ===', 'system');
      later(() => this.showSpoils(), 1500);
      return true;
    }
    return false;
  }

  private showDefeat(): void {
    if (this.mode === 'custom') return this.showCustomEnd(false);
    const retry = () => {
      if (this.mode === 'trials') this.startTrial(this.trialsFloor);
      else {
        this.setupBattle(this.currentChapter);
        this.startBattle();
      }
    };
    const buttons: { label: string; primary?: boolean; onClick: () => void }[] = [
      { label: 'Retry Battle', primary: true, onClick: retry }
    ];
    buttons.push({ label: 'World Map', onClick: () => this.openWorldMap(this.mode === 'trials' ? 'trials' : undefined) });
    if (SaveManager.hasSave()) buttons.push({ label: 'Load Save', onClick: () => this.loadGame() });
    this.ui.showResultModal({
      title: 'DEFEAT',
      subtitle: 'Your squad keeps the EXP and JP it earned. Retry with a new formation, or fall back to the world map to restock at the market.',
      buttons
    });
  }

  /** Awards end-of-battle EXP/JP/items and shows the spoils screen. */
  private showSpoils(): void {
    const rows: string[] = [];
    for (const u of this.squad) {
      const survived = !u.isDead;
      const exp = survived ? 40 : 15;
      const jp = survived ? 60 : 20;
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

    const newItems: string[] = [];
    if (this.mode === 'campaign' || this.mode === 'custom') {
      for (const id of this.currentChapter.rewardItemIds || []) {
        if (!this.armory.includes(id)) newItems.push(id);
      }
    } else {
      const drop = rollTrialDrop(this.trialsFloor, this.armory);
      if (drop) newItems.push(drop);
    }
    this.armory.push(...newItems);
    const earned = victoryGil(this.units.filter((u) => u.team === 'enemy'), this.mode, this.trialsFloor);
    this.gil += earned;
    if (earned > 0 || this.fencedThisBattle > 0) {
      const fenced = this.fencedThisBattle > 0 ? ` · +${this.fencedThisBattle} from fenced loot` : '';
      rows.push(`<div class="result-loot result-gil"><b>GIL:</b> +${earned}${fenced} · Purse: ${this.gil.toLocaleString('en-US')}<br><small>Spend it at the market on the world map.</small></div>`);
    }
    if (this.stolenThisBattle.length > 0) {
      rows.push(`<div class="result-loot"><b>STOLEN:</b> ${this.stolenThisBattle.map((id) => esc(ITEMS[id].name)).join(', ')}</div>`);
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

    this.ui.showResultModal({
      title: this.mode === 'custom' ? 'SCENARIO CLEARED' : 'VICTORY — SPOILS OF WAR',
      subtitle,
      bodyHtml: rows.join(''),
      buttons: [{ label: 'Continue', primary: true, onClick: () => this.afterSpoils() }]
    });
  }

  private afterSpoils(): void {
    const next = () => (this.mode === 'custom' ? this.showCustomEnd(true) : this.handleChapterVictoryChoices());
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
    if (this.mode === 'custom') { this.mode = 'campaign'; this.customScenario = null; }
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
    this.ui.showResultModal({
      title: 'THE REALM IS AT PEACE',
      subtitle: 'Campaign complete! Twelve more seals stir beneath the mountain: the Trials of the Zodiac are endless generated battles with rare gear and a Warden boss every fifth floor.',
      bodyHtml: best > 0 ? `<div class="result-row"><span class="result-name">BEST TRIAL</span><span class="result-detail">Floor ${best}</span></div>` : '',
      buttons: [
        { label: 'World Map', primary: true, onClick: () => this.openWorldMap('summit') },
        { label: 'Enter the Trials', onClick: () => this.startTrial(1) },
        { label: 'New Game+', onClick: () => this.startNewGamePlus() }
      ]
    });
  }

  /** A fresh campaign: new squad, starting armory and purse. (The save stays until you save over it.) */
  private startNewGame(): void {
    this.squad = this.createStartingSquad();
    this.armory.length = 0;
    this.armory.push(...STARTING_ARMORY);
    this.gil = STARTING_GIL;
    this.inventory = { ...STARTING_INVENTORY };
    this.campaignCleared = false;
    this.clearedChapters = [];
    this.trialsFloor = 0;
    this.world.close();
    this.world.location = 'ruins';
    this.mode = 'campaign';
    this.customScenario = null;
    this.loadChapter('chapter_1');
  }

  /** The market trades only while the party stands at it on the world map. */
  private marketOpen(): boolean {
    return this.world.isOpen && this.world.location === 'market';
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
  private startNewGamePlus(): void {
    this.ui.addLogEntry('[SYSTEM] New Game+ : your squad keeps its levels, jobs and gear.', 'system');
    this.clearedChapters = [];
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
        if (tile) this.ui.updateTileInfo(x, z, tile.height, tile.terrain);
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
