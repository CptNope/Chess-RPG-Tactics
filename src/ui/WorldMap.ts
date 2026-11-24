/**
 * The world map shown between missions.
 *
 * A pixel map painted in code (no image files), with the locations as real buttons laid over it,
 * so mouse, touch, pen, keyboard and controller all work through the same focus navigation as the
 * menus. The rules (which battles are open, the roads) live in core/World.ts.
 */
import { CAMPAIGN_CHAPTERS } from '../data/campaign';
import { drawSprite } from '../graphics/CharacterArt';
import { Mission, WORLD_NODES, WORLD_ROADS, WorldNode, nodeState, openMissions, route, worldNode } from '../core/World';
import { SKIRMISHES, SKIRMISH_MAX_HEAT, skirmishBonus, skirmishLevel } from '../core/Skirmish';

export interface WorldState {
  /** The chapter the campaign is at. */
  current: string;
  cleared: string[];
  trialsOpen: boolean;
  /** The Trials floor the party would enter next. */
  trialsFloor: number;
  bestTrial: number;
  gil: number;
  leaderJob: string;
  /** Levels of the squad, for side-battle difficulty. */
  squadLevels: number[];
  /** Wins so far at each side-battle place. */
  skirmishWins: Record<string, number>;
}

export interface WorldHost {
  state(): WorldState;
  march(mission: Mission): void;
  enterTrials(): void;
  /** Starts the side battle at a place. */
  skirmish(id: string): void;
  newGamePlus(): void;
  openTeam(): void;
  openShop(): void;
  save(): void;
  /** Opens the system menu (sound, graphics, load, Workshop, title screen). */
  menu(): void;
  /** Moves keyboard / controller focus (no-op for mouse and touch). */
  focus(el: HTMLElement | null): void;
  /** The first-visit tip for the map, or null once it has been seen. */
  tip(): { title: string; text: string } | null;
  tipSeen(): void;
  blip(): void;
}

const W = 320;
const H = 180;

export class WorldMap {
  public isOpen = false;
  /** The location the party stands at. */
  public location = 'ruins';

  private root = document.getElementById('world-map')!;
  private nodesEl = document.getElementById('wm-nodes')!;
  private panelEl = document.getElementById('wm-panel')!;
  private gilEl = document.getElementById('wm-gil')!;
  private party = document.getElementById('wm-party')!;
  private painted = false;
  private walking = false;
  private partyJob = '';

  constructor(private host: WorldHost) {
    const on = (id: string, fn: () => void) => document.getElementById(id)!.addEventListener('click', () => { host.blip(); fn(); });
    on('wm-team', () => host.openTeam());
    on('wm-save', () => host.save());
    on('wm-menu', () => host.menu());
  }

  public open(location?: string): void {
    if (location && worldNode(location)) this.location = location;
    if (!worldNode(this.location)) this.location = 'ruins';
    if (!this.painted) {
      paintWorld(document.getElementById('wm-canvas') as HTMLCanvasElement);
      this.painted = true;
    }
    this.isOpen = true;
    this.walking = false;
    this.root.classList.remove('hidden');
    document.body.classList.add('world-open');
    this.refresh();
    this.placeParty(false);
    this.host.focus(this.panelEl.querySelector<HTMLElement>('.wm-action') || this.nodesEl.querySelector<HTMLElement>(`[data-node="${this.location}"]`));
  }

