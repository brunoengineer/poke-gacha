// Hoenn content: its eight gym leaders, Elite Four, Champion and Training friends (texts in src/i18n/*/regions-*.ts).
// Pure data: the rules live in gyms.ts, league.ts and training.ts.

import { RARE_CANDY } from '../../data/items';
import type { Gym } from './gyms';
import type { LeagueBoss } from './league';
import type { Friend } from './training';

export const HOENN_GYMS: Gym[] = [
  { id: 'roxanne', leader: 'Roxanne', sprite: 'roxanne', type: 'rock', badge: 'stone', levels: [86, 89],
    roster: [74, 345, 347, 304, 337, 299], coins: 5000, items: [{ item: 'protector', amount: 1 }, { item: RARE_CANDY, amount: 15 }] },
  { id: 'brawly', leader: 'Brawly', sprite: 'brawly', type: 'fighting', badge: 'knuckle', levels: [87, 90],
    roster: [66, 285, 214, 106, 237, 296], coins: 5250, items: [{ item: RARE_CANDY, amount: 15 }, { item: 'ultra-ball', amount: 3 }] },
  { id: 'wattson', leader: 'Wattson', sprite: 'wattson', type: 'electric', badge: 'dynamo', levels: [88, 91],
    roster: [100, 311, 312, 81, 179, 309], coins: 5500, items: [{ item: 'dubious-disc', amount: 1 }, { item: RARE_CANDY, amount: 15 }] },
  { id: 'flannery', leader: 'Flannery', sprite: 'flannery', type: 'fire', badge: 'heat', levels: [89, 92],
    roster: [218, 322, 37, 126, 77, 324], coins: 5750, items: [{ item: 'magmarizer', amount: 1 }] },
  { id: 'norman', leader: 'Norman', sprite: 'norman', type: 'normal', badge: 'balance', levels: [90, 93],
    roster: [263, 327, 352, 300, 335, 287], coins: 6000, items: [{ item: 'oval-stone', amount: 1 }, { item: RARE_CANDY, amount: 20 }] },
  { id: 'winona', leader: 'Winona', sprite: 'winona', type: 'flying', badge: 'feather', levels: [91, 94],
    roster: [276, 278, 357, 227, 198, 333], coins: 6250, items: [{ item: 'razor-fang', amount: 1 }, { item: 'ultra-ball', amount: 3 }] },
  // Ralts may grow into Gardevoir or Gallade; Lunatone and Solrock close the team as a pair.
  { id: 'tate-liza', leader: 'Tate & Liza', sprite: 'tateandliza-gen3', type: 'psychic', badge: 'mind', levels: [92, 95],
    roster: [177, 358, 343, 280, 337, 338], coins: 6500, items: [{ item: 'dawn-stone', amount: 1 }, { item: RARE_CANDY, amount: 20 }] },
  { id: 'juan', leader: 'Juan', sprite: 'juan', type: 'water', badge: 'rain', levels: [94, 97],
    roster: [370, 339, 363, 341, 116, 349], coins: 7500,
    items: [{ item: 'deep-sea-tooth', amount: 1 }, { item: 'deep-sea-scale', amount: 1 }, { item: 'ultra-ball', amount: 5 }] },
];

/** In Elite Four order: later members are tougher and meet you later. */
export const HOENN_ELITE_FOUR: LeagueBoss[] = [
  { id: 'sidney', name: 'Sidney', sprite: 'sidney', types: ['dark'], roster: [262, 275, 332, 342, 319, 359] },
  { id: 'phoebe', name: 'Phoebe', sprite: 'phoebe-gen3', types: ['ghost'], roster: [302, 354, 426, 429, 94, 477] },
  { id: 'glacia', name: 'Glacia', sprite: 'glacia', types: ['ice'], roster: [460, 471, 478, 362, 473, 365] },
  { id: 'drake', name: 'Drake', sprite: 'drake-gen3', types: ['dragon', 'flying'], roster: [334, 330, 230, 357, 149, 373] },
];

/** Hoenn's Champion: Steven and his steel and rock fossils, Metagross last. */
export const HOENN_CHAMPION: LeagueBoss = {
  id: 'steven', name: 'Steven', sprite: 'steven', types: ['steel', 'rock', 'psychic'], roster: [227, 344, 346, 348, 306, 376],
};

const H = 'hoenn';

export const HOENN_FRIENDS: Friend[] = [
  { id: 'ruinmaniac', name: 'Andrés', sprite: 'ruinmaniac', types: ['ground', 'rock'], pool: [322, 328, 337, 338, 345, 347, 304], signature: [343], color: '#b8a038', region: H },
  { id: 'aromalady', name: 'Rosa', sprite: 'aromalady', types: ['grass'], pool: [270, 273, 285, 331, 357, 191], signature: [315], color: '#7ac74c', region: H },
  { id: 'ninjaboy', name: 'Kenji', sprite: 'ninjaboy', types: ['bug', 'poison'], pool: [265, 283, 313, 314, 316, 336], signature: [290], color: '#8fa31a', region: H },
  { id: 'tuber', name: 'Toby', sprite: 'tuber', types: ['water'], pool: [278, 318, 339, 341, 366, 370, 72], signature: [320], color: '#5b8ff0', region: H },
  { id: 'shelly', name: 'Shelly', sprite: 'shelly', types: ['water', 'dark'], pool: [41, 72, 261, 320, 339], signature: [318, 262], color: '#2f6fb5', region: H },
  { id: 'wally', name: 'Wally', sprite: 'wally', types: ['psychic', 'fairy'], pool: [303, 309, 315, 333, 287], signature: [280], color: '#5fbf8f', region: H },
  { id: 'birch', name: 'Professor Birch', sprite: 'birch', types: ['normal'], pool: [261, 265, 276, 293, 300, 287], signature: [263], color: '#8bbf5a', region: H },
  { id: 'lisia', name: 'Lisia', sprite: 'lisia', types: ['flying', 'fairy'], pool: [300, 311, 312, 358, 370, 183], signature: [333], color: '#5ec8e5', region: H },
  { id: 'wallace', name: 'Wallace', sprite: 'wallace', types: ['water'], pool: [72, 270, 339, 363, 370, 366], signature: [349], color: '#7a6fd6', region: H },
  // Rivals' pools are completed with the starter that beats the player's (see friendSpecies).
  { id: 'may', name: 'May', sprite: 'may', types: ['water', 'flying'], pool: [278, 270, 218, 285, 324, 300], color: '#e0584a', region: H, rival: true },
];
