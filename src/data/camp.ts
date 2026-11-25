/**
 * Camp scenes (0.21.0): a short talk around the fire after each story battle, played from the
 * world map. Each is seen once per playthrough and leaves everyone a little JP the wiser.
 */
import { DialogueLine } from '../core/types';
import { CAMPAIGN_CHAPTERS } from './campaign';

export interface CampScene {
  /** The story battle it follows. */
  chapterId: string;
  title: string;
  lines: DialogueLine[];
}

/** JP each squad member gains from a camp scene (into the job they are in). */
export const CAMP_JP = 30;

const L = (speaker: string, text: string, side: 'left' | 'right' = 'left'): DialogueLine => ({
  speaker,
  portraitClass: '🔥',
  portrait: speaker === 'Sable' ? 'thief' : undefined,
  side,
  text
});

export const CAMP_SCENES: Record<string, CampScene> = {
  chapter_1: {
    chapterId: 'chapter_1',
    title: 'Smoke on the River',
    lines: [
      L('Tobin', 'Six arrows, four hits. I am keeping count, Corvin. You owe me a drink.'),
      L('Corvin', 'I owe you nothing. Two of yours bounced off a shield.', 'right'),
      L('Maren', 'Their chief said they were hungry. He was not lying. I saw the camp: no bread, no boots.'),
      L('Rowan', 'Then after the sorcerer, we find out who left them hungry. Sleep. We march at first light.', 'right')
    ]
  },
  chapter_2a: {
    chapterId: 'chapter_2a',
    title: 'Bog Lights',
    lines: [
      L('Bria', 'Do not follow the lights over the water. Marsh gas. They are patient.', 'right'),
      L('Tobin', 'Patient how?'),
      L('Bria', 'They wait until you are in up to your neck.', 'right'),
      L('Corvin', '...I am moving my bedroll.'),
      L('Rowan', 'Bria, you did not have to come with us. Why did you?'),
      L('Bria', 'He poisoned the water my village drinks. You were the only ones walking toward him.', 'right')
    ]
  },
  chapter_2b: {
    chapterId: 'chapter_2b',
    title: 'On the Ramparts',
    lines: [
      L('Maren', 'The garrison captain asked my name twice. I think he expected someone older.'),
      L('Bria', 'He expected someone slower. You held the east tower on your own.', 'right'),
      L('Maren', 'Not on my own. Tobin covered the stairs.'),
      L('Tobin', 'I covered the stairs, the yard, and one very surprised goat.', 'right'),
      L('Rowan', 'Bria, the siege is over. You could stay with the garrison. Why come with us?'),
      L('Bria', 'Stone remembers who defends it. So do I.', 'right')
    ]
  },
  chapter_3: {
    chapterId: 'chapter_3',
    title: 'After the Seal',
    lines: [
      L('Rowan', 'Everyone keeps saying we saved the realm. It does not feel finished.'),
      L('Bria', 'It is not. The seal went quiet, but something under the sea answered it.', 'right'),
      L('Corvin', 'Then we go to the sea.'),
      L('Maren', 'Spoken like a man who has never been seasick.', 'right'),
      L('Corvin', 'I have never been on a boat.'),
      L('Maren', 'Exactly.', 'right')
    ]
  },
  chapter_4: {
    chapterId: 'chapter_4',
    title: 'The Charts',
    lines: [
      L('Sable', 'Varrow\'s charts. Every cove from here to the cape, and a cross on Greywatch.', 'right'),
      L('Rowan', 'You crewed his ship for years. Why turn on him now?'),
      L('Sable', 'He started paying in promises instead of coin. Then he started burning harbors with people still in them.', 'right'),
      L('Tobin', 'So you are with us for the pay?'),
      L('Sable', 'I am with you because nobody has asked me to give anything back yet.', 'right'),
      L('Maren', 'Yet.')
    ]
  },
  chapter_5: {
    chapterId: 'chapter_5',
    title: 'The Night Before the Cape',
    lines: [
      L('Bria', 'Whatever waits on the cape was a king once. The old kingdom drowned him and called it mercy.', 'right'),
      L('Corvin', 'Kings never stay drowned. Not in the songs.'),
      L('Tobin', 'I have eleven arrows left and a very good feeling about every one of them.', 'right'),
      L('Sable', 'I have a very bad feeling and twelve knives.'),
      L('Rowan', 'Then between the two of you, we have enough. Rest. Tomorrow we finish it, together.', 'right')
    ]
  },
  // Act III (0.34.0)
  chapter_6: {
    chapterId: 'chapter_6',
    title: 'The Last Night Ashore',
    lines: [
      L('Tobin', 'A month at sea. I get sick on the river ferry, Rowan.', 'right'),
      L('Sable', 'Then stand at the rail and look at the horizon. And do not stand upwind of me.'),
      L('Maren', 'My grandmother\'s stories said the Far Shore is all salt and mountains. And that the people there remember the old kingdom kindly.', 'right'),
      L('Bria', 'The court remembers it too. That is what worries me.'),
      L('Rowan', 'We go, we find the Regent\'s heir, we stop whatever she means to raise. Then we come home. All of us.', 'right')
    ]
  },
  chapter_7: {
    chapterId: 'chapter_7',
    title: 'Fire in the Dunes',
    lines: [
      L('Kestrel', 'The basilisk you fought was old. Older than my grandmother. It was only there because the Court burned its hollow for their road.'),
      L('Tobin', 'You talk about it like it was a neighbour.', 'right'),
      L('Kestrel', 'It was. Out here, the wild things are neighbours. Treat them well and some will walk with you.'),
      L('Corvin', 'And the Pale Heir? Is she a neighbour too?', 'right'),
      L('Kestrel', 'She is the one who makes the neighbours run. Sleep. The pass is cold, and the Marshal does not sleep at all.')
    ]
  },
  // Act III finale (0.35.0)
  chapter_8: {
    chapterId: 'chapter_8',
    title: 'The Top of the Pass',
    lines: [
      L('Corvin', 'You can hear the bells from up here. Under the water. Every quarter hour, like a clock.', 'right'),
      L('Sable', 'The chart had a note in the margin. "The heir sleeps with the city." Someone woke her.'),
      L('Maren', 'Or she woke herself. A whole kingdom under the sea, and her the last one breathing.', 'right'),
      L('Bria', 'That is sad. It is still not a reason to drown the coast.'),
      L('Rowan', 'Then we tell her so. Down the mountain in the morning.', 'right')
    ]
  },
  chapter_9: {
    chapterId: 'chapter_9',
    title: 'The Ship Home',
    lines: [
      L('Tobin', 'Calm sea, this time. I could get used to this.', 'right'),
      L('Kestrel', 'The dunes will keep without me for a season. I want to see this Larkmoor Market of yours.'),
      L('Sable', 'Bring gold. The prices there are a crime, and I would know.', 'right'),
      L('Maren', 'Grandmother was right about one thing. The people here remember the old kingdom. Now they can remember how it ended.'),
      L('Rowan', 'Three acts and we are all still standing. Same time next year?', 'right')
    ]
  }
};

