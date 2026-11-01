// Generations available in the game. To add one (see "Adding a generation" in the README for the full list):
//   1. npm run pokedex 5        (writes src/data/pokedex/gen5.json)
//   2. add an entry below
// Gym leaders, trainers and banners can then reference the new species by id.

import { registerPokedex, type PokedexFile } from './species';

export interface GenerationDef {
  id: number;
  region: string;
  /** Pokédex range, for filters and the "complete the region" progress. */
  range: [number, number];
  load: () => Promise<{ default: unknown }>;
}

export const GENERATIONS: GenerationDef[] = [
  { id: 1, region: 'Kanto', range: [1, 151], load: () => import('./pokedex/gen1.json') },
  { id: 2, region: 'Johto', range: [152, 251], load: () => import('./pokedex/gen2.json') },
  { id: 3, region: 'Hoenn', range: [252, 386], load: () => import('./pokedex/gen3.json') },
  { id: 4, region: 'Sinnoh', range: [387, 493], load: () => import('./pokedex/gen4.json') },
];

export const regionName = (generation: number) => GENERATIONS.find(g => g.id === generation)?.region ?? '';

export async function loadGenerations() {
  const files = await Promise.all(GENERATIONS.map(g => g.load()));
  files.forEach(file => registerPokedex(file.default as PokedexFile));
}
