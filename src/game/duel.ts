// HP battle rules. Each side has up to six Pokémon; two fight at a time until one faints:
//   - Speed decides who hits first (ties go to the player), then they take turns.
//   - A hit uses the attacker's better offensive stat: Attack against the target's Defense, or Sp. Atk against
//     Sp. Def, whichever deals more damage. Type advantage scales it (typeMultiplier). There are no moves.
//   - The winner stays in with the HP it has left; the losing side sends its next Pokémon. The player chooses
//     who goes in (at the start, after a faint, and optionally when a new opponent enters); the opponent sends
//     its team in order.
//   - The side with Pokémon still standing wins. Perfect: none of the player's Pokémon fainted.

import { bestEffectiveness } from '../data/types';
import { typeMultiplier, type BattleCard } from './battle';

/** Scales damage so an even matchup takes about three hits. Only the pacing depends on it, not who wins. */
export const DAMAGE_SCALE = 0.75;

export type Side = 'you' | 'opp';

export interface Fighter {
  card: BattleCard;
  /** Current HP (max HP is card.stats.hp). */
  hp: number;
}

export interface Strike {
  stat: 'atk' | 'spa';
  damage: number;
  /** Raw type effectiveness and the multiplier applied to the damage. */
  effectiveness: number;
  mult: number;
}

export interface Hit extends Strike {
  attacker: Side;
  /** Target's HP after the hit. */
  hpLeft: number;
  ko: boolean;
}

const hitFor = (attack: number, defense: number, mult: number) =>
  Math.max(1, Math.round(((attack * attack) / (attack + defense)) * DAMAGE_SCALE * mult));

/** The hit `attacker` lands on `defender` (always the stronger of its physical and special attack). */
export function strike(attacker: BattleCard, defender: BattleCard): Strike {
  const effectiveness = bestEffectiveness(attacker.types, defender.types);
  const mult = typeMultiplier(effectiveness);
  const physical = hitFor(attacker.stats.atk, defender.stats.def, mult);
  const special = hitFor(attacker.stats.spa, defender.stats.spd, mult);
  return physical >= special
    ? { stat: 'atk', damage: physical, effectiveness, mult }
    : { stat: 'spa', damage: special, effectiveness, mult };
}

export const firstStriker = (you: BattleCard, opp: BattleCard): Side => (opp.stats.spe > you.stats.spe ? 'opp' : 'you');

export interface DuelResult {
  hits: Hit[];
  winner: Side;
}

/** Two Pokémon trade hits until one faints. Mutates the fighters' HP. */
export function fightDuel(you: Fighter, opp: Fighter): DuelResult {
  const hits: Hit[] = [];
  let side = firstStriker(you.card, opp.card);
  while (you.hp > 0 && opp.hp > 0) {
    const [attacker, defender] = side === 'you' ? [you, opp] : [opp, you];
    const s = strike(attacker.card, defender.card);
    defender.hp = Math.max(0, defender.hp - s.damage);
    hits.push({ ...s, attacker: side, hpLeft: defender.hp, ko: defender.hp === 0 });
    side = side === 'you' ? 'opp' : 'you';
  }
  return { hits, winner: you.hp > 0 ? 'you' : 'opp' };
}

/** Predicts a duel without touching the real fighters (balance simulations, future opponent planning). */
export const previewDuel = (you: Fighter, opp: Fighter) => fightDuel({ ...you }, { ...opp });

// --- A whole battle -------------------------------------------------------------------------------

export interface DuelLog extends DuelResult {
  you: number;
  opp: number;
}

export interface BattleState {
  you: Fighter[];
  opp: Fighter[];
  /** Index of the player's Pokémon on the field (null: the player must choose one). */
  youActive: number | null;
  /** Index of the opponent's Pokémon on the field (-1 when all fainted). */
  oppActive: number;
  duels: DuelLog[];
}

const fresh = (card: BattleCard): Fighter => ({ card, hp: card.stats.hp });

/** Starts a battle. The opponent sends its team in the given order; the player picks with sendIn(). */
export function createBattle(you: BattleCard[], opp: BattleCard[]): BattleState {
  return { you: you.map(fresh), opp: opp.map(fresh), youActive: null, oppActive: 0, duels: [] };
}

export const standing = (fighters: Fighter[]) => fighters.flatMap((f, i) => (f.hp > 0 ? [i] : []));

/** Puts one of the player's standing Pokémon on the field (also used for the optional switch). */
export function sendIn(state: BattleState, index: number): boolean {
  if (!state.you[index] || state.you[index].hp <= 0 || battleWinner(state)) return false;
  state.youActive = index;
  return true;
}

/** Fights the current duel. The fainted side's slot empties: the opponent sends its next Pokémon right away. */
export function playDuel(state: BattleState): DuelLog | null {
  if (state.youActive == null || state.oppActive < 0) return null;
  const log: DuelLog = { you: state.youActive, opp: state.oppActive, ...fightDuel(state.you[state.youActive], state.opp[state.oppActive]) };
  state.duels.push(log);
  if (log.winner === 'you') state.oppActive = standing(state.opp)[0] ?? -1;
  else state.youActive = null;
  return log;
}

export function battleWinner(state: BattleState): Side | null {
  if (!standing(state.opp).length) return 'you';
  if (!standing(state.you).length) return 'opp';
  return null;
}

export interface HpBattleSummary {
  result: 'win' | 'lose';
  /** Pokémon each side knocked out. */
  score: { you: number; opp: number };
  perfect: boolean;
  /** Damage each side dealt. */
  totals: { you: number; opp: number };
  /** Kept for the result screen contract; HP battles never need a tiebreak. */
  tiebreak: false;
}

export function summarizeBattle(state: BattleState): HpBattleSummary {
  const fainted = (fighters: Fighter[]) => fighters.filter(f => f.hp <= 0).length;
  const dealt = (side: Side) => state.duels.reduce((sum, d) => sum + d.hits.filter(h => h.attacker === side).reduce((s, h) => s + h.damage, 0), 0);
  const youFainted = fainted(state.you);
  return {
    result: battleWinner(state) === 'you' ? 'win' : 'lose',
    score: { you: fainted(state.opp), opp: youFainted },
    perfect: battleWinner(state) === 'you' && youFainted === 0,
    totals: { you: dealt('you'), opp: dealt('opp') },
    tiebreak: false,
  };
}
