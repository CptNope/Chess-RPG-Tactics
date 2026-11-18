import { MAPS } from './data/maps';
import { BattleGrid } from './core/Grid';
import { TacticsScene } from './renderer/TacticsScene';
import { UIManager } from './ui/UIManager';
import { TurnManager } from './core/TurnManager';
import { JobSystem } from './core/JobSystem';
import { CombatEngine } from './core/CombatEngine';
import { Unit, Ability, CombatForecast, FacingDirection, DialogueLine } from './core/types';
import { SoundFX } from './audio/SoundEffects';

class TacticsGame {
  private grid: BattleGrid;
  private scene: TacticsScene;
  private ui: UIManager;
  private turnManager: TurnManager;
  private units: Unit[] = [];

  // Interaction State
  private currentMode: 'idle' | 'moving' | 'targeting' | 'facing' | 'dialogue' = 'dialogue';
  private selectedAbility: Ability | null = null;
  private currentForecast: CombatForecast | null = null;

  // Story Cutscene Sequence
  private introDialogue: DialogueLine[] = [
    { speaker: 'Ramza', portraitClass: '⚔', side: 'left', text: 'Halt, brigands! The knights of the realm have encircled these ruins. Lay down your arms!' },
    { speaker: 'Bandit Chief', portraitClass: '🛡', side: 'right', text: 'Bah! Spoiled nobles strutting in fine armor! You know nothing of our hunger or our cause!' },
    { speaker: 'Rogue Warlock', portraitClass: '⚡', side: 'right', text: 'The ancient Zodiac Stones slumber beneath this soil... We will not let dogs of the throne claim them!' },
    { speaker: 'Agrias', portraitClass: '⚜', side: 'left', text: 'Silence your blasphemy, rebel! In the name of the realm, draw your steel!' }
  ];
  private dialogueIndex: number = 0;

  constructor() {
    // 1. Initialize Map
    const mapData = MAPS.river_ruins();
    this.grid = new BattleGrid(mapData);

    // 2. Initialize Squads (Player Squad & Enemy Squad)
    this.initSquads();

    // 3. Initialize Three.js Scene
    const canvas = document.getElementById('viewport-canvas') as HTMLCanvasElement;
    this.scene = new TacticsScene(canvas, this.grid);
    this.scene.updateUnits(this.units);

    // 4. Initialize Turn Engine & UI
    this.turnManager = new TurnManager(this.units);
    this.ui = new UIManager();
    this.bindEvents();

    // 5. Start with Story Cutscene
    this.playDialogueSequence();
    this.gameLoop();
  }

  private initSquads(): void {
    this.units = [
      // Player Units
      JobSystem.createUnit('p1', 'Ramza', 'player', 'squire', 3, 8, 'N', 3),
      JobSystem.createUnit('p2', 'Agrias', 'player', 'knight', 4, 8, 'N', 3),
      JobSystem.createUnit('p3', 'Mustadio', 'player', 'archer', 5, 9, 'N', 3),
      JobSystem.createUnit('p4', 'Kain', 'player', 'dragoon', 2, 7, 'N', 3),

      // Enemy Units
      JobSystem.createUnit('e1', 'Bandit Chief', 'enemy', 'knight', 8, 3, 'S', 3),
      JobSystem.createUnit('e2', 'Shadow Shinobi', 'enemy', 'ninja', 7, 2, 'S', 3),
      JobSystem.createUnit('e3', 'Rogue Warlock', 'enemy', 'time_mage', 6, 4, 'S', 3),
      JobSystem.createUnit('e4', 'Brigand Marksman', 'enemy', 'archer', 9, 2, 'S', 3)
    ];

    // Give Ramza a secondary skillset and movement ability
    JobSystem.setSecondarySkillset(this.units[0], 'knight');
    this.units[0].unlockedAbilities['kn_rend_armor'] = true;
    this.units[0].unlockedAbilities['sq_move_plus'] = true;
    this.units[0].equippedAbilities.movement = 'sq_move_plus';
    JobSystem.recalculateDerivedStats(this.units[0]);

    // Give Kain (Dragoon) Jump abilities
    this.units[3].unlockedAbilities['dr_jump'] = true;
    this.units[3].unlockedAbilities['dr_ignore_height'] = true;
    this.units[3].equippedAbilities.movement = 'dr_ignore_height';
    JobSystem.recalculateDerivedStats(this.units[3]);
  }

