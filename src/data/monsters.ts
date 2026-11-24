/**
 * Monsters (0.26.0): enemies that aren't people in a player job.
 *
 * Each is a Job with `monster: true`, so the battle rules, the planner, the balance sim and the
 * Workshop treat it like any other enemy, but it never shows up in a player's job list, the
 * recruiting board or the job tree. Monsters wear no gear: their stats come from the job alone,
 * every action is theirs from level 1, and `innate` gives them the statuses and immunities gear
 * gives people. Their bodies are drawn in graphics/MonsterArt.ts.
 */
import { Ability, Job } from '../core/types';

const act = (a: Partial<Ability> & Pick<Ability, 'id' | 'name' | 'description' | 'range' | 'power' | 'element'>): Ability => ({
  jobId: '', type: 'action', jpCost: 0, mpCost: 0, heightTolerance: 2.0, aoe: 0, ...a
});

function monster(j: Omit<Job, 'spriteClass'>): Job {
  return { ...j, spriteClass: j.id, monster: true, abilities: j.abilities.map((a) => ({ ...a, jobId: j.id })) };
}

export const MONSTERS: Record<string, Job> = {
  wolf: monster({
    id: 'wolf',
    name: 'Dire Wolf',
    description: 'Hunts in packs. Fast on its feet, it closes in from the flank and bites hard; its howl spurs the pack on.',
    role: 'Beast',
    baseMove: 5,
    baseJump: 2,
    statMultipliers: { hp: 1.0, mp: 0.5, attack: 1.45, magic: 0.3, speed: 1.2 },
    abilities: [
      act({ id: 'mon_bite', name: 'Bite', description: 'Sinks its fangs in.', range: 1, power: 1.1, element: 'physical' }),
      act({ id: 'mon_lunge', name: 'Lunge', description: 'Leaps at a foe two tiles away.', range: 2, power: 0.9, element: 'physical' }),
      act({ id: 'mon_howl', name: 'Pack Howl', description: 'Focus for the wolf and every ally within 2 tiles.', range: 0, aoe: 2, power: 0, element: 'physical', centered: true, appliesStatus: 'focus', mpCost: 6 })
    ]
  }),
  wyvern: monster({
    id: 'wyvern',
    name: 'Wyvern',
    description: 'A winged drake. It flies over walls and cliffs, swoops from above and stings with a venomous tail.',
    role: 'Beast',
    baseMove: 4,
    baseJump: 8,
    statMultipliers: { hp: 1.15, mp: 0.5, attack: 1.4, magic: 0.6, speed: 1.05 },
    innate: { immune: ['immobilize'] },
    abilities: [
      act({ id: 'mon_tail_sting', name: 'Tail Sting', description: 'A venomous sting: damage and Poison.', range: 1, power: 0.9, element: 'physical', appliesStatus: 'poison' }),
      act({ id: 'mon_swoop', name: 'Swoop', description: 'Dives on a foe up to 3 tiles away, from any height.', range: 3, heightTolerance: 8, power: 1.1, element: 'physical' }),
      act({ id: 'mon_wing_gust', name: 'Wing Gust', description: 'A blast of wind over a small area, up to 2 tiles away.', range: 2, aoe: 1, power: 0.7, element: 'physical', mpCost: 6 })
    ]
  }),
  ooze: monster({
    id: 'ooze',
    name: 'Bog Ooze',
    description: 'A slow, sticky mass from the mire. It seals its own wounds, eats through armor and holds what it touches.',
    role: 'Ooze',
    baseMove: 3,
    baseJump: 1,
    statMultipliers: { hp: 1.45, mp: 0.4, attack: 1.15, magic: 0.5, speed: 0.8 },
    innate: { startStatus: ['regen'], immune: ['poison', 'blind', 'sleep'] },
    abilities: [
      act({ id: 'mon_acid', name: 'Acid Touch', description: 'Burns through armor: damage and Breach.', range: 1, power: 0.85, element: 'physical', appliesStatus: 'breach' }),
      act({ id: 'mon_engulf', name: 'Engulf', description: 'Swallows a foe\'s legs: damage and Immobilize.', range: 1, power: 0.7, element: 'physical', appliesStatus: 'immobilize' }),
      act({ id: 'mon_bog_spit', name: 'Bog Spit', description: 'Spits muck over a small area up to 3 tiles away: damage and Poison.', range: 3, aoe: 1, power: 0.55, element: 'physical', appliesStatus: 'poison', mpCost: 6 })
    ]
  }),
  wisp: monster({
    id: 'wisp',
    name: 'Marsh Wisp',
    description: 'A drifting light that leads travellers astray. Frail, but it burns from afar, lulls the unwary to sleep and feeds on life.',
    role: 'Spirit',
    baseMove: 4,
    baseJump: 8,
    statMultipliers: { hp: 1.05, mp: 1.4, attack: 0.85, magic: 1.3, speed: 1.15 },
    innate: { immune: ['poison', 'sleep', 'immobilize'] },
    abilities: [
      act({ id: 'mon_wisp_flame', name: 'Wisp Flame', description: 'Cold fire from up to 4 tiles away.', range: 4, heightTolerance: 3, power: 0.95, element: 'fire', mpCost: 4 }),
      act({ id: 'mon_lure', name: 'Lure', description: 'A dancing light: Sleep on a foe up to 3 tiles away.', range: 3, heightTolerance: 3, power: 0, element: 'dark', appliesStatus: 'sleep', mpCost: 8 }),
      act({ id: 'mon_drain_light', name: 'Drain Light', description: 'Feeds on a foe\'s life: damage, and the wisp heals half of it.', range: 3, heightTolerance: 3, power: 0.8, element: 'dark', drain: 0.5, mpCost: 10 })
    ]
  }),
  brute: monster({
    id: 'brute',
    name: 'Stonehide Brute',
    description: 'A hulking thing of living rock. Slow, but it shrugs off blows, pounds the ground around it and hurls boulders.',
    role: 'Brute',
    baseMove: 3,
    baseJump: 1,
    statMultipliers: { hp: 1.45, mp: 0.3, attack: 1.4, magic: 0.3, speed: 0.75 },
    innate: { startStatus: ['protect'], immune: ['poison'] },
    abilities: [
      act({ id: 'mon_smash', name: 'Smash', description: 'A crushing blow.', range: 1, power: 1.2, element: 'physical' }),
      act({ id: 'mon_ground_pound', name: 'Ground Pound', description: 'Hits every foe next to it: damage and Immobilize.', range: 0, aoe: 1, power: 0.8, element: 'physical', centered: true, appliesStatus: 'immobilize' }),
      act({ id: 'mon_hurl_boulder', name: 'Hurl Boulder', description: 'Throws a rock at a foe up to 4 tiles away.', range: 4, heightTolerance: 3, power: 0.95, element: 'physical', mpCost: 4 })
    ]
  })
};
