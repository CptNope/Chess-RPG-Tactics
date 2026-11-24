import { Item, EquipmentSlot } from '../core/types';

export const ITEMS: Record<string, Item> = {
  // WEAPONS
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Broadsword',
    slot: 'weapon',
    weaponType: 'sword',
    description: 'Sturdy steel blade forged for frontline infantry. Reliable and well-balanced.',
    price: 100,
    stats: { attack: 4 },
    range: 1
  },
  platinum_blade: {
    id: 'platinum_blade',
    name: 'Platinum Blade',
    slot: 'weapon',
    weaponType: 'sword',
    description: 'Refined silver-edged broadsword wielded by elite royal knights.',
    price: 350,
    stats: { attack: 9, hp: 15 },
    range: 1
  },
  dragon_lance: {
    id: 'dragon_lance',
    name: 'Holy Dragon Lance',
    slot: 'weapon',
    weaponType: 'spear',
    description: 'Long blessed polearm capable of striking targets across 2 tiles distance.',
    price: 400,
    stats: { attack: 8, jump: 1 },
    range: 2 // Spear range!
  },
  hunting_bow: {
    id: 'hunting_bow',
    name: 'Longbow of the Gale',
    slot: 'weapon',
    weaponType: 'bow',
    description: 'Yew composite bow strung for long-range trajectory sniping.',
    price: 250,
    stats: { attack: 6 },
    range: 5
  },
  chrono_rod: {
    id: 'chrono_rod',
    name: 'Chrono Scepter',
    slot: 'weapon',
    weaponType: 'staff',
    description: 'Crystal-tipped rod channeling temporal and magical currents.',
    price: 300,
    stats: { attack: 3, magic: 7, mp: 20 },
    range: 1
  },
  assassin_daggers: {
    id: 'assassin_daggers',
    name: 'Twin Shadow Daggers',
    slot: 'weapon',
    weaponType: 'dagger',
    description: 'Lightweight matched blades coated for swift critical punctures.',
    price: 320,
    stats: { attack: 7, speed: 1, evasion: 10 },
    range: 1
  },

  // SHIELDS
  buckler: {
    id: 'buckler',
    name: 'Bronze Buckler',
    slot: 'shield',
    description: 'Light circular shield that deflects glancing melee strikes.',
    price: 80,
    stats: { evasion: 12 }
  },
  kite_shield: {
    id: 'kite_shield',
    name: 'Kite Shield',
    slot: 'shield',
    description: 'Heater shield bearing knightly heraldry, granting high frontal defense.',
    price: 220,
    stats: { evasion: 22, hp: 15 }
  },
  aegis_shield: {
    id: 'aegis_shield',
    name: 'Aegis Barrier',
    slot: 'shield',
    description: 'Sanctified tower shield blessed with protective magic.',
    price: 450,
    stats: { evasion: 32, hp: 30, mp: 15 }
  },

  // HEAD
  iron_helm: {
    id: 'iron_helm',
    armor: 'heavy',
    name: 'Steel Bascinet',
    slot: 'head',
    description: 'Stout steel helmet guarding against lethal cranial blows.',
    price: 120,
    stats: { hp: 30 }
  },
  wizard_hat: {
    id: 'wizard_hat',
    name: 'Pointed Wizard Hat',
    slot: 'head',
    description: 'Enchanted felt hat woven with arcane warding threads.',
    price: 150,
    stats: { hp: 15, mp: 25, magic: 3 }
  },
  shinobi_band: {
    id: 'shinobi_band',
    name: 'Shadow Headband',
    slot: 'head',
    description: 'Light headband focused on perception and reflexes.',
    price: 180,
    stats: { hp: 20, speed: 1, evasion: 5 }
  },

  // BODY
  chainmail: {
    id: 'chainmail',
    armor: 'heavy',
    name: 'Reinforced Hauberk',
    slot: 'body',
    description: 'Interlocking steel rings offering durable all-round combat protection.',
    price: 180,
    stats: { hp: 50 }
  },
  platinum_armor: {
    id: 'platinum_armor',
    armor: 'heavy',
    name: 'Platinum Plate Mail',
    slot: 'body',
    description: 'Heavy tempered cuirass. Immense physical resilience at a minor weight cost.',
    price: 450,
    stats: { hp: 90, speed: -1 }
  },
  silk_robe: {
    id: 'silk_robe',
    armor: 'robe',
    name: 'Astral Silk Robe',
    slot: 'body',
    description: 'Flowing mystic vestment that amplifies mana pool and magical power.',
    price: 260,
    stats: { hp: 30, mp: 45, magic: 5 }
  },
  shinobi_garb: {
    id: 'shinobi_garb',
    name: 'Nightwalker Tunic',
    slot: 'body',
    description: 'Muffled midnight silk providing optimal agility and evasion.',
    price: 300,
    stats: { hp: 35, speed: 1, evasion: 12 }
  },

  // ACCESSORIES
  battle_boots: {
    id: 'battle_boots',
    name: 'Battle Greaves',
    slot: 'accessory',
    description: 'Iron-toed boots that grant superior footing when scaling ledges.',
    price: 150,
    stats: { jump: 1 }
  },
  feather_boots: {
    id: 'feather_boots',
    name: 'Featherlight Boots',
    slot: 'accessory',
    description: 'Mythical winged sandals allowing extended movement stride.',
    price: 350,
    stats: { move: 1 }
  },
  hermes_shoes: {
    id: 'hermes_shoes',
    name: 'Hermes Slippers',
    slot: 'accessory',
    description: 'Gilded enchanted shoes that hasten the wearer speed.',
    price: 400,
    stats: { speed: 2 }
  },
  power_wrist: {
    id: 'power_wrist',
    name: 'Gauntlet of Might',
    slot: 'accessory',
    description: 'Heavy bronze gauntlet increasing raw physical striking impact.',
    price: 200,
    stats: { attack: 4 }
  },
  mage_ring: {
    id: 'mage_ring',
    name: 'Ring of Arcana',
    slot: 'accessory',
    description: 'Gleaming sapphire ring pulsing with inner magical reserves.',
    price: 220,
    stats: { magic: 4, mp: 25 }
  },

  // --- Added in 0.7.0: campaign rewards and Trials of the Zodiac drops ---
  gaia_staff: {
    id: 'gaia_staff',
    name: 'Gaia Staff',
    slot: 'weapon',
    weaponType: 'staff',
    description: 'Living oak staff that hums with the pulse of the earth. Favored by Geomancers.',
    price: 300,
    stats: { magic: 5, attack: 3, hp: 10 },
    range: 1
  },
  sniper_bow: {
    id: 'sniper_bow',
    name: 'Windslayer Bow',
    slot: 'weapon',
    weaponType: 'bow',
    description: 'Recurved yew longbow with a sighting notch. Reaches 6 tiles.',
    price: 420,
    stats: { attack: 7, speed: 1 },
    range: 6
  },
  zodiac_blade: {
    id: 'zodiac_blade',
    name: 'Zodiac Blade',
    slot: 'weapon',
    weaponType: 'sword',
    description: 'The champion\'s sealed sword, still warm with starlight. The finest blade in the realm.',
    price: 900,
    stats: { attack: 13, magic: 4, speed: 1 },
    range: 1
  },
  crystal_helm: {
    id: 'crystal_helm',
    armor: 'heavy',
    name: 'Crystal Helm',
    slot: 'head',
    description: 'Faceted helm cut from a single sky-crystal.',
    price: 380,
    stats: { hp: 30, mp: 10, evasion: 3 }
  },
  dragon_mail: {
    id: 'dragon_mail',
    armor: 'heavy',
    name: 'Wyrmscale Mail',
    slot: 'body',
    description: 'Overlapping dragon scales that turn aside blade and flame alike.',
    price: 520,
    stats: { hp: 55, attack: 2, evasion: 4 }
  },
  ribbon: {
    id: 'ribbon',
    name: 'Zodiac Ribbon',
    slot: 'accessory',
    description: 'A silk ribbon stitched with all twelve signs. Strengthens body and mind, and wards off every ailment.',
    price: 800,
    stats: { hp: 20, mp: 20, speed: 1, evasion: 5 },
    traits: { guard: ['poison', 'slow', 'immobilize', 'blind', 'silence', 'sleep', 'breach'] }
  },

  // --- Added in 0.13.0: gear for the Monk, Thief, Summoner and Oracle, and gear with traits ---
  iron_knuckles: {
    id: 'iron_knuckles',
    name: 'Iron Knuckles',
    slot: 'weapon',
    weaponType: 'knuckles',
    description: 'Riveted iron bands for the fists. A Monk\'s first weapon.',
    price: 120,
    stats: { attack: 5 },
    range: 1
  },
  tiger_claws: {
    id: 'tiger_claws',
    name: 'Tiger Claws',
    slot: 'weapon',
    weaponType: 'knuckles',
    description: 'Hooked steel claws strapped over the knuckles. Fast and vicious.',
    price: 480,
    stats: { attack: 10, speed: 1 },
    range: 1
  },
  thief_knife: {
    id: 'thief_knife',
    name: 'Cutpurse Knife',
    slot: 'weapon',
    weaponType: 'dagger',
    description: 'A short, quick blade made for cutting purse strings.',
    price: 140,
    stats: { attack: 5, speed: 1, evasion: 5 },
    range: 1
  },
  drovers_whip: {
    id: 'drovers_whip',
    name: 'Drover\'s Whip',
    slot: 'weapon',
    weaponType: 'whip',
    description: 'A braided leather whip that cracks 2 tiles out. Beast Tamers start with one.',
    price: 260,
    stats: { attack: 5, speed: 1 },
    range: 2
  },
  moonfang: {
    id: 'moonfang',
    name: 'Moonfang',
    slot: 'weapon',
    weaponType: 'dagger',
    description: 'A curved silver dagger that catches no light at all.',
    price: 520,
    stats: { attack: 9, speed: 1, evasion: 12 },
    range: 1
  },
  halberd: {
    id: 'halberd',
    name: 'Halberd',
    slot: 'weapon',
    weaponType: 'spear',
    description: 'Axe-headed polearm: heavier than a lance, still reaches 2 tiles.',
    price: 460,
    stats: { attack: 11 },
    range: 2
  },
  dawn_blade: {
    id: 'dawn_blade',
    name: 'Dawnbringer',
    slot: 'weapon',
    weaponType: 'sword',
    description: 'A templar\'s blade blessed at sunrise. Holy spells and heals from its bearer are 25% stronger.',
    price: 640,
    stats: { attack: 10, hp: 10 },
    range: 1,
    traits: { boost: ['holy'] }
  },
  siege_crossbow: {
    id: 'siege_crossbow',
    name: 'Siege Crossbow',
    slot: 'weapon',
    weaponType: 'bow',
    description: 'A heavy crank crossbow. Shorter reach than a longbow, far more punch.',
    price: 480,
    stats: { attack: 11, speed: -1 },
    range: 4
  },
  flame_rod: {
    id: 'flame_rod',
    name: 'Flame Rod',
    slot: 'weapon',
    weaponType: 'staff',
    description: 'Its ruby tip is always warm. Fire spells +25%.',
    price: 380,
    stats: { attack: 2, magic: 6 },
    range: 1,
    traits: { boost: ['fire'] }
  },
  frost_rod: {
    id: 'frost_rod',
    name: 'Frost Rod',
    slot: 'weapon',
    weaponType: 'staff',
    description: 'Rimed in ice that never melts. Ice spells +25%.',
    price: 380,
    stats: { attack: 2, magic: 6 },
    range: 1,
    traits: { boost: ['ice'] }
  },
  storm_rod: {
    id: 'storm_rod',
    name: 'Storm Rod',
    slot: 'weapon',
    weaponType: 'staff',
    description: 'Crackles when you hold it. Lightning spells +25%.',
    price: 380,
    stats: { attack: 2, magic: 6 },
    range: 1,
    traits: { boost: ['lightning'] }
  },
  sage_staff: {
    id: 'sage_staff',
    name: 'Sage\'s Staff',
    slot: 'weapon',
    weaponType: 'staff',
    description: 'Carved with words of power that keep the bearer\'s voice free. Guards against Silence.',
    price: 560,
    stats: { magic: 9, mp: 30 },
    range: 1,
    traits: { guard: ['silence'] }
  },

  mirror_shield: {
    id: 'mirror_shield',
    name: 'Mirror Shield',
    slot: 'shield',
    description: 'Polished to a perfect shine. Starts every battle with Shell.',
    price: 420,
    stats: { evasion: 18, mp: 10 },
    traits: { startStatus: ['shell'] }
  },

  leather_cap: {
    id: 'leather_cap',
    name: 'Leather Cap',
    slot: 'head',
    description: 'Boiled leather. Light, cheap, better than nothing.',
    price: 60,
    stats: { hp: 15 }
  },
  barbute: {
    id: 'barbute',
    armor: 'heavy',
    name: 'Barbute',
    slot: 'head',
    description: 'An open-faced steel helm that leaves room to see the next swing.',
    price: 340,
    stats: { hp: 45, attack: 2 }
  },
  sage_circlet: {
    id: 'sage_circlet',
    name: 'Sage\'s Circlet',
    slot: 'head',
    description: 'A thin gold band that sharpens thought.',
    price: 360,
    stats: { hp: 10, mp: 15, magic: 5 }
  },
  clarity_circlet: {
    id: 'clarity_circlet',
    name: 'Circlet of Clarity',
    slot: 'head',
    description: 'Keeps the mind clear and the eyes open. Guards against Blind, Silence and Sleep.',
    price: 440,
    stats: { hp: 15, mp: 10 },
    traits: { guard: ['blind', 'silence', 'sleep'] }
  },

  leather_vest: {
    id: 'leather_vest',
    name: 'Leather Vest',
    slot: 'body',
    description: 'Supple hide that lets you move.',
    price: 90,
    stats: { hp: 25, evasion: 3 }
  },
  brawler_gi: {
    id: 'brawler_gi',
    name: 'Brawler\'s Gi',
    slot: 'body',
    description: 'Heavy cotton training clothes, belted tight.',
    price: 380,
    stats: { hp: 40, attack: 3, evasion: 6 }
  },
  summoner_robe: {
    id: 'summoner_robe',
    armor: 'robe',
    name: 'Summoner\'s Robe',
    slot: 'body',
    description: 'Embroidered with the seals of the four spirits. A deep well of MP.',
    price: 440,
    stats: { hp: 25, mp: 60, magic: 6 }
  },
  templar_mail: {
    id: 'templar_mail',
    armor: 'heavy',
    name: 'Templar Mail',
    slot: 'body',
    description: 'Consecrated plate. Starts every battle with Shell.',
    price: 560,
    stats: { hp: 75, speed: -1 },
    traits: { startStatus: ['shell'] }
  },

  verdant_charm: {
    id: 'verdant_charm',
    name: 'Verdant Charm',
    slot: 'accessory',
    description: 'A living sprig sealed in glass. Regen for the whole battle.',
    price: 600,
    stats: { hp: 10 },
    traits: { startStatus: ['regen'] }
  },
  warding_amulet: {
    id: 'warding_amulet',
    name: 'Warding Amulet',
    slot: 'accessory',
    description: 'Twin wards against blade and spell. Starts every battle with Protect and Shell.',
    price: 520,
    stats: { hp: 10 },
    traits: { startStatus: ['protect', 'shell'] }
  },
  purity_bangle: {
    id: 'purity_bangle',
    name: 'Purity Bangle',
    slot: 'accessory',
    description: 'Blessed silver. Guards against Poison, Slow, binding and Breach.',
    price: 420,
    stats: { hp: 10 },
    traits: { guard: ['poison', 'slow', 'immobilize', 'breach'] }
  },
  sprinter_anklet: {
    id: 'sprinter_anklet',
    name: 'Sprinter\'s Anklet',
    slot: 'accessory',
    description: 'A runner\'s band of springy steel. Move +1 and Jump +1.',
    price: 620,
    stats: { move: 1, jump: 1 }
  },
  runeblade: {
    id: 'runeblade',
    name: 'Runeblade',
    slot: 'weapon',
    weaponType: 'sword',
    description: 'Glyphs run the length of the fuller. A sword for those who fight with spell and steel alike.',
    price: 560,
    stats: { attack: 8, magic: 6, mp: 15 },
    range: 1
  },
  oath_shield: {
    id: 'oath_shield',
    name: 'Oathkeeper',
    slot: 'shield',
    description: 'A templar\'s shield, sworn never to waver. Guards against Sleep and Blind.',
    price: 500,
    stats: { evasion: 20, hp: 20 },
    traits: { guard: ['sleep', 'blind'] }
  },
  berserker_band: {
    id: 'berserker_band',
    name: 'Berserker Band',
    slot: 'accessory',
    description: 'All power, no guard: ATK +7, but evasion drops.',
    price: 460,
    stats: { attack: 7, evasion: -5 }
  },

  // --- Added in 0.21.0: sold only by the travelling merchant ---
  lucky_coin: {
    id: 'lucky_coin',
    name: 'Lucky Coin',
    slot: 'accessory',
    description: 'A worn coin with a hole through it. Its owner never seems to be where the blow lands, and never loses sight of the fight.',
    price: 380,
    stats: { hp: 10, evasion: 10 },
    traits: { guard: ['blind'] }
  },
  wayfarer_boots: {
    id: 'wayfarer_boots',
    name: 'Wayfarer Boots',
    slot: 'accessory',
    description: 'Road-softened boots that have crossed the realm a dozen times. Move +1 and Speed +1.',
    price: 760,
    stats: { move: 1, speed: 1 }
  },
  starsteel_pike: {
    id: 'starsteel_pike',
    name: 'Starsteel Pike',
    slot: 'weapon',
    weaponType: 'spear',
    description: 'Forged from the iron of a fallen star: long, light, and easy to vault with.',
    price: 780,
    stats: { attack: 12, jump: 1 },
    range: 2
  },

  // --- Added in 0.21.0: won the first time a side battle is cleared ---
  fordwarden_bow: {
    id: 'fordwarden_bow',
    name: "Fordwarden's Bow",
    slot: 'weapon',
    weaponType: 'bow',
    description: 'Taken back from the Thornwood bandits: the old ford warden\'s bow, quick to draw.',
    price: 520,
    stats: { attack: 8, speed: 1, evasion: 5 },
    range: 5
  },
  chanting_censer: {
    id: 'chanting_censer',
    name: 'Chanting Censer',
    slot: 'accessory',
    description: 'A brass censer from the Drowned Shrine. Its smoke steadies the voice: MAG +4, and Silence can\'t take hold.',
    price: 540,
    stats: { magic: 4, mp: 20 },
    traits: { guard: ['silence'] }
  },
  watchfire_helm: {
    id: 'watchfire_helm',
    armor: 'heavy',
    name: 'Watchfire Helm',
    slot: 'head',
    description: 'The ridge garrison\'s helm, worn through long nights on watch. Its wearer neither sleeps nor loses sight of the dark.',
    price: 480,
    stats: { hp: 40 },
    traits: { guard: ['sleep', 'blind'] }
  },
  // Added in 0.26.0: the Howling Hollow's trophy
  wolfpelt_mantle: {
    id: 'wolfpelt_mantle',
    name: 'Wolfpelt Mantle',
    slot: 'body',
    description: 'The grey pelt of the Hollow\'s pack leader. Light and warm: its wearer runs a tile further, and venom can\'t take hold.',
    price: 560,
    stats: { hp: 25, evasion: 6, move: 1 },
    traits: { guard: ['poison'] }
  },

  // BEAST GEAR (0.29.0): only a tamed beast wears these, and a beast wears nothing else
  leather_collar: {
    id: 'leather_collar',
    name: 'Leather Collar',
    slot: 'accessory',
    beast: true,
    description: 'Beasts only. A stout collar with a brass tag: the beast stands its ground and slips a blow or two.',
    price: 160,
    stats: { hp: 20, evasion: 4 }
  },
  hide_barding: {
    id: 'hide_barding',
    name: 'Hide Barding',
    slot: 'body',
    beast: true,
    description: 'Beasts only. Boiled-leather plates strapped over the back and flanks.',
    price: 200,
    stats: { hp: 30, attack: 1 }
  },
  spiked_collar: {
    id: 'spiked_collar',
    name: 'Spiked Collar',
    slot: 'accessory',
    beast: true,
    description: 'Beasts only. Iron spikes round the neck put an edge on every bite and charge.',
    price: 320,
    stats: { attack: 5 }
  },
  glowstone_charm: {
    id: 'glowstone_charm',
    name: 'Glowstone Charm',
    slot: 'accessory',
    beast: true,
    description: 'Beasts only. A pebble that holds the marsh-light. Wisps burn brighter with one; anything else just likes the shine.',
    price: 340,
    stats: { magic: 6, mp: 15 }
  },
  chain_barding: {
    id: 'chain_barding',
    name: 'Chain Barding',
    slot: 'body',
    beast: true,
    description: 'Beasts only. Mail made for a warhorse, cut down to fit. Heavy, but very hard to get through.',
    price: 440,
    stats: { hp: 50, attack: 2, evasion: -3 }
  },
  runed_barding: {
    id: 'runed_barding',
    name: 'Runed Barding',
    slot: 'body',
    beast: true,
    description: 'Beasts only. Hide stitched with calming runes: no Sleep or Silence takes hold.',
    price: 560,
    stats: { hp: 40, mp: 15 },
    traits: { guard: ['sleep', 'silence'] }
  }
};

