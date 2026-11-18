import { Unit, Ability, CombatForecast, FacingDirection } from '../core/types';
import { JOBS } from '../data/jobs';
import { JobSystem } from '../core/JobSystem';

export class UIManager {
  // Elements
  private timelineQueueEl = document.getElementById('timeline-queue')!;
  private unitNameEl = document.getElementById('unit-name')!;
  private unitJobEl = document.getElementById('unit-job')!;
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

  // Menus
  private btnMove = document.getElementById('btn-action-move') as HTMLButtonElement;
  private btnAct = document.getElementById('btn-action-act') as HTMLButtonElement;
  private btnWait = document.getElementById('btn-action-wait') as HTMLButtonElement;
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

  // Job Modal
  private jobModalEl = document.getElementById('job-modal')!;
  private btnOpenJobModal = document.getElementById('btn-job-menu')!;
  private btnCloseJobModal = document.getElementById('btn-close-job-modal')!;
  private jobUnitTabsEl = document.getElementById('job-unit-tabs')!;
  private jobListEl = document.getElementById('job-list')!;
  private currentUnitJpEl = document.getElementById('current-unit-jp')!;
  private learnAbilityListEl = document.getElementById('learn-ability-list')!;

  // Banner
  private bannerEl = document.getElementById('battle-banner')!;
  private bannerTextEl = document.getElementById('banner-text')!;

  // Callbacks
  public onMoveClicked?: () => void;
  public onAbilitySelected?: (ability: Ability) => void;
  public onWaitClicked?: () => void;
  public onFacingConfirmed?: (facing: FacingDirection) => void;
  public onExecuteAttack?: () => void;
  public onCancelAttack?: () => void;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    this.btnMove.addEventListener('click', () => {
      this.onMoveClicked?.();
    });

    this.btnAct.addEventListener('click', () => {
      this.toggleSubMenu(true);
    });

    this.btnWait.addEventListener('click', () => {
      this.onWaitClicked?.();
    });

    this.btnSubMenuBack.addEventListener('click', () => {
      this.toggleSubMenu(false);
    });

