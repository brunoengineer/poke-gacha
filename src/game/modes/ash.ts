// Ash: the final challenge of Ranked mode, open once the player reaches No. 1. He can be fought once per hour (the
// hour starts when the battle does, so quitting doesn't give another try), and his team changes every time: Pikachu
// plus five other Pokémon he used in the anime. Rules are relative to the player's team, not fixed levels.

import type { TeamMember } from '../battle';
import type { Reward } from '../rewards';
import { defaultRng, shuffle, type Rng } from '../rng';
import type { PlayerScale } from '../scaling';
import { rankForRating, type LadderSave } from './competition';

export const PIKACHU = 25;
/** Pokémon Ash used in the anime (Kanto to Sinnoh), in the forms he had them. */
export const ASH_ROSTER = [
  12, 18, 1, 6, 7, 99, 57, 89, 128, 143, 131, // Butterfree, Pidgeot, Bulbasaur, Charizard, Squirtle, Kingler, Primeape, Muk, Tauros, Snorlax, Lapras
  214, 153, 156, 158, 164, 232, // Heracross, Bayleef, Quilava, Totodile, Noctowl, Donphan
  277, 254, 341, 324, 362, // Swellow, Sceptile, Corphish, Torkoal, Glalie
  398, 389, 392, 418, 472, 443, 190, // Staraptor, Torterra, Infernape, Buizel, Gliscor, Gible, Aipom
];

/** His team's level over the player's team average. */
export const ASH_AVERAGE_BOOST = 1.4;
/** Pikachu's level over the player's strongest Pokémon. */
export const PIKACHU_BONUS = 100;
export const ASH_COOLDOWN = 60 * 60 * 1000;
export const ASH_PRIZE: Reward[] = [{ kind: 'item', item: 'master-ball', amount: 5 }];

export interface AshRecord {
  wins: number;
  losses: number;
  /** When the last battle started. */
  lastAt: number;
}

/** Open for good once the player reached No. 1 (losing the crown later doesn't close him). */
export const ashUnlocked = (ladder: LadderSave) =>
  ladder.best === 1 || ladder.milestones.includes('top1') || rankForRating(ladder.rating) === 1;

/** Milliseconds until Ash can be fought again (0: now). */
export function ashWait(ladder: LadderSave, now = Date.now()): number {
  const last = ladder.ash?.lastAt;
  if (last == null) return 0;
  // A clock moved backwards must not lock him out for longer than the cooldown.
  const elapsed = Math.max(0, now - last);
  return last > now ? ASH_COOLDOWN : Math.max(0, ASH_COOLDOWN - elapsed);
}

export const ashTeamLevel = (scale: PlayerScale) => Math.round(scale.average * ASH_AVERAGE_BOOST);
export const pikachuLevel = (scale: PlayerScale) => scale.max + PIKACHU_BONUS;

/** Five random Pokémon from his roster at 140% of the player's average, then Pikachu at their strongest level + 100. */
export function ashTeam(scale: PlayerScale, rng: Rng = defaultRng): TeamMember[] {
  const level = ashTeamLevel(scale);
  return [
    ...shuffle(ASH_ROSTER, rng).slice(0, 5).map(id => ({ id, level })),
    { id: PIKACHU, level: pikachuLevel(scale) },
  ];
}

/** Starts the hour (mutates the ladder slice): call it before the battle. */
export function startAshBattle(ladder: LadderSave, now = Date.now()): boolean {
  if (!ashUnlocked(ladder) || ashWait(ladder, now) > 0) return false;
  const record = ladder.ash ?? { wins: 0, losses: 0, lastAt: now };
  ladder.ash = { ...record, lastAt: now };
  return true;
}

/** Records the result and returns the prize (nothing for a loss or a forfeit). */
export function finishAshBattle(ladder: LadderSave, won: boolean): Reward[] {
  const record = ladder.ash ?? { wins: 0, losses: 0, lastAt: Date.now() };
  ladder.ash = { ...record, wins: record.wins + (won ? 1 : 0), losses: record.losses + (won ? 0 : 1) };
  return won ? [...ASH_PRIZE] : [];
}
