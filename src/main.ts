import { createRuinsMap } from './data/maps';
import { BattleGrid } from './core/Grid';
import { TacticsScene } from './renderer/TacticsScene';
import { UIManager } from './ui/UIManager';
import { TurnManager } from './core/TurnManager';
import { JobSystem } from './core/JobSystem';
import { CombatEngine } from './core/CombatEngine';
import { Unit, Ability, CombatForecast, FacingDirection } from './core/types';

class TacticsGame {
  private grid: BattleGrid;
  private scene: TacticsScene;
  private ui: UIManager;
  private turnManager: TurnManager;
  private units: Unit[] = [];

  // Interaction State
  private currentMode: 'idle' | 'moving' | 'targeting' | 'facing' = 'idle';
  private selectedAbility: Ability | null = null;
  private currentForecast: CombatForecast | null = null;

  constructor() {
    // 1. Initialize Map & Grid
    const mapData = createRuinsMap();
    this.grid = new BattleGrid(mapData);

    // 2. Initialize Units (Player Squad & Enemy Squad)
    this.units = [
      // Player Units
      JobSystem.createUnit('p1', 'Ramza', 'player', 'squire', 3, 8, 'N', 2),
      JobSystem.createUnit('p2', 'Agrias', 'player', 'knight', 4, 8, 'N', 2),
      JobSystem.createUnit('p3', 'Mustadio', 'player', 'archer', 5, 9, 'N', 2),

      // Enemy Units
      JobSystem.createUnit('e1', 'Bandit Chief', 'enemy', 'knight', 8, 3, 'S', 2),
      JobSystem.createUnit('e2', 'Brigand Bowman', 'enemy', 'archer', 9, 2, 'S', 2),
      JobSystem.createUnit('e3', 'Rogue Warlock', 'enemy', 'black_mage', 6, 4, 'S', 2)
    ];

    // Give Ramza a secondary skillset and some abilities
    JobSystem.setSecondarySkillset(this.units[0], 'knight');
    this.units[0].unlockedAbilities['kn_rend_armor'] = true;
    this.units[0].unlockedAbilities['sq_move_plus'] = true;
    this.units[0].equippedAbilities.movement = 'sq_move_plus';
    JobSystem.recalculateDerivedStats(this.units[0]);

    // 3. Initialize Renderer & Scene (starts at close tactical zoom 8.5)
    const canvas = document.getElementById('viewport-canvas') as HTMLCanvasElement;
    this.scene = new TacticsScene(canvas, this.grid);
    this.scene.updateUnits(this.units);

    // 4. Initialize Turn Manager
    this.turnManager = new TurnManager(this.units);

    // 5. Initialize UI Manager
    this.ui = new UIManager();
    this.bindEvents();

    // 6. Start Battle Loop
    this.startBattle();
    this.gameLoop();
  }

  private bindEvents(): void {
    // Camera HUD controls
    document.getElementById('btn-rot-left')?.addEventListener('click', () => {
      this.scene.rotateLeft();
      this.scene.updateUnits(this.units);
    });

    document.getElementById('btn-rot-right')?.addEventListener('click', () => {
      this.scene.rotateRight();
      this.scene.updateUnits(this.units);
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.scene.zoomIn(1.8));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.scene.zoomOut(1.8));

    // Keyboard shortcuts: rotation, zoom, camera panning, reset
    window.addEventListener('keydown', (e) => {
      // Rotation
      if (e.key === 'q' || e.key === 'Q') {
        this.scene.rotateLeft();
        this.scene.updateUnits(this.units);
      } else if (e.key === 'e' || e.key === 'E') {
        this.scene.rotateRight();
        this.scene.updateUnits(this.units);
      }
      // Zoom
      else if (e.key === '+' || e.key === '=') {
        this.scene.zoomIn(1.5);
      } else if (e.key === '-' || e.key === '_') {
        this.scene.zoomOut(1.5);
      }
      // Camera Panning (WASD / Arrow Keys)
      else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        this.scene.panBy(0, -1.0);
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        this.scene.panBy(0, 1.0);
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        this.scene.panBy(-1.0, 0);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        this.scene.panBy(1.0, 0);
      }
      // Reset camera to active unit
      else if (e.key === 'r' || e.key === 'R' || e.key === 'Home') {
        const active = this.turnManager.activeUnit;
        if (active) {
          this.scene.focusOn(active.x, this.grid.getHeight(active.x, active.z), active.z);
        }
      }
      // Cancel targeting
      else if (e.key === 'Escape') {
        if (this.currentMode === 'targeting') {
          this.cancelTargeting();
        } else if (this.currentMode === 'moving') {
          this.currentMode = 'idle';
          this.scene.clearHighlights();
        }
      }
    });

    // Viewport Click Handling
    this.scene.canvas.addEventListener('click', () => {
      this.onCanvasClick();
    });

