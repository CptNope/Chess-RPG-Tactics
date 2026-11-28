import { CampaignChapter } from '../core/types';


export const CAMPAIGN_CHAPTERS: Record<string, CampaignChapter> = {
  chapter_1: {
    id: 'chapter_1',
    title: 'CHAPTER I',
    subtitle: 'Ambush at Riverside Ruins',
    mapId: 'river_ruins',
    introDialogue: [
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Halt, brigands! The knights of the realm have encircled these ruins. Lay down your arms!' },
      { speaker: 'Bandit Chief', portrait: 'foe_knight', portraitClass: '🛡', side: 'right', text: 'Bah! Spoiled nobles strutting in fine armor! You know nothing of our hunger or our cause!' },
      { speaker: 'Rogue Warlock', portrait: 'foe_time_mage', portraitClass: '⚡', side: 'right', text: 'The ancient Zodiac Seals slumber beneath this soil... We will not let dogs of the throne claim them!' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'Silence your blasphemy, rebel! In the name of the realm, draw your steel!' }
    ],
    victoryDialogue: [
      { speaker: 'Bandit Chief', portrait: 'foe_knight', portraitClass: '🛡', side: 'right', text: 'Ugh... Curse you, knights! Warlock... fall back to the sanctuary...' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'The rebel leader is subdued, but the sorcerer fled across the river!' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Our scouts report two movements: the sorcerer fled into the toxic bogs, while a rebel force marches on the northern fortress!' }
    ],
    choices: [
      {
        text: 'Pursue the fleeing sorcerer into the Gloomy Mire! The harder road: bog, poison, and lights that put you to sleep.',
        nextChapterId: 'chapter_2a',
        rewardText: 'Armory: Ring of Arcana & Twin Shadow Daggers',
        rewardItemIds: ['mage_ring', 'assassin_daggers']
      },
      {
        text: 'Rush to reinforce the garrison at Night Battlement!',
        nextChapterId: 'chapter_2b',
        rewardText: 'Armory: Platinum Plate Mail & Kite Shield',
        rewardItemIds: ['platinum_armor', 'kite_shield']
      }
    ],
    rewardItemIds: ['power_wrist', 'flame_rod'],
    enemyRoster: [
      { name: 'Bandit Chief', jobId: 'knight', level: 3, x: 13, z: 2, isBoss: true },
      { name: 'Rogue Warlock', jobId: 'time_mage', level: 3, x: 12, z: 3 },
      { name: 'Brigand Bowman', jobId: 'archer', level: 3, x: 14, z: 3 },
      { name: 'Shadow Shinobi', jobId: 'ninja', level: 3, x: 5, z: 4 },
      { name: 'Bridge Cutthroat', jobId: 'thief', level: 2, x: 3, z: 3 }
    ]
  },

  chapter_2a: {
    id: 'chapter_2a',
    title: 'CHAPTER II-A',
    subtitle: 'The Sunken Crypts (Gloomy Mire)',
    mapId: 'gloomy_swamp',
    recruit: { id: 'p5', name: 'Bria', jobId: 'geomancer', level: 4 },
    rewardItemIds: ['gaia_staff', 'verdant_charm'],
    introDialogue: [
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'The fog is thick with venom... Tread carefully on the wooden boardwalks!' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'You will drown out here without a guide, knight. I am Bria. This mire is my home, and that warlock has poisoned it. I fight with you.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'A Geomancer! Your earth-magic changes with the ground you stand on, yes? Then this bog is your weapon. Welcome, Bria.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'Then hear this first. The lights in the fog are wisps: they lull you to sleep and feed on you. And the mud moves on its own here. Do not let it get hold of your legs.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'His poison pools by the shrine: do not stand in it. But the spring on the middle island still runs clean. It will heal you and wash the venom out.' },
      { speaker: 'Rogue Warlock', portrait: 'foe_time_mage', portraitClass: '⚡', side: 'right', text: 'You foolhardy whelps! You walked straight into my temporal web!' },
      { speaker: 'Shadow Shinobi', portrait: 'foe_ninja', portraitClass: '🗡', side: 'right', text: 'No knight leaves this bog alive. Disperse into the mist!' }
    ],
    victoryDialogue: [
      { speaker: 'Rogue Warlock', portrait: 'foe_time_mage', portraitClass: '⚡', side: 'right', text: 'Impossible... the power of Chronos... overwhelmed?!' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'The sorcerer is defeated. Look! He dropped an ancient Zodiac seal!' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'The seal points back to the high fortress... The true mastermind awaits us atop the battlement!' }
    ],
    choices: [
      {
        text: 'Ascend to the Zodiac Summit for the final battle!',
        nextChapterId: 'chapter_3',
        rewardText: 'Armory: Hermes Slippers & Windslayer Bow',
        rewardItemIds: ['hermes_shoes', 'sniper_bow']
      }
    ],
    enemyRoster: [
      { name: 'Arch-Warlock', jobId: 'time_mage', level: 4, x: 2, z: 0, isBoss: true },
      { name: 'Bog Poisoner', jobId: 'black_mage', level: 3, x: 3, z: 1 },
      { name: 'Swamp Shinobi', jobId: 'ninja', level: 3, x: 7, z: 4 },
      { name: 'Mire Skirmisher', jobId: 'ninja', level: 4, x: 12, z: 2 },
      { name: 'Bog Ooze', jobId: 'ooze', level: 4, x: 9, z: 2 },
      { name: 'Marsh Wisp', jobId: 'wisp', level: 3, x: 6, z: 7 }
    ]
  },

  chapter_2b: {
    id: 'chapter_2b',
    title: 'CHAPTER II-B',
    subtitle: 'The Siege of Night Battlement',
    mapId: 'night_fortress',
    recruit: { id: 'p5', name: 'Bria', jobId: 'geomancer', level: 4 },
    rewardItemIds: ['crystal_helm', 'mirror_shield'],
    // 0.53.0: hold the gate (the map marks it, and hides the defenders' traps on the approach)
    objective: { type: 'hold', rounds: 3 },
    introDialogue: [
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'We arrived in time! The fortress drawbridge has been breached, but the ramparts hold!' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'The garrison sent for anyone who could hold a staff. I am Bria, a Geomancer. Stone walls answer to me. Point me at the enemy.' },
      { speaker: 'Dragoon Commander', portrait: 'foe_dragoon', portraitClass: '🐉', side: 'right', text: 'Knights of the realm! Test your steel against the spears of the sky!' },
      { speaker: 'Corvin', portraitClass: '✦', side: 'left', text: 'He brought a wyvern. It will come over the walls, not through the gate. Keep a spear pointed at the sky, and Remedies for its sting.' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'The gate is ours to take. Hold it and the yard behind it for three rounds, and the garrison can bar it again. Or drive every one of them off the walls.' },
      { speaker: 'Corvin', portraitClass: '✦', side: 'left', text: 'And watch the ground on the way in. They had all day to dig.' }
    ],
    victoryDialogue: [
      { speaker: 'Dragoon Commander', portrait: 'foe_dragoon', portraitClass: '🐉', side: 'right', text: 'A magnificent duel... You fight with genuine honor, Rowan...' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'The fortress is secured! But the rebel high council is assembling at the summit!' }
    ],
    choices: [
      {
        text: 'Storm the fortress inner sanctum for the final confrontation!',
        nextChapterId: 'chapter_3',
        rewardText: 'Armory: Aegis Barrier & Platinum Blade',
        rewardItemIds: ['aegis_shield', 'platinum_blade']
      }
    ],
    enemyRoster: [
      // Snipers hold the wall walk either side of the gate (reachable by the stairs). Tuned with
      // `npm run balance` back to roughly this chapter's 0.9 difficulty (see CHANGELOG 0.11.0)
      { name: 'Dragoon Commander', jobId: 'dragoon', level: 3, x: 7, z: 1, isBoss: true },
      { name: 'Rampart Sniper', jobId: 'archer', level: 3, x: 4, z: 8 },
      { name: 'Tower Sniper', jobId: 'archer', level: 3, x: 10, z: 8 },
      { name: 'Iron Vanguard', jobId: 'knight', level: 3, x: 7, z: 7 },
      { name: 'War Wyvern', jobId: 'wyvern', level: 3, x: 8, z: 7 }
    ]
  },

  chapter_3: {
    id: 'chapter_3',
    title: 'CHAPTER III',
    subtitle: 'The Awakening at the Summit',
    mapId: 'zodiac_summit',
    rewardItemIds: ['zodiac_blade', 'ribbon', 'dragon_mail'],
    introDialogue: [
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'This ends now! Surrender the Zodiac Seal, rebels!' },
      { speaker: 'Zodiac Champion', portrait: 'foe_dragoon', portraitClass: '👑', side: 'right', text: 'Puny mortals! The power of the ancient zodiac hums in our veins! Behold true divine majesty!' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'Shields up! For the realm and for justice!' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'Mind the altar. When the Champion is wounded, the Zodiac Seal will drive him into a frenzy. Strike from behind and finish it fast.' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'And the thing of stone by the altar? It woke when the Seal did. Do not crowd it: it shakes the ground around it. Bows and spells, from range.' }
    ],
    victoryDialogue: [
      { speaker: 'Zodiac Champion', portrait: 'foe_dragoon', portraitClass: '👑', side: 'right', text: 'How could... mortal hands... break the celestial ward?! NOOOO!' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'The stone is sealed. The realm is saved! Honor and victory to our companions!' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'The songs will remember this day. Well fought, Rowan!' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'The stone is quiet, but not empty. Something answered it from the sea. A second seal, far to the north... and it is waking.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'And the Gate beneath the mountain has opened. Twelve more seals, each a battle, for anyone who wants to test themselves.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Then we are not done. A rider just came in from the coast: black sails off Emberwick, and the harbor is burning.' }
    ],
    choices: [
      {
        text: 'Ride for Emberwick Harbor and find out who is hunting the second seal!',
        nextChapterId: 'chapter_4',
        rewardText: 'Armory: Moonfang',
        rewardItemIds: ['moonfang']
      }
    ],
    enemyRoster: [
      // 0.20.0: the escorts are a level lower, and the Chronomancer and the assassin are gone.
      // A healer behind a Haste caster and four level-5 escorts made this the hardest fight in the
      // game (0% in the balance sim even for a level-7 squad), and since 0.17 it is the middle of
      // the story, not its end
      { name: 'Zodiac Champion', jobId: 'dragoon', level: 5, x: 7, z: 2, isBoss: true },
      { name: 'Zealot Medic', jobId: 'white_mage', level: 4, x: 8, z: 0 },
      { name: 'Black Archmage', jobId: 'black_mage', level: 4, x: 10, z: 3 },
      { name: 'Altar Guardian', jobId: 'brute', level: 3, x: 9, z: 6 }
    ]
  },

  chapter_4: {
    id: 'chapter_4',
    title: 'CHAPTER IV',
    subtitle: 'Fire on the Water',
    mapId: 'ember_harbor',
    rewardItemIds: ['oath_shield'],
    recruit: { id: 'sable', name: 'Sable', jobId: 'thief', level: 6 },
    introDialogue: [
      { speaker: 'Captain Varrow', portrait: 'foe_ninja', portraitClass: '☠', side: 'right', text: 'Load the last of it! The Tidecaller pays in gold for every chart of these waters, and she pays double for speed.' },
      { speaker: 'Sable', portrait: 'thief', portraitClass: '🗡', side: 'left', text: 'Knights! Over here. I know that ship, I used to crew her. Get me aboard and I will show you where Varrow keeps the charts.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Then you fight with us. The sea is too deep to wade: we take the piers. Watch the cross-pier, they will try to get behind us.' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'Three piers, one ship. Split them up and meet on the deck.' },
      { speaker: 'Sable', portrait: 'thief', portraitClass: '🗡', side: 'left', text: 'One more thing. Varrow feeds something in the bilge. It eats through armor, and it is out on the piers tonight.' },
      { speaker: 'Corvin', portraitClass: '✦', side: 'left', text: 'And the west pier is burning, and a warehouse on the quay. Do not stop on the embers.' }
    ],
    victoryDialogue: [
      { speaker: 'Captain Varrow', portrait: 'foe_ninja', portraitClass: '☠', side: 'right', text: 'Keep the ship... The charts are already gone. She sailed for Greywatch on the morning tide.' },
      { speaker: 'Sable', portrait: 'thief', portraitClass: '🗡', side: 'left', text: 'Greywatch Isle. There is a lighthouse on that rock, and under it a door nobody has opened in my lifetime. I am coming with you.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'The Tidecaller means to use the light to find the seal. We should reach it before the next spring tide.' }
    ],
    choices: [
      {
        text: 'Sail for Greywatch Isle before the Tidecaller finds the seal!',
        nextChapterId: 'chapter_5',
        rewardText: 'Armory: Warding Amulet',
        rewardItemIds: ['warding_amulet']
      }
    ],
    enemyRoster: [
      { name: 'Captain Varrow', jobId: 'ninja', level: 7, x: 7, z: 1, isBoss: true },
      { name: 'Corsair Mate', jobId: 'spellblade', level: 6, x: 9, z: 1 },
      { name: 'Deck Gunner', jobId: 'archer', level: 6, x: 11, z: 0 },
      { name: 'Bilge Ooze', jobId: 'ooze', level: 6, x: 3, z: 4 },
      { name: 'Corsair Brawler', jobId: 'monk', level: 6, x: 12, z: 5 },
      { name: 'Ship Chanter', jobId: 'white_mage', level: 5, x: 5, z: 1 }
    ]
  },

  chapter_5: {
    id: 'chapter_5',
    title: 'CHAPTER V',
    subtitle: 'The Greywatch Light',
    mapId: 'greywatch_isle',
    rewardItemIds: ['runeblade'],
    introDialogue: [
      { speaker: 'Tidecaller Maelis', portrait: 'foe_summoner', portraitClass: '🌊', side: 'right', text: 'You are late, little knights. The light has shown me where the Drowned Regent sleeps. Stay, and watch the tide come in.' },
      { speaker: 'Corvin', portraitClass: '✦', side: 'left', text: 'She holds the high ground the whole way up. Every terrace we take makes the next one easier. Except for that wyvern nesting on the light: walls mean nothing to it. And there is a basilisk sunning itself by the tower. Do not stand where it can see you.' },
      { speaker: 'Sable', portrait: 'thief', portraitClass: '🗡', side: 'left', text: 'The shallows on either side are slow going, but nobody watches them. Her healer stands by the tower door: get to him, or we will kill the same cultists twice.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'And watch the ground. When she starts calling and the stones round you begin to glow, move. That is the sea she is calling up, and it does not miss.' }
    ],
    victoryDialogue: [
      { speaker: 'Tidecaller Maelis', portrait: 'foe_summoner', portraitClass: '🌊', side: 'right', text: 'It makes no difference. The door is open. He is already walking up out of the sea at Stormbreak...' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'The second seal was never a stone. It was a tomb. Whatever the old kingdom drowned out there, she has let it out.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Then we meet it on the cape, before it reaches a single village. One more fight.' }
    ],
    choices: [
      {
        text: 'Make for Stormbreak Cape and stop the Drowned Regent at the water\'s edge!',
        nextChapterId: 'chapter_6',
        rewardText: 'Armory: Templar Mail',
        rewardItemIds: ['templar_mail']
      }
    ],
    enemyRoster: [
      { name: 'Tidecaller Maelis', jobId: 'summoner', level: 7, x: 7, z: 2, isBoss: true },
      { name: 'Tower Acolyte', jobId: 'white_mage', level: 6, x: 9, z: 1 },
      { name: 'Tide Augur', jobId: 'oracle', level: 6, x: 5, z: 3 },
      { name: 'Greywatch Sentinel', jobId: 'knight', level: 6, x: 7, z: 5 },
      { name: 'Storm Wyvern', jobId: 'wyvern', level: 5, x: 10, z: 4 },
      { name: 'Cliff Basilisk', jobId: 'basilisk', level: 6, x: 6, z: 1 }
    ]
  },

  chapter_6: {
    id: 'chapter_6',
    title: 'CHAPTER VI',
    subtitle: 'The Drowned Regent',
    mapId: 'stormbreak_cape',
    rewardItemIds: ['dawn_blade'],
    introDialogue: [
      { speaker: 'The Drowned Regent', portrait: 'foe_paladin', portraitClass: '👑', side: 'right', text: 'Three hundred years beneath the tide, and still they send children with swords. Kneel. Your kingdom was mine before it had a name.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'It stopped being yours when they sealed you under the sea. Squad, with me!' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'The chasm splits the climb. Pick a side and go together, or cross the rope bridge and take his guard in the flank.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'He is still half drowned. Wound him and the old seal will drag at him... but it will make him furious first.' },
      { speaker: 'Sable', portrait: 'thief', portraitClass: '🗡', side: 'left', text: 'He did not come up alone. Barrow-stone that walks, dead lights off the water, and one of his old knights, still in its helm. Watch the lights: they will put you to sleep if you let them. The knight will not sleep at all.' }
    ],
    victoryDialogue: [
      { speaker: 'The Drowned Regent', portrait: 'foe_paladin', portraitClass: '👑', side: 'right', text: 'The sea... takes me back. Remember who it was... that stood here...' },
      { speaker: 'Sable', portrait: 'thief', portraitClass: '🗡', side: 'left', text: 'Gone, armour and all. I have robbed a lot of tombs. First time I have put anything back in one.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Both seals are quiet. The realm is safe, and this time I believe it. Thank you, all of you.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'Safe, yes. Though the mountain still hums at night. If any of you grow restless, the Gate of Trials stands open.' },
      // Act III (0.34.0): the story goes on across the sea
      { speaker: 'Sable', portrait: 'thief', portraitClass: '🗡', side: 'left', text: 'Not so fast. I took one thing out of his tomb before I put him back: this chart. His court did not drown with him. They sailed for the old kingdom\'s shore, a month ago.' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'The Far Shore. My grandmother said it was all desert and mountains now, and that nobody who sailed there came back to say so.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Then we will be the first. Emberwick has ships. Rest tonight; we sail when you are ready.' }
    ],
    choices: [
      {
        text: 'Take ship at Emberwick Harbor and follow the Regent\'s court across the sea to the Far Shore.',
        nextChapterId: 'chapter_7',
        rewardText: 'A passage across the sea, and Sable\'s stolen chart'
      }
    ],
    enemyRoster: [
      { name: 'The Drowned Regent', jobId: 'paladin', level: 9, x: 7, z: 1, isBoss: true },
      { name: 'Drowned Chaplain', jobId: 'white_mage', level: 8, x: 9, z: 1 },
      { name: 'Drowned Wisp', jobId: 'wisp', level: 7, x: 5, z: 1 },
      { name: 'Barrow Brute', jobId: 'brute', level: 8, x: 7, z: 4 },
      { name: 'Wraith Duelist', jobId: 'spellblade', level: 8, x: 3, z: 7 },
      { name: 'Wraith Lancer', jobId: 'dragoon', level: 8, x: 12, z: 7 },
      { name: 'Drowned Knight', jobId: 'bone_knight', level: 8, x: 12, z: 3 }
    ]
  },

  // ACT III: THE FAR SHORE (0.34.0)
  chapter_7: {
    id: 'chapter_7',
    title: 'CHAPTER VII',
    subtitle: 'The Saltglass Shore',
    mapId: 'saltglass_shore',
    rewardItemIds: ['saltglass_blade'],
    recruit: { id: 'kestrel', name: 'Kestrel', jobId: 'tamer', level: 9 },
    introDialogue: [
      { speaker: 'Herald Isaine', portrait: 'foe_spellblade', portraitClass: '🌊', side: 'right', text: 'Knights of the little kingdom, on our beach. The Regent sleeps again, then. No matter. His daughter is awake.' },
      { speaker: 'Kestrel', portrait: 'kestrel', portraitClass: '🐾', side: 'left', text: 'You came off that ship, so you are not with them. Good. They burned my village for a road to the old harbour. I know these dunes, and I know what lives in them.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Then fight with us. Who is the Regent\'s daughter?' },
      { speaker: 'Kestrel', portrait: 'kestrel', portraitClass: '🐾', side: 'left', text: 'They call her the Pale Heir. Later. There is a basilisk in the dunes and a briar-thing in the wreck, and they will not wait for introductions.' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'The channel splits the beach. Take the sandbar ford or the old steps; the Herald holds the high stones of the port.' }
    ],
    victoryDialogue: [
      { speaker: 'Herald Isaine', portrait: 'foe_spellblade', portraitClass: '🌊', side: 'right', text: 'Run home, little knights... The Marshal holds the pass. The Heir is already in the mountains, and beyond them the sea is giving the city back.' },
      { speaker: 'Kestrel', portrait: 'kestrel', portraitClass: '🐾', side: 'left', text: 'Frostfang Pass. The only road over the mountains, and the Court built a fort at the top of it. I am coming. I have a village to answer for.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: '"Giving the city back." The drowned capital. If she raises it, the old kingdom comes with it.' }
    ],
    choices: [
      {
        text: 'Climb Frostfang Pass and break the Court\'s fort before the Pale Heir reaches the sea.',
        nextChapterId: 'chapter_8',
        rewardText: 'Armory: Frostfang Mail',
        rewardItemIds: ['frostfang_mail']
      }
    ],
    enemyRoster: [
      { name: 'Herald Isaine', jobId: 'spellblade', level: 10, x: 7, z: 1, isBoss: true },
      { name: 'Court Pugilist', jobId: 'monk', level: 9, x: 5, z: 3 },
      { name: 'Court Crossbow', jobId: 'archer', level: 9, x: 10, z: 2 },
      { name: 'Court Chaplain', jobId: 'white_mage', level: 9, x: 8, z: 0 },
      { name: 'Tide Augur', jobId: 'oracle', level: 9, x: 6, z: 1 },
      { name: 'Dune Basilisk', jobId: 'basilisk', level: 9, x: 13, z: 6 },
      { name: 'Wreck Thornling', jobId: 'thornling', level: 9, x: 13, z: 10 }
    ]
  },

  chapter_8: {
    id: 'chapter_8',
    title: 'CHAPTER VIII',
    subtitle: 'Frostfang Pass',
    mapId: 'frostfang_pass',
    introDialogue: [
      { speaker: 'Marshal Hale', portrait: 'foe_knight', portraitClass: '🛡', side: 'right', text: 'Far enough. Three hundred years my order has kept this pass for the true crown. We will keep it one more day.' },
      { speaker: 'Corvin', portraitClass: '✦', side: 'left', text: 'Terraces all the way up, and the fort on top. The snow is deep off the road: two steps for one. Stay on the beaten track or take the west ledge.' },
      { speaker: 'Kestrel', portrait: 'kestrel', portraitClass: '🐾', side: 'left', text: 'There is a wyvern over the fort and wolves in the pines. And one of the drowned knights walks with them. The cold does not bother it.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Then we climb fast. Squad, up the pass!' }
    ],
    victoryDialogue: [
      { speaker: 'Marshal Hale', portrait: 'foe_knight', portraitClass: '🛡', side: 'right', text: 'Kept it... one day short. She is past the mountains. When the bells ring under the water... you will know you were too late.' },
      { speaker: 'Kestrel', portrait: 'kestrel', portraitClass: '🐾', side: 'left', text: 'From the top you can see it. The far coast, and the sea pulling back from something white. Towers.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'The drowned city is rising. We rest, we gather what we can, and then we go down to meet her.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Together, like always. The Pale Heir has not met us yet.' }
    ],
    choices: [
      {
        text: 'Go down to the drowned city and stop the Pale Heir before the old kingdom rises with it.',
        nextChapterId: 'chapter_9',
        rewardText: 'Armory: a Pale Pearl',
        rewardItemIds: ['pale_pearl']
      }
    ],
    enemyRoster: [
      { name: 'Marshal Hale', jobId: 'knight', level: 11, x: 7, z: 1, isBoss: true },
      { name: 'Frost Wyvern', jobId: 'wyvern', level: 10, x: 10, z: 2 },
      { name: 'Court Hexer', jobId: 'black_mage', level: 10, x: 9, z: 0 },
      { name: 'Court Seer', jobId: 'time_mage', level: 10, x: 6, z: 0 },
      { name: 'Pass Wolf', jobId: 'wolf', level: 10, x: 12, z: 6 },
      { name: 'Vael Revenant', jobId: 'bone_knight', level: 10, x: 4, z: 5 }
    ]
  },

  // ACT III FINALE (0.35.0)
  chapter_9: {
    id: 'chapter_9',
    title: 'CHAPTER IX',
    subtitle: 'The Pale Heir',
    mapId: 'drowned_city',
    rewardItemIds: ['tidecrown'],
    epilogue: {
      title: 'THE SEA IS QUIET',
      text: 'The Pale Heir is beaten, and the drowned city sinks back into the bay, bells and all. The old kingdom stays under the water. The Court is broken, Kestrel\'s village can be rebuilt, and the ship is waiting at the Anchorage to take the squad home. Act III is complete. The Far Shore stays open to wander, and the Trials of the Zodiac stand open: endless generated battles with rare gear and a Warden boss every fifth floor.'
    },
    introDialogue: [
      { speaker: 'Pale Heir', portrait: 'pale_heir', portraitClass: '🌊', side: 'right', text: 'You walked all this way to watch? Listen. The bells are ringing. My father\'s kingdom is coming back up, street by street.' },
      { speaker: 'Sable', portrait: 'thief', portraitClass: '🗡', side: 'left', text: 'The chart called her the last of the line. It did not say she could call the sea.' },
      { speaker: 'Kestrel', portrait: 'kestrel', portraitClass: '🐾', side: 'left', text: 'The canals are silted with weed. Wade them and you are slow. The bridge in the east is the only dry way over.' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'Her knights hold the stair to the dais. Take the plaza first, then go up together.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'One more fight, and then everyone goes home. Squad, into the city!' }
    ],
    victoryDialogue: [
      { speaker: 'Pale Heir', portrait: 'pale_heir', portraitClass: '🌊', side: 'right', text: 'The bells... they are stopping. Father, I am sorry. The sea wants it back.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'The water is coming in again. Slowly. The city is going back to sleep.' },
      { speaker: 'Kestrel', portrait: 'kestrel', portraitClass: '🐾', side: 'left', text: 'Then my village is safe, and so are the wild things in the dunes. Thank you. All of you.' },
      { speaker: 'Corvin', portraitClass: '✦', side: 'left', text: 'Up to the causeway, before it floods. The ship will not wait forever.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Home, then. Together, like always.' }
    ],
    enemyRoster: [
      { name: 'The Pale Heir', jobId: 'summoner', level: 12, x: 7, z: 0, isBoss: true },
      { name: 'Heir\'s Guard', jobId: 'bone_knight', level: 11, x: 5, z: 3 },
      { name: 'Heir\'s Guard', jobId: 'bone_knight', level: 11, x: 9, z: 3 },
      { name: 'Tide Priest', jobId: 'white_mage', level: 11, x: 8, z: 1 },
      { name: 'Drowned Wisp', jobId: 'wisp', level: 10, x: 3, z: 5 },
      { name: 'Canal Basilisk', jobId: 'basilisk', level: 11, x: 13, z: 4 }
    ]
  }
};
