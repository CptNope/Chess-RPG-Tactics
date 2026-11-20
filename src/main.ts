import * as THREE from 'three';
import { MAPS } from './data/maps';
import { BattleGrid } from './core/Grid';
import { TacticsScene } from './renderer/TacticsScene';
import { UIManager } from './ui/UIManager';
import { TurnManager } from './core/TurnManager';
import { JobSystem } from './core/JobSystem';
import { CombatEngine, AttackResult } from './core/CombatEngine';
import { Unit, Ability, CombatForecast, FacingDirection, DialogueLine, CampaignChapter, Element } from './core/types';
import { CAMPAIGN_CHAPTERS, PLAYER_DEPLOY } from './data/campaign';
import { ITEMS, STARTING_ARMORY } from './data/items';
import { JOBS } from './data/jobs';
import { SoundFX } from './audio/SoundEffects';
import { Music } from './audio/MusicSynthesizer';
import { SaveManager, GameSaveData } from './core/SaveManager';
import { resolveTerrainAbility } from './core/Geomancy';
import { planTurn, unitsInBlast, faceTowards } from './core/EnemyAI';
import { buildTrialFloor, rollTrialDrop } from './core/Trials';
import { GamepadInput, PadAction } from './input/GamepadInput';
import { getQualitySetting, setQualitySetting, resolveQuality, QualitySetting, PROFILES } from './renderer/GraphicsQuality';
import { moveFocus, focusablesIn, Dir } from './input/FocusNav';

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

  private mode: 'campaign' | 'trials' = 'campaign';
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
    this.ui.armory = this.armory;
    this.squad = this.createStartingSquad();

    this.setupBattle(CAMPAIGN_CHAPTERS.chapter_1);

    const canvas = document.getElementById('viewport-canvas') as HTMLCanvasElement;
    this.scene = new TacticsScene(canvas, this.grid);
    this.scene.updateUnits(this.units);
    this.applyAtmosphereForMap(this.currentChapter.mapId);

    this.bindEvents();
    this.playChapterIntro();
    this.gameLoop();

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

  private applyAtmosphereForMap(mapId: string): void {
    const theme = MAPS[mapId] ? MAPS[mapId]().theme : 'day';
    this.scene.vfx.setWeatherTheme(theme);
  }

  /** Puts every squad member on a free, walkable deployment tile with full HP/MP. */
  private deploySquad(): void {
    const taken = new Set<string>();
    for (const e of this.units.filter((u) => u.team === 'enemy')) taken.add(`${e.x},${e.z}`);

    this.squad.forEach((member, i) => {
      let spot = PLAYER_DEPLOY[i % PLAYER_DEPLOY.length];
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
      const u = JobSystem.createUnit(`e${idx + 1}`, e.name, 'enemy', e.jobId, e.x, e.z, 'S', e.level);
      if (e.isBoss) JobSystem.makeBoss(u);
      // Enemy casters get their job's reaction/support so they fight like the player's units
      this.equipEnemyPassives(u);
      return u;
    });
  }

  private equipEnemyPassives(u: Unit): void {
    const byJob: Record<string, { reaction?: string; support?: string }> = {
      knight: { reaction: 'kn_parry' },
      white_mage: { reaction: 'wm_auto_potion' },
      black_mage: { support: 'bm_arcane_strength' },
      ninja: { support: 'ni_dual_wield' },
      dragoon: { reaction: 'dr_dragonheart' },
      geomancer: { reaction: 'geo_earthen_ward' }
    };
    if (u.level < 4) return;
    const p = byJob[u.jobId] || {};
    if (p.reaction) {
      u.unlockedAbilities[p.reaction] = true;
      u.equippedAbilities.reaction = p.reaction;
    }
    if (p.support) {
      u.unlockedAbilities[p.support] = true;
      u.equippedAbilities.support = p.support;
    }
    // Veteran enemies know every action in their job's skillset
    for (const a of JOBS[u.jobId]?.abilities || []) {
      if (a.type === 'action') u.unlockedAbilities[a.id] = true;
    }
  }

  /** Builds grid, squad deployment and enemies for a chapter (optionally on a different map). */
  private setupBattle(chapter: CampaignChapter, mapOverride?: string): void {
    this.currentChapter = chapter;
    const mapId = mapOverride || chapter.mapId;
    this.grid = new BattleGrid((MAPS[mapId] || MAPS.river_ruins)());

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
    this.battleOver = false;

    this.ui.setMapSelection(mapId);
    if (this.scene) {
      this.scene.loadMap(this.grid);
      this.scene.updateUnits(this.units);
      this.applyAtmosphereForMap(mapId);
      // Clear the previous battle's HUD before the intro dialogue plays
      this.ui.updateTurnTimeline(this.turnManager.predictTurnTimeline(8), null);
      const lead = this.squad[0];
      this.ui.updateUnitCard(lead, this.grid.getHeight(lead.x, lead.z));
      this.scene.focusOn(lead.x, this.grid.getHeight(lead.x, lead.z), lead.z);
    }
  }

  private loadChapter(chapterId: string): void {
    this.mode = 'campaign';
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
    this.ui.onMapChanged = (mapId) => this.switchBattlefield(mapId);

    this.ui.onEditorToggled = (isOpen) => {
      this.currentMode = isOpen ? 'editor' : 'idle';
      this.scene.clearHighlights();
    };

    this.ui.onEditorExport = () => {
      const json = JSON.stringify(this.grid.mapData, null, 2);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(json);
        this.ui.showBanner('MAP JSON COPIED TO CLIPBOARD!');
      } else {
        prompt('Copy your Map JSON:', json);
      }
    };

    this.ui.onEditorImport = (jsonString) => {
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed.tiles && parsed.width) {
          this.grid = new BattleGrid(parsed);
          this.scene.loadMap(this.grid);
          this.ui.showBanner('CUSTOM MAP LOADED SUCCESSFULLY!');
        }
      } catch {
        this.ui.showBanner('INVALID MAP JSON');
      }
    };

    this.ui.onEditorTestBattle = () => {
      this.ui.toggleEditor(false);
      const enemies = this.spawnEnemies(this.currentChapter);
      this.units = [...enemies];
      this.deploySquad();
      this.units = [...this.squad, ...enemies];
      this.turnManager = new TurnManager(this.units);
      this.battleOver = false;
      this.scene.updateUnits(this.units);
      this.startBattle();
    };

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
    if (this.ui.isSystemMenuOpen) return this.ui.toggleSystemMenu(false);
    if (this.ui.isJobModalOpen) return this.ui.closeJobModal();
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
    if (this.ui.isEditorOpen) return this.ui.toggleEditor(false);
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
      const tile = this.grid.getTile(t.x, t.z);
      if (tile) this.ui.updateTileInfo(t.x, t.z, tile.height, tile.terrain);
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
    switch (a) {
      case 'up': case 'down': case 'left': case 'right':
        return this.handleDirection(a);
      case 'confirm': return this.handleConfirm();
      case 'cancel': return this.cancelAction();
      case 'commands':
        if (this.isPlayerIdle()) this.ui.focusCommands();
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
    const ok = SaveManager.saveGame(this.currentChapter.id, this.squad, {
      armory: this.armory,
      mode: this.mode,
      trialsFloor: this.trialsFloor,
      campaignCleared: this.campaignCleared
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
        return u;
      });

    const owned = new Set<string>(data.armory || STARTING_ARMORY);
    for (const u of this.squad) {
      for (const it of Object.values(u.equipment)) if (it) owned.add(it.id);
    }
    this.armory.length = 0;
    this.armory.push(...owned);

    this.campaignCleared = !!data.campaignCleared;
    if (data.mode === 'trials' && data.trialsFloor) {
      this.ui.showBanner('SAVE FILE RESTORED!');
      this.startTrial(data.trialsFloor);
    } else {
      this.mode = 'campaign';
      this.setupBattle(CAMPAIGN_CHAPTERS[data.currentChapterId] || CAMPAIGN_CHAPTERS.chapter_1);
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
    this.updateTimeline();
    this.advanceTurn();
  }

  private advanceTurn(): void {
    if (this.battleOver || this.checkBattleStatus()) return;

    const result = this.turnManager.advanceToNextActiveTurn();
    if (!result) {
      this.checkBattleStatus();
      return;
    }

    const { activeUnit, poisonDamage } = result;
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

    this.currentMode = 'targeting';
    (document.activeElement as HTMLElement | null)?.blur();
    const supportive = CombatEngine.isSupportive(ability);
    const tiles = this.grid.mapData.tiles.filter((t) =>
      this.grid.canTarget(active.x, active.z, t.x, t.z, ability.range, ability.heightTolerance, supportive)
    );
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

    if (this.ui.isEditorOpen) {
      const targetTile = this.grid.getTile(tile.x, tile.z);
      if (!targetTile) return;
      SoundFX.playMoveStep();
      const tool = this.ui.currentEditorTool;
      if (tool === 'raise') {
        this.scene.updateTile(tile.x, tile.z, targetTile.height + 0.5, targetTile.terrain, targetTile.walkable);
      } else if (tool === 'lower') {
        this.scene.updateTile(tile.x, tile.z, Math.max(0, targetTile.height - 0.5), targetTile.terrain, targetTile.walkable);
      } else if (tool === 'paint') {
        this.scene.updateTile(tile.x, tile.z, targetTile.height, this.ui.currentPaintTerrain, targetTile.walkable);
      } else if (tool === 'walkable') {
        this.scene.updateTile(tile.x, tile.z, targetTile.height, targetTile.terrain, !targetTile.walkable);
      }
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
    const u = this.units.find((v) => !v.isDead && v.x === tx && v.z === tz);
    return u ? [u] : [];
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

  private playElementFx(element: Element, pos: THREE.Vector3): void {
    if (element === 'physical') {
      SoundFX.playSwordSlash();
      this.scene.vfx.spawnSlashFX(pos);
    } else {
      SoundFX.playMagicCast();
      if (element === 'fire') this.scene.vfx.spawnFireFX(pos);
      else if (element === 'ice') this.scene.vfx.spawnIceFX(pos);
      else if (element === 'lightning') this.scene.vfx.spawnLightningFX(pos);
      else if (element === 'holy' || element === 'time') this.scene.vfx.spawnHolyFX(pos);
      else this.scene.vfx.spawnSlashFX(pos);
    }
  }

  /**
   * Resolves an ability: spends MP once, then rolls it against every unit it touches,
   * plays effects, handles reactions, boss enrage, and awards EXP/JP to player units.
   */
  private async performAction(caster: Unit, ability: Ability, tx: number, tz: number): Promise<void> {
    const victims = this.victimsFor(caster, ability, tx, tz);
    caster.currentMp = Math.max(0, caster.currentMp - ability.mpCost);
    caster.hasActed = true;

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
      if (target.isDead) continue;
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
      const jpGain = Math.round(24 * (caster.equippedAbilities.support === 'sq_jp_boost' ? 1.5 : 1));
      caster.jobPoints[caster.jobId] = (caster.jobPoints[caster.jobId] || 0) + jpGain;
      const levels = JobSystem.grantExp(caster, 10 + (anyKill ? 20 : 0));
      if (levels > 0) {
        const h = this.grid.getHeight(caster.x, caster.z);
        this.scene.spawnFloatingDamage(caster.x, h + 0.4, caster.z, `LEVEL UP! Lv ${caster.level}`, 'heal');
        this.ui.addLogEntry(`[LEVEL] ${caster.name} reached level ${caster.level}!`, 'system');
        SoundFX.playVictoryFanfare();
      }
    }

    this.scene.updateUnits(this.units);
    await wait(250);
  }

  private presentResult(target: Unit, forecast: CombatForecast, result: AttackResult): void {
    const h = this.grid.getHeight(target.x, target.z);
    const pos = new THREE.Vector3(target.x, h, target.z);
    const ability = forecast.ability;

    if (!result.hit) {
      SoundFX.playMenuBlip();
      this.scene.spawnFloatingDamage(target.x, h, target.z, 'MISS', 'miss');
      if (result.reaction?.type === 'parry') {
        this.ui.showBanner(result.reaction.description);
        this.ui.addLogEntry(`[PARRY] ${result.reaction.description}`, 'reaction');
      } else {
        this.ui.addLogEntry(`[MISS] ${ability.name} missed ${target.name}.`, 'attack');
      }
      return;
    }

    if (result.isHeal) {
      SoundFX.playHeal();
      this.scene.vfx.spawnHolyFX(pos);
      this.scene.spawnFloatingDamage(target.x, h, target.z, `+${result.damageDealt}`, 'heal');
      this.ui.addLogEntry(`[HEAL] ${target.name} recovers ${result.damageDealt} HP.`, 'heal');
      return;
    }

    if (result.damageDealt === 0) {
      SoundFX.playMagicCast();
      this.scene.vfx.spawnHolyFX(pos);
      this.scene.spawnFloatingDamage(target.x, h, target.z, `[${result.appliedStatus || 'OK'}]`, 'heal');
      this.ui.addLogEntry(`[STATUS] ${target.name} receives ${result.appliedStatus}.`, 'spell');
      return;
    }

    this.scene.triggerUnitRecoil(target.id);
    this.playElementFx(ability.element, pos);

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
          this.scene.vfx.spawnSlashFX(pos);
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
      this.scene.vfx.spawnFireFX(pos);
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
    const tpos = new THREE.Vector3(target.x, th, target.z);

    if (rx.type === 'counter_attack' && rx.damage) {
      this.scene.triggerUnitLunge(target.id, caster.x, caster.z);
      this.scene.triggerUnitRecoil(caster.id);
      SoundFX.playSwordSlash();
      const ch = this.grid.getHeight(caster.x, caster.z);
      this.scene.spawnFloatingDamage(caster.x, ch, caster.z, `-${rx.damage}`, 'damage');
      this.scene.vfx.spawnSlashFX(new THREE.Vector3(caster.x, ch, caster.z));
      if (caster.isDead) this.ui.addLogEntry(`[DEFEAT] The counter felled ${caster.name}!`, 'defeat');
    } else if (rx.type === 'auto_potion' && rx.heal) {
      SoundFX.playHeal();
      this.scene.vfx.spawnHolyFX(tpos);
      this.scene.spawnFloatingDamage(target.x, th, target.z, `+${rx.heal}`, 'heal');
    } else if (rx.type === 'dragonheart') {
      SoundFX.playHeal();
      this.scene.vfx.spawnHolyFX(tpos);
      this.scene.spawnFloatingDamage(target.x, th, target.z, 'REVIVED!', 'heal');
    } else if (rx.type === 'earthen_ward') {
      SoundFX.playHeal();
      this.scene.spawnFloatingDamage(target.x, th, target.z, 'PROTECT', 'heal');
    } else if (rx.type === 'speed_save') {
      SoundFX.playTurnChime();
      this.scene.spawnFloatingDamage(target.x, th, target.z, 'SPD +2', 'heal');
    } else if (rx.type === 'critical_quick') {
      SoundFX.playTurnChime();
      this.scene.spawnFloatingDamage(target.x, th, target.z, 'QUICK!', 'heal');
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
      enemy.x = plan.moveTo.x;
      enemy.z = plan.moveTo.z;
      enemy.hasMoved = true;
      SoundFX.playMoveStep();
      this.scene.updateUnits(this.units);
      this.scene.focusOn(enemy.x, this.grid.getHeight(enemy.x, enemy.z), enemy.z);
      await wait(550);
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
  // Victory, defeat, spoils, epilogue, Trials
  // ---------------------------------------------------------------------------

  private checkBattleStatus(): boolean {
    if (this.battleOver) return true;
    const playersAlive = this.units.some((u) => !u.isDead && u.team === 'player');
    const enemiesAlive = this.units.some((u) => !u.isDead && u.team === 'enemy');

    if (!playersAlive) {
      this.battleOver = true;
      this.currentMode = 'menu';
      Music.stop();
      this.ui.showBanner('DEFEAT... ALL ALLIES FALLEN');
      this.ui.addLogEntry('=== DEFEAT! All allies have fallen. ===', 'defeat');
      later(() => this.showDefeat(), 1600);
      return true;
    }
    if (!enemiesAlive) {
      this.battleOver = true;
      this.currentMode = 'menu';
      Music.playTrack('victory');
      SoundFX.playVictoryFanfare();
      this.ui.showBanner('VICTORY! BATTLEFIELD SECURED');
      this.ui.addLogEntry('=== VICTORY! All hostiles defeated. ===', 'system');
      later(() => this.showSpoils(), 1500);
      return true;
    }
    return false;
  }

  private showDefeat(): void {
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
    if (SaveManager.hasSave()) buttons.push({ label: 'Load Save', onClick: () => this.loadGame() });
    this.ui.showResultModal({
      title: 'DEFEAT',
      subtitle: 'Your squad keeps the EXP and JP it earned. Retry with a new formation, swap jobs in Team, or load your save.',
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
      u.jobPoints[u.jobId] = (u.jobPoints[u.jobId] || 0) + Math.round(jp * (u.equippedAbilities.support === 'sq_jp_boost' ? 1.5 : 1));
      const levels = JobSystem.grantExp(u, exp + (this.kills[u.id] || 0) * 10);
      const killsText = this.kills[u.id] ? ` · ${this.kills[u.id]} KO` : '';
      rows.push(`<div class="result-row ${survived ? '' : 'fallen'}">
        <span><span class="result-name">${esc(u.name)}</span>${levels > 0 ? `<span class="levelup">LEVEL UP! Lv ${u.level}</span>` : ''}</span>
        <span class="result-detail">${survived ? '' : 'Fell in battle · '}+${exp} EXP · +${jp} JP${killsText}</span>
      </div>`);
    }

    const newItems: string[] = [];
    if (this.mode === 'campaign') {
      for (const id of this.currentChapter.rewardItemIds || []) {
        if (!this.armory.includes(id)) newItems.push(id);
      }
    } else {
      const drop = rollTrialDrop(this.trialsFloor, this.armory);
      if (drop) newItems.push(drop);
    }
    this.armory.push(...newItems);
    if (newItems.length > 0) {
      rows.push(`<div class="result-loot"><b>NEW GEAR:</b> ${newItems.map((id) => esc(ITEMS[id].name)).join(', ')}<br><small>Equip it from ★ Team → Equipment.</small></div>`);
    }

    let subtitle = `${this.currentChapter.title}: ${this.currentChapter.subtitle}`;
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
          { label: 'Save', onClick: () => { this.saveGame(true); this.trialsFloor++; this.saveGame(false); this.startTrial(this.trialsFloor); } }
        ]
      });
      return;
    }

    this.ui.showResultModal({
      title: 'VICTORY — SPOILS OF WAR',
      subtitle,
      bodyHtml: rows.join(''),
      buttons: [{ label: 'Continue', primary: true, onClick: () => this.afterSpoils() }]
    });
  }

  private afterSpoils(): void {
    const next = () => this.handleChapterVictoryChoices();
    if (this.currentChapter.victoryDialogue.length > 0) {
      this.playDialogueSequence(this.currentChapter.victoryDialogue, next);
    } else {
      next();
    }
  }

  private handleChapterVictoryChoices(): void {
    this.currentMode = 'menu';
    if (this.currentChapter.choices && this.currentChapter.choices.length > 0) {
      this.ui.showChoiceModal(
        `${this.currentChapter.title} — VICTORY!`,
        'The enemy forces are in disarray! How shall we proceed, Commander?',
        this.currentChapter.choices,
        (choice) => {
          for (const id of choice.rewardItemIds || []) if (!this.armory.includes(id)) this.armory.push(id);
          this.ui.showBanner(`ORDERS: ${choice.text}`);
          this.ui.addLogEntry(`[ARMORY] ${choice.rewardText}`, 'system');
          later(() => {
            this.loadChapter(choice.nextChapterId);
            this.saveGame(false); // autosave at the start of each chapter
          }, 1200);
        }
      );
      return;
    }

    this.campaignCleared = true;
    this.saveGame(false);
    this.showEpilogue();
  }

  private showEpilogue(): void {
    const best = SaveManager.getBestTrialFloor();
    this.ui.showResultModal({
      title: 'THE REALM IS AT PEACE',
      subtitle: 'Campaign complete! Twelve more seals stir beneath the mountain: the Trials of the Zodiac are endless generated battles with rare gear and a Warden boss every fifth floor.',
      bodyHtml: best > 0 ? `<div class="result-row"><span class="result-name">BEST TRIAL</span><span class="result-detail">Floor ${best}</span></div>` : '',
      buttons: [
        { label: 'Enter the Trials', primary: true, onClick: () => this.startTrial(1) },
        { label: 'New Game+', onClick: () => this.startNewGamePlus() }
      ]
    });
  }

  /** Replays the campaign from Chapter I keeping squad levels, jobs, abilities and armory. */
  private startNewGamePlus(): void {
    this.ui.addLogEntry('[SYSTEM] New Game+ : your squad keeps its levels, jobs and gear.', 'system');
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
        const tile = this.grid.getTile(x, z);
        if (tile) this.ui.updateTileInfo(x, z, tile.height, tile.terrain);
      }
    }

    if (this.scene) this.scene.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new TacticsGame();
});
