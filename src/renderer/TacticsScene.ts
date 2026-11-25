import * as THREE from 'three';
import { BENEFICIAL_STATUSES } from '../core/CombatEngine';
import { TileData, Unit, FacingDirection, TerrainType } from '../core/types';
import { BattleGrid } from '../core/Grid';
import {
  createGrassTopTexture,
  createDirtSideTexture,
  createStoneTexture,
  createWaterTexture,
  createCastleParapetTexture,
  createSwampTexture, createSandTexture, createSnowTexture,
  createUnitSpriteTexture
} from '../graphics/PixelTextures';
import { VFXManager } from './VFXManager';
import { PixelEffects, FxActor, actorFromSprite } from './PixelEffects';
import { drawSprite } from '../graphics/CharacterArt';
import type { SpriteFrame } from '../graphics/CharacterArt';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createTileMaterials, buildMergedTerrain, sharedTime } from './TileShading';
import { Decorations } from './Decorations';
import { presetFor, createSkyTexture, AtmospherePreset } from './Atmosphere';
import { QualityProfile, resolveQuality } from './GraphicsQuality';

export interface FloatingText {
  element: HTMLElement;
  position: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
}

/** A walk along tiles: one segment per step, with a hop where the height changes. */
interface Walk {
  pts: { x: number; z: number; h: number }[];
  seg: number;
  t: number;
}
/** Frames per walked tile (60 fps), plus extra for a climb or drop. */
const STEP_FRAMES = 9;
const HOP_FRAMES = 4;
const segFrames = (a: { h: number }, b: { h: number }) => STEP_FRAMES + (Math.abs(a.h - b.h) > 0.3 ? HOP_FRAMES : 0);

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
  /** Pixel-art spell and hit effects (pixelfx). */
  public pfx: PixelEffects;

  // Grid & Map
  public grid: BattleGrid;
  /** Merged terrain meshes (one per material); also the raycast targets for tile picking. */
  private tileMeshList: THREE.Mesh[] = [];

  // Unit meshes & sprites
  public currentUnits: Unit[] = [];
  private unitSpritePlanes: Map<string, THREE.Mesh> = new Map();
  private unitTweens: Map<string, UnitTween> = new Map();
  /** Walk animation between tiles: last tile each unit stood on, and the walk in progress. */
  private lastTiles: Map<string, { x: number; z: number; h: number }> = new Map();
  private walks: Map<string, Walk> = new Map();
  /** How many animation frames a walk advances per rendered frame (2 on the Fast battle speed). */
  public walkSpeed = 1;
  /** Paths queued by the game just before it moves a unit (consumed when the tile change is seen). */
  private queuedPaths: Map<string, { x: number; z: number }[]> = new Map();
  private overheadHpElements: Map<string, HTMLElement> = new Map();
  /** Markers where the player's fallen units lie, so they can be found and raised. */
  private fallenMarkers: Map<string, HTMLElement> = new Map();

  // Highlight overlays (pooled)
  private highlightGroup: THREE.Group = new THREE.Group();
  /** Tiles a grand summon will land on (0.24.0): pulsing, in the caster's team colour. */
  private callGroup: THREE.Group = new THREE.Group();
  private callMats: THREE.ShaderMaterial[] = [];
  /** A full-screen shade drawn over the board (not the units or effects) while a summon plays. */
  private dimQuad!: THREE.Mesh;
  private dimTarget = 0;
  private cursorMesh: THREE.Group;
  private sharedHighlightGeom = new THREE.PlaneGeometry(0.95, 0.95);

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
  private sandTex = createSandTexture();
  private snowTex = createSnowTexture();

  // Shared Tile Materials (Avoid instantiating hundreds of material instances)

  // Lighting
  private hemiLight!: THREE.HemisphereLight;
  private tileMats!: ReturnType<typeof createTileMaterials>;
  private decorations = new Decorations();
  private quality: QualityProfile = resolveQuality();
  private atmosphere!: AtmospherePreset;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private torches: { light: THREE.PointLight; flame: THREE.Mesh; base: number; seed: number }[] = [];
  private flameTex = this.createFlameTexture();
  private unitBlobs = new Map<string, THREE.Mesh>();
  private blobGeom = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
  private blobMat = new THREE.MeshBasicMaterial({ map: this.createBlobTexture(), transparent: true, depthWrite: false });
  private activeRing!: THREE.Mesh;
  private activeUnitId: string | null = null;
  private highlightMats = new Map<number, THREE.ShaderMaterial>();
  private sunLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;

  // Interaction
  public hoveredTile: { x: number; z: number } | null = null;
  /**
   * When set and `wants()` is true, a one-pointer drag paints tiles (Workshop brushes) instead of
   * panning: begin() once, over() for each tile the pointer enters, end() on release.
   */
  public dragPaint?: { wants(): boolean; begin(x: number, z: number): void; over(x: number, z: number): void; end(): void };
  private painting: { id: number; last: string } | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Floating Combat Text & Overlays (reusable screen vector)
  private floatingTexts: FloatingText[] = [];
  private floatingTextContainer: HTMLElement;
  /** Unit HP bars and fallen markers: under the HUD panels, so they never show through a menu (0.20.0). */
  private unitTagContainer: HTMLElement;
  private lastRenderTime: number = performance.now();
  private tempScreenPos: THREE.Vector3 = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, grid: BattleGrid) {
    this.canvas = canvas;
    this.grid = grid;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality.level !== 'low',
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17);

    // VFX Manager
    this.vfx = new VFXManager(this.scene);

    // Floating text container overlay
    this.floatingTextContainer = document.createElement('div');
    this.floatingTextContainer.className = 'floating-combat-overlay';
    document.getElementById('game-container')?.appendChild(this.floatingTextContainer);
    this.unitTagContainer = document.createElement('div');
    this.unitTagContainer.className = 'floating-combat-overlay unit-tags-overlay';
    document.getElementById('game-container')?.appendChild(this.unitTagContainer);

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
    this.pfx = new PixelEffects(this.scene, this.camera);

    this.setupLighting();
    this.buildMap();

    this.scene.add(this.highlightGroup);
    this.scene.add(this.callGroup);
    this.dimQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { amount: { value: 0 } },
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform float amount; void main() { gl_FragColor = vec4(0.02, 0.01, 0.06, amount); }',
        transparent: true, depthTest: false, depthWrite: false
      })
    );
    this.dimQuad.renderOrder = 8;
    this.dimQuad.frustumCulled = false;
    this.dimQuad.visible = false;
    this.dimQuad.userData.noPick = true;
    this.scene.add(this.dimQuad);
    this.cursorMesh = this.buildCursor();
    this.scene.add(this.cursorMesh);

    this.setupInteractions();
    this.updateCameraPosition();
  }

  private initTileMaterials(): void {
    this.tileMats = createTileMaterials({
      grass: this.grassTopTex,
      dirt: this.dirtSideTex,
      stone: this.stoneTex,
      parapet: this.parapetTex,
      water: this.waterTex,
      swamp: this.swampTex,
      sand: this.sandTex,
      snow: this.snowTex
    });
  }

  private setupLighting(): void {
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 2);
    this.sunLight.castShadow = this.quality.shadows;
    this.sunLight.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
    this.sunLight.shadow.normalBias = 0.03;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.radius = 3;
    this.sunLight.shadow.intensity = 0.75;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.fillLight = new THREE.DirectionalLight(0x60a5fa, 0.45);
    this.scene.add(this.fillLight);

    this.scene.add(this.decorations.group);

    this.activeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.44, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xf4c430, transparent: true, opacity: 0.85, depthWrite: false })
    );
    this.activeRing.renderOrder = 5;
    this.activeRing.visible = false;
    this.scene.add(this.activeRing);

    this.applyAtmosphere();
    this.setupPostProcessing();
  }

  /** Lights, sky, fog, shadow frustum and torches for the current map. */
  private applyAtmosphere(): void {
    const md = this.grid.mapData;
    const p = presetFor(md.look || md.id, md.theme);
    this.atmosphere = p;

    const oldSky = this.scene.background as THREE.Texture | null;
    if (oldSky && (oldSky as THREE.Texture).isTexture) oldSky.dispose();
    this.scene.background = createSkyTexture(p);
    // Push the fog back on bigger maps so the far edge stays readable
    const extra = Math.max(0, Math.hypot(md.width, md.depth) / 2 - 8);
    this.scene.fog = new THREE.Fog(p.fog, p.fogNear + extra, p.fogFar + extra * 1.5);
    this.renderer.toneMappingExposure = p.exposure;

    this.hemiLight.color.setHex(p.hemiSky);
    this.hemiLight.groundColor.setHex(p.hemiGround);
    this.hemiLight.intensity = p.hemiIntensity;

    // Fit the sun and its shadow camera around the whole map
    const cx = (md.width - 1) / 2;
    const cz = (md.depth - 1) / 2;
    const radius = Math.hypot(md.width, md.depth) / 2 + 2;
    this.sunLight.color.setHex(p.sunColor);
    this.sunLight.intensity = p.sunIntensity;
    this.sunLight.position.set(cx + p.sunDir[0], p.sunDir[1], cz + p.sunDir[2]);
    this.sunLight.target.position.set(cx, 0, cz);
    const sc = this.sunLight.shadow.camera;
    sc.left = -radius;
    sc.right = radius;
    sc.top = radius;
    sc.bottom = -radius;
    sc.near = 1;
    sc.far = Math.hypot(...p.sunDir) + radius * 2;
    sc.updateProjectionMatrix();

    this.fillLight.color.setHex(p.rimColor);
    this.fillLight.intensity = p.rimIntensity;
    this.fillLight.position.set(cx - p.sunDir[0], 18, cz - p.sunDir[2]);

    if (this.bloomPass) this.bloomPass.strength = p.bloom;
    this.placeTorches();
  }

  /** Night maps get flickering torches on the highest edge stone/parapet tiles; the summit gets an altar glow. */
  private placeTorches(): void {
    for (const t of this.torches) {
      this.scene.remove(t.light);
      this.scene.remove(t.flame);
      t.light.dispose();
    }
    this.torches = [];
    const md = this.grid.mapData;
    if (!this.quality.torches || (md.theme !== 'night' && md.id !== 'zodiac_summit')) return;

    const candidates = md.tiles
      .filter((t) => (t.terrain === 'parapet' || t.terrain === 'stone') && t.walkable)
      .sort((a, b) => b.height - a.height || (a.x + a.z) - (b.x + b.z));
    const picked: TileData[] = [];
    for (const t of candidates) {
      if (picked.every((p) => Math.abs(p.x - t.x) + Math.abs(p.z - t.z) >= 5)) picked.push(t);
      if (picked.length >= 4) break;
    }
    const flameMat = new THREE.MeshBasicMaterial({ map: this.flameTex, color: this.atmosphere.torchColor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    picked.forEach((t, i) => {
      const y = Math.max(0.2, t.height);
      const light = new THREE.PointLight(this.atmosphere.torchColor, 9, 6.5, 1.5);
      light.position.set(t.x + 0.38, y + 0.9, t.z + 0.38);
      const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8), flameMat);
      flame.position.set(t.x + 0.38, y + 0.45, t.z + 0.38);
      flame.renderOrder = 12;
      flame.raycast = () => undefined;
      this.scene.add(light);
      this.scene.add(flame);
      this.torches.push({ light, flame, base: 9, seed: i * 1.7 });
    });
  }

  private createFlameTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 24;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(8, 17, 1, 8, 15, 10);
    g.addColorStop(0, 'rgba(255,255,220,1)');
    g.addColorStop(0.35, 'rgba(255,200,90,0.9)');
    g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(8, 1);
    ctx.quadraticCurveTo(15, 14, 8, 23);
    ctx.quadraticCurveTo(1, 14, 8, 1);
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createBlobTexture(): THREE.CanvasTexture {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Bloom + vignette on High; plain rendering otherwise. */
  private setupPostProcessing(): void {
    this.composer?.dispose();
    this.composer = null;
    this.bloomPass = null;
    if (!this.quality.bloom) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.quality.msaa });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.setSize(w, h);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), this.atmosphere?.bloom ?? 0.5, 0.45, 0.82);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(
      new ShaderPass({
        uniforms: { tDiffuse: { value: null }, uStrength: { value: 0.32 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform sampler2D tDiffuse; uniform float uStrength; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * uStrength * 2.2; gl_FragColor = vec4(c.rgb * clamp(v, 0.0, 1.0), c.a); }'
      })
    );
    this.composer.addPass(new OutputPass());
  }

  /** Switches graphics quality live (Menu → Graphics). */
  public setQuality(profile: QualityProfile): void {
    this.quality = profile;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = profile.shadows;
    this.sunLight.castShadow = profile.shadows;
    this.sunLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    this.sunLight.shadow.map?.dispose();
    this.sunLight.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    // Materials must recompile when shadow support changes
    this.scene.traverse((o) => {
      const mats = (o as THREE.Mesh).material;
      if (!mats) return;
      for (const m of Array.isArray(mats) ? mats : [mats]) m.needsUpdate = true;
    });
    this.setupPostProcessing();
    this.placeTorches();
    this.decorations.rebuild(this.grid.mapData, profile.decorationDensity, this.grid.mapData.theme);
  }

  public get qualityLevel(): string {
    return this.quality.level;
  }

  /** Gold ring under the unit whose turn it is. */
  public setActiveUnit(id: string | null): void {
    this.activeUnitId = id;
  }

  public loadMap(newGrid: BattleGrid): void {
    this.grid = newGrid;

    this.disposeTerrain();
    this.clearHighlights();

    this.applyAtmosphere();
    this.vfx.setWeatherTheme(newGrid.mapData.theme);
    this.lastTiles.clear();
    this.walks.clear();
    this.queuedPaths.clear();
    this.pfx.clear();
    this.setCallMarkers([]);
    this.dim(0);
    this.buildMap();
    const md = newGrid.mapData;
    this.targetCameraTarget.set((md.width - 1) / 2, 1, (md.depth - 1) / 2);
    // Bigger maps start a little further out
    this.targetZoomLevel = Math.min(this.maxZoomLevel, Math.max(8.5, Math.max(md.width, md.depth) * 0.62));
  }

  public updateTile(x: number, z: number, newHeight: number, newTerrain: TerrainType, walkable: boolean): void {
    const tile = this.grid.getTile(x, z);
    if (!tile) return;

    tile.height = Math.max(0, Math.min(6.0, Math.round(newHeight * 10) / 10));
    tile.terrain = newTerrain;
    tile.walkable = walkable;

    this.disposeTerrain();
    this.buildTerrainMeshes();
    this.decorations.rebuild(this.grid.mapData, this.quality.decorationDensity, this.grid.mapData.theme);

    this.setCursor(x, z);
  }

  /** Rebuilds terrain and props after several tiles were changed directly on the grid. */
  public refreshTerrain(): void {
    this.disposeTerrain();
    this.buildTerrainMeshes();
    this.decorations.rebuild(this.grid.mapData, this.quality.decorationDensity, this.grid.mapData.theme);
    if (this.hoveredTile) this.setCursor(this.hoveredTile.x, this.hoveredTile.z);
  }

  private buildMap(): void {
    this.buildTerrainMeshes();
    this.decorations.rebuild(this.grid.mapData, this.quality.decorationDensity, this.grid.mapData.theme);
  }

  private buildTerrainMeshes(): void {
    this.tileMeshList = buildMergedTerrain(this.grid.mapData.tiles, this.tileMats);
    for (const m of this.tileMeshList) this.scene.add(m);
  }

  private disposeTerrain(): void {
    for (const m of this.tileMeshList) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.tileMeshList = [];
  }

  /** Converts a raycast hit on the merged terrain into the tile column that was hit. */
  private tileFromHit(hit: THREE.Intersection | undefined): TileData | undefined {
    if (!hit || !hit.face) return undefined;
    // Step slightly into the surface so hits on side faces land inside the right column
    const p = hit.point.clone().addScaledVector(hit.face.normal, -0.02);
    return this.grid.getTile(Math.round(p.x), Math.round(p.z));
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
    const tile = this.tileFromHit(this.raycaster.intersectObjects(this.tileMeshList)[0]);
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
        // A second finger turns a stroke into a camera gesture (what was painted stays)
        if (this.painting) {
          this.painting = null;
          this.dragPaint?.end();
        }
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

      // Workshop brush strokes: a one-pointer drag paints the tiles it crosses
      if (this.painting?.id === e.pointerId) {
        const t = this.pickTile(e.clientX, e.clientY);
        if (t && `${t.x},${t.z}` !== this.painting.last) {
          this.painting.last = `${t.x},${t.z}`;
          this.setCursor(t.x, t.z);
          this.dragPaint!.over(t.x, t.z);
        }
        return;
      }
      if (p.moved && !this.isPanning && !this.multiTouchGesture && this.pointers.size === 1 && !p.cancel && this.dragPaint?.wants()) {
        const start = this.pickTile(p.sx, p.sy);
        if (start) {
          this.painting = { id: e.pointerId, last: `${start.x},${start.z}` };
          this.dragPaint.begin(start.x, start.z);
          const t = this.pickTile(e.clientX, e.clientY);
          if (t && `${t.x},${t.z}` !== this.painting.last) {
            this.painting.last = `${t.x},${t.z}`;
            this.dragPaint.over(t.x, t.z);
          }
          return;
        }
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
      if (this.painting?.id === e.pointerId) {
        this.painting = null;
        this.dragPaint?.end();
        return;
      }

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
    for (const [id, blob] of this.unitBlobs) {
      if (!liveIds.has(id)) {
        this.scene.remove(blob);
        this.unitBlobs.delete(id);
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
        const deadBlob = this.unitBlobs.get(unit.id);
        if (deadBlob) {
          this.scene.remove(deadBlob);
          this.unitBlobs.delete(unit.id);
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

        const blob = new THREE.Mesh(this.blobGeom, this.blobMat);
        blob.renderOrder = 4;
        blob.raycast = () => undefined;
        this.scene.add(blob);
        this.unitBlobs.set(unit.id, blob);
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
        this.unitTagContainer.appendChild(barEl);
        this.overheadHpElements.set(unit.id, barEl);
      }

      // A tamed monster changes sides mid-battle (0.28.0)
      barEl.classList.toggle('player', unit.team === 'player');
      barEl.classList.toggle('enemy', unit.team === 'enemy');
      barEl.classList.toggle('boss', !!unit.isBoss);
      barEl.classList.toggle('enraged', !!unit.isEnraged);

      const hpFill = barEl.querySelector('.overhead-hp-fill') as HTMLElement;
      const ctFill = barEl.querySelector('.overhead-ct-fill') as HTMLElement;
      if (hpFill) hpFill.style.width = `${Math.max(0, (unit.currentHp / unit.maxHp) * 100)}%`;
      if (ctFill) ctFill.style.width = `${Math.min(100, unit.ct)}%`;

      // Status pips above the bar: round = buff, square = ailment, coloured like the unit card's badges
      const key = unit.statuses.map((st) => st.type).join(',');
      if (barEl.dataset.st !== key) {
        barEl.dataset.st = key;
        barEl.querySelector('.overhead-status')?.remove();
        if (key) {
          const row = document.createElement('div');
          row.className = 'overhead-status';
          for (const st of unit.statuses.slice(0, 6)) {
            const pip = document.createElement('i');
            pip.className = `status-${st.type} ${BENEFICIAL_STATUSES.includes(st.type) ? 'buff' : 'ailment'}`;
            row.appendChild(pip);
          }
          barEl.appendChild(row);
        }
      }
    }
  }

  /** Keeps a small marker over each fallen player unit (a Phoenix Feather needs to know where they lie). */
  private updateFallenMarkers(): void {
    const fallen = new Set<string>();
    for (const unit of this.currentUnits) {
      if (!unit.isDead || unit.team !== 'player') continue;
      fallen.add(unit.id);
      let el = this.fallenMarkers.get(unit.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'unit-fallen-marker';
        el.textContent = `✝ ${unit.name}`;
        this.unitTagContainer.appendChild(el);
        this.fallenMarkers.set(unit.id, el);
      }
      this.tempScreenPos.set(unit.x, this.grid.getHeight(unit.x, unit.z) + 0.45, unit.z);
      this.tempScreenPos.project(this.camera);
      const x = ((this.tempScreenPos.x + 1) * window.innerWidth) / 2;
      const y = ((-this.tempScreenPos.y + 1) * window.innerHeight) / 2;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
    for (const [id, el] of this.fallenMarkers) {
      if (!fallen.has(id)) {
        el.remove();
        this.fallenMarkers.delete(id);
      }
    }
  }

  private animateUnits(now: number): void {
    const time = now * 0.0035;
    this.activeRing.visible = false;
    this.updateFallenMarkers();

    for (const unit of this.currentUnits) {
      if (unit.isDead) continue;
      const spriteMesh = this.unitSpritePlanes.get(unit.id);
      if (!spriteMesh) continue;

      let height = this.grid.getHeight(unit.x, unit.z);
      const bob = Math.sin(time + unit.x * 2 + unit.z) * 0.035;

      // Start a walk when the unit's tile changed since the last frame
      const last = this.lastTiles.get(unit.id);
      if (last && (last.x !== unit.x || last.z !== unit.z)) {
        const queued = this.queuedPaths.get(unit.id);
        this.queuedPaths.delete(unit.id);
        const fits = queued && queued.length > 1 && queued[0].x === last.x && queued[0].z === last.z
          && queued[queued.length - 1].x === unit.x && queued[queued.length - 1].z === unit.z;
        const dist = Math.abs(last.x - unit.x) + Math.abs(last.z - unit.z);
        const pts = fits
          ? queued!.map((q) => ({ x: q.x, z: q.z, h: this.grid.getHeight(q.x, q.z) }))
          : dist <= 12 ? [{ x: last.x, z: last.z, h: last.h }, { x: unit.x, z: unit.z, h: height }] : null;
        if (pts) this.walks.set(unit.id, { pts, seg: 0, t: 0 });
      }
      this.lastTiles.set(unit.id, { x: unit.x, z: unit.z, h: height });
      const walk = this.walks.get(unit.id);
      let walkX = 0, walkZ = 0;
      let walkFacing: FacingDirection | null = null;
      if (walk) {
        let a = walk.pts[walk.seg], b = walk.pts[walk.seg + 1];
        walk.t += this.walkSpeed;
        if (walk.t > segFrames(a, b) && walk.seg < walk.pts.length - 2) {
          walk.seg++;
          walk.t = 1;
          a = walk.pts[walk.seg];
          b = walk.pts[walk.seg + 1];
        }
        const p = Math.min(1, walk.t / segFrames(a, b));
        walkX = a.x + (b.x - a.x) * p - unit.x;
        walkZ = a.z + (b.z - a.z) * p - unit.z;
        // Climb or drop smoothly, with a little hop over height changes
        height = a.h + (b.h - a.h) * p + Math.sin(p * Math.PI) * Math.min(0.6, 0.06 + Math.abs(b.h - a.h) * 0.3);
        walkFacing = b.x > a.x ? 'E' : b.x < a.x ? 'W' : b.z > a.z ? 'S' : 'N';
        if (p >= 1 && walk.seg >= walk.pts.length - 2) this.walks.delete(unit.id);
      }

      // Handle Lunge / Recoil Tweens
      let offsetX = walkX;
      let offsetZ = walkZ;
      const tween = this.unitTweens.get(unit.id);
      if (tween) {
        tween.progress++;
        const p = tween.progress / tween.maxProgress;
        if (tween.type === 'lunge') {
          const lungeDist = Math.sin(p * Math.PI) * 0.45;
          offsetX += tween.dirX * lungeDist;
          offsetZ += tween.dirZ * lungeDist;
        } else if (tween.type === 'recoil') {
          const recoilDist = Math.sin(p * Math.PI) * 0.25;
          offsetX += -tween.dirX * recoilDist;
          offsetZ += -tween.dirZ * recoilDist;
        }

        if (tween.progress >= tween.maxProgress) {
          this.unitTweens.delete(unit.id);
        }
      }

      spriteMesh.position.set(unit.x + offsetX, height + 0.68 + bob, unit.z + offsetZ);

      // Contact shadow shrinks slightly as the sprite bobs up
      const blob = this.unitBlobs.get(unit.id);
      if (blob) {
        blob.position.set(unit.x + offsetX, height + 0.015, unit.z + offsetZ);
        const k = 1 - bob * 2;
        blob.scale.set(k, 1, k);
      }
      if (unit.id === this.activeUnitId) {
        this.activeRing.visible = true;
        this.activeRing.position.set(unit.x + offsetX, height + 0.02, unit.z + offsetZ);
        (this.activeRing.material as THREE.MeshBasicMaterial).color.setHex(unit.team === 'player' ? 0xf4c430 : 0xef4444);
      }

      const relativeFacing = this.calculateRelativeFacing(walkFacing || unit.facing);
      const isEnemy = unit.team === 'enemy';
      // Animation frame: strike while lunging, flinch on recoil, stride while walking, else breathe
      const frame: SpriteFrame = tween?.type === 'lunge' ? 'attack'
        : tween?.type === 'recoil' ? 'hurt'
        : walk ? (Math.floor(walk.t / 6) % 2 ? 'walk1' : 'walk0')
        : Math.floor(now / 520 + unit.x * 0.7 + unit.z * 0.3) % 2 ? 'idle1' : 'idle0';
      const tex = createUnitSpriteTexture(unit.jobId, relativeFacing, isEnemy, frame);
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

  /** Glowing, gently pulsing highlight material (bright rim, soft fill) per color. */
  private highlightMaterial(color: number): THREE.ShaderMaterial {
    let mat = this.highlightMats.get(color);
    if (!mat) {
      mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uTime: sharedTime },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
          void main(){
            float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
            float rim = 1.0 - smoothstep(0.0, 0.09, e);
            float pulse = 0.5 + 0.5 * sin(uTime * 3.2);
            float a = 0.22 + 0.12 * pulse + rim * 0.65;
            gl_FragColor = vec4(uColor * (1.0 + rim * 0.9), a);
          }`,
        transparent: true,
        depthWrite: false
      });
      this.highlightMats.set(color, mat);
    }
    return mat;
  }

  private savedView: { zoom: number; target: THREE.Vector3 } | null = null;

  /**
   * Brings the camera in on a summon (0.24.0): centred a little above the tile so the creature
   * fits, and never further out than it already was. restoreView() puts it back.
   */
  public summonView(x: number, height: number, z: number, zoom: number): void {
    if (!this.savedView) this.savedView = { zoom: this.targetZoomLevel, target: this.targetCameraTarget.clone() };
    this.targetCameraTarget.set(x, height + 1.8, z);
    this.targetZoomLevel = Math.max(this.minZoomLevel, Math.min(this.targetZoomLevel, zoom));
  }

  public restoreView(): void {
    if (!this.savedView) return;
    this.targetZoomLevel = this.savedView.zoom;
    this.targetCameraTarget.copy(this.savedView.target);
    this.savedView = null;
  }

  /** Darkens the board behind the units and effects (amount 0..1), easing in and out. */
  public dim(amount: number): void {
    this.dimTarget = amount;
  }

  /**
   * Marks the tiles each grand summon will land on (0.24.0). Pass every call still on its way;
   * an empty list clears them.
   */
  public setCallMarkers(calls: { tiles: { x: number; z: number }[]; color: number }[]): void {
    while (this.callGroup.children.length) this.callGroup.remove(this.callGroup.children[0]);
    for (const m of this.callMats) m.dispose();
    this.callMats = [];
    for (const call of calls) {
      // A bright rim and stripes sliding across: unlike a move or target highlight at a glance
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(call.color) }, uTime: sharedTime },
        vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec2 vUv; varying vec3 vW;
          void main(){
            float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
            float rim = 1.0 - smoothstep(0.0, 0.1, e);
            float stripe = step(0.5, fract((vW.x + vW.z) * 2.5 - uTime * 0.8));
            float pulse = 0.5 + 0.5 * sin(uTime * 5.0);
            float a = 0.18 + stripe * (0.2 + 0.15 * pulse) + rim * 0.75;
            gl_FragColor = vec4(uColor * (1.0 + rim * 0.8 + stripe * 0.3), a);
          }`,
        transparent: true,
        depthWrite: false
      });
      this.callMats.push(mat);
      for (const t of call.tiles) {
        if (!this.grid.getTile(t.x, t.z)) continue;
        const mesh = new THREE.Mesh(this.sharedHighlightGeom, mat);
        mesh.position.set(t.x, this.grid.getHeight(t.x, t.z) + 0.03, t.z);
        mesh.renderOrder = 8.5; // above the summon dim, so the danger stays readable
        mesh.userData.noPick = true;
        this.callGroup.add(mesh);
      }
    }
  }

  private updateSummonLayers(delta: number): void {
    const u = (this.dimQuad.material as THREE.ShaderMaterial).uniforms.amount;
    u.value += (this.dimTarget - u.value) * Math.min(1, delta * 6);
    this.dimQuad.visible = u.value > 0.01;
  }

  public setHighlights(tiles: { x: number; z: number }[], color: number = 0x3b82f6): void {
    this.clearHighlights();
    const mat = this.highlightMaterial(color === 0xdc2626 ? 0xef4444 : color);

    for (const t of tiles) {
      const height = this.grid.getHeight(t.x, t.z);
      const mesh = new THREE.Mesh(this.sharedHighlightGeom, mat);
      mesh.position.set(t.x, height + 0.02, t.z);
      this.highlightGroup.add(mesh);
    }
  }

  /** The unit as it looks on screen right now, as an effect actor (for heals, poison, haste...). */
  public fxActorFor(unit: Unit): FxActor {
    const view = this.calculateRelativeFacing(unit.facing);
    const team = unit.team === 'enemy';
    return actorFromSprite(`${unit.jobId}|${view}|${team}`, drawSprite(unit.jobId, view, team, 'idle0'));
  }

  /**
   * Call just before changing a unit's tile: it will walk this path (start and end included)
   * instead of sliding straight there. Returns how long the walk takes, in milliseconds.
   */
  public walkPath(unitId: string, path: { x: number; z: number }[] | null): number {
    if (!path || path.length < 2) return 0;
    this.queuedPaths.set(unitId, path);
    let frames = 0;
    for (let i = 1; i < path.length; i++) {
      frames += segFrames({ h: this.grid.getHeight(path[i - 1].x, path[i - 1].z) }, { h: this.grid.getHeight(path[i].x, path[i].z) });
    }
    return ((frames / 60) * 1000) / this.walkSpeed;
  }

  /** Stops a unit's walk where it stands (the next updateUnits snaps it to its tile). Used when a move is undone. */
  public cancelWalk(unitId: string): void {
    this.queuedPaths.delete(unitId);
    this.walks.delete(unitId);
    this.lastTiles.delete(unitId);
  }

  /** Adds highlighted tiles without clearing the existing ones (Workshop markers). */
  public addHighlights(tiles: { x: number; z: number }[], color: number): void {
    const mat = this.highlightMaterial(color);
    for (const t of tiles) {
      const mesh = new THREE.Mesh(this.sharedHighlightGeom, mat);
      mesh.position.set(t.x, this.grid.getHeight(t.x, t.z) + 0.02, t.z);
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
    // Keep the map centred in the part of the screen a side panel or bottom sheet leaves free
    const sx = halfW * (this.screenInset.left / window.innerWidth);
    const sy = halfH * (this.screenInset.bottom / window.innerHeight);
    this.camera.left = -halfW - sx;
    this.camera.right = halfW - sx;
    this.camera.top = halfH - sy;
    this.camera.bottom = -halfH - sy;
    this.camera.updateProjectionMatrix();
  }

  private screenInset = { left: 0, bottom: 0 };

  /** Pixels covered by a panel on the left or a sheet at the bottom (the Workshop). */
  public setScreenInset(left: number, bottom: number): void {
    this.screenInset = { left: Math.max(0, left), bottom: Math.max(0, bottom) };
    this.updateCameraFrustum();
  }

  private onPointerMove(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.tileMeshList);

    const tileData = this.tileFromHit(intersects[0]);
    if (tileData) this.setCursor(tileData.x, tileData.z);
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
    this.composer?.setSize(window.innerWidth, window.innerHeight);
  }

  public render(): void {
    const now = performance.now();
    const delta = Math.min(0.1, (now - this.lastRenderTime) / 1000);
    this.lastRenderTime = now;

    this.updateCameraPosition();
    this.animateUnits(now);
    this.updateFloatingNumbers();
    this.vfx.update(delta);
    this.pfx.facing = this.currentRotationAngle;
    this.pfx.aspect = this.renderer.domElement.clientWidth / Math.max(1, this.renderer.domElement.clientHeight);
    this.pfx.update(delta);
    this.updateSummonLayers(delta);

    // Shared clock for water, swamp, grass sway and highlights
    sharedTime.value = now / 1000;

    // Torch flicker
    for (const t of this.torches) {
      const f = Math.sin(now * 0.017 + t.seed) * 0.5 + Math.sin(now * 0.041 + t.seed * 3) * 0.3;
      t.light.intensity = t.base * (0.85 + f * 0.15);
      t.flame.scale.set(1 + f * 0.06, 1 + f * 0.12, 1);
      t.flame.rotation.y = this.currentRotationAngle; // billboard, like unit sprites
    }

    // Active-unit ring breathes
    const ringPulse = 1 + Math.sin(now * 0.004) * 0.08;
    this.activeRing.scale.set(ringPulse, 1, ringPulse);

    // Pulse cursor
    const cursorTime = now * 0.005;
    const scale = 1 + Math.sin(cursorTime) * 0.06;
    this.cursorMesh.scale.set(scale, 1, scale);

    if (this.composer) this.composer.render(delta);
    else this.renderer.render(this.scene, this.camera);
  }
}
