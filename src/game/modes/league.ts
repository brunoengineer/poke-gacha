// Pokémon League: a 4-duel elimination tournament (Top 16 -> Champion). Logic and data live here.
//
// A run is a 16-slot bracket: the player, the Champion, the Elite Four and nine elite ladder trainers.
// The player's path is fixed by design: an elite trainer, two Elite Four members (in Elite Four order), then
// the Champion in the final. The other matches are decided by strength, so the people you meet next really
// did win their way to you. The run lives in the save, so leaving and coming back continues it.
// Attrition: the team is registered (locked) when the run starts, and HP and faints carry over between duels.
// Before each duel after the first the player gets 2 Revives (a fainted Pokémon back at half HP) and 4 Potions (one
// Pokémon to full); what isn't used is lost.
// A team above a duel's levels makes the opponents train up to match (scaling.ts).
// Every region has a league in the same format: Kanto (Blue), Johto (Lance), Hoenn (Steven), Sinnoh (Cynthia), each
// stronger and pricier than the last. Functions take the region last and default to Kanto; the other regions' progress
// lives in `league.johto`, `league.hoenn`, `league.sinnoh`.
// The Master League (`league.master`) opens with a title in all four: same format at a flat Lv. 100, no shiny, legendary
// or mythical cards on the team, 3 entries a day, Master Balls for each win and a shiny legendary or mythical for the title.
// It has no attrition: each duel starts at full HP, with no items, and the team isn't registered, so the player can
// change it (saved teams!) between duels to answer the next opponent, as long as it stays within the rules above.

import { getSpecies, hasSpecies, speciesList } from '../../data/species';
import type { PokemonType } from '../../data/types';
import type { SaveData } from '../../state/save';
import type { TeamMember } from '../battle';
import { cardKey, parseKey, type CardKey } from '../cards';
import { DECK_SIZE, STARTERS, UNLOCK_BADGES } from '../economy';
import { REGION_IDS, type RegionId } from '../regions';
import type { Reward } from '../rewards';
import { generateTeam } from '../teams';
import { dayKey, defaultRng, hashString, pick, randInt, seeded, shuffle, type Rng } from '../rng';
import { resolveKey } from '../saved-teams';
import { scaleDuel, teamScale, type Difficulty, type PlayerScale } from '../scaling';
import { generateLadder, trainerTeam, ELITE_RANKS } from './competition';
import { regionBadges } from './gyms';
import { HOENN_CHAMPION, HOENN_ELITE_FOUR } from './hoenn';
import { SINNOH_CHAMPION, SINNOH_ELITE_FOUR } from './sinnoh';

export interface LeagueRun {
  seed: number;
  /** Duels won so far in this run (0..3): the next duel's index. */
  duel: number;
  /** Level bonus fixed when the run started (+5 per title). */
  bonus: number;
  startedAt: number;
  /** The registered team (locked for the whole run). Absent in runs started before attrition: they use the current team. */
  team?: CardKey[];
  /** HP of each registered card as a fraction of max HP, by registered key (missing = full). */
  hp?: Record<CardKey, number>;
  /** Items already used before duel `duel` (older runs: none). */
  used?: { duel: number; potions: number; revives: number };
  /** Older runs only: the duel whose one heal choice was used. Nothing reads it now. */
  healed?: number;
}

export interface HallEntry {
  at: number;
  team: TeamMember[];
}

export type LeagueRegion = RegionId | 'master';
/** The regions' leagues, which the Master League needs a title in. */
export const LEAGUE_REGIONS: RegionId[] = REGION_IDS;
export const ALL_LEAGUES: LeagueRegion[] = [...LEAGUE_REGIONS, 'master'];

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

/** The Master League's progress: a league's, plus its daily limits (by device day, YYYY-MM-DD). */
export interface MasterRecord extends LeagueRecord {
  /** Day of the last entry, and how many that day. */
  entriesDay?: string;
  entries?: number;
  /** Day the shiny prize was last won. */
  shinyDay?: string;
}

/** The Kanto League's progress, plus the others' (optional: absent until their first run). */
export interface LeagueSave extends LeagueRecord {
  johto?: LeagueRecord;
  hoenn?: LeagueRecord;
  sinnoh?: LeagueRecord;
  master?: MasterRecord;
}

export const defaultLeagueSave = (): LeagueSave => ({ runs: 0, best: -1, titles: 0 });

/** A league's progress, read-only (the later regions' may not exist yet). */
export function leagueRecord(save: Pick<SaveData, 'league'>, region: LeagueRegion = 'kanto'): LeagueRecord {
  return region === 'kanto' ? save.league : save.league[region] ?? defaultLeagueSave();
}

