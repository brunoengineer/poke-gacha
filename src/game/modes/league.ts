// Pokémon League: a 4-duel elimination tournament (Top 16 -> Champion). Logic and data live here.
//
// A run is a 16-slot bracket: the player, the Champion, the Elite Four and nine elite ladder trainers.
// The player's path is fixed by design: an elite trainer, two Elite Four members (in Elite Four order), then
// the Champion in the final. The other matches are decided by strength, so the people you meet next really
// did win their way to you. The run lives in the save, so leaving and coming back continues it.
// Two leagues share the format: Kanto (Blue) and Johto (Lance, stronger and pricier). Functions take the
// region last and default to Kanto; Johto's progress lives in `league.johto`.

import type { PokemonType } from '../../data/types';
import type { SaveData } from '../../state/save';
import type { TeamMember } from '../battle';
import { JOHTO_UNLOCK_BADGES, STARTERS, UNLOCK_BADGES } from '../economy';
import type { Reward } from '../rewards';
import { generateTeam } from '../teams';
import { hashString, randInt, seeded, shuffle } from '../rng';
import { generateLadder, trainerTeam, ELITE_RANKS } from './competition';
import { regionBadges } from './gyms';

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

export type LeagueRegion = 'kanto' | 'johto';
export const LEAGUE_REGIONS: LeagueRegion[] = ['kanto', 'johto'];

