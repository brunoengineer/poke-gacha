// Loads every generation's Pokédex before tests (the app does this at boot through loadGenerations()).
import gen1 from '../data/pokedex/gen1.json';
import { registerPokedex, type PokedexFile } from '../data/species';

registerPokedex(gen1 as PokedexFile);
