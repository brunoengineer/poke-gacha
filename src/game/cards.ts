// Card rules: one card per species plus its shiny version. Cards have a level; stats grow with it.
//
// Level caps (the "easter egg"):
//   - Normal cards stop at Lv. 100…
//   - …except a base form that could evolve but never did: it has no cap, so a patient trainer can push a
//     Charmander past Lv. 100 until it outgrows a Charizard.
//   - Shiny cards never evolve, and none of them have a cap.

import { LINK_CABLE } from '../data/items';
import {
  baseStatTotal, canEverEvolve, evolutionsOf, getSpecies, preEvolution, stage, type BaseStats, type Evolution, type Species,
} from '../data/species';

export type CardKey = string;

export const MAX_LEVEL = 100;
export const SHINY_STAT_BONUS = 1.1;
/** Level evolutions that aren't level-based (friendship, special conditions) use in this game. */
export const FRIENDSHIP_LEVEL = 25;
export const OTHER_EVOLUTION_LEVEL = 30;

export const STAT_IDS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
export type StatId = (typeof STAT_IDS)[number];
export type Stats = BaseStats;

export const cardKey = (id: number, shiny = false): CardKey => `${id}${shiny ? 's' : ''}`;

export function parseKey(key: CardKey): { id: number; shiny: boolean } {
  return { id: parseInt(key, 10), shiny: key.endsWith('s') };
}

/**
 * Stats at a level. Linear in level (like the main games), so levels matter as much as species, and it keeps
 * scaling forever, which is what lets uncapped cards keep growing.
 */
export function statsAt(species: Species, level: number, shiny = false): Stats {
  const bonus = shiny ? SHINY_STAT_BONUS : 1;
  const scale = (base: number) => Math.round(((base * (level + 2)) / 25) * bonus);
  const b = species.stats;
  return {
    hp: scale(b.hp) + level + 10,
    atk: scale(b.atk) + 5,
    def: scale(b.def) + 5,
    spa: scale(b.spa) + 5,
    spd: scale(b.spd) + 5,
    spe: scale(b.spe) + 5,
  };
}

/** Single number summarizing a card's strength (shown as "PC"). */
export const power = (stats: Stats) => STAT_IDS.reduce((sum, id) => sum + stats[id], 0);

export const cardPower = (id: number, level: number, shiny = false) => power(statsAt(getSpecies(id), level, shiny));

/** True when the card has no level cap (see the header comment). */
export function isUncapped(id: number, shiny: boolean): boolean {
  return shiny || (stage(id) === 1 && canEverEvolve(id));
}

export const levelCap = (id: number, shiny: boolean) => (isUncapped(id, shiny) ? Infinity : MAX_LEVEL);

/** Level a requirement asks for (only level-like evolutions have one). */
export function requiredLevel(evo: Evolution): number | null {
  if (evo.kind === 'level') return evo.level ?? OTHER_EVOLUTION_LEVEL;
  if (evo.kind === 'friendship') return FRIENDSHIP_LEVEL;
  if (evo.kind === 'other') return OTHER_EVOLUTION_LEVEL;
  return null;
}

/** Item an evolution consumes (stones, Link Cable for trades, held items for later generations). */
export function requiredItem(evo: Evolution): string | null {
  if (evo.kind === 'item') return evo.item ?? null;
  if (evo.kind === 'trade') return evo.item ?? LINK_CABLE;
  return null;
}

/** Level at which this species naturally appears: its evolution level (Charizard 36), 1 for base forms. */
export function evolutionLevel(id: number): number {
  const from = preEvolution(id);
  // Coming out of a baby form (Pichu -> Pikachu) counts as a base form, like stage().
  if (from == null || getSpecies(from).baby) return 1;
  const evo = evolutionsOf(from).find(e => e.to === id)!;
  return requiredLevel(evo) ?? evolutionLevel(from) + 15;
}

/**
 * Level a card starts at when obtained: always 1, evolved forms and legendaries included. A pulled Charizard or
 * Mewtwo is the better long-term card (its stats grow faster), but levels come from duplicates and training.
 */
export function startLevel(_id: number): number {
  return 1;
}

// --- Rarity ------------------------------------------------------------------

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#a6adbb',
  uncommon: '#4fd18b',
  rare: '#5aa9ff',
  epic: '#c58cff',
  legendary: '#f6c453',
  mythical: '#ff7ad9',
};

const rarityCache = new Map<number, Rarity>();

/** Display rarity, derived from catch rate, evolution stage and base stats (works for any generation). */
export function rarity(id: number): Rarity {
  let cached = rarityCache.get(id);
  if (cached) return cached;
  const s = getSpecies(id);
  const bst = baseStatTotal(s);
  const st = stage(id);
  if (s.mythical) cached = 'mythical';
  else if (s.legendary) cached = 'legendary';
  else if (st >= 3 || bst >= 500) cached = 'epic';
  else if (s.captureRate <= 75) cached = 'rare';
  else if (s.captureRate < 190 || st === 2) cached = 'uncommon';
  else cached = 'common';
  rarityCache.set(id, cached);
  return cached;
}

export const rarityRank = (r: Rarity) => RARITIES.indexOf(r);
