import { Unit, Ability, CombatForecast, FacingDirection, DialogueLine, TerrainType, EquipmentSlot, StoryChoice, Item } from '../core/types';
import { JOBS, PLAYER_JOB_IDS } from '../data/jobs';
import { JobSystem, BEAST_SLOTS, MAX_JOB_LEVEL , JOB_MASTERY, VETERAN_JOB_LEVEL, masteryLabel } from '../core/JobSystem';
import { CONSUMABLES, MAX_STACK, Consumable, consumableAbility } from '../data/consumables';
import { pouchText } from '../core/EnemyPouch';
import { ITEMS } from '../data/items';
import { getItemsForSlot } from '../data/items';
import { resolveTerrainAbility } from '../core/Geomancy';
import { itemStatText } from '../core/Economy';
import { JOB_GEAR, gearKindName, jobGearText, whoCanUse } from '../data/gear-rules';
import { encoreTurns, performedBy } from '../core/Performance';
import { SIGNATURES } from '../data/signatures';
import { portraitCanvas, portraitDataUrl, portraitForSpeaker } from '../graphics/CharacterArt';
import { ensureFocusable, focusablesIn, focusVisible } from '../input/FocusNav';
import { SoundFX } from '../audio/SoundEffects';

export class UIManager {
  // Elements
  private timelineQueueEl = document.getElementById('timeline-queue')!;
  private unitNameEl = document.getElementById('unit-name')!;
  private unitJobEl = document.getElementById('unit-job')!;
  private unitStatusesEl = document.getElementById('unit-statuses')!;
  private unitHpTextEl = document.getElementById('unit-hp-text')!;
  private unitHpBarEl = document.getElementById('unit-hp-bar')!;
  private unitMpTextEl = document.getElementById('unit-mp-text')!;
  private unitMpBarEl = document.getElementById('unit-mp-bar')!;
  private unitCtTextEl = document.getElementById('unit-ct-text')!;
  private unitCtBarEl = document.getElementById('unit-ct-bar')!;
  private unitMoveValEl = document.getElementById('unit-move-val')!;
  private unitJumpValEl = document.getElementById('unit-jump-val')!;
  private unitSpdValEl = document.getElementById('unit-spd-val')!;
  private unitHtValEl = document.getElementById('unit-ht-val')!;
  private tileCoordsEl = document.getElementById('tile-coords')!;
  private tileTerrainEl = document.getElementById('tile-terrain')!;

  // Map & Audio controls
  private mapSelectEl = document.getElementById('map-select') as HTMLSelectElement;
  private btnToggleSound = document.getElementById('btn-toggle-sound') as HTMLButtonElement;
  private btnToggleBgm = document.getElementById('btn-toggle-bgm') as HTMLButtonElement;
  private btnToggleLog = document.getElementById('btn-toggle-log') as HTMLButtonElement;
  private btnSaveGame = document.getElementById('btn-save-game') as HTMLButtonElement;
  private btnLoadGame = document.getElementById('btn-load-game') as HTMLButtonElement;
  private btnWorkshop = document.getElementById('btn-workshop') as HTMLButtonElement;

  // Combat Chronicle & Reaction Log Drawer
  private combatLogDrawerEl = document.getElementById('combat-log-drawer')!;
  private combatLogEntriesEl = document.getElementById('combat-log-entries')!;
  private btnClearLog = document.getElementById('btn-clear-log')!;
  private btnCloseLog = document.getElementById('btn-close-log')!;
  public isCombatLogOpen: boolean = false;


  // Menus
  private btnMove = document.getElementById('btn-action-move') as HTMLButtonElement;
  private btnAct = document.getElementById('btn-action-act') as HTMLButtonElement;
  private btnWait = document.getElementById('btn-action-wait') as HTMLButtonElement;
  private btnItem = document.getElementById('btn-action-item') as HTMLButtonElement;
  /** The unit and ground the ACT list was last built for, so ACT can rebuild it after ITEM borrowed the panel. */
  private subMenuFor: { unit: Unit; terrain?: TerrainType } | null = null;
  /** The squad's consumables (id to count), provided by the game. */
  public inventory: () => Record<string, number> = () => ({});
  private btnAuto = document.getElementById('btn-action-auto') as HTMLButtonElement;
  private subMenuEl = document.getElementById('sub-menu')!;
  private subMenuItemsEl = document.getElementById('sub-menu-items')!;
  private btnSubMenuBack = document.getElementById('btn-sub-menu-back')!;

  // Facing selector
  private facingSelectorEl = document.getElementById('facing-selector')!;
  private selectedFacing: FacingDirection = 'S';

  // Combat forecast
  private forecastEl = document.getElementById('combat-forecast')!;
  private fcTargetName = document.getElementById('fc-target-name')!;
  private fcFacingBadge = document.getElementById('fc-facing-badge')!;
  private fcHitRate = document.getElementById('fc-hit-rate')!;
  private fcDamage = document.getElementById('fc-damage')!;
  private btnForecastConfirm = document.getElementById('btn-forecast-confirm')!;
  private btnForecastCancel = document.getElementById('btn-forecast-cancel')!;

  // Story Cutscene Dialogue Box
  private dialogueBoxEl = document.getElementById('dialogue-box')!;
  private dialoguePortraitEl = document.getElementById('dialogue-portrait')!;
  private dialogueSpeakerEl = document.getElementById('dialogue-speaker')!;
  private dialogueTextEl = document.getElementById('dialogue-text')!;
  private onDialogueNext?: () => void;

  // Branching Choice Modal
  private choiceModalEl = document.getElementById('choice-modal')!;
  private choiceChapterTitleEl = document.getElementById('choice-chapter-title')!;
  private choiceIntroTextEl = document.getElementById('choice-intro-text')!;
  private choiceCardsContainerEl = document.getElementById('choice-cards-container')!;

  // Job & Equipment Modal
  private jobModalEl = document.getElementById('job-modal')!;
  private btnOpenJobModal = document.getElementById('btn-job-menu')!;
  private btnCloseJobModal = document.getElementById('btn-close-job-modal')!;
  private btnTabJobs = document.getElementById('btn-tab-jobs')!;
  private btnTabEquip = document.getElementById('btn-tab-equip')!;
  private tabContentJobs = document.getElementById('tab-content-jobs')!;
  private tabContentEquip = document.getElementById('tab-content-equip')!;
  private btnTabShop = document.getElementById('btn-tab-shop')!;
  private tabContentShop = document.getElementById('tab-content-shop')!;
  private shopListEl = document.getElementById('shop-list')!;
  private shopNoteEl = document.getElementById('shop-note')!;
  private gilBadgeEl = document.getElementById('gil-badge')!;
  /** Redraws the Team screen for the unit it's showing (set whenever it's populated). */
  private refreshTeam: () => void = () => undefined;

  private jobUnitTabsEl = document.getElementById('job-unit-tabs')!;
  private jobListEl = document.getElementById('job-list')!;
  private currentUnitJpEl = document.getElementById('current-unit-jp')!;
  private learnAbilityListEl = document.getElementById('learn-ability-list')!;

  private selectedGearSlot: EquipmentSlot = 'weapon';
  private inventoryListEl = document.getElementById('inventory-list')!;
  private inventoryHeaderEl = document.getElementById('inventory-header')!;

  // Result modal (spoils / defeat / epilogue / Trials)
  private resultModalEl = document.getElementById('result-modal')!;
  private resultTitleEl = document.getElementById('result-title')!;
  private resultSubtitleEl = document.getElementById('result-subtitle')!;
  private resultBodyEl = document.getElementById('result-body')!;
  private resultActionsEl = document.getElementById('result-actions')!;

