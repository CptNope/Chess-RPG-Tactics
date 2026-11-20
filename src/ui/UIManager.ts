import { Unit, Ability, CombatForecast, FacingDirection, DialogueLine, TerrainType, EquipmentSlot, StoryChoice } from '../core/types';
import { JOBS } from '../data/jobs';
import { JobSystem } from '../core/JobSystem';
import { getItemsForSlot } from '../data/items';
import { resolveTerrainAbility } from '../core/Geomancy';
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

  // Banner
  private bannerEl = document.getElementById('battle-banner')!;
  private bannerTextEl = document.getElementById('banner-text')!;

  // Callbacks
  public onMoveClicked?: () => void;
  public onAbilitySelected?: (ability: Ability) => void;
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
      const modal = [...document.querySelectorAll<HTMLElement>('.modal-overlay')].find((m) => !m.classList.contains('hidden'));
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
    this.btnTabJobs.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.btnTabJobs.classList.add('active');
      this.btnTabEquip.classList.remove('active');
      this.tabContentJobs.classList.remove('hidden');
      this.tabContentEquip.classList.add('hidden');
    });

    this.btnTabEquip.addEventListener('click', () => {
      SoundFX.playMenuBlip();
      this.btnTabEquip.classList.add('active');
      this.btnTabJobs.classList.remove('active');
      this.tabContentEquip.classList.remove('hidden');
      this.tabContentJobs.classList.add('hidden');
    });

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
      if (this.isSystemMenuOpen && !this.systemMenuEl.contains(t) && !this.btnMenu.contains(t)) this.toggleSystemMenu(false);
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
    const order = ['result-modal', 'choice-modal', 'help-modal', 'job-modal', 'system-menu', 'facing-selector', 'combat-forecast', 'sub-menu'];
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
    (focusTarget || (this.resultActionsEl.firstElementChild as HTMLButtonElement | null))?.focus();
  }

  /** Keeps the battlefield dropdown in sync with the map actually being played. */
  public setMapSelection(mapId: string): void {
    if ([...this.mapSelectEl.options].some((o) => o.value === mapId)) this.mapSelectEl.value = mapId;
  }

  public hideResultModal(): void {
    this.resultModalEl.classList.add('hidden');
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
    unit.statuses.forEach((status) => {
      const badge = document.createElement('span');
      badge.className = `status-badge status-${status.type}`;
      badge.textContent = status.duration > 50 ? status.type.substring(0, 4) : `${status.type.substring(0, 4)} ${status.duration}t`;
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

    this.btnMove.disabled = unit.hasMoved || unit.team !== 'player' || unit.move === 0;
    this.btnAct.disabled = unit.hasActed || unit.team !== 'player';
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

  public populateActionSubMenu(unit: Unit, terrain?: TerrainType): void {
    this.subMenuItemsEl.innerHTML = '';
    const abilities = JobSystem.getCombatActionAbilities(unit).map((a) => resolveTerrainAbility(a, terrain));

    for (const ability of abilities) {
      const btn = document.createElement('button');
      btn.className = 'action-item-btn';

      const mpText = ability.mpCost > 0 ? `${ability.mpCost} MP` : 'FREE';
      btn.innerHTML = `
        <div class="action-name-row">
          <span>${ability.name}</span>
          <span class="action-mp">${mpText}</span>
        </div>
        <div class="action-desc">Rng: ${ability.range}${ability.aoe > 0 ? ` · Area ${ability.aoe}` : ''} | ${ability.description}</div>
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
    const bonus = forecast.facingType === 'back' ? 30 : forecast.facingType === 'flank' ? 15 : 0;
    this.fcFacingBadge.textContent = `${forecast.facingType.toUpperCase()} (+${bonus}%)`;
    this.fcFacingBadge.className = `badge-${forecast.facingType}`;

    this.fcHitRate.textContent = `${forecast.hitChance}%`;
    const isHeal = forecast.ability.power < 0;
    const dualText = forecast.willDualWield ? ' (×2 Dual)' : '';
    this.fcDamage.textContent = forecast.expectedDamage === 0
      ? (forecast.ability.appliesStatus ? forecast.ability.appliesStatus.toUpperCase() : '—')
      : `${isHeal ? '+' : '-'}${Math.abs(forecast.expectedDamage)} HP${dualText}`;

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

    // 1. JOBS VIEW
    this.jobListEl.innerHTML = '';
    for (const [jobId, job] of Object.entries(JOBS)) {
      const jobItem = document.createElement('div');
      jobItem.className = `job-item ${unit.jobId === jobId ? 'active' : ''}`;
      jobItem.innerHTML = `
        <div style="font-family: var(--font-pixel); font-size: 10px; color: var(--gold);">${job.name}</div>
        <div style="font-size: 13px; color: var(--text-muted);">${job.role} | Move: ${job.baseMove} Jump: ${job.baseJump}</div>
      `;
      jobItem.addEventListener('click', () => {
        SoundFX.playMenuBlip();
        JobSystem.changeJob(unit, jobId);
        this.populateJobCustomizer(units, selectedUnitIndex);
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
        const availableJobIds = Object.keys(JOBS);
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
    this.learnAbilityListEl.innerHTML = '';

    for (const ability of currentJob.abilities) {
      const isLearned = unit.unlockedAbilities[ability.id];
      const canAfford = currentJp >= ability.jpCost;

      const item = document.createElement('div');
      item.className = 'learn-item';
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-family: var(--font-pixel); font-size: 9px;">
          <span>${ability.name} (${ability.type.toUpperCase()})</span>
          <span style="color: ${isLearned ? 'var(--hp-green)' : canAfford ? 'var(--gold)' : 'var(--text-muted)'};">
            ${isLearned ? 'MASTERED' : `${ability.jpCost} JP`}
          </span>
        </div>
        <div style="font-size: 13px; color: var(--text-muted);">${ability.description}</div>
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

    gearWeaponVal.textContent = unit.equipment.weapon ? unit.equipment.weapon.name : 'None';
    gearShieldVal.textContent = unit.equipment.shield ? unit.equipment.shield.name : 'None';
    gearHeadVal.textContent = unit.equipment.head ? unit.equipment.head.name : 'None';
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

    const availableItems = getItemsForSlot(this.selectedGearSlot, this.armory.length > 0 ? this.armory : undefined);

    // Unequip option
    const unequipBtn = document.createElement('div');
    unequipBtn.className = 'learn-item';
    unequipBtn.innerHTML = `
      <div style="font-family: var(--font-pixel); font-size: 9px; color: var(--text-muted);">(Unequip / Empty Slot)</div>
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
        .map(([stat, val]) => `${stat.toUpperCase()} +${val}`)
        .join(', ');

      el.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-family: var(--font-pixel); font-size: 9px;">
          <span>${item.name}</span>
          <span style="color: ${isEquipped ? 'var(--gold)' : 'var(--hp-green)'};">${isEquipped ? 'EQUIPPED' : statsDesc}</span>
        </div>
        <div style="font-size: 13px; color: var(--text-muted);">${item.description}</div>
      `;

      el.onclick = () => {
        SoundFX.playTurnChime();
        JobSystem.equipItem(unit, item);
        this.populateJobCustomizer(units, selectedUnitIndex);
      };

      this.inventoryListEl.appendChild(el);
    }
  }
}
