/**
 * Recruit side stories (0.43.0): one optional chapter for each story recruit (Bria, Sable and
 * Kestrel), fought at a place of their own on the world map. Each opens once its recruit is in the
 * squad and the story has moved on far enough, is won once per playthrough, and pays a personal
 * relic. Unlike side battles they're written scenes with fixed rosters; the enemies' levels follow
 * the squad, so one left for later is still a fight.
 */
import type { BattleObjective, CampaignChapter, DialogueLine, EnemySpawn, FacingDirection } from './types';
import { skirmishLevel } from './Skirmish';
import { MAPS } from '../data/maps';

/** One enemy: its level is the squad's level plus `plus`, and never under the story's floor. */
interface SideFoe {
  name: string;
  jobId: string;
  x: number;
  z: number;
  facing?: FacingDirection;
  plus?: number;
  isBoss?: boolean;
}

export interface SideStoryDef {
  /** Also the id of its place on the world map. */
  id: string;
  /** The recruit it belongs to: their unit id, name and job (they fight it). */
  hero: { id: string; name: string; jobId: string; level: number };
  /** The place on the map. */
  place: string;
  title: string;
  /** Opens once any of these chapters is won (and the hero is in the squad). */
  opensAfter: string[];
  mapId: string;
  /** What the place's battlefield is called in this story. */
  fieldName: string;
  /** The lowest level its enemies are, however far ahead the story is. */
  minLevel: number;
  objective?: BattleObjective;
  foes: SideFoe[];
  /** The relic it pays (never sold). */
  relic: string;
  /** One line for the world-map panel. */
  orders: string;
  intro: DialogueLine[];
  victory: DialogueLine[];
}

// Lines: the hero speaks from the left like the squad; foes and strangers from the right
const line = (speaker: string, text: string, opts: { portrait?: string; icon?: string; right?: boolean } = {}): DialogueLine => ({
  speaker, text, portrait: opts.portrait, portraitClass: opts.icon || '💬', side: opts.right ? 'right' : 'left'
});
const rowan = (t: string) => line('Rowan', t, { icon: '⚔' });
const maren = (t: string) => line('Maren', t, { icon: '⚜' });
const tobin = (t: string) => line('Tobin', t, { icon: '🏹' });
const corvin = (t: string) => line('Corvin', t, { icon: '✦' });
const bria = (t: string) => line('Bria', t, { icon: '🌿' });
const sable = (t: string) => line('Sable', t, { portrait: 'thief', icon: '🗡' });
const kestrel = (t: string) => line('Kestrel', t, { portrait: 'kestrel', icon: '🐾' });