  public close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
    document.body.classList.remove('world-open');
  }

  /** Redraws the pins, the panel and the purse from the game's current state. */
  public refresh(): void {
    if (!this.isOpen) return;
    const st = this.host.state();
    // The pins and the panel are rebuilt below: remember where focus was so it isn't dropped
    const focused = document.activeElement as HTMLElement | null;
    const hadNode = focused && this.nodesEl.contains(focused) ? focused.dataset.node : undefined;
    const hadAction = focused && this.panelEl.contains(focused) ? [...this.panelEl.querySelectorAll('.wm-action')].indexOf(focused) : -1;
    this.gilEl.textContent = `${st.gil.toLocaleString('en-US')} G`;

    if (st.leaderJob !== this.partyJob) {
      this.partyJob = st.leaderJob;
      this.party.innerHTML = '';
      this.party.appendChild(drawSprite(st.leaderJob, 'S', false));
    }

    this.nodesEl.innerHTML = '';
    for (const node of WORLD_NODES) {
      const state = nodeState(node, st.current, st.cleared, st.trialsOpen);
      const btn = document.createElement('button');
      btn.className = `wm-node ${node.kind} ${state} ${node.id === this.location ? 'here' : ''}`;
      btn.dataset.node = node.id;
      btn.style.left = `${node.x * 100}%`;
      btn.style.top = `${node.y * 100}%`;
      const mark = node.kind === 'market' ? '◆' : state === 'cleared' ? '✓' : state === 'locked' ? '🔒' : node.kind === 'trials' ? '★' : node.kind === 'skirmish' ? '⚑' : '⚔';
      const what = node.kind === 'market' ? 'market' : state === 'cleared' ? 'cleared' : state === 'locked' ? 'locked' : node.kind === 'trials' ? 'the Trials' : node.kind === 'skirmish' ? 'side battle' : 'battle';
      btn.setAttribute('aria-label', `${node.name}: ${what}${node.id === this.location ? ', you are here' : ''}`);
      btn.innerHTML = `<span class="wm-pin" aria-hidden="true">${mark}</span><span class="wm-label">${node.name}</span>`;
      btn.addEventListener('click', () => void this.travel(node.id));
      this.nodesEl.appendChild(btn);
    }
    this.renderPanel(st);
    if (hadNode) this.nodesEl.querySelector<HTMLElement>(`[data-node="${hadNode}"]`)?.focus({ preventScroll: true });
    else if (focused && hadAction >= 0) (this.panelEl.querySelectorAll<HTMLElement>('.wm-action')[hadAction] || this.panelEl.querySelector<HTMLElement>('.wm-action'))?.focus({ preventScroll: true });
  }

  /** Walks the party along the roads to a location, then shows what can be done there. */
  private async travel(to: string): Promise<void> {
    if (this.walking || !this.isOpen) return;
    this.host.blip();
    if (to !== this.location) {
      this.walking = true;
      const path = route(this.location, to);
      for (const step of path.slice(1)) {
        this.location = step;
        this.placeParty(true);
        await new Promise((r) => setTimeout(r, 360));
        if (!this.isOpen) return;
      }
      this.walking = false;
    }
    this.refresh();
    this.host.focus(this.panelEl.querySelector<HTMLElement>('.wm-action') || this.nodesEl.querySelector<HTMLElement>(`[data-node="${this.location}"]`));
  }

  private placeParty(animate: boolean): void {
    const n = worldNode(this.location)!;
    this.party.classList.toggle('walking', animate);
    this.party.style.left = `${n.x * 100}%`;
    this.party.style.top = `${n.y * 100}%`;
  }

  private renderPanel(st: WorldState): void {
    const node = worldNode(this.location) as WorldNode;
    const state = nodeState(node, st.current, st.cleared, st.trialsOpen);
    const missions = openMissions(st.current, st.cleared);
    const p = this.panelEl;
    p.innerHTML = '';
    const add = (tag: string, cls: string, text: string) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = text;
      p.appendChild(el);
      return el;
    };
    const action = (label: string, fn: () => void, primary = false) => {
      const b = add('button', `wm-action ${primary ? 'primary' : ''}`, label) as HTMLButtonElement;
      b.addEventListener('click', () => { this.host.blip(); fn(); });
      return b;
    };

    const tip = this.host.tip();
    if (tip) {
      const box = add('div', 'wm-tip', '');
      const t = document.createElement('p');
      t.textContent = `${tip.title}: ${tip.text}`;
      const ok = document.createElement('button');
      ok.textContent = 'Got it';
      ok.addEventListener('click', () => { this.host.blip(); this.host.tipSeen(); this.refresh(); });
      box.append(t, ok);
    }

    add('h3', 'wm-place', node.name);
    add('p', 'wm-blurb', node.blurb);

    if (node.kind === 'market') {
      add('p', 'wm-status', 'The market is open. Stock up on potions before the next battle.');
      action('◆ Buy & sell', () => this.host.openShop(), true);
    } else if (node.kind === 'trials') {
      if (state === 'locked') {
        add('p', 'wm-status locked', 'Sealed. The gate opens when the realm is at peace.');
      } else {
        add('p', 'wm-status', `Next: floor ${st.trialsFloor}${st.bestTrial > 0 ? ` · Best: floor ${st.bestTrial}` : ''}`);
        action(`★ Enter floor ${st.trialsFloor}`, () => this.host.enterTrials(), true);
        action('New Game+ (replay the story with this squad)', () => this.host.newGamePlus());
      }
    } else if (node.kind === 'skirmish') {
      const def = SKIRMISHES[node.skirmishId!];
      const wins = st.skirmishWins[def.id] || 0;
      add('p', 'wm-chapter', `SIDE BATTLE: ${def.foe}`);
      if (state === 'locked') {
        add('p', 'wm-status locked', 'Nothing stirs here yet. Win more of the story first.');
      } else {
        const goal = def.objective?.type === 'survive' ? `Hold out for ${def.objective.rounds || 6} rounds.` : 'Defeat every enemy.';
        add('p', 'wm-orders', `${def.intro} ${goal}`);
        add('p', 'wm-status', `Enemies around Lv ${skirmishLevel(st.squadLevels, wins)}. ${wins > 0 ? `Won ${wins} time${wins > 1 ? 's' : ''}${wins < SKIRMISH_MAX_HEAT ? '; they come back stronger' : ''}.` : 'Not fought yet.'}`);
        add('p', 'wm-reward', `Optional and repeatable: bounties, +${skirmishBonus(wins)} G, EXP and JP.`);
        action('⚑ Fight', () => this.host.skirmish(def.id), true);
      }
    } else {
      const chapter = CAMPAIGN_CHAPTERS[node.chapterId!];
      add('p', 'wm-chapter', `${chapter.title}: ${chapter.subtitle}`);
      if (state === 'cleared') {
        add('p', 'wm-status won', '✓ This battle is won.');
      } else if (state === 'locked') {
        add('p', 'wm-status locked', 'The road here is not open.');
      } else {
        const mission = missions.find((m) => m.chapterId === node.chapterId)!;
        if (mission.choice) {
          add('p', 'wm-orders', `Orders: ${mission.choice.text}`);
          if (mission.choice.rewardText) add('p', 'wm-reward', `Reward for marching: ${mission.choice.rewardText}`);
          if (missions.length > 1) add('p', 'wm-status', 'Two roads lie open. Marching here closes the other.');
        }
        action('⚔ March to battle', () => this.host.march(mission), true);
      }
    }

    // Where to go next, when there's nothing to do here
    if (!p.querySelector('.wm-action.primary')) {
      const next = missions.map((m) => WORLD_NODES.find((n) => n.chapterId === m.chapterId)?.name).filter(Boolean);
      if (next.length) add('p', 'wm-hint', `Next battle: ${next.join(' or ')}. Select it on the map.`);
      else if (st.trialsOpen) add('p', 'wm-hint', 'The story is told. The Gate of Trials stands open.');
    }
  }
}