/** One league's progress. */
export interface LeagueRecord {
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

/** The Kanto League's progress, plus Johto's (optional: absent until the first Johto run). */
export interface LeagueSave extends LeagueRecord {
  johto?: LeagueRecord;
}

export const defaultLeagueSave = (): LeagueSave => ({ runs: 0, best: -1, titles: 0 });

/** A league's progress, read-only (Johto's may not exist yet). */
export function leagueRecord(save: Pick<SaveData, 'league'>, region: LeagueRegion = 'kanto'): LeagueRecord {
  return region === 'kanto' ? save.league : save.league.johto ?? defaultLeagueSave();
}

/** A league's progress for writing (creates Johto's on first use). */
const writable = (save: SaveData, region: LeagueRegion): LeagueRecord =>
  (region === 'kanto' ? save.league : (save.league.johto ??= defaultLeagueSave()));

export const LEAGUE_FEE = 1000;
export const JOHTO_LEAGUE_FEE = 2500;
export const leagueFee = (region: LeagueRegion = 'kanto') => (region === 'johto' ? JOHTO_LEAGUE_FEE : LEAGUE_FEE);
export const LEAGUE_DUELS = 4;
export const TITLE_BONUS = 5;
export const MAX_BONUS = 40;
export const HALL_SIZE = 12;

export const PLACEMENTS = ['top16', 'top8', 'top4', 'top2', 'champion'] as const;
export type Placement = (typeof PLACEMENTS)[number];
export const CHAMPION = 4;

/** Level range of each duel before the title bonus. */
const DUEL_LEVELS: Record<LeagueRegion, [number, number][]> = {
  kanto: [[60, 63], [62, 66], [64, 68], [66, 70]],
  johto: [[88, 91], [90, 94], [92, 96], [94, 98]],
};

export const titleBonus = (titles: number) => Math.min(MAX_BONUS, titles * TITLE_BONUS);
export const duelLevels = (duel: number, bonus: number, region: LeagueRegion = 'kanto'): [number, number] => {
  const [min, max] = DUEL_LEVELS[region][duel];
  return [min + bonus, max + bonus];
};

/** Kanto needs its 8 badges; Johto needs its own 8 (which in turn need Kanto's). */
export const leagueUnlocked = (save: Pick<SaveData, 'gyms'>, region: LeagueRegion = 'kanto') =>
  (region === 'kanto' ? regionBadges(save.gyms, 'kanto') >= UNLOCK_BADGES.league
    : regionBadges(save.gyms, 'johto') >= JOHTO_UNLOCK_BADGES.league);

const item = (id: string, amount: number): Reward => ({ kind: 'item', item: id, amount });

/** Johto pays double the Kanto table, with its own Champion prize. */
export function placementRewards(placement: number, region: LeagueRegion = 'kanto'): Reward[] {
  if (region === 'johto') {
    if (placement >= CHAMPION) return [{ kind: 'coins', amount: 10000 }, item('master-ball', 1), item('rare-candy', 80)];
    return placementRewards(placement).map(r => (r.kind === 'coins' || r.kind === 'item' ? { ...r, amount: r.amount * 2 } : r));
  }
  switch (placement) {
    case 0: return [{ kind: 'coins', amount: 250 }, item('rare-candy', 5)];
    case 1: return [{ kind: 'coins', amount: 750 }, item('great-ball', 5), item('rare-candy', 10)];
    case 2: return [{ kind: 'coins', amount: 1500 }, item('ultra-ball', 3), item('rare-candy', 20)];
    case 3: return [{ kind: 'coins', amount: 2500 }, item('ultra-ball', 5), item('rare-candy', 30)];
    default: return [{ kind: 'coins', amount: 5000 }, item('master-ball', 1), item('rare-candy', 40)];
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

export const JOHTO_ELITE_FOUR: LeagueBoss[] = [
  { id: 'will', name: 'Will', sprite: 'will', types: ['psychic'], roster: [203, 124, 103, 80, 196, 178] },
  { id: 'koga-johto', name: 'Koga', sprite: 'koga-gen2', types: ['poison'], roster: [168, 49, 205, 89, 110, 169] },
  { id: 'bruno-johto', name: 'Bruno', sprite: 'bruno', types: ['fighting'], roster: [237, 107, 106, 208, 214, 68] },
  { id: 'karen', name: 'Karen', sprite: 'karen', types: ['dark'], roster: [197, 45, 94, 198, 215, 229] },
];

/** Johto's Champion: Lance and his dragons. */
export const JOHTO_CHAMPION: LeagueBoss = {
  id: 'lance-johto', name: 'Lance', sprite: 'lance', types: ['dragon', 'flying'], roster: [130, 142, 6, 230, 149, 149],
};

export const eliteFour = (region: LeagueRegion = 'kanto') => (region === 'johto' ? JOHTO_ELITE_FOUR : ELITE_FOUR);

/**
 * Kanto's Champion is the rival, whose team answers the player's starter type (grass -> Charizard,
 * fire -> Blastoise, water -> Venusaur); Johto's is Lance.
 */
export function championBoss(starter: number | null, region: LeagueRegion = 'kanto'): LeagueBoss {
  if (region === 'johto') return JOHTO_CHAMPION;
  const counter: Record<number, { ace: number; extra: [number, number] }> = {
    1: { ace: 6, extra: [103, 130] },
    4: { ace: 9, extra: [103, 59] },
    7: { ace: 3, extra: [130, 59] },
  };
  const i = STARTERS.indexOf(starter ?? -1);
  const pickTeam = counter[i < 0 ? 4 : STARTERS[i % 3]];
  return { id: 'blue', name: 'Blue', sprite: 'blue', types: ['normal', 'psychic', 'ground'], roster: [18, 65, 112, ...pickTeam.extra, pickTeam.ace] };
}

/** The same-type starter of the other region (Bulbasaur <-> Chikorita, Charmander <-> Cyndaquil, Squirtle <-> Totodile). */
export function counterpartStarter(starter: number | null): number | null {
  const i = STARTERS.indexOf(starter ?? -1);
  return i < 0 ? null : STARTERS[(i + 3) % STARTERS.length];
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

/** Builds the bracket of a run. Stable for the same ladder seed, run seed, starter and region. */
export function buildBracket(ladderSeed: number, runSeed: number, starter: number | null, region: LeagueRegion = 'kanto'): Bracket {
  const rng = seeded(runSeed ^ 0x1ea9e);
  const ladder = generateLadder(ladderSeed).slice(0, ELITE_RANKS);
  const elites: Entrant[] = shuffle(ladder, rng).map(t => ({
    id: `league-${t.id}`, kind: 'elite', name: t.name, sprite: t.sprite, classId: t.classId, types: t.types,
    rank: t.rank, strength: 10 + (ELITE_RANKS - t.rank) * 4 + rng() * 6,
  }));
  const boss = (b: LeagueBoss, kind: EntrantKind, strength: number): Entrant =>
    ({ id: b.id, kind, name: b.name, sprite: b.sprite, types: b.types, strength });

  // Two Elite Four members on the player's path (kept in Elite Four order), the other two on the Champion's side.
  const e4 = eliteFour(region);
  const order = shuffle([0, 1, 2, 3], rng);
  const pathE4 = order.slice(0, 2).sort((a, b) => a - b);
  const otherE4 = order.slice(2);
  const player: Entrant = { id: 'player', kind: 'player', name: '', sprite: '', types: [], strength: Infinity };
  const champion = boss(championBoss(starter, region), 'champion', 100);
  const first = elites[0];
  const quarter = boss(e4[pathE4[0]], 'e4', 80 + pathE4[0]);
  const semi = boss(e4[pathE4[1]], 'e4', 85 + pathE4[1]);

  const slots: (Entrant | null)[] = Array(16).fill(null);
  slots[0] = player;
  slots[1] = first;
  slots[randInt(2, 3, rng)] = quarter;
  slots[randInt(4, 7, rng)] = semi;
  const right = shuffle([8, 9, 10, 11, 12, 13, 14, 15], rng);
  slots[right[0]] = champion;
  slots[right[1]] = boss(e4[otherE4[0]], 'e4', 70 + otherE4[0]);
  slots[right[2]] = boss(e4[otherE4[1]], 'e4', 70 + otherE4[1]);
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
export function duelInfo(bracket: Bracket, run: LeagueRun, duel: number, starter: number | null, region: LeagueRegion = 'kanto'): DuelInfo {
  const opponent = bracket.path[duel];
  const levels = duelLevels(duel, run.bonus, region);
  const rng = seeded(run.seed ^ hashString(`duel-${duel}`));
  let team: TeamMember[];
  if (opponent.kind === 'elite') {
    team = trainerTeam({ rank: opponent.rank!, types: opponent.types }, levels, rng);
  } else {
    const b = opponent.kind === 'champion' ? championBoss(starter, region) : eliteFour(region).find(e => e.id === opponent.id)!;
    team = generateTeam({ level: levels, species: b.roster, exact: true }, rng);
  }
  // Aces lead from the back: the strongest levels go to the last slots.
  const sorted = team.map(m => m.level).sort((a, b) => a - b);
  team = team.map((m, i) => ({ ...m, level: sorted[i] }));
  return { opponent, team, levels, final: duel === LEAGUE_DUELS - 1 };
}

// --- Runs ------------------------------------------------------------------------------

export type EntryCheck = 'ok' | 'locked' | 'coins' | 'running';

export function canEnter(save: Pick<SaveData, 'gyms' | 'coins' | 'league'>, region: LeagueRegion = 'kanto'): EntryCheck {
  if (!leagueUnlocked(save, region)) return 'locked';
  if (leagueRecord(save, region).run) return 'running';
  if (save.coins < leagueFee(region)) return 'coins';
  return 'ok';
}

/** Pays the fee and starts a run (mutates the save). Returns false when not allowed. */
export function startRun(save: SaveData, seed = Math.floor(Math.random() * 2 ** 31), now = Date.now(), region: LeagueRegion = 'kanto'): boolean {
  if (canEnter(save, region) !== 'ok') return false;
  const league = writable(save, region);
  save.coins -= leagueFee(region);
  league.runs++;
  league.run = { seed, duel: 0, bonus: titleBonus(league.titles), startedAt: now };
  return true;
}

export type DuelResult =
  | { kind: 'advance'; duel: number }
  | { kind: 'out'; placement: number; rewards: Reward[] }
  | { kind: 'champion'; placement: number; rewards: Reward[]; firstTitle: boolean };

/**
 * Applies the result of the current duel (mutates the save). A loss (or draw, or forfeit) ends the run with
 * the placement of that round; winning the final crowns the player and records the team in the Hall of Fame.
 * The first title adds a shiny starter: your own in Kanto, its other-region counterpart in Johto.
 */
export function recordDuel(save: SaveData, won: boolean, team: TeamMember[] = [], now = Date.now(), region: LeagueRegion = 'kanto'): DuelResult | null {
  const league = leagueRecord(save, region);
  const run = league.run;
  if (!run) return null;
  if (!won) return endRun(save, run.duel, region);
  league.duelsWon = (league.duelsWon ?? 0) + 1;
  run.duel++;
  if (run.duel < LEAGUE_DUELS) return { kind: 'advance', duel: run.duel };

  const firstTitle = league.titles === 0;
  league.titles++;
  league.hall = [{ at: now, team: team.map(({ id, level, shiny }) => ({ id, level, shiny: !!shiny })) }, ...(league.hall ?? [])].slice(0, HALL_SIZE);
  const result = endRun(save, CHAMPION, region);
  const rewards = [...result.rewards];
  const prize = region === 'johto' ? counterpartStarter(save.starter) : save.starter;
  if (firstTitle && prize != null) rewards.push({ kind: 'card', id: prize, shiny: true });
  return { kind: 'champion', placement: CHAMPION, rewards, firstTitle };
}

/** Leaves the run where it is: counts as losing the current duel. */
export function abandonRun(save: SaveData, region: LeagueRegion = 'kanto') {
  const run = leagueRecord(save, region).run;
  return run ? endRun(save, run.duel, region) : null;
}

function endRun(save: SaveData, placement: number, region: LeagueRegion): { kind: 'out'; placement: number; rewards: Reward[] } {
  const league = writable(save, region);
  league.best = Math.max(league.best, placement);
  delete league.run;
  return { kind: 'out', placement, rewards: placementRewards(placement, region) };
}