export const SIDE_STORIES: Record<string, SideStoryDef> = {
  fenhollow: {
    id: 'fenhollow',
    hero: { id: 'p5', name: 'Bria', jobId: 'geomancer', level: 4 },
    place: 'Fenhollow',
    title: 'The Spring at Fenhollow',
    opensAfter: ['chapter_3'],
    mapId: 'gloomy_swamp',
    fieldName: 'Fenhollow Spring',
    minLevel: 6,
    objective: { type: 'boss' },
    relic: 'fenhollow_stone',
    orders: "Bria's village still can't drink from its spring. Something big sits on the spring head.",
    foes: [
      { name: 'Mire Mother', jobId: 'ooze', x: 2, z: 0, plus: 1, isBoss: true },
      { name: 'Bog Ooze', jobId: 'ooze', x: 9, z: 2 },
      { name: 'Bog Ooze', jobId: 'ooze', x: 3, z: 1 },
      { name: 'Marsh Wisp', jobId: 'wisp', x: 6, z: 7 },
      { name: 'Marsh Wisp', jobId: 'wisp', x: 12, z: 2 },
      { name: 'Reed Thornling', jobId: 'thornling', x: 7, z: 4 }
    ],
    intro: [
      bria('This is Fenhollow. My village. The warlock is dead, and still nobody drinks from the spring.'),
      line('Old Wenna', 'Bria. You brought knights. Good. The spring has gone black, and something lives in it now.', { portrait: 'white_mage', icon: '🌿', right: true }),
      bria('His poison sank into the mud and fed the oozes all season. The big one sits on the spring head. We call her the Mire Mother.'),
      rowan('Then we clear the spring. Tell us where to stand.'),
      bria('On the boardwalks, and away from the lights. She eats through armour: hit her from range, and keep a Remedy ready. Once she is gone, the rest will scatter.')
    ],
    victory: [
      bria('Listen. The spring is running again. Clean.'),
      line('Old Wenna', 'Your mother would have liked these knights, girl. Take the spring-stone. It has sat in the well-house since before I was born. It should go with whoever keeps the water safe.', { portrait: 'white_mage', icon: '🌿', right: true }),
      bria('I told you once that stone remembers who defends it. Water does too.'),
      tobin('Does that mean we can stay for supper?'),
      bria('It means you can drink the water. Supper, we will see.')
    ]
  },
  saltmere: {
    id: 'saltmere',
    hero: { id: 'sable', name: 'Sable', jobId: 'thief', level: 6 },
    place: 'Saltmere',
    title: 'What Was Owed',
    opensAfter: ['chapter_5'],
    mapId: 'ember_harbor',
    fieldName: 'Saltmere Quay',
    minLevel: 8,
    objective: { type: 'boss' },
    relic: 'saltmere_coin',
    orders: "Varrow burned this fishing village. Sable means to give back what he took, if his old crew doesn't get to it first.",
    foes: [
      { name: 'First Mate Grell', jobId: 'gunner', x: 7, z: 1, plus: 1, isBoss: true },
      { name: 'Corsair Cutthroat', jobId: 'thief', x: 9, z: 1 },
      { name: 'Deck Gunner', jobId: 'gunner', x: 11, z: 0 },
      { name: 'Corsair Brawler', jobId: 'monk', x: 12, z: 5 },
      { name: 'Bilge Ooze', jobId: 'ooze', x: 3, z: 4 },
      { name: 'Ship Chanter', jobId: 'white_mage', x: 5, z: 1 }
    ],
    intro: [
      sable('Saltmere. Varrow burned it two winters ago. I was on the ship. I lit nothing, and I stopped nothing.'),
      rowan('And now?'),
      sable('He kept a strongbox under the quay: every coin he took off this coast. I mean to give it back, house by house.'),
      line('First Mate Grell', 'Sable! Thought that was you. The captain is gone, so the box is ours. Walk away and I will forget I saw you.', { portrait: 'foe_gunner', icon: '☠', right: true }),
      sable('Grell, you never forgot a debt in your life. Neither have I. Knights: the gunner is mine, but I would not say no to help.')
    ],
    victory: [
      line('First Mate Grell', 'All that gold, and you are going to hand it out. You always were soft, Sable.', { portrait: 'foe_gunner', icon: '☠', right: true }),
      sable('I was always quiet. It is not the same thing.'),
      maren('There is a ledger in the box. Names, houses, what was taken from each.'),
      sable('Then we read it out and pay it back. All but this. The first coin I ever stole was off a Saltmere fisherman, and I have kept it ever since. It can do some good now.'),
      tobin('So we sailed all this way to give money away?'),
      sable('Yes. You should try it some time. It feels strange.')
    ]
  },
  dunehome: {
    id: 'dunehome',
    hero: { id: 'kestrel', name: 'Kestrel', jobId: 'tamer', level: 9 },
    place: 'Dunehome',
    title: 'The Empty Cages',
    opensAfter: ['chapter_7'],
    mapId: 'saltglass_shore',
    fieldName: 'Dunehome Ruins',
    minLevel: 10,
    objective: { type: 'boss' },
    relic: 'dunehome_whistle',
    orders: "The Court's trappers are caging the wild things around Kestrel's burned village. She wants them free.",
    foes: [
      { name: 'Huntmaster Corra', jobId: 'tamer', x: 7, z: 1, plus: 1, isBoss: true },
      { name: 'Court Trapper', jobId: 'archer', x: 10, z: 2 },
      { name: 'Court Trapper', jobId: 'archer', x: 8, z: 0 },
      { name: 'Cage Warden', jobId: 'knight', x: 5, z: 3 },
      { name: 'Court Chaplain', jobId: 'white_mage', x: 6, z: 1 },
      { name: 'Broken Wolf', jobId: 'wolf', x: 13, z: 6 }
    ],
    intro: [
      kestrel('This was Dunehome. The Court burned it for their road. Now they have come back for what lives around it.'),
      corvin('Cages. A dozen of them, along the old wall.'),
      kestrel('Jackals, a sand-cat, a wyvern chick. They are taking them over the pass, to fight for the Court.'),
      line('Huntmaster Corra', 'The beast-girl, still alive. You should have burned with your village. These animals belong to the Heir now.', { portrait: 'foe_tamer', icon: '🪤', right: true }),
      kestrel('They belong to the dunes. The wolf only fights for her because she starves it. Wear it down and I can bring it over to us.')
    ],
    victory: [
      line('Huntmaster Corra', 'You have cost the Court a fortune in beasts.', { portrait: 'foe_tamer', icon: '🪤', right: true }),
      kestrel('Good. Go home and tell them the dunes are closed.'),
      kestrel('Open the cages. Slowly. They will not thank you, but they will remember.'),
      bria('The wyvern chick is following you.'),
      kestrel('Then it has chosen. Here, Rowan: my mother\'s whistle. Every beast in the dunes knew its call. I would like one of you to carry it.'),
      rowan('We will carry it home with us, then. And bring it back.')
    ]
  }
};