/** Sold only by the travelling merchant on the world map (0.21.0), never on the market's shelves. */
export const MERCHANT_ITEMS: string[] = ['lucky_coin', 'wayfarer_boots', 'starsteel_pike'];

/** Gear the squad owns at the start of a new campaign. */
export const STARTING_ARMORY: string[] = [
  'iron_sword', 'dragon_lance', 'hunting_bow', 'chrono_rod',
  'buckler', 'iron_helm', 'wizard_hat', 'shinobi_band',
  'chainmail', 'silk_robe', 'shinobi_garb',
  'battle_boots', 'feather_boots',
  'iron_knuckles', 'thief_knife', 'leather_cap', 'leather_vest', 'drovers_whip'
];

/** Pool used for random Trials of the Zodiac drops (excludes starter gear). */
export const RARE_DROP_POOL: string[] = [
  'platinum_blade', 'kite_shield', 'aegis_shield', 'platinum_armor', 'hermes_shoes', 'power_wrist',
  'mage_ring', 'assassin_daggers', 'gaia_staff', 'sniper_bow', 'crystal_helm', 'dragon_mail', 'ribbon',
  'tiger_claws', 'moonfang', 'halberd', 'dawn_blade', 'siege_crossbow', 'flame_rod', 'frost_rod', 'storm_rod',
  'sage_staff', 'mirror_shield', 'barbute', 'sage_circlet', 'clarity_circlet', 'brawler_gi', 'summoner_robe',
  'templar_mail', 'verdant_charm', 'warding_amulet', 'purity_bangle', 'sprinter_anklet', 'berserker_band',
  'runeblade', 'oath_shield'
];

/**
 * Items for a gear slot. When an armory (list of owned item ids) is passed, only owned
 * items are returned; without one, every item in the game is returned (map editor / tests).
 */
export function getItemsForSlot(slot: EquipmentSlot, armory?: string[]): Item[] {
  return Object.values(ITEMS).filter((item) => item.slot === slot && (!armory || armory.includes(item.id)));
}
