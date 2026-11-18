import * as THREE from 'three';
import { MAPS } from './data/maps';
import { BattleGrid } from './core/Grid';
import { TacticsScene } from './renderer/TacticsScene';
import { UIManager } from './ui/UIManager';
import { TurnManager } from './core/TurnManager';
import { JobSystem } from './core/JobSystem';
import { CombatEngine } from './core/CombatEngine';
import { Unit, Ability, CombatForecast, FacingDirection, DialogueLine, CampaignChapter } from './core/types';
import { CAMPAIGN_CHAPTERS } from './data/campaign';
import { SoundFX } from './audio/SoundEffects';

class TacticsGame {
  private grid!: BattleGrid;
  private scene!: TacticsScene;
  private ui!: UIManager;
  private turnManager!: TurnManager;
  private units: Unit[] = [];

  // Interaction & Editor State
  private currentMode: 'idle' | 'moving' | 'targeting' | 'facing' | 'dialogue' | 'editor' = 'dialogue';
  private selectedAbility: Ability | null = null;
  private currentForecast: CombatForecast | null = null;

  // Campaign State
  private currentChapter: CampaignChapter = CAMPAIGN_CHAPTERS.chapter_1;
  private dialogueQueue: DialogueLine[] = [];
  private dialogueIndex: number = 0;
  private onDialogueFinished?: () => void;

  constructor() {
    // 1. Initialize UI Manager
    this.ui = new UIManager();

    // 2. Load Initial Campaign Chapter
    this.loadChapter('chapter_1', false);

    // 3. Initialize Three.js Scene
    const canvas = document.getElementById('viewport-canvas') as HTMLCanvasElement;
    this.scene = new TacticsScene(canvas, this.grid);
    this.scene.updateUnits(this.units);
    this.applyAtmosphereForMap(this.currentChapter.mapId);

    // 4. Bind Events & Start Story
    this.bindEvents();
    this.playChapterIntro();
    this.gameLoop();
  }

  private applyAtmosphereForMap(mapId: string): void {
    if (mapId === 'night_fortress') {
      this.scene.vfx.setWeatherTheme('night');
    } else if (mapId === 'gloomy_swamp') {
      this.scene.vfx.setWeatherTheme('swamp');
    } else {
      this.scene.vfx.setWeatherTheme('day');
    }
  }

  private loadChapter(chapterId: string, refreshScene: boolean = true): void {
    const chapter = CAMPAIGN_CHAPTERS[chapterId] || CAMPAIGN_CHAPTERS.chapter_1;
    this.currentChapter = chapter;

    const mapGen = MAPS[chapter.mapId] || MAPS.river_ruins;
    const mapData = mapGen();
    this.grid = new BattleGrid(mapData);

    this.initSquadsForChapter(chapter);
    this.turnManager = new TurnManager(this.units);

    if (refreshScene && this.scene) {
      this.scene.loadMap(this.grid);
      this.scene.updateUnits(this.units);
      this.applyAtmosphereForMap(chapter.mapId);
      this.playChapterIntro();
    }
  }

  private initSquadsForChapter(chapter: CampaignChapter): void {
    // Retain or create player squad
    const playerSquad = [
      JobSystem.createUnit('p1', 'Ramza', 'player', 'squire', 3, 8, 'N', 3),
      JobSystem.createUnit('p2', 'Agrias', 'player', 'knight', 4, 8, 'N', 3),
      JobSystem.createUnit('p3', 'Mustadio', 'player', 'archer', 5, 9, 'N', 3),
      JobSystem.createUnit('p4', 'Kain', 'player', 'dragoon', 2, 7, 'N', 3)
    ];

    JobSystem.setSecondarySkillset(playerSquad[0], 'knight');
    playerSquad[0].unlockedAbilities['kn_rend_armor'] = true;
    playerSquad[0].unlockedAbilities['sq_move_plus'] = true;
    playerSquad[0].equippedAbilities.movement = 'sq_move_plus';
    JobSystem.recalculateDerivedStats(playerSquad[0]);

    playerSquad[3].unlockedAbilities['dr_jump'] = true;
    playerSquad[3].unlockedAbilities['dr_ignore_height'] = true;
    playerSquad[3].equippedAbilities.movement = 'dr_ignore_height';
    JobSystem.recalculateDerivedStats(playerSquad[3]);

    // Build enemy squad from chapter definition
    const enemySquad: Unit[] = [];
    chapter.enemyRoster.forEach((e, idx) => {
      const enemyUnit = JobSystem.createUnit(`e${idx + 1}`, e.name, 'enemy', e.jobId, e.x, e.z, 'S', e.level);
      enemySquad.push(enemyUnit);
    });

    this.units = [...playerSquad, ...enemySquad];
  }

