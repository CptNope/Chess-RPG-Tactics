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
        text: 'Pursue the fleeing sorcerer into the Gloomy Mire!',
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
      { name: 'Bog Poisoner', jobId: 'black_mage', level: 4, x: 3, z: 1 },
      { name: 'Swamp Shinobi', jobId: 'ninja', level: 4, x: 7, z: 4 },
      { name: 'Mire Skirmisher', jobId: 'ninja', level: 4, x: 12, z: 2 },
      { name: 'Reed Stalker', jobId: 'archer', level: 3, x: 6, z: 7 }
    ]
  },

  chapter_2b: {
    id: 'chapter_2b',
    title: 'CHAPTER II-B',
    subtitle: 'The Siege of Night Battlement',
    mapId: 'night_fortress',
    recruit: { id: 'p5', name: 'Bria', jobId: 'geomancer', level: 4 },
    rewardItemIds: ['crystal_helm', 'mirror_shield'],
    introDialogue: [
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'We arrived in time! The fortress drawbridge has been breached, but the ramparts hold!' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'The garrison sent for anyone who could hold a staff. I am Bria, a Geomancer. Stone walls answer to me. Point me at the enemy.' },
      { speaker: 'Dragoon Commander', portrait: 'foe_dragoon', portraitClass: '🐉', side: 'right', text: 'Knights of the realm! Test your steel against the spears of the sky!' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'Take the parapets! Drive them from the towers!' }
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
      { name: 'Gate Brawler', jobId: 'monk', level: 3, x: 8, z: 7 }
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
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'Mind the altar. When the Champion is wounded, the Zodiac Seal will drive him into a frenzy. Strike from behind and finish it fast.' }
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
      { name: 'Altar Sentinel', jobId: 'knight', level: 4, x: 9, z: 6 }
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
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'Three piers, one ship. Split them up and meet on the deck.' }
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
      { name: 'Corsair Cutthroat', jobId: 'thief', level: 6, x: 3, z: 4 },
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
      { speaker: 'Corvin', portraitClass: '✦', side: 'left', text: 'She holds the high ground the whole way up. Every terrace we take makes the next one easier.' },
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
      { name: 'Greywatch Lancer', jobId: 'dragoon', level: 6, x: 10, z: 4 },
      { name: 'Storm Hexer', jobId: 'black_mage', level: 6, x: 6, z: 1 }
    ]
  },

  chapter_6: {
    id: 'chapter_6',
    title: 'FINAL CHAPTER',
    subtitle: 'The Drowned Regent',
    mapId: 'stormbreak_cape',
    rewardItemIds: ['dawn_blade'],
    introDialogue: [
      { speaker: 'The Drowned Regent', portrait: 'foe_paladin', portraitClass: '👑', side: 'right', text: 'Three hundred years beneath the tide, and still they send children with swords. Kneel. Your kingdom was mine before it had a name.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'It stopped being yours when they sealed you under the sea. Squad, with me!' },
      { speaker: 'Maren', portraitClass: '⚜', side: 'left', text: 'The chasm splits the climb. Pick a side and go together, or cross the rope bridge and take his guard in the flank.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'He is still half drowned. Wound him and the old seal will drag at him... but it will make him furious first.' }
    ],
    victoryDialogue: [
      { speaker: 'The Drowned Regent', portrait: 'foe_paladin', portraitClass: '👑', side: 'right', text: 'The sea... takes me back. Remember who it was... that stood here...' },
      { speaker: 'Sable', portrait: 'thief', portraitClass: '🗡', side: 'left', text: 'Gone, armour and all. I have robbed a lot of tombs. First time I have put anything back in one.' },
      { speaker: 'Rowan', portraitClass: '⚔', side: 'left', text: 'Both seals are quiet. The realm is safe, and this time I believe it. Thank you, all of you.' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'Safe, yes. Though the mountain still hums at night. If any of you grow restless, the Gate of Trials stands open.' }
    ],
    enemyRoster: [
      { name: 'The Drowned Regent', jobId: 'paladin', level: 9, x: 7, z: 1, isBoss: true },
      { name: 'Drowned Chaplain', jobId: 'white_mage', level: 8, x: 9, z: 1 },
      { name: 'Drowned Magus', jobId: 'black_mage', level: 8, x: 5, z: 1 },
      { name: 'Tomb Knight', jobId: 'knight', level: 8, x: 7, z: 4 },
      { name: 'Wraith Duelist', jobId: 'spellblade', level: 8, x: 3, z: 7 },
      { name: 'Wraith Lancer', jobId: 'dragoon', level: 8, x: 12, z: 7 },
      { name: 'Hourglass Seer', jobId: 'time_mage', level: 8, x: 12, z: 3 }
    ]
  }
};
