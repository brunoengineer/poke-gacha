// Difficulty that follows an overleveled team. Gyms and Leagues keep the levels they were designed with until the
// team's average level passes them; from there each one trains up, so a strong team still gets a fight:
//   - Gyms: at least a share of the team's average, growing along the region (Gym 4: 80% … Gym 8: 100%). The last gym's
//     ace matches the team's strongest Pokémon.
//   - Leagues: duel 1 at the team's average, then +10%, +20%, +30%; the final's ace matches the strongest Pokémon too.
// Prizes don't change. Pure functions: callers pass the levels of the team that will fight.

export interface PlayerScale {
  /** Average level of the team, rounded. */
  average: number;
  /** Level of its strongest Pokémon. */
  max: number;
}

export function teamScale(levels: number[]): PlayerScale {
  if (!levels.length) return { average: 0, max: 0 };
  return { average: Math.round(levels.reduce((sum, level) => sum + level, 0) / levels.length), max: Math.max(...levels) };
}

export interface Difficulty {
  levels: [number, number];
  /** Level of the last Pokémon of the team, when it differs from the rest. */
  ace: number | null;
  /** True when the team outgrew the designed levels. */
  scaled: boolean;
}

/** Share of the team's average each gym of a region reaches at least (in gym order). */
export const GYM_SCALE = [0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1];
/** The team's average times this, for each League duel. */
export const DUEL_SCALE = [1, 1.1, 1.2, 1.3];

const designed = (levels: [number, number]): Difficulty => ({ levels, ace: null, scaled: false });

/** A gym at position `index` of its region, with these designed levels (rematch bonus included). */
export function scaleGym(levels: [number, number], index: number, scale?: PlayerScale): Difficulty {
  if (!scale || scale.average <= levels[1]) return designed(levels);
  const floor = Math.round(scale.average * GYM_SCALE[index]);
  const trained: [number, number] = [Math.max(levels[0], floor), Math.max(levels[1], floor)];
  const ace = index === GYM_SCALE.length - 1 ? Math.max(trained[1], scale.max) : null;
  // Its share of the average may still be below the designed levels: then nothing changes, and it doesn't say it did.
  return { levels: trained, ace, scaled: ace != null || trained[0] !== levels[0] || trained[1] !== levels[1] };
}

/**
 * A League duel with these designed levels (title bonus included). It scales once the team passes the League's top
 * level (leagueMax), for all four duels at once: otherwise a semifinal could scale past a final that didn't.
 */
export function scaleDuel(levels: [number, number], duel: number, leagueMax: number, scale?: PlayerScale): Difficulty {
  if (!scale || scale.average <= leagueMax) return designed(levels);
  const level = Math.round(scale.average * DUEL_SCALE[duel]);
  return { levels: [level, level], ace: duel === DUEL_SCALE.length - 1 ? Math.max(level, scale.max) : null, scaled: true };
}
