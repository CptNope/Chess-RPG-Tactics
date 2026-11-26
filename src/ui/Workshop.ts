/**
 * The Workshop: a map and scenario editor that runs on top of the live 3D battlefield.
 *
 * Tabs: Terrain (sculpt and paint), Units (squad deploy tiles and enemies), Story (title and
 * dialogue), Rules (objective, look, rewards), File (library, new, import/export, share) and
 * Chains (scenarios strung into a mini campaign, 0.42.0).
 * Every control is a real button or field, so it works with mouse, touch, pen, keyboard
 * (Tab / arrows / Enter) and a controller (d-pad + A, B backs out to the map, X jumps back in).
 * Steppers (◀ value ▶) replace number inputs and dropdowns so nothing needs a text cursor.
 */
import { BattleGrid } from '../core/Grid';
import { JobSystem } from '../core/JobSystem';
import { CampaignChapter, DialogueLine, EnemySpawn, FacingDirection, TerrainType, Unit } from '../core/types';
import { JOBS } from '../data/jobs';
import { ITEMS } from '../data/items';
import { MAPS } from '../data/maps';
import type { TacticsScene } from '../renderer/TacticsScene';
import { SoundFX } from '../audio/SoundEffects';
import { focusVisible, focusablesIn } from '../input/FocusNav';
import { portraitDataUrl, portraitIds, portraitForSpeaker } from '../graphics/CharacterArt';
import {
  Scenario, TERRAINS, LOOKS, NAMED_PORTRAITS, MAX_ENEMIES, MAX_SPAWNS, MAX_HEIGHT, MIN_SIZE, MAX_SIZE, MAX_LINES,
  blankScenario, scenarioFromMap, scenarioFromChapter, validateScenario, Library, parseScenario, encodeShare
} from '../core/Scenario';
import {
  Chain, ChainLibrary, ChainProgress, MAX_CHAIN, addBattle, blankChain, encodeChainShare, isChainLike, moveBattle,
  refreshFromLibrary, removeBattle, sanitizeChain, validateChain, packChain
} from '../core/Chain';

export interface WorkshopHost {
  scene: TacticsScene;
  banner(text: string): void;
  /** The squad's jobs, shown standing on the deploy tiles. */
  squad(): { name: string; jobId: string }[];
  chapters(): CampaignChapter[];
  currentChapter(): CampaignChapter;
  play(s: Scenario): void;
  /** Plays a chain from battle `index` (0.42.0). */
  playChain(c: Chain, index: number): void;
  closed(): void;
}

type Tab = 'terrain' | 'units' | 'story' | 'rules' | 'file' | 'chains';
type Tool = 'raise' | 'lower' | 'level' | 'paint' | 'block' | 'fill' | 'spawn' | 'enemy' | 'erase';

const TOOL_INFO: Record<Tool, { label: string; icon: string; hint: string }> = {
  raise: { label: 'Raise', icon: '▲', hint: 'Raise tiles by half a step.' },
  lower: { label: 'Lower', icon: '▼', hint: 'Lower tiles by half a step.' },
  level: { label: 'Level', icon: '═', hint: 'Set tiles to the chosen height.' },
  paint: { label: 'Paint', icon: '🖌', hint: 'Paint the chosen terrain.' },
  block: { label: 'Block', icon: '⛔', hint: 'Toggle whether units can stand here.' },
  fill: { label: 'Fill', icon: '🪣', hint: 'Repaint a whole connected area of the same terrain and height.' },
  spawn: { label: 'Squad', icon: '🛡', hint: `Toggle a squad deploy tile (up to ${MAX_SPAWNS}, in squad order).` },
  enemy: { label: 'Enemy', icon: '☠', hint: 'Place an enemy, or tap one to select and edit it.' },
  erase: { label: 'Erase', icon: '✕', hint: 'Remove an enemy or deploy tile.' }
};

/** Tools a drag can paint with (fill and the unit tools work per tap). */
const STROKE_TOOLS: Tool[] = ['raise', 'lower', 'level', 'paint', 'block'];

const TERRAIN_COLORS: Record<TerrainType, string> = {
  grass: '#4f9a3a', stone: '#8d95a3', dirt: '#8a5a32', water: '#2f6fd6', wood: '#a0703d', swamp: '#3f5a2c', parapet: '#5f6b84', sand: '#d9b97a', snow: '#e8eef6'
};
const FACINGS: FacingDirection[] = ['N', 'E', 'S', 'W'];
const FACING_NAMES: Record<FacingDirection, string> = { N: 'North', E: 'East', S: 'South', W: 'West' };
const PORTRAITS = ['', ...portraitIds(Object.keys(JOBS))];
const portraitName = (id: string) =>
  !id ? 'Emoji only' : NAMED_PORTRAITS.find((p) => p.id === id)?.name || (id.startsWith('foe_') ? `Enemy ${JOBS[id.slice(4)]?.name || id}` : `Ally ${JOBS[id]?.name || id}`);

