/**
 * First-battle tips: short, one-at-a-time hints shown the first time each thing happens
 * (your first turn, first move, first forecast…). They never block input: a tip sits in a
 * corner of the screen until it is dismissed, replaced by the next one, or times out.
 *
 * What has been seen is remembered per device (localStorage), not per save, so a second
 * playthrough isn't taught again. "Show tips again" in Controls resets it.
 */
export type TipId =
  | 'firstTurn' | 'moveMode' | 'moved' | 'actMenu' | 'targeting' | 'forecast' | 'facing' | 'item' | 'fallen' | 'worldMap' | 'enemyCall' | 'tamed';

export const TIPS: Record<TipId, { title: string; text: string }> = {
  firstTurn: {
    title: 'YOUR TURN',
    text: 'Units act in order of speed, not by team: the strip at the top shows who is next. On your turn you can MOVE and ACT in either order, then WAIT to end it.'
  },
  moveMode: {
    title: 'MOVING',
    text: 'Blue tiles are in reach. High ground helps: attacks from above hit more often and harder. Water and swamp cost extra movement.'
  },
  moved: {
    title: 'CHANGED YOUR MIND?',
    text: 'Until this unit acts, the MOVE button reads UNDO and takes the move back.'
  },
  actMenu: {
    title: 'ACTIONS',
    text: 'Every job has its own abilities. The MP cost is on the right; FREE ones can be used every turn.'
  },
  targeting: {
    title: 'PICK A TARGET',
    text: 'Red tiles are in range. Strike from the side or from behind: a blow to the back does 30% more damage and crits far more often.'
  },
  forecast: {
    title: 'FORECAST',
    text: 'This is the chance to hit and the damage, before you commit. Nothing is spent until you choose EXECUTE.'
  },
  facing: {
    title: 'FACING',
    text: 'Choose which way to face as the turn ends. Keep your back away from the enemy.'
  },
  item: {
    title: 'ITEMS',
    text: 'Supplies are shared by the squad and always work. A Potion heals the same in anyone\'s hands; a Phoenix Feather raises a fallen ally.'
  },
  fallen: {
    title: 'AN ALLY HAS FALLEN',
    text: 'The ✝ marker shows where. Use a Phoenix Feather (ITEM) or a White Mage\'s Raise from nearby to bring them back.'
  },
  enemyCall: {
    title: 'A GRAND SUMMON IS COMING',
    text: 'The pulsing tiles mark where it lands, at the start of the caller\'s next turn. Move out of them, or put the caller to sleep, silence them or knock them out to break the call.'
  },
  tamed: {
    title: 'A BEAST ON YOUR SIDE',
    text: 'The tamed monster takes orders from you now. Keep it standing: if it lives to see the victory, it joins your squad. Beasts wear no gear and never change jobs.'
  },
  worldMap: {
    title: 'THE WORLD MAP',
    text: 'Select a place to walk there. Buy supplies at the market (◆), then march on a battle marked ⚔. Places marked ⚑ are side battles: optional, and good practice.'
  }
};

const KEY = 'chess_rpg_tactics_tips_v1';
const SHOW_MS = 16000;

export class Tutorial {
  private seen = new Set<string>();
  private off = false;
  private el = document.getElementById('tutor');
  private timer = 0;
  private showing: TipId | null = null;

  constructor() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as { seen?: unknown; off?: unknown } | null;
      if (raw && Array.isArray(raw.seen)) for (const id of raw.seen) if (typeof id === 'string' && id in TIPS) this.seen.add(id);
      this.off = !!raw?.off;
    } catch { /* no storage: tips show once per visit */ }
    document.getElementById('tutor-ok')?.addEventListener('click', () => this.hide());
    document.getElementById('tutor-skip')?.addEventListener('click', () => this.skipAll());
  }

  /** True when this tip hasn't been shown yet and tips are on. */
  public wants(id: TipId): boolean {
    return !this.off && !this.seen.has(id);
  }

  /** Marks a tip as seen without showing it here (the world map shows its own, in its panel). */
  public markSeen(id: TipId): void {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.store();
  }

  /** Shows a tip the first time its moment comes. Returns true when it was shown. */
  public show(id: TipId): boolean {
    if (!this.wants(id) || !this.el) return false;
    this.markSeen(id);
    this.showing = id;
    this.el.querySelector('.tutor-title')!.textContent = `TIP · ${TIPS[id].title}`;
    this.el.querySelector('.tutor-text')!.textContent = TIPS[id].text;
    this.el.classList.remove('hidden');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), SHOW_MS);
    return true;
  }

  /** Hides the tip on screen; with an id, only if that is the one showing (its moment has passed). */
  public hide(id?: TipId): void {
    if (id && this.showing !== id) return;
    clearTimeout(this.timer);
    this.showing = null;
    this.el?.classList.add('hidden');
  }

  public skipAll(): void {
    this.off = true;
    this.store();
    this.hide();
  }

  /** Controls → "Show tips again". */
  public reset(): void {
    this.seen.clear();
    this.off = false;
    this.store();
  }

  private store(): void {
    try { localStorage.setItem(KEY, JSON.stringify({ seen: [...this.seen], off: this.off })); } catch { /* ignore */ }
  }
}
