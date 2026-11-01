// Competition: a generated ladder of 100 trainers ranked by reputation. Logic and data live here.
//
// Every trainer sits on a fixed rank slot with a fixed reputation (rank 100 = 20 points … rank 1 = 2,000),
// generated from the save's seed so the ladder is the same across sessions. The player's rank is how many
// trainers have more reputation than them, plus one. Beating one of the five trainers above you sets your
// reputation just above theirs (you take their place); a loss costs a little reputation.

import { baseStatTotal, canEverEvolve, getSpecies, speciesList } from '../../data/species';
import type { PokemonType } from '../../data/types';
import type { SaveData } from '../../state/save';
import type { TeamMember } from '../battle';
import { DECK_SIZE } from '../economy';
import type { Reward } from '../rewards';
import { hashString, pick, seeded, shuffle, type Rng } from '../rng';
import { evolveForLevel, generateTeam, type TeamSpec } from '../teams';

export interface LadderSave {
  /** Seed of this save's generated ladder (names, teams), so it stays the same across sessions. */
  seed: number;
  /** Player reputation points. */
  rating: number;
  wins: number;
  losses: number;
  /** One-time milestone rewards already claimed. */
  milestones: string[];
  /** Best rank ever reached (optional: older saves don't have it). */
  best?: number;
}

export const defaultLadderSave = (): LadderSave => ({
  seed: Math.floor(Math.random() * 2 ** 31),
  rating: 0,
  wins: 0,
  losses: 0,
  milestones: [],
});

export const LADDER_SIZE = 100;
export const ELITE_RANKS = 10;
/** How many trainers directly above you can be challenged. */
export const CHALLENGE_RANGE = 5;
export const REPUTATION_STEP = 20;
export const LOSS_REPUTATION = 10;
export const LOSS_COINS = 15;

export const winCoins = (level: number) => 30 + 4 * level;
/** Rare Candy on every ladder win. */
export const WIN_CANDY = 1;
/** Fixed reputation of the trainer on rank slot `rank`. */
export const reputationAt = (rank: number) => (LADDER_SIZE + 1 - rank) * REPUTATION_STEP;
/** Opponent level by rank: rank 100 ≈ Lv. 4, rank 1 ≈ Lv. 63. */
export const ladderLevel = (rank: number) => Math.round(4 + (LADDER_SIZE - rank) * 0.6);
export const isElite = (rank: number) => rank <= ELITE_RANKS;

/** Rank for a reputation: trainers above + 1. LADDER_SIZE + 1 means unranked. */
export function rankForRating(rating: number): number {
  let above = 0;
  for (let rank = 1; rank <= LADDER_SIZE; rank++) if (reputationAt(rank) > rating) above++;
  return above + 1;
}

/** The player's ladder rank, or null while unranked (below #100). */
export function playerRank(save: Pick<SaveData, 'ladder'>): number | null {
  const rank = rankForRating(save.ladder.rating);
  return rank > LADDER_SIZE ? null : rank;
}

/** Rank shown on the leaderboard for the trainer on slot `rank` (the player pushes everyone below them down one). */
export const displayRank = (rank: number, playerPosition: number) => (rank >= playerPosition ? rank + 1 : rank);

/**
 * Slots the player can challenge: the five trainers directly above. At #1 there is nobody above, so the
 * player defends the title against the five trainers right below (coins only; a loss can cost the crown).
 */
export function challengeable(rating: number): number[] {
  const position = rankForRating(rating);
  if (position === 1) return Array.from({ length: CHALLENGE_RANGE }, (_, i) => i + 1);
  const out: number[] = [];
  for (let rank = Math.max(1, position - CHALLENGE_RANGE); rank < position; rank++) out.push(rank);
  return out;
}

// --- Trainer generation -----------------------------------------------------------

export type Gender = 'm' | 'f';

export interface TrainerClass {
  id: string;
  gender: Gender;
  /** Pokémon Showdown trainer sprite name. */
  sprite: string;
  /** Types this class likes (each trainer picks one or two). */
  types: PokemonType[];
  /** Ladder tiers the class shows up in. */
  tiers: Tier[];
}

type Tier = 'rookie' | 'mid' | 'pro' | 'elite';

const tierOf = (rank: number): Tier => (rank <= ELITE_RANKS ? 'elite' : rank <= 35 ? 'pro' : rank <= 70 ? 'mid' : 'rookie');