/** True when the story can be played: its hero is in the squad, its chapter is won, and it isn't won yet. */
export function sideStoryOpen(id: string, cleared: string[], squadIds: string[], done: string[]): boolean {
  const def = SIDE_STORIES[id];
  return !!def && !done.includes(id) && squadIds.includes(def.hero.id) && def.opensAfter.some((c) => cleared.includes(c));
}

export type SideStoryState = 'open' | 'cleared' | 'locked';

/** How each story's place shows on the map. A locked one isn't shown at all. */
export function sideStoryStates(cleared: string[], squadIds: string[], done: string[]): Record<string, SideStoryState> {
  const out: Record<string, SideStoryState> = {};
  for (const id of Object.keys(SIDE_STORIES)) out[id] = done.includes(id) ? 'cleared' : sideStoryOpen(id, cleared, squadIds, done) ? 'open' : 'locked';
  return out;
}

/** Enemy level for a story foe: the squad's average level, plus its own step, never under the floor. */
export function sideFoeLevel(def: SideStoryDef, squadLevels: number[], plus = 0): number {
  return Math.max(def.minLevel, skirmishLevel(squadLevels, 0)) + plus;
}

/** The chapter for a side story, with its enemies at the squad's level. */
export function buildSideStory(id: string, squadLevels: number[]): CampaignChapter {
  const def = SIDE_STORIES[id];
  const enemyRoster: EnemySpawn[] = def.foes.map((f) => ({
    name: f.name, jobId: f.jobId, level: sideFoeLevel(def, squadLevels, f.plus || 0), x: f.x, z: f.z,
    facing: f.facing || 'S', ...(f.isBoss ? { isBoss: true } : {})
  }));
  return {
    id: `side:${id}`,
    title: `Side Story: ${def.hero.name}`,
    subtitle: def.title,
    mapId: def.mapId,
    // the place's own battlefield, under the story's name for it
    mapData: { ...MAPS[def.mapId](), name: def.fieldName },
    // the hero fights it; already in the squad, so nobody new joins
    recruit: def.hero,
    introDialogue: def.intro.map((l) => ({ ...l })),
    victoryDialogue: def.victory.map((l) => ({ ...l })),
    enemyRoster,
    rewardItemIds: [def.relic],
    objective: def.objective
  };
}

/** Won side stories from a save, kept to real ones. */
export function sanitizeSideStories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && Object.prototype.hasOwnProperty.call(SIDE_STORIES, id)))];
}
