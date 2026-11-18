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
    name: 'Reinforced Hauberk',
    slot: 'body',
    description: 'Interlocking steel rings offering durable all-round combat protection.',
    price: 180,
    stats: { hp: 50 }
  },
  platinum_armor: {
    id: 'platinum_armor',
    name: 'Platinum Plate Mail',
    slot: 'body',
    description: 'Heavy tempered cuirass. Immense physical resilience at a minor weight cost.',
    price: 450,
    stats: { hp: 90, speed: -1 }
  },
  silk_robe: {
    id: 'silk_robe',
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
  }
};

export function getItemsForSlot(slot: EquipmentSlot): Item[] {
  return Object.values(ITEMS).filter((item) => item.slot === slot);
}