  // Menu, help and status
  private btnMenu = document.getElementById('btn-menu') as HTMLButtonElement;
  private systemMenuEl = document.getElementById('system-menu')!;
  private btnHelp = document.getElementById('btn-help') as HTMLButtonElement;
  private helpModalEl = document.getElementById('help-modal')!;
  private btnStatus = document.getElementById('btn-action-status') as HTMLButtonElement;
  private portraitEl = document.getElementById('unit-portrait') as HTMLCanvasElement;
  private dialogueHintEl = document.querySelector('.dialogue-hint') as HTMLElement | null;
  /** Element focused before a modal opened, restored when it closes. */
  private returnFocus: HTMLElement | null = null;
  public onStatusClicked?: () => void;
  public onRecenterClicked?: () => void;

  /** Item ids the squad owns. The gear tab only offers these. */
  public armory: string[] = [];
  /** The purse and the shop's shelves, provided by the game. */
  public shop: {
    gil: () => number;
    stock: () => Item[];
    nextCap: () => number | null;
    buy: (id: string) => boolean;
    /** True while the party is at the market (buying and selling allowed). */
    open: () => boolean;
    supplies: () => Consumable[];
    buySupply: (id: string) => boolean;
    sellSupply: (id: string) => boolean;
    sellGear: (id: string) => boolean;
    /** Why a piece of gear can't be sold, or null. */
    saleBlock: (id: string) => string | null;
  } | null = null;
  private shopMode: 'buy' | 'sell' = 'buy';

  // Banner
  private bannerEl = document.getElementById('battle-banner')!;
  private bannerTextEl = document.getElementById('banner-text')!;

  // Callbacks
  public onMoveClicked?: () => void;
  public onAbilitySelected?: (ability: Ability) => void;
  /** Called when the Team screen closes (the world map refreshes its purse). */
  public onJobModalClosed?: () => void;
  /** True when this unit's move this turn can still be taken back. */
  public canUndoMove: (unit: Unit) => boolean = () => false;
  public onWaitClicked?: () => void;
  public onAutoClicked?: () => void;
  public onFacingConfirmed?: (facing: FacingDirection) => void;
  public onExecuteAttack?: () => void;
  public onCancelAttack?: () => void;
  public onMapChanged?: (mapId: string) => void;
  public onWorkshop?: () => void;
  public onToggleBgm?: () => void;
  public onSaveGame?: () => void;
  public onLoadGame?: () => void;