/** Tiny DOM builder: h('button', { class: 'x', onclick }, 'text', child) */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...kids: (Node | string | null | false | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

export class Workshop {
  public isOpen = false;
  public scenario: Scenario = blankScenario();
  private grid!: BattleGrid;

  private tab: Tab = 'terrain';
  private tool: Tool = 'raise';
  private brush = 1;
  private paintTerrain: TerrainType = 'stone';
  private levelHeight = 1;
  private enemyForm: Omit<EnemySpawn, 'x' | 'z'> = { name: 'Brigand', jobId: 'squire', level: 3, facing: 'S' };
  private selectedEnemy = -1;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private autosaveTimer = 0;
  private collapsed = false;
  /** One-finger / left-button drag on the map: paint with the brush, or pan the camera. */
  private dragMode: 'paint' | 'pan' = 'paint';
  private stroke: { visited: Set<string>; block: boolean; dirty: boolean; timer: number; changed: boolean } | null = null;
  private confirmDelete = '';
  // Chains-tab state (0.42.0)
  private chain: Chain | null = null;
  private chainPick = 0;
  private chainSaveTimer = 0;
  // File-tab form state
  private newForm = { width: 16, depth: 16, look: 0, terrain: 0 };
  private copyMapIdx = 0;
  private copyChapterIdx = 0;

  private root: HTMLElement;
  private body: HTMLElement;
  private tabBar: HTMLElement;
  private statusEl: HTMLElement;
  private undoBtn: HTMLButtonElement;
  private redoBtn: HTMLButtonElement;
  private playBtn: HTMLButtonElement;

  constructor(private host: WorkshopHost) {
    this.undoBtn = h('button', { class: 'ws-btn', title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', onclick: () => this.undo() }, '↶');
    this.redoBtn = h('button', { class: 'ws-btn', title: 'Redo (Ctrl+Y)', 'aria-label': 'Redo', onclick: () => this.redo() }, '↷');
    this.playBtn = h('button', { class: 'ws-btn ws-primary', title: 'Play this scenario with your squad', onclick: () => this.tryPlay() }, '▶ Play');
    const collapseBtn = h('button', {
      class: 'ws-btn ws-collapse', title: 'Hide or show the panel', 'aria-expanded': 'true',
      onclick: () => {
        this.collapsed = !this.collapsed;
        this.root.classList.toggle('collapsed', this.collapsed);
        collapseBtn.setAttribute('aria-expanded', String(!this.collapsed));
        collapseBtn.textContent = this.collapsed ? '▴' : '▾';
        this.fitCamera();
      }
    }, '▾');
    const closeBtn = h('button', { class: 'ws-btn', title: 'Close the Workshop (Esc)', 'aria-label': 'Close Workshop', onclick: () => this.close() }, '×');

    this.tabBar = h('div', { class: 'ws-tabs', role: 'tablist' });
    const tabs: [Tab, string][] = [['terrain', 'Terrain'], ['units', 'Units'], ['story', 'Story'], ['rules', 'Rules'], ['file', 'File'], ['chains', 'Chains']];
    for (const [id, label] of tabs) {
      this.tabBar.append(h('button', { class: 'ws-tab', role: 'tab', 'data-tab': id, onclick: () => this.setTab(id) }, label));
    }
    this.body = h('div', { class: 'ws-body', role: 'tabpanel' });
    this.statusEl = h('div', { class: 'ws-status', 'aria-live': 'polite' });

    this.root = h('section', { id: 'workshop', class: 'hud-panel hidden', 'aria-label': 'Workshop: map and scenario editor' },
      h('header', { class: 'ws-head' },
        h('span', { class: 'ws-title' }, 'WORKSHOP'),
        h('span', { class: 'ws-head-btns' }, this.undoBtn, this.redoBtn, this.playBtn, collapseBtn, closeBtn)),
      this.tabBar,
      this.body,
      this.statusEl);
    document.getElementById('game-container')!.append(this.root);

    window.addEventListener('resize', () => this.fitCamera());

    // Brush strokes: drag across tiles to sculpt or paint them in one undoable step
    host.scene.dragPaint = {
      wants: () => this.isOpen && this.dragMode === 'paint' && STROKE_TOOLS.includes(this.tool),
      begin: (x, z) => {
        const t = this.grid.getTile(x, z);
        this.checkpoint();
        this.stroke = { visited: new Set(), block: t ? !t.walkable : true, dirty: false, timer: 0, changed: false };
        this.strokeAt(x, z);
      },
      over: (x, z) => this.strokeAt(x, z),
      end: () => {
        const st = this.stroke;
        this.stroke = null;
        if (!st) return;
        clearTimeout(st.timer);
        if (!st.changed) this.undoStack.pop(); // nothing changed: drop the checkpoint
        else this.changed(true);
      }
    };

    window.addEventListener('keydown', (e) => {
      if (!this.isOpen || !(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).matches?.('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); this.redo(); }
    });
  }

  public get panel(): HTMLElement {
    return this.root;
  }

  /** Re-centres the battlefield in the space the panel leaves free. */
  private fitCamera(): void {
    let left = 0, bottom = 0;
    if (this.isOpen) {
      const r = this.root.getBoundingClientRect();
      if (r.width > window.innerWidth * 0.8) bottom = window.innerHeight - r.top; // bottom sheet
      else left = r.right;
    }
    this.host.scene.setScreenInset(left, bottom);
  }

  // ---------------------------------------------------------------------------
  // Open / close / load
  // ---------------------------------------------------------------------------

  public open(s?: Scenario): void {
    if (s) this.load(s);
    else if (!this.grid) this.load(Library.list()[0] || scenarioFromChapter(this.host.currentChapter()));
    else this.load(this.scenario, true);
    this.isOpen = true;
    this.root.classList.remove('hidden');
    document.body.classList.add('workshop-open');
    this.render();
    this.fitCamera();
    this.focusPanel();
  }

  /** Opens the Workshop on the Chains tab with this chain (from a share link or a chain battle). */
  public openChain(c: Chain): void {
    this.chain = c;
    this.tab = 'chains';
    this.open();
  }

  public close(): void {
    if (!this.isOpen) return;
    this.saveNow();
    this.saveChainNow();
    this.isOpen = false;
    this.root.classList.add('hidden');
    document.body.classList.remove('workshop-open');
    this.fitCamera();
    this.host.scene.clearHighlights();
    this.host.closed();
  }

  /** Puts the keyboard / controller focus on the panel (controller X). */
  public focusPanel(): void {
    const active = this.tabBar.querySelector<HTMLElement>('.ws-tab.active');
    if (active) focusVisible(active);
  }

  public focusIsInPanel(): boolean {
    return this.root.contains(document.activeElement);
  }

  private load(s: Scenario, keepHistory = false): void {
    this.scenario = s;
    this.grid = new BattleGrid(s.map);
    if (!keepHistory) {
      this.undoStack = [];
      this.redoStack = [];
      this.selectedEnemy = -1;
    }
    this.host.scene.loadMap(this.grid);
    this.refreshMarkers();
  }

  // ---------------------------------------------------------------------------
  // Editing on the battlefield
  // ---------------------------------------------------------------------------

  private brushTiles(x: number, z: number): { x: number; z: number }[] {
    const r = this.brush - 1;
    const out: { x: number; z: number }[] = [];
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (this.grid.getTile(x + dx, z + dz)) out.push({ x: x + dx, z: z + dz });
    return out;
  }

  /** Applies the current tool at a tile (tap, click, Enter, controller A). */
  public applyAt(x: number, z: number): void {
    const tile = this.grid.getTile(x, z);
    if (!tile) return;
    const s = this.scenario;
    const spawns = (s.map.playerSpawns ||= []);
    const enemyAt = s.enemies.findIndex((e) => e.x === x && e.z === z);
    const spawnAt = spawns.findIndex((p) => p.x === x && p.z === z);

    switch (this.tool) {
      case 'raise':
      case 'lower':
      case 'level':
      case 'paint':
      case 'block': {
        this.checkpoint();
        const block = !tile.walkable;
        for (const p of this.brushTiles(x, z)) {
          const t = this.grid.getTile(p.x, p.z)!;
          if (this.tool === 'raise') t.height = Math.min(MAX_HEIGHT, Math.round((t.height + 0.5) * 10) / 10);
          else if (this.tool === 'lower') t.height = Math.max(0, Math.round((t.height - 0.5) * 10) / 10);
          else if (this.tool === 'level') t.height = this.levelHeight;
          else if (this.tool === 'paint') t.terrain = this.paintTerrain;
          else t.walkable = block;
        }
        SoundFX.playMoveStep();
        this.changed(true);
        break;
      }
      case 'fill': {
        const n = this.floodFill(x, z);
        if (n === 0) return this.say('That area is already this terrain.');
        SoundFX.playMoveStep();
        this.say(`Filled ${n} tile${n === 1 ? '' : 's'} with ${this.paintTerrain}.`);
        this.changed(true);
        break;
      }
      case 'spawn':
        if (spawnAt >= 0) {
          this.checkpoint();
          spawns.splice(spawnAt, 1);
        } else {
          if (!tile.walkable) return this.say('Squad members can only deploy on walkable tiles.');
          if (enemyAt >= 0) return this.say('An enemy stands there. Erase it first.');
          if (spawns.length >= MAX_SPAWNS) return this.say(`All ${MAX_SPAWNS} deploy tiles are placed. Tap one to remove it.`);
          this.checkpoint();
          spawns.push({ x, z });
        }
        SoundFX.playMenuBlip();
        this.changed(false);
        break;
      case 'enemy':
        if (enemyAt >= 0) {
          this.selectedEnemy = enemyAt;
          this.enemyForm = { ...s.enemies[enemyAt] };
          SoundFX.playMenuBlip();
          this.say(`Selected ${s.enemies[enemyAt].name}. Changes below apply to it.`);
          this.render();
          this.refreshMarkers();
          return;
        }
        if (!tile.walkable) return this.say('Enemies can only stand on walkable tiles.');
        if (spawnAt >= 0) return this.say("That's a squad deploy tile.");
        if (s.enemies.length >= MAX_ENEMIES) return this.say(`A scenario can have up to ${MAX_ENEMIES} enemies.`);
        this.checkpoint();
        if (this.enemyForm.isBoss) for (const e of s.enemies) delete e.isBoss;
        s.enemies.push({ ...this.enemyForm, x, z });
        this.selectedEnemy = s.enemies.length - 1;
        SoundFX.playMenuBlip();
        this.changed(false);
        break;
      case 'erase':
        if (enemyAt < 0 && spawnAt < 0) return this.say('Nothing to erase there.');
        this.checkpoint();
        if (enemyAt >= 0) {
          s.enemies.splice(enemyAt, 1);
          this.selectedEnemy = -1;
        } else spawns.splice(spawnAt, 1);
        SoundFX.playMenuBlip();
        this.changed(false);
        break;
    }
  }

  /** Applies the current terrain tool to the brush at (x, z) once per stroke per tile. */
  private strokeAt(x: number, z: number): void {
    const st = this.stroke;
    if (!st) return;
    let any = false;
    for (const p of this.brushTiles(x, z)) {
      const k = `${p.x},${p.z}`;
      if (st.visited.has(k)) continue;
      st.visited.add(k);
      const t = this.grid.getTile(p.x, p.z)!;
      const before = `${t.height}|${t.terrain}|${t.walkable}`;
      if (this.tool === 'raise') t.height = Math.min(MAX_HEIGHT, Math.round((t.height + 0.5) * 10) / 10);
      else if (this.tool === 'lower') t.height = Math.max(0, Math.round((t.height - 0.5) * 10) / 10);
      else if (this.tool === 'level') t.height = this.levelHeight;
      else if (this.tool === 'paint') t.terrain = this.paintTerrain;
      else if (this.tool === 'block') t.walkable = st.block;
      if (`${t.height}|${t.terrain}|${t.walkable}` !== before) any = true;
    }
    if (!any) return;
    st.changed = true;
    SoundFX.playMoveStep();
    // Rebuilding the terrain is the costly part: do it at most ~12 times a second while dragging
    if (!st.dirty) {
      st.dirty = true;
      st.timer = window.setTimeout(() => {
        if (this.stroke === st) st.dirty = false;
        this.host.scene.refreshTerrain();
        this.refreshMarkers();
      }, 80);
    }
  }

  private floodFill(x: number, z: number): number {
    const start = this.grid.getTile(x, z)!;
    if (start.terrain === this.paintTerrain) return 0;
    this.checkpoint();
    const { terrain, height } = start;
    const seen = new Set<string>();
    const queue = [{ x, z }];
    let n = 0;
    while (queue.length && n < 1000) {
      const c = queue.pop()!;
      const k = `${c.x},${c.z}`;
      const t = this.grid.getTile(c.x, c.z);
      if (seen.has(k) || !t || t.terrain !== terrain || t.height !== height) continue;
      seen.add(k);
      t.terrain = this.paintTerrain;
      n++;
      queue.push({ x: c.x + 1, z: c.z }, { x: c.x - 1, z: c.z }, { x: c.x, z: c.z + 1 }, { x: c.x, z: c.z - 1 });
    }
    return n;
  }

  /** Called after any edit: redraws what changed and schedules an autosave. */
  private changed(terrain: boolean): void {
    if (terrain) this.host.scene.refreshTerrain();
    this.refreshMarkers();
    if (this.tab === 'units' || this.tab === 'file' || this.tab === 'rules') this.render();
    else this.updateHeader();
    this.scheduleSave();
  }

  /** Shows deploy tiles (blue), enemies (as real sprites) and the selected enemy (gold). */
  private refreshMarkers(): void {
    const scene = this.host.scene;
    const s = this.scenario;
    const squad = this.host.squad();
    const units: Unit[] = [];
    (s.map.playerSpawns || []).forEach((p, i) => {
      const m = squad[i];
      const u = JobSystem.createUnit(`ws_p${i}_${m?.jobId || 'squire'}`, m?.name || `Ally ${i + 1}`, 'player', m?.jobId || 'squire', p.x, p.z, 'N', 1);
      units.push(u);
    });
    s.enemies.forEach((e, i) => {
      const u = JobSystem.createUnit(`ws_e${i}_${e.jobId}`, e.name, 'enemy', e.jobId, e.x, e.z, e.facing || 'S', e.level);
      if (e.isBoss) JobSystem.makeBoss(u);
      units.push(u);
    });
    scene.setActiveUnit(null);
    scene.updateUnits(units);
    scene.clearHighlights();
    scene.addHighlights(s.map.playerSpawns || [], 0x3b82f6);
    if (this.tab === 'units') scene.addHighlights(s.enemies.filter((_, i) => i !== this.selectedEnemy), 0xef4444);
    const sel = s.enemies[this.selectedEnemy];
    if (sel) scene.addHighlights([sel], 0xf4c430);
  }

  // ---------------------------------------------------------------------------
  // Undo / redo / autosave
  // ---------------------------------------------------------------------------

  private snapshot(): string {
    return JSON.stringify(this.scenario);
  }

  private checkpoint(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack = [];
  }

  private restore(json: string): void {
    const prevTiles = JSON.stringify(this.scenario.map.tiles);
    const s = JSON.parse(json) as Scenario;
    const sameMap = JSON.stringify(s.map.tiles) === prevTiles && s.map.width === this.scenario.map.width && s.map.depth === this.scenario.map.depth;
    this.scenario = s;
    this.selectedEnemy = Math.min(this.selectedEnemy, s.enemies.length - 1);
    if (sameMap && s.map.look === this.grid.mapData.look) {
      this.grid.mapData.playerSpawns = s.map.playerSpawns;
      s.map = this.grid.mapData;
      this.refreshMarkers();
    } else {
      this.load(s, true);
    }
    this.render();
    this.scheduleSave();
  }

  public undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return this.say('Nothing to undo.');
    this.redoStack.push(this.snapshot());
    this.restore(prev);
    SoundFX.playMenuBlip();
  }

  public redo(): void {
    const next = this.redoStack.pop();
    if (!next) return this.say('Nothing to redo.');
    this.undoStack.push(this.snapshot());
    this.restore(next);
    SoundFX.playMenuBlip();
  }

  private scheduleSave(): void {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => this.saveNow(), 700);
  }

  private saveNow(): void {
    clearTimeout(this.autosaveTimer);
    if (!Library.save(this.scenario)) this.say('Browser storage is unavailable: export your scenario to keep it.');
  }

  // ---------------------------------------------------------------------------
  // Playing
  // ---------------------------------------------------------------------------

  private tryPlay(): void {
    const errors = validateScenario(this.scenario).filter((i) => i.level === 'error');
    if (errors.length) {
      SoundFX.playCrit();
      this.say(errors[0].text);
      this.setTab('file');
      return;
    }
    this.leaveForBattle();
    this.host.play(JSON.parse(JSON.stringify(this.scenario)));
  }

  /** Saves everything and steps out of the Workshop for a battle. */
  private leaveForBattle(): void {
    this.saveNow();
    this.saveChainNow();
    this.isOpen = false;
    this.root.classList.add('hidden');
    document.body.classList.remove('workshop-open');
    this.fitCamera();
    this.host.scene.clearHighlights();
  }

  /** Plays the chain from battle `index`, if every battle in it is playable. */
  private tryPlayChain(index: number): void {
    const c = this.currentChain();
    const errors = validateChain(c).filter((i) => i.level === 'error');
    if (errors.length) {
      SoundFX.playCrit();
      this.say(errors[0].text);
      return;
    }
    this.leaveForBattle();
    this.host.playChain(sanitizeChain(JSON.parse(JSON.stringify(packChain(c)))), index);
  }

  // ---------------------------------------------------------------------------
  // Panel rendering
  // ---------------------------------------------------------------------------

  private say(text: string): void {
    this.statusEl.textContent = text;
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    // Pick a sensible tool for the tab so a tap does what the tab is about
    const terrainTools: Tool[] = ['raise', 'lower', 'level', 'paint', 'block', 'fill'];
    const unitTools: Tool[] = ['spawn', 'enemy', 'erase'];
    if (tab === 'terrain' && !terrainTools.includes(this.tool)) this.tool = 'raise';
    if (tab === 'units' && !unitTools.includes(this.tool)) this.tool = 'enemy';
    SoundFX.playMenuBlip();
    this.render();
    this.refreshMarkers();
    const t = this.tabBar.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (t && this.focusIsInPanel()) focusVisible(t);
  }

  private updateHeader(): void {
    this.undoBtn.disabled = this.undoStack.length === 0;
    this.redoBtn.disabled = this.redoStack.length === 0;
    const errors = validateScenario(this.scenario).filter((i) => i.level === 'error').length;
    this.playBtn.classList.toggle('ws-blocked', errors > 0);
    this.playBtn.title = errors ? `Fix ${errors} problem${errors === 1 ? '' : 's'} first (File tab)` : 'Play this scenario with your squad';
  }

  /** Re-renders the active tab, keeping focus on the same control when possible. */
  private render(): void {
    const focusedKey = (document.activeElement as HTMLElement | null)?.dataset?.k;
    for (const b of this.tabBar.querySelectorAll<HTMLElement>('.ws-tab')) {
      const on = b.dataset.tab === this.tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    }
    this.body.replaceChildren(...this.renderTab());
    this.updateHeader();
    if (focusedKey) {
      const el = this.body.querySelector<HTMLElement>(`[data-k="${CSS.escape(focusedKey)}"]`);
      if (el && focusablesIn(this.body).includes(el)) focusVisible(el);
    }
    if (this.tool && (this.tab === 'terrain' || this.tab === 'units') && !this.statusEl.textContent) this.say(TOOL_INFO[this.tool].hint);
  }

  private renderTab(): Node[] {
    switch (this.tab) {
      case 'terrain': return this.terrainTab();
      case 'units': return this.unitsTab();
      case 'story': return this.storyTab();
      case 'rules': return this.rulesTab();
      case 'file': return this.fileTab();
      case 'chains': return this.chainsTab();
    }
  }

  private toolButtons(tools: Tool[]): HTMLElement {
    return h('div', { class: 'ws-tools', role: 'toolbar', 'aria-label': 'Tools' }, ...tools.map((t) =>
      h('button', {
        class: 'ws-tool' + (this.tool === t ? ' active' : ''), 'data-k': `tool-${t}`, 'aria-pressed': String(this.tool === t), title: TOOL_INFO[t].hint,
        onclick: () => { this.tool = t; SoundFX.playMenuBlip(); this.say(TOOL_INFO[t].hint); this.render(); }
      }, h('span', { class: 'ws-tool-icon', 'aria-hidden': 'true' }, TOOL_INFO[t].icon), TOOL_INFO[t].label)));
  }

  /** ◀ value ▶ control. */
  private stepper(key: string, label: string, value: string, onStep: (d: number) => void): HTMLElement {
    return h('div', { class: 'ws-field' },
      h('span', { class: 'ws-label' }, label),
      h('div', { class: 'ws-stepper' },
        h('button', { class: 'ws-btn', 'data-k': `${key}-`, 'aria-label': `${label}: previous`, onclick: () => { onStep(-1); SoundFX.playMenuBlip(); this.render(); } }, '◀'),
        h('output', { class: 'ws-value' }, value),
        h('button', { class: 'ws-btn', 'data-k': `${key}+`, 'aria-label': `${label}: next`, onclick: () => { onStep(1); SoundFX.playMenuBlip(); this.render(); } }, '▶')));
  }

  private segmented<T extends string | number>(key: string, label: string, options: [T, string][], current: T, onPick: (v: T) => void): HTMLElement {
    return h('div', { class: 'ws-field' },
      h('span', { class: 'ws-label' }, label),
      h('div', { class: 'ws-seg', role: 'group', 'aria-label': label }, ...options.map(([v, text]) =>
        h('button', { class: 'ws-btn' + (v === current ? ' active' : ''), 'data-k': `${key}-${v}`, 'aria-pressed': String(v === current), onclick: () => { onPick(v); SoundFX.playMenuBlip(); this.render(); } }, text))));
  }

  private textField(key: string, label: string, value: string, max: number, onInput: (v: string) => void, multiline = false, onChange?: () => void): HTMLElement {
    const attrs = {
      class: 'ws-input', 'data-k': key, maxlength: String(max), 'aria-label': label, value,
      oninput: (e: Event) => { onInput((e.target as HTMLInputElement).value); this.scheduleSave(); },
      onchange: onChange
    };
    const field = multiline ? h('textarea', { ...attrs, rows: '2' }) : h('input', { ...attrs, type: 'text' });
    if (multiline) (field as HTMLTextAreaElement).value = value;
    return h('label', { class: 'ws-field' }, h('span', { class: 'ws-label' }, label), field);
  }

  private terrainTab(): Node[] {
    const showTerrain = this.tool === 'paint' || this.tool === 'fill';
    return [
      this.toolButtons(['raise', 'lower', 'level', 'paint', 'block', 'fill']),
      this.tool !== 'fill' ? this.segmented('brush', 'Brush', [[1, '1×1'], [2, '3×3'], [3, '5×5']], this.brush, (v) => (this.brush = v)) : null,
      this.tool !== 'fill' ? this.segmented('drag', 'Drag on the map', [['paint', 'Paints'], ['pan', 'Pans']], this.dragMode, (v) => (this.dragMode = v)) : null,
      this.tool === 'level' ? this.stepper('lvl', 'Height', this.levelHeight.toFixed(1), (d) => (this.levelHeight = Math.min(MAX_HEIGHT, Math.max(0, this.levelHeight + d * 0.5)))) : null,
      showTerrain ? h('div', { class: 'ws-field' },
        h('span', { class: 'ws-label' }, 'Terrain'),
        h('div', { class: 'ws-swatches', role: 'group', 'aria-label': 'Terrain' }, ...TERRAINS.map((t) =>
          h('button', {
            class: 'ws-swatch' + (this.paintTerrain === t ? ' active' : ''), 'data-k': `ter-${t}`, 'aria-pressed': String(this.paintTerrain === t),
            onclick: () => { this.paintTerrain = t; SoundFX.playMenuBlip(); this.render(); }
          }, h('span', { class: 'ws-chip', style: `background:${TERRAIN_COLORS[t]}` }), t)))) : null,
      h('p', { class: 'ws-note' }, this.dragMode === 'paint' ? 'Drag across tiles to paint a stroke (one undo step). Pan with two fingers, the right mouse button, WASD or the camera buttons.' : 'Tap tiles to edit them one at a time; dragging moves the camera.'),
      h('p', { class: 'ws-note' }, 'Water, swamp and snow cost 2 movement. Height differences above a unit\'s Jump block the step. Wood is a bridge or boardwalk; parapet is battlement stone.')
    ].filter(Boolean) as Node[];
  }

  private unitsTab(): Node[] {
    const s = this.scenario;
    const f = this.enemyForm;
    const sel = s.enemies[this.selectedEnemy];
    const jobs = Object.keys(JOBS);
    // Form edits apply to the selected enemy too
    const edit = (fn: (e: Omit<EnemySpawn, 'x' | 'z'>) => void) => {
      fn(f);
      if (sel) {
        this.checkpoint();
        fn(sel);
        if (sel.isBoss) for (const e of s.enemies) if (e !== sel) delete e.isBoss;
        this.refreshMarkers();
        this.scheduleSave();
      }
    };
    const spawns = s.map.playerSpawns || [];
    return [
      this.toolButtons(['spawn', 'enemy', 'erase']),
      h('p', { class: 'ws-count' }, `Squad deploy tiles: ${spawns.length}/${MAX_SPAWNS} · Enemies: ${s.enemies.length}/${MAX_ENEMIES}`),
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, sel ? `Editing: ${sel.name} (${sel.x}, ${sel.z})` : 'New enemy'),
        this.textField('en-name', 'Name', f.name, 28, (v) => edit((e) => (e.name = v.trim() || JOBS[e.jobId].name))),
        this.stepper('en-job', 'Job', JOBS[f.jobId].name, (d) => edit((e) => (e.jobId = jobs[(jobs.indexOf(e.jobId) + d + jobs.length) % jobs.length]))),
        this.stepper('en-lvl', 'Level', String(f.level), (d) => edit((e) => (e.level = Math.min(20, Math.max(1, e.level + d))))),
        this.stepper('en-face', 'Facing', FACING_NAMES[f.facing || 'S'], (d) => edit((e) => (e.facing = FACINGS[(FACINGS.indexOf(e.facing || 'S') + d + 4) % 4]))),
        this.segmented('en-boss', 'Boss', [['no', 'No'], ['yes', 'Boss ★']], f.isBoss ? 'yes' : 'no', (v) => edit((e) => { if (v === 'yes') e.isBoss = true; else delete e.isBoss; })),
        sel ? h('div', { class: 'ws-row' },
          h('button', { class: 'ws-btn', 'data-k': 'en-done', onclick: () => { this.selectedEnemy = -1; this.render(); this.refreshMarkers(); } }, 'Done'),
          h('button', { class: 'ws-btn ws-danger', 'data-k': 'en-del', onclick: () => { this.checkpoint(); s.enemies.splice(this.selectedEnemy, 1); this.selectedEnemy = -1; this.changed(false); } }, 'Remove')) : null),
      s.enemies.length ? h('ol', { class: 'ws-list', 'aria-label': 'Enemies' }, ...s.enemies.map((e, i) =>
        h('li', {},
          h('button', {
            class: 'ws-list-btn' + (i === this.selectedEnemy ? ' active' : ''), 'data-k': `en-pick-${i}`,
            onclick: () => {
              this.selectedEnemy = i;
              this.enemyForm = { ...e };
              this.tool = 'enemy';
              this.host.scene.focusOn(e.x, this.grid.getHeight(e.x, e.z), e.z);
              this.host.scene.setCursor(e.x, e.z);
              this.render();
              this.refreshMarkers();
            }
          }, `${e.isBoss ? '★ ' : ''}${e.name}`, h('small', {}, ` ${JOBS[e.jobId].name} Lv${e.level} · (${e.x}, ${e.z})`))))) : null
    ].filter(Boolean) as Node[];
  }

  private linesEditor(key: string, title: string, lines: DialogueLine[]): HTMLElement {
    const box = h('fieldset', { class: 'ws-group' }, h('legend', {}, `${title} (${lines.length})`));
    lines.forEach((line, i) => {
      const pid = line.portrait || '';
      const shown = pid || portraitForSpeaker(line.speaker);
      const img = shown ? h('img', { class: 'ws-portrait', src: portraitDataUrl(shown), alt: '' }) : h('span', { class: 'ws-portrait ws-emoji', 'aria-hidden': 'true' }, line.portraitClass);
      box.append(h('div', { class: 'ws-line' },
        h('div', { class: 'ws-line-head' },
          img,
          this.textField(`${key}-${i}-sp`, `Line ${i + 1} speaker`, line.speaker, 32, (v) => (line.speaker = v || '???'), false, () => this.render()),
          h('button', { class: 'ws-btn', 'data-k': `${key}-${i}-side`, title: 'Which side the portrait sits on', onclick: () => { line.side = line.side === 'left' ? 'right' : 'left'; this.scheduleSave(); this.render(); } }, line.side === 'left' ? '◧ Left' : 'Right ◨')),
        this.stepper(`${key}-${i}-pt`, 'Portrait', pid ? portraitName(pid) : shown ? `Auto (${portraitName(shown)})` : 'Emoji only', (d) => {
          const next = PORTRAITS[(PORTRAITS.indexOf(pid) + d + PORTRAITS.length) % PORTRAITS.length];
          if (next) line.portrait = next; else delete line.portrait;
          this.scheduleSave();
        }),
        this.textField(`${key}-${i}-tx`, `Line ${i + 1} text`, line.text, 400, (v) => (line.text = v || '…'), true),
        h('div', { class: 'ws-row' },
          h('button', { class: 'ws-btn', 'data-k': `${key}-${i}-up`, disabled: i === 0, 'aria-label': `Move line ${i + 1} up`, onclick: () => { [lines[i - 1], lines[i]] = [lines[i], lines[i - 1]]; this.scheduleSave(); this.render(); } }, '↑'),
          h('button', { class: 'ws-btn', 'data-k': `${key}-${i}-dn`, disabled: i === lines.length - 1, 'aria-label': `Move line ${i + 1} down`, onclick: () => { [lines[i + 1], lines[i]] = [lines[i], lines[i + 1]]; this.scheduleSave(); this.render(); } }, '↓'),
          h('button', { class: 'ws-btn ws-danger', 'data-k': `${key}-${i}-rm`, 'aria-label': `Delete line ${i + 1}`, onclick: () => { lines.splice(i, 1); this.scheduleSave(); this.render(); } }, 'Delete'))));
    });
    box.append(h('button', {
      class: 'ws-btn ws-wide', 'data-k': `${key}-add`, disabled: lines.length >= MAX_LINES,
      onclick: () => {
        const prev = lines[lines.length - 1];
        lines.push(prev
          ? { speaker: prev.speaker, portraitClass: prev.portraitClass, portrait: prev.portrait, side: prev.side === 'left' ? 'right' : 'left', text: '…' }
          : { speaker: 'Rowan', portraitClass: '⚔', portrait: 'rowan', side: 'left', text: '…' });
        this.scheduleSave();
        this.render();
        const tx = this.body.querySelector<HTMLElement>(`[data-k="${key}-${lines.length - 1}-tx"]`);
        if (tx) focusVisible(tx);
      }
    }, '+ Add line'));
    return box;
  }

  private storyTab(): Node[] {
    const s = this.scenario;
    return [
      this.textField('title', 'Title', s.title, 48, (v) => (s.title = v || 'Untitled Scenario')),
      this.textField('subtitle', 'Subtitle', s.subtitle, 64, (v) => (s.subtitle = v)),
      this.textField('author', 'Author (optional)', s.author, 32, (v) => (s.author = v)),
      this.linesEditor('intro', 'Before the battle', s.intro),
      this.linesEditor('victory', 'After victory', s.victory)
    ];
  }

  private rulesTab(): Node[] {
    const s = this.scenario;
    const o = s.objective;
    const lookIdx = Math.max(0, LOOKS.findIndex((l) => l.id === s.map.look));
    return [
      this.segmented('obj', 'Objective', [['rout', 'Rout all'], ['boss', 'Defeat boss'], ['survive', 'Survive']], o.type, (v) => {
        this.checkpoint();
        s.objective = v === 'survive' ? { type: v, rounds: o.rounds || 6 } : { type: v };
        this.scheduleSave();
      }),
      o.type === 'survive' ? this.stepper('rounds', 'Rounds to hold', String(o.rounds || 6), (d) => { o.rounds = Math.min(30, Math.max(2, (o.rounds || 6) + d)); this.scheduleSave(); }) : null,
      h('p', { class: 'ws-note' }, o.type === 'rout' ? 'Win by defeating every enemy.' : o.type === 'boss' ? 'Win the moment the boss (★) falls; the rest of the enemy flees.' : 'Win if anyone in your squad is still standing after that many rounds. A round ends once every unit has had a turn.'),
      this.stepper('look', 'Look', LOOKS[lookIdx].name, (d) => {
        const l = LOOKS[(lookIdx + d + LOOKS.length) % LOOKS.length];
        s.map.look = l.id;
        s.map.theme = l.theme;
        this.host.scene.loadMap(this.grid);
        this.refreshMarkers();
        this.scheduleSave();
      }),
      this.textField('mapname', 'Battlefield name', s.map.name, 40, (v) => (s.map.name = v || 'Custom field')),
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, `Victory rewards (${s.rewardItemIds.length}/6)`),
        h('div', { class: 'ws-rewards' }, ...Object.values(ITEMS).map((it) => {
          const on = s.rewardItemIds.includes(it.id);
          return h('button', {
            class: 'ws-btn ws-reward' + (on ? ' active' : ''), 'data-k': `rw-${it.id}`, 'aria-pressed': String(on), disabled: !on && s.rewardItemIds.length >= 6,
            onclick: () => {
              s.rewardItemIds = on ? s.rewardItemIds.filter((x) => x !== it.id) : [...s.rewardItemIds, it.id];
              this.scheduleSave();
              this.render();
            }
          }, it.name);
        })))
    ].filter(Boolean) as Node[];
  }

  private fileTab(): Node[] {
    const s = this.scenario;
    const issues = validateScenario(s);
    const lib = Library.list();
    const mapIds = Object.keys(MAPS);
    const chapters = this.host.chapters();
    const nf = this.newForm;
    const pasteBox = h('textarea', { class: 'ws-input', rows: '3', 'data-k': 'paste', 'aria-label': 'Paste scenario JSON', placeholder: 'Paste scenario, chain or map JSON here' });
    const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'ws-hidden-file', tabindex: '-1', 'aria-hidden': 'true' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (file.size > 2_000_000) return this.say('That file is too large to be a scenario.');
      this.importText(await file.text());
    });
    const shareOut = h('input', { class: 'ws-input', readonly: true, 'data-k': 'share-out', 'aria-label': 'Share link', placeholder: 'Press "Copy share link"' });

    return [
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, 'Check'),
        issues.length === 0
          ? h('p', { class: 'ws-ok' }, '✓ Ready to play.')
          : h('ul', { class: 'ws-issues' }, ...issues.map((i) => h('li', { class: i.level }, `${i.level === 'error' ? '✕' : '!'} ${i.text}`))),
        h('button', { class: 'ws-btn ws-primary ws-wide', 'data-k': 'play2', onclick: () => this.tryPlay() }, '▶ Play this scenario')),
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, `Library (${lib.length})`),
        h('p', { class: 'ws-note' }, 'Scenarios save automatically in this browser.'),
        h('ul', { class: 'ws-list' }, ...lib.map((x) => h('li', { class: x.id === s.id ? 'current' : '' },
          h('button', {
            class: 'ws-list-btn', 'data-k': `lib-${x.id}`, disabled: x.id === s.id,
            onclick: () => { this.saveNow(); this.load(x); this.say(`Opened "${x.title}".`); this.render(); }
          }, x.title, h('small', {}, ` ${x.map.width}×${x.map.depth} · ${x.enemies.length} enemies${x.id === s.id ? ' · editing' : ''}`)),
          h('button', {
            class: 'ws-btn ws-danger', 'data-k': `del-${x.id}`, 'aria-label': `Delete ${x.title}`,
            onclick: () => {
              if (this.confirmDelete !== x.id) { this.confirmDelete = x.id; this.say(`Press Delete again to remove "${x.title}".`); this.render(); return; }
              this.confirmDelete = '';
              Library.remove(x.id);
              if (x.id === s.id) this.load(Library.list()[0] || blankScenario());
              this.say(`Deleted "${x.title}".`);
              this.render();
            }
          }, this.confirmDelete === x.id ? 'Sure?' : 'Delete')))),
        h('button', { class: 'ws-btn ws-wide', 'data-k': 'dup', onclick: () => { const c = parseScenario(JSON.stringify({ ...s, id: undefined, title: `${s.title} (copy)` })); this.saveNow(); this.load(c); this.saveNow(); this.say('Duplicated.'); this.render(); } }, 'Duplicate this scenario')),
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, 'New blank battlefield'),
        this.stepper('nw', 'Width', String(nf.width), (d) => (nf.width = Math.min(MAX_SIZE, Math.max(MIN_SIZE, nf.width + d * 2)))),
        this.stepper('nd', 'Depth', String(nf.depth), (d) => (nf.depth = Math.min(MAX_SIZE, Math.max(MIN_SIZE, nf.depth + d * 2)))),
        this.stepper('nl', 'Look', LOOKS[nf.look].name, (d) => (nf.look = (nf.look + d + LOOKS.length) % LOOKS.length)),
        this.stepper('nt', 'Ground', TERRAINS[nf.terrain], (d) => (nf.terrain = (nf.terrain + d + TERRAINS.length) % TERRAINS.length)),
        h('button', { class: 'ws-btn ws-wide', 'data-k': 'create', onclick: () => this.replaceWith(blankScenario(nf.width, nf.depth, LOOKS[nf.look].id, TERRAINS[nf.terrain]), 'New battlefield created.') }, 'Create')),
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, 'Start from the campaign'),
        this.stepper('cm', 'Battlefield', MAPS[mapIds[this.copyMapIdx]]().name, (d) => (this.copyMapIdx = (this.copyMapIdx + d + mapIds.length) % mapIds.length)),
        h('button', { class: 'ws-btn ws-wide', 'data-k': 'copymap', onclick: () => this.replaceWith(scenarioFromMap(mapIds[this.copyMapIdx]), 'Copied the battlefield. Add enemies in Units.') }, 'Copy battlefield'),
        this.stepper('cc', 'Chapter', chapters[this.copyChapterIdx]?.title || '-', (d) => (this.copyChapterIdx = (this.copyChapterIdx + d + chapters.length) % chapters.length)),
        h('button', { class: 'ws-btn ws-wide', 'data-k': 'copych', onclick: () => this.replaceWith(scenarioFromChapter(chapters[this.copyChapterIdx]), 'Copied the chapter: map, enemies, dialogue and rewards.') }, 'Remix chapter')),
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, 'Share'),
        h('div', { class: 'ws-row' },
          h('button', { class: 'ws-btn', 'data-k': 'export', onclick: () => this.exportFile() }, '⭳ Export .json'),
          h('button', { class: 'ws-btn', 'data-k': 'import', onclick: () => fileInput.click() }, '⭱ Import .json'),
          fileInput),
        h('button', {
          class: 'ws-btn ws-wide', 'data-k': 'share',
          onclick: async () => {
            const url = `${location.origin}${location.pathname}#s=${await encodeShare(s)}`;
            shareOut.value = url;
            try { await navigator.clipboard.writeText(url); this.say(`Share link copied (${url.length} characters).`); }
            catch { shareOut.select(); this.say('Copy the link from the box below.'); }
          }
        }, '🔗 Copy share link'),
        shareOut,
        pasteBox,
        h('button', { class: 'ws-btn ws-wide', 'data-k': 'paste-go', onclick: () => this.importText(pasteBox.value) }, 'Load pasted JSON'))
    ];
  }

  // ---------------------------------------------------------------------------
  // Chains (0.42.0)
  // ---------------------------------------------------------------------------

  private currentChain(): Chain {
    if (!this.chain) this.chain = ChainLibrary.list()[0] || blankChain();
    return this.chain;
  }

  private saveChainSoon(): void {
    clearTimeout(this.chainSaveTimer);
    this.chainSaveTimer = window.setTimeout(() => this.saveChainNow(), 600);
  }

  private saveChainNow(): void {
    clearTimeout(this.chainSaveTimer);
    if (!this.chain) return;
    if (!ChainLibrary.save(this.chain)) this.say('Browser storage is full or unavailable: export the chain to keep it.');
  }

  /** A change to the chain's battles: save, re-render, and say what happened. */
  private chainChanged(msg: string): void {
    this.saveChainNow();
    SoundFX.playMenuBlip();
    this.say(msg);
    this.render();
  }

  private chainsTab(): Node[] {
    const c = this.currentChain();
    const lib = Library.list();
    const chains = ChainLibrary.list();
    if (!chains.some((x) => x.id === c.id)) chains.unshift(c);
    const issues = validateChain(c);
    const full = c.scenarios.length >= MAX_CHAIN;
    this.chainPick = Math.min(this.chainPick, Math.max(0, lib.length - 1));
    const pick = lib[this.chainPick];
    const resume = ChainProgress.get(c);
    const shareOut = h('input', { class: 'ws-input', readonly: true, 'data-k': 'chain-share-out', 'aria-label': 'Chain share link', placeholder: 'Press "Copy chain link"' });
    const field = (key: string, label: string, value: string, max: number, set: (v: string) => void, multiline = false) =>
      this.textField(key, label, value, max, (v) => { set(v); this.saveChainSoon(); }, multiline);

    return [
      h('p', { class: 'ws-note' }, 'String scenarios into a mini campaign: they play in order with your squad, which keeps what it earns. A chain keeps its own copy of each battle.'),
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, 'This chain'),
        field('ch-title', 'Title', c.title, 48, (v) => (c.title = v || 'Untitled Chain')),
        field('ch-author', 'Author (optional)', c.author, 32, (v) => (c.author = v)),
        field('ch-blurb', 'Opening words (shown before battle 1)', c.blurb, 240, (v) => (c.blurb = v), true)),
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, `Battles (${c.scenarios.length}/${MAX_CHAIN})`),
        c.scenarios.length === 0 ? h('p', { class: 'ws-note' }, 'No battles yet. Add the scenario you are editing, or pick one from your library.') : null,
        h('ol', { class: 'ws-list ws-chain' }, ...c.scenarios.map((x, i) => h('li', {},
          h('span', { class: 'ws-chain-name' }, `${i + 1}. ${x.title}`, h('small', {}, ` ${x.map.width}×${x.map.depth} · ${x.enemies.length} enemies`)),
          h('button', { class: 'ws-btn', 'data-k': `ch-up-${i}`, 'aria-label': `Move ${x.title} earlier`, disabled: i === 0, onclick: () => { moveBattle(c, i, -1); this.chainChanged(`Moved "${x.title}" to battle ${i}.`); } }, '▲'),
          h('button', { class: 'ws-btn', 'data-k': `ch-dn-${i}`, 'aria-label': `Move ${x.title} later`, disabled: i === c.scenarios.length - 1, onclick: () => { moveBattle(c, i, 1); this.chainChanged(`Moved "${x.title}" to battle ${i + 2}.`); } }, '▼'),
          h('button', { class: 'ws-btn ws-danger', 'data-k': `ch-rm-${i}`, 'aria-label': `Remove ${x.title} from the chain`, onclick: () => { removeBattle(c, i); this.chainChanged(`Removed "${x.title}" from the chain.`); } }, '✕')))),
        h('button', {
          class: 'ws-btn ws-wide', 'data-k': 'ch-add-current', disabled: full,
          onclick: () => { this.saveNow(); addBattle(c, this.scenario); this.chainChanged(`Added "${this.scenario.title}" as battle ${c.scenarios.length}.`); }
        }, `+ Add "${this.scenario.title}" (editing now)`),
        lib.length ? this.stepper('ch-pick', 'From your library', pick ? pick.title : '-', (d) => (this.chainPick = (this.chainPick + d + lib.length) % lib.length)) : null,
        lib.length ? h('button', {
          class: 'ws-btn ws-wide', 'data-k': 'ch-add-pick', disabled: full || !pick,
          onclick: () => { if (pick && addBattle(c, pick)) this.chainChanged(`Added "${pick.title}" as battle ${c.scenarios.length}.`); }
        }, '+ Add from library') : null,
        c.scenarios.length ? h('button', {
          class: 'ws-btn ws-wide', 'data-k': 'ch-refresh',
          onclick: () => { this.saveNow(); const n = refreshFromLibrary(c, Library.list()); this.chainChanged(n ? `Updated ${n} battle${n === 1 ? '' : 's'} to the library's latest version.` : 'Every battle already matches your library.'); }
        }, '⟳ Update battles from the library') : null,
        full ? h('p', { class: 'ws-note' }, `A chain holds up to ${MAX_CHAIN} battles.`) : null),
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, 'Check and play'),
        issues.length === 0
          ? h('p', { class: 'ws-ok' }, '✓ Ready to play.')
          : h('ul', { class: 'ws-issues' }, ...issues.map((i) => h('li', { class: i.level }, `${i.level === 'error' ? '✕' : '!'} ${i.text}`))),
        resume > 0 ? h('button', { class: 'ws-btn ws-primary ws-wide', 'data-k': 'ch-resume', onclick: () => this.tryPlayChain(resume) }, `▶ Continue from battle ${resume + 1}`) : null,
        h('button', { class: 'ws-btn ws-wide' + (resume > 0 ? '' : ' ws-primary'), 'data-k': 'ch-play', onclick: () => this.tryPlayChain(0) }, resume > 0 ? '▶ Start over from battle 1' : '▶ Play the chain')),
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, `Your chains (${chains.length})`),
        h('ul', { class: 'ws-list' }, ...chains.map((x) => h('li', { class: x.id === c.id ? 'current' : '' },
          h('button', {
            class: 'ws-list-btn', 'data-k': `chl-${x.id}`, disabled: x.id === c.id,
            onclick: () => { this.saveChainNow(); this.chain = x; this.say(`Opened the chain "${x.title}".`); this.render(); }
          }, x.title, h('small', {}, ` ${x.scenarios.length} battle${x.scenarios.length === 1 ? '' : 's'}${x.id === c.id ? ' · editing' : ''}`)),
          h('button', {
            class: 'ws-btn ws-danger', 'data-k': `chd-${x.id}`, 'aria-label': `Delete ${x.title}`,
            onclick: () => {
              if (this.confirmDelete !== x.id) { this.confirmDelete = x.id; this.say(`Press Delete again to remove the chain "${x.title}" (its scenarios stay in your library).`); this.render(); return; }
              this.confirmDelete = '';
              ChainLibrary.remove(x.id);
              if (x.id === c.id) this.chain = ChainLibrary.list()[0] || blankChain();
              this.say(`Deleted the chain "${x.title}".`);
              this.render();
            }
          }, this.confirmDelete === x.id ? 'Sure?' : 'Delete')))),
        h('button', { class: 'ws-btn ws-wide', 'data-k': 'ch-new', onclick: () => { this.saveChainNow(); this.chain = blankChain(); this.saveChainNow(); this.chainChanged('New chain. Give it a title, then add battles.'); } }, '+ New chain')),
      h('fieldset', { class: 'ws-group' },
        h('legend', {}, 'Share'),
        h('button', { class: 'ws-btn ws-wide', 'data-k': 'ch-export', onclick: () => this.exportChain() }, '⭳ Export chain .json'),
        h('button', {
          class: 'ws-btn ws-wide', 'data-k': 'ch-share',
          onclick: async () => {
            const url = `${location.origin}${location.pathname}#c=${await encodeChainShare(c)}`;
            shareOut.value = url;
            try { await navigator.clipboard.writeText(url); this.say(`Chain link copied (${url.length} characters).`); }
            catch { shareOut.select(); this.say('Copy the link from the box below.'); }
          }
        }, '🔗 Copy chain link'),
        shareOut,
        h('p', { class: 'ws-note' }, 'To load a chain file, use Import or paste it on the File tab.'))
    ].filter(Boolean) as Node[];
  }

  private exportChain(): void {
    const c = this.currentChain();
    const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${c.title.replace(/[^\w-]+/g, '_').slice(0, 40) || 'chain'}.chain.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    this.say('Exported the chain with all its battles.');
  }

  private replaceWith(s: Scenario, msg: string): void {
    this.saveNow();
    this.load(s);
    this.saveNow();
    SoundFX.playTurnChime();
    this.say(msg);
    this.render();
  }

  private importText(text: string): void {
    try {
      // A chain file opens on the Chains tab (0.42.0)
      let raw: unknown = null;
      try { raw = JSON.parse(text); } catch { /* parseScenario reports it */ }
      if (isChainLike(raw)) {
        const c = sanitizeChain(raw);
        c.id = blankChain().id; // a new entry, never overwriting your own chain
        this.chain = c;
        this.saveChainNow();
        SoundFX.playTurnChime();
        this.tab = 'chains';
        this.say(`Imported the chain "${c.title}" (${c.scenarios.length} battle${c.scenarios.length === 1 ? '' : 's'}).`);
        this.render();
        return;
      }
      const s = parseScenario(text);
      // Imports always become a new library entry so they never overwrite your own work
      s.id = blankScenario().id;
      this.replaceWith(s, `Imported "${s.title}".`);
    } catch (e) {
      this.say(e instanceof Error ? e.message : 'Import failed.');
    }
  }

  private exportFile(): void {
    const blob = new Blob([JSON.stringify(this.scenario, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${this.scenario.title.replace(/[^\w-]+/g, '_').slice(0, 40) || 'scenario'}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    this.say('Exported. Share the file, or use a share link.');
  }

  /** Text for the status bar while hovering a tile. */
  public describeTile(x: number, z: number): void {
    if (!this.isOpen) return;
    const t = this.grid.getTile(x, z);
    if (!t) return;
    const e = this.scenario.enemies.find((en) => en.x === x && en.z === z);
    const sp = (this.scenario.map.playerSpawns || []).findIndex((p) => p.x === x && p.z === z);
    const what = e ? ` · ${e.isBoss ? '★ ' : ''}${e.name}` : sp >= 0 ? ` · Squad deploy #${sp + 1}` : '';
    this.say(`(${x}, ${z}) ${t.terrain} h${t.height}${t.walkable ? '' : ' · blocked'}${what} — ${TOOL_INFO[this.tool].label}`);
  }
}