/** The camp scene waiting to be played: the earliest won chapter whose scene hasn't been seen. */
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function pendingCamp(cleared: string[], seen: string[]): CampScene | null {
  for (const id of cleared) {
    const scene = has(CAMP_SCENES, id) ? CAMP_SCENES[id] : undefined;
    if (scene && !seen.includes(id)) return scene;
  }
  return null;
}

/**
 * Camp nights remembered (0.39.0): every scene seen in any playthrough of this save, in story
 * order. Unlike `campSeen`, New Game+ doesn't clear them, so they can be watched again from the
 * world map. A save from before 0.39 remembers what it has seen this playthrough.
 */
export function campMemories(raw: unknown, seen: string[]): string[] {
  const ids = new Set([...(Array.isArray(raw) ? raw : []), ...seen].filter((id): id is string => typeof id === 'string' && has(CAMP_SCENES, id)));
  return Object.keys(CAMP_SCENES).filter((id) => ids.has(id));
}

/**
 * Seen scenes from a save, kept to real ones. A save from before 0.21.0 has no list: everything it
 * has won counts as seen except its latest battle, so an old save gets one scene, not a backlog.
 */
export function sanitizeCampSeen(raw: unknown, cleared: string[]): string[] {
  if (!Array.isArray(raw)) return cleared.slice(0, -1).filter((id) => has(CAMP_SCENES, id));
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && has(CAMP_SCENES, id) && has(CAMPAIGN_CHAPTERS, id)))];
}