/** A league's progress for writing (creates a later region's on first use). */
const writable = (save: SaveData, region: LeagueRegion): LeagueRecord =>
  (region === 'kanto' ? save.league : (save.league[region] ??= defaultLeagueSave()));

const FEES: Record<LeagueRegion, number> = { kanto: 1000, johto: 2500, hoenn: 4000, sinnoh: 6000, master: 10000 };
export const LEAGUE_FEE = FEES.kanto;
export const JOHTO_LEAGUE_FEE = FEES.johto;
export const leagueFee = (region: LeagueRegion = 'kanto') => FEES[region];
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
  // Past Johto the levels go beyond the Lv. 100 cap of normal cards: Hoenn reaches 120, Sinnoh 140 (shinies only).
  hoenn: [[114, 116], [115, 118], [117, 119], [118, 120]],
  sinnoh: [[134, 136], [135, 138], [137, 139], [138, 140]],
  master: [[100, 100], [100, 100], [100, 100], [100, 100]],
};

export const titleBonus = (titles: number) => Math.min(MAX_BONUS, titles * TITLE_BONUS);
/** A new run's level bonus: the Master League stays at Lv. 100 however many titles it has. */
export const runBonus = (titles: number, region: LeagueRegion = 'kanto') => (region === 'master' ? 0 : titleBonus(titles));
export const duelLevels = (duel: number, bonus: number, region: LeagueRegion = 'kanto'): [number, number] => {
  const [min, max] = DUEL_LEVELS[region][duel];
  return [min + bonus, max + bonus];
};

/** A duel's levels against this team (`scale`; without it, as designed). The Master League never trains up. */
export const duelDifficulty = (duel: number, bonus: number, region: LeagueRegion = 'kanto', scale?: PlayerScale): Difficulty =>
  scaleDuel(duelLevels(duel, bonus, region), duel, duelLevels(LEAGUE_DUELS - 1, bonus, region)[1], region === 'master' ? undefined : scale);

/** How many of the regions' leagues the player holds a title in. */
export const leagueTitles = (save: Pick<SaveData, 'league'>) => LEAGUE_REGIONS.filter(r => leagueRecord(save, r).titles > 0).length;

/** Each league needs its region's 8 badges (which in turn need the region before); the Master League, all four titles. */
export const leagueUnlocked = (save: Pick<SaveData, 'gyms' | 'league'>, region: LeagueRegion = 'kanto') =>
  (region === 'master' ? leagueTitles(save) === LEAGUE_REGIONS.length : regionBadges(save.gyms, region) >= UNLOCK_BADGES.league);

const item = (id: string, amount: number): Reward => ({ kind: 'item', item: id, amount });

/** Prizes scale with the region: Johto pays double the Kanto table, Hoenn triple, Sinnoh quadruple. */
const PRIZE_SCALE: Record<RegionId, number> = { kanto: 1, johto: 2, hoenn: 3, sinnoh: 4 };
/** The later regions' Champion prizes (Kanto's is in the table below). */
const CHAMPION_PRIZES: Partial<Record<LeagueRegion, Reward[]>> = {
  johto: [{ kind: 'coins', amount: 10000 }, item('master-ball', 1), item('rare-candy', 80)],
  hoenn: [{ kind: 'coins', amount: 15000 }, item('master-ball', 1), item('rare-candy', 100)],
  sinnoh: [{ kind: 'coins', amount: 20000 }, item('master-ball', 2), item('rare-candy', 120)],
};

/** Master Balls for each Master League win, the title last. */
const MASTER_WIN_BALLS = [2, 3, 5, 10];

/** What winning duel `duel` pays on the spot (only the Master League pays per win). */
export const winRewards = (duel: number, region: LeagueRegion = 'kanto'): Reward[] =>
  (region === 'master' ? [item('master-ball', MASTER_WIN_BALLS[duel])] : []);

