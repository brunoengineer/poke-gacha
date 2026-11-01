// Pokémon League: a 4-duel elimination tournament (Top 16 -> Champion). Logic and data live here.
//
// A run is a 16-slot bracket: the player, the Champion (Blue), the Elite Four and nine elite ladder trainers.
// The player's path is fixed by design: an elite trainer, two Elite Four members (in Elite Four order), then
// the Champion in the final. The other matches are decided by strength, so the people you meet next really
// did win their way to you. The run lives in the save, so leaving and coming back continues it.

import type { PokemonType } from '../../data/types';
import type { SaveData } from '../../state/save';
import type { TeamMember } from '../battle';
import { UNLOCK_BADGES } from '../economy';
import type { Reward } from '../rewards';
import { generateTeam } from '../teams';
import { hashString, randInt, seeded, shuffle } from '../rng';
import { generateLadder, trainerTeam, ELITE_RANKS } from './competition';

export interface LeagueRun {
  seed: number;
  /** Duels won so far in this run (0..3): the next duel's index. */
  duel: number;
  /** Level bonus fixed when the run started (+5 per title). */
  bonus: number;
  startedAt: number;
}

export interface HallEntry {
  at: number;
  team: TeamMember[];
}

export interface LeagueSave {
  runs: number;
  /** Best placement reached: 0 = Top 16 … 3 = Top 2, 4 = Champion; -1 = never played. */
  best: number;
  titles: number;
  /** Run in progress (optional: absent between runs and in older saves). */
  run?: LeagueRun;
  /** Hall of Fame: the team of each title, newest first. */
  hall?: HallEntry[];
  /** Duels won across all runs. */
  duelsWon?: number;
}

export const defaultLeagueSave = (): LeagueSave => ({ runs: 0, best: -1, titles: 0 });

export const LEAGUE_FEE = 1000;
export const LEAGUE_DUELS = 4;
export const TITLE_BONUS = 5;
export const MAX_BONUS = 40;
export const HALL_SIZE = 12;

export const PLACEMENTS = ['top16', 'top8', 'top4', 'top2', 'champion'] as const;
export type Placement = (typeof PLACEMENTS)[number];
export const CHAMPION = 4;

/** Level range of each duel before the title bonus. */
const DUEL_LEVELS: [number, number][] = [[55, 58], [57, 61], [59, 63], [61, 65]];

export const titleBonus = (titles: number) => Math.min(MAX_BONUS, titles * TITLE_BONUS);
export const duelLevels = (duel: number, bonus: number): [number, number] => {
  const [min, max] = DUEL_LEVELS[duel];
  return [min + bonus, max + bonus];
};

export const leagueUnlocked = (save: Pick<SaveData, 'gyms'>) => save.gyms.badges.length >= UNLOCK_BADGES.league;

export function placementRewards(placement: number): Reward[] {
  const item = (id: string, amount: number): Reward => ({ kind: 'item', item: id, amount });
  switch (placement) {
    case 0: return [{ kind: 'coins', amount: 500 }];
    case 1: return [{ kind: 'coins', amount: 1500 }, item('great-ball', 5)];
    case 2: return [{ kind: 'coins', amount: 3000 }, item('ultra-ball', 3), item('rare-candy', 10)];
    case 3: return [{ kind: 'coins', amount: 5000 }, item('ultra-ball', 5), item('rare-candy', 20)];
    default: return [{ kind: 'coins', amount: 10000 }, item('master-ball', 1), item('rare-candy', 30)];
  }
}

// --- Bosses --------------------------------------------------------------------------

export interface LeagueBoss {
  id: string;
  name: string;
  sprite: string;
  types: PokemonType[];
  /** Fixed roster, ace last. */
  roster: number[];
}

/** In Elite Four order: later members are tougher and meet you later. */
export const ELITE_FOUR: LeagueBoss[] = [
  { id: 'lorelei', name: 'Lorelei', sprite: 'lorelei-gen3', types: ['ice', 'water'], roster: [87, 91, 80, 124, 121, 131] },
  { id: 'bruno', name: 'Bruno', sprite: 'bruno', types: ['fighting', 'rock'], roster: [95, 57, 107, 106, 62, 68] },
  { id: 'agatha', name: 'Agatha', sprite: 'agatha-gen3', types: ['ghost', 'poison'], roster: [42, 24, 110, 89, 93, 94] },
  { id: 'lance', name: 'Lance', sprite: 'lance', types: ['dragon', 'flying'], roster: [130, 148, 142, 117, 6, 149] },
];

