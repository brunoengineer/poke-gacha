// Battle rules. A battle is DECK_SIZE rounds: the opponent's card for the round is shown (its stats stay hidden),
// the player answers with one of their cards and picks a stat. Both values are multiplied by type advantage
// (each side's best attacking type against the other's types) and the higher value wins the round.
// Ties in the final score are broken by the sum of all compared values, so battles always have a winner.

import { getSpecies } from '../data/species';
import { bestEffectiveness, type PokemonType } from '../data/types';
import { power, statsAt, type StatId, type Stats } from './cards';

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

export type RoundOutcome = 'win' | 'lose' | 'draw';

export interface RoundResult {
  stat: StatId;
  you: BattleCard;
  opp: BattleCard;
  /** Values after type multipliers (rounded). */
  youValue: number;
  oppValue: number;
  matchup: Matchup;
  outcome: RoundOutcome;
}

export function resolveRound(you: BattleCard, opp: BattleCard, stat: StatId): RoundResult {
  const m = matchup(you, opp);
  const youValue = Math.round(you.stats[stat] * m.you.mult);
  const oppValue = Math.round(opp.stats[stat] * m.opp.mult);
  const outcome: RoundOutcome = youValue > oppValue ? 'win' : youValue < oppValue ? 'lose' : 'draw';
  return { stat, you, opp, youValue, oppValue, matchup: m, outcome };
}

export interface BattleSummary {
  result: 'win' | 'lose' | 'draw';
  score: { you: number; opp: number };
  /** True when the score was tied and the value totals decided it. */
  tiebreak: boolean;
  totals: { you: number; opp: number };
  perfect: boolean;
}

export function summarize(rounds: RoundResult[]): BattleSummary {
  const score = { you: 0, opp: 0 };
  const totals = { you: 0, opp: 0 };
  for (const r of rounds) {
    if (r.outcome === 'win') score.you++;
    if (r.outcome === 'lose') score.opp++;
    totals.you += r.youValue;
    totals.opp += r.oppValue;
  }
  let result: BattleSummary['result'] = score.you > score.opp ? 'win' : score.you < score.opp ? 'lose' : 'draw';
  const tiebreak = result === 'draw' && totals.you !== totals.opp;
  if (tiebreak) result = totals.you > totals.opp ? 'win' : 'lose';
  return { result, score, tiebreak, totals, perfect: score.you === rounds.length && rounds.length > 0 };
}

/** Average power of a team (used to scale opponents and show difficulty). */
export const teamPower = (team: BattleCard[]) => (team.length ? Math.round(team.reduce((s, c) => s + c.power, 0) / team.length) : 0);
