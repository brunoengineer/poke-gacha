// HP battle rules. Each side has up to six Pokémon; two fight at a time until one faints:
//   - Speed decides who hits first (ties go to the player), then they take turns.
//   - A hit uses the attacker's better offensive stat: Attack against the target's Defense, or Sp. Atk against
//     Sp. Def, whichever deals more damage. Type advantage scales it (typeMultiplier). There are no moves.
//   - Each hit can go differently, with the same fixed chances for both sides: critical (double damage), miss or
//     blocked by the target (no damage).
//   - A card with maxHit (Legendary Battle bosses) can't take more than that share of the target's max HP in one hit.
//   - The winner stays in with the HP it has left; the losing side sends its next Pokémon. The player chooses
//     who goes in (at the start, after a faint, and optionally when a new opponent enters); the opponent sends
//     its team in order.
//   - The side with Pokémon still standing wins. Perfect: none of the player's Pokémon fainted in this battle.
//   - The player's team may start hurt (League runs carry HP over between duels): createBattle takes HP fractions.

import { bestEffectiveness } from '../data/types';
import { typeMultiplier, type BattleCard } from './battle';
import { defaultRng, type Rng } from './rng';

/** Scales damage so an even matchup takes about three hits. Only the pacing depends on it, not who wins. */
export const DAMAGE_SCALE = 0.75;

export const CRIT_CHANCE = 0.1;
export const MISS_CHANCE = 0.02;
export const BLOCK_CHANCE = 0.01;
export const CRIT_MULT = 2;

export type Side = 'you' | 'opp';
export type HitOutcome = 'normal' | 'crit' | 'miss' | 'block';

/** One roll per hit, so the chances are exact and a hit is only ever one of these. */
export function rollHit(rng: Rng = defaultRng): HitOutcome {
  const roll = rng();
  if (roll < MISS_CHANCE) return 'miss';
  if (roll < MISS_CHANCE + BLOCK_CHANCE) return 'block';
  if (roll < MISS_CHANCE + BLOCK_CHANCE + CRIT_CHANCE) return 'crit';
  return 'normal';
}

/** Every hit lands normally (previews and tests of the other rules). */
export const NO_LUCK: Rng = () => 1;

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
  /** How it went; `damage` is what it really dealt (0 on a miss or a block). */
  outcome: HitOutcome;
  /** Target's HP after the hit. */
  hpLeft: number;
  ko: boolean;
}

const hitFor = (attack: number, defense: number, mult: number) =>
  Math.max(1, Math.round(((attack * attack) / (attack + defense)) * DAMAGE_SCALE * mult));

const capHit = (attacker: BattleCard, defender: BattleCard, damage: number) =>
  (attacker.maxHit ? Math.min(damage, Math.max(1, Math.round(defender.stats.hp * attacker.maxHit))) : damage);

/** The hit `attacker` lands on `defender` before luck (always the stronger of its physical and special attack). */
export function strike(attacker: BattleCard, defender: BattleCard): Strike {
  const effectiveness = bestEffectiveness(attacker.types, defender.types);
  const mult = typeMultiplier(effectiveness);
  const physical = hitFor(attacker.stats.atk, defender.stats.def, mult);
  const special = hitFor(attacker.stats.spa, defender.stats.spd, mult);
  return physical >= special
    ? { stat: 'atk', damage: capHit(attacker, defender, physical), effectiveness, mult }
    : { stat: 'spa', damage: capHit(attacker, defender, special), effectiveness, mult };
}

export const firstStriker = (you: BattleCard, opp: BattleCard): Side => (opp.stats.spe > you.stats.spe ? 'opp' : 'you');

export interface DuelResult {
  hits: Hit[];
  winner: Side;
}

/** Two Pokémon trade hits until one faints. Mutates the fighters' HP. */
export function fightDuel(you: Fighter, opp: Fighter, rng: Rng = defaultRng): DuelResult {
  const hits: Hit[] = [];
  let side = firstStriker(you.card, opp.card);
  while (you.hp > 0 && opp.hp > 0) {
    const [attacker, defender] = side === 'you' ? [you, opp] : [opp, you];
    const s = strike(attacker.card, defender.card);
    const outcome = rollHit(rng);
    const damage = outcome === 'crit' ? capHit(attacker.card, defender.card, s.damage * CRIT_MULT) : outcome === 'normal' ? s.damage : 0;
    defender.hp = Math.max(0, defender.hp - damage);
    hits.push({ ...s, damage, outcome, attacker: side, hpLeft: defender.hp, ko: defender.hp === 0 });
    side = side === 'you' ? 'opp' : 'you';
  }
  return { hits, winner: you.hp > 0 ? 'you' : 'opp' };
}

/** Predicts a duel without touching the real fighters (balance simulations, future opponent planning). */
export const previewDuel = (you: Fighter, opp: Fighter) => fightDuel({ ...you }, { ...opp }, NO_LUCK);

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
  /** Player's Pokémon already fainted when the battle started (they don't count against a perfect win). */
  startFainted: number;
}

/** A fighter at a fraction of its max HP (1 = full; anything above 0 keeps at least 1 HP). */
const fighter = (card: BattleCard, fraction = 1): Fighter => {
  const f = Math.max(0, Math.min(1, fraction));
  return { card, hp: f <= 0 ? 0 : Math.max(1, Math.round(card.stats.hp * f)) };
};

/**
 * Starts a battle. The opponent sends its team in the given order; the player picks with sendIn().
 * `youHp` gives the player's Pokémon their starting HP as fractions of max (default: full).
 */
export function createBattle(you: BattleCard[], opp: BattleCard[], youHp: number[] = []): BattleState {
  const team = you.map((card, i) => fighter(card, youHp[i] ?? 1));
  return {
    you: team, opp: opp.map(card => fighter(card)), youActive: null, oppActive: 0, duels: [],
    startFainted: team.filter(f => f.hp <= 0).length,
  };
}

/** The player's HP after the battle, as fractions of max HP (for carrying it over). */
export const hpFractions = (state: BattleState) => state.you.map(f => f.hp / f.card.stats.hp);

export const standing = (fighters: Fighter[]) => fighters.flatMap((f, i) => (f.hp > 0 ? [i] : []));

/** Auto-play's pick: the player's highest-level Pokémon still standing (ties: team order). No type matchups. */
export const autoPick = (state: BattleState): number =>
  standing(state.you).reduce((best, i) => (state.you[i].card.level > state.you[best].card.level ? i : best));

/** Puts one of the player's standing Pokémon on the field (also used for the optional switch). */
export function sendIn(state: BattleState, index: number): boolean {
  if (!state.you[index] || state.you[index].hp <= 0 || battleWinner(state)) return false;
  state.youActive = index;
  return true;
}

/** Fights the current duel. The fainted side's slot empties: the opponent sends its next Pokémon right away. */
export function playDuel(state: BattleState, rng: Rng = defaultRng): DuelLog | null {
  if (state.youActive == null || state.oppActive < 0) return null;
  const log: DuelLog = { you: state.youActive, opp: state.oppActive, ...fightDuel(state.you[state.youActive], state.opp[state.oppActive], rng) };
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
  const youFainted = fainted(state.you) - (state.startFainted ?? 0);
  return {
    result: battleWinner(state) === 'you' ? 'win' : 'lose',
    score: { you: fainted(state.opp), opp: youFainted },
    perfect: battleWinner(state) === 'you' && youFainted === 0,
    totals: { you: dealt('you'), opp: dealt('opp') },
    tiebreak: false,
  };
}