    // Compass Facing Buttons
    const compassButtons = document.querySelectorAll('.compass-btn');
    compassButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        compassButtons.forEach((b) => b.classList.remove('selected'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('selected');
        this.selectedFacing = target.dataset.facing as FacingDirection;
      });
    });

    document.getElementById('btn-face-confirm')?.addEventListener('click', () => {
      this.facingSelectorEl.classList.add('hidden');
      this.onFacingConfirmed?.(this.selectedFacing);
    });

    // Forecast Buttons
    this.btnForecastConfirm.addEventListener('click', () => {
      this.forecastEl.classList.add('hidden');
      this.onExecuteAttack?.();
    });

    this.btnForecastCancel.addEventListener('click', () => {
      this.forecastEl.classList.add('hidden');
      this.onCancelAttack?.();
    });

    // Job Modal Buttons
    this.btnOpenJobModal.addEventListener('click', () => {
      this.jobModalEl.classList.remove('hidden');
    });

    this.btnCloseJobModal.addEventListener('click', () => {
      this.jobModalEl.classList.add('hidden');
    });
  }

  public updateTurnTimeline(timeline: Unit[], activeUnit: Unit | null): void {
    this.timelineQueueEl.innerHTML = '';
    timeline.forEach((u, index) => {
      const el = document.createElement('div');
      el.className = `timeline-unit ${u.team} ${index === 0 && activeUnit?.id === u.id ? 'active' : ''}`;
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

    // Update Action Menu states
    this.btnMove.disabled = unit.hasMoved || unit.team !== 'player';
    this.btnAct.disabled = unit.hasActed || unit.team !== 'player';
    this.btnWait.disabled = unit.team !== 'player';
  }

  public updateTileInfo(x: number, z: number, height: number, terrain: string): void {
    this.tileCoordsEl.textContent = `X: ${x}, Z: ${z} | Height: ${height.toFixed(1)}h`;
    this.tileTerrainEl.textContent = `Terrain: ${terrain.toUpperCase()}`;
  }

  public populateActionSubMenu(unit: Unit): void {
    this.subMenuItemsEl.innerHTML = '';
    const abilities = JobSystem.getCombatActionAbilities(unit);

    for (const ability of abilities) {
      const btn = document.createElement('button');
      btn.className = 'action-item-btn';

      const mpText = ability.mpCost > 0 ? `${ability.mpCost} MP` : 'FREE';
      btn.innerHTML = `
        <div class="action-name-row">
          <span>${ability.name}</span>
          <span class="action-mp">${mpText}</span>
        </div>
        <div class="action-desc">Rng: ${ability.range}h | ${ability.description}</div>
      `;

      btn.disabled = unit.currentMp < ability.mpCost;
      btn.addEventListener('click', () => {
        this.toggleSubMenu(false);
        this.onAbilitySelected?.(ability);
      });

      this.subMenuItemsEl.appendChild(btn);
    }
  }

  public toggleSubMenu(show: boolean): void {
    if (show) {
      this.subMenuEl.classList.remove('hidden');
    } else {
      this.subMenuEl.classList.add('hidden');
    }
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
  }

  public showCombatForecast(forecast: CombatForecast): void {
    this.fcTargetName.textContent = forecast.target.name;
    this.fcFacingBadge.textContent = `${forecast.facingType.toUpperCase()} (+${forecast.facingType === 'back' ? 30 : forecast.facingType === 'flank' ? 15 : 0}%)`;
    this.fcFacingBadge.className = `badge-${forecast.facingType}`;

    this.fcHitRate.textContent = `${forecast.hitChance}%`;
    const isHeal = forecast.ability.power < 0;
    this.fcDamage.textContent = `${isHeal ? '+' : '-'}${Math.abs(forecast.expectedDamage)} HP`;

    this.forecastEl.classList.remove('hidden');
  }

  public showBanner(text: string): void {
    this.bannerTextEl.textContent = text;
    this.bannerEl.classList.remove('hidden');
    // Trigger animation replay
    this.bannerEl.style.animation = 'none';
    void this.bannerEl.offsetHeight; // trigger reflow
    this.bannerEl.style.animation = 'bannerFade 2.2s forwards ease-in-out';
  }

  public populateJobCustomizer(units: Unit[], selectedUnitIndex: number = 0): void {
    const unit = units[selectedUnitIndex];
    if (!unit) return;

    // Unit tabs
    this.jobUnitTabsEl.innerHTML = '';
    units.forEach((u, i) => {
      const tab = document.createElement('button');
      tab.className = `job-unit-tab ${i === selectedUnitIndex ? 'active' : ''}`;
      tab.textContent = u.name;
      tab.addEventListener('click', () => {
        this.populateJobCustomizer(units, i);
      });
      this.jobUnitTabsEl.appendChild(tab);
    });

    // Jobs list
    this.jobListEl.innerHTML = '';
    for (const [jobId, job] of Object.entries(JOBS)) {
      const jobItem = document.createElement('div');
      jobItem.className = `job-item ${unit.jobId === jobId ? 'active' : ''}`;
      jobItem.innerHTML = `
        <div style="font-family: var(--font-pixel); font-size: 10px; color: var(--gold);">${job.name}</div>
        <div style="font-size: 13px; color: var(--text-muted);">${job.role} | Move: ${job.baseMove} Jump: ${job.baseJump}</div>
      `;
      jobItem.addEventListener('click', () => {
        JobSystem.changeJob(unit, jobId);
        this.populateJobCustomizer(units, selectedUnitIndex);
      });
      this.jobListEl.appendChild(jobItem);
    }

    // 5 Slots
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
    slotReaction.textContent = unit.equippedAbilities.reaction || 'None';
    slotSupport.textContent = unit.equippedAbilities.support || 'None';
    slotMovement.textContent = unit.equippedAbilities.movement || 'None';

    // Cycle secondary skillset on click
    if (slotSecondary.parentElement) {
      slotSecondary.parentElement.onclick = () => {
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

    // Learn abilities with JP
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
          JobSystem.learnAbility(unit, ability.id, unit.jobId);
          // If reaction/support/movement, auto-equip for immediate fun
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
  }
}
