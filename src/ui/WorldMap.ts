/**
 * The world map shown between missions.
 *
 * A pixel map painted in code (no image files), with the locations as real buttons laid over it,
 * so mouse, touch, pen, keyboard and controller all work through the same focus navigation as the
 * menus. The rules (which battles are open, the roads) live in core/World.ts.
 */
import { CAMPAIGN_CHAPTERS } from '../data/campaign';
import { drawSprite } from '../graphics/CharacterArt';
import { Mission, Region, SEA_PORTS, WORLD_NODES, WORLD_ROADS, WorldNode, nodeState, openMissions, regionOf, route, worldNode } from '../core/World';
import { SKIRMISHES, SKIRMISH_MAX_HEAT, skirmishBonus, skirmishLevel } from '../core/Skirmish';
import { SIDE_STORIES, sideFoeLevel } from '../core/SideStory';
import type { NodeState } from '../core/World';
import { MERCHANT_NAME, MerchantVisit } from '../core/Merchant';
import { ITEMS } from '../data/items';
import { itemStatText } from '../core/Economy';
import { CAMP_JP } from '../data/camp';
import { JOBS } from '../data/jobs';
import { MAX_SQUAD, PARTY_SIZE, RecruitOffer } from '../core/Recruits';

export interface WorldState {
  /** The chapter the campaign is at. */
  current: string;
  cleared: string[];
  trialsOpen: boolean;
  /** New Game+ is offered at the Gate only once the whole story is won. */
  newGamePlus: boolean;
  /** The Trials floor the party would enter next. */
  trialsFloor: number;
  bestTrial: number;
  gil: number;
  leaderJob: string;
  /** Levels of the squad, for side-battle difficulty. */
  squadLevels: number[];
  /** Wins so far at each side-battle place. */
  skirmishWins: Record<string, number>;
  /** Owned gear ids (a side battle's trophy shows as won). */
  armory: string[];
  /** Where the travelling merchant is and what she sells (0.21.0), or null. */
  merchant: MerchantVisit | null;
  /** The camp scene waiting to be played (0.21.0), or null. */
  camp: { title: string } | null;
  /** How many camp nights this save remembers, to watch again (0.39.0). */
  memories: number;
  /** The market's recruiting board (0.25.0). */
  recruits: RecruitOffer[];
  /** How many units the squad has. */
  squadSize: number;
  /** Ships sail for the Far Shore (0.34.0). */
  farShore: boolean;
  /** How each recruit side story's place shows (0.43.0): locked ones aren't shown. */
  sideStories: Record<string, NodeState>;
}

