// Training: casual sparring against friends and side characters. Never locked, always repeatable.
// Each friend brings a themed species pool; the team is rolled per battle and scaled to the player's team level.
// Dialogue lives in the i18n "battle" namespace (L().battle.friends[id]); this file is pure logic and data.

import { LINK_CABLE, RARE_CANDY } from '../../data/items';
import type { PokemonType } from '../../data/types';
import { REGION_IDS, type RegionId } from '../regions';
import type { TeamMember } from '../battle';
import type { Reward } from '../rewards';
import { dayKey, defaultRng, pick, shuffle, type Rng } from '../rng';
import { generateTeam } from '../teams';
import { DECK_SIZE, STARTERS } from '../economy';
import { HOENN_FRIENDS } from './hoenn';
import { SINNOH_FRIENDS } from './sinnoh';

export interface TrainingRecord {
  wins: number;
  losses: number;
  lastWinAt?: number;
}

export interface TrainingSave {
  /** Per-trainer record, by trainer id. */
  records: Record<string, TrainingRecord>;
  /** Last difficulty picked in the lobby. */
  difficulty?: Difficulty;
}

export const defaultTrainingSave = (): TrainingSave => ({ records: {} });

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export interface DifficultyDef {
  /** Opponent level relative to the player's team average (inclusive range). */
  offset: [number, number];
  coinsBase: number;
  coinsPerLevel: number;
  /** Rare Candy on every win. */
  candy: number;
  /** Chance of a gift (Link Cable or evolution stone) on a win. */
  giftChance: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: { offset: [-3, -1], coinsBase: 15, coinsPerLevel: 2, candy: 1, giftChance: 0 },
  normal: { offset: [-1, 1], coinsBase: 25, coinsPerLevel: 3, candy: 1, giftChance: 0.05 },
  hard: { offset: [2, 5], coinsBase: 40, coinsPerLevel: 5, candy: 2, giftChance: 0.12 },
};

/** Coins for a loss (any difficulty). Forfeits pay nothing. */
export const LOSS_COINS = 10;
export const MIN_LEVEL = 2;

/** Gifts a friend may hand over: the Link Cable, an evolution stone or one of Johto's trade items. */
export const GIFTS = [
  LINK_CABLE, 'fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'sun-stone',
  'kings-rock', 'metal-coat', 'dragon-scale', 'up-grade',
];

export type FriendRegion = RegionId;

export interface Friend {
  id: string;
  name: string;
  /** Pokémon Showdown trainer sprite name (trainerSpriteUrl). */
  sprite: string;
  /** Types shown in the lobby (their specialty). */
  types: PokemonType[];
  /** Species pool (base forms; teams evolve them for their level). */
  pool: number[];
  /** Species always on the team (signature Pokémon). */
  signature?: number[];
  /** Accent color for the lobby card. */
  color: string;
  /** Home region (the lobby groups friends by it). */
  region: FriendRegion;
  /** Rivals add the starter of their region that beats the player's (see rivalStarter). */
  rival?: boolean;
}

/**
 * The rival's starter: the one of their region whose type beats the player's starter type (fire beats grass,
 * water beats fire, grass beats water). STARTERS lists grass, fire, water for each region, in region order.
 */
export function rivalStarter(playerStarter: number | null, region: FriendRegion = 'kanto'): number {
  const i = STARTERS.indexOf(playerStarter ?? -1);
  const counter = i < 0 ? 1 : (i + 1) % 3;
  return STARTERS[REGION_IDS.indexOf(region) * 3 + counter];
}

const K = 'kanto';
const J = 'johto';

