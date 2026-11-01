// Opponent team generation. Trainers "evolve" their Pokémon like the player would: a Lv. 40 Charmander line
// shows up as Charizard, a Lv. 20 one as Charmeleon. Works for any species pool, so modes only describe
// what a trainer likes (types, specific species, level range).

import { evolutionsOf, getSpecies, preEvolution, speciesList, stage, type Species } from '../data/species';
import type { PokemonType } from '../data/types';
import type { SaveData } from '../state/save';
import { evolutionLevel, parseKey, requiredLevel } from './cards';
import type { TeamMember } from './battle';
import { DECK_SIZE } from './economy';
import { defaultRng, randInt, shuffle, type Rng } from './rng';

export interface TeamSpec {
  /** Level, or an inclusive range rolled per member. */
  level: number | [number, number];
  size?: number;
  /** Only families with at least one of these types (checked on the evolved form). */
  types?: PokemonType[];
  /** Exact species to use (fixed rosters: gym leaders, rivals). Evolved automatically unless `exact`. */
  species?: number[];
  /** Use `species` as written, without evolving them. */
  exact?: boolean;
  allowLegendary?: boolean;
  shinyChance?: number;
}

/** Trainers only use stones and trades on Pokémon that have trained for a while (no Lv. 17 Ninetales). */
export const TRAINER_ITEM_EVOLUTION_LEVEL = 20;

/** Level from which a trainer's Pokémon shows up as `id`. */
export function trainerLevelFor(id: number): number {
  const from = preEvolution(id);
  const evo = from == null ? null : evolutionsOf(from).find(e => e.to === id);
  const level = evolutionLevel(id);
  return evo && requiredLevel(evo) == null ? Math.max(level, TRAINER_ITEM_EVOLUTION_LEVEL) : level;
}

/** The most evolved form of `id` a trainer would have at `level` (picks randomly among branches). */
export function evolveForLevel(id: number, level: number, rng: Rng = defaultRng): number {
  let current = id;
  for (;;) {
    const options = evolutionsOf(current).filter(e => trainerLevelFor(e.to) <= level);
    if (!options.length) return current;
    current = options[Math.floor(rng() * options.length)].to;
  }
}

const rollLevel = (level: TeamSpec['level'], rng: Rng) => (Array.isArray(level) ? randInt(level[0], level[1], rng) : level);

function familyMatches(base: Species, types: PokemonType[]) {
  return speciesList.some(s => s.family === base.family && s.types.some(t => types.includes(t)));
}

export function generateTeam(spec: TeamSpec, rng: Rng = defaultRng): TeamMember[] {
  const size = spec.size ?? DECK_SIZE;
  const shiny = () => rng() < (spec.shinyChance ?? 0);

  if (spec.species?.length) {
    return spec.species.slice(0, size).map(id => {
      const level = rollLevel(spec.level, rng);
      return { id: spec.exact ? id : evolveForLevel(id, level, rng), level, shiny: shiny() };
    });
  }

  const bases = speciesList.filter(s => stage(s.id) === 1
    && (spec.allowLegendary || (!s.legendary && !s.mythical))
    && (!spec.types?.length || familyMatches(s, spec.types)));
  const team: TeamMember[] = [];
  const families = new Set<number>();
  for (const base of shuffle(bases, rng)) {
    if (team.length >= size) break;
    if (families.has(base.family)) continue;
    families.add(base.family);
    const level = rollLevel(spec.level, rng);
    let id = evolveForLevel(base.id, level, rng);
    // With a type filter, prefer the family member that actually has the type (Eevee -> Flareon for a fire trainer).
    if (spec.types?.length && !getSpecies(id).types.some(t => spec.types!.includes(t))) {
      const typed = speciesList.find(s => s.family === base.family && s.types.some(t => spec.types!.includes(t)) && trainerLevelFor(s.id) <= level);
      if (!typed) {
        families.delete(base.family);
        continue;
      }
      id = typed.id;
    }
    team.push({ id, level, shiny: shiny() });
  }
  return team;
}

/** Levels of the player's strongest cards (team first), for scaling opponents to the player. */
export function playerLevels(save: SaveData): { team: number; top: number; average: number } {
  const levels = Object.entries(save.cards).map(([key, card]) => ({ key, level: card.level }));
  const team = save.deck.map(key => save.cards[key]?.level ?? 0);
  const top = levels.map(c => c.level).sort((a, b) => b - a).slice(0, DECK_SIZE);
  const avg = (list: number[]) => (list.length ? Math.round(list.reduce((s, l) => s + l, 0) / list.length) : 1);
  return { team: avg(team), top: avg(top), average: avg(levels.map(c => c.level)) };
}

/** The player's team as battle members. */
export function playerTeam(save: SaveData): (TeamMember & { key: string })[] {
  return save.deck.filter(key => save.cards[key]).map(key => {
    const { id, shiny } = parseKey(key);
    return { key, id, shiny, level: save.cards[key].level };
  });
}