/** The rival's team answers the player's starter (Bulbasaur -> Charizard, Charmander -> Blastoise, Squirtle -> Venusaur). */
export function championBoss(starter: number | null): LeagueBoss {
  const counter: Record<number, { ace: number; extra: [number, number] }> = {
    1: { ace: 6, extra: [103, 130] },
    4: { ace: 9, extra: [103, 59] },
    7: { ace: 3, extra: [130, 59] },
  };
  const pickTeam = counter[starter ?? 4] ?? counter[4];
  return { id: 'blue', name: 'Blue', sprite: 'blue', types: ['normal', 'psychic', 'ground'], roster: [18, 65, 112, ...pickTeam.extra, pickTeam.ace] };
}

// --- Bracket ---------------------------------------------------------------------------

export type EntrantKind = 'player' | 'elite' | 'e4' | 'champion';

export interface Entrant {
  id: string;
  kind: EntrantKind;
  /** Proper name (bosses and ladder trainers); empty for the player. */
  name: string;
  sprite: string;
  /** Trainer class id (ladder trainers). */
  classId?: string;
  types: PokemonType[];
  /** Ladder rank slot, for elite trainers. */
  rank?: number;
  /** Decides simulated matches. */
  strength: number;
}

export interface Bracket {
  /** rounds[0]: the 16 entrants in bracket order; rounds[k]: the 16 / 2^k winners of round k (index into rounds[0]). */
  slots: Entrant[];
  rounds: number[][];
  /** The player's four opponents, in order. */
  path: Entrant[];
}

/** Builds the bracket of a run. Stable for the same ladder seed, run seed and starter. */
export function buildBracket(ladderSeed: number, runSeed: number, starter: number | null): Bracket {
  const rng = seeded(runSeed ^ 0x1ea9e);
  const ladder = generateLadder(ladderSeed).slice(0, ELITE_RANKS);
  const elites: Entrant[] = shuffle(ladder, rng).map(t => ({
    id: `league-${t.id}`, kind: 'elite', name: t.name, sprite: t.sprite, classId: t.classId, types: t.types,
    rank: t.rank, strength: 10 + (ELITE_RANKS - t.rank) * 4 + rng() * 6,
  }));
  const boss = (b: LeagueBoss, kind: EntrantKind, strength: number): Entrant =>
    ({ id: b.id, kind, name: b.name, sprite: b.sprite, types: b.types, strength });

  // Two Elite Four members on the player's path (kept in Elite Four order), the other two on Blue's side.
  const order = shuffle([0, 1, 2, 3], rng);
  const pathE4 = order.slice(0, 2).sort((a, b) => a - b);
  const otherE4 = order.slice(2);
  const player: Entrant = { id: 'player', kind: 'player', name: '', sprite: '', types: [], strength: Infinity };
  const champion = boss(championBoss(starter), 'champion', 100);
  const first = elites[0];
  const quarter = boss(ELITE_FOUR[pathE4[0]], 'e4', 80 + pathE4[0]);
  const semi = boss(ELITE_FOUR[pathE4[1]], 'e4', 85 + pathE4[1]);

  const slots: (Entrant | null)[] = Array(16).fill(null);
  slots[0] = player;
  slots[1] = first;
  slots[randInt(2, 3, rng)] = quarter;
  slots[randInt(4, 7, rng)] = semi;
  const right = shuffle([8, 9, 10, 11, 12, 13, 14, 15], rng);
  slots[right[0]] = champion;
  slots[right[1]] = boss(ELITE_FOUR[otherE4[0]], 'e4', 70 + otherE4[0]);
  slots[right[2]] = boss(ELITE_FOUR[otherE4[1]], 'e4', 70 + otherE4[1]);
  let next = 1;
  for (let i = 0; i < 16; i++) if (!slots[i]) slots[i] = elites[next++];

  const filled = slots as Entrant[];
  const rounds: number[][] = [filled.map((_, i) => i)];
  while (rounds.at(-1)!.length > 1) {
    const prev = rounds.at(-1)!;
    const winners: number[] = [];
    for (let i = 0; i < prev.length; i += 2) winners.push(filled[prev[i]].strength >= filled[prev[i + 1]].strength ? prev[i] : prev[i + 1]);
    rounds.push(winners);
  }
  // The player's opponent in round k is the other finalist of their match in that round.
  const path = [1, 2, 3, 4].map(k => {
    const prev = rounds[k - 1];
    const at = prev.indexOf(0);
    return filled[prev[at % 2 === 0 ? at + 1 : at - 1]];
  });
  return { slots: filled, rounds, path };
}