// ---------------------------------------------------------------------------
// Map painting: a small island realm, drawn pixel by pixel from noise and the node positions
// ---------------------------------------------------------------------------

function hash(x: number, y: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number, s: number) => vnoise(x, y, s) * 0.6 + vnoise(x * 2, y * 2, s + 1) * 0.3 + vnoise(x * 4, y * 4, s + 2) * 0.1;

/** Distance from a point to a segment, in map pixels. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

const RIVER: [number, number][] = [[0.8, 0.5], [0.66, 0.58], [0.5, 0.6], [0.38, 0.66], [0.3, 0.78], [0.2, 0.88], [0.13, 0.99]];

export function paintWorld(canvas: HTMLCanvasElement): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const pos = (id: string) => { const n = worldNode(id)!; return [n.x * W, n.y * H] as const; };
  const roads = WORLD_ROADS.map(([a, b]) => [...pos(a), ...pos(b)] as [number, number, number, number]);
  const [sx, sy] = pos('summit'), [tx, ty] = pos('trials'), [mx, my] = pos('mire'), [bx, by] = pos('battlement');

  const landAt = (x: number, y: number): number => {
    const nx = x / W, ny = y / H;
    const ellipse = 1 - ((nx - 0.5) / 0.55) ** 2 - ((ny - 0.54) / 0.52) ** 2;
    let v = ellipse * 0.5 + fbm(nx * 5.5, ny * 3.4, 7) * 0.75 - 0.38;
    // The locations and the roads between them are always on dry land
    for (const n of WORLD_NODES) v += Math.max(0, 0.5 - Math.hypot(x - n.x * W, y - n.y * H) / 34);
    for (const r of roads) v += Math.max(0, 0.3 - segDist(x, y, ...r) / 30);
    return v;
  };
  const put = (i: number, c: number) => { img.data[i] = c >> 16; img.data[i + 1] = (c >> 8) & 255; img.data[i + 2] = c & 255; img.data[i + 3] = 255; };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const v = landAt(x, y);
      const n = fbm(x / 18, y / 18, 31);
      const d = (x + y) % 2 === 0;
      let c: number;
      if (v < 0.2) {
        // Sea: deeper away from the coast, with rows of wave glints
        const wave = (y + Math.floor(vnoise(x / 9, y / 5, 3) * 6)) % 7 === 0 && hash(x >> 1, y, 5) < 0.5;
        c = v > 0.12 ? (d ? 0x2a6f9a : 0x256590) : v > 0.0 ? (wave ? 0x3a7fb0 : 0x1b4f7c) : wave ? 0x2a6396 : d ? 0x143a63 : 0x12345b;
      } else if (v < 0.26) {
        c = d ? 0xd9c58a : 0xcbb679; // beach
      } else {
        const mountain = Math.max(1 - Math.hypot(x - sx, y - sy) / 46, 1 - Math.hypot(x - tx, y - ty) / 34) + n * 0.35;
        const swamp = 1 - Math.hypot(x - mx, (y - my) * 1.3) / 34 + n * 0.3;
        const keep = 1 - Math.hypot(x - bx, y - by) / 22;
        if (mountain > 0.92) c = d ? 0xe6edf5 : 0xcfd8e3; // snow
        else if (mountain > 0.62) c = hash(x, y, 9) < 0.18 ? 0x5d6270 : d ? 0x7a7f8c : 0x6e7380; // rock
        else if (swamp > 0.62) c = hash(x, y, 11) < 0.12 ? 0x4a3f5c : d ? 0x3d5a45 : 0x35503e; // bog
        else if (keep > 0.35) c = d ? 0x4a7a3f : 0x436f3a; // trampled ground round the fortress
        else if (fbm(x / 11, y / 8, 21) > 0.6) c = hash(x, y, 13) < 0.3 ? 0x1c4a24 : d ? 0x245c2a : 0x1f5226; // forest
        else c = hash(x, y, 17) < 0.06 ? 0x4c9a45 : d ? 0x3f8a3a : 0x3a8236; // grass
      }
      put(i, c);
    }
  }
  ctx.putImageData(img, 0, 0);

  // River from the summit to the sea, past the ruins
  for (let s = 0; s < RIVER.length - 1; s++) {
    const [ax, ay] = RIVER[s], [bx2, by2] = RIVER[s + 1];
    const steps = Math.ceil(Math.hypot((bx2 - ax) * W, (by2 - ay) * H));
    for (let k = 0; k <= steps; k++) {
      const x = Math.round((ax + ((bx2 - ax) * k) / steps) * W + Math.sin((k + s * 9) / 5) * 1.5);
      const y = Math.round((ay + ((by2 - ay) * k) / steps) * H);
      if (landAt(x, y) < 0.2) continue;
      ctx.fillStyle = '#2f86c4';
      ctx.fillRect(x - 1, y, 3, 2);
      ctx.fillStyle = '#6fc0ee';
      if (k % 3 === 0) ctx.fillRect(x, y, 1, 1);
    }
  }

  // Roads: dotted trails between the locations
  for (const [ax, ay, bx2, by2] of roads) {
    const steps = Math.ceil(Math.hypot(bx2 - ax, by2 - ay));
    for (let k = 0; k <= steps; k++) {
      if (k % 4 > 1) continue;
      const x = Math.round(ax + ((bx2 - ax) * k) / steps), y = Math.round(ay + ((by2 - ay) * k) / steps);
      ctx.fillStyle = '#3b2a17';
      ctx.fillRect(x, y + 1, 1, 1);
      ctx.fillStyle = '#e8d9a8';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const r = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const icon: Record<string, (x: number, y: number) => void> = {
    market: (x, y) => {
      r(x - 8, y - 2, 7, 5, '#f4efe2'); r(x - 8, y - 2, 7, 1, '#c0392b'); r(x - 6, y - 4, 3, 2, '#c0392b'); r(x - 5, y - 5, 1, 1, '#f4c430');
      r(x + 1, y - 3, 8, 6, '#f4efe2'); r(x + 1, y - 3, 8, 1, '#2563eb'); r(x + 3, y - 5, 4, 2, '#2563eb'); r(x + 4, y - 6, 2, 1, '#f4c430');
      r(x - 6, y + 1, 2, 2, '#3b2a17'); r(x + 4, y + 1, 2, 2, '#3b2a17');
    },
    ruins: (x, y) => {
      r(x - 7, y - 6, 3, 9, '#b9bec9'); r(x - 7, y - 6, 3, 1, '#e6edf5'); r(x - 2, y - 3, 3, 6, '#a3a8b4'); r(x - 2, y - 3, 3, 1, '#d3d8e2');
      r(x + 3, y - 8, 3, 11, '#b9bec9'); r(x + 3, y - 8, 3, 1, '#e6edf5'); r(x - 8, y + 3, 15, 1, '#6e7380'); r(x + 7, y + 1, 2, 2, '#8b909c');
    },
    mire: (x, y) => {
      r(x - 8, y + 1, 16, 3, '#4a3f5c'); r(x - 5, y + 2, 9, 1, '#7a5fa0');
      r(x - 1, y - 7, 2, 9, '#2b2018'); r(x - 4, y - 6, 3, 1, '#2b2018'); r(x - 5, y - 8, 1, 2, '#2b2018'); r(x + 1, y - 4, 4, 1, '#2b2018'); r(x + 4, y - 6, 1, 2, '#2b2018');
    },
    battlement: (x, y) => {
      r(x - 8, y - 3, 16, 7, '#565b6b'); r(x - 8, y - 5, 3, 2, '#565b6b'); r(x - 3, y - 5, 3, 2, '#565b6b'); r(x + 2, y - 5, 3, 2, '#565b6b'); r(x + 6, y - 5, 2, 2, '#565b6b');
      r(x - 2, y - 10, 5, 7, '#6a7082'); r(x - 2, y - 11, 1, 1, '#6a7082'); r(x + 2, y - 11, 1, 1, '#6a7082'); r(x - 1, y - 1, 3, 5, '#1b1f2b'); r(x, y - 8, 1, 2, '#f4c430');
      r(x - 8, y - 3, 16, 1, '#7a8094');
    },
    summit: (x, y) => {
      for (let k = 0; k < 11; k++) r(x - k, y - 10 + k, k * 2 + 1, 1, k < 3 ? '#f4f7fb' : k % 2 ? '#8b909c' : '#7a7f8c');
      r(x, y - 15, 1, 5, '#f4c430'); r(x - 2, y - 13, 5, 1, '#f4c430'); r(x - 1, y - 14, 3, 3, '#ffe27a');
    },
    trials: (x, y) => {
      r(x - 6, y - 8, 3, 12, '#6e7380'); r(x + 3, y - 8, 3, 12, '#6e7380'); r(x - 6, y - 10, 12, 3, '#8b909c'); r(x - 6, y - 10, 12, 1, '#c3c8d2');
      r(x - 3, y - 7, 6, 11, '#3b1d6e'); r(x - 2, y - 5, 4, 8, '#7c3aed'); r(x - 1, y - 3, 2, 4, '#c4b5fd');
    }
  };
  // Side battles: a camp with a pennant
  const camp = (x: number, y: number) => {
    for (let k = 0; k < 5; k++) r(x - 6 + (4 - k), y - 4 + k, k * 2 + 1, 1, k % 2 ? '#b08a4a' : '#c9a25c');
    r(x - 2, y - 1, 1, 2, '#3b2a17');
    r(x + 4, y - 9, 1, 10, '#3b2a17'); r(x + 5, y - 9, 4, 3, '#d97706'); r(x + 5, y - 8, 3, 1, '#fbbf24');
    r(x + 1, y + 1, 2, 1, '#f97316'); r(x + 1, y, 1, 1, '#fde68a');
  };
  for (const n of WORLD_NODES) (icon[n.id] || (n.kind === 'skirmish' ? camp : undefined))?.(n.x * W, n.y * H - 4);
}
