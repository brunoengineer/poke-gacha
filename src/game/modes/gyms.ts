// Gyms: the eight Kanto gym leaders, then the eight Johto ones, in order. Each unlocks after the previous badge
// (Johto's first after all 8 Kanto badges); badges unlock other parts of the game (UNLOCK_BADGES).
// Rosters are fixed and themed (base forms evolve for the level automatically).
// Rematches get harder (+10 levels each, up to +40) and pay half the coins plus Rare Candy.

import { LINK_CABLE, RARE_CANDY } from '../../data/items';
import type { PokemonType } from '../../data/types';
import type { TeamMember } from '../battle';
import { JOHTO_UNLOCK_BADGES } from '../economy';
import { mergeRewards, type Reward } from '../rewards';
import { defaultRng, type Rng } from '../rng';
import { generateTeam } from '../teams';

export interface GymRecord {
  wins: number;
  losses: number;
}

export interface GymSave {
  /** Badge ids earned (one per gym leader beaten). */
  badges: string[];
  /** Per-gym record; `wins` counts how many times the gym was beaten (rematches get harder). */
  records: Record<string, GymRecord>;
}

export const defaultGymSave = (): GymSave => ({ badges: [], records: {} });

export interface Gym {
  /** Leader id (also the i18n key for the gym's texts). */
  id: string;
  leader: string;
  /** Pokémon Showdown trainer sprite name. */
  sprite: string;
  type: PokemonType;
  badge: string;
  levels: [number, number];
  /** Six species, ace last. */
  roster: number[];
  /** Use the roster as written instead of evolving it (Morty's Haunters, Clair's Dragonairs). */
  exact?: boolean;
  coins: number;
  /** First-win items (besides the badge and coins). */
  items: { item: string; amount: number }[];
}

export const GYMS: Gym[] = [
  { id: 'brock', leader: 'Brock', sprite: 'brock', type: 'rock', badge: 'boulder', levels: [12, 16],
    roster: [74, 27, 138, 140, 111, 95], coins: 250, items: [{ item: 'great-ball', amount: 3 }] },
  { id: 'misty', leader: 'Misty', sprite: 'misty', type: 'water', badge: 'cascade', levels: [18, 22],
    roster: [120, 118, 116, 90, 54, 121], coins: 500, items: [{ item: 'water-stone', amount: 1 }] },
  { id: 'surge', leader: 'Lt. Surge', sprite: 'ltsurge', type: 'electric', badge: 'thunder', levels: [24, 28],
    roster: [100, 81, 135, 101, 125, 25], coins: 750, items: [{ item: 'thunder-stone', amount: 1 }] },
  { id: 'erika', leader: 'Erika', sprite: 'erika', type: 'grass', badge: 'rainbow', levels: [30, 34],
    roster: [69, 46, 114, 102, 43, 45], coins: 1000, items: [{ item: 'leaf-stone', amount: 1 }] },
  { id: 'koga', leader: 'Koga', sprite: 'koga', type: 'poison', badge: 'soul', levels: [36, 40],
    roster: [41, 23, 48, 88, 109, 110], coins: 1250, items: [{ item: RARE_CANDY, amount: 10 }] },
  { id: 'sabrina', leader: 'Sabrina', sprite: 'sabrina', type: 'psychic', badge: 'marsh', levels: [42, 46],
    roster: [96, 79, 124, 102, 122, 63], coins: 1500, items: [{ item: 'moon-stone', amount: 1 }, { item: LINK_CABLE, amount: 1 }] },
  { id: 'blaine', leader: 'Blaine', sprite: 'blaine', type: 'fire', badge: 'volcano', levels: [48, 52],
    roster: [37, 77, 136, 126, 58, 4], coins: 1750, items: [{ item: 'fire-stone', amount: 1 }] },
  { id: 'giovanni', leader: 'Giovanni', sprite: 'giovanni', type: 'ground', badge: 'earth', levels: [54, 58],
    roster: [50, 104, 27, 29, 32, 111], coins: 2500, items: [{ item: 'ultra-ball', amount: 3 }] },
];

export const JOHTO_GYMS: Gym[] = [
  { id: 'falkner', leader: 'Falkner', sprite: 'falkner', type: 'flying', badge: 'zephyr', levels: [60, 64],
    roster: [163, 177, 198, 227, 84, 16], coins: 2500, items: [{ item: 'great-ball', amount: 5 }] },
  { id: 'bugsy', leader: 'Bugsy', sprite: 'bugsy', type: 'bug', badge: 'hive', levels: [63, 67],
    roster: [165, 167, 193, 204, 214, 123], coins: 2750, items: [{ item: 'metal-coat', amount: 1 }] },
  { id: 'whitney', leader: 'Whitney', sprite: 'whitney', type: 'normal', badge: 'plain', levels: [66, 70],
    roster: [35, 190, 203, 216, 234, 241], coins: 3000, items: [{ item: RARE_CANDY, amount: 15 }] },
  { id: 'morty', leader: 'Morty', sprite: 'morty', type: 'ghost', badge: 'fog', levels: [69, 73], exact: true,
    roster: [178, 93, 197, 200, 93, 94], coins: 3250, items: [{ item: 'ultra-ball', amount: 3 }] },
  { id: 'chuck', leader: 'Chuck', sprite: 'chuck', type: 'fighting', badge: 'storm', levels: [72, 76],
    roster: [56, 214, 237, 106, 66, 62], coins: 3500, items: [{ item: 'kings-rock', amount: 1 }] },
  { id: 'jasmine', leader: 'Jasmine', sprite: 'jasmine', type: 'steel', badge: 'mineral', levels: [75, 79],
    roster: [81, 227, 204, 179, 123, 95], coins: 3750, items: [{ item: 'metal-coat', amount: 1 }] },
  { id: 'pryce', leader: 'Pryce', sprite: 'pryce', type: 'ice', badge: 'glacier', levels: [78, 82],
    roster: [86, 215, 225, 124, 90, 220], coins: 4000, items: [{ item: 'up-grade', amount: 1 }] },
  { id: 'clair', leader: 'Clair', sprite: 'clair', type: 'dragon', badge: 'rising', levels: [81, 86], exact: true,
    roster: [148, 130, 148, 149, 142, 230], coins: 5000, items: [{ item: 'dragon-scale', amount: 1 }, { item: 'ultra-ball', amount: 5 }] },
];

