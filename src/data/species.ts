// Species registry. Generations register their Pokédex files here (see generations.ts);
// everything else asks this module about species, families and evolutions, so adding a generation
// only means adding its data file.

import type { PokemonType } from './types';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export type EvolutionKind = 'level' | 'item' | 'trade' | 'friendship' | 'other';

export interface Evolution {
  to: number;
  kind: EvolutionKind;
  level?: number;
  item?: string;
}

export interface Species {
  id: number;
  slug: string;
  name: string;
  genus: string;
  types: PokemonType[];
  stats: BaseStats;
  captureRate: number;
  legendary: boolean;
  mythical: boolean;
  baby: boolean;
  family: number;
  /** Raw pre-evolution (may belong to a generation that isn't loaded; use preEvolution()). */
  evolvesFrom: number | null;
  /** Raw evolutions (may include species not loaded; use evolutionsOf()). */
  evolutions: Evolution[];
  height: number;
  weight: number;
  habitat: string | null;
  flavor: string;
  generation: number;
}

export interface PokedexFile {
  generation: number;
  region: string;
  species: Omit<Species, 'generation'>[];
}

const byId = new Map<number, Species>();
export const speciesList: Species[] = [];

export function registerPokedex(file: PokedexFile) {
  for (const raw of file.species) {
    if (byId.has(raw.id)) continue;
    const species = Object.freeze({ ...raw, generation: file.generation }) as Species;
    byId.set(species.id, species);
    speciesList.push(species);
  }
  speciesList.sort((a, b) => a.id - b.id);
  stageCache.clear();
}

export const hasSpecies = (id: number) => byId.has(id);

export function getSpecies(id: number): Species {
  const species = byId.get(id);
  if (!species) throw new Error(`Unknown species #${id}`);
  return species;
}

/** Evolutions whose target species is loaded. */
export const evolutionsOf = (id: number): Evolution[] => getSpecies(id).evolutions.filter(e => byId.has(e.to));

/** Pre-evolution, if it is loaded (Pikachu has none while Johto isn't loaded). */
export function preEvolution(id: number): number | null {
  const from = getSpecies(id).evolvesFrom;
  return from != null && byId.has(from) ? from : null;
}

export const canEverEvolve = (id: number) => evolutionsOf(id).length > 0;

const stageCache = new Map<number, number>();

/**
 * 1 for base forms, 2 for the first evolution, 3 for the second. Baby Pokémon (Pichu, Cleffa…) don't count as a stage:
 * they are bonus forms before the base, so adding a generation with babies doesn't demote Pikachu to stage 2.
 */
export function stage(id: number): number {
  let cached = stageCache.get(id);
  if (cached == null) {
    const from = preEvolution(id);
    cached = from == null || getSpecies(from).baby ? 1 : stage(from) + 1;
    stageCache.set(id, cached);
  }
  return cached;
}

/** Number of stages in this species' longest evolution line (1 for Tauros, 3 for Charmander). */
export function lineLength(id: number): number {
  let root = id;
  for (let from = preEvolution(root); from != null; from = preEvolution(root)) root = from;
  const depth = (s: number): number => 1 + Math.max(0, ...evolutionsOf(s).map(e => depth(e.to)));
  return depth(root);
}

/** All species that `id` can eventually evolve into, nearest first. */
export function descendants(id: number): number[] {
  const out: number[] = [];
  const queue = evolutionsOf(id).map(e => e.to);
  while (queue.length) {
    const next = queue.shift()!;
    out.push(next);
    queue.push(...evolutionsOf(next).map(e => e.to));
  }
  return out;
}

/** The whole evolution family (loaded species only), in Pokédex order. */
export function familyOf(id: number): Species[] {
  const family = getSpecies(id).family;
  return speciesList.filter(s => s.family === family);
}

export const baseStatTotal = (s: Species) => s.stats.hp + s.stats.atk + s.stats.def + s.stats.spa + s.stats.spd + s.stats.spe;