/** Trainer classes (titles are localized in i18n modes.classes[id]). */
export const TRAINER_CLASSES: TrainerClass[] = [
  { id: 'youngster', gender: 'm', sprite: 'youngster', types: ['normal', 'bug', 'flying', 'poison'], tiers: ['rookie'] },
  { id: 'lass', gender: 'f', sprite: 'lass', types: ['normal', 'fairy', 'grass', 'bug'], tiers: ['rookie'] },
  { id: 'bugcatcher', gender: 'm', sprite: 'bugcatcher', types: ['bug', 'grass', 'poison'], tiers: ['rookie'] },
  { id: 'picnicker', gender: 'f', sprite: 'picnicker', types: ['grass', 'normal', 'water', 'fairy'], tiers: ['rookie', 'mid'] },
  { id: 'camper', gender: 'm', sprite: 'camper', types: ['ground', 'rock', 'normal', 'fire'], tiers: ['rookie', 'mid'] },
  { id: 'schoolkid', gender: 'm', sprite: 'schoolkid', types: ['normal', 'electric', 'psychic'], tiers: ['rookie'] },
  { id: 'schoolkidf', gender: 'f', sprite: 'schoolkidf', types: ['normal', 'grass', 'water', 'fairy'], tiers: ['rookie'] },
  { id: 'tuber', gender: 'f', sprite: 'tuber', types: ['water'], tiers: ['rookie'] },
  { id: 'swimmer', gender: 'm', sprite: 'swimmer', types: ['water'], tiers: ['rookie', 'mid'] },
  { id: 'swimmerf', gender: 'f', sprite: 'swimmerf', types: ['water', 'ice'], tiers: ['rookie', 'mid'] },
  { id: 'fisherman', gender: 'm', sprite: 'fisherman', types: ['water'], tiers: ['rookie', 'mid'] },
  { id: 'birdkeeper', gender: 'm', sprite: 'birdkeeper', types: ['flying', 'normal'], tiers: ['rookie', 'mid'] },
  { id: 'cyclistf', gender: 'f', sprite: 'cyclistf', types: ['normal', 'flying', 'electric'], tiers: ['rookie', 'mid'] },
  { id: 'hiker', gender: 'm', sprite: 'hiker', types: ['rock', 'ground', 'fighting'], tiers: ['mid', 'pro'] },
  { id: 'blackbelt', gender: 'm', sprite: 'blackbelt', types: ['fighting', 'rock'], tiers: ['mid', 'pro'] },
  { id: 'battlegirl', gender: 'f', sprite: 'battlegirl', types: ['fighting', 'normal'], tiers: ['mid', 'pro'] },
  { id: 'beauty', gender: 'f', sprite: 'beauty', types: ['grass', 'water', 'normal', 'fairy'], tiers: ['mid', 'pro'] },
  { id: 'psychic', gender: 'm', sprite: 'psychic', types: ['psychic'], tiers: ['mid', 'pro'] },
  { id: 'psychicf', gender: 'f', sprite: 'psychicf', types: ['psychic', 'fairy'], tiers: ['mid', 'pro'] },
  { id: 'channeler', gender: 'f', sprite: 'channeler-gen3', types: ['ghost', 'psychic', 'poison'], tiers: ['mid', 'pro'] },
  { id: 'scientist', gender: 'm', sprite: 'scientist', types: ['electric', 'poison', 'steel'], tiers: ['mid', 'pro'] },
  { id: 'supernerd', gender: 'm', sprite: 'supernerd', types: ['electric', 'poison', 'psychic'], tiers: ['mid'] },
  { id: 'engineer', gender: 'm', sprite: 'engineer-gen3', types: ['electric', 'steel', 'rock'], tiers: ['mid'] },
  { id: 'burglar', gender: 'm', sprite: 'burglar', types: ['fire', 'poison'], tiers: ['mid'] },
  { id: 'biker', gender: 'm', sprite: 'biker', types: ['poison', 'fire'], tiers: ['mid', 'pro'] },
  { id: 'rocker', gender: 'm', sprite: 'rocker-gen3', types: ['electric'], tiers: ['mid'] },
  { id: 'juggler', gender: 'm', sprite: 'juggler', types: ['psychic', 'poison'], tiers: ['mid', 'pro'] },
  { id: 'gentleman', gender: 'm', sprite: 'gentleman', types: ['normal', 'fire', 'electric'], tiers: ['mid', 'pro'] },
  { id: 'lady', gender: 'f', sprite: 'lady', types: ['normal', 'fairy', 'grass', 'fire'], tiers: ['mid', 'pro'] },
  { id: 'tamer', gender: 'm', sprite: 'tamer-gen3', types: ['ground', 'poison', 'normal'], tiers: ['mid', 'pro'] },
  { id: 'sailor', gender: 'm', sprite: 'sailor', types: ['water', 'fighting'], tiers: ['mid'] },
  { id: 'skierf', gender: 'f', sprite: 'skierf', types: ['ice', 'water'], tiers: ['mid', 'pro'] },
  { id: 'aromalady', gender: 'f', sprite: 'aromalady', types: ['grass', 'poison'], tiers: ['mid', 'pro'] },
  { id: 'pokemonbreederf', gender: 'f', sprite: 'pokemonbreederf', types: ['normal', 'fairy', 'water'], tiers: ['mid', 'pro'] },
  { id: 'kimonogirl', gender: 'f', sprite: 'kimonogirl', types: ['normal', 'fire', 'water', 'electric', 'psychic'], tiers: ['pro', 'elite'] },
  { id: 'pokemaniac', gender: 'm', sprite: 'pokemaniac', types: ['dragon', 'ground', 'rock', 'water'], tiers: ['pro'] },
  { id: 'pokemonranger', gender: 'm', sprite: 'pokemonranger', types: ['grass', 'ground', 'flying', 'bug'], tiers: ['pro', 'elite'] },
  { id: 'pokemonrangerf', gender: 'f', sprite: 'pokemonrangerf', types: ['grass', 'water', 'flying', 'ice'], tiers: ['pro', 'elite'] },
  { id: 'acetrainer', gender: 'm', sprite: 'acetrainer', types: ['fire', 'water', 'electric', 'fighting', 'ground', 'dragon'], tiers: ['pro', 'elite'] },
  { id: 'acetrainerf', gender: 'f', sprite: 'acetrainerf', types: ['grass', 'water', 'psychic', 'ice', 'fairy', 'flying'], tiers: ['pro', 'elite'] },
  { id: 'veteran', gender: 'm', sprite: 'veteran', types: ['fighting', 'rock', 'steel', 'ground', 'fire'], tiers: ['elite'] },
  { id: 'veteranf', gender: 'f', sprite: 'veteranf', types: ['psychic', 'ice', 'water', 'ghost', 'electric'], tiers: ['elite'] },
  { id: 'dragontamer', gender: 'm', sprite: 'dragontamer', types: ['dragon', 'water', 'flying'], tiers: ['elite'] },
];

