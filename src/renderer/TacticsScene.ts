import * as THREE from 'three';
import { TileData, Unit, FacingDirection, TerrainType } from '../core/types';
import { BattleGrid } from '../core/Grid';
import {
  createGrassTopTexture,
  createDirtSideTexture,
  createStoneTexture,
  createWaterTexture,
  createCastleParapetTexture,
  createSwampTexture,
  createUnitSpriteTexture
} from '../graphics/PixelTextures';
import { VFXManager } from './VFXManager';

export interface FloatingText {
  element: HTMLElement;
  position: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
}

interface UnitTween {
  type: 'lunge' | 'recoil';
  progress: number;
  maxProgress: number;
  dirX: number;
  dirZ: number;
}

export class TacticsScene {
  public canvas: HTMLCanvasElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
  public vfx: VFXManager;

  // Grid & Map
  public grid: BattleGrid;
  private tileMeshes: Map<string, THREE.Mesh> = new Map();

  // Unit meshes & sprites
  private unitSpritePlanes: Map<string, THREE.Mesh> = new Map();
  private unitTweens: Map<string, UnitTween> = new Map();
  private overheadHpElements: Map<string, HTMLElement> = new Map();

  // Highlight overlays
  private highlightGroup: THREE.Group = new THREE.Group();
  private cursorMesh: THREE.Group;

  // Camera & Zoom System
  public cameraTarget: THREE.Vector3 = new THREE.Vector3(5, 1, 5);
  public targetCameraTarget: THREE.Vector3 = new THREE.Vector3(5, 1, 5);
  public currentRotationAngle: number = Math.PI / 4;
  public targetRotationAngle: number = Math.PI / 4;
  
  public zoomLevel: number = 8.5;
  public targetZoomLevel: number = 8.5;
  public minZoomLevel: number = 2.0;
  public maxZoomLevel: number = 22.0;

  // Panning State
  private isPanning: boolean = false;
  private lastPanPosition: { x: number; y: number } = { x: 0, y: 0 };

  // Textures cache
  private grassTopTex = createGrassTopTexture();
  private dirtSideTex = createDirtSideTexture();
  private stoneTex = createStoneTexture();
  private waterTex = createWaterTexture();
  private parapetTex = createCastleParapetTexture();
  private swampTex = createSwampTexture();

  // Lighting
  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;

  // Interaction
  public hoveredTile: { x: number; z: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Floating Combat Text & Overlays
  private floatingTexts: FloatingText[] = [];
  private floatingTextContainer: HTMLElement;
  private lastRenderTime: number = performance.now();

  constructor(canvas: HTMLCanvasElement, grid: BattleGrid) {
    this.canvas = canvas;
    this.grid = grid;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17);

    // VFX Manager
    this.vfx = new VFXManager(this.scene);

    // Floating text container overlay
    this.floatingTextContainer = document.createElement('div');
    this.floatingTextContainer.className = 'floating-combat-overlay';
    document.getElementById('game-container')?.appendChild(this.floatingTextContainer);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      -this.zoomLevel * aspect,
      this.zoomLevel * aspect,
      this.zoomLevel,
      -this.zoomLevel,
      0.1,
      1000
    );

    this.setupLighting();
    this.buildMap();

    this.scene.add(this.highlightGroup);
    this.cursorMesh = this.buildCursor();
    this.scene.add(this.cursorMesh);