export interface WorldHost {
  state(): WorldState;
  march(mission: Mission): void;
  enterTrials(): void;
  /** Starts the side battle at a place. */
  skirmish(id: string): void;
  /** Starts a recruit's side story (0.43.0). */
  sideStory(id: string): void;
  /** Buys a piece from the travelling merchant. False when the purse is short. */
  buyFromMerchant(id: string): boolean;
  /** Plays the waiting camp scene. */
  makeCamp(): void;
  /** Lists the remembered camp nights, to watch one again (0.39.0). */
  memories(): void;
  /** Hires a hopeful from the recruiting board (0.25.0). False when it can't be done. */
  hire(slot: number): boolean;
  /** Opens the barracks: pick the party, dismiss hired units (0.25.0). */
  barracks(): void;
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
  /** The region painted on the canvas (0.34.0): the realm or the Far Shore. */
  private paintedRegion: Region | null = null;
  private titleEl = document.querySelector<HTMLElement>('#world-map h2');
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
    this.isOpen = true;
    this.paintRegion();
    this.walking = false;
    this.root.inert = false; // a camp scene cut short (by loading a save) must not leave the map frozen
    this.root.classList.remove('hidden');
    document.body.classList.add('world-open');
    this.refresh();
    this.placeParty(false);
    this.host.focus(this.panelEl.querySelector<HTMLElement>('.wm-action') || this.nodesEl.querySelector<HTMLElement>(`[data-node="${this.location}"]`));
  }

  /** Paints the region the party is in, if it isn't already showing. */
  private paintRegion(): void {
    const region = regionOf(this.location);
    if (region === this.paintedRegion) return;
    paintWorld(document.getElementById('wm-canvas') as HTMLCanvasElement, region);
    this.paintedRegion = region;
    if (this.titleEl) this.titleEl.textContent = region === 'shore' ? 'THE FAR SHORE' : 'THE REALM';
  }

  /** Takes ship to the other region's harbour (0.34.0). */
  private sail(to: Region): void {
    if (this.walking || !this.isOpen) return;
    this.location = SEA_PORTS[to];
    this.paintRegion();
    this.refresh();
    this.placeParty(false);
    this.focusDefault();
  }

  /** Puts focus where opening the map does: the first action here, or the party's pin. */
  public focusDefault(): void {
    this.host.focus(this.panelEl.querySelector<HTMLElement>('.wm-action:not(:disabled)') || this.nodesEl.querySelector<HTMLElement>(`[data-node="${this.location}"]`));
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

    this.paintRegion();
    const region = regionOf(this.location);
    this.nodesEl.innerHTML = '';
    for (const node of WORLD_NODES.filter((n) => (n.region || 'realm') === region)) {
      const state = nodeState(node, st.current, st.cleared, st.trialsOpen, st.sideStories);
      // A side story's place appears once its story opens (0.43.0)
      if (node.kind === 'story' && state === 'locked' && node.id !== this.location) continue;
      const btn = document.createElement('button');
      const merchantHere = st.merchant?.nodeId === node.id;
      btn.className = `wm-node ${node.kind} ${state} ${node.id === this.location ? 'here' : ''} ${merchantHere ? 'has-merchant' : ''}`;
      btn.dataset.node = node.id;
      btn.style.left = `${node.x * 100}%`;
      btn.style.top = `${node.y * 100}%`;
      const mark = node.kind === 'port' ? '⛵' : node.kind === 'market' ? '◆' : state === 'cleared' ? '✓' : state === 'locked' ? '🔒' : node.kind === 'trials' ? '★' : node.kind === 'skirmish' ? '⚑' : node.kind === 'story' ? '✦' : '⚔';
      const what = node.kind === 'port' ? 'harbour' : node.kind === 'market' ? 'market' : state === 'cleared' ? 'cleared' : state === 'locked' ? 'locked' : node.kind === 'trials' ? 'the Trials' : node.kind === 'skirmish' ? 'side battle' : node.kind === 'story' ? 'side story' : 'battle';
      btn.setAttribute('aria-label', `${node.name}: ${what}${merchantHere ? ', travelling merchant' : ''}${node.id === this.location ? ', you are here' : ''}`);
      btn.innerHTML = `<span class="wm-pin" aria-hidden="true">${mark}</span><span class="wm-label">${node.name}</span>${merchantHere ? '<span class="wm-merchant-badge" aria-hidden="true" title="Travelling merchant">🎒</span>' : ''}`;
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
    const state = nodeState(node, st.current, st.cleared, st.trialsOpen, st.sideStories);
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

    if (st.camp) {
      const box = add('div', 'wm-camp', '');
      const t = document.createElement('p');
      t.textContent = `🔥 The squad makes camp: ${st.camp.title}`;
      const go = document.createElement('button');
      go.className = 'wm-action';
      go.textContent = `Sit by the fire (+${CAMP_JP} JP each)`;
      go.addEventListener('click', () => { this.host.blip(); this.host.makeCamp(); });
      box.append(t, go);
    } else if (st.memories > 0) {
      // Camp nights already seen can be watched again (0.39.0)
      const again = document.createElement('button');
      again.className = 'wm-action wm-memories';
      again.textContent = `📖 Memories by the fire (${st.memories})`;
      again.addEventListener('click', () => { this.host.blip(); this.host.memories(); });
      add('div', 'wm-camp-again', '').append(again);
    }

    add('h3', 'wm-place', node.name);
    add('p', 'wm-blurb', node.blurb);

    if (node.kind === 'port') {
      add('p', 'wm-status', 'The ship from Emberwick waits here. Its quartermaster trades from the same stock as Larkmoor Market; for hires, sail home.');
      action('◆ Buy & sell (ship\'s stores)', () => this.host.openShop());
      action('⛵ Sail home to Emberwick Harbor', () => this.sail('realm'), true);
    } else if (node.kind === 'market') {
      add('p', 'wm-status', 'The market is open. Stock up on potions before the next battle.');
      action('◆ Buy & sell', () => this.host.openShop(), true);
      this.renderRecruits(st);
    } else if (node.kind === 'trials') {
      if (state === 'locked') {
        add('p', 'wm-status locked', 'Sealed. The gate opens once the Zodiac Seal on the Summit is won.');
      } else {
        add('p', 'wm-status', `Next: floor ${st.trialsFloor}${st.bestTrial > 0 ? ` · Best: floor ${st.bestTrial}` : ''}`);
        action(`★ Enter floor ${st.trialsFloor}`, () => this.host.enterTrials(), true);
        if (st.newGamePlus) action('New Game+ (replay the story with this squad)', () => this.host.newGamePlus());
      }
    } else if (node.kind === 'skirmish') {
      const def = SKIRMISHES[node.skirmishId!];
      const wins = st.skirmishWins[def.id] || 0;
      add('p', 'wm-chapter', `SIDE BATTLE: ${def.foe}`);
      if (state === 'locked') {
        add('p', 'wm-status locked', 'Nothing stirs here yet. Win more of the story first.');
      } else {
        const goal = def.objective?.type === 'survive' ? `Hold out for ${def.objective.rounds || 6} rounds.`
          : def.objective?.type === 'hold' ? `Hold the marked ground for ${def.objective.rounds || 3} rounds, or defeat every enemy.` : 'Defeat every enemy.';
        add('p', 'wm-orders', `${def.intro} ${goal}`);
        add('p', 'wm-status', `Enemies around Lv ${skirmishLevel(st.squadLevels, wins)}. ${wins > 0 ? `Won ${wins} time${wins > 1 ? 's' : ''}${wins < SKIRMISH_MAX_HEAT ? '; they come back stronger' : ''}.` : 'Not fought yet.'}`);
        add('p', 'wm-reward', `Optional and repeatable: bounties, +${skirmishBonus(wins)} G, EXP and JP.`);
        const trophy = ITEMS[def.trophy];
        if (trophy) add('p', st.armory.includes(def.trophy) ? 'wm-status won' : 'wm-reward', st.armory.includes(def.trophy) ? `✓ Trophy won: ${trophy.name}` : `First win: ${trophy.name} (${itemStatText(trophy)})`);
        action('⚑ Fight', () => this.host.skirmish(def.id), true);
      }
    } else if (node.kind === 'story') {
      // A recruit's side story (0.43.0)
      const def = SIDE_STORIES[node.storyId!];
      const relic = ITEMS[def.relic];
      add('p', 'wm-chapter', `SIDE STORY: ${def.hero.name} · ${def.title}`);
      if (state === 'cleared') {
        add('p', 'wm-status won', `✓ Told.${relic ? ` ${relic.name} won.` : ''}`);
      } else if (state === 'locked') {
        add('p', 'wm-status locked', 'Nothing calls you here yet.');
      } else {
        const boss = def.foes.find((f) => f.isBoss);
        const goal = def.objective?.type === 'boss' && boss ? `Defeat ${boss.name}; the rest will flee.` : 'Defeat every enemy.';
        add('p', 'wm-orders', `${def.orders} ${goal}`);
        add('p', 'wm-status', `${def.hero.name} fights this one. Enemies around Lv ${sideFoeLevel(def, st.squadLevels)}. Told once.`);
        if (relic) add('p', 'wm-reward', `Reward: ${relic.name} (${itemStatText(relic)}), a relic.`);
        action(`✦ Go with ${def.hero.name}`, () => this.host.sideStory(def.id), true);
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

    // Ships for the Far Shore leave from Emberwick once the Regent is beaten (0.34.0)
    if (node.id === SEA_PORTS.realm && st.farShore) action('⛵ Sail to the Far Shore', () => this.sail('shore'), !p.querySelector('.wm-action.primary'));

    this.renderMerchant(st);

    // Where to go next, when there's nothing to do here
    if (!p.querySelector('.wm-action.primary')) {
      const here = regionOf(this.location);
      const nextNodes = missions.map((m) => WORLD_NODES.find((n) => n.chapterId === m.chapterId)).filter((n): n is WorldNode => !!n);
      const away = nextNodes.filter((n) => (n.region || 'realm') !== here);
      if (nextNodes.length && away.length === nextNodes.length) {
        add('p', 'wm-hint', here === 'realm'
          ? `Next battle: ${away.map((n) => n.name).join(' or ')}, across the sea. Take ship at Emberwick Harbor.`
          : `Next battle: ${away.map((n) => n.name).join(' or ')}, back in the realm. Sail home from the Anchorage.`);
      } else if (nextNodes.length) add('p', 'wm-hint', `Next battle: ${nextNodes.map((n) => n.name).join(' or ')}. Select it on the map.`);
      else if (st.trialsOpen) add('p', 'wm-hint', 'The story is told. The Gate of Trials stands open.');
    }
  }

  /** The recruiting board at the market (0.25.0): three hopefuls, and the barracks. */
  private renderRecruits(st: WorldState): void {
    const p = this.panelEl;
    const box = document.createElement('div');
    box.className = 'wm-recruits';
    const head = document.createElement('p');
    head.className = 'wm-merchant-head';
    const full = st.squadSize >= MAX_SQUAD;
    head.textContent = `🛡 Recruiting board. Barracks ${st.squadSize}/${MAX_SQUAD}${st.squadSize > PARTY_SIZE ? ` · ${PARTY_SIZE} fight, you choose who` : ''}. New faces after your next win.`;
    box.appendChild(head);
    for (const r of st.recruits) {
      const row = document.createElement('div');
      row.className = 'wm-ware wm-recruit';
      const pic = document.createElement('canvas');
      pic.width = 48;
      pic.height = 48;
      pic.className = 'wm-recruit-sprite';
      pic.getContext('2d')!.drawImage(drawSprite(r.jobId, 'S', false, 'idle0'), 0, 0);
      const text = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = `${r.name} · ${JOBS[r.jobId]?.name || r.jobId} Lv ${r.level}`;
      const note = document.createElement('small');
      note.textContent = `“${r.pitch}”`;
      text.append(name, document.createElement('br'), note);
      const hire = document.createElement('button');
      hire.className = 'wm-action';
      hire.textContent = r.hired ? 'Hired' : `Hire ${r.price.toLocaleString('en-US')} G`;
      hire.setAttribute('aria-label', r.hired ? `${r.name}: hired` : `Hire ${r.name}, ${JOBS[r.jobId]?.name} level ${r.level}, for ${r.price} gil`);
      hire.disabled = !!r.hired || full || st.gil < r.price;
      if (!r.hired && hire.disabled) hire.title = full ? `The barracks are full (${MAX_SQUAD})` : 'Not enough gil';
      if (r.hired) row.classList.add('sold');
      hire.addEventListener('click', () => {
        this.host.blip();
        if (this.host.hire(r.slot)) this.refresh();
      });
      row.append(pic, text, hire);
      box.appendChild(row);
    }
    p.appendChild(box);
    const b = document.createElement('button');
    b.className = 'wm-action';
    b.textContent = st.squadSize > PARTY_SIZE ? `⚑ Barracks: choose your party (${PARTY_SIZE} of ${st.squadSize})` : `⚑ Barracks (${st.squadSize}/${MAX_SQUAD})`;
    b.addEventListener('click', () => { this.host.blip(); this.host.barracks(); });
    p.appendChild(b);
  }

  /** The travelling merchant's blanket, when she is here; a pointer to her when she isn't. */
  private renderMerchant(st: WorldState): void {
    const m = st.merchant;
    if (!m) return;
    const p = this.panelEl;
    if (m.nodeId !== this.location) {
      const where = worldNode(m.nodeId)?.name;
      const hint = document.createElement('p');
      hint.className = 'wm-hint';
      hint.textContent = `🎒 ${MERCHANT_NAME} has set up at ${where}${regionOf(this.location) === 'shore' ? ', back in the realm' : ''}.`;
      p.appendChild(hint);
      return;
    }
    const box = document.createElement('div');
    box.className = 'wm-merchant';
    const head = document.createElement('p');
    head.className = 'wm-merchant-head';
    head.textContent = `🎒 ${MERCHANT_NAME} has spread a blanket by the road. She moves on after your next win.`;
    box.appendChild(head);
    for (const w of m.wares) {
      const it = ITEMS[w.id];
      if (!it) continue;
      const row = document.createElement('div');
      row.className = 'wm-ware';
      const text = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = it.name;
      const note = document.createElement('small');
      note.textContent = `${itemStatText(it)} · ${w.kind === 'own' ? 'only she sells this' : 'early: the market stocks it after the next chapter'}`;
      text.append(name, document.createElement('br'), note);
      const buy = document.createElement('button');
      buy.className = 'wm-action';
      buy.textContent = w.sold ? 'Sold' : `Buy ${w.price.toLocaleString('en-US')} G`;
      buy.setAttribute('aria-label', w.sold ? `${it.name}: sold to you` : `Buy ${it.name} for ${w.price} gil`);
      buy.disabled = !!w.sold || st.gil < w.price;
      if (!w.sold && buy.disabled) buy.title = 'Not enough gil';
      if (w.sold) row.classList.add('sold');
      buy.addEventListener('click', () => {
        this.host.blip();
        if (this.host.buyFromMerchant(w.id)) this.refresh();
      });
      row.append(text, buy);
      box.appendChild(row);
    }
    p.appendChild(box);
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

export function paintWorld(canvas: HTMLCanvasElement, region: Region = 'realm'): void {
  if (region === 'shore') return paintShore(canvas);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const pos = (id: string) => { const n = worldNode(id)!; return [n.x * W, n.y * H] as const; };
  const REALM_NODES = WORLD_NODES.filter((n) => !n.region);
  const roads = WORLD_ROADS.filter(([a, b]) => regionOf(a) === 'realm' && regionOf(b) === 'realm').map(([a, b]) => [...pos(a), ...pos(b)] as [number, number, number, number]);
  const [sx, sy] = pos('summit'), [tx, ty] = pos('trials'), [mx, my] = pos('mire'), [bx, by] = pos('battlement');

  const landAt = (x: number, y: number): number => {
    const nx = x / W, ny = y / H;
    const ellipse = 1 - ((nx - 0.5) / 0.55) ** 2 - ((ny - 0.54) / 0.52) ** 2;
    let v = ellipse * 0.5 + fbm(nx * 5.5, ny * 3.4, 7) * 0.75 - 0.38;
    // The locations and the roads between them are always on dry land
    for (const n of REALM_NODES) v += Math.max(0, 0.5 - Math.hypot(x - n.x * W, y - n.y * H) / 34);
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
    harbor: (x, y) => {
      r(x - 9, y + 1, 18, 2, '#6b4a2a'); r(x - 7, y + 3, 1, 2, '#3b2a17'); r(x + 5, y + 3, 1, 2, '#3b2a17'); // pier
      r(x - 5, y - 2, 9, 3, '#3b2a17'); r(x - 4, y - 1, 7, 1, '#8b5a2b'); r(x - 1, y - 10, 1, 8, '#3b2a17'); // hull and mast
      r(x, y - 9, 5, 4, '#1f2937'); r(x, y - 9, 5, 1, '#111827'); r(x + 1, y - 7, 2, 1, '#e5e7eb'); // black sail
    },
    isle: (x, y) => {
      r(x - 7, y + 1, 14, 3, '#7a7f8c'); r(x - 5, y, 10, 1, '#8b909c'); // rock
      r(x - 2, y - 9, 4, 10, '#e5e7eb'); r(x - 2, y - 6, 4, 2, '#b91c1c'); r(x - 2, y - 2, 4, 1, '#b91c1c'); // tower
      r(x - 3, y - 11, 6, 2, '#374151'); r(x - 1, y - 11, 2, 2, '#fde68a'); r(x - 7, y - 11, 4, 1, '#fde68a'); r(x + 3, y - 11, 4, 1, '#fde68a'); // lamp and beam
    },
    cape: (x, y) => {
      r(x - 8, y + 1, 16, 3, '#6e7380'); r(x - 6, y, 12, 1, '#8b909c'); // headland
      r(x - 6, y - 8, 2, 9, '#b9bec9'); r(x + 4, y - 8, 2, 9, '#b9bec9'); r(x - 6, y - 10, 12, 2, '#d3d8e2'); // sea arch
      r(x - 2, y - 3, 4, 3, '#4b5563'); r(x - 1, y - 5, 2, 2, '#38bdf8'); r(x - 1, y - 6, 1, 1, '#bae6fd'); // altar and its light
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
  // A recruit's village (0.43.0): two little houses with lit windows
  const cottage = (x: number, y: number) => {
    for (const [dx, w, h, roof] of [[-7, 7, 5, '#9a3412'], [1, 6, 4, '#7c2d12']] as [number, number, number, string][]) {
      r(x + dx, y - h, w, h, '#d6c2a0'); r(x + dx, y - h, w, 1, '#efe2c8');
      for (let k = 0; k < 3; k++) r(x + dx - 1 + k, y - h - 1 - k, w + 2 - k * 2, 1, roof);
      r(x + dx + 2, y - h + 2, 2, 1, '#fbbf24');
    }
    r(x - 8, y + 1, 16, 1, '#5b4a2a');
  };
  for (const n of REALM_NODES) (icon[n.id] || (n.kind === 'skirmish' ? camp : n.kind === 'story' ? cottage : undefined))?.(n.x * W, n.y * H - 4);
}

/**
 * The Far Shore (0.34.0): a desert coast in the south, scrub inland, and snowy mountains in the
 * north where the pass climbs. Out in the eastern bay, pale towers are rising from the sea.
 */
function paintShore(canvas: HTMLCanvasElement): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const SHORE = WORLD_NODES.filter((n) => n.region === 'shore');
  const pos = (id: string) => { const n = worldNode(id)!; return [n.x * W, n.y * H] as const; };
  const roads = WORLD_ROADS.filter(([a, b]) => regionOf(a) === 'shore' && regionOf(b) === 'shore').map(([a, b]) => [...pos(a), ...pos(b)] as [number, number, number, number]);
  const [fx, fy] = pos('frostfang');
  const city = [worldNode('drowned_city')!.x * W, worldNode('drowned_city')!.y * H + 4] as const;

  const landAt = (x: number, y: number): number => {
    const nx = x / W, ny = y / H;
    const ellipse = 1 - ((nx - 0.6) / 0.62) ** 2 - ((ny - 0.32) / 0.6) ** 2;
    let v = ellipse * 0.55 + fbm(nx * 5, ny * 3.2, 41) * 0.7 - 0.36;
    v -= Math.max(0, 0.9 - Math.hypot(x - city[0], (y - city[1]) * 1.2) / 40); // the bay of the drowned city
    for (const n of SHORE) v += Math.max(0, 0.5 - Math.hypot(x - n.x * W, y - n.y * H) / 30);
    for (const r of roads) v += Math.max(0, 0.3 - segDist(x, y, ...r) / 26);
    return v;
  };
  const put = (i: number, c: number) => { img.data[i] = c >> 16; img.data[i + 1] = (c >> 8) & 255; img.data[i + 2] = c & 255; img.data[i + 3] = 255; };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const v = landAt(x, y);
      const n = fbm(x / 16, y / 16, 51);
      const d = (x + y) % 2 === 0;
      let c: number;
      if (v < 0.2) {
        const wave = (y + Math.floor(vnoise(x / 9, y / 5, 43) * 6)) % 7 === 0 && hash(x >> 1, y, 45) < 0.5;
        c = v > 0.12 ? (d ? 0x2f8aa6 : 0x2a7f9a) : v > 0.0 ? (wave ? 0x3f94b8 : 0x1f6080) : wave ? 0x2a6c96 : d ? 0x154565 : 0x133f5d;
      } else if (v < 0.27) {
        c = hash(x, y, 47) < 0.05 ? 0x7fe0d0 : d ? 0xead7a2 : 0xdcc690; // sea-glass beach
      } else {
        const mountain = 1 - Math.hypot(x - fx, (y - fy) * 1.4) / 80 + n * 0.35 + (1 - y / H) * 0.25;
        const desert = y / H + n * 0.2;
        if (mountain > 0.95) c = d ? 0xf2f6fb : 0xdde5ef; // snow
        else if (mountain > 0.72) c = hash(x, y, 49) < 0.2 ? 0x5b5f6c : d ? 0x7d7f8a : 0x707280; // rock
        else if (desert > 0.55) c = (y + Math.floor(fbm(x / 7, y / 3, 53) * 5)) % 4 === 0 ? 0xc9a865 : d ? 0xd8b978 : 0xd2b272; // dunes
        else c = hash(x, y, 55) < 0.12 ? 0x6b7a3a : d ? 0xa89a5c : 0x9c8f54; // dry scrub
      }
      put(i, c);
    }
  }
  ctx.putImageData(img, 0, 0);

  for (const [ax, ay, bx2, by2] of roads) {
    const steps = Math.ceil(Math.hypot(bx2 - ax, by2 - ay));
    for (let k = 0; k <= steps; k++) {
      if (k % 4 > 1) continue;
      const x = Math.round(ax + ((bx2 - ax) * k) / steps), y = Math.round(ay + ((by2 - ay) * k) / steps);
      ctx.fillStyle = '#5a3d22';
      ctx.fillRect(x, y + 1, 1, 1);
      ctx.fillStyle = '#f4e8c4';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const r = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const icon: Record<string, (x: number, y: number) => void> = {
    anchorage: (x, y) => {
      r(x - 6, y - 2, 12, 3, '#3b2a17'); r(x - 5, y - 1, 10, 1, '#8b5a2b'); r(x - 1, y - 11, 1, 9, '#3b2a17'); // hull and mast
      r(x, y - 10, 6, 5, '#f4efe2'); r(x, y - 10, 6, 1, '#d9d0bc'); r(x - 6, y - 9, 5, 4, '#e8e1d0'); // white sails
      r(x - 8, y + 2, 16, 1, '#7fc8e8'); // wake
    },
    saltglass: (x, y) => {
      r(x - 7, y - 7, 3, 10, '#e6dcc2'); r(x - 7, y - 7, 3, 1, '#fffaf0'); r(x + 3, y - 4, 3, 7, '#d6cbb0'); r(x + 3, y - 4, 3, 1, '#fffaf0');
      r(x - 9, y + 3, 18, 1, '#b8995a'); r(x - 2, y + 1, 2, 2, '#c9b48a'); r(x + 1, y - 1, 1, 1, '#7fe0d0'); r(x - 4, y + 2, 1, 1, '#7fe0d0');
    },
    frostfang: (x, y) => {
      for (let k = 0; k < 11; k++) r(x - k, y - 10 + k, k * 2 + 1, 1, k < 4 ? '#f4f7fb' : k % 2 ? '#8b909c' : '#7a7f8c');
      r(x - 3, y - 2, 7, 4, '#565b6b'); r(x - 3, y - 3, 1, 1, '#565b6b'); r(x + 3, y - 3, 1, 1, '#565b6b'); r(x, y, 1, 2, '#1b1f2b'); r(x, y - 7, 1, 2, '#ef4444');
    }
  };
  // The drowned city: pale towers rising out of the bay, the sea pulling back around them (0.35.0: its own place)
  icon.drowned_city = (x, y) => {
    for (const [dx, h] of [[-8, 9], [-3, 14], [2, 11], [7, 7]]) { r(x + dx, y - h, 3, h, '#eef2f7'); r(x + dx, y - h, 3, 1, '#ffffff'); r(x + dx + 1, y - h - 2, 1, 2, '#c7d2e0'); }
    r(x - 11, y, 22, 1, '#a9d8ee'); r(x - 9, y + 2, 18, 1, '#7fc8e8');
  };
  // A side battle's camp: a lean-to and a flag
  const camp = (x: number, y: number) => {
    for (let k = 0; k < 5; k++) r(x - 6 + (4 - k), y - 4 + k, k * 2 + 1, 1, k % 2 ? '#8a6a3a' : '#a8834a');
    r(x + 4, y - 9, 1, 10, '#3b2a17'); r(x + 5, y - 9, 4, 3, '#d97706'); r(x + 5, y - 8, 3, 1, '#fbbf24');
  };
  // A recruit's village (0.43.0): two little houses with lit windows
  const cottage = (x: number, y: number) => {
    for (const [dx, w, h, roof] of [[-7, 7, 5, '#9a3412'], [1, 6, 4, '#7c2d12']] as [number, number, number, string][]) {
      r(x + dx, y - h, w, h, '#d6c2a0'); r(x + dx, y - h, w, 1, '#efe2c8');
      for (let k = 0; k < 3; k++) r(x + dx - 1 + k, y - h - 1 - k, w + 2 - k * 2, 1, roof);
      r(x + dx + 2, y - h + 2, 2, 1, '#fbbf24');
    }
    r(x - 8, y + 1, 16, 1, '#5b4a2a');
  };
  for (const n of SHORE) (icon[n.id] || (n.kind === 'skirmish' ? camp : n.kind === 'story' ? cottage : undefined))?.(n.x * W, n.y * H - 4);
}