const classById = new Map(TRAINER_CLASSES.map(c => [c.id, c]));
export const trainerClass = (id: string) => classById.get(id)!;

/** First names that read naturally in Portuguese and English. */
const NAMES: Record<Gender, string[]> = {
  m: ['Alex', 'Leo', 'Theo', 'Max', 'Noah', 'Lucas', 'Gabriel', 'Daniel', 'Mateo', 'Hugo', 'Felix', 'Oscar', 'Victor',
    'Rafael', 'Marco', 'Adrian', 'Simon', 'Diego', 'Enzo', 'Ivan', 'Kai', 'Liam', 'Nico', 'Omar', 'Ravi', 'Samuel',
    'Tomas', 'Yuri', 'Caio', 'Davi', 'Igor', 'Otto', 'Arthur', 'Benjamin', 'Elias', 'Fabio', 'Henry', 'Joel', 'Kenji',
    'Luca', 'Martin', 'Nathan', 'Pablo', 'Ricardo', 'Sergio', 'Tiago', 'Vincent', 'Wesley', 'Andre', 'Bento', 'Dario',
    'Emil', 'Gael', 'Hiro', 'Ian', 'Jonas', 'Lino', 'Milo', 'Renzo', 'Ezra'],
  f: ['Ana', 'Clara', 'Julia', 'Laura', 'Sofia', 'Alice', 'Bianca', 'Carla', 'Elena', 'Emma', 'Eva', 'Helena', 'Iris',
    'Isabel', 'Lara', 'Luna', 'Maya', 'Mia', 'Nina', 'Olivia', 'Paula', 'Rosa', 'Sara', 'Vera', 'Yumi', 'Zoe', 'Lia',
    'Marina', 'Lina', 'Nora', 'Aiko', 'Amara', 'Ines', 'Leila', 'Alba', 'Beatriz', 'Celia', 'Dalia', 'Flora', 'Gloria',
    'Hana', 'Ingrid', 'Joana', 'Kira', 'Lucia', 'Mirela', 'Noemi', 'Petra', 'Rita', 'Selma', 'Tania', 'Valentina',
    'Ayla', 'Diana', 'Elisa', 'Frida', 'Greta', 'Livia', 'Malu', 'Suri'],
};

