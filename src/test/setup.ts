// Loads every generation's Pokédex before tests (the app does this at boot through loadGenerations()).
import gen1 from '../data/pokedex/gen1.json';
import gen2 from '../data/pokedex/gen2.json';
import gen3 from '../data/pokedex/gen3.json';
import gen4 from '../data/pokedex/gen4.json';
import { registerPokedex, type PokedexFile } from '../data/species';

for (const gen of [gen1, gen2, gen3, gen4]) registerPokedex(gen as PokedexFile);
