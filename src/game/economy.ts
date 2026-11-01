// Economy tuning in one place. Pulls are cheap, but coins come slowly: the early game is about training the few
// Pokémon you have (Rare Candy flows generously) rather than opening hundreds of balls at once.

/** Pokédollars a new trainer starts with: 30 Poké Balls, a small team to train. */
export const STARTING_COINS = 150;
/** Rare Candy given with the starter, to train the first team. */
export const STARTER_CANDY = 10;

/** Team size: six Pokémon, one per battle round. */
export const DECK_SIZE = 6;

/** Level the starter Pokémon begins at. */
export const STARTER_LEVEL = 5;
/** Kanto and Johto starters (grass, fire, water). */
export const STARTERS = [1, 4, 7, 152, 155, 158];

/** A duplicate of a card already at its level cap becomes Rare Candy instead. */
export const OVERFLOW_CANDY = 1;

/** Daily gift: coins grow with the streak (capped), Rare Candy every day, and a Great Ball every 7th day. */
export const DAILY_BASE = 80;
export const DAILY_STREAK_BONUS = 10;
export const DAILY_STREAK_CAP = 10;
export const DAILY_BALL_EVERY = 7;
export const DAILY_CANDY = 2;
export const DAILY_CANDY_BALL_DAY = 5;

export function dailyGift(streak: number): { coins: number; candy: number; greatBall: boolean } {
  const day = Math.max(1, streak);
  const greatBall = day % DAILY_BALL_EVERY === 0;
  return {
    coins: DAILY_BASE + DAILY_STREAK_BONUS * (Math.min(day, DAILY_STREAK_CAP) - 1),
    candy: greatBall ? DAILY_CANDY_BALL_DAY : DAILY_CANDY,
    greatBall,
  };
}

/** Badges needed to unlock each capture banner and the League. */
export const UNLOCK_BADGES = { great: 1, ultra: 3, league: 8 } as const;
/** Johto: its gyms open with all 8 Kanto badges, its League with all 8 Johto badges (counted per region). */
export const JOHTO_UNLOCK_BADGES = { gyms: 8, league: 8 } as const;
