// Economy tuning in one place. Pulls are cheap on purpose: levels come from duplicates (+1 per copy) and Rare Candy,
// so the player is expected to open hundreds of Poké Balls over time.

/** Pokédollars a new trainer starts with: 120 Poké Balls, enough to fill a team after picking a starter. */
export const STARTING_COINS = 600;

/** Team size: six Pokémon, one per battle round. */
export const DECK_SIZE = 6;

/** Level the starter Pokémon begins at. */
export const STARTER_LEVEL = 5;
export const STARTERS = [1, 4, 7];

/** A duplicate of a card already at its level cap becomes Rare Candy instead. */
export const OVERFLOW_CANDY = 1;

/** Daily gift: coins grow with the streak (capped), plus a Great Ball every 7th day. */
export const DAILY_BASE = 150;
export const DAILY_STREAK_BONUS = 25;
export const DAILY_STREAK_CAP = 10;
export const DAILY_BALL_EVERY = 7;

export function dailyGift(streak: number): { coins: number; greatBall: boolean } {
  const day = Math.max(1, streak);
  return {
    coins: DAILY_BASE + DAILY_STREAK_BONUS * (Math.min(day, DAILY_STREAK_CAP) - 1),
    greatBall: day % DAILY_BALL_EVERY === 0,
  };
}

/** Badges needed to unlock each capture banner and the League. */
export const UNLOCK_BADGES = { great: 1, ultra: 3, league: 8 } as const;