  private playDialogueSequence(): void {
    this.currentMode = 'dialogue';
    if (this.dialogueIndex < this.introDialogue.length) {
      const line = this.introDialogue[this.dialogueIndex];
      this.ui.showDialogue(line, () => {
        this.dialogueIndex++;
        this.playDialogueSequence();
      });
    } else {
      this.ui.hideDialogue();
      this.startBattle();
    }
  }

  private bindEvents(): void {
    // Map Selector
    this.ui.onMapChanged = (mapId) => this.switchBattlefield(mapId);

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
          this.playDialogueSequence();
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

    // Reset unit positions according to new battlefield
    this.initSquads();
    this.turnManager = new TurnManager(this.units);
    this.scene.updateUnits(this.units);
    this.startBattle();
  }

  private startBattle(): void {
    SoundFX.playTurnChime();
    this.ui.showBanner('BATTLE START');
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

    // Smoothly focus camera on active unit
    const height = this.grid.getHeight(activeUnit.x, activeUnit.z);
    this.scene.focusOn(activeUnit.x, height, activeUnit.z);
    this.scene.setCursor(activeUnit.x, activeUnit.z);

    // Poison damage processing
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

    // Self-only skills (e.g. Focus) execute directly
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
    const active = this.turnManager.activeUnit;
    if (!tile || !active) return;

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

    const result = CombatEngine.executeAttack(forecast);
    active.hasActed = true;

    active.jobPoints[active.jobId] = (active.jobPoints[active.jobId] || 0) + 24;
    active.exp += 15;

    this.scene.updateUnits(this.units);
    this.scene.clearHighlights();
    this.currentMode = 'idle';
    this.currentForecast = null;

    const targetHeight = this.grid.getHeight(forecast.target.x, forecast.target.z);

    if (result.hit) {
      if (result.isHeal) {
        SoundFX.playHeal();
        this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, `+${result.damageDealt}`, 'heal');
        this.ui.showBanner(`${forecast.target.name} healed +${result.damageDealt} HP!`);
      } else if (result.appliedStatus && result.damageDealt === 0) {
        SoundFX.playMagicCast();
        this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, `[${result.appliedStatus}]`, 'heal');
        this.ui.showBanner(`${forecast.target.name} granted ${result.appliedStatus}!`);
      } else {
        if (forecast.ability.element === 'physical') {
          SoundFX.playSwordSlash();
        } else {
          SoundFX.playMagicCast();
        }

        if (result.isCrit) {
          SoundFX.playCrit();
          this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, `CRIT! -${result.damageDealt}`, 'crit');
          this.ui.showBanner(`CRITICAL HIT! ${forecast.target.name} takes ${result.damageDealt} DMG!`);
        } else {
          this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, `-${result.damageDealt}`, 'damage');
          this.ui.showBanner(`${forecast.target.name} takes ${result.damageDealt} damage!`);
        }

        // Dual Wield Second Strike
        if (result.secondStrike) {
          setTimeout(() => {
            if (result.secondStrike!.hit) {
              SoundFX.playSwordSlash();
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
        const result = CombatEngine.executeAttack(forecast);
        enemy.hasActed = true;
        this.scene.updateUnits(this.units);

        const targetH = this.grid.getHeight(closestPlayer!.x, closestPlayer!.z);
        if (result.hit) {
          if (forecast.ability.element === 'physical') {
            SoundFX.playSwordSlash();
          } else {
            SoundFX.playMagicCast();
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
      return true;
    }
    return false;
  }

  private gameLoop(): void {
    requestAnimationFrame(() => this.gameLoop());

    if (this.scene.hoveredTile) {
      const { x, z } = this.scene.hoveredTile;
      const tile = this.grid.getTile(x, z);
      if (tile) {
        this.ui.updateTileInfo(x, z, tile.height, tile.terrain);
      }
    }

    this.scene.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new TacticsGame();
});