export function placementRewards(placement: number, region: LeagueRegion = 'kanto'): Reward[] {
  // The Master League has no placement prizes: its wins were already paid.
  if (region === 'master') return placement >= CHAMPION ? winRewards(LEAGUE_DUELS - 1, region) : [];
  if (region !== 'kanto') {
    if (placement >= CHAMPION) return CHAMPION_PRIZES[region]!;
    const scale = PRIZE_SCALE[region];
    return placementRewards(placement).map(r => (r.kind === 'coins' || r.kind === 'item' ? { ...r, amount: r.amount * scale } : r));
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

/** The Master League's path: three former Champions, with no legendaries and teams built for coverage. */
export const MASTER_RIVALS: LeagueBoss[] = [
  { id: 'blue-master', name: 'Blue', sprite: 'blue', types: ['normal', 'psychic', 'ground'], roster: [18, 65, 464, 103, 59, 9] },
  { id: 'lance-master', name: 'Lance', sprite: 'lance', types: ['dragon', 'flying'], roster: [130, 142, 6, 230, 373, 149] },
  { ...HOENN_CHAMPION, id: 'steven-master' },
];
export const MASTER_CHAMPION: LeagueBoss = { ...SINNOH_CHAMPION, id: 'cynthia-master' };

const ELITE_FOURS: Record<LeagueRegion, LeagueBoss[]> = { kanto: ELITE_FOUR, johto: JOHTO_ELITE_FOUR, hoenn: HOENN_ELITE_FOUR, sinnoh: SINNOH_ELITE_FOUR, master: MASTER_RIVALS };
const CHAMPIONS: Partial<Record<LeagueRegion, LeagueBoss>> = { johto: JOHTO_CHAMPION, hoenn: HOENN_CHAMPION, sinnoh: SINNOH_CHAMPION, master: MASTER_CHAMPION };

export const eliteFour = (region: LeagueRegion = 'kanto') => ELITE_FOURS[region];

/**
 * Kanto's Champion is the rival, whose team answers the player's starter type (grass -> Charizard,
 * fire -> Blastoise, water -> Venusaur); the other regions have fixed Champions (Lance, Steven, Cynthia).
 */
export function championBoss(starter: number | null, region: LeagueRegion = 'kanto'): LeagueBoss {
  if (region !== 'kanto') return CHAMPIONS[region]!;
  const counter: Record<number, { ace: number; extra: [number, number] }> = {
    1: { ace: 6, extra: [103, 130] },
    4: { ace: 9, extra: [103, 59] },
    7: { ace: 3, extra: [130, 59] },
  };
  const i = STARTERS.indexOf(starter ?? -1);
  const pickTeam = counter[i < 0 ? 4 : STARTERS[i % 3]];
  return { id: 'blue', name: 'Blue', sprite: 'blue', types: ['normal', 'psychic', 'ground'], roster: [18, 65, 112, ...pickTeam.extra, pickTeam.ace] };
}

/**
 * The shiny starter a league's first title gives: your own starter in Kanto; elsewhere, that region's starter of your
 * starter's type (Charmander -> Cyndaquil in Johto, Torchic in Hoenn, Chimchar in Sinnoh). When that is your own
 * starter (which the Kanto title already gave), it's Kanto's of the same type instead.
 */
export function firstTitleStarter(starter: number | null, region: RegionId = 'kanto'): number | null {
  const i = STARTERS.indexOf(starter ?? -1);
  if (i < 0) return null;
  if (region === 'kanto') return starter;
  const prize = STARTERS[REGION_IDS.indexOf(region) * 3 + (i % 3)];
  return prize === starter ? STARTERS[i % 3] : prize;
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
  // The Master League's path is fixed: its three rivals in order, with two guests on the Champion's side.
  const master = region === 'master';
  const first = master ? boss(MASTER_RIVALS[0], 'e4', 80) : elites[0];
  const quarter = master ? boss(MASTER_RIVALS[1], 'e4', 85) : boss(e4[pathE4[0]], 'e4', 80 + pathE4[0]);
  const semi = master ? boss(MASTER_RIVALS[2], 'e4', 90) : boss(e4[pathE4[1]], 'e4', 85 + pathE4[1]);

  const slots: (Entrant | null)[] = Array(16).fill(null);
  slots[0] = player;
  slots[1] = first;
  slots[randInt(2, 3, rng)] = quarter;
  slots[randInt(4, 7, rng)] = semi;
  const right = shuffle([8, 9, 10, 11, 12, 13, 14, 15], rng);
  slots[right[0]] = champion;
  slots[right[1]] = master ? boss(JOHTO_ELITE_FOUR[3], 'e4', 70) : boss(e4[otherE4[0]], 'e4', 70 + otherE4[0]);
  slots[right[2]] = master ? boss(HOENN_ELITE_FOUR[3], 'e4', 71) : boss(e4[otherE4[1]], 'e4', 70 + otherE4[1]);
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
  /** Level of the opponent's last Pokémon, when it differs from the rest. */
  ace: number | null;
  /** True when the player's team outgrew this duel's designed levels. */
  scaled: boolean;
  final: boolean;
}

/** The opponent and team of duel `duel` in a run (stable, so leaving and coming back shows the same team). */
export function duelInfo(bracket: Bracket, run: LeagueRun, duel: number, starter: number | null, region: LeagueRegion = 'kanto', scale?: PlayerScale): DuelInfo {
  const opponent = bracket.path[duel];
  const { levels, ace, scaled } = duelDifficulty(duel, run.bonus, region, scale);
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
  if (ace != null) team[team.length - 1] = { ...team[team.length - 1], level: ace };
  return { opponent, team, levels, ace, scaled, final: duel === LEAGUE_DUELS - 1 };
}

// --- Runs ------------------------------------------------------------------------------

export type EntryCheck = 'ok' | 'locked' | 'coins' | 'running' | 'team' | 'daily' | 'banned';

export const MASTER_DAILY_ENTRIES = 3;

/** Master League entries already used on this day (paying counts, however the run ends). */
export const masterEntriesToday = (save: Pick<SaveData, 'league'>, day = dayKey()) =>
  (save.league.master?.entriesDay === day ? save.league.master.entries ?? 0 : 0);

/** True while the Master League's shiny prize can still be won on this day. */
export const masterShinyAvailable = (save: Pick<SaveData, 'league'>, day = dayKey()) => save.league.master?.shinyDay !== day;

/** The team's cards the Master League refuses: shiny, legendary or mythical (or a species this version can't check). */
export const masterBanned = (deck: CardKey[]) => deck.filter(key => {
  const { id, shiny } = parseKey(key);
  if (shiny || !hasSpecies(id)) return true;
  const species = getSpecies(id);
  return species.legendary || species.mythical;
});

export function canEnter(save: Pick<SaveData, 'gyms' | 'coins' | 'league' | 'deck'>, region: LeagueRegion = 'kanto', day = dayKey()): EntryCheck {
  if (!leagueUnlocked(save, region)) return 'locked';
  if (leagueRecord(save, region).run) return 'running';
  if (region === 'master' && masterEntriesToday(save, day) >= MASTER_DAILY_ENTRIES) return 'daily';
  if (save.coins < leagueFee(region)) return 'coins';
  if (save.deck.length < DECK_SIZE) return 'team';
  if (region === 'master' && masterBanned(save.deck).length) return 'banned';
  return 'ok';
}

// --- Registered team, HP and heals --------------------------------------------------------

export interface RunMember {
  /** Key the card was registered with (HP is stored under it). */
  registered: CardKey;
  /** The card now (the registered one, or what it evolved into during the run). */
  key: CardKey;
  /** HP as a fraction of max (0 = fainted). */
  hp: number;
}

/** The run's team: registered cards (followed through evolutions) with their HP. Older runs use the current team. */
export function runTeam(save: Pick<SaveData, 'cards' | 'deck'>, run: LeagueRun): RunMember[] {
  const registered = run.team ?? save.deck;
  return registered.flatMap(reg => {
    const key = resolveKey(save, reg);
    return key ? [{ registered: reg, key, hp: Math.max(0, Math.min(1, run.hp?.[reg] ?? 1)) }] : [];
  });
}

/** The registered team's levels: what the duels scale to (they follow its level-ups during the run). */
export const runScale = (save: Pick<SaveData, 'cards' | 'deck'>, run: LeagueRun): PlayerScale =>
  teamScale(runTeam(save, run).map(m => save.cards[m.key]?.level ?? 1));

/** Stores the team's HP after a duel (fractions in team order, as the battle reports them). */
export function setRunHp(save: SaveData, hpLeft: number[], region: LeagueRegion = 'kanto') {
  const run = leagueRecord(save, region).run;
  if (!run || region === 'master') return;
  const team = runTeam(save, run);
  run.hp = Object.fromEntries(team.map((m, i) => [m.registered, Math.max(0, Math.min(1, hpLeft[i] ?? m.hp))]));
}

export type HealKind = 'potion' | 'revive';
export const REVIVE_HP = 0.5;
/** What the regions' Leagues give before each duel after the first. */
export const LEAGUE_KIT = { potions: 4, revives: 2 };

/** The items still available before the next duel. */
export function kitLeft(run: LeagueRun) {
  const used = run.used?.duel === run.duel ? run.used : { potions: 0, revives: 0 };
  return { potions: LEAGUE_KIT.potions - used.potions, revives: LEAGUE_KIT.revives - used.revives };
}

/** True when the next duel still has an item to use (and anyone to use it on). The Master League has none. */
export function healPending(save: Pick<SaveData, 'cards' | 'deck'>, run: LeagueRun, region: LeagueRegion = 'kanto'): boolean {
  if (region === 'master' || run.duel === 0) return false;
  const targets = healTargets(save, run);
  return targets.potion.length > 0 || targets.revive.length > 0;
}

/** Which items can be used now, and on whom. */
export function healTargets(save: Pick<SaveData, 'cards' | 'deck'>, run: LeagueRun): Record<HealKind, CardKey[]> {
  const team = runTeam(save, run);
  const left = kitLeft(run);
  return {
    potion: left.potions > 0 ? team.filter(m => m.hp > 0 && m.hp < 1).map(m => m.registered) : [],
    revive: left.revives > 0 ? team.filter(m => m.hp <= 0).map(m => m.registered) : [],
  };
}

/** Uses an item before the next duel (mutates the save). `target` is a registered key. */
export function applyHeal(save: SaveData, kind: HealKind, target: CardKey, region: LeagueRegion = 'kanto'): boolean {
  const run = leagueRecord(save, region).run;
  if (!run || !healPending(save, run, region)) return false;
  if (!healTargets(save, run)[kind].includes(target)) return false;
  const left = kitLeft(run);
  run.hp = { ...run.hp, [target]: kind === 'potion' ? 1 : REVIVE_HP };
  run.used = {
    duel: run.duel,
    potions: LEAGUE_KIT.potions - left.potions + (kind === 'potion' ? 1 : 0),
    revives: LEAGUE_KIT.revives - left.revives + (kind === 'revive' ? 1 : 0),
  };
  return true;
}

/** Pays the fee and starts a run (mutates the save). Returns false when not allowed. */
export function startRun(save: SaveData, seed = Math.floor(Math.random() * 2 ** 31), now = Date.now(), region: LeagueRegion = 'kanto'): boolean {
  const day = dayKey(new Date(now));
  if (canEnter(save, region, day) !== 'ok') return false;
  const entries = masterEntriesToday(save, day);
  const league = writable(save, region);
  save.coins -= leagueFee(region);
  league.runs++;
  league.run = { seed, duel: 0, bonus: runBonus(league.titles, region), startedAt: now, hp: {} };
  if (region !== 'master') league.run.team = save.deck.slice(0, DECK_SIZE);
  if (region === 'master') Object.assign(league, { entriesDay: day, entries: entries + 1 });
  return true;
}

export type DuelResult =
  | { kind: 'advance'; duel: number; rewards: Reward[] }
  | { kind: 'out'; placement: number; rewards: Reward[] }
  | { kind: 'champion'; placement: number; rewards: Reward[]; firstTitle: boolean };

/**
 * The Master League title's shiny legendary or mythical, once a day: one the player doesn't own yet, or a duplicate once
 * they own them all. Null when today's was already won.
 */
function claimMasterShiny(save: SaveData, now: number, rng: Rng): Reward | null {
  const day = dayKey(new Date(now));
  if (!masterShinyAvailable(save, day)) return null;
  save.league.master!.shinyDay = day;
  const prizes = speciesList.filter(s => s.legendary || s.mythical);
  const missing = prizes.filter(s => !(cardKey(s.id, true) in save.cards));
  return { kind: 'card', id: pick(missing.length ? missing : prizes, rng).id, shiny: true };
}

/**
 * Applies the result of the current duel (mutates the save). A loss (or draw, or forfeit) ends the run with
 * the placement of that round; winning the final crowns the player and records the team in the Hall of Fame.
 * The first title adds a shiny starter (see firstTitleStarter); in the Master League, every win pays and the title adds
 * the day's shiny prize instead.
 */
export function recordDuel(save: SaveData, won: boolean, team: TeamMember[] = [], now = Date.now(), region: LeagueRegion = 'kanto', rng: Rng = defaultRng): DuelResult | null {
  const league = leagueRecord(save, region);
  const run = league.run;
  if (!run) return null;
  if (!won) return endRun(save, run.duel, region);
  league.duelsWon = (league.duelsWon ?? 0) + 1;
  run.duel++;
  if (run.duel < LEAGUE_DUELS) return { kind: 'advance', duel: run.duel, rewards: winRewards(run.duel - 1, region) };

  const firstTitle = league.titles === 0;
  league.titles++;
  league.hall = [{ at: now, team: team.map(({ id, level, shiny }) => ({ id, level, shiny: !!shiny })) }, ...(league.hall ?? [])].slice(0, HALL_SIZE);
  const result = endRun(save, CHAMPION, region);
  const rewards = [...result.rewards];
  if (region === 'master') {
    const shiny = claimMasterShiny(save, now, rng);
    if (shiny) rewards.push(shiny);
  } else {
    const prize = firstTitleStarter(save.starter, region);
    if (firstTitle && prize != null) rewards.push({ kind: 'card', id: prize, shiny: true });
  }
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

