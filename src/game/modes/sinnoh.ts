// Sinnoh content: its eight gym leaders, Elite Four, Champion and Training friends (texts in src/i18n/*/regions-*.ts).
// Pure data: the rules live in gyms.ts, league.ts and training.ts.

import { RARE_CANDY } from '../../data/items';
import type { Gym } from './gyms';
import type { LeagueBoss } from './league';
import type { Friend } from './training';

export const SINNOH_GYMS: Gym[] = [
  { id: 'roark', leader: 'Roark', sprite: 'roark', type: 'rock', badge: 'coal', levels: [120, 123],
    roster: [74, 438, 142, 111, 246, 408], coins: 7500, items: [{ item: RARE_CANDY, amount: 15 }, { item: 'ultra-ball', amount: 3 }] },
  { id: 'gardenia', leader: 'Gardenia', sprite: 'gardenia', type: 'grass', badge: 'forest', levels: [122, 125],
    roster: [420, 455, 459, 357, 387, 406], coins: 7750, items: [{ item: 'shiny-stone', amount: 1 }, { item: RARE_CANDY, amount: 15 }] },
  { id: 'maylene', leader: 'Maylene', sprite: 'maylene', type: 'fighting', badge: 'cobble', levels: [124, 127],
    roster: [56, 107, 453, 236, 307, 447], coins: 8000, items: [{ item: 'dawn-stone', amount: 1 }, { item: RARE_CANDY, amount: 20 }] },
  { id: 'wake', leader: 'Crasher Wake', sprite: 'crasherwake', type: 'water', badge: 'fen', levels: [126, 129],
    roster: [456, 422, 194, 129, 60, 418], coins: 8250, items: [{ item: RARE_CANDY, amount: 20 }, { item: 'ultra-ball', amount: 4 }] },
  { id: 'fantina', leader: 'Fantina', sprite: 'fantina', type: 'ghost', badge: 'relic', levels: [128, 131],
    roster: [425, 353, 92, 355, 442, 200], coins: 8500, items: [{ item: 'reaper-cloth', amount: 1 }, { item: 'dusk-stone', amount: 1 }] },
  { id: 'byron', leader: 'Byron', sprite: 'byron', type: 'steel', badge: 'mine', levels: [130, 133],
    roster: [436, 81, 227, 95, 304, 410], coins: 8750, items: [{ item: 'protector', amount: 1 }, { item: RARE_CANDY, amount: 20 }] },
  // Froslass written as is: Snorunt could grow into Glalie instead.
  { id: 'candice', leader: 'Candice', sprite: 'candice', type: 'ice', badge: 'icicle', levels: [132, 135],
    roster: [459, 215, 220, 363, 238, 478], coins: 9000, items: [{ item: 'razor-claw', amount: 1 }, { item: RARE_CANDY, amount: 20 }] },
  { id: 'volkner', leader: 'Volkner', sprite: 'volkner', type: 'electric', badge: 'beacon', levels: [134, 137],
    roster: [25, 190, 135, 479, 125, 403], coins: 10000,
    items: [{ item: 'electirizer', amount: 1 }, { item: RARE_CANDY, amount: 25 }, { item: 'ultra-ball', amount: 5 }] },
];

/** In Elite Four order: later members are tougher and meet you later. */
export const SINNOH_ELITE_FOUR: LeagueBoss[] = [
  { id: 'aaron', name: 'Aaron', sprite: 'aaron', types: ['bug'], roster: [267, 269, 416, 212, 214, 452] },
  { id: 'bertha', name: 'Bertha', sprite: 'bertha', types: ['ground'], roster: [195, 340, 76, 472, 464, 450] },
  { id: 'flint', name: 'Flint', sprite: 'flint', types: ['fire'], roster: [78, 136, 229, 324, 467, 392] },
  { id: 'lucian', name: 'Lucian', sprite: 'lucian', types: ['psychic'], roster: [122, 203, 196, 437, 65, 475] },
];

/** Sinnoh's Champion: Cynthia, Garchomp last. */
export const SINNOH_CHAMPION: LeagueBoss = {
  id: 'cynthia', name: 'Cynthia', sprite: 'cynthia', types: ['dragon', 'ground', 'ghost'], roster: [442, 407, 423, 448, 350, 445],
};

const S = 'sinnoh';

export const SINNOH_FRIENDS: Friend[] = [
  { id: 'youngster4', name: 'Tristan', sprite: 'youngster-gen4', types: ['normal'], pool: [396, 401, 403, 412, 418, 427], signature: [399], color: '#c8a77a', region: S },
  { id: 'skier', name: 'Neve', sprite: 'skierf', types: ['ice'], pool: [215, 220, 361, 363, 238, 86], signature: [459], color: '#7fd0e8', region: S },
  { id: 'mars', name: 'Mars', sprite: 'mars', types: ['poison', 'dark'], pool: [41, 425, 436, 451, 198], signature: [434, 431], color: '#5a7fa8', region: S },
  { id: 'cheryl', name: 'Cheryl', sprite: 'cheryl', types: ['normal', 'bug'], pool: [412, 415, 433, 438, 446, 427], signature: [440], color: '#f095c0', region: S },
  { id: 'riley', name: 'Riley', sprite: 'riley', types: ['fighting', 'steel'], pool: [95, 436, 307, 66, 296], signature: [447], color: '#4a78b8', region: S },
  { id: 'mira', name: 'Mira', sprite: 'mira', types: ['psychic'], pool: [433, 436, 280, 325, 439, 177], signature: [63], color: '#e895d8', region: S },
  { id: 'buck', name: 'Buck', sprite: 'buck', types: ['fire', 'ground'], pool: [74, 218, 322, 408, 449, 58], signature: [343], color: '#d97c3a', region: S },
  { id: 'dawn', name: 'Dawn', sprite: 'dawn', types: ['water', 'electric'], pool: [417, 427, 420, 456, 133, 425], signature: [393], color: '#e86fa8', region: S },
  { id: 'rowan', name: 'Professor Rowan', sprite: 'rowan', types: ['normal', 'psychic'], pool: [406, 433, 438, 439, 440, 458], signature: [446], color: '#9a8a6a', region: S },
  // Rivals' pools are completed with the starter that beats the player's (see friendSpecies).
  { id: 'barry', name: 'Barry', sprite: 'barry', types: ['normal', 'flying'], pool: [396, 214, 406, 418, 143, 77], color: '#f2c34a', region: S, rival: true },
];