export interface LadderTrainer {
  /** Rank slot (1 = top). */
  rank: number;
  id: string;
  name: string;
  classId: string;
  gender: Gender;
  /** Trainer sprite name (trainerSpriteUrl()). */
  sprite: string;
  types: PokemonType[];
  level: number;
  elite: boolean;
  reputation: number;
  team: TeamMember[];
}

/** Strong non-legendary species (fully evolved, rare to catch): one shows up on each Elite team. */
function rareSpecies(): number[] {
  return speciesList.filter(s => !s.legendary && !s.mythical && !s.baby && s.captureRate <= 45
    && !canEverEvolve(s.id) && baseStatTotal(s) >= 480).map(s => s.id);
}

/** Legendaries the #1 trainer may own (the very strongest ones stay out of reach). */
function ladderLegendaries(): number[] {
  return speciesList.filter(s => s.legendary && !s.mythical && baseStatTotal(s) < 600).map(s => s.id);
}

/** Generates a team, topping it up with any family when the favorite types don't have enough Pokémon. */
export function fullTeam(spec: TeamSpec, rng: Rng): TeamMember[] {
  const size = spec.size ?? DECK_SIZE;
  const team = generateTeam(spec, rng);
  if (team.length < size) {
    const families = new Set(team.map(m => getSpecies(m.id).family));
    for (const extra of generateTeam({ ...spec, types: undefined, size: size * 2 }, rng)) {
      if (team.length >= size) break;
      if (families.has(getSpecies(extra.id).family)) continue;
      families.add(getSpecies(extra.id).family);
      team.push(extra);
    }
  }
  return team;
}

/**
 * A ladder trainer's team at the given level range. Elite trainers bring one rare species (preferably of
 * their favorite types); the #1 trainer brings a legendary instead.
 */
export function trainerTeam(trainer: Pick<LadderTrainer, 'rank' | 'types'>, level: [number, number], rng: Rng): TeamMember[] {
  const team = fullTeam({ level, types: trainer.types }, rng);
  if (isElite(trainer.rank) && team.length) {
    const own = new Set(team.map(m => getSpecies(m.id).family));
    const pool = (trainer.rank === 1 ? ladderLegendaries() : rareSpecies()).filter(id => !own.has(getSpecies(id).family));
    const typed = pool.filter(id => getSpecies(id).types.some(t => trainer.types.includes(t)));
    const choice = typed.length ? pick(typed, rng) : pool.length ? pick(pool, rng) : null;
    if (choice != null) team[team.length - 1] = { id: evolveForLevel(choice, level[1], rng), level: level[1] };
  }
  return team;
}

const ladderCache = new Map<number, LadderTrainer[]>();

/** The whole ladder for a seed (cached): 100 trainers, rank 1 first. */
export function generateLadder(seed: number): LadderTrainer[] {
  const cached = ladderCache.get(seed);
  if (cached) return cached;
  const rng = seeded(seed ^ 0x5eed1add);
  const names = { m: shuffle(NAMES.m, rng), f: shuffle(NAMES.f, rng) };
  const used = { m: 0, f: 0 };
  const ladder: LadderTrainer[] = [];
  for (let rank = 1; rank <= LADDER_SIZE; rank++) {
    const tier = tierOf(rank);
    const gender: Gender = rng() < 0.5 ? 'm' : 'f';
    const options = TRAINER_CLASSES.filter(c => c.tiers.includes(tier));
    const sameGender = options.filter(c => c.gender === gender);
    const cls = pick(sameGender.length ? sameGender : options, rng);
    const name = names[cls.gender][used[cls.gender]++ % names[cls.gender].length];
    const favorite = shuffle(cls.types, rng).slice(0, cls.types.length > 1 && rng() < 0.55 ? 2 : 1);
    const level = ladderLevel(rank);
    const elite = isElite(rank);
    const range: [number, number] = elite ? [level, level + 2] : [Math.max(2, level - 1), level + 1];
    const team = trainerTeam({ rank, types: favorite }, range, seeded(seed ^ hashString(`ladder-${rank}`)));
    ladder.push({
      rank, id: `ladder-${rank}`, name, classId: cls.id, gender: cls.gender, sprite: cls.sprite,
      types: favorite, level, elite, reputation: reputationAt(rank), team,
    });
  }
  ladderCache.set(seed, ladder);
  return ladder;
}