  private playChapterIntro(): void {
    this.playDialogueSequence(this.currentChapter.introDialogue, () => {
      this.startBattle();
    });
  }

  private playDialogueSequence(lines: DialogueLine[], onComplete: () => void): void {
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
      this.onDialogueFinished?.();
    }
  }

  private bindEvents(): void {
    // Map Selector
    this.ui.onMapChanged = (mapId) => this.switchBattlefield(mapId);

    // Map Editor Events
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
      } catch (err) {
        alert('Invalid Map JSON syntax!');
      }
    };

    this.ui.onEditorTestBattle = () => {
      this.ui.toggleEditor(false);
      this.currentMode = 'idle';
      this.initSquadsForChapter(this.currentChapter);
      this.scene.updateUnits(this.units);
      this.startBattle();
    };

    // Camera HUD controls
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

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.currentMode === 'dialogue') {
        if (e.key === ' ' || e.key === 'Enter') {
          SoundFX.playMenuBlip();
          this.dialogueIndex++;
          this.advanceDialogue();
        }
        return;
      }

      if (e.key === 'q' || e.key === 'Q') {
        this.scene.rotateLeft();
        this.scene.updateUnits(this.units);
      } else if (e.key === 'e' || e.key === 'E') {
        this.scene.rotateRight();
        this.scene.updateUnits(this.units);
      } else if (e.key === '+' || e.key === '=') {
        this.scene.zoomIn(1.5);
      } else if (e.key === '-' || e.key === '_') {
        this.scene.zoomOut(1.5);
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        this.scene.panBy(0, -1.0);
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        this.scene.panBy(0, 1.0);
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        this.scene.panBy(-1.0, 0);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        this.scene.panBy(1.0, 0);
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'Home') {
        const active = this.turnManager.activeUnit;
        if (active) {
          this.scene.focusOn(active.x, this.grid.getHeight(active.x, active.z), active.z);
        }
      } else if (e.key === 'Escape') {
        if (this.currentMode === 'targeting') {
          this.cancelTargeting();
        } else if (this.currentMode === 'moving') {
          this.currentMode = 'idle';
          this.scene.clearHighlights();
        }
      }
    });

    this.scene.canvas.addEventListener('click', () => {
      this.onCanvasClick();
    });

    this.ui.onMoveClicked = () => this.handleMoveCommand();
    this.ui.onAbilitySelected = (ability) => this.handleAbilityCommand(ability);
    this.ui.onWaitClicked = () => this.handleWaitCommand();
    this.ui.onFacingConfirmed = (facing) => this.handleFacingConfirmed(facing);
    this.ui.onExecuteAttack = () => this.handleExecuteAttack();
    this.ui.onCancelAttack = () => this.cancelTargeting();
  }

  private switchBattlefield(mapId: string): void {
    const mapGen = MAPS[mapId] || MAPS.river_ruins;
    const mapData = mapGen();
    this.grid = new BattleGrid(mapData);
    this.scene.loadMap(this.grid);
    this.applyAtmosphereForMap(mapId);

    this.initSquadsForChapter(this.currentChapter);
    this.turnManager = new TurnManager(this.units);
    this.scene.updateUnits(this.units);
    this.startBattle();
  }

  private startBattle(): void {
    SoundFX.playTurnChime();
    this.ui.showBanner(`${this.currentChapter.title}: ${this.currentChapter.subtitle.toUpperCase()}`);
    this.updateTimeline();
    this.advanceTurn();
  }

  private advanceTurn(): void {
    const result = this.turnManager.advanceToNextActiveTurn();
    if (!result) {
      this.checkBattleStatus();
      return;
    }

    const { activeUnit, poisonDamage } = result;

    this.currentMode = 'idle';
    this.scene.clearHighlights();

    const height = this.grid.getHeight(activeUnit.x, activeUnit.z);
    this.scene.focusOn(activeUnit.x, height, activeUnit.z);
    this.scene.setCursor(activeUnit.x, activeUnit.z);

    if (poisonDamage) {
      this.scene.spawnFloatingDamage(activeUnit.x, height, activeUnit.z, `POISON -${poisonDamage}`, 'damage');
      SoundFX.playCrit();
    }

    this.ui.updateUnitCard(activeUnit, height);
    this.ui.populateActionSubMenu(activeUnit);
    this.ui.updateTurnTimeline(this.turnManager.predictTurnTimeline(8), activeUnit);

    this.ui.showBanner(`${activeUnit.name.toUpperCase()}'s TURN`);

    if (activeUnit.team === 'player') {
      SoundFX.playTurnChime();
    } else {
      setTimeout(() => this.runEnemyAi(activeUnit), 900);
    }
  }

  private handleMoveCommand(): void {
    const active = this.turnManager.activeUnit;
    if (!active || active.hasMoved || active.team !== 'player' || active.move === 0) return;

    this.currentMode = 'moving';
    const reachable = this.grid.getReachableTiles(active, this.units);
    this.scene.setHighlights(reachable, 0x3b82f6);
  }

  private handleAbilityCommand(ability: Ability): void {
    const active = this.turnManager.activeUnit;
    if (!active || active.hasActed || active.team !== 'player') return;

    this.selectedAbility = ability;

    if (ability.isSelfOnly) {
      const height = this.grid.getHeight(active.x, active.z);
      const forecast = CombatEngine.getForecast(active, active, ability, height, height);
      this.currentForecast = forecast;
      this.handleExecuteAttack();
      return;
    }

    this.currentMode = 'targeting';
    const targetables = this.grid.getTargetableTiles(
      active.x,
      active.z,
      ability.range,
      ability.heightTolerance
    );
    this.scene.setHighlights(targetables, 0xdc2626);
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
      setTimeout(() => this.advanceTurn(), 400);
    }
  }

  private onCanvasClick(): void {
    const tile = this.scene.hoveredTile;
    if (!tile) return;

    // 3D Map Editor Interception
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
      const reachable = this.grid.getReachableTiles(active, this.units);
      const isValid = reachable.some((r) => r.x === tile.x && r.z === tile.z);

      if (isValid) {
        SoundFX.playMoveStep();
        active.x = tile.x;
        active.z = tile.z;
        active.hasMoved = true;
        this.scene.updateUnits(this.units);
        this.scene.clearHighlights();
        this.currentMode = 'idle';

        this.ui.updateUnitCard(active, this.grid.getHeight(active.x, active.z));

        if (active.hasActed) {
          this.handleWaitCommand();
        }
      }
    } else if (this.currentMode === 'targeting' && this.selectedAbility && active.team === 'player') {
      const targetUnit = this.units.find((u) => !u.isDead && u.x === tile.x && u.z === tile.z);
      if (targetUnit) {
        SoundFX.playMenuBlip();
        const attackerHeight = this.grid.getHeight(active.x, active.z);
        const targetHeight = this.grid.getHeight(targetUnit.x, targetUnit.z);

        const forecast = CombatEngine.getForecast(
          active,
          targetUnit,
          this.selectedAbility,
          attackerHeight,
          targetHeight
        );

        this.currentForecast = forecast;
        this.ui.showCombatForecast(forecast);
      }
    }
  }

  private handleExecuteAttack(): void {
    if (!this.currentForecast) return;

    const forecast = this.currentForecast;
    const active = forecast.attacker;

    active.currentMp = Math.max(0, active.currentMp - forecast.ability.mpCost);

    // Trigger sprite lunge animation towards target
    this.scene.triggerUnitLunge(active.id, forecast.target.x, forecast.target.z);

    const result = CombatEngine.executeAttack(forecast);
    active.hasActed = true;

    active.jobPoints[active.jobId] = (active.jobPoints[active.jobId] || 0) + 24;
    active.exp += 15;

    this.scene.updateUnits(this.units);
    this.scene.clearHighlights();
    this.currentMode = 'idle';
    this.currentForecast = null;

    const targetHeight = this.grid.getHeight(forecast.target.x, forecast.target.z);
    const targetPos = new THREE.Vector3(forecast.target.x, targetHeight, forecast.target.z);

    if (result.hit) {
      this.scene.triggerUnitRecoil(forecast.target.id);

      if (result.isHeal) {
        SoundFX.playHeal();
        this.scene.vfx.spawnHolyFX(targetPos);
        this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, `+${result.damageDealt}`, 'heal');
        this.ui.showBanner(`${forecast.target.name} healed +${result.damageDealt} HP!`);
      } else if (result.appliedStatus && result.damageDealt === 0) {
        SoundFX.playMagicCast();
        this.scene.vfx.spawnHolyFX(targetPos);
        this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, `[${result.appliedStatus}]`, 'heal');
        this.ui.showBanner(`${forecast.target.name} granted ${result.appliedStatus}!`);
      } else {
        if (forecast.ability.element === 'physical') {
          SoundFX.playSwordSlash();
          this.scene.vfx.spawnSlashFX(targetPos);
        } else if (forecast.ability.element === 'fire') {
          SoundFX.playMagicCast();
          this.scene.vfx.spawnFireFX(targetPos);
        } else if (forecast.ability.element === 'ice') {
          SoundFX.playMagicCast();
          this.scene.vfx.spawnIceFX(targetPos);
        } else if (forecast.ability.element === 'lightning') {
          SoundFX.playMagicCast();
          this.scene.vfx.spawnLightningFX(targetPos);
        } else if (forecast.ability.element === 'holy') {
          SoundFX.playMagicCast();
          this.scene.vfx.spawnHolyFX(targetPos);
        } else {
          SoundFX.playMagicCast();
          this.scene.vfx.spawnSlashFX(targetPos);
        }

        if (result.isCrit) {
          SoundFX.playCrit();
          this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, `CRIT! -${result.damageDealt}`, 'crit');
          this.ui.showBanner(`CRITICAL HIT! ${forecast.target.name} takes ${result.damageDealt} DMG!`);
        } else {
          this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, `-${result.damageDealt}`, 'damage');
          this.ui.showBanner(`${forecast.target.name} takes ${result.damageDealt} damage!`);
        }

        if (result.secondStrike) {
          setTimeout(() => {
            if (result.secondStrike!.hit) {
              SoundFX.playSwordSlash();
              this.scene.vfx.spawnSlashFX(targetPos);
              this.scene.triggerUnitRecoil(forecast.target.id);
              this.scene.spawnFloatingDamage(forecast.target.x, targetHeight + 0.3, forecast.target.z, `-${result.secondStrike!.damageDealt}`, 'damage');
            }
          }, 350);
        }
      }
    } else {
      SoundFX.playMenuBlip();
      this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, 'MISS', 'miss');
      this.ui.showBanner('MISSED!');
    }

    this.ui.updateUnitCard(active, this.grid.getHeight(active.x, active.z));
    this.updateTimeline();

    if (active.hasMoved) {
      setTimeout(() => this.handleWaitCommand(), 700);
    }
  }

  private cancelTargeting(): void {
    this.currentMode = 'idle';
    this.selectedAbility = null;
    this.currentForecast = null;
    this.scene.clearHighlights();
  }

  private runEnemyAi(enemy: Unit): void {
    const players = this.units.filter((u) => !u.isDead && u.team === 'player');
    if (players.length === 0) return;

    let closestPlayer: Unit | null = null;
    let minDist = 999;
    for (const p of players) {
      const d = Math.abs(p.x - enemy.x) + Math.abs(p.z - enemy.z);
      if (d < minDist) {
        minDist = d;
        closestPlayer = p;
      }
    }

    if (!closestPlayer) return;

    const reachable = this.grid.getReachableTiles(enemy, this.units);
    let bestTile = { x: enemy.x, z: enemy.z };
    let bestTileDist = minDist;

    for (const r of reachable) {
      const d = Math.abs(r.x - closestPlayer.x) + Math.abs(r.z - closestPlayer.z);
      if (d < bestTileDist) {
        bestTileDist = d;
        bestTile = { x: r.x, z: r.z };
      }
    }

    enemy.x = bestTile.x;
    enemy.z = bestTile.z;
    enemy.hasMoved = true;
    this.scene.updateUnits(this.units);

    const distNow = Math.abs(enemy.x - closestPlayer.x) + Math.abs(enemy.z - closestPlayer.z);
    const abilities = JobSystem.getCombatActionAbilities(enemy);
    const attackAbility = abilities.find((a) => (a.power > 0 || a.appliesStatus) && a.range >= distNow) || abilities[0];

    if (distNow <= attackAbility.range) {
      const attackerHeight = this.grid.getHeight(enemy.x, enemy.z);
      const targetHeight = this.grid.getHeight(closestPlayer.x, closestPlayer.z);
      const forecast = CombatEngine.getForecast(enemy, closestPlayer, attackAbility, attackerHeight, targetHeight);

      setTimeout(() => {
        // Trigger lunge animation towards player target
        this.scene.triggerUnitLunge(enemy.id, closestPlayer!.x, closestPlayer!.z);

        const result = CombatEngine.executeAttack(forecast);
        enemy.hasActed = true;
        this.scene.updateUnits(this.units);

        const targetH = this.grid.getHeight(closestPlayer!.x, closestPlayer!.z);
        const targetPos = new THREE.Vector3(closestPlayer!.x, targetH, closestPlayer!.z);

        if (result.hit) {
          this.scene.triggerUnitRecoil(closestPlayer!.id);

          if (forecast.ability.element === 'physical') {
            SoundFX.playSwordSlash();
            this.scene.vfx.spawnSlashFX(targetPos);
          } else if (forecast.ability.element === 'fire') {
            SoundFX.playMagicCast();
            this.scene.vfx.spawnFireFX(targetPos);
          } else if (forecast.ability.element === 'ice') {
            SoundFX.playMagicCast();
            this.scene.vfx.spawnIceFX(targetPos);
          } else if (forecast.ability.element === 'lightning') {
            SoundFX.playMagicCast();
            this.scene.vfx.spawnLightningFX(targetPos);
          } else if (forecast.ability.element === 'holy') {
            SoundFX.playMagicCast();
            this.scene.vfx.spawnHolyFX(targetPos);
          } else {
            SoundFX.playMagicCast();
            this.scene.vfx.spawnSlashFX(targetPos);
          }

          if (result.isCrit) {
            SoundFX.playCrit();
            this.scene.spawnFloatingDamage(closestPlayer!.x, targetH, closestPlayer!.z, `CRIT! -${result.damageDealt}`, 'crit');
          } else if (result.appliedStatus && result.damageDealt === 0) {
            this.scene.spawnFloatingDamage(closestPlayer!.x, targetH, closestPlayer!.z, `[${result.appliedStatus}]`, 'heal');
          } else {
            this.scene.spawnFloatingDamage(closestPlayer!.x, targetH, closestPlayer!.z, `-${result.damageDealt}`, 'damage');
          }
          this.ui.showBanner(`${enemy.name} used ${attackAbility.name}!`);
        } else {
          this.scene.spawnFloatingDamage(closestPlayer!.x, targetH, closestPlayer!.z, 'MISS', 'miss');
          this.ui.showBanner(`${enemy.name} missed!`);
        }

        this.faceTowards(enemy, closestPlayer!.x, closestPlayer!.z);
        this.scene.updateUnits(this.units);
        this.turnManager.endTurn(enemy);
        this.updateTimeline();

        setTimeout(() => this.advanceTurn(), 1200);
      }, 700);
    } else {
      this.faceTowards(enemy, closestPlayer.x, closestPlayer.z);
      this.scene.updateUnits(this.units);
      this.turnManager.endTurn(enemy);
      this.updateTimeline();

      setTimeout(() => this.advanceTurn(), 800);
    }
  }

  private faceTowards(unit: Unit, targetX: number, targetZ: number): void {
    const dx = targetX - unit.x;
    const dz = targetZ - unit.z;
    if (Math.abs(dx) > Math.abs(dz)) {
      unit.facing = dx > 0 ? 'E' : 'W';
    } else {
      unit.facing = dz > 0 ? 'S' : 'N';
    }
  }

  private updateTimeline(): void {
    const nextUnits = this.turnManager.predictTurnTimeline(8);
    this.ui.updateTurnTimeline(nextUnits, this.turnManager.activeUnit);
    this.ui.populateJobCustomizer(this.units.filter((u) => u.team === 'player'));
  }

  private checkBattleStatus(): boolean {
    const playersAlive = this.units.some((u) => !u.isDead && u.team === 'player');
    const enemiesAlive = this.units.some((u) => !u.isDead && u.team === 'enemy');

    if (!playersAlive) {
      this.ui.showBanner('DEFEAT... ALL ALLIES FALLEN');
      return true;
    }
    if (!enemiesAlive) {
      SoundFX.playVictoryFanfare();
      this.ui.showBanner('VICTORY! BATTLEFIELD SECURED');

      // Play Victory Dialogue then trigger Branching Choice Modal
      setTimeout(() => {
        if (this.currentChapter.victoryDialogue && this.currentChapter.victoryDialogue.length > 0) {
          this.playDialogueSequence(this.currentChapter.victoryDialogue, () => {
            this.handleChapterVictoryChoices();
          });
        } else {
          this.handleChapterVictoryChoices();
        }
      }, 1500);

      return true;
    }
    return false;
  }

  private handleChapterVictoryChoices(): void {
    if (this.currentChapter.choices && this.currentChapter.choices.length > 0) {
      this.ui.showChoiceModal(
        `${this.currentChapter.title} — VICTORY!`,
        'The enemy forces are in disarray! How shall we proceed, Commander?',
        this.currentChapter.choices,
        (selectedChoice) => {
          this.ui.showBanner(`CHOICE ACCEPTED: ${selectedChoice.text}`);
          setTimeout(() => {
            this.loadChapter(selectedChoice.nextChapterId, true);
          }, 1200);
        }
      );
    } else {
      this.ui.showBanner('CAMPAIGN CONCLUDED! THE REALM IS AT PEACE.');
    }
  }

  private gameLoop(): void {
    requestAnimationFrame(() => this.gameLoop());

    if (this.scene && this.scene.hoveredTile) {
      const { x, z } = this.scene.hoveredTile;
      const tile = this.grid.getTile(x, z);
      if (tile) {
        this.ui.updateTileInfo(x, z, tile.height, tile.terrain);
      }
    }

    if (this.scene) {
      this.scene.render();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new TacticsGame();
});