export type GymRegion = 'kanto' | 'johto';
export const GYM_REGIONS: GymRegion[] = ['kanto', 'johto'];
export const REGION_GYMS: Record<GymRegion, Gym[]> = { kanto: GYMS, johto: JOHTO_GYMS };
export const ALL_GYMS = [...GYMS, ...JOHTO_GYMS];

export const BADGES = GYMS.map(g => g.badge);
export const JOHTO_BADGES = JOHTO_GYMS.map(g => g.badge);
export const getGym = (id: string) => ALL_GYMS.find(g => g.id === id);
export const gymRegion = (gym: Gym): GymRegion => (JOHTO_GYMS.includes(gym) ? 'johto' : 'kanto');

/** Badges earned in one region. */
export const regionBadges = (gyms: Pick<GymSave, 'badges'>, region: GymRegion) =>
  REGION_GYMS[region].filter(g => gyms.badges.includes(g.badge)).length;

/** Johto's gyms open once every Kanto badge is earned. */
export const johtoGymsOpen = (gyms: Pick<GymSave, 'badges'>) => regionBadges(gyms, 'kanto') >= JOHTO_UNLOCK_BADGES.gyms;

export const REMATCH_LEVELS = 10;
export const REMATCH_MAX = 40;
export const REMATCH_CANDY = 5;
/** Rare Candy on every first win, on top of the badge and the gym's own items. */
export const FIRST_WIN_CANDY = 5;

export type GymStatus = 'locked' | 'open' | 'beaten';

/** A gym is open once the previous gym's badge is earned (Johto's first: once all Kanto badges are). */
export function gymStatus(gyms: GymSave, index: number, region: GymRegion = 'kanto'): GymStatus {
  const list = REGION_GYMS[region];
  if (gyms.badges.includes(list[index].badge)) return 'beaten';
  const open = index > 0 ? gyms.badges.includes(list[index - 1].badge) : region === 'kanto' || johtoGymsOpen(gyms);
  return open ? 'open' : 'locked';
}

/** Next gym to challenge (Kanto first, then Johto), or null when all sixteen are done. */
export function nextGym(gyms: GymSave): Gym | null {
  return ALL_GYMS.find(g => !gyms.badges.includes(g.badge)) ?? null;
}

/** Extra levels for the next battle against a gym (0 until its badge is earned). */
export function rematchBonus(gyms: GymSave, gym: Gym): number {
  if (!gyms.badges.includes(gym.badge)) return 0;
  const wins = Math.max(1, gyms.records[gym.id]?.wins ?? 1);
  return Math.min(REMATCH_MAX, REMATCH_LEVELS * wins);
}

export function gymLevels(gyms: GymSave, gym: Gym): [number, number] {
  const bonus = rematchBonus(gyms, gym);
  return [gym.levels[0] + bonus, gym.levels[1] + bonus];
}

export function gymTeam(gyms: GymSave, gym: Gym, rng: Rng = defaultRng): TeamMember[] {
  return generateTeam({ level: gymLevels(gyms, gym), species: gym.roster, exact: gym.exact }, rng);
}

/** Rewards for beating a gym: badge + full rewards the first time, half coins + Rare Candy on rematches. */
export function gymRewards(gyms: GymSave, gym: Gym): Reward[] {
  if (!gyms.badges.includes(gym.badge)) {
    return [
      { kind: 'badge', badge: gym.badge },
      { kind: 'coins', amount: gym.coins },
      ...mergeRewards([
        { kind: 'item', item: RARE_CANDY, amount: FIRST_WIN_CANDY },
        ...gym.items.map(({ item, amount }): Reward => ({ kind: 'item', item, amount })),
      ]),
    ];
  }
  return [{ kind: 'coins', amount: Math.floor(gym.coins / 2) }, { kind: 'item', item: RARE_CANDY, amount: REMATCH_CANDY }];
}

/** Updates the gym's record after a battle (mutates the save slice; the badge itself comes from the reward). */
export function recordGym(gyms: GymSave, gymId: string, won: boolean) {
  const record = (gyms.records[gymId] ??= { wins: 0, losses: 0 });
  if (won) record.wins += 1;
  else record.losses += 1;
}
