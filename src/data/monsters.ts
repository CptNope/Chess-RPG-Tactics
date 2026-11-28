/**
 * Monsters (0.26.0): enemies that aren't people in a player job.
 *
 * Each is a Job with `monster: true`, so the battle rules, the planner, the balance sim and the
 * Workshop treat it like any other enemy, but it never shows up in a player's job list, the
 * recruiting board or the job tree. Monsters wear no gear: their stats come from the job alone,
 * every action is theirs from level 1, and `innate` gives them what gear gives people: stats
 * (fangs, hide, a ghostly glow; 0.27.0), statuses they start with and ailments they shrug off,
 * and from 0.51.0 ground they thrive on (it heals them instead of hurting them). Their bodies are drawn in graphics/MonsterArt.ts.
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
    innate: { stats: { attack: 6, hp: 20, evasion: 14 } },
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
    innate: { immune: ['immobilize'], stats: { attack: 6, hp: 30, evasion: 8 } },
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
    innate: { startStatus: ['regen'], immune: ['poison', 'blind', 'sleep'], stats: { attack: 6, hp: 30 } },
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
    innate: { immune: ['poison', 'sleep', 'immobilize'], stats: { magic: 18, mp: 20, evasion: 16 } },
    abilities: [
      act({ id: 'mon_wisp_flame', name: 'Wisp Flame', description: 'Cold fire from up to 4 tiles away.', range: 4, heightTolerance: 3, power: 1.25, element: 'fire', mpCost: 4 }),
      act({ id: 'mon_lure', name: 'Lure', description: 'A dancing light that may lull a foe up to 2 tiles away to Sleep. Easy to resist.', range: 2, heightTolerance: 3, power: 0, element: 'dark', appliesStatus: 'sleep', accuracy: -30, mpCost: 14 }),
      act({ id: 'mon_drain_light', name: 'Drain Light', description: 'Feeds on a foe\'s life: damage, and the wisp heals half of it.', range: 3, heightTolerance: 3, power: 1.0, element: 'dark', drain: 0.5, mpCost: 10 })
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
    innate: { startStatus: ['protect'], immune: ['poison'], stats: { attack: 6, hp: 40 } },
    abilities: [
      act({ id: 'mon_smash', name: 'Smash', description: 'A crushing blow.', range: 1, power: 1.2, element: 'physical' }),
      act({ id: 'mon_ground_pound', name: 'Ground Pound', description: 'Hits every foe next to it: damage and Immobilize.', range: 0, aoe: 1, power: 0.8, element: 'physical', centered: true, appliesStatus: 'immobilize' }),
      act({ id: 'mon_hurl_boulder', name: 'Hurl Boulder', description: 'Throws a rock at a foe up to 4 tiles away.', range: 4, heightTolerance: 3, power: 0.95, element: 'physical', mpCost: 4 })
    ]
  }),

  // Added in 0.32.0: the Briar Barrow
  basilisk: monster({
    id: 'basilisk',
    name: 'Basilisk',
    description: 'A long, low lizard in plates of olive scale. Slow to move, hard to hurt, and its stare roots you where you stand.',
    role: 'Beast',
    baseMove: 4,
    baseJump: 2,
    statMultipliers: { hp: 1.45, mp: 0.6, attack: 1.45, magic: 0.6, speed: 1.0 },
    innate: { immune: ['immobilize', 'blind'], stats: { attack: 8, hp: 45 } },
    abilities: [
      act({ id: 'mon_tail_lash', name: 'Tail Lash', description: 'A heavy sweep of the tail.', range: 1, power: 1.3, element: 'physical' }),
      act({ id: 'mon_stone_gaze', name: 'Stone Gaze', description: 'Its stare roots a foe up to 4 tiles away: Immobilize.', range: 4, heightTolerance: 3, power: 0, element: 'dark', appliesStatus: 'immobilize', accuracy: -10, mpCost: 8 }),
      act({ id: 'mon_dread_stare', name: 'Dread Stare', description: 'A long, heavy look at a foe up to 3 tiles away: damage and Slow.', range: 3, heightTolerance: 3, power: 0.8, element: 'dark', appliesStatus: 'slow', mpCost: 10 })
    ]
  }),
  bone_knight: monster({
    id: 'bone_knight',
    name: 'Bone Knight',
    description: 'A knight long dead, still on guard in a rusted helm. It feels no poison, never sleeps, and fights on with a notched sword and a dented shield.',
    role: 'Undead',
    baseMove: 4,
    baseJump: 3,
    statMultipliers: { hp: 1.3, mp: 0.6, attack: 1.5, magic: 0.5, speed: 1.2 },
    innate: { immune: ['poison', 'sleep', 'blind'], stats: { attack: 8, hp: 40, evasion: 6 } },
    abilities: [
      act({ id: 'mon_rusted_blade', name: 'Rusted Blade', description: 'A notched, rusty cut.', range: 1, power: 1.3, element: 'physical' }),
      act({ id: 'mon_shield_bash', name: 'Shield Bash', description: 'Slams its shield into a foe: damage and Slow.', range: 1, power: 0.7, element: 'physical', appliesStatus: 'slow' }),
      act({ id: 'mon_grave_chill', name: 'Grave Chill', description: 'A breath from the grave over a small area up to 3 tiles away: dark damage.', range: 3, heightTolerance: 3, aoe: 1, power: 0.8, element: 'dark', mpCost: 8 })
    ]
  }),
  thornling: monster({
    id: 'thornling',
    name: 'Thornling',
    description: 'A knot of briars that walked off on its roots. It mends itself, lashes with poisoned thorns and blinds with clouds of pollen.',
    role: 'Plant',
    baseMove: 3,
    baseJump: 1,
    statMultipliers: { hp: 1.35, mp: 0.7, attack: 1.35, magic: 0.9, speed: 1.0 },
    innate: { startStatus: ['regen'], immune: ['sleep', 'blind'], stats: { attack: 6, hp: 40 } },
    abilities: [
      act({ id: 'mon_thorn_lash', name: 'Thorn Lash', description: 'A thorny vine lashes a foe up to 3 tiles away: damage and Poison.', range: 3, power: 1.0, element: 'physical', appliesStatus: 'poison' }),
      act({ id: 'mon_bramble_burst', name: 'Bramble Burst', description: 'Briars burst out at every foe next to it: damage and Immobilize.', range: 0, aoe: 1, power: 0.75, element: 'physical', centered: true, appliesStatus: 'immobilize', mpCost: 6 }),
      act({ id: 'mon_pollen', name: 'Pollen Cloud', description: 'A puff of pollen over a small area up to 3 tiles away: light damage and Blind.', range: 3, heightTolerance: 3, aoe: 1, power: 0.3, element: 'physical', appliesStatus: 'blind', mpCost: 8 })
    ]
  }),
  // 0.51.0: creatures of the new ground. Each makes one kind of it, and two thrive on theirs
  salamander: monster({
    id: 'salamander',
    name: 'Emberback', // not "Salamander": that's the Summoner's fire spirit
    description: 'A fire lizard from the volcanic vents, a crest of flame down its back. It spits flame that leaves the ground burning, and basks in the embers: they heal it instead of hurting it.',
    role: 'Beast',
    baseMove: 4,
    baseJump: 2,
    statMultipliers: { hp: 1.05, mp: 0.7, attack: 1.15, magic: 1.0, speed: 1.0 },
    innate: { thrives: ['embers'], stats: { attack: 4, magic: 6, hp: 10 } },
    abilities: [
      act({ id: 'mon_tail_whip', name: 'Tail Whip', description: 'Whips its tail at a foe next to it.', range: 1, power: 1.1, element: 'physical' }),
      act({ id: 'mon_flame_spit', name: 'Flame Spit', description: 'Spits fire over a small area up to 3 tiles away. The ground there burns for 2 rounds.', range: 3, heightTolerance: 2.5, aoe: 1, power: 0.85, element: 'fire', mpCost: 6 }),
      act({ id: 'mon_kindle', name: 'Kindle', description: 'Flames burst out at every foe next to it, and the ground around it catches fire.', range: 0, aoe: 1, power: 0.7, element: 'fire', centered: true, mpCost: 8 })
    ]
  }),
  frost_sprite: monster({
    id: 'frost_sprite',
    name: 'Frost Sprite',
    description: 'A shard of living ice on the wind. It flies over anything, freezes from afar, slows what it chills, and its cold puts out burning ground.',
    role: 'Spirit',
    baseMove: 4,
    baseJump: 8,
    statMultipliers: { hp: 1.05, mp: 1.4, attack: 0.85, magic: 1.3, speed: 1.15 },
    innate: { immune: ['slow', 'sleep', 'poison'], stats: { magic: 16, mp: 20, evasion: 16 } },
    abilities: [
      act({ id: 'mon_frost_bolt', name: 'Frost Bolt', description: 'A dart of ice from up to 4 tiles away.', range: 4, heightTolerance: 3, power: 1.2, element: 'ice', mpCost: 4 }),
      act({ id: 'mon_rime_burst', name: 'Rime Burst', description: 'Frost bursts over a small area up to 3 tiles away: damage and Slow. It puts out burning ground.', range: 3, heightTolerance: 3, aoe: 1, power: 0.75, element: 'ice', appliesStatus: 'slow', mpCost: 10 }),
      act({ id: 'mon_hoarfrost', name: 'Hoarfrost Veil', description: 'A veil of frost: Shell for the sprite and every ally within 2 tiles, and the embers around go out.', range: 0, aoe: 2, power: 0, element: 'ice', centered: true, appliesStatus: 'shell', mpCost: 12 })
    ]
  }),
  bog_lurker: monster({
    id: 'bog_lurker',
    name: 'Bog Lurker',
    description: 'A squat, wide-jawed thing that waits under the bog. It spits venom that hangs in the air as miasma, drags its prey down, and breathes the miasma like air: it heals it.',
    role: 'Beast',
    baseMove: 3,
    baseJump: 1,
    statMultipliers: { hp: 1.4, mp: 0.6, attack: 1.3, magic: 0.7, speed: 0.9 },
    innate: { immune: ['poison', 'blind'], thrives: ['miasma'], stats: { attack: 6, hp: 35 } },
    abilities: [
      act({ id: 'mon_snap', name: 'Snap', description: 'Snaps its jaws on a foe next to it.', range: 1, power: 1.2, element: 'physical' }),
      act({ id: 'mon_venom_spit', name: 'Venom Spit', description: 'Spits venom over a small area up to 3 tiles away: damage and Poison. It lingers there as miasma for 2 rounds.', range: 3, aoe: 1, power: 0.55, element: 'physical', appliesStatus: 'poison', mpCost: 6 }),
      act({ id: 'mon_drag_under', name: 'Drag Under', description: 'Grabs a foe next to it and drags at its legs: damage and Immobilize.', range: 1, power: 0.8, element: 'physical', appliesStatus: 'immobilize' })
    ]
  })
};