    this.setupInteractions();
    this.updateCameraPosition();
  }

  private setupLighting(): void {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5ea, 1.3);
    this.sunLight.position.set(20, 40, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 80;
    const d = 15;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0x60a5fa, 0.45);
    this.fillLight.position.set(-20, 20, -20);
    this.scene.add(this.fillLight);
  }

  public loadMap(newGrid: BattleGrid): void {
    this.grid = newGrid;

    for (const mesh of this.tileMeshes.values()) {
      if (mesh.geometry) mesh.geometry.dispose();
      this.scene.remove(mesh);
    }
    this.tileMeshes.clear();
    this.clearHighlights();

    if (newGrid.mapData.theme === 'night') {
      this.scene.background = new THREE.Color(0x04060d);
      this.ambientLight.color.setHex(0x38bdf8);
      this.ambientLight.intensity = 0.55;
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 0.75;
    } else if (newGrid.mapData.theme === 'swamp') {
      this.scene.background = new THREE.Color(0x06140e);
      this.ambientLight.color.setHex(0xa7f3d0);
      this.ambientLight.intensity = 0.65;
      this.sunLight.color.setHex(0x6ee7b7);
      this.sunLight.intensity = 0.85;
    } else {
      this.scene.background = new THREE.Color(0x0a0e17);
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.85;
      this.sunLight.color.setHex(0xfff5ea);
      this.sunLight.intensity = 1.3;
    }

    this.vfx.setWeatherTheme(newGrid.mapData.theme);
    this.buildMap();
    this.targetCameraTarget.set(5, 1, 5);
  }

  public updateTile(x: number, z: number, newHeight: number, newTerrain: TerrainType, walkable: boolean): void {
    const tile = this.grid.getTile(x, z);
    if (!tile) return;

    tile.height = Math.max(0, Math.min(6.0, Math.round(newHeight * 10) / 10));
    tile.terrain = newTerrain;
    tile.walkable = walkable;

    const oldMesh = this.tileMeshes.get(this.grid.key(x, z));
    if (oldMesh) {
      if (oldMesh.geometry) oldMesh.geometry.dispose();
      this.scene.remove(oldMesh);
    }

    const height = Math.max(0.2, tile.height);
    const geom = new THREE.BoxGeometry(1, height, 1);

    let topMat: THREE.Material;
    let sideMat: THREE.Material;

    if (tile.terrain === 'stone') {
      topMat = new THREE.MeshLambertMaterial({ map: this.stoneTex });
      sideMat = new THREE.MeshLambertMaterial({ map: this.stoneTex });
    } else if (tile.terrain === 'parapet') {
      topMat = new THREE.MeshLambertMaterial({ map: this.parapetTex });
      sideMat = new THREE.MeshLambertMaterial({ map: this.parapetTex });
    } else if (tile.terrain === 'swamp') {
      topMat = new THREE.MeshLambertMaterial({ map: this.swampTex, transparent: true, opacity: 0.9 });
      sideMat = new THREE.MeshLambertMaterial({ map: this.swampTex });
    } else if (tile.terrain === 'water') {
      topMat = new THREE.MeshLambertMaterial({ map: this.waterTex, transparent: true, opacity: 0.85 });
      sideMat = new THREE.MeshLambertMaterial({ map: this.waterTex });
    } else if (tile.terrain === 'wood') {
      topMat = new THREE.MeshLambertMaterial({ map: this.dirtSideTex });
      sideMat = new THREE.MeshLambertMaterial({ map: this.dirtSideTex });
    } else {
      topMat = new THREE.MeshLambertMaterial({ map: this.grassTopTex });
      sideMat = new THREE.MeshLambertMaterial({ map: this.dirtSideTex });
    }

    const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
    const mesh = new THREE.Mesh(geom, materials);
    mesh.position.set(tile.x, height / 2, tile.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { tile };

    this.scene.add(mesh);
    this.tileMeshes.set(this.grid.key(tile.x, tile.z), mesh);

    this.setCursor(x, z);
  }

  private buildMap(): void {
    const { tiles } = this.grid.mapData;

    for (const t of tiles) {
      const height = Math.max(0.2, t.height);
      const geom = new THREE.BoxGeometry(1, height, 1);

      let topMat: THREE.Material;
      let sideMat: THREE.Material;

      if (t.terrain === 'stone') {
        topMat = new THREE.MeshLambertMaterial({ map: this.stoneTex });
        sideMat = new THREE.MeshLambertMaterial({ map: this.stoneTex });
      } else if (t.terrain === 'parapet') {
        topMat = new THREE.MeshLambertMaterial({ map: this.parapetTex });
        sideMat = new THREE.MeshLambertMaterial({ map: this.parapetTex });
      } else if (t.terrain === 'swamp') {
        topMat = new THREE.MeshLambertMaterial({ map: this.swampTex, transparent: true, opacity: 0.9 });
        sideMat = new THREE.MeshLambertMaterial({ map: this.swampTex });
      } else if (t.terrain === 'water') {
        topMat = new THREE.MeshLambertMaterial({ map: this.waterTex, transparent: true, opacity: 0.85 });
        sideMat = new THREE.MeshLambertMaterial({ map: this.waterTex });
      } else if (t.terrain === 'wood') {
        topMat = new THREE.MeshLambertMaterial({ map: this.dirtSideTex });
        sideMat = new THREE.MeshLambertMaterial({ map: this.dirtSideTex });
      } else {
        topMat = new THREE.MeshLambertMaterial({ map: this.grassTopTex });
        sideMat = new THREE.MeshLambertMaterial({ map: this.dirtSideTex });
      }

      const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
      const mesh = new THREE.Mesh(geom, materials);
      mesh.position.set(t.x, height / 2, t.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { tile: t };

      this.scene.add(mesh);
      this.tileMeshes.set(this.grid.key(t.x, t.z), mesh);
    }
  }

  private buildCursor(): THREE.Group {
    const group = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: 0xf4c430, linewidth: 2 });
    const points = [
      new THREE.Vector3(-0.48, 0, -0.48), new THREE.Vector3(-0.25, 0, -0.48),
      new THREE.Vector3(-0.48, 0, -0.48), new THREE.Vector3(-0.48, 0, -0.25),
      new THREE.Vector3(0.48, 0, -0.48), new THREE.Vector3(0.25, 0, -0.48),
      new THREE.Vector3(0.48, 0, -0.48), new THREE.Vector3(0.48, 0, -0.25),
      new THREE.Vector3(0.48, 0, 0.48), new THREE.Vector3(0.25, 0, 0.48),
      new THREE.Vector3(0.48, 0, 0.48), new THREE.Vector3(0.48, 0, 0.25),
      new THREE.Vector3(-0.48, 0, 0.48), new THREE.Vector3(-0.25, 0, 0.48),
      new THREE.Vector3(-0.48, 0, 0.48), new THREE.Vector3(-0.48, 0, 0.25)
    ];

    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.LineSegments(geom, lineMat);
    group.add(line);

    const diamondGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -0.15),
      new THREE.Vector3(0.15, 0, 0),
      new THREE.Vector3(0, 0, 0.15),
      new THREE.Vector3(-0.15, 0, 0),
      new THREE.Vector3(0, 0, -0.15)
    ]);
    const diamond = new THREE.Line(diamondGeom, lineMat);
    group.add(diamond);

    group.position.set(0, 1.05, 0);
    return group;
  }

  private setupInteractions(): void {
    window.addEventListener('resize', () => this.onResize());

    this.canvas.addEventListener('pointermove', (e) => {
      this.onPointerMove(e);

      if (this.isPanning) {
        const deltaX = e.clientX - this.lastPanPosition.x;
        const deltaY = e.clientY - this.lastPanPosition.y;
        this.lastPanPosition = { x: e.clientX, y: e.clientY };

        const factor = (this.zoomLevel / window.innerHeight) * 1.8;
        const cos = Math.cos(this.currentRotationAngle);
        const sin = Math.sin(this.currentRotationAngle);

        const right = new THREE.Vector3(-sin, 0, cos);
        const forward = new THREE.Vector3(-cos, 0, -sin);

        this.targetCameraTarget.addScaledVector(right, -deltaX * factor);
        this.targetCameraTarget.addScaledVector(forward, -deltaY * factor);
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2 || e.button === 1) {
        this.isPanning = true;
        this.lastPanPosition = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (e.button === 2 || e.button === 1) {
        this.isPanning = false;
      }
    });

    this.canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const zoomDelta = Math.sign(e.deltaY) * 0.9;
        if (zoomDelta > 0) {
          this.zoomOut(zoomDelta);
        } else {
          this.zoomIn(-zoomDelta);
        }
      },
      { passive: false }
    );
  }

  public triggerUnitLunge(unitId: string, targetX: number, targetZ: number): void {
    const sprite = this.unitSpritePlanes.get(unitId);
    if (!sprite) return;

    const dx = targetX - sprite.position.x;
    const dz = targetZ - sprite.position.z;
    const len = Math.hypot(dx, dz) || 1;

    this.unitTweens.set(unitId, {
      type: 'lunge',
      progress: 0,
      maxProgress: 18,
      dirX: dx / len,
      dirZ: dz / len
    });
  }

  public triggerUnitRecoil(unitId: string): void {
    this.unitTweens.set(unitId, {
      type: 'recoil',
      progress: 0,
      maxProgress: 14,
      dirX: (Math.random() - 0.5) * 2,
      dirZ: (Math.random() - 0.5) * 2
    });
  }

  public updateUnits(units: Unit[]): void {
    const time = Date.now() * 0.0035;

    for (const unit of units) {
      if (unit.isDead) {
        const mesh = this.unitSpritePlanes.get(unit.id);
        if (mesh) {
          this.scene.remove(mesh);
          this.unitSpritePlanes.delete(unit.id);
        }
        const bar = this.overheadHpElements.get(unit.id);
        if (bar) {
          bar.remove();
          this.overheadHpElements.delete(unit.id);
        }
        continue;
      }

      let spriteMesh = this.unitSpritePlanes.get(unit.id);
      if (!spriteMesh) {
        const geom = new THREE.PlaneGeometry(1.35, 1.35);
        const mat = new THREE.MeshBasicMaterial({
          transparent: true,
          side: THREE.DoubleSide,
          alphaTest: 0.1
        });
        spriteMesh = new THREE.Mesh(geom, mat);
        spriteMesh.renderOrder = 10;
        this.scene.add(spriteMesh);
        this.unitSpritePlanes.set(unit.id, spriteMesh);
      }

      const height = this.grid.getHeight(unit.x, unit.z);
      const bob = Math.sin(time + unit.x * 2 + unit.z) * 0.035;

      // Handle Lunge / Recoil Tweens
      let offsetX = 0;
      let offsetZ = 0;
      const tween = this.unitTweens.get(unit.id);
      if (tween) {
        tween.progress++;
        const p = tween.progress / tween.maxProgress;
        if (tween.type === 'lunge') {
          const lungeDist = Math.sin(p * Math.PI) * 0.45;
          offsetX = tween.dirX * lungeDist;
          offsetZ = tween.dirZ * lungeDist;
        } else if (tween.type === 'recoil') {
          const recoilDist = Math.sin(p * Math.PI) * 0.25;
          offsetX = -tween.dirX * recoilDist;
          offsetZ = -tween.dirZ * recoilDist;
        }

        if (tween.progress >= tween.maxProgress) {
          this.unitTweens.delete(unit.id);
        }
      }

      spriteMesh.position.set(unit.x + offsetX, height + 0.68 + bob, unit.z + offsetZ);

      const relativeFacing = this.calculateRelativeFacing(unit.facing);
      const isEnemy = unit.team === 'enemy';
      const tex = createUnitSpriteTexture(unit.jobId, relativeFacing, isEnemy);
      (spriteMesh.material as THREE.MeshBasicMaterial).map = tex;
      (spriteMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;

      spriteMesh.rotation.y = this.currentRotationAngle;

      // Update Overhead Mini HP Bar in 3D projection
      this.updateOverheadHpBar(unit, spriteMesh.position);
    }
  }

  private updateOverheadHpBar(unit: Unit, worldPos: THREE.Vector3): void {
    let barEl = this.overheadHpElements.get(unit.id);
    if (!barEl) {
      barEl = document.createElement('div');
      barEl.className = `unit-overhead-hp ${unit.team}`;
      barEl.innerHTML = `
        <div class="overhead-hp-fill" style="width: 100%;"></div>
        <div class="overhead-ct-fill" style="width: 0%;"></div>
      `;
      this.floatingTextContainer.appendChild(barEl);
      this.overheadHpElements.set(unit.id, barEl);
    }

    const hpFill = barEl.querySelector('.overhead-hp-fill') as HTMLElement;
    const ctFill = barEl.querySelector('.overhead-ct-fill') as HTMLElement;
    if (hpFill) hpFill.style.width = `${Math.max(0, (unit.currentHp / unit.maxHp) * 100)}%`;
    if (ctFill) ctFill.style.width = `${Math.min(100, unit.ct)}%`;

    // Project 3D pos to screen
    const screenPos = new THREE.Vector3(worldPos.x, worldPos.y + 0.72, worldPos.z);
    screenPos.project(this.camera);

    const x = ((screenPos.x + 1) * window.innerWidth) / 2;
    const y = ((-screenPos.y + 1) * window.innerHeight) / 2;

    barEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }

  private calculateRelativeFacing(unitFacing: FacingDirection): FacingDirection {
    const normalizedAngle = ((this.currentRotationAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const cameraQuadrant = Math.round(normalizedAngle / (Math.PI / 2)) % 4;

    const directions: FacingDirection[] = ['S', 'E', 'N', 'W'];
    const unitDirIndex = directions.indexOf(unitFacing);
    const relativeIndex = (unitDirIndex - cameraQuadrant + 4) % 4;
    return directions[relativeIndex];
  }

  public setHighlights(tiles: { x: number; z: number }[], color: number = 0x3b82f6): void {
    this.clearHighlights();

    for (const t of tiles) {
      const height = this.grid.getHeight(t.x, t.z);
      const geom = new THREE.PlaneGeometry(0.95, 0.95);
      geom.rotateX(-Math.PI / 2);

      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(t.x, height + 0.02, t.z);
      this.highlightGroup.add(mesh);
    }
  }

  public clearHighlights(): void {
    while (this.highlightGroup.children.length > 0) {
      const child = this.highlightGroup.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      this.highlightGroup.remove(child);
    }
  }

  public setCursor(x: number, z: number): void {
    const height = this.grid.getHeight(x, z);
    this.cursorMesh.position.set(x, height + 0.05, z);
    this.hoveredTile = { x, z };
  }

  public focusOn(x: number, height: number, z: number): void {
    this.targetCameraTarget.set(x, height, z);
  }

  public rotateLeft(): void {
    this.targetRotationAngle += Math.PI / 2;
  }

  public rotateRight(): void {
    this.targetRotationAngle -= Math.PI / 2;
  }

  public zoomIn(step: number = 1.6): void {
    this.targetZoomLevel = Math.max(this.minZoomLevel, this.targetZoomLevel - step);
  }

  public zoomOut(step: number = 1.6): void {
    this.targetZoomLevel = Math.min(this.maxZoomLevel, this.targetZoomLevel + step);
  }

  public panBy(dx: number, dz: number): void {
    const cos = Math.cos(this.currentRotationAngle);
    const sin = Math.sin(this.currentRotationAngle);

    const right = new THREE.Vector3(-sin, 0, cos);
    const forward = new THREE.Vector3(-cos, 0, -sin);

    this.targetCameraTarget.addScaledVector(right, dx);
    this.targetCameraTarget.addScaledVector(forward, dz);
  }

  private updateCameraPosition(): void {
    this.currentRotationAngle += (this.targetRotationAngle - this.currentRotationAngle) * 0.16;
    this.cameraTarget.lerp(this.targetCameraTarget, 0.14);

    const oldZoom = this.zoomLevel;
    this.zoomLevel += (this.targetZoomLevel - this.zoomLevel) * 0.18;
    if (Math.abs(this.zoomLevel - oldZoom) > 0.001) {
      this.updateCameraFrustum();
    }

    const distance = 45;
    const pitch = 35.264 * (Math.PI / 180);

    const cx = this.cameraTarget.x + distance * Math.cos(this.currentRotationAngle) * Math.cos(pitch) + this.vfx.cameraShakeOffset.x;
    const cz = this.cameraTarget.z + distance * Math.sin(this.currentRotationAngle) * Math.cos(pitch) + this.vfx.cameraShakeOffset.z;
    const cy = this.cameraTarget.y + distance * Math.sin(pitch) + this.vfx.cameraShakeOffset.y;

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.cameraTarget);

    for (const sprite of this.unitSpritePlanes.values()) {
      sprite.rotation.y = this.currentRotationAngle;
    }
  }

  private updateCameraFrustum(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = -this.zoomLevel * aspect;
    this.camera.right = this.zoomLevel * aspect;
    this.camera.top = this.zoomLevel;
    this.camera.bottom = -this.zoomLevel;
    this.camera.updateProjectionMatrix();
  }

  private onPointerMove(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.tileMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const tileData = intersects[0].object.userData.tile as TileData;
      if (tileData) {
        this.setCursor(tileData.x, tileData.z);
      }
    }
  }

  public spawnFloatingDamage(x: number, y: number, z: number, text: string, type: 'damage' | 'heal' | 'crit' | 'miss'): void {
    const el = document.createElement('div');
    el.className = `floating-number ${type}`;
    el.textContent = text;
    this.floatingTextContainer.appendChild(el);

    this.floatingTexts.push({
      element: el,
      position: new THREE.Vector3(x, y + 1.2, z),
      lifetime: 0,
      maxLifetime: 60
    });
  }

  private updateFloatingNumbers(): void {
    const toRemove: number[] = [];
    const screenPos = new THREE.Vector3();

    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ft.lifetime++;

      ft.position.y += 0.018;

      screenPos.copy(ft.position);
      screenPos.project(this.camera);

      const x = ((screenPos.x + 1) * window.innerWidth) / 2;
      const y = ((-screenPos.y + 1) * window.innerHeight) / 2;

      ft.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      ft.element.style.opacity = `${Math.max(0, 1 - ft.lifetime / ft.maxLifetime)}`;

      if (ft.lifetime >= ft.maxLifetime) {
        toRemove.push(i);
        ft.element.remove();
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.floatingTexts.splice(toRemove[i], 1);
    }
  }

  private onResize(): void {
    this.updateCameraFrustum();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public render(): void {
    const now = performance.now();
    const delta = Math.min(0.1, (now - this.lastRenderTime) / 1000);
    this.lastRenderTime = now;

    this.updateCameraPosition();
    this.updateFloatingNumbers();
    this.vfx.update(delta);

    // Subtle water caustics wave animation
    const time = now * 0.003;
    this.waterTex.offset.x = Math.sin(time * 0.6) * 0.06;
    this.waterTex.offset.y = Math.cos(time * 0.6) * 0.06;

    // Pulse cursor
    const cursorTime = now * 0.005;
    const scale = 1 + Math.sin(cursorTime) * 0.06;
    this.cursorMesh.scale.set(scale, 1, scale);

    this.renderer.render(this.scene, this.camera);
  }
}
