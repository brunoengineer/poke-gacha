// Battle cards and type advantage, shared by the HP battle rules (duel.ts), team building and the UI.

import { getSpecies } from '../data/species';
import { bestEffectiveness, type PokemonType } from '../data/types';
import { power, statsAt, type Stats } from './cards';

export interface TeamMember {
  id: number;
  level: number;
  shiny?: boolean;
}

export interface BattleCard {
  id: number;
  level: number;
  shiny: boolean;
  types: PokemonType[];
  stats: Stats;
  power: number;
  /** Card key, for the player's cards. */
  key?: string;
  /** The most one hit can take, as a share of the target's max HP (Legendary Battle bosses). */
  maxHit?: number;
}

export function toBattleCard(member: TeamMember, key?: string): BattleCard {
  const species = getSpecies(member.id);
  const stats = statsAt(species, member.level, !!member.shiny);
  return { id: member.id, level: member.level, shiny: !!member.shiny, types: species.types, stats, power: power(stats), key };
}

/** Raw type effectiveness -> battle multiplier (softened so levels still matter most). */
export function typeMultiplier(effectiveness: number): number {
  if (effectiveness >= 4) return 1.6;
  if (effectiveness >= 2) return 1.3;
  if (effectiveness === 0) return 0.5;
  if (effectiveness <= 0.25) return 0.65;
  if (effectiveness <= 0.5) return 0.8;
  return 1;
}

export interface Matchup {
  /** Raw effectiveness and the battle multiplier, for each side attacking the other. */
  you: { effectiveness: number; mult: number };
  opp: { effectiveness: number; mult: number };
}

export function matchup(you: BattleCard, opp: BattleCard): Matchup {
  const youEff = bestEffectiveness(you.types, opp.types);
  const oppEff = bestEffectiveness(opp.types, you.types);
  return {
    you: { effectiveness: youEff, mult: typeMultiplier(youEff) },
    opp: { effectiveness: oppEff, mult: typeMultiplier(oppEff) },
  };
}

/** Average power of a team (used to scale opponents and show difficulty). */
export const teamPower = (team: BattleCard[]) => (team.length ? Math.round(team.reduce((s, c) => s + c.power, 0) / team.length) : 0);