// --- Milestones ------------------------------------------------------------------

export interface Milestone {
  id: string;
  /** Reached when the player's rank is this or better. */
  rank: number;
  rewards: (rng: Rng) => Reward[];
}

const STONES = ['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone'];

export const MILESTONES: Milestone[] = [
  { id: 'top75', rank: 75, rewards: () => [{ kind: 'item', item: 'great-ball', amount: 3 }] },
  { id: 'top50', rank: 50, rewards: () => [{ kind: 'item', item: 'ultra-ball', amount: 1 }, { kind: 'item', item: 'rare-candy', amount: 10 }] },
  { id: 'top25', rank: 25, rewards: rng => [{ kind: 'item', item: 'ultra-ball', amount: 3 }, { kind: 'item', item: pick(STONES, rng), amount: 1 }] },
  { id: 'top10', rank: 10, rewards: () => [{ kind: 'item', item: 'ultra-ball', amount: 5 }, { kind: 'item', item: 'rare-candy', amount: 30 }] },
  { id: 'top1', rank: 1, rewards: () => [{ kind: 'item', item: 'master-ball', amount: 1 }] },
];

/** Milestone rewards for display: the random stone shows as a generic "stone" entry. */
export function milestonePreview(m: Milestone): Reward[] {
  return m.rewards(() => 0).map(r => (r.kind === 'item' && STONES.includes(r.item) ? { ...r, item: 'stone' } : r));
}

// --- Battle results --------------------------------------------------------------------

export interface LadderResult {
  /** Player rank before / after (LADDER_SIZE + 1 = unranked). */
  before: number;
  after: number;
  ratingBefore: number;
  ratingAfter: number;
  /** Coins for this battle (also included in `rewards`). */
  coins: number;
  milestones: Milestone[];
  /** Coins + milestone rewards, ready for grant(). */
  rewards: Reward[];
}

/**
 * Applies a finished ladder battle against the trainer on slot `rank` (mutates the ladder slice).
 * A forfeit counts as a loss without the consolation coins; a draw changes nothing and pays like a loss.
 */
export function applyLadderBattle(ladder: LadderSave, rank: number, result: 'win' | 'lose' | 'draw', forfeit = false, rng: Rng = Math.random): LadderResult {
  const ratingBefore = ladder.rating;
  const before = rankForRating(ratingBefore);
  let coins = 0;
  if (result === 'win') {
    ladder.wins++;
    ladder.rating = Math.max(ladder.rating, reputationAt(rank) + 1);
    coins = winCoins(ladderLevel(rank));
  } else {
    if (result === 'lose') {
      ladder.losses++;
      ladder.rating = Math.max(0, ladder.rating - LOSS_REPUTATION);
    }
    coins = forfeit ? 0 : LOSS_COINS;
  }
  const after = rankForRating(ladder.rating);
  const peak = Math.min(before, after);
  if (peak <= LADDER_SIZE) ladder.best = Math.min(ladder.best ?? peak, peak);

  const claimed = claimMilestones(ladder, rng);
  const won: Reward[] = result === 'win' ? [{ kind: 'item', item: 'rare-candy', amount: WIN_CANDY }] : [];
  const rewards: Reward[] = [...(coins ? [{ kind: 'coins', amount: coins } as Reward] : []), ...won, ...claimed.rewards];
  return { before, after, ratingBefore, ratingAfter: ladder.rating, coins, milestones: claimed.milestones, rewards };
}

/** Milestones the current rank qualifies for but that weren't claimed yet. */
export const pendingMilestones = (ladder: LadderSave) => {
  const rank = rankForRating(ladder.rating);
  return MILESTONES.filter(m => rank <= m.rank && !ladder.milestones.includes(m.id));
};

/** Claims every pending milestone (mutates the ladder slice) and returns their rewards. */
export function claimMilestones(ladder: LadderSave, rng: Rng = Math.random): { milestones: Milestone[]; rewards: Reward[] } {
  const milestones = pendingMilestones(ladder);
  ladder.milestones.push(...milestones.map(m => m.id));
  return { milestones, rewards: milestones.flatMap(m => m.rewards(rng)) };
}

/** Next milestone not reached yet (for the "next reward" hint). */
export const nextMilestone = (ladder: LadderSave) => MILESTONES.find(m => !ladder.milestones.includes(m.id));