    // UI Action Menu events
    this.ui.onMoveClicked = () => this.handleMoveCommand();
    this.ui.onAbilitySelected = (ability) => this.handleAbilityCommand(ability);
    this.ui.onWaitClicked = () => this.handleWaitCommand();
    this.ui.onFacingConfirmed = (facing) => this.handleFacingConfirmed(facing);
    this.ui.onExecuteAttack = () => this.handleExecuteAttack();
    this.ui.onCancelAttack = () => this.cancelTargeting();
  }

  private startBattle(): void {
    this.ui.showBanner('BATTLE START');
    this.updateTimeline();
    this.advanceTurn();
  }

  private advanceTurn(): void {
    const active = this.turnManager.advanceToNextActiveTurn();
    if (!active) {
      this.checkBattleStatus();
      return;
    }

    this.currentMode = 'idle';
    this.scene.clearHighlights();

    // Smoothly focus camera on active unit
    const height = this.grid.getHeight(active.x, active.z);
    this.scene.focusOn(active.x, height, active.z);
    this.scene.setCursor(active.x, active.z);

    this.ui.updateUnitCard(active, height);
    this.ui.populateActionSubMenu(active);
    this.ui.updateTurnTimeline(this.turnManager.predictTurnTimeline(8), active);

    this.ui.showBanner(`${active.name.toUpperCase()}'s TURN`);

    if (active.team === 'enemy') {
      setTimeout(() => this.runEnemyAi(active), 900);
    }
  }

  private handleMoveCommand(): void {
    const active = this.turnManager.activeUnit;
    if (!active || active.hasMoved || active.team !== 'player') return;

    this.currentMode = 'moving';
    const reachable = this.grid.getReachableTiles(active, this.units);
    this.scene.setHighlights(reachable, 0x3b82f6); // FFT Blue movement tiles
  }

  private handleAbilityCommand(ability: Ability): void {
    const active = this.turnManager.activeUnit;
    if (!active || active.hasActed || active.team !== 'player') return;

    this.selectedAbility = ability;
    this.currentMode = 'targeting';

    const targetables = this.grid.getTargetableTiles(
      active.x,
      active.z,
      ability.range,
      ability.heightTolerance
    );

    this.scene.setHighlights(targetables, 0xdc2626); // FFT Red attack tiles
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

    // End Active Unit Turn
    this.turnManager.endTurn(active);
    this.updateTimeline();

    // Check if battle resolved or advance to next
    if (!this.checkBattleStatus()) {
      setTimeout(() => this.advanceTurn(), 400);
    }
  }

  private onCanvasClick(): void {
    const tile = this.scene.hoveredTile;
    const active = this.turnManager.activeUnit;
    if (!tile || !active) return;

    if (this.currentMode === 'idle') {
      // If player clicks any unit, focus and inspect their card
      const clickedUnit = this.units.find((u) => !u.isDead && u.x === tile.x && u.z === tile.z);
      if (clickedUnit) {
        const height = this.grid.getHeight(clickedUnit.x, clickedUnit.z);
        this.scene.focusOn(clickedUnit.x, height, clickedUnit.z);
        this.ui.updateUnitCard(clickedUnit, height);
      }
    } else if (this.currentMode === 'moving' && active.team === 'player') {
      const reachable = this.grid.getReachableTiles(active, this.units);
      const isValid = reachable.some((r) => r.x === tile.x && r.z === tile.z);

      if (isValid) {
        active.x = tile.x;
        active.z = tile.z;
        active.hasMoved = true;
        this.scene.updateUnits(this.units);
        this.scene.clearHighlights();
        this.currentMode = 'idle';

        this.ui.updateUnitCard(active, this.grid.getHeight(active.x, active.z));

        // If unit already acted, automatically prompt for facing direction
        if (active.hasActed) {
          this.handleWaitCommand();
        }
      }
    } else if (this.currentMode === 'targeting' && this.selectedAbility && active.team === 'player') {
      const targetUnit = this.units.find((u) => !u.isDead && u.x === tile.x && u.z === tile.z);
      if (targetUnit) {
        // Can't attack yourself with offensive skills
        if (targetUnit.id === active.id && this.selectedAbility.power > 0) return;

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

    // Deduct MP
    active.currentMp = Math.max(0, active.currentMp - forecast.ability.mpCost);

    const result = CombatEngine.executeAttack(forecast);
    active.hasActed = true;

    // Award JP & EXP
    active.jobPoints[active.jobId] = (active.jobPoints[active.jobId] || 0) + 24;
    active.exp += 15;

    this.scene.updateUnits(this.units);
    this.scene.clearHighlights();
    this.currentMode = 'idle';
    this.currentForecast = null;

    const targetHeight = this.grid.getHeight(forecast.target.x, forecast.target.z);

    if (result.hit) {
      if (result.isHeal) {
        this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, `+${result.damageDealt}`, 'heal');
        this.ui.showBanner(`${forecast.target.name} healed +${result.damageDealt} HP!`);
      } else if (result.isCrit) {
        this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, `CRIT! -${result.damageDealt}`, 'crit');
        this.ui.showBanner(`CRITICAL HIT! ${forecast.target.name} takes ${result.damageDealt} DMG!`);
      } else {
        this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, `-${result.damageDealt}`, 'damage');
        this.ui.showBanner(`${forecast.target.name} takes ${result.damageDealt} damage!`);
      }
    } else {
      this.scene.spawnFloatingDamage(forecast.target.x, targetHeight, forecast.target.z, 'MISS', 'miss');
      this.ui.showBanner('MISSED!');
    }

    this.ui.updateUnitCard(active, this.grid.getHeight(active.x, active.z));
    this.updateTimeline();

    // If unit already moved, prompt for facing
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

    // Move adjacent to closest player
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
    const attackAbility = abilities.find((a) => a.power > 0 && a.range >= distNow) || abilities[0];

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
          if (result.isCrit) {
            this.scene.spawnFloatingDamage(closestPlayer!.x, targetH, closestPlayer!.z, `CRIT! -${result.damageDealt}`, 'crit');
          } else {
            this.scene.spawnFloatingDamage(closestPlayer!.x, targetH, closestPlayer!.z, `-${result.damageDealt}`, 'damage');
          }
          this.ui.showBanner(`${enemy.name} struck ${closestPlayer!.name} for ${result.damageDealt} DMG!`);
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
      this.ui.showBanner('VICTORY! RUINS SECURED');
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

// Start game once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new TacticsGame();
});
