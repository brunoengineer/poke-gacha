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
/** Starters by region, in region order (Kanto, Johto, Hoenn, Sinnoh), each as grass, fire, water. */
export const STARTERS = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393];

/** A duplicate of a card already at its level cap becomes Rare Candy instead. */
export const OVERFLOW_CANDY = 1;

/** Daily gift: coins grow with the streak (capped), Rare Candy every day, and a Master Ball every 7th day. */
export const DAILY_BASE = 80;
export const DAILY_STREAK_BONUS = 10;
export const DAILY_STREAK_CAP = 10;
/** Every DAILY_BALL_EVERY-th day of the streak is the big one. */
export const DAILY_BALL_EVERY = 7;
/** Given every day from the second day of a streak: 1, or DAILY_BIG_BALLS on the big day. */
export const DAILY_BALL = 'master-ball';
export const DAILY_BIG_BALLS = 5;
export const DAILY_CANDY = 2;
export const DAILY_CANDY_BALL_DAY = 5;

export function dailyGift(streak: number): { coins: number; candy: number; balls: number } {
  const day = Math.max(1, streak);
  const bigDay = day % DAILY_BALL_EVERY === 0;
  return {
    coins: DAILY_BASE + DAILY_STREAK_BONUS * (Math.min(day, DAILY_STREAK_CAP) - 1),
    candy: bigDay ? DAILY_CANDY_BALL_DAY : DAILY_CANDY,
    balls: bigDay ? DAILY_BIG_BALLS : day >= 2 ? 1 : 0,
  };
}

/** Badges needed to unlock each capture banner and the League. */
export const UNLOCK_BADGES = { great: 1, ultra: 3, league: 8 } as const;
/** Johto and later regions: gyms open with all 8 badges of the region before, the League with the region's own 8. */
export const JOHTO_UNLOCK_BADGES = { gyms: 8, league: 8 } as const;
