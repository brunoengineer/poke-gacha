// Training: casual sparring against friends and side characters. Never locked, always repeatable.
// Each friend brings a themed species pool; the team is rolled per battle and scaled to the player's team level.
// Dialogue lives in the i18n "battle" namespace (L().battle.friends[id]); this file is pure logic and data.

import { LINK_CABLE, RARE_CANDY } from '../../data/items';
import type { PokemonType } from '../../data/types';
import type { TeamMember } from '../battle';
import type { Reward } from '../rewards';
import { dayKey, defaultRng, pick, shuffle, type Rng } from '../rng';
import { generateTeam } from '../teams';
import { DECK_SIZE, STARTERS } from '../economy';

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
  /** Chance of a gift (Link Cable or evolution stone) on a win. */
  giftChance: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: { offset: [-3, -1], coinsBase: 30, coinsPerLevel: 4, giftChance: 0 },
  normal: { offset: [-1, 1], coinsBase: 50, coinsPerLevel: 6, giftChance: 0.05 },
  hard: { offset: [2, 5], coinsBase: 80, coinsPerLevel: 9, giftChance: 0.12 },
};

/** Coins for a loss (any difficulty). Forfeits pay nothing. */
export const LOSS_COINS = 10;
export const MIN_LEVEL = 2;

/** Gifts a friend may hand over: the Link Cable or one of the Kanto evolution stones. */
export const GIFTS = [LINK_CABLE, 'fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone'];

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
}

/** Rival Blue picks the starter strong against the player's (Bulbasaur -> Charmander -> Squirtle -> Bulbasaur). */
export function rivalStarter(playerStarter: number | null): number {
  const i = STARTERS.indexOf(playerStarter ?? -1);
  return i < 0 ? STARTERS[1] : STARTERS[(i + 1) % STARTERS.length];
}

export const FRIENDS: Friend[] = [
  { id: 'joey', name: 'Joey', sprite: 'youngster', types: ['normal'], pool: [16, 21, 23, 27, 32, 52, 56], signature: [19], color: '#a8a77a' },
  { id: 'lass', name: 'Lass Iris', sprite: 'lass', types: ['normal', 'fairy'], pool: [16, 25, 29, 39, 43, 52, 113], signature: [35], color: '#f095c0' },
  { id: 'bugcatcher', name: 'Rick', sprite: 'bugcatcher', types: ['bug'], pool: [13, 46, 48, 123, 127], signature: [10], color: '#a6b91a' },
  { id: 'swimmer', name: 'Marina', sprite: 'swimmerf', types: ['water'], pool: [60, 72, 86, 90, 98, 116, 118], signature: [129], color: '#6390f0' },
  { id: 'birdkeeper', name: 'Perry', sprite: 'birdkeeper', types: ['flying'], pool: [21, 41, 83, 84, 142], signature: [16], color: '#a98ff3' },
  { id: 'hiker', name: 'Dudley', sprite: 'hiker', types: ['rock', 'ground'], pool: [27, 50, 66, 104, 111], signature: [74, 95], color: '#b6a136' },
  { id: 'brock', name: 'Brock', sprite: 'brock', types: ['rock'], pool: [37, 41, 74, 138, 140, 111], signature: [95], color: '#c9a66b' },
  { id: 'misty', name: 'Misty', sprite: 'misty', types: ['water'], pool: [60, 90, 116, 118, 131], signature: [120, 54], color: '#4fa3e8' },
  { id: 'rocket', name: 'Jessie & James', sprite: 'teamrocket', types: ['poison'], pool: [69, 88, 108, 129], signature: [23, 109, 52], color: '#c0396b' },
  { id: 'oak', name: 'Professor Oak', sprite: 'oak', types: ['normal', 'dragon'], pool: [115, 128, 131, 132, 137, 133], signature: [147], color: '#d3bc8e' },
  // The rival's pool is completed with the starter that beats the player's (see trainingTeam).
  { id: 'blue', name: 'Blue', sprite: 'blue', types: ['normal', 'psychic'], pool: [16, 63, 111, 102, 58, 129], color: '#5a8dee' },
];

export const getFriend = (id: string) => FRIENDS.find(f => f.id === id);

/** Opponent level range for a difficulty, around the player's team average. */
export function levelRange(teamAverage: number, difficulty: Difficulty): [number, number] {
  const [lo, hi] = DIFFICULTY[difficulty].offset;
  return [Math.max(MIN_LEVEL, teamAverage + lo), Math.max(MIN_LEVEL, teamAverage + hi)];
}

/** The six species a friend brings this time: signatures first, the rest drawn from the pool. */
export function friendSpecies(friend: Friend, rng: Rng = defaultRng, playerStarter: number | null = null): number[] {
  const signature = friend.id === 'blue' ? [rivalStarter(playerStarter)] : friend.signature ?? [];
  const rest = shuffle(friend.pool.filter(id => !signature.includes(id)), rng);
  return shuffle([...signature, ...rest].slice(0, DECK_SIZE), rng);
}

export function trainingTeam(friend: Friend, teamAverage: number, difficulty: Difficulty, rng: Rng = defaultRng, playerStarter: number | null = null): TeamMember[] {
  return generateTeam({ level: levelRange(teamAverage, difficulty), species: friendSpecies(friend, rng, playerStarter) }, rng);
}

/** Average level of a team, rounded (the "level" in the coin formulas). */
export const averageLevel = (team: TeamMember[]) => (team.length ? Math.round(team.reduce((s, m) => s + m.level, 0) / team.length) : 1);

export const winCoins = (difficulty: Difficulty, level: number) => DIFFICULTY[difficulty].coinsBase + DIFFICULTY[difficulty].coinsPerLevel * level;

/** True when the friend hasn't been beaten yet today (the first win of the day adds a Rare Candy). */
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
  if (firstWin) rewards.push({ kind: 'item', item: RARE_CANDY, amount: 1 });
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
