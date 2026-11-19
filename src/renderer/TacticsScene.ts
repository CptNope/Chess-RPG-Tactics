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
  private tileMeshList: THREE.Mesh[] = [];

  // Unit meshes & sprites
  public currentUnits: Unit[] = [];
  private unitSpritePlanes: Map<string, THREE.Mesh> = new Map();
  private unitTweens: Map<string, UnitTween> = new Map();
  private overheadHpElements: Map<string, HTMLElement> = new Map();

  // Highlight overlays (pooled)
  private highlightGroup: THREE.Group = new THREE.Group();
  private cursorMesh: THREE.Group;
  private sharedHighlightGeom = new THREE.PlaneGeometry(0.95, 0.95);
  private moveHighlightMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.55, depthWrite: false });
  private attackHighlightMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.55, depthWrite: false });

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

  // Textures cache
  private grassTopTex = createGrassTopTexture();
  private dirtSideTex = createDirtSideTexture();
  private stoneTex = createStoneTexture();
  private waterTex = createWaterTexture();
  private parapetTex = createCastleParapetTexture();
  private swampTex = createSwampTexture();

  // Shared Tile Materials (Avoid instantiating hundreds of material instances)
  private stoneMat!: THREE.MeshLambertMaterial;
  private parapetMat!: THREE.MeshLambertMaterial;
  private swampTopMat!: THREE.MeshLambertMaterial;
  private swampSideMat!: THREE.MeshLambertMaterial;
  private waterTopMat!: THREE.MeshLambertMaterial;
  private waterSideMat!: THREE.MeshLambertMaterial;
  private dirtMat!: THREE.MeshLambertMaterial;
  private grassTopMat!: THREE.MeshLambertMaterial;

  // Lighting
  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;

  // Interaction
  public hoveredTile: { x: number; z: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Floating Combat Text & Overlays (reusable screen vector)
  private floatingTexts: FloatingText[] = [];
  private floatingTextContainer: HTMLElement;
  private lastRenderTime: number = performance.now();
  private tempScreenPos: THREE.Vector3 = new THREE.Vector3();

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

    // Initialize Shared Geometries & Materials
    this.sharedHighlightGeom.rotateX(-Math.PI / 2);
    this.initTileMaterials();

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

  private initTileMaterials(): void {
    this.stoneMat = new THREE.MeshLambertMaterial({ map: this.stoneTex });
    this.parapetMat = new THREE.MeshLambertMaterial({ map: this.parapetTex });
    this.swampTopMat = new THREE.MeshLambertMaterial({ map: this.swampTex, transparent: true, opacity: 0.9 });
    this.swampSideMat = new THREE.MeshLambertMaterial({ map: this.swampTex });
    this.waterTopMat = new THREE.MeshLambertMaterial({ map: this.waterTex, transparent: true, opacity: 0.85 });
    this.waterSideMat = new THREE.MeshLambertMaterial({ map: this.waterTex });
    this.dirtMat = new THREE.MeshLambertMaterial({ map: this.dirtSideTex });
    this.grassTopMat = new THREE.MeshLambertMaterial({ map: this.grassTopTex });
  }

  private getTileMaterials(terrain: TerrainType): THREE.Material[] {
    let topMat: THREE.Material;
    let sideMat: THREE.Material;

    if (terrain === 'stone') {
      topMat = this.stoneMat;
      sideMat = this.stoneMat;
    } else if (terrain === 'parapet') {
      topMat = this.parapetMat;
      sideMat = this.parapetMat;
    } else if (terrain === 'swamp') {
      topMat = this.swampTopMat;
      sideMat = this.swampSideMat;
    } else if (terrain === 'water') {
      topMat = this.waterTopMat;
      sideMat = this.waterSideMat;
    } else if (terrain === 'wood') {
      topMat = this.dirtMat;
      sideMat = this.dirtMat;
    } else {
      topMat = this.grassTopMat;
      sideMat = this.dirtMat;
    }

    return [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
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
    const materials = this.getTileMaterials(tile.terrain);

    const mesh = new THREE.Mesh(geom, materials);
    mesh.position.set(tile.x, height / 2, tile.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { tile };

    this.scene.add(mesh);
    this.tileMeshes.set(this.grid.key(tile.x, tile.z), mesh);
    this.tileMeshList = Array.from(this.tileMeshes.values());

    this.setCursor(x, z);
  }

  private buildMap(): void {
    const { tiles } = this.grid.mapData;

    for (const t of tiles) {
      const height = Math.max(0.2, t.height);
      const geom = new THREE.BoxGeometry(1, height, 1);
      const materials = this.getTileMaterials(t.terrain);

      const mesh = new THREE.Mesh(geom, materials);
      mesh.position.set(t.x, height / 2, t.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { tile: t };

      this.scene.add(mesh);
      this.tileMeshes.set(this.grid.key(t.x, t.z), mesh);
    }

    this.tileMeshList = Array.from(this.tileMeshes.values());
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

  // ---------------------------------------------------------------------------
  // Pointer input: one path for mouse, touch and pen (Pointer Events)
  // ---------------------------------------------------------------------------

  /** Fired when a tile is tapped/clicked without dragging. */
  public onTileTap?: (x: number, z: number, pointerType: string) => void;
  /** Fired by a two-finger tap, or a pen eraser / barrel-button tap: "cancel / back". */
  public onCancelGesture?: () => void;
  /** Fired the first time each kind of pointer is used, so the HUD can show matching hints. */
  public onPointerKind?: (pointerType: string) => void;

  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; type: string; moved: boolean; cancel: boolean }>();
  private pinch: { dist: number; angle: number; zoom: number; midX: number; midY: number; rotSteps: number; moved: boolean; t: number } | null = null;
  private multiTouchGesture = false;

  private distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** Pans the camera by a screen-space pixel delta (dragging the map). */
  private panByPixels(deltaX: number, deltaY: number): void {
    const factor = (this.zoomLevel / Math.min(window.innerWidth, window.innerHeight)) * 1.8;
    const cos = Math.cos(this.currentRotationAngle);
    const sin = Math.sin(this.currentRotationAngle);
    const right = new THREE.Vector3(-sin, 0, cos);
    const forward = new THREE.Vector3(-cos, 0, -sin);
    this.targetCameraTarget.addScaledVector(right, -deltaX * factor);
    this.targetCameraTarget.addScaledVector(forward, -deltaY * factor);
  }

  public setZoom(level: number): void {
    this.targetZoomLevel = Math.min(this.maxZoomLevel, Math.max(this.minZoomLevel, level));
  }

  /** Raycasts a screen point to a tile. */
  public pickTile(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObjects(this.tileMeshList)[0];
    const tile = hit?.object.userData.tile as TileData | undefined;
    return tile ? { x: tile.x, z: tile.z } : null;
  }

  /**
   * Moves the tile cursor one step in a screen direction (keyboard arrows, d-pad, stick).
   * "Up" follows the grid axis that points most toward the top-right of the screen for the
   * current camera rotation, the convention of classic isometric tactics games.
   */
  public moveCursor(dir: 'up' | 'down' | 'left' | 'right'): { x: number; z: number } | null {
    const cos = Math.cos(this.currentRotationAngle);
    const sin = Math.sin(this.currentRotationAngle);
    const fwd = { x: -cos, z: -sin };
    const right = { x: -sin, z: cos };
    const upV = { x: fwd.x + right.x, z: fwd.z + right.z };
    const rightV = { x: right.x - fwd.x, z: right.z - fwd.z };
    const want = dir === 'up' ? upV : dir === 'down' ? { x: -upV.x, z: -upV.z } : dir === 'right' ? rightV : { x: -rightV.x, z: -rightV.z };
    const axes = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
    const step = axes.reduce((best, a) => (a.x * want.x + a.z * want.z > best.x * want.x + best.z * want.z ? a : best));
    const cur = this.hoveredTile || { x: Math.round(this.targetCameraTarget.x), z: Math.round(this.targetCameraTarget.z) };
    const nx = cur.x + step.x;
    const nz = cur.z + step.z;
    if (!this.grid.getTile(nx, nz)) return null;
    this.setCursor(nx, nz);
    // Keep the cursor on screen: nudge the camera toward it
    const h = this.grid.getHeight(nx, nz);
    const t = this.targetCameraTarget;
    if (Math.hypot(nx - t.x, nz - t.z) > this.zoomLevel * 0.45) this.targetCameraTarget.set(nx, h, nz);
    return { x: nx, z: nz };
  }

  private setupInteractions(): void {
    window.addEventListener('resize', () => this.onResize());
    window.visualViewport?.addEventListener('resize', () => this.onResize());

    const c = this.canvas;
    c.style.touchAction = 'none'; // we handle pan/zoom ourselves; stop the page from scrolling/zooming
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    const seenKinds = new Set<string>();

    c.addEventListener('pointerdown', (e) => {
      if (!seenKinds.has(e.pointerType)) {
        seenKinds.add(e.pointerType);
        this.onPointerKind?.(e.pointerType);
      }
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events cannot be captured */
      }
      // Pen eraser (button 5) or barrel button (button 2) marks this press as "cancel"
      const cancel = e.pointerType === 'pen' && (e.button === 5 || e.button === 2 || (e.buttons & 32) !== 0);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), type: e.pointerType, moved: false, cancel });

      if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
        this.isPanning = true;
      }

      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.multiTouchGesture = true;
        this.pinch = {
          dist: Math.max(1, this.distance(a, b)),
          angle: Math.atan2(b.y - a.y, b.x - a.x),
          zoom: this.targetZoomLevel,
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2,
          rotSteps: 0,
          moved: false,
          t: performance.now()
        };
      }
    });

    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) {
        // Hover (mouse, or a pen held above the screen) previews the tile under it
        if (e.pointerType !== 'touch') this.onPointerMove(e);
        return;
      }
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      const threshold = p.type === 'touch' ? 10 : 6;
      if (!p.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > threshold) p.moved = true;

      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.max(1, this.distance(a, b));
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        if (Math.abs(dist - this.pinch.dist) > 12 || Math.hypot(midX - this.pinch.midX, midY - this.pinch.midY) > 12) this.pinch.moved = true;
        // Pinch: spread fingers to zoom in
        this.setZoom(this.pinch.zoom * (this.pinch.dist / dist));
        // Two-finger drag pans
        this.panByPixels(midX - this.pinch.midX, midY - this.pinch.midY);
        this.pinch.midX = midX;
        this.pinch.midY = midY;
        // Twist: every 50 degrees of rotation turns the camera 90 degrees
        let delta = Math.atan2(b.y - a.y, b.x - a.x) - this.pinch.angle;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        const steps = Math.trunc(delta / (50 * Math.PI / 180));
        while (steps > this.pinch.rotSteps) { this.rotateRight(); this.pinch.rotSteps++; this.pinch.moved = true; }
        while (steps < this.pinch.rotSteps) { this.rotateLeft(); this.pinch.rotSteps--; this.pinch.moved = true; }
        return;
      }

      if (this.isPanning || (p.moved && !this.multiTouchGesture)) {
        this.panByPixels(dx, dy);
      } else if (e.pointerType !== 'touch') {
        this.onPointerMove(e);
      }
    });

    const finish = (e: PointerEvent, cancelled: boolean) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) this.isPanning = false;

      if (this.multiTouchGesture) {
        // Two-finger tap (quick, no pinch/pan/twist) = cancel / back
        if (!cancelled && this.pinch && !this.pinch.moved && performance.now() - this.pinch.t < 350 && this.pointers.size === 1) {
          this.onCancelGesture?.();
          this.pinch.moved = true; // fire once
        }
        if (this.pointers.size < 2) this.pinch = null;
        if (this.pointers.size === 0) this.multiTouchGesture = false;
        return;
      }

      if (cancelled || p.moved || this.isPanning) return;
      if (p.cancel) {
        this.onCancelGesture?.();
        return;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const tile = this.pickTile(e.clientX, e.clientY);
      if (tile) {
        this.setCursor(tile.x, tile.z);
        this.onTileTap?.(tile.x, tile.z, e.pointerType);
      }
    };

    c.addEventListener('pointerup', (e) => finish(e, false));
    c.addEventListener('pointercancel', (e) => finish(e, true));
    c.addEventListener('lostpointercapture', (e) => {
      if (this.pointers.has(e.pointerId)) finish(e, true);
    });
    window.addEventListener('blur', () => {
      this.pointers.clear();
      this.pinch = null;
      this.multiTouchGesture = false;
      this.isPanning = false;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) this.isPanning = false;
    });

    c.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        // Trackpad pinch arrives as ctrl+wheel with small deltas; mouse wheels use steps
        const step = e.ctrlKey ? Math.min(2, Math.abs(e.deltaY) * 0.05) : 0.9;
        if (e.deltaY > 0) this.zoomOut(step);
        else if (e.deltaY < 0) this.zoomIn(step);
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
    this.currentUnits = [...units];

    // Drop sprites and HP bars for units that are no longer in the battle (new chapter / Trial)
    const liveIds = new Set(units.map((u) => u.id));
    for (const [id, mesh] of this.unitSpritePlanes) {
      if (!liveIds.has(id)) {
        this.scene.remove(mesh);
        this.unitSpritePlanes.delete(id);
      }
    }
    for (const [id, el] of this.overheadHpElements) {
      if (!liveIds.has(id)) {
        el.remove();
        this.overheadHpElements.delete(id);
      }
    }

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

      // Update Overhead Mini HP Bar stat fills
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

      barEl.classList.toggle('boss', !!unit.isBoss);
      barEl.classList.toggle('enraged', !!unit.isEnraged);

      const hpFill = barEl.querySelector('.overhead-hp-fill') as HTMLElement;
      const ctFill = barEl.querySelector('.overhead-ct-fill') as HTMLElement;
      if (hpFill) hpFill.style.width = `${Math.max(0, (unit.currentHp / unit.maxHp) * 100)}%`;
      if (ctFill) ctFill.style.width = `${Math.min(100, unit.ct)}%`;
    }
  }

  private animateUnits(now: number): void {
    const time = now * 0.0035;

    for (const unit of this.currentUnits) {
      if (unit.isDead) continue;
      const spriteMesh = this.unitSpritePlanes.get(unit.id);
      if (!spriteMesh) continue;

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
      const mat = spriteMesh.material as THREE.MeshBasicMaterial;
      if (mat.map !== tex) {
        mat.map = tex;
        mat.needsUpdate = true;
      }

      spriteMesh.rotation.y = this.currentRotationAngle;

      // Update Overhead Mini HP Bar in 3D projection
      this.updateOverheadHpBarPosition(unit.id, spriteMesh.position);
    }
  }

  private updateOverheadHpBarPosition(unitId: string, worldPos: THREE.Vector3): void {
    const barEl = this.overheadHpElements.get(unitId);
    if (!barEl) return;

    // Project 3D pos to screen with pooled vector
    this.tempScreenPos.set(worldPos.x, worldPos.y + 0.72, worldPos.z);
    this.tempScreenPos.project(this.camera);

    const x = ((this.tempScreenPos.x + 1) * window.innerWidth) / 2;
    const y = ((-this.tempScreenPos.y + 1) * window.innerHeight) / 2;

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
    const mat = color === 0xef4444 ? this.attackHighlightMat : this.moveHighlightMat;

    for (const t of tiles) {
      const height = this.grid.getHeight(t.x, t.z);
      const mesh = new THREE.Mesh(this.sharedHighlightGeom, mat);
      mesh.position.set(t.x, height + 0.02, t.z);
      this.highlightGroup.add(mesh);
    }
  }

  public clearHighlights(): void {
    while (this.highlightGroup.children.length > 0) {
      this.highlightGroup.remove(this.highlightGroup.children[0]);
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
    // Fit the zoom to the shorter screen side so portrait phones see as much map as landscape
    const halfW = aspect >= 1 ? this.zoomLevel * aspect : this.zoomLevel;
    const halfH = aspect >= 1 ? this.zoomLevel : this.zoomLevel / aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  private onPointerMove(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.tileMeshList);

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

    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ft.lifetime++;

      ft.position.y += 0.018;

      this.tempScreenPos.copy(ft.position);
      this.tempScreenPos.project(this.camera);

      const x = ((this.tempScreenPos.x + 1) * window.innerWidth) / 2;
      const y = ((-this.tempScreenPos.y + 1) * window.innerHeight) / 2;

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
    this.animateUnits(now);
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