export const FRIENDS: Friend[] = [
  { id: 'joey', name: 'Joey', sprite: 'youngster', types: ['normal'], pool: [16, 21, 23, 27, 32, 52, 56], signature: [19], color: '#a8a77a', region: K },
  { id: 'lass', name: 'Lass Iris', sprite: 'lass', types: ['normal', 'fairy'], pool: [16, 25, 29, 39, 43, 52, 113], signature: [35], color: '#f095c0', region: K },
  { id: 'bugcatcher', name: 'Rick', sprite: 'bugcatcher', types: ['bug'], pool: [13, 46, 48, 123, 127], signature: [10], color: '#a6b91a', region: K },
  { id: 'swimmer', name: 'Marina', sprite: 'swimmerf', types: ['water'], pool: [60, 72, 86, 90, 98, 116, 118], signature: [129], color: '#6390f0', region: K },
  { id: 'birdkeeper', name: 'Perry', sprite: 'birdkeeper', types: ['flying'], pool: [21, 41, 83, 84, 142], signature: [16], color: '#a98ff3', region: K },
  { id: 'hiker', name: 'Dudley', sprite: 'hiker', types: ['rock', 'ground'], pool: [27, 50, 66, 104, 111], signature: [74, 95], color: '#b6a136', region: K },
  { id: 'brock', name: 'Brock', sprite: 'brock', types: ['rock'], pool: [37, 41, 74, 138, 140, 111], signature: [95], color: '#c9a66b', region: K },
  { id: 'misty', name: 'Misty', sprite: 'misty', types: ['water'], pool: [60, 90, 116, 118, 131], signature: [120, 54], color: '#4fa3e8', region: K },
  { id: 'rocket', name: 'Jessie & James', sprite: 'teamrocket', types: ['poison'], pool: [69, 88, 108, 129], signature: [23, 109, 52], color: '#c0396b', region: K },
  { id: 'oak', name: 'Professor Oak', sprite: 'oak', types: ['normal', 'dragon'], pool: [115, 128, 131, 132, 137, 133], signature: [147], color: '#d3bc8e', region: K },
  // Rivals' pools are completed with the starter that beats the player's (see friendSpecies).
  { id: 'blue', name: 'Blue', sprite: 'blue', types: ['normal', 'psychic'], pool: [16, 63, 111, 102, 58, 129], color: '#5a8dee', region: K, rival: true },
  // Johto
  { id: 'youngster2', name: 'Tommy', sprite: 'youngster-gen2', types: ['normal'], pool: [161, 163, 187, 190, 194, 191], signature: [206], color: '#b8a77a', region: J },
  { id: 'kimonogirl', name: 'Yume', sprite: 'kimonogirl', types: ['psychic', 'dark'], pool: [134, 135, 136, 196, 197], signature: [133], color: '#e0739b', region: J },
  { id: 'kurt', name: 'Kurt', sprite: 'kurt', types: ['bug', 'psychic'], pool: [165, 167, 191, 204, 206, 214], signature: [79], color: '#9a7b4f', region: J },
  { id: 'eusine', name: 'Eusine', sprite: 'eusine', types: ['psychic', 'ghost'], pool: [92, 81, 100, 200, 202], signature: [96], color: '#6c8fd6', region: J },
  { id: 'bill', name: 'Bill', sprite: 'bill', types: ['normal'], pool: [132, 81, 100, 235, 203], signature: [133, 137], color: '#7cb2c9', region: J },
  { id: 'elm', name: 'Professor Elm', sprite: 'elm', types: ['normal', 'fairy'], pool: [172, 173, 174, 236, 238, 239, 240], signature: [175], color: '#7fbf7a', region: J },
  { id: 'lyra', name: 'Lyra', sprite: 'lyra', types: ['water', 'grass'], pool: [161, 179, 187, 175, 194], signature: [183, 152], color: '#ef6f8e', region: J },
  { id: 'ethan', name: 'Ethan', sprite: 'ethan', types: ['fire', 'normal'], pool: [163, 216, 228, 179, 95, 190], signature: [155], color: '#f2a03d', region: J },
  { id: 'silver', name: 'Silver', sprite: 'silver', types: ['dark', 'poison'], pool: [215, 41, 92, 81, 63, 198], color: '#d04a4a', region: J, rival: true },
  // Hoenn and Sinnoh (hoenn.ts, sinnoh.ts)
  ...HOENN_FRIENDS,
  ...SINNOH_FRIENDS,
];

export const getFriend = (id: string) => FRIENDS.find(f => f.id === id);

/** Opponent level range for a difficulty, around the player's team average. */
export function levelRange(teamAverage: number, difficulty: Difficulty): [number, number] {
  const [lo, hi] = DIFFICULTY[difficulty].offset;
  return [Math.max(MIN_LEVEL, teamAverage + lo), Math.max(MIN_LEVEL, teamAverage + hi)];
}

/** The six species a friend brings this time: signatures first, the rest drawn from the pool. */
export function friendSpecies(friend: Friend, rng: Rng = defaultRng, playerStarter: number | null = null): number[] {
  const signature = friend.rival ? [rivalStarter(playerStarter, friend.region)] : friend.signature ?? [];

  const rest = shuffle(friend.pool.filter(id => !signature.includes(id)), rng);
  return shuffle([...signature, ...rest].slice(0, DECK_SIZE), rng);
}

export function trainingTeam(friend: Friend, teamAverage: number, difficulty: Difficulty, rng: Rng = defaultRng, playerStarter: number | null = null): TeamMember[] {
  return generateTeam({ level: levelRange(teamAverage, difficulty), species: friendSpecies(friend, rng, playerStarter) }, rng);
}

/** Average level of a team, rounded (the "level" in the coin formulas). */
export const averageLevel = (team: TeamMember[]) => (team.length ? Math.round(team.reduce((s, m) => s + m.level, 0) / team.length) : 1);

export const winCoins = (difficulty: Difficulty, level: number) => DIFFICULTY[difficulty].coinsBase + DIFFICULTY[difficulty].coinsPerLevel * level;

/** Extra Rare Candy for the first win of the day against each friend. */
export const FIRST_WIN_CANDY = 1;

/** True when the friend hasn't been beaten yet today (the first win of the day adds Rare Candy). */
export function firstWinToday(record: TrainingRecord | undefined, now = Date.now()): boolean {
  return !record?.lastWinAt || dayKey(new Date(record.lastWinAt)) !== dayKey(new Date(now));
}

export function trainingRewards({ difficulty, result, level, firstWin, rng = defaultRng }: {
  difficulty: Difficulty;
  result: 'win' | 'lose' | 'draw' | 'forfeit';
  /** Opponent team average level. */
  level: number;
  firstWin: boolean;
  rng?: Rng;
}): Reward[] {
  if (result === 'forfeit') return [];
  if (result !== 'win') return [{ kind: 'coins', amount: LOSS_COINS }];
  const rewards: Reward[] = [{ kind: 'coins', amount: winCoins(difficulty, level) }];
  const candy = DIFFICULTY[difficulty].candy + (firstWin ? FIRST_WIN_CANDY : 0);
  rewards.push({ kind: 'item', item: RARE_CANDY, amount: candy });
  const { giftChance } = DIFFICULTY[difficulty];
  if (giftChance > 0 && rng() < giftChance) rewards.push({ kind: 'item', item: pick(GIFTS, rng), amount: 1 });
  return rewards;
}

/** Updates a friend's record after a battle (mutates the save slice). */
export function recordTraining(training: TrainingSave, friendId: string, won: boolean, now = Date.now()) {
  const record = (training.records[friendId] ??= { wins: 0, losses: 0 });
  if (won) {
    record.wins += 1;
    record.lastWinAt = now;
  } else {
    record.losses += 1;
  }
}
