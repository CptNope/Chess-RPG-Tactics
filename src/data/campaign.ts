import { CampaignChapter } from '../core/types';

/** Where each squad member deploys at the start of a battle (index = squad order). */
export const PLAYER_DEPLOY: { x: number; z: number }[] = [
  { x: 3, z: 8 }, { x: 4, z: 8 }, { x: 5, z: 9 }, { x: 2, z: 7 }, { x: 6, z: 9 }, { x: 4, z: 10 }
];

export const CAMPAIGN_CHAPTERS: Record<string, CampaignChapter> = {
  chapter_1: {
    id: 'chapter_1',
    title: 'CHAPTER I',
    subtitle: 'Ambush at Riverside Ruins',
    mapId: 'river_ruins',
    introDialogue: [
      { speaker: 'Ramza', portraitClass: '⚔', side: 'left', text: 'Halt, brigands! The knights of the realm have encircled these ruins. Lay down your arms!' },
      { speaker: 'Bandit Chief', portraitClass: '🛡', side: 'right', text: 'Bah! Spoiled nobles strutting in fine armor! You know nothing of our hunger or our cause!' },
      { speaker: 'Rogue Warlock', portraitClass: '⚡', side: 'right', text: 'The ancient Zodiac Stones slumber beneath this soil... We will not let dogs of the throne claim them!' },
      { speaker: 'Agrias', portraitClass: '⚜', side: 'left', text: 'Silence your blasphemy, rebel! In the name of the realm, draw your steel!' }
    ],
    victoryDialogue: [
      { speaker: 'Bandit Chief', portraitClass: '🛡', side: 'right', text: 'Ugh... Curse you, knights! Warlock... fall back to the sanctuary...' },
      { speaker: 'Agrias', portraitClass: '⚜', side: 'left', text: 'The rebel leader is subdued, but the sorcerer fled across the river!' },
      { speaker: 'Ramza', portraitClass: '⚔', side: 'left', text: 'Our scouts report two movements: the sorcerer fled into the toxic bogs, while a rebel force marches on the northern fortress!' }
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
    rewardItemIds: ['power_wrist'],
    enemyRoster: [
      { name: 'Bandit Chief', jobId: 'knight', level: 3, x: 8, z: 3, isBoss: true },
      { name: 'Shadow Shinobi', jobId: 'ninja', level: 3, x: 7, z: 2 },
      { name: 'Rogue Warlock', jobId: 'time_mage', level: 3, x: 6, z: 4 },
      { name: 'Brigand Bowman', jobId: 'archer', level: 3, x: 9, z: 2 }
    ]
  },

  chapter_2a: {
    id: 'chapter_2a',
    title: 'CHAPTER II-A',
    subtitle: 'The Sunken Crypts (Gloomy Mire)',
    mapId: 'gloomy_swamp',
    recruit: { id: 'p5', name: 'Bria', jobId: 'geomancer', level: 4 },
    rewardItemIds: ['gaia_staff'],
    introDialogue: [
      { speaker: 'Ramza', portraitClass: '⚔', side: 'left', text: 'The fog is thick with venom... Tread carefully on the wooden boardwalks!' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'You will drown out here without a guide, knight. I am Bria. This mire is my home, and that warlock has poisoned it. I fight with you.' },
      { speaker: 'Ramza', portraitClass: '⚔', side: 'left', text: 'A Geomancer! Your earth-magic changes with the ground you stand on, yes? Then this bog is your weapon. Welcome, Bria.' },
      { speaker: 'Rogue Warlock', portraitClass: '⚡', side: 'right', text: 'You foolhardy whelps! You walked straight into my temporal web!' },
      { speaker: 'Shadow Shinobi', portraitClass: '🗡', side: 'right', text: 'No knight leaves this bog alive. Disperse into the mist!' }
    ],
    victoryDialogue: [
      { speaker: 'Rogue Warlock', portraitClass: '⚡', side: 'right', text: 'Impossible... the power of Chronos... overwhelmed?!' },
      { speaker: 'Agrias', portraitClass: '⚜', side: 'left', text: 'The sorcerer is defeated. Look! He dropped an ancient Zodiac seal!' },
      { speaker: 'Ramza', portraitClass: '⚔', side: 'left', text: 'The seal points back to the high fortress... The true mastermind awaits us atop the battlement!' }
    ],
    choices: [
      {
        text: 'Ascend to the summit for the final battle at Night Battlement!',
        nextChapterId: 'chapter_3',
        rewardText: 'Armory: Hermes Slippers & Windslayer Bow',
        rewardItemIds: ['hermes_shoes', 'sniper_bow']
      }
    ],
    enemyRoster: [
      { name: 'Arch-Warlock', jobId: 'time_mage', level: 4, x: 5, z: 2, isBoss: true },
      { name: 'Swamp Shinobi', jobId: 'ninja', level: 4, x: 3, z: 4 },
      { name: 'Bog Poisoner', jobId: 'black_mage', level: 4, x: 7, z: 3 },
      { name: 'Mire Skirmisher', jobId: 'ninja', level: 4, x: 8, z: 2 }
    ]
  },

  chapter_2b: {
    id: 'chapter_2b',
    title: 'CHAPTER II-B',
    subtitle: 'The Siege of Night Battlement',
    mapId: 'night_fortress',
    recruit: { id: 'p5', name: 'Bria', jobId: 'geomancer', level: 4 },
    rewardItemIds: ['crystal_helm'],
    introDialogue: [
      { speaker: 'Ramza', portraitClass: '⚔', side: 'left', text: 'We arrived in time! The fortress drawbridge has been breached, but the ramparts hold!' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'The garrison sent for anyone who could hold a staff. I am Bria, a Geomancer. Stone walls answer to me. Point me at the enemy.' },
      { speaker: 'Dragoon Commander', portraitClass: '🐉', side: 'right', text: 'Knights of the realm! Test your steel against the spears of the sky!' },
      { speaker: 'Agrias', portraitClass: '⚜', side: 'left', text: 'Take the parapets! Drive them from the towers!' }
    ],
    victoryDialogue: [
      { speaker: 'Dragoon Commander', portraitClass: '🐉', side: 'right', text: 'A magnificent duel... You fight with genuine honor, Ramza...' },
      { speaker: 'Ramza', portraitClass: '⚔', side: 'left', text: 'The fortress is secured! But the rebel high council is assembling at the summit!' }
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
      { name: 'Dragoon Commander', jobId: 'dragoon', level: 4, x: 5, z: 1, isBoss: true },
      { name: 'Rampart Sniper', jobId: 'archer', level: 4, x: 2, z: 1 },
      { name: 'Tower Sniper', jobId: 'archer', level: 4, x: 8, z: 1 },
      { name: 'Iron Vanguard', jobId: 'knight', level: 4, x: 5, z: 4 }
    ]
  },

  chapter_3: {
    id: 'chapter_3',
    title: 'FINAL CHAPTER',
    subtitle: 'The Awakening at the Summit',
    mapId: 'zodiac_summit',
    rewardItemIds: ['zodiac_blade', 'ribbon', 'dragon_mail'],
    introDialogue: [
      { speaker: 'Ramza', portraitClass: '⚔', side: 'left', text: 'This ends now! Surrender the Zodiac Stone, rebels!' },
      { speaker: 'Zodiac Champion', portraitClass: '👑', side: 'right', text: 'Puny mortals! The power of the ancient zodiac hums in our veins! Behold true divine majesty!' },
      { speaker: 'Agrias', portraitClass: '⚜', side: 'left', text: 'Shields up! For the realm and for justice!' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'Mind the altar. When the Champion is wounded, the Zodiac Stone will drive him into a frenzy. Strike from behind and finish it fast.' }
    ],
    victoryDialogue: [
      { speaker: 'Zodiac Champion', portraitClass: '👑', side: 'right', text: 'How could... mortal hands... break the celestial ward?! NOOOO!' },
      { speaker: 'Ramza', portraitClass: '⚔', side: 'left', text: 'The stone is sealed. The realm is saved! Honor and victory to our companions!' },
      { speaker: 'Agrias', portraitClass: '⚜', side: 'left', text: 'The songs will remember this day. Well fought, Ramza!' },
      { speaker: 'Bria', portraitClass: '🌿', side: 'left', text: 'The stone is quiet, but not empty. I can hear twelve more seals beneath the mountain... The Trials of the Zodiac await anyone brave enough.' }
    ],
    enemyRoster: [
      { name: 'Zodiac Champion', jobId: 'dragoon', level: 5, x: 5, z: 1, isBoss: true },
      { name: 'Grand Chronomancer', jobId: 'time_mage', level: 5, x: 3, z: 2 },
      { name: 'Shadow Assassin', jobId: 'ninja', level: 5, x: 7, z: 2 },
      { name: 'Black Archmage', jobId: 'black_mage', level: 5, x: 5, z: 3 },
      { name: 'Zealot Medic', jobId: 'white_mage', level: 5, x: 6, z: 0 }
    ]
  }
};