  constructor() {
    this.setupListeners();
    // Keep Tab inside an open modal so keyboard players can't wander into the HUD behind it
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const shown = (id: string) => { const el = document.getElementById(id); return el && !el.classList.contains('hidden') ? el : null; };
      // The world map covers the battlefield HUD the same way a modal does (the system menu can sit on top of it)
      const modal = [...document.querySelectorAll<HTMLElement>('.modal-overlay')].find((m) => !m.classList.contains('hidden'))
        || (shown('world-map') ? shown('system-menu') || shown('world-map') : null);
      if (!modal) return;
      const items = focusablesIn(modal);
      if (items.length === 0) return;
      const idx = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); focusVisible(items[items.length - 1]); }
      else if (!e.shiftKey && (idx === -1 || idx === items.length - 1)) { e.preventDefault(); focusVisible(items[0]); }
    }, true);

    // Enter / Space activate focusable non-button controls (cards, list items, slots)
    document.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if ((e.key === 'Enter' || e.key === ' ') && t && t.getAttribute('role') === 'button' && t.tagName !== 'BUTTON') {
        e.preventDefault();
        e.stopPropagation();
        t.click();
      }
    }, true);
  }

  private setupListeners(): void {
    // SFX toggle
    this.btnToggleSound.addEventListener('click', () => {
      const isMuted = SoundFX.toggleMute();
      this.btnToggleSound.textContent = `Sound FX: ${isMuted ? 'Off' : 'On'}`;
      this.btnToggleSound.setAttribute('aria-pressed', String(!isMuted));
      if (!isMuted) SoundFX.playMenuBlip();
    });

    // BGM toggle
    this.btnToggleBgm.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      if (this.onToggleBgm) this.onToggleBgm();
    });

    // Combat Log toggle & actions
    this.btnToggleLog.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.toggleCombatLog(!this.isCombatLogOpen);
    });

    this.btnCloseLog.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.toggleCombatLog(false);
    });

    this.btnClearLog.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.combatLogEntriesEl.innerHTML = '';
      this.addLogEntry('Chronicle cleared.', 'system');
    });

    // Save & Load Game
    this.btnSaveGame.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      if (this.onSaveGame) this.onSaveGame();
    });

    this.btnLoadGame.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      if (this.onLoadGame) this.onLoadGame();
    });

    this.btnWorkshop.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.toggleSystemMenu(false);
      this.onWorkshop?.();
    });

    // Map selection change
    this.mapSelectEl?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement;
      SoundFX.playMenuBlip();
      this.onMapChanged?.(select.value);
    });

    this.btnMove.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.onMoveClicked?.();
    });

    this.btnAct.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      if (this.subMenuFor) this.populateActionSubMenu(this.subMenuFor.unit, this.subMenuFor.terrain);
      this.toggleSubMenu(true);
    });

    this.btnItem.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.populateItemSubMenu();
      this.toggleSubMenu(true);
    });

    this.btnWait.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.onWaitClicked?.();
    });

    this.btnAuto.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.onAutoClicked?.();
    });

    this.btnSubMenuBack.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.toggleSubMenu(false);
    });

    // Compass Facing Buttons
    const compassButtons = document.querySelectorAll('.compass-btn');
    compassButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        SoundFX.playMenuBlip();
        compassButtons.forEach((b) => b.classList.remove('selected'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('selected');
        this.selectedFacing = target.dataset.facing as FacingDirection;
      });
    });

    document.getElementById('btn-face-confirm')?.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.facingSelectorEl.classList.add('hidden');
      this.onFacingConfirmed?.(this.selectedFacing);
    });

    // Forecast Buttons
    this.btnForecastConfirm.addEventListener('click', () => {
      this.forecastEl.classList.add('hidden');
      this.onExecuteAttack?.();
    });

    this.btnForecastCancel.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.forecastEl.classList.add('hidden');
      this.onCancelAttack?.();
    });

    // Job Modal Buttons
    this.btnOpenJobModal.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.openJobModal();
    });

    this.btnCloseJobModal.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.closeJobModal();
    });

    // Modal Subtabs (Jobs vs Equip)
    const tabs: [HTMLElement, HTMLElement][] = [
      [this.btnTabJobs, this.tabContentJobs],
      [this.btnTabEquip, this.tabContentEquip],
      [this.btnTabShop, this.tabContentShop]
    ];
    for (const [btn, pane] of tabs) {
      btn.addEventListener('click', () => {
        SoundFX.playMenuBlip();
        for (const [b, p] of tabs) {
          b.classList.toggle('active', b === btn);
          p.classList.toggle('hidden', p !== pane);
        }
        // The squad tabs don't apply to the shop: it sells to the whole armory
        this.jobUnitTabsEl.classList.toggle('hidden', pane === this.tabContentShop);
      });
    }

    // Story Dialogue Advance Click
    this.dialogueBoxEl.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.onDialogueNext?.();
    });

    // System menu dropdown
    this.btnMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      SoundFX.playMenuBlip();
      this.toggleSystemMenu();
    });
    this.systemMenuEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.toggleSystemMenu(false);
    });
    document.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      if (this.isSystemMenuOpen && !this.systemMenuEl.contains(t) && !t.closest?.('[data-menu-toggle]')) this.toggleSystemMenu(false);
    });

    // Controls help
    this.btnHelp.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.toggleHelp(true);
    });
    document.getElementById('btn-close-help')?.addEventListener('click', () => this.toggleHelp(false));

    // STATUS: open this unit's jobs and gear
    this.btnStatus.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.onStatusClicked?.();
    });
    document.getElementById('btn-recenter')?.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.onRecenterClicked?.();
    });

    // Clicking the dark backdrop of a modal closes the ones that are safe to dismiss
    for (const modal of [this.jobModalEl, this.helpModalEl]) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (modal === this.jobModalEl) this.closeJobModal();
          else this.toggleHelp(false);
        }
      });
    }

    this.dialogueBoxEl.tabIndex = 0;
    this.dialogueBoxEl.setAttribute('role', 'button');
    this.dialogueBoxEl.setAttribute('aria-label', 'Continue dialogue');
    document.getElementById('battle-banner')?.setAttribute('role', 'status');
  }

  // ---------------------------------------------------------------------------
  // Menus, modals and focus
  // ---------------------------------------------------------------------------

  public get isSystemMenuOpen(): boolean {
    return !this.systemMenuEl.classList.contains('hidden');
  }

  public toggleSystemMenu(open: boolean = !this.isSystemMenuOpen): void {
    this.systemMenuEl.classList.toggle('hidden', !open);
    this.btnMenu.setAttribute('aria-expanded', String(open));
    if (open) {
      this.returnFocus = document.activeElement as HTMLElement | null;
      const first = focusablesIn(this.systemMenuEl)[0];
      if (first) focusVisible(first);
    } else if (this.returnFocus && document.activeElement && this.systemMenuEl.contains(document.activeElement)) {
      this.returnFocus.focus();
    }
  }

  public get isHelpOpen(): boolean {
    return !this.helpModalEl.classList.contains('hidden');
  }

  public toggleHelp(open: boolean = !this.isHelpOpen): void {
    if (open) this.openModal(this.helpModalEl);
    else this.closeModal(this.helpModalEl);
  }

  public get isJobModalOpen(): boolean {
    return !this.jobModalEl.classList.contains('hidden');
  }

  public openJobModal(): void {
    this.openModal(this.jobModalEl);
  }

  public closeJobModal(): void {
    this.closeModal(this.jobModalEl);
    this.onJobModalClosed?.();
  }

  private openModal(el: HTMLElement): void {
    if (el.classList.contains('hidden')) this.returnFocus = document.activeElement as HTMLElement | null;
    el.classList.remove('hidden');
    ensureFocusable(el);
    const first = focusablesIn(el)[0];
    if (first) focusVisible(first);
  }

  private closeModal(el: HTMLElement): void {
    el.classList.add('hidden');
    if (this.returnFocus && document.contains(this.returnFocus) && !this.returnFocus.closest('.hidden')) this.returnFocus.focus();
    else (document.activeElement as HTMLElement | null)?.blur();
    this.returnFocus = null;
  }

  /**
   * The topmost open layer that should capture arrow keys / d-pad, if any.
   * Battlefield input (tile cursor) is used when this returns null.
   */
  public activeLayer(): HTMLElement | null {
    const order = ['help-modal', 'title-screen', 'result-modal', 'choice-modal', 'job-modal', 'system-menu', 'world-map', 'facing-selector', 'combat-forecast', 'sub-menu'];
    for (const id of order) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) return el;
    }
    const focused = document.activeElement;
    for (const id of ['action-menu', 'top-bar', 'camera-controls', 'combat-log-drawer', 'workshop']) {
      const el = document.getElementById(id);
      if (el && focused && el.contains(focused)) return el;
    }
    return null;
  }

  /** Focuses the first enabled command (controller X / keyboard focus into the command menu). */
  public focusCommands(): void {
    const first = focusablesIn(document.getElementById('action-menu')!)[0];
    if (first) focusVisible(first);
  }

  /** Words the dialogue hint uses for the input the player is using right now. */
  public setInputMode(mode: 'mouse' | 'touch' | 'pen' | 'keyboard' | 'gamepad'): void {
    document.documentElement.dataset.input = mode;
    if (this.dialogueHintEl) {
      const verb = mode === 'touch' || mode === 'pen' ? 'Tap to continue' : mode === 'gamepad' ? 'Press A to continue' : mode === 'keyboard' ? 'Press Enter to continue' : 'Click or press Space to continue';
      this.dialogueHintEl.textContent = `${verb} ▶`;
    }
  }

  public showDialogue(line: DialogueLine, onNext: () => void): void {
    this.dialogueSpeakerEl.textContent = line.speaker;
    this.dialogueTextEl.textContent = line.text;
    const pid = line.portrait || portraitForSpeaker(line.speaker);
    if (pid) {
      const img = document.createElement('img');
      img.src = portraitDataUrl(pid);
      img.alt = '';
      img.width = 64;
      img.height = 64;
      this.dialoguePortraitEl.replaceChildren(img);
      this.dialoguePortraitEl.classList.add('drawn');
    } else {
      this.dialoguePortraitEl.textContent = line.portraitClass;
      this.dialoguePortraitEl.classList.remove('drawn');
    }
    this.dialogueBoxEl.classList.toggle('speaker-right', line.side === 'right');
    this.dialogueBoxEl.classList.remove('hidden');
    this.onDialogueNext = onNext;
  }

  public hideDialogue(): void {
    this.dialogueBoxEl.classList.add('hidden');
    this.onDialogueNext = undefined;
  }

  public showChoiceModal(
    chapterTitle: string,
    introText: string,
    choices: StoryChoice[],
    onSelect: (choice: StoryChoice) => void
  ): void {
    this.choiceChapterTitleEl.textContent = chapterTitle;
    this.choiceIntroTextEl.textContent = introText;
    this.choiceCardsContainerEl.innerHTML = '';

    choices.forEach((choice) => {
      const card = document.createElement('div');
      card.className = 'story-choice-card';
      card.innerHTML = `
        <div class="story-choice-title">▶ ${choice.text}</div>
        <div class="story-choice-reward">Reward: ${choice.rewardText}</div>
      `;
      card.addEventListener('click', () => {
        SoundFX.playTurnChime();
        this.closeModal(this.choiceModalEl);
        onSelect(choice);
      });
      this.choiceCardsContainerEl.appendChild(card);
    });

    this.openModal(this.choiceModalEl);
  }

  /**
   * Shows the shared result modal. `bodyHtml` must be built from trusted, game-generated text.
   * The first button marked primary receives focus so Enter/Space confirms it.
   */
  public showResultModal(opts: {
    title: string;
    subtitle?: string;
    bodyHtml?: string;
    buttons: { label: string; primary?: boolean; onClick: () => void }[];
  }): void {
    this.resultTitleEl.textContent = opts.title;
    this.resultSubtitleEl.textContent = opts.subtitle || '';
    this.resultSubtitleEl.style.display = opts.subtitle ? '' : 'none';
    this.resultBodyEl.innerHTML = opts.bodyHtml || '';
    this.resultActionsEl.innerHTML = '';
    let focusTarget: HTMLButtonElement | null = null;
    for (const b of opts.buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      if (b.primary) btn.className = 'primary';
      btn.addEventListener('click', () => {
        SoundFX.playMenuBlip();
        this.hideResultModal();
        b.onClick();
      });
      this.resultActionsEl.appendChild(btn);
      if (b.primary && !focusTarget) focusTarget = btn;
    }
    this.resultModalEl.classList.remove('hidden');
    document.body.classList.add('result-open'); // the dialogue box sits above modals; hide it while one is up
    (focusTarget || (this.resultActionsEl.firstElementChild as HTMLButtonElement | null))?.focus();
  }

  /** Keeps the battlefield dropdown in sync with the map actually being played. */
  public setMapSelection(mapId: string): void {
    if ([...this.mapSelectEl.options].some((o) => o.value === mapId)) this.mapSelectEl.value = mapId;
  }

  public hideResultModal(): void {
    this.resultModalEl.classList.add('hidden');
    document.body.classList.remove('result-open');
  }

  public get isResultModalOpen(): boolean {
    return !this.resultModalEl.classList.contains('hidden');
  }

  public updateBgmButton(isMuted: boolean): void {
    this.btnToggleBgm.textContent = `Music: ${isMuted ? 'Off' : 'On'}`;
    this.btnToggleBgm.setAttribute('aria-pressed', String(!isMuted));
  }

  public toggleCombatLog(forceOpen?: boolean): void {
    this.isCombatLogOpen = forceOpen !== undefined ? forceOpen : !this.isCombatLogOpen;
    if (this.isCombatLogOpen) {
      this.combatLogDrawerEl.classList.remove('hidden');
      this.btnToggleLog.classList.add('highlight');
      this.combatLogEntriesEl.scrollTop = this.combatLogEntriesEl.scrollHeight;
    } else {
      this.combatLogDrawerEl.classList.add('hidden');
      this.btnToggleLog.classList.remove('highlight');
    }
  }

  public addLogEntry(text: string, type: 'turn' | 'attack' | 'crit' | 'heal' | 'spell' | 'reaction' | 'defeat' | 'system'): void {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = text;
    this.combatLogEntriesEl.appendChild(entry);
    this.combatLogEntriesEl.scrollTop = this.combatLogEntriesEl.scrollHeight;
  }

  public updateTurnTimeline(timeline: Unit[], activeUnit: Unit | null): void {
    this.timelineQueueEl.innerHTML = '';
    timeline.forEach((u, index) => {
      const el = document.createElement('div');
      el.className = `timeline-unit ${u.team} ${index === 0 && activeUnit?.id === u.id ? 'active' : ''} ${u.isBoss ? 'boss' : ''}`;
      el.title = `${u.name}${u.isBoss ? ' (BOSS)' : ''}`;
      el.innerHTML = `
        <span class="unit-tag">${u.name.substring(0, 3).toUpperCase()}</span>
        <span class="ct-mini">${Math.min(100, u.ct)}</span>
      `;
      this.timelineQueueEl.appendChild(el);
    });
  }

  public updateUnitCard(unit: Unit, currentHeight: number): void {
    const job = JOBS[unit.jobId] || JOBS.squire;
    this.unitNameEl.textContent = unit.name;
    this.unitJobEl.textContent = `${job.name} Lv. ${unit.level}`;
    this.drawPortrait(unit);

    this.unitStatusesEl.innerHTML = '';
    if (unit.team === 'player') {
      const exp = document.createElement('span');
      exp.className = 'status-badge status-exp';
      exp.textContent = `EXP ${unit.exp}/${JobSystem.EXP_PER_LEVEL}`;
      this.unitStatusesEl.appendChild(exp);
    }
    if (unit.isBoss) {
      const badge = document.createElement('span');
      badge.className = `status-badge ${unit.isEnraged ? 'status-enraged' : 'status-boss'}`;
      badge.textContent = unit.isEnraged ? 'ENRAGED' : 'BOSS';
      this.unitStatusesEl.appendChild(badge);
    }
    // What an enemy carries (0.31.0)
    const carried = unit.team === 'enemy' ? pouchText(unit.pouch, CONSUMABLES) : '';
    if (carried) {
      const badge = document.createElement('span');
      badge.className = 'status-badge status-pouch';
      badge.textContent = `🎒 ${Object.values(unit.pouch || {}).reduce((a, b) => a + b, 0)}`;
      badge.title = `Carries: ${carried}. It may use them; what it doesn't, you salvage if you win.`;
      this.unitStatusesEl.appendChild(badge);
    }
    unit.statuses.forEach((status) => {
      const badge = document.createElement('span');
      badge.className = `status-badge status-${status.type}`;
      badge.textContent = status.type === 'encore' ? `♪ ${Math.max(0, status.duration - 1)}` // performance: encores left
        : status.type === 'calling' ? '✦ CALLING' // a grand summon on its way (0.24.0)
        : status.duration > 50 ? status.type.substring(0, 4) : `${status.type.substring(0, 4)} ${status.duration}t`;
      if (status.type === 'encore') badge.title = 'Performing: plays again at the start of each turn while this unit holds its ground';
      if (status.type === 'calling') badge.title = 'Calling a grand summon: it lands on the marked tiles at the start of this unit\'s next turn. KO, Sleep or Silence break the call';
      this.unitStatusesEl.appendChild(badge);
    });

    this.unitHpTextEl.textContent = `${unit.currentHp}/${unit.maxHp}`;
    this.unitHpBarEl.style.width = `${Math.max(0, (unit.currentHp / unit.maxHp) * 100)}%`;

    this.unitMpTextEl.textContent = `${unit.currentMp}/${unit.maxMp}`;
    this.unitMpBarEl.style.width = `${Math.max(0, (unit.currentMp / unit.maxMp) * 100)}%`;

    this.unitCtTextEl.textContent = `${unit.ct}/100`;
    this.unitCtBarEl.style.width = `${Math.min(100, (unit.ct / 100) * 100)}%`;

    this.unitMoveValEl.textContent = unit.move.toString();
    this.unitJumpValEl.textContent = unit.jump.toString();
    this.unitSpdValEl.textContent = unit.speed.toString();
    this.unitHtValEl.textContent = `${currentHeight.toFixed(1)}h`;

    // A move can be taken back until the unit acts: the MOVE button turns into UNDO
    const undo = unit.team === 'player' && unit.hasMoved && this.canUndoMove(unit);
    this.btnMove.disabled = !undo && (unit.hasMoved || unit.team !== 'player' || unit.move === 0);
    this.btnMove.classList.toggle('undo', undo);
    this.btnMove.title = undo ? 'Take the move back (1)' : 'Move (1)';
    if (this.btnMove.lastChild) this.btnMove.lastChild.textContent = undo ? 'UNDO' : 'MOVE';
    this.btnAct.disabled = unit.hasActed || unit.team !== 'player';
    this.btnItem.disabled = this.btnAct.disabled;
    this.btnWait.disabled = unit.team !== 'player';
    this.btnAuto.disabled = unit.team !== 'player';
    this.btnStatus.disabled = unit.team !== 'player';
  }

  private drawPortrait(unit: Unit): void {
    const ctx = this.portraitEl.getContext('2d');
    if (!ctx) return;
    // Named heroes get their drawn portrait; everyone else gets their job's (red for foes)
    const job = JOBS[unit.jobId] ? unit.jobId : 'squire';
    const named = unit.team === 'player' ? portraitForSpeaker(unit.name) : undefined;
    const pid = named || (unit.team === 'enemy' ? `foe_${job}` : job);
    this.portraitEl.width = 64;
    this.portraitEl.height = 64;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 64);
    ctx.drawImage(portraitCanvas(pid), 0, 0);
  }


  public updateTileInfo(x: number, z: number, height: number, terrain: string): void {
    this.tileCoordsEl.textContent = `X: ${x}, Z: ${z} | Height: ${height.toFixed(1)}h`;
    this.tileTerrainEl.textContent = `Terrain: ${terrain.toUpperCase()}`;
  }

  /** The ITEM list: every consumable the squad carries, with its count. Using one takes the unit's action. */
  public populateItemSubMenu(): void {
    document.getElementById('sub-menu-title')!.textContent = 'ITEMS';
    this.subMenuItemsEl.innerHTML = '';
    const stock = this.inventory();
    const owned = Object.values(CONSUMABLES).filter((c) => (stock[c.id] || 0) > 0);
    if (owned.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'action-desc';
      empty.style.padding = '8px';
      empty.textContent = 'No items. Buy potions at the market on the world map.';
      this.subMenuItemsEl.appendChild(empty);
      return;
    }
    // Pharmacology (Chemist): a tile more reach, half again the effect
    const boost = this.subMenuFor && JobSystem.itemPotency(this.subMenuFor.unit) > 1 ? 1 : 0;
    for (const c of owned) {
      const btn = document.createElement('button');
      btn.className = 'action-item-btn';
      btn.innerHTML = `
        <div class="action-name-row">
          <span>${c.name}</span>
          <span class="action-mp">×${stock[c.id]}</span>
        </div>
        <div class="action-desc">Rng: ${c.range + boost}${c.aoe ? ` · Area ${c.aoe}` : ''} | ${c.description}${boost ? ' (Pharmacology: +50%)' : ''}</div>
      `;
      btn.addEventListener('click', () => {
        SoundFX.playMenuBlip();
        this.toggleSubMenu(false);
        this.onAbilitySelected?.(consumableAbility(c));
      });
      this.subMenuItemsEl.appendChild(btn);
    }
  }

  public populateActionSubMenu(unit: Unit, terrain?: TerrainType): void {
    this.subMenuFor = { unit, terrain };
    document.getElementById('sub-menu-title')!.textContent = 'ACTIONS';
    this.subMenuItemsEl.innerHTML = '';
    const abilities = JobSystem.getCombatActionAbilities(unit).map((a) => performedBy(unit, resolveTerrainAbility(a, terrain)));

    for (const ability of abilities) {
      const btn = document.createElement('button');
      btn.className = 'action-item-btn';

      const mpText = ability.mpCost > 0 ? `${ability.mpCost} MP` : ability.signature ? 'ONCE' : 'FREE';
      if (ability.signature) btn.classList.add('signature');
      btn.innerHTML = `
        <div class="action-name-row">
          <span>${ability.signature ? '★ ' : ability.charge ? '✦ ' : ''}${ability.name}</span>
          <span class="action-mp">${mpText}</span>
        </div>
        <div class="action-desc">${ability.signature ? `Master · once per battle · ${ability.centered ? `Around you · Area ${ability.aoe}` : `Rng: ${ability.range}${ability.aoe > 0 ? ` · Area ${ability.aoe}` : ''}`}` : ability.centered ? `Around you · Area ${ability.aoe}` : ability.performance ? `${unit.performing === ability.id ? '♪ Playing · ' : ''}Around you · Area ${ability.aoe} · repeats ${encoreTurns(unit)} turns` : `${ability.charge ? 'Lands next turn · ' : ''}Rng: ${ability.range}${ability.aoe > 0 ? ` · Area ${ability.aoe}` : ''}`} | ${ability.description}</div>
      `;

      btn.disabled = unit.currentMp < ability.mpCost;
      btn.addEventListener('click', () => {
        SoundFX.playMenuBlip();
        this.toggleSubMenu(false);
        this.onAbilitySelected?.(ability);
      });

      this.subMenuItemsEl.appendChild(btn);
    }
  }

  public toggleSubMenu(show: boolean): void {
    if (show) {
      this.subMenuEl.classList.remove('hidden');
      this.focusForNav(focusablesIn(this.subMenuItemsEl)[0]);
    } else {
      const hadFocus = this.subMenuEl.contains(document.activeElement);
      this.subMenuEl.classList.add('hidden');
      if (hadFocus) this.focusForNav(this.btnAct.disabled ? focusablesIn(document.getElementById('action-menu')!)[0] : this.btnAct);
    }
  }

  /** Moves focus only when the player is driving the UI with keys or a controller. */
  public focusForNav(el: HTMLElement | null | undefined): void {
    if (!el) return;
    const mode = document.documentElement.dataset.input;
    if (mode === 'keyboard' || mode === 'gamepad') focusVisible(el);
  }

  public showFacingSelector(currentFacing: FacingDirection): void {
    this.selectedFacing = currentFacing;
    const compassButtons = document.querySelectorAll('.compass-btn');
    compassButtons.forEach((b) => {
      const dir = (b as HTMLElement).dataset.facing;
      if (dir === currentFacing) {
        b.classList.add('selected');
      } else {
        b.classList.remove('selected');
      }
    });

    this.facingSelectorEl.classList.remove('hidden');
    this.focusForNav(this.facingSelectorEl.querySelector<HTMLElement>(`.compass-btn[data-facing="${currentFacing}"]`));
  }

  public showCombatForecast(forecast: CombatForecast, extraTargets: number = 0): void {
    this.fcTargetName.textContent = extraTargets > 0 ? `${forecast.target.name} +${extraTargets} more` : forecast.target.name;
    const ab = forecast.ability;
    const facingLabel = this.fcFacingBadge.previousSibling;
    const amountLabel = this.fcDamage.previousSibling;
    if (ab.item) {
      // Items ignore facing, never miss and do a fixed amount: say what the item does instead
      if (facingLabel) facingLabel.textContent = 'Item: ';
      if (amountLabel) amountLabel.textContent = 'EFFECT: ';
      this.fcFacingBadge.textContent = ab.name.toUpperCase();
      this.fcFacingBadge.className = 'badge-front';
      this.fcHitRate.textContent = '100%';
      const potency = JobSystem.itemPotency(forecast.attacker); // Pharmacology
      this.fcDamage.textContent = (ab.fixedHeal || 0) >= 9999 ? 'FULL HP & MP' : ab.revive ? `REVIVE ${Math.round(Math.min(1, ab.revive * potency) * 100)}% HP`
        : ab.fixedDamage ? `-${Math.round(ab.fixedDamage * potency)} HP${ab.appliesStatus ? ` + ${ab.appliesStatus.toUpperCase()}` : ''}`
        : ab.fixedHeal ? `+${Math.round(ab.fixedHeal * potency)} HP`
        : ab.fixedMp ? `+${Math.round(ab.fixedMp * potency)} MP`
        : ab.cleanse ? 'CURE AILMENTS' : '—';
      this.forecastEl.classList.remove('hidden');
      this.focusForNav(this.btnForecastConfirm as HTMLElement);
      return;
    }
    if (facingLabel) facingLabel.textContent = 'Facing: ';
    if (amountLabel) amountLabel.textContent = 'DMG: ';
    const bonus = forecast.facingType === 'back' ? 30 : forecast.facingType === 'flank' ? 15 : 0;
    // Facing means nothing to a revive
    this.fcFacingBadge.textContent = ab.revive ? '—' : `${forecast.facingType.toUpperCase()} (+${bonus}%)`;
    this.fcFacingBadge.className = ab.revive ? 'badge-front' : `badge-${forecast.facingType}`;

    this.fcHitRate.textContent = `${forecast.hitChance}%`;
    const isHeal = forecast.ability.power < 0;
    const dualText = forecast.willDualWield ? ' (×2 Dual)' : '';
    this.fcDamage.textContent = ab.tame ? (forecast.hitChance > 0 ? 'WIN IT OVER' : 'CAN\'T BE TAMED') : ab.revive ? `REVIVE ${Math.round(ab.revive * 100)}% HP` : forecast.expectedDamage === 0
      ? (forecast.ability.appliesStatus ? forecast.ability.appliesStatus.toUpperCase() : '—')
      : `${isHeal ? '+' : '-'}${Math.abs(forecast.expectedDamage)} HP${dualText}`;
    // A grand summon lands next turn (0.24.0): say so, and that it's on whoever stands there then
    if (ab.charge) {
      this.fcDamage.textContent += ab.rebirth ? ' + RAISE' : '';
      this.fcTargetName.textContent += ' · LANDS NEXT TURN';
    }

    this.forecastEl.classList.remove('hidden');
    this.focusForNav(this.btnForecastConfirm as HTMLElement);
  }

  public showBanner(text: string): void {
    this.bannerTextEl.textContent = text;
    this.bannerEl.classList.remove('hidden');
    this.bannerEl.style.animation = 'none';
    void this.bannerEl.offsetHeight;
    this.bannerEl.style.animation = 'bannerFade 2.2s forwards ease-in-out';
  }

  public populateJobCustomizer(units: Unit[], selectedUnitIndex: number = 0): void {
    const unit = units[selectedUnitIndex];
    if (!unit) return;
    queueMicrotask(() => ensureFocusable(this.jobModalEl));

    this.jobUnitTabsEl.innerHTML = '';
    units.forEach((u, i) => {
      const tab = document.createElement('button');
      tab.className = `job-unit-tab ${i === selectedUnitIndex ? 'active' : ''}`;
      tab.textContent = u.name;
      tab.addEventListener('click', () => {
        SoundFX.playMenuBlip();
        this.populateJobCustomizer(units, i);
      });
      this.jobUnitTabsEl.appendChild(tab);
    });

    this.refreshTeam = () => this.populateJobCustomizer(units, selectedUnitIndex);

    // 1. JOBS VIEW: every job with its level; locked ones show what they need
    this.jobListEl.innerHTML = '';
    // A beast (0.28.0) has only its own kind to show
    const beast = !!JOBS[unit.jobId]?.monster;
    for (const [jobId, job] of Object.entries(JOBS).filter(([id, j]) => (beast ? id === unit.jobId : !j.monster))) {
      const missing = JobSystem.missingPrerequisites(unit, jobId);
      const locked = !JobSystem.canChangeJob(unit, jobId);
      const prog = JobSystem.jobLevelProgress(unit, jobId);
      const master = prog.level >= MAX_JOB_LEVEL;
      const mastery = JOB_MASTERY[jobId];
      const tier = JobSystem.masteryTier(unit, jobId);
      const jobItem = document.createElement('div');
      jobItem.className = `job-item ${unit.jobId === jobId ? 'active' : ''} ${locked ? 'locked' : ''}`;
      jobItem.setAttribute('role', 'button');
      jobItem.setAttribute('aria-disabled', String(locked));
      const need = missing.map((m) => `${JOBS[m.jobId].name} Lv ${m.level} (now Lv ${m.have})`).join(' and ');
      jobItem.innerHTML = `
        <div style="font-family: var(--font-pixel); font-size: calc(10px * var(--ts)); color: var(--gold);">${locked ? '🔒 ' : ''}${job.name}
          <span class="job-lv ${master ? 'master' : ''}">${master ? '★ MASTER' : `Lv ${prog.level}`}</span></div>
        <div style="font-size: calc(13px * var(--ts)); color: var(--text-muted);">${job.role} | Move: ${job.baseMove} Jump: ${job.baseJump}</div>
        ${beast ? '' : `<div class="job-gear" title="What this job can use (light gear and accessories: anyone)">⚔ ${jobGearText(jobId)}</div>`}
        ${locked ? `<div class="job-req">Needs ${need}</div>` : ''}
        ${mastery ? `<div class="job-mastery" title="Mastery bonuses stay with the unit in every job"><span class="${tier >= 1 ? 'got' : ''}">${tier >= 1 ? '✓ ' : ''}Lv ${VETERAN_JOB_LEVEL}: ${masteryLabel(mastery.stat, mastery.veteran)}</span> · <span class="${tier >= 2 ? 'got' : ''}">${tier >= 2 ? '✓ ' : ''}Master: ${masteryLabel(mastery.stat, mastery.master)}${SIGNATURES[job.id] ? ` + ★ ${SIGNATURES[job.id].name}` : ''}</span></div>` : ''}
        ${!locked && !master ? `<div class="job-bar" title="${prog.into} / ${prog.need} JP to Lv ${prog.level + 1}"><span style="width:${Math.round((prog.into / prog.need) * 100)}%"></span></div>` : ''}
      `;
      jobItem.addEventListener('click', () => {
        if (locked) {
          this.showBanner(`LOCKED: NEEDS ${need.toUpperCase()}`);
          return;
        }
        SoundFX.playMenuBlip();
        const off = JobSystem.changeJob(unit, jobId);
        // Gear the new job can't use goes back to the armory, and the best owned piece it can use
        // takes its place (0.30.0)
        const on = JobSystem.fillSlots(unit, [...new Set(off.map((it) => it.slot))], this.armory.map((id) => ITEMS[id]).filter(Boolean));
        this.populateJobCustomizer(units, selectedUnitIndex);
        if (off.length) this.showBanner(`TOOK OFF ${off.map((it) => it.name.toUpperCase()).join(', ')}${on.length ? ` · PUT ON ${on.map((it) => it.name.toUpperCase()).join(', ')}` : ''}`);
      });
      this.jobListEl.appendChild(jobItem);
    }

    const slotPrimary = document.getElementById('slot-primary-val')!;
    const slotSecondary = document.getElementById('slot-secondary-val')!;
    const slotReaction = document.getElementById('slot-reaction-val')!;
    const slotSupport = document.getElementById('slot-support-val')!;
    const slotMovement = document.getElementById('slot-movement-val')!;

    const currentJob = JOBS[unit.jobId];
    slotPrimary.textContent = `${currentJob.name} Skillset`;
    slotSecondary.textContent = unit.equippedAbilities.secondaryJobId
      ? `${JOBS[unit.equippedAbilities.secondaryJobId]?.name || 'None'} Skillset`
      : 'None (Click to cycle)';
    if (slotSecondary.parentElement) slotSecondary.parentElement.title = 'Cycles through other jobs where this unit has learned an action';
    const nameOf = (id: string | null) => (id ? JobSystem.findAbility(id)?.name || id : 'None');
    slotReaction.textContent = nameOf(unit.equippedAbilities.reaction);
    slotSupport.textContent = nameOf(unit.equippedAbilities.support);
    slotMovement.textContent = nameOf(unit.equippedAbilities.movement);

    // Click a passive slot to cycle through every reaction/support/movement this unit has learned
    const bindCycle = (el: HTMLElement, type: 'reaction' | 'support' | 'movement') => {
      const box = el.parentElement;
      if (!box) return;
      const learned = JobSystem.getLearnedPassives(unit, type);
      box.classList.toggle('cyclable', learned.length > 0);
      box.title = learned.length > 0 ? 'Click to cycle learned abilities' : 'Learn one in the list to the right';
      box.onclick = () => {
        if (learned.length === 0) return;
        SoundFX.playMenuBlip();
        const ids: (string | null)[] = [...learned.map((l) => l.id), null];
        const cur = ids.indexOf(unit.equippedAbilities[type]);
        unit.equippedAbilities[type] = ids[(cur + 1) % ids.length];
        JobSystem.recalculateDerivedStats(unit);
        this.populateJobCustomizer(units, selectedUnitIndex);
      };
    };
    bindCycle(slotReaction, 'reaction');
    bindCycle(slotSupport, 'support');
    bindCycle(slotMovement, 'movement');

    if (slotSecondary.parentElement) {
      slotSecondary.parentElement.onclick = () => {
        SoundFX.playMenuBlip();
        // Only skillsets with something to offer: unlocked jobs where the unit has learned an action
        const availableJobIds = PLAYER_JOB_IDS.filter(
          (id) => id !== unit.jobId && JobSystem.canChangeJob(unit, id) && JOBS[id].abilities.some((a) => a.type === 'action' && unit.unlockedAbilities[a.id])
        );
        const curIdx = unit.equippedAbilities.secondaryJobId
          ? availableJobIds.indexOf(unit.equippedAbilities.secondaryJobId)
          : -1;
        const nextIdx = (curIdx + 1) % (availableJobIds.length + 1);
        const nextJobId = nextIdx === availableJobIds.length ? null : availableJobIds[nextIdx];
        JobSystem.setSecondarySkillset(unit, nextJobId);
        this.populateJobCustomizer(units, selectedUnitIndex);
      };
    }

    const currentJp = unit.jobPoints[unit.jobId] || 0;
    this.currentUnitJpEl.textContent = currentJp.toString();
    this.renderShop();
    this.learnAbilityListEl.innerHTML = '';

    for (const ability of currentJob.abilities) {
      const isLearned = unit.unlockedAbilities[ability.id];
      const canAfford = currentJp >= ability.jpCost;

      const item = document.createElement('div');
      item.className = 'learn-item';
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-family: var(--font-pixel); font-size: calc(9px * var(--ts));">
          <span>${ability.name} (${ability.type.toUpperCase()})</span>
          <span style="color: ${isLearned ? 'var(--hp-green)' : canAfford ? 'var(--gold)' : 'var(--text-muted)'};">
            ${isLearned ? 'MASTERED' : `${ability.jpCost} JP`}
          </span>
        </div>
        <div style="font-size: calc(13px * var(--ts)); color: var(--text-muted);">${ability.description}</div>
      `;

      if (!isLearned && canAfford) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
          SoundFX.playTurnChime();
          JobSystem.learnAbility(unit, ability.id, unit.jobId);
          if (ability.type === 'reaction') unit.equippedAbilities.reaction = ability.id;
          if (ability.type === 'support') unit.equippedAbilities.support = ability.id;
          if (ability.type === 'movement') {
            unit.equippedAbilities.movement = ability.id;
            JobSystem.recalculateDerivedStats(unit);
          }
          this.populateJobCustomizer(units, selectedUnitIndex);
        });
      }

      this.learnAbilityListEl.appendChild(item);
    }

    // 2. EQUIPMENT VIEW
    const gearWeaponVal = document.getElementById('gear-weapon-val')!;
    const gearShieldVal = document.getElementById('gear-shield-val')!;
    const gearHeadVal = document.getElementById('gear-head-val')!;
    const gearBodyVal = document.getElementById('gear-body-val')!;
    const gearAccessoryVal = document.getElementById('gear-accessory-val')!;

    // A beast fills only its barding and collar slots (0.29.0)
    const noSlot = beast ? '— (beasts don\'t)' : 'None';
    const rules = JOB_GEAR[unit.jobId];
    if (beast && !BEAST_SLOTS.includes(this.selectedGearSlot)) this.selectedGearSlot = 'body';
    gearWeaponVal.textContent = unit.equipment.weapon ? unit.equipment.weapon.name : noSlot;
    gearShieldVal.textContent = unit.equipment.shield ? unit.equipment.shield.name : !beast && rules && !rules.shield ? `— (no shields for a ${JOBS[unit.jobId].name})` : noSlot;
    gearHeadVal.textContent = unit.equipment.head ? unit.equipment.head.name : noSlot;
    gearBodyVal.textContent = unit.equipment.body ? unit.equipment.body.name : 'None';
    gearAccessoryVal.textContent = unit.equipment.accessory ? unit.equipment.accessory.name : 'None';

    const gearSlots = document.querySelectorAll('.gear-slot-box');
    gearSlots.forEach((slotEl) => {
      slotEl.classList.remove('selected');
      const slotType = (slotEl as HTMLElement).dataset.gearslot as EquipmentSlot;
      if (slotType === this.selectedGearSlot) {
        slotEl.classList.add('selected');
      }

      (slotEl as HTMLElement).onclick = () => {
        SoundFX.playMenuBlip();
        this.selectedGearSlot = slotType;
        this.populateJobCustomizer(units, selectedUnitIndex);
      };
    });

    // Populate inventory for selected slot
    this.inventoryHeaderEl.textContent = `AVAILABLE ${this.selectedGearSlot.toUpperCase()} INVENTORY`;
    this.inventoryListEl.innerHTML = '';
    if (beast) {
      this.inventoryHeaderEl.textContent = `BEAST GEAR · ${this.selectedGearSlot === 'body' ? 'BARDING' : 'COLLARS & CHARMS'}`;
      const note = document.createElement('div');
      note.className = 'learn-item';
      note.innerHTML = `<div style="font-size: calc(13px * var(--ts)); color: var(--text-muted);">${unit.name} wears only beast gear: barding on its body and a collar or charm. Its fangs, hide or glow do the rest. Buy beast gear at the market.</div>`;
      this.inventoryListEl.appendChild(note);
    }

    const owned = getItemsForSlot(this.selectedGearSlot, this.armory.length > 0 ? this.armory : undefined);
    const availableItems = owned.filter((it) => JobSystem.canEquip(unit, it));
    // People see what their job can't use, greyed, with who can (0.30.0); beasts don't need the list
    const lockedItems = beast ? [] : owned.filter((it) => !it.beast && !JobSystem.canEquip(unit, it));

    // Unequip option
    const unequipBtn = document.createElement('div');
    unequipBtn.className = 'learn-item';
    unequipBtn.innerHTML = `
      <div style="font-family: var(--font-pixel); font-size: calc(9px * var(--ts)); color: var(--text-muted);">(Unequip / Empty Slot)</div>
    `;
    unequipBtn.onclick = () => {
      SoundFX.playMenuBlip();
      JobSystem.unequipItem(unit, this.selectedGearSlot);
      this.populateJobCustomizer(units, selectedUnitIndex);
    };
    this.inventoryListEl.appendChild(unequipBtn);

    for (const item of availableItems) {
      const isEquipped = unit.equipment[this.selectedGearSlot]?.id === item.id;
      const el = document.createElement('div');
      el.className = `learn-item ${isEquipped ? 'active' : ''}`;

      const statsDesc = Object.entries(item.stats)
        .map(([stat, val]) => `${stat.toUpperCase()} ${val! >= 0 ? '+' : ''}${val}`)
        .join(', ');

      el.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-family: var(--font-pixel); font-size: calc(9px * var(--ts));">
          <span>${item.name}</span>
          <span style="color: ${isEquipped ? 'var(--gold)' : 'var(--hp-green)'};">${isEquipped ? 'EQUIPPED' : statsDesc}</span>
        </div>
        <div style="font-size: calc(13px * var(--ts)); color: var(--text-muted);">${item.description}</div>
      `;

      el.onclick = () => {
        SoundFX.playTurnChime();
        JobSystem.equipItem(unit, item);
        this.populateJobCustomizer(units, selectedUnitIndex);
      };

      this.inventoryListEl.appendChild(el);
    }

    if (lockedItems.length) {
      const head = document.createElement('div');
      head.className = 'shop-slot-head';
      head.textContent = `NOT FOR A ${JOBS[unit.jobId].name.toUpperCase()}`;
      this.inventoryListEl.appendChild(head);
    }
    for (const item of lockedItems) {
      const el = document.createElement('div');
      el.className = 'learn-item locked-gear';
      el.setAttribute('aria-disabled', 'true');
      el.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-family: var(--font-pixel); font-size: calc(9px * var(--ts));">
          <span>🔒 ${item.name}</span>
          <span>${itemStatText(item)}</span>
        </div>
        <div style="font-size: calc(13px * var(--ts)); color: var(--text-muted);">For: ${(whoCanUse(item) || []).join(', ')}</div>
      `;
      el.onclick = () => this.showBanner(`${JOBS[unit.jobId].name.toUpperCase()}S CAN'T USE ${gearKindName(item).toUpperCase()}`);
      this.inventoryListEl.appendChild(el);
    }
  }

  /** The Shop tab: buy supplies and gear, or sell them back for half. Trading needs the party at the market. */
  private renderShop(): void {
    const shop = this.shop;
    if (!shop) return;
    const gil = shop.gil();
    const open = shop.open();
    const stock = this.inventory();
    this.gilBadgeEl.textContent = `${gil.toLocaleString('en-US')} G`;
    this.shopNoteEl.textContent = open
      ? this.shopMode === 'buy'
        ? 'Gear, once bought, outfits everyone whose job can use it. Supplies are used up in battle with the ITEM command.' + (shop.nextCap() ? ' More stock arrives after the next chapter.' : '')
        : 'The market pays half price. Gear someone is wearing has to come off first.'
      : 'The market is on the world map. Travel there between battles to buy and sell. You can browse the shelves from here.';
    this.shopListEl.innerHTML = '';

    const modes = document.createElement('div');
    modes.className = 'shop-modes';
    for (const m of ['buy', 'sell'] as const) {
      const b = document.createElement('button');
      b.className = `shop-mode ${this.shopMode === m ? 'active' : ''}`;
      b.textContent = m.toUpperCase();
      b.setAttribute('aria-pressed', String(this.shopMode === m));
      b.addEventListener('click', () => {
        if (this.shopMode === m) return;
        SoundFX.playMenuBlip();
        this.shopMode = m;
        this.renderShop();
        queueMicrotask(() => this.focusForNav(this.shopListEl.querySelector<HTMLElement>('.shop-mode.active')));
      });
      modes.appendChild(b);
    }
    this.shopListEl.appendChild(modes);

    const head = (text: string) => {
      const h = document.createElement('div');
      h.className = 'shop-slot-head';
      h.textContent = text;
      this.shopListEl.appendChild(h);
    };
    /** One shelf row. `act` returns true when the trade went through. */
    const row = (o: { key: string; name: string; stats: string; desc: string; label: string; enabled: boolean; dim?: boolean; why?: string; act: () => boolean; done: string }) => {
      const el = document.createElement('div');
      el.className = `learn-item shop-item ${o.dim ? 'owned' : ''}`;
      el.dataset.item = o.key;
      el.innerHTML = `
        <div><span class="shop-name">${o.name}</span> <span class="shop-stats">${o.stats}</span></div>
        <button class="shop-buy" tabindex="-1" ${o.enabled ? '' : 'disabled'} aria-label="${o.name}: ${o.label}">${o.label}</button>
        <div class="shop-desc">${o.desc}</div>
      `;
      // The whole row trades (the button's click bubbles here), so keys and controllers can use the row
      el.addEventListener('click', () => {
        if (!o.enabled || !o.act()) {
          if (o.why) this.showBanner(o.why.toUpperCase());
          return;
        }
        SoundFX.playTurnChime();
        const keep = this.shopListEl.scrollTop;
        this.refreshTeam();
        this.shopListEl.scrollTop = keep;
        this.showBanner(o.done.toUpperCase());
        // The list was redrawn: put keyboard / controller focus back on the same row (or the top if it's gone)
        queueMicrotask(() => this.focusForNav(this.shopListEl.querySelector<HTMLElement>(`[data-item="${o.key}"]`) || this.shopListEl.querySelector<HTMLElement>('.shop-mode.active')));
      });
      this.shopListEl.appendChild(el);
    };
    const statText = itemStatText;
    const closed = 'The market is on the world map';
    const slotNames: Record<EquipmentSlot, string> = { weapon: 'WEAPONS', shield: 'SHIELDS', head: 'HEADGEAR', body: 'ARMOR & ROBES', accessory: 'ACCESSORIES' };

    if (this.shopMode === 'buy') {
      head('SUPPLIES');
      for (const c of shop.supplies()) {
        const have = stock[c.id] || 0;
        const full = have >= MAX_STACK;
        row({
          key: `s:${c.id}`, name: c.name, stats: `Have ${have}`, desc: c.description,
          label: full ? 'FULL' : `${c.price} G`, enabled: open && !full && gil >= c.price, dim: full,
          why: !open ? closed : full ? `You can carry ${MAX_STACK}` : 'Not enough gil',
          act: () => shop.buySupply(c.id), done: `Bought ${c.name}`
        });
      }
      let lastSlot = '';
      for (const item of shop.stock()) {
        const shelf = item.beast ? 'beast' : item.slot;
        if (shelf !== lastSlot) head(item.beast ? 'BEAST GEAR (TAMED BEASTS ONLY)' : slotNames[item.slot]);
        lastSlot = shelf;
        const owned = this.armory.includes(item.id);
        const who = whoCanUse(item);
        row({
          key: `g:${item.id}`, name: item.name, stats: statText(item), desc: who && !item.beast ? `${item.description} <span class="gear-who">For: ${who.join(', ')}</span>` : item.description,
          label: owned ? 'OWNED' : `${item.price} G`, enabled: open && !owned && gil >= item.price, dim: owned,
          why: owned ? '' : !open ? closed : 'Not enough gil',
          act: () => shop.buy(item.id), done: `Bought ${item.name}`
        });
      }
      return;
    }

    const supplies = Object.values(CONSUMABLES).filter((c) => (stock[c.id] || 0) > 0);
    head('SUPPLIES');
    if (supplies.length === 0) head('— none to sell —');
    for (const c of supplies) {
      const pay = Math.round(c.price / 2);
      row({
        key: `s:${c.id}`, name: c.name, stats: `Have ${stock[c.id]}`, desc: c.description,
        label: `+${pay} G`, enabled: open, why: closed,
        act: () => shop.sellSupply(c.id), done: `Sold ${c.name} for ${pay} gil`
      });
    }
    head('GEAR');
    const order: EquipmentSlot[] = ['weapon', 'shield', 'head', 'body', 'accessory'];
    const gear = this.armory.map((id) => ITEMS[id]).filter(Boolean).sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot) || a.price - b.price);
    for (const item of gear) {
      const block = shop.saleBlock(item.id);
      const pay = Math.round(item.price / 2);
      row({
        key: `g:${item.id}`, name: item.name, stats: statText(item), desc: block ? `${block}. ${item.description}` : item.description,
        label: block ? (block === 'Relic' ? 'RELIC' : 'IN USE') : `+${pay} G`, enabled: open && !block, dim: !!block,
        why: block ? (block === 'Relic' ? 'Relics are never sold' : block) : closed,
        act: () => shop.sellGear(item.id), done: `Sold ${item.name} for ${pay} gil`
      });
    }
  }
}
