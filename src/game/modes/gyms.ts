// Gyms: the eight Kanto gym leaders, in order. Each unlocks after the previous badge; badges unlock other parts
// of the game (UNLOCK_BADGES). Rosters are fixed and themed (base forms evolve for the level automatically).
// Rematches get harder (+10 levels each, up to +40) and pay half the coins plus Rare Candy.

import { LINK_CABLE, RARE_CANDY } from '../../data/items';
import type { PokemonType } from '../../data/types';
import type { TeamMember } from '../battle';
import type { Reward } from '../rewards';
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
  coins: number;
  /** First-win items (besides the badge and coins). */
  items: { item: string; amount: number }[];
}

export const GYMS: Gym[] = [
  { id: 'brock', leader: 'Brock', sprite: 'brock', type: 'rock', badge: 'boulder', levels: [8, 12],
    roster: [74, 27, 138, 140, 111, 95], coins: 500, items: [{ item: 'great-ball', amount: 3 }] },
  { id: 'misty', leader: 'Misty', sprite: 'misty', type: 'water', badge: 'cascade', levels: [14, 18],
    roster: [120, 118, 116, 90, 54, 121], coins: 1000, items: [{ item: 'water-stone', amount: 1 }] },
  { id: 'surge', leader: 'Lt. Surge', sprite: 'ltsurge', type: 'electric', badge: 'thunder', levels: [20, 24],
    roster: [100, 81, 135, 101, 125, 25], coins: 1500, items: [{ item: 'thunder-stone', amount: 1 }] },
  { id: 'erika', leader: 'Erika', sprite: 'erika', type: 'grass', badge: 'rainbow', levels: [26, 30],
    roster: [69, 46, 114, 102, 43, 45], coins: 2000, items: [{ item: 'leaf-stone', amount: 1 }] },
  { id: 'koga', leader: 'Koga', sprite: 'koga', type: 'poison', badge: 'soul', levels: [32, 37],
    roster: [41, 23, 48, 88, 109, 110], coins: 2500, items: [{ item: RARE_CANDY, amount: 10 }] },
  { id: 'sabrina', leader: 'Sabrina', sprite: 'sabrina', type: 'psychic', badge: 'marsh', levels: [38, 43],
    roster: [96, 79, 124, 102, 122, 63], coins: 3000, items: [{ item: 'moon-stone', amount: 1 }, { item: LINK_CABLE, amount: 1 }] },
  { id: 'blaine', leader: 'Blaine', sprite: 'blaine', type: 'fire', badge: 'volcano', levels: [44, 49],
    roster: [37, 77, 136, 126, 58, 4], coins: 3500, items: [{ item: 'fire-stone', amount: 1 }] },
  { id: 'giovanni', leader: 'Giovanni', sprite: 'giovanni', type: 'ground', badge: 'earth', levels: [50, 55],
    roster: [50, 104, 27, 29, 32, 111], coins: 5000, items: [{ item: 'ultra-ball', amount: 3 }] },
];

export const BADGES = GYMS.map(g => g.badge);
export const getGym = (id: string) => GYMS.find(g => g.id === id);

export const REMATCH_LEVELS = 10;
export const REMATCH_MAX = 40;
export const REMATCH_CANDY = 3;

export type GymStatus = 'locked' | 'open' | 'beaten';

/** A gym is open once the previous gym's badge is earned. */
export function gymStatus(gyms: GymSave, index: number): GymStatus {
  if (gyms.badges.includes(GYMS[index].badge)) return 'beaten';
  if (index === 0 || gyms.badges.includes(GYMS[index - 1].badge)) return 'open';
  return 'locked';
}

/** Next gym to challenge (first one without its badge), or null when all eight are done. */
export function nextGym(gyms: GymSave): Gym | null {
  return GYMS.find(g => !gyms.badges.includes(g.badge)) ?? null;
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
  return generateTeam({ level: gymLevels(gyms, gym), species: gym.roster }, rng);
}

/** Rewards for beating a gym: badge + full rewards the first time, half coins + Rare Candy on rematches. */
export function gymRewards(gyms: GymSave, gym: Gym): Reward[] {
  if (!gyms.badges.includes(gym.badge)) {
    return [
      { kind: 'badge', badge: gym.badge },
      { kind: 'coins', amount: gym.coins },
      ...gym.items.map(({ item, amount }): Reward => ({ kind: 'item', item, amount })),
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