export interface DuelInfo {
  opponent: Entrant;
  team: TeamMember[];
  levels: [number, number];
  final: boolean;
}

/** The opponent and team of duel `duel` in a run (stable, so leaving and coming back shows the same team). */
export function duelInfo(bracket: Bracket, run: LeagueRun, duel: number, starter: number | null): DuelInfo {
  const opponent = bracket.path[duel];
  const levels = duelLevels(duel, run.bonus);
  const rng = seeded(run.seed ^ hashString(`duel-${duel}`));
  let team: TeamMember[];
  if (opponent.kind === 'elite') {
    team = trainerTeam({ rank: opponent.rank!, types: opponent.types }, levels, rng);
  } else {
    const b = opponent.kind === 'champion' ? championBoss(starter) : ELITE_FOUR.find(e => e.id === opponent.id)!;
    team = generateTeam({ level: levels, species: b.roster, exact: true }, rng);
  }
  // Aces lead from the back: the strongest levels go to the last slots.
  const sorted = team.map(m => m.level).sort((a, b) => a - b);
  team = team.map((m, i) => ({ ...m, level: sorted[i] }));
  return { opponent, team, levels, final: duel === LEAGUE_DUELS - 1 };
}

// --- Runs ------------------------------------------------------------------------------

export type EntryCheck = 'ok' | 'locked' | 'coins' | 'running';

export function canEnter(save: Pick<SaveData, 'gyms' | 'coins' | 'league'>): EntryCheck {
  if (!leagueUnlocked(save)) return 'locked';
  if (save.league.run) return 'running';
  if (save.coins < LEAGUE_FEE) return 'coins';
  return 'ok';
}

/** Pays the fee and starts a run (mutates the save). Returns false when not allowed. */
export function startRun(save: SaveData, seed = Math.floor(Math.random() * 2 ** 31), now = Date.now()): boolean {
  if (canEnter(save) !== 'ok') return false;
  save.coins -= LEAGUE_FEE;
  save.league.runs++;
  save.league.run = { seed, duel: 0, bonus: titleBonus(save.league.titles), startedAt: now };
  return true;
}

export type DuelResult =
  | { kind: 'advance'; duel: number }
  | { kind: 'out'; placement: number; rewards: Reward[] }
  | { kind: 'champion'; placement: number; rewards: Reward[]; firstTitle: boolean };

/**
 * Applies the result of the current duel (mutates the save). A loss (or draw, or forfeit) ends the run with
 * the placement of that round; winning the final crowns the player and records the team in the Hall of Fame.
 */
export function recordDuel(save: SaveData, won: boolean, team: TeamMember[] = [], now = Date.now()): DuelResult | null {
  const league = save.league;
  const run = league.run;
  if (!run) return null;
  if (!won) return endRun(save, run.duel);
  league.duelsWon = (league.duelsWon ?? 0) + 1;
  run.duel++;
  if (run.duel < LEAGUE_DUELS) return { kind: 'advance', duel: run.duel };

  const firstTitle = league.titles === 0;
  league.titles++;
  league.hall = [{ at: now, team: team.map(({ id, level, shiny }) => ({ id, level, shiny: !!shiny })) }, ...(league.hall ?? [])].slice(0, HALL_SIZE);
  const result = endRun(save, CHAMPION);
  const rewards = [...result.rewards];
  if (firstTitle && save.starter != null) rewards.push({ kind: 'card', id: save.starter, shiny: true });
  return { kind: 'champion', placement: CHAMPION, rewards, firstTitle };
}

/** Leaves the run where it is: counts as losing the current duel. */
export const abandonRun = (save: SaveData) => (save.league.run ? endRun(save, save.league.run.duel) : null);

function endRun(save: SaveData, placement: number): { kind: 'out'; placement: number; rewards: Reward[] } {
  save.league.best = Math.max(save.league.best, placement);
  delete save.league.run;
  return { kind: 'out', placement, rewards: placementRewards(placement) };
}
