// Shiny Hunt: the player picks one species they have caught and battles hordes of it, one paid attempt at a time.
//   - The horde is six wild Pokémon of that species at the player's team level (±1).
//   - Each win may drop a copy of the species, and may drop its shiny. The shiny chance grows with the chain:
//     consecutive wins on the same species. A loss (or a forfeit) breaks the chain; switching species restarts it.
//   - Legendary and mythical Pokémon can't be hunted (they stay rare), nor species never caught (captures keep
//     their surprise). In a Region Journey chapter, neither can species of other regions; a chain on one just waits in
//     the save until the player is back where it can be hunted.
//   - The entry fee (by rarity) keeps hunts from being a free source of cards: a copy costs about what a Rare Candy
//     costs at the Mart.

import { getSpecies } from '../../data/species';
import type { TeamMember } from '../battle';
import { playerCanUse } from '../journey';
import { rarity, type Rarity } from '../cards';
import type { Reward } from '../rewards';
import { defaultRng, type Rng } from '../rng';
import { generateTeam } from '../teams';
import { MIN_LEVEL } from './training';

export interface HuntSave {
  /** Species being hunted (null: none picked yet). */
  target: number | null;
  /** Consecutive wins against the target. */
  chain: number;
  bestChain: number;
  wins: number;
  losses: number;
  /** Shinies found by hunting. */
  shinies: number;
}

export const defaultHuntSave = (): HuntSave => ({ target: null, chain: 0, bestChain: 0, wins: 0, losses: 0, shinies: 0 });

/** Shiny chance per win: 1/256 with no chain, rising by CHAIN_STEP/256 per chain win, up to CHAIN_MAX (~1/25). */
export const BASE_SHINY_ODDS = 256;
export const CHAIN_STEP = 0.23;
export const CHAIN_MAX = 40;
/** Chance a win drops a copy of the hunted species. */
export const COPY_CHANCE = 0.35;
/** Horde level around the player's team average. */
export const LEVEL_SPREAD = 1;

export const ENTRY_FEE: Record<Exclude<Rarity, 'legendary' | 'mythical'>, number> = {
  common: 100,
  uncommon: 150,
  rare: 250,
  epic: 400,
};

export type HuntBlock = 'not-caught' | 'legendary' | 'other-region';

/** Why a species can't be hunted (null when it can). */
export function huntBlock(id: number, caught: Record<string, number>): HuntBlock | null {
  const sp = getSpecies(id);
  if (sp.legendary || sp.mythical) return 'legendary';
  if (!playerCanUse(id)) return 'other-region';
  if (!caught[id]) return 'not-caught';
  return null;
}

export function entryFee(id: number): number {
  const r = rarity(id);
  return r === 'legendary' || r === 'mythical' ? Infinity : ENTRY_FEE[r];
}

/** Shiny chance of the next win with `chain` consecutive wins behind it. */
export const shinyChance = (chain: number) => (1 + CHAIN_STEP * Math.min(chain, CHAIN_MAX)) / BASE_SHINY_ODDS;

/** The same chance as "1 in N", for display. */
export const shinyOdds = (chain: number) => Math.round(1 / shinyChance(chain));

export function hordeTeam(id: number, teamAverage: number, rng: Rng = defaultRng): TeamMember[] {
  const level: [number, number] = [Math.max(MIN_LEVEL, teamAverage - LEVEL_SPREAD), Math.max(MIN_LEVEL, teamAverage + LEVEL_SPREAD)];
  return generateTeam({ level, species: Array(6).fill(id), exact: true }, rng);
}

/** Drops for a win at the given chain (before it grows): maybe a copy, maybe the shiny. Can be empty. */
export function huntRewards(id: number, chain: number, rng: Rng = defaultRng): Reward[] {
  const rewards: Reward[] = [];
  if (rng() < COPY_CHANCE) rewards.push({ kind: 'card', id });
  if (rng() < shinyChance(chain)) rewards.push({ kind: 'card', id, shiny: true });
  return rewards;
}

/** The target if it can be hunted in this chapter, else null (it stays in the save, chain included). */
export const huntTargetHere = (hunt: Pick<HuntSave, 'target'>): number | null =>
  (hunt.target != null && playerCanUse(hunt.target) ? hunt.target : null);

/** Picks a new target. Switching to another species restarts the chain (mutates the save slice). */
export function setTarget(hunt: HuntSave, id: number) {
  if (hunt.target === id) return;
  hunt.target = id;
  hunt.chain = 0;
}

/** Records a hunt against the current target (mutates the save slice). */
export function recordHunt(hunt: HuntSave, won: boolean, foundShiny: boolean) {
  if (!won) {
    hunt.losses += 1;
    hunt.chain = 0;
    return;
  }
  hunt.wins += 1;
  hunt.chain += 1;
  hunt.bestChain = Math.max(hunt.bestChain, hunt.chain);
  if (foundShiny) hunt.shinies += 1;
}
